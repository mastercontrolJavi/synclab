import {
  FIXED_DT,
  INPUT_RATE,
  INTERPOLATION_DELAY_MS,
  MAX_NETWORK_EVENTS,
  MAX_PENDING_INPUTS,
  MAX_SNAPSHOT_BUFFER,
  applyMovement,
  distanceBetween,
  insertSnapshotSorted,
  interpolatePlayer,
  reconcilePosition,
  type MovementInput,
  type PlayerSnapshot,
  type ServerMessage,
  type SnapshotMessage,
  type Vector2,
} from "@synclab/shared";

import type { SocketFactory } from "./local-server";
import { hashSeed, SimulatedTransport, type PacketEvent } from "./network-simulator";
import type {
  ClientMetrics,
  ClientTelemetry,
  CorrectionRecord,
  PacketFlight,
  PacketKind,
  ConnectionState,
  GameClientObserver,
  LabSettings,
  NetworkEvent,
  RenderFrame,
  RenderPlayer,
} from "./types";

interface GameClientOptions {
  roomId: string;
  serverUrl: string;
  initialSettings: LabSettings;
  observer: GameClientObserver;
  socketFactory?: SocketFactory;
}

// A free Render service can take about a minute to wake after being idle.
const MAX_RECONNECT_ATTEMPTS = 12;
const METRICS_INTERVAL_MS = 250;
const PING_INTERVAL_MS = 1_000;
const SMALL_CORRECTION_LIMIT = 24;
// Telemetry is read-only instrumentation for the visualizations.
const MAX_PACKET_FLIGHTS = 400;
const PACKET_RETENTION_MS = 1_500;
const MAX_CORRECTIONS = 32;
const LOSS_WINDOW_MS = 5_000;
const CORRECTION_WINDOW_MS = 3_000;

function packetKind(messageType: string): PacketKind {
  switch (messageType) {
    case "player_input":
      return "input";
    case "snapshot":
      return "snapshot";
    case "ping":
    case "pong":
      return "ping";
    default:
      return "control";
  }
}

export class GameClient {
  private readonly transport: SimulatedTransport;
  private readonly snapshots: SnapshotMessage[] = [];
  private readonly events: NetworkEvent[] = [];
  private settings: LabSettings;
  private status: ConnectionState = "connecting";
  private playerId: string | null = null;
  private latestSnapshot: SnapshotMessage | null = null;
  private localAuthoritative: PlayerSnapshot | null = null;
  private localPredicted: PlayerSnapshot | null = null;
  private pendingInputs: MovementInput[] = [];
  private inputSequence = 0;
  private pingNonce = 0;
  private lastAcknowledgedInput = -1;
  private lastHandledServerTick = -1;
  private inputDirection: Vector2 = { x: 0, y: 0 };
  private correctionOffset: Vector2 = { x: 0, y: 0 };
  private lastRenderTime = performance.now();
  private clockOffsetMs = 0;
  private smoothedRttMs = 0;
  private predictionError = 0;
  private reconciliationCount = 0;
  private connectedPlayers = 0;
  private serverTickRate = 0;
  private snapshotRate = 0;
  private reconnectAttempts = 0;
  private eventId = 0;
  private destroyed = false;
  private suppressReconnect = false;
  private inputTimer: number | null = null;
  private pingTimer: number | null = null;
  private metricsTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private joinRetryTimer: number | null = null;
  private readonly packetFlights: PacketFlight[] = [];
  private readonly corrections: CorrectionRecord[] = [];
  private readonly lossSamples: { at: number; dropped: boolean }[] = [];
  private packetId = 0;
  private correctionId = 0;
  private jitterMs = 0;
  private lastSnapshotArrival: { at: number; serverTime: number } | null = null;

  constructor(private readonly options: GameClientOptions) {
    this.settings = options.initialSettings;
    this.transport = new SimulatedTransport({
      url: options.serverUrl,
      seed: hashSeed(options.roomId),
      conditions: options.initialSettings,
      onOpen: this.handleSocketOpen,
      onClose: this.handleSocketClose,
      onError: this.handleSocketError,
      onMessage: this.handleMessage,
      socketFactory: options.socketFactory,
      onPacket: (packet) => {
        this.recordPacket(packet);
        if (packet.dropped) {
          this.pushEvent(
            packet.direction,
            "drop",
            "PACKET DROPPED",
            `${packet.messageType.replaceAll("_", " ")} · ${Math.round(packet.delayMs)}ms scheduled`,
          );
        }
      },
    });
  }

  start(): void {
    if (this.inputTimer !== null) {
      return;
    }
    this.destroyed = false;
    this.suppressReconnect = false;
    this.setStatus("connecting");
    this.transport.connect();
    this.inputTimer = window.setInterval(this.sampleInput, 1_000 / INPUT_RATE);
    this.pingTimer = window.setInterval(this.sendPing, PING_INTERVAL_MS);
    this.metricsTimer = window.setInterval(this.publishState, METRICS_INTERVAL_MS);
  }

  destroy(): void {
    this.destroyed = true;
    this.suppressReconnect = true;
    this.clearTimer("inputTimer");
    this.clearTimer("pingTimer");
    this.clearTimer("metricsTimer");
    this.clearTimer("reconnectTimer");
    this.clearTimer("joinRetryTimer");
    this.transport.disconnect();
  }

  retry(): void {
    if (this.destroyed) {
      return;
    }
    this.clearTimer("reconnectTimer");
    this.reconnectAttempts = 0;
    this.suppressReconnect = false;
    this.resetSession();
    this.setStatus("connecting");
    this.transport.connect();
  }

  updateSettings(settings: LabSettings): void {
    const predictionWasEnabled = this.settings.prediction;
    this.settings = settings;
    this.transport.updateConditions(settings);

    if (predictionWasEnabled && !settings.prediction && this.localAuthoritative) {
      this.localPredicted = { ...this.localAuthoritative };
      this.correctionOffset = { x: 0, y: 0 };
    }
    if (!predictionWasEnabled && settings.prediction && this.localAuthoritative) {
      const reconciled = settings.reconciliation
        ? reconcilePosition(
            this.localAuthoritative,
            this.lastAcknowledgedInput,
            this.pendingInputs,
          ).position
        : this.localAuthoritative;
      this.localPredicted = { ...this.localAuthoritative, ...reconciled };
    }
  }

  /** Read-only view of in-flight packets and recent corrections. */
  getTelemetry(): ClientTelemetry {
    const cutoff = performance.now() - PACKET_RETENTION_MS;
    while (this.packetFlights.length > 0) {
      const first = this.packetFlights[0];
      if (!first || first.sentAt + first.delayMs >= cutoff) {
        break;
      }
      this.packetFlights.shift();
    }
    return { packets: this.packetFlights, corrections: this.corrections };
  }

  /** Where the local player is drawn, for input helpers like the autopilot. */
  getLocalPosition(): Vector2 | null {
    return this.localPredicted
      ? { x: this.localPredicted.x, y: this.localPredicted.y }
      : null;
  }

  /**
   * Where the pending inputs say you should be, computed with the shared
   * reconciliation helper. Drawn only when prediction is off, to show the lag
   * between keypress and authority. Display only; never fed back.
   */
  getInputPreview(): Vector2 | null {
    if (!this.localAuthoritative) {
      return null;
    }
    return reconcilePosition(
      this.localAuthoritative,
      this.lastAcknowledgedInput,
      this.pendingInputs,
    ).position;
  }

  getStatus(): ConnectionState {
    return this.status;
  }

  setInputDirection(moveX: number, moveY: number): void {
    this.inputDirection = { x: moveX, y: moveY };
  }

  getRenderFrame(now = performance.now()): RenderFrame {
    const deltaSeconds = Math.min((now - this.lastRenderTime) / 1_000, 0.1);
    this.lastRenderTime = now;
    const decay = Math.exp(-deltaSeconds / 0.08);
    this.correctionOffset.x *= decay;
    this.correctionOffset.y *= decay;

    const players: RenderPlayer[] = [];
    let localRendered: Vector2 | null = null;

    if (this.localPredicted) {
      localRendered = {
        x: this.localPredicted.x + this.correctionOffset.x,
        y: this.localPredicted.y + this.correctionOffset.y,
      };
      players.push({
        ...this.localPredicted,
        ...localRendered,
        isLocal: true,
      });
    }

    const snapshot = this.latestSnapshot;
    if (snapshot) {
      const renderServerTime = Date.now() + this.clockOffsetMs - INTERPOLATION_DELAY_MS;
      for (const playerId of Object.keys(snapshot.players)) {
        if (playerId === this.playerId) {
          continue;
        }
        const remote = this.settings.interpolation
          ? interpolatePlayer(this.snapshots, playerId, renderServerTime)
          : snapshot.players[playerId] ?? null;
        if (remote) {
          players.push({ ...remote, isLocal: false });
        }
      }
    }

    const remoteSnapshotPositions = snapshot
      ? Object.values(snapshot.players)
          .filter((player) => player.id !== this.playerId)
          .map((player) => ({ x: player.x, y: player.y }))
      : [];

    return {
      players,
      localAuthoritative: this.localAuthoritative
        ? { x: this.localAuthoritative.x, y: this.localAuthoritative.y }
        : null,
      localPredicted: this.localPredicted
        ? { x: this.localPredicted.x, y: this.localPredicted.y }
        : null,
      localRendered,
      remoteSnapshotPositions,
    };
  }

  private readonly handleSocketOpen = (): void => {
    this.resetSession();
    this.pushEvent("local", "system", "SOCKET OPEN", "Joining authoritative room");
    this.sendJoin();
    this.joinRetryTimer = window.setInterval(this.sendJoin, 1_000);
  };

  private readonly handleSocketClose = (): void => {
    this.clearTimer("joinRetryTimer");
    if (this.destroyed || this.suppressReconnect) {
      return;
    }
    this.scheduleReconnect();
  };

  private readonly handleSocketError = (): void => {
    this.pushEvent("local", "system", "SOCKET ERROR", "Realtime server unavailable");
  };

  private readonly handleMessage = (message: ServerMessage): void => {
    switch (message.type) {
      case "welcome":
        this.playerId = message.playerId;
        this.clockOffsetMs = message.serverTime - Date.now();
        this.reconnectAttempts = 0;
        this.clearTimer("joinRetryTimer");
        this.setStatus("connected");
        this.pushEvent(
          "inbound",
          "system",
          "JOIN ACCEPTED",
          `Player ${message.playerId} · ${message.tickRate}Hz simulation`,
        );
        break;
      case "snapshot":
        this.handleSnapshot(message);
        break;
      case "pong":
        this.handlePong(message.clientTime, message.serverTime);
        break;
      case "room_full":
        this.suppressReconnect = true;
        this.setStatus("room_full");
        this.pushEvent("inbound", "system", "ROOM FULL", message.roomId);
        this.transport.disconnect();
        break;
      case "player_joined":
        this.connectedPlayers = message.connectedPlayers;
        this.pushEvent(
          "inbound",
          "system",
          "PLAYER JOINED",
          `${message.connectedPlayers}/2 connected`,
        );
        break;
      case "player_left":
        this.connectedPlayers = message.connectedPlayers;
        this.pushEvent(
          "inbound",
          "system",
          "PLAYER LEFT",
          `${message.connectedPlayers}/2 connected`,
        );
        break;
      case "error":
        this.pushEvent("inbound", "system", message.code.toUpperCase(), message.message);
        break;
    }
  };

  private handleSnapshot(snapshot: SnapshotMessage): void {
    this.measureJitter(snapshot);
    insertSnapshotSorted(this.snapshots, snapshot, MAX_SNAPSHOT_BUFFER);
    if (snapshot.serverTick <= this.lastHandledServerTick) {
      return;
    }
    this.lastHandledServerTick = snapshot.serverTick;
    this.latestSnapshot = snapshot;
    this.connectedPlayers = snapshot.metrics.connectedPlayers;
    this.serverTickRate = snapshot.metrics.actualTickRate;
    this.snapshotRate = snapshot.metrics.actualSnapshotRate;

    if (!this.playerId) {
      return;
    }
    const authoritative = snapshot.players[this.playerId];
    if (!authoritative) {
      return;
    }

    const previousPredicted = this.localPredicted;
    this.predictionError = previousPredicted
      ? distanceBetween(previousPredicted, authoritative)
      : 0;
    this.localAuthoritative = { ...authoritative };

    const acknowledgement = snapshot.acknowledgements[this.playerId] ?? -1;
    const remainingInputs = this.pendingInputs.filter(
      (input) => input.sequence > acknowledgement,
    );
    this.pendingInputs = remainingInputs;
    this.lastAcknowledgedInput = Math.max(this.lastAcknowledgedInput, acknowledgement);

    if (!this.settings.prediction) {
      this.localPredicted = { ...authoritative };
    } else if (this.settings.reconciliation) {
      const reconciled = reconcilePosition(authoritative, acknowledgement, remainingInputs);
      const nextPredicted = { ...authoritative, ...reconciled.position };
      const correction = previousPredicted
        ? distanceBetween(previousPredicted, nextPredicted)
        : 0;

      if (previousPredicted && correction > 0.05) {
        this.reconciliationCount += 1;
        this.recordCorrection(previousPredicted, nextPredicted, authoritative, remainingInputs, correction);
        this.pushEvent(
          "local",
          "reconcile",
          "RECONCILE",
          `${correction.toFixed(1)}px · replay ${remainingInputs.length} pending`,
        );
        if (correction <= SMALL_CORRECTION_LIMIT) {
          this.correctionOffset.x += previousPredicted.x - nextPredicted.x;
          this.correctionOffset.y += previousPredicted.y - nextPredicted.y;
        } else {
          this.correctionOffset = { x: 0, y: 0 };
        }
      }
      this.localPredicted = nextPredicted;
    } else if (this.localPredicted) {
      this.localPredicted = {
        ...this.localPredicted,
        isIt: authoritative.isIt,
        isScripted: authoritative.isScripted,
        tagCount: authoritative.tagCount,
      };
    } else {
      this.localPredicted = { ...authoritative };
    }

    this.pushEvent(
      "inbound",
      "snapshot",
      `SNAPSHOT #${snapshot.serverTick}`,
      `ACK ${acknowledgement < 0 ? "N/A" : acknowledgement}`,
    );
  }

  private recordPacket(packet: PacketEvent): void {
    this.packetFlights.push({
      id: this.packetId,
      direction: packet.direction,
      kind: packetKind(packet.messageType),
      sentAt: performance.now(),
      delayMs: packet.delayMs,
      dropped: packet.dropped,
    });
    this.packetId += 1;
    this.lossSamples.push({ at: performance.now(), dropped: packet.dropped });
    if (this.packetFlights.length > MAX_PACKET_FLIGHTS) {
      this.packetFlights.splice(0, this.packetFlights.length - MAX_PACKET_FLIGHTS);
    }
  }

  private recordCorrection(
    from: Vector2,
    to: Vector2,
    authoritative: Vector2,
    replayedInputs: readonly MovementInput[],
    distance: number,
  ): void {
    // Re-derive the replayed path with the same shared movement rule, for display only.
    const replay: Vector2[] = [{ x: authoritative.x, y: authoritative.y }];
    let cursor: Vector2 = replay[0] ?? authoritative;
    for (const input of replayedInputs) {
      cursor = applyMovement(cursor, input, FIXED_DT);
      replay.push(cursor);
    }
    this.corrections.push({
      id: this.correctionId,
      at: performance.now(),
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      authoritative: { x: authoritative.x, y: authoritative.y },
      replay,
      distance,
      replayed: replayedInputs.length,
    });
    this.correctionId += 1;
    if (this.corrections.length > MAX_CORRECTIONS) {
      this.corrections.splice(0, this.corrections.length - MAX_CORRECTIONS);
    }
  }

  private measureJitter(snapshot: SnapshotMessage): void {
    const arrival = performance.now();
    const previous = this.lastSnapshotArrival;
    if (previous && snapshot.serverTime > previous.serverTime) {
      const transitDelta =
        arrival - previous.at - (snapshot.serverTime - previous.serverTime);
      this.jitterMs += (Math.abs(transitDelta) - this.jitterMs) / 16;
    }
    if (!previous || snapshot.serverTime > previous.serverTime) {
      this.lastSnapshotArrival = { at: arrival, serverTime: snapshot.serverTime };
    }
  }

  private measureLossPercent(now: number): number {
    while (this.lossSamples.length > 0 && now - (this.lossSamples[0]?.at ?? now) > LOSS_WINDOW_MS) {
      this.lossSamples.shift();
    }
    const total = this.lossSamples.length;
    let dropped = 0;
    for (const sample of this.lossSamples) {
      if (sample.dropped) {
        dropped += 1;
      }
    }
    return total === 0 ? 0 : (dropped / total) * 100;
  }

  private handlePong(clientTime: number, serverTime: number): void {
    const now = Date.now();
    const roundTripTime = Math.max(0, now - clientTime);
    this.smoothedRttMs = this.smoothedRttMs === 0
      ? roundTripTime
      : this.smoothedRttMs * 0.8 + roundTripTime * 0.2;
    const measuredOffset = serverTime - (clientTime + roundTripTime / 2);
    this.clockOffsetMs = this.clockOffsetMs * 0.8 + measuredOffset * 0.2;
  }

  private readonly sampleInput = (): void => {
    if (this.status !== "connected" || !this.playerId) {
      return;
    }
    if (this.inputDirection.x === 0 && this.inputDirection.y === 0) {
      return;
    }

    const input: MovementInput = {
      sequence: this.inputSequence,
      moveX: this.inputDirection.x,
      moveY: this.inputDirection.y,
      clientTime: Date.now(),
    };
    this.inputSequence += 1;
    this.pendingInputs.push(input);
    if (this.pendingInputs.length > MAX_PENDING_INPUTS) {
      this.pendingInputs.splice(0, this.pendingInputs.length - MAX_PENDING_INPUTS);
    }

    if (this.settings.prediction && this.localPredicted) {
      const position = applyMovement(this.localPredicted, input, FIXED_DT);
      this.localPredicted = { ...this.localPredicted, ...position };
    }

    this.transport.send({ type: "player_input", ...input });
    this.pushEvent(
      "outbound",
      "input",
      `INPUT #${input.sequence}`,
      `(${input.moveX}, ${input.moveY})`,
    );
  };

  private readonly sendPing = (): void => {
    if (this.status !== "connected") {
      return;
    }
    this.transport.send({
      type: "ping",
      nonce: this.pingNonce,
      clientTime: Date.now(),
    });
    this.pingNonce += 1;
  };

  private readonly sendJoin = (): void => {
    if (this.playerId || this.destroyed) {
      return;
    }
    this.transport.send({ type: "join_room", roomId: this.options.roomId });
  };

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      this.setStatus("server_unavailable");
      return;
    }

    const delayMs = Math.min(500 * 2 ** (this.reconnectAttempts - 1), 8_000);
    this.setStatus("reconnecting");
    this.pushEvent(
      "local",
      "system",
      "RECONNECTING",
      `Attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delayMs}ms`,
    );
    this.reconnectTimer = window.setTimeout(() => {
      this.resetSession();
      this.transport.connect();
    }, delayMs);
  }

  private resetSession(): void {
    this.playerId = null;
    this.latestSnapshot = null;
    this.localAuthoritative = null;
    this.localPredicted = null;
    this.pendingInputs = [];
    this.snapshots.length = 0;
    this.lastAcknowledgedInput = -1;
    this.lastHandledServerTick = -1;
    this.inputSequence = 0;
    this.correctionOffset = { x: 0, y: 0 };
    this.lastSnapshotArrival = null;
    this.jitterMs = 0;
  }

  private setStatus(status: ConnectionState): void {
    this.status = status;
    this.options.observer.onStatus(status);
  }

  private readonly publishState = (): void => {
    const transportStats = this.transport.getStats();
    const now = performance.now();
    let recentCorrections = 0;
    for (const correction of this.corrections) {
      if (now - correction.at <= CORRECTION_WINDOW_MS) {
        recentCorrections += 1;
      }
    }
    const metrics: ClientMetrics = {
      rttMs: this.smoothedRttMs,
      jitterMs: this.jitterMs,
      lossPercent: this.measureLossPercent(now),
      correctionsPerSecond: recentCorrections / (CORRECTION_WINDOW_MS / 1_000),
      serverTickRate: this.serverTickRate,
      snapshotRate: this.snapshotRate,
      pendingInputs: this.pendingInputs.length,
      lastAcknowledgedInput: this.lastAcknowledgedInput,
      predictionError: this.predictionError,
      reconciliationCount: this.reconciliationCount,
      packetsSent: transportStats.packetsSent,
      packetsReceived: transportStats.packetsReceived,
      packetsDropped: transportStats.packetsDropped,
      connectedPlayers: this.connectedPlayers,
      webSocketState: this.status,
    };
    this.options.observer.onMetrics(metrics);
    this.options.observer.onEvents([...this.events]);
  };

  private pushEvent(
    direction: NetworkEvent["direction"],
    type: NetworkEvent["type"],
    label: string,
    detail: string,
  ): void {
    this.events.unshift({
      id: this.eventId,
      timestamp: Date.now(),
      direction,
      type,
      label,
      detail,
    });
    this.eventId += 1;
    if (this.events.length > MAX_NETWORK_EVENTS) {
      this.events.length = MAX_NETWORK_EVENTS;
    }
  }

  private clearTimer(
    property:
      | "inputTimer"
      | "pingTimer"
      | "metricsTimer"
      | "reconnectTimer"
      | "joinRetryTimer",
  ): void {
    const timer = this[property];
    if (timer !== null) {
      window.clearTimeout(timer);
      this[property] = null;
    }
  }
}
