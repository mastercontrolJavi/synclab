import { describe, expect, it } from "vitest";

import { decodeClientMessage } from "../validation.js";

describe("server message validation", () => {
  it("accepts a finite, bounded movement input", () => {
    expect(
      decodeClientMessage(
        Buffer.from(
          JSON.stringify({
            type: "player_input",
            sequence: 42,
            moveX: 1,
            moveY: -1,
            clientTime: 100,
          }),
        ),
      ),
    ).toMatchObject({ type: "player_input", sequence: 42 });
  });

  it.each([
    "not json",
    JSON.stringify({ type: "player_input", sequence: 1, moveX: 2, moveY: 0, clientTime: 1 }),
    JSON.stringify({ type: "player_input", sequence: -1, moveX: 0, moveY: 0, clientTime: 1 }),
    JSON.stringify({ type: "player_input", sequence: 1, moveX: "1", moveY: 0, clientTime: 1 }),
    JSON.stringify({ type: "join_room", roomId: "../../unsafe" }),
  ])("rejects invalid payload %s", (payload) => {
    expect(decodeClientMessage(Buffer.from(payload))).toBeNull();
  });
});
