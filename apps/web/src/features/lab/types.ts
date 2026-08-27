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

export interface ClientMetrics {
  rttMs: number;
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
