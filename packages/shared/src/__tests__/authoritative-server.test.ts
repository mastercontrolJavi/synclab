import { describe, expect, it } from "vitest";

import { MAX_MESSAGES_PER_SECOND } from "../constants.js";
import { AuthoritativeServer, type ServerSocket } from "../server/authoritative-server.js";
import type { ServerMessage } from "../types.js";

class FakeSocket implements ServerSocket {
  readyState = 1;
  readonly bufferedAmount = 0;
  readonly messages: ServerMessage[] = [];
  closedWith: number | null = null;

  send(payload: string): void {
    this.messages.push(JSON.parse(payload) as ServerMessage);
  }

  close(code?: number): void {
    this.closedWith = code ?? 1000;
    this.readyState = 3;
  }
}

describe("AuthoritativeServer dispatch", () => {
  it("welcomes a join and answers pings", () => {
    const server = new AuthoritativeServer();
    const socket = new FakeSocket();
    const connection = server.connect(socket);

    connection.receive(JSON.stringify({ type: "join_room", roomId: "abc123" }));
    connection.receive(JSON.stringify({ type: "ping", nonce: 7, clientTime: 100 }));

    expect(socket.messages[0]).toMatchObject({ type: "welcome", roomId: "abc123" });
    expect(socket.messages.find((message) => message.type === "pong")).toMatchObject({ nonce: 7, clientTime: 100 });
    expect(server.connectionCount).toBe(1);
    expect(server.rooms.roomCount).toBe(1);

    connection.disconnect();
    expect(server.connectionCount).toBe(0);
    expect(server.rooms.roomCount).toBe(0);
  });

  it("rejects malformed frames and input before joining", () => {
    const server = new AuthoritativeServer();
    const socket = new FakeSocket();
    const connection = server.connect(socket);

    connection.receive("{not json");
    connection.receive(null);
    connection.receive(JSON.stringify({ type: "player_input", sequence: 1, moveX: 1, moveY: 0, clientTime: 1 }));

    expect(socket.messages.map((message) => message.type === "error" && message.code)).toEqual([
      "invalid_message",
      "invalid_message",
      "join_required",
    ]);
  });

  it("closes a connection that exceeds the message rate", () => {
    const server = new AuthoritativeServer();
    const socket = new FakeSocket();
    const connection = server.connect(socket);
    const ping = JSON.stringify({ type: "ping", nonce: 1, clientTime: 1 });

    for (let index = 0; index <= MAX_MESSAGES_PER_SECOND; index += 1) {
      connection.receive(ping);
    }

    expect(socket.closedWith).toBe(1008);
  });
});
