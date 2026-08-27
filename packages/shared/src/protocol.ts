import { ROOM_ID_PATTERN } from "./constants.js";
import type { ClientMessage, PlayerSnapshot, ServerMessage } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeSequence(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "join_room":
      return typeof value.roomId === "string" && ROOM_ID_PATTERN.test(value.roomId);
    case "player_input":
      return (
        isSafeSequence(value.sequence) &&
        isFiniteNumber(value.moveX) &&
        value.moveX >= -1 &&
        value.moveX <= 1 &&
        isFiniteNumber(value.moveY) &&
        value.moveY >= -1 &&
        value.moveY <= 1 &&
        isFiniteNumber(value.clientTime) &&
        value.clientTime >= 0
      );
    case "ping":
      return (
        isSafeSequence(value.nonce) &&
        isFiniteNumber(value.clientTime) &&
        value.clientTime >= 0
      );
    default:
      return false;
  }
}

function isPlayerSnapshot(value: unknown): value is PlayerSnapshot {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    typeof value.isIt === "boolean" &&
    typeof value.isScripted === "boolean" &&
    isSafeSequence(value.tagCount)
  );
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isFiniteNumber);
}

export function isServerMessage(value: unknown): value is ServerMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "welcome":
      return (
        typeof value.playerId === "string" &&
        typeof value.roomId === "string" &&
        isFiniteNumber(value.serverTime) &&
        isFiniteNumber(value.tickRate) &&
        isFiniteNumber(value.snapshotRate) &&
        isRecord(value.world) &&
        isFiniteNumber(value.world.width) &&
        isFiniteNumber(value.world.height) &&
        isFiniteNumber(value.world.playerRadius)
      );
    case "snapshot":
      return (
        isSafeSequence(value.serverTick) &&
        isFiniteNumber(value.serverTime) &&
        isRecord(value.players) &&
        Object.values(value.players).every(isPlayerSnapshot) &&
        isNumberRecord(value.acknowledgements) &&
        isRecord(value.metrics) &&
        isFiniteNumber(value.metrics.actualTickRate) &&
        isFiniteNumber(value.metrics.actualSnapshotRate) &&
        isSafeSequence(value.metrics.connectedPlayers)
      );
    case "pong":
      return (
        isSafeSequence(value.nonce) &&
        isFiniteNumber(value.clientTime) &&
        isFiniteNumber(value.serverTime)
      );
    case "room_full":
      return typeof value.roomId === "string";
    case "player_joined":
    case "player_left":
      return (
        typeof value.playerId === "string" &&
        isSafeSequence(value.connectedPlayers)
      );
    case "error":
      return (
        (value.code === "invalid_message" ||
          value.code === "join_required" ||
          value.code === "rate_limited") &&
        typeof value.message === "string"
      );
    default:
      return false;
  }
}
