import {
  PLAYER_RADIUS,
  PLAYER_SPEED,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants.js";
import type { MovementInput, Vector2 } from "./types.js";

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeDirection(moveX: number, moveY: number): Vector2 {
  const x = clamp(Number.isFinite(moveX) ? moveX : 0, -1, 1);
  const y = clamp(Number.isFinite(moveY) ? moveY : 0, -1, 1);
  const magnitude = Math.hypot(x, y);

  if (magnitude <= 1) {
    return { x, y };
  }

  return { x: x / magnitude, y: y / magnitude };
}

export function applyMovement(
  position: Vector2,
  input: Pick<MovementInput, "moveX" | "moveY">,
  deltaSeconds: number,
): Vector2 {
  const safeDelta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  const direction = normalizeDirection(input.moveX, input.moveY);

  return {
    x: clamp(
      position.x + direction.x * PLAYER_SPEED * safeDelta,
      PLAYER_RADIUS,
      WORLD_WIDTH - PLAYER_RADIUS,
    ),
    y: clamp(
      position.y + direction.y * PLAYER_SPEED * safeDelta,
      PLAYER_RADIUS,
      WORLD_HEIGHT - PLAYER_RADIUS,
    ),
  };
}

export function createSpawnPosition(slot: 0 | 1): Vector2 {
  return slot === 0
    ? { x: WORLD_WIDTH * 0.3, y: WORLD_HEIGHT * 0.5 }
    : { x: WORLD_WIDTH * 0.7, y: WORLD_HEIGHT * 0.5 };
}

export function distanceBetween(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function playersAreTouching(a: Vector2, b: Vector2): boolean {
  return distanceBetween(a, b) <= PLAYER_RADIUS * 2;
}
