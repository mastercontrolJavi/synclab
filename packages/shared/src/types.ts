export interface Vector2 {
  x: number;
  y: number;
}

export interface MovementInput {
  sequence: number;
  moveX: number;
  moveY: number;
  clientTime: number;
}

export interface PlayerSnapshot extends Vector2 {
  id: string;
  isIt: boolean;
  isScripted: boolean;
  tagCount: number;
}

export interface SnapshotMetrics {
  actualTickRate: number;
  actualSnapshotRate: number;
  connectedPlayers: number;
}

export interface JoinRoomMessage {
  type: "join_room";
  roomId: string;
}

export interface PlayerInputMessage extends MovementInput {
  type: "player_input";
}

export interface PingMessage {
  type: "ping";
  nonce: number;
  clientTime: number;
}

export type ClientMessage = JoinRoomMessage | PlayerInputMessage | PingMessage;

export interface WelcomeMessage {
  type: "welcome";
  playerId: string;
  roomId: string;
  serverTime: number;
  tickRate: number;
  snapshotRate: number;
  world: {
    width: number;
    height: number;
    playerRadius: number;
  };
}

export interface SnapshotMessage {
  type: "snapshot";
  serverTick: number;
  serverTime: number;
  players: Record<string, PlayerSnapshot>;
  acknowledgements: Record<string, number>;
  metrics: SnapshotMetrics;
}

export interface PongMessage {
  type: "pong";
  nonce: number;
  clientTime: number;
  serverTime: number;
}

export interface RoomFullMessage {
  type: "room_full";
  roomId: string;
}

export interface PlayerJoinedMessage {
  type: "player_joined";
  playerId: string;
  connectedPlayers: number;
}

export interface PlayerLeftMessage {
  type: "player_left";
  playerId: string;
  connectedPlayers: number;
}

export interface ErrorMessage {
  type: "error";
  code: "invalid_message" | "join_required" | "rate_limited";
  message: string;
}

export type ServerMessage =
  | WelcomeMessage
  | SnapshotMessage
  | PongMessage
  | RoomFullMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | ErrorMessage;
