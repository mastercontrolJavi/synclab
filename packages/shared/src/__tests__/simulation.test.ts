import { describe, expect, it } from "vitest";

import {
  FIXED_DT,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  applyMovement,
  normalizeDirection,
} from "../index.js";

describe("shared movement simulation", () => {
  it("moves at the configured cardinal speed", () => {
    const start = { x: 300, y: 300 };
    const result = applyMovement(start, { moveX: 1, moveY: 0 }, FIXED_DT);

    expect(result.x).toBeCloseTo(start.x + PLAYER_SPEED * FIXED_DT, 6);
    expect(result.y).toBe(start.y);
  });

  it("normalizes diagonal input", () => {
    const direction = normalizeDirection(1, 1);
    expect(Math.hypot(direction.x, direction.y)).toBeCloseTo(1, 8);

    const start = { x: 300, y: 300 };
    const result = applyMovement(start, { moveX: 1, moveY: 1 }, 1);
    expect(Math.hypot(result.x - start.x, result.y - start.y)).toBeCloseTo(
      PLAYER_SPEED,
      6,
    );
  });

  it("uses the supplied fixed delta", () => {
    const start = { x: 300, y: 300 };
    const first = applyMovement(start, { moveX: 0, moveY: -1 }, FIXED_DT);
    const second = applyMovement(first, { moveX: 0, moveY: -1 }, FIXED_DT);

    expect(second.y).toBeCloseTo(start.y - PLAYER_SPEED * FIXED_DT * 2, 6);
  });

  it("clamps players inside every arena boundary", () => {
    expect(
      applyMovement({ x: PLAYER_RADIUS, y: PLAYER_RADIUS }, { moveX: -1, moveY: -1 }, 2),
    ).toEqual({ x: PLAYER_RADIUS, y: PLAYER_RADIUS });

    expect(
      applyMovement(
        { x: WORLD_WIDTH - PLAYER_RADIUS, y: WORLD_HEIGHT - PLAYER_RADIUS },
        { moveX: 1, moveY: 1 },
        2,
      ),
    ).toEqual({
      x: WORLD_WIDTH - PLAYER_RADIUS,
      y: WORLD_HEIGHT - PLAYER_RADIUS,
    });
  });
});
