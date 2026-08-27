import {
  FIXED_DT,
  PLAYER_SPEED,
  type ServerMessage,
  type SnapshotMessage,
} from "@synclab/shared";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";

import { RoomManager, type ClientContext } from "../room-manager.js";

class FakeSocket {
  readonly readyState = WebSocket.OPEN;
  readonly bufferedAmount = 0;
  readonly messages: ServerMessage[] = [];

  send(payload: string): void {
    this.messages.push(JSON.parse(payload) as ServerMessage);
  }
}

function createContext(): { context: ClientContext; socket: FakeSocket } {
  const socket = new FakeSocket();
  return {
    context: {
      socket: socket as unknown as WebSocket,
      playerId: null,
      roomId: null,
    },
    socket,
  };
}

function latestSnapshot(socket: FakeSocket): SnapshotMessage {
  const snapshot = socket.messages.findLast(
    (message): message is SnapshotMessage => message.type === "snapshot",
  );
  if (!snapshot) {
    throw new Error("Expected a snapshot message");
  }
  return snapshot;
}

describe("solo scripted player", () => {
  it("moves in the authoritative loop and follows human room occupancy", () => {
    const manager = new RoomManager();
    const first = createContext();
    const second = createContext();

    manager.join(first.context, "solo-room");
    manager.broadcastSnapshots({ actualTickRate: 30, actualSnapshotRate: 20 });

    const initialSnapshot = latestSnapshot(first.socket);
    const initialPlayers = Object.values(initialSnapshot.players);
    const initialScripted = initialPlayers.find((player) => player.isScripted);
    expect(initialPlayers).toHaveLength(2);
    expect(initialPlayers.filter((player) => !player.isScripted)).toHaveLength(1);
    expect(initialSnapshot.metrics.connectedPlayers).toBe(1);
    expect(initialScripted).toBeDefined();

    for (let tick = 0; tick < 5; tick += 1) {
      manager.step();
    }
    manager.broadcastSnapshots({ actualTickRate: 30, actualSnapshotRate: 20 });

    const movedScripted = Object.values(latestSnapshot(first.socket).players).find(
      (player) => player.isScripted,
    );
    expect(movedScripted).toBeDefined();
    expect(
      Math.hypot(
        (movedScripted?.x ?? 0) - (initialScripted?.x ?? 0),
        (movedScripted?.y ?? 0) - (initialScripted?.y ?? 0),
      ),
    ).toBeCloseTo(PLAYER_SPEED * FIXED_DT * 5, 5);

    manager.join(second.context, "solo-room");
    manager.broadcastSnapshots({ actualTickRate: 30, actualSnapshotRate: 20 });

    const pairedSnapshot = latestSnapshot(first.socket);
    expect(Object.values(pairedSnapshot.players)).toHaveLength(2);
    expect(Object.values(pairedSnapshot.players).every((player) => !player.isScripted)).toBe(
      true,
    );
    expect(pairedSnapshot.metrics.connectedPlayers).toBe(2);

    manager.remove(second.context);
    manager.broadcastSnapshots({ actualTickRate: 30, actualSnapshotRate: 20 });

    const returnedSoloSnapshot = latestSnapshot(first.socket);
    expect(Object.values(returnedSoloSnapshot.players)).toHaveLength(2);
    expect(
      Object.values(returnedSoloSnapshot.players).filter((player) => player.isScripted),
    ).toHaveLength(1);
    expect(returnedSoloSnapshot.metrics.connectedPlayers).toBe(1);

    manager.remove(first.context);
    expect(manager.roomCount).toBe(0);
  });
});
