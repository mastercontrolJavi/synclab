import { describe, expect, it } from "vitest";

import { FIXED_DT, PLAYER_SPEED, reconcilePosition } from "../index.js";

describe("client reconciliation", () => {
  it("drops acknowledged inputs and replays only newer inputs", () => {
    const result = reconcilePosition(
      { x: 200, y: 200 },
      106,
      [
        { sequence: 105, moveX: 1, moveY: 0, clientTime: 1 },
        { sequence: 106, moveX: 1, moveY: 0, clientTime: 2 },
        { sequence: 107, moveX: 1, moveY: 0, clientTime: 3 },
        { sequence: 108, moveX: 0, moveY: 1, clientTime: 4 },
      ],
    );

    expect(result.pendingInputs.map((input) => input.sequence)).toEqual([107, 108]);
    expect(result.position.x).toBeCloseTo(200 + PLAYER_SPEED * FIXED_DT, 6);
    expect(result.position.y).toBeCloseTo(200 + PLAYER_SPEED * FIXED_DT, 6);
  });
});
