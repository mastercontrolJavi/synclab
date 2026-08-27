import {
  isServerMessage,
  type ClientMessage,
  type ServerMessage,
} from "@synclab/shared";

import type { NetworkConditions } from "./types";

interface TransportStats {
  packetsSent: number;
  packetsReceived: number;
  packetsDropped: number;
}

interface PacketEvent {
  direction: "outbound" | "inbound";
  dropped: boolean;
  messageType: string;
  delayMs: number;
}

interface SimulatedTransportOptions {
  url: string;
  seed: number;
  conditions: NetworkConditions;
  onOpen: () => void;
  onClose: () => void;
  onError: () => void;
  onMessage: (message: ServerMessage) => void;
  onPacket: (event: PacketEvent) => void;
}

class SeededRandom {
  constructor(private state: number) {}

  next(): number {
    this.state = (Math.imul(this.state, 1_664_525) + 1_013_904_223) >>> 0;
    return this.state / 0x1_0000_0000;
  }
}

export class SimulatedTransport {
  private socket: WebSocket | null = null;
  private conditions: NetworkConditions;
  private readonly random: SeededRandom;
  private readonly pendingTimers = new Set<number>();
  private stats: TransportStats = {
    packetsSent: 0,
    packetsReceived: 0,
    packetsDropped: 0,
  };

  constructor(private readonly options: SimulatedTransportOptions) {
    this.conditions = options.conditions;
    this.random = new SeededRandom(options.seed || 1);
  }

  connect(): void {
    this.clearPendingDeliveries();
    this.socket = new WebSocket(this.options.url);
    this.socket.addEventListener("open", this.options.onOpen);
    this.socket.addEventListener("close", this.options.onClose);
    this.socket.addEventListener("error", this.options.onError);
    this.socket.addEventListener("message", this.handleIncoming);
  }

  disconnect(): void {
    this.clearPendingDeliveries();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.removeEventListener("open", this.options.onOpen);
      socket.removeEventListener("close", this.options.onClose);
      socket.removeEventListener("error", this.options.onError);
      socket.removeEventListener("message", this.handleIncoming);
      if (socket.readyState < WebSocket.CLOSING) {
        socket.close(1000, "Client closed");
      }
    }
  }

  updateConditions(conditions: NetworkConditions): void {
    this.conditions = conditions;
  }

  send(message: ClientMessage): void {
    this.stats.packetsSent += 1;
    const delayMs = this.calculateOneWayDelay();
    if (this.shouldDrop()) {
      this.stats.packetsDropped += 1;
      this.options.onPacket({
        direction: "outbound",
        dropped: true,
        messageType: message.type,
        delayMs,
      });
      return;
    }

    this.options.onPacket({
      direction: "outbound",
      dropped: false,
      messageType: message.type,
      delayMs,
    });
    this.schedule(delayMs, () => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
      }
    });
  }

  getStats(): TransportStats {
    return { ...this.stats };
  }

  private readonly handleIncoming = (event: MessageEvent<unknown>): void => {
    if (typeof event.data !== "string") {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return;
    }
    if (!isServerMessage(parsed)) {
      return;
    }

    const delayMs = this.calculateOneWayDelay();
    if (this.shouldDrop()) {
      this.stats.packetsDropped += 1;
      this.options.onPacket({
        direction: "inbound",
        dropped: true,
        messageType: parsed.type,
        delayMs,
      });
      return;
    }

    this.options.onPacket({
      direction: "inbound",
      dropped: false,
      messageType: parsed.type,
      delayMs,
    });
    this.schedule(delayMs, () => {
      this.stats.packetsReceived += 1;
      this.options.onMessage(parsed);
    });
  };

  private calculateOneWayDelay(): number {
    const baseDelay = this.conditions.rttMs / 2;
    const jitter = (this.random.next() * 2 - 1) * (this.conditions.jitterMs / 2);
    return Math.max(0, baseDelay + jitter);
  }

  private shouldDrop(): boolean {
    return this.random.next() * 100 < this.conditions.packetLossPercent;
  }

  private schedule(delayMs: number, delivery: () => void): void {
    const timer = window.setTimeout(() => {
      this.pendingTimers.delete(timer);
      delivery();
    }, delayMs);
    this.pendingTimers.add(timer);
  }

  private clearPendingDeliveries(): void {
    for (const timer of this.pendingTimers) {
      window.clearTimeout(timer);
    }
    this.pendingTimers.clear();
  }
}

export function hashSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
