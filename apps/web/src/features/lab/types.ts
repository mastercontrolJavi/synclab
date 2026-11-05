import type { PlayerSnapshot, Vector2 } from "@synclab/shared";

export type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "room_full"
  | "server_unavailable";

export interface NetworkConditions {
  rttMs: number;
  jitterMs: number;
  packetLossPercent: number;
}

export interface NetcodeSettings {
  prediction: boolean;
  reconciliation: boolean;
  interpolation: boolean;
}

export interface LabSettings extends NetworkConditions, NetcodeSettings {}

export interface NetworkEvent {
  id: number;
  timestamp: number;
  direction: "outbound" | "inbound" | "local";
  type: "input" | "snapshot" | "ack" | "reconcile" | "drop" | "system";
  label: string;
  detail: string;
}

export type PacketKind = "input" | "snapshot" | "ping" | "control";

/** One application message in flight through the simulated network. */
export interface PacketFlight {
  id: number;
  direction: "outbound" | "inbound";
  kind: PacketKind;
  /** performance.now() when it entered the simulated network. */
  sentAt: number;
  delayMs: number;
  dropped: boolean;
}

/** One reconciliation: where we were, where the server put us, and the replay. */
export interface CorrectionRecord {
  id: number;
  at: number;
  from: Vector2;
  to: Vector2;
  authoritative: Vector2;
  /** Positions after each replayed input, starting from the authoritative one. */
  replay: Vector2[];
  distance: number;
  replayed: number;
}

export interface ClientTelemetry {
  readonly packets: readonly PacketFlight[];
  readonly corrections: readonly CorrectionRecord[];
}

export interface ClientMetrics {
  rttMs: number;
  /** RFC 3550 inter-arrival jitter measured on snapshots, in ms. */
  jitterMs: number;
  /** Measured share of packets dropped in the last 5 s, 0 to 100. */
  lossPercent: number;
  /** Reconciliations per second over the last 3 s. */
  correctionsPerSecond: number;
  serverTickRate: number;
  snapshotRate: number;
  pendingInputs: number;
  lastAcknowledgedInput: number;
  predictionError: number;
  reconciliationCount: number;
  packetsSent: number;
  packetsReceived: number;
  packetsDropped: number;
  connectedPlayers: number;
  webSocketState: ConnectionState;
}

export interface RenderPlayer extends PlayerSnapshot {
  isLocal: boolean;
}

export interface RenderFrame {
  players: RenderPlayer[];
  localAuthoritative: Vector2 | null;
  localPredicted: Vector2 | null;
  localRendered: Vector2 | null;
  remoteSnapshotPositions: Vector2[];
}

export interface GameClientObserver {
  onStatus: (status: ConnectionState) => void;
  onMetrics: (metrics: ClientMetrics) => void;
  onEvents: (events: NetworkEvent[]) => void;
}
