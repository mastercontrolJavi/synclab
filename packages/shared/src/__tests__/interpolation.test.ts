import { describe, expect, it } from "vitest";

import { interpolatePlayer, type SnapshotMessage } from "../index.js";

function snapshot(serverTime: number, x: number): SnapshotMessage {
  return {
    type: "snapshot",
    serverTick: serverTime,
    serverTime,
    players: {
      remote: {
        id: "remote",
        x,
        y: 100,
        isIt: false,
        isScripted: false,
        tagCount: 0,
      },
    },
    acknowledgements: { remote: 0 },
    metrics: { actualTickRate: 30, actualSnapshotRate: 20, connectedPlayers: 2 },
  };
}

describe("snapshot interpolation", () => {
  it("interpolates between the snapshots around render time", () => {
    const result = interpolatePlayer(
      [snapshot(1_000, 100), snapshot(1_100, 200)],
      "remote",
      1_025,
    );

    expect(result?.x).toBeCloseTo(125, 6);
    expect(result?.y).toBe(100);
  });

  it("uses the nearest available edge snapshot", () => {
    expect(interpolatePlayer([snapshot(1_000, 100)], "remote", 900)?.x).toBe(100);
    expect(interpolatePlayer([snapshot(1_000, 100)], "remote", 1_500)?.x).toBe(100);
  });
});
