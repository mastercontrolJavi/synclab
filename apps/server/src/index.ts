import { createServer } from "node:http";

import {
  MAX_MESSAGE_BYTES,
  MAX_MESSAGES_PER_SECOND,
  type ClientMessage,
  type ErrorMessage,
} from "@synclab/shared";
import WebSocket, { WebSocketServer } from "ws";

import { FixedTimestepLoop } from "./fixed-timestep-loop.js";
import { RoomManager, type ClientContext } from "./room-manager.js";
import { decodeClientMessage } from "./validation.js";

const parsedPort = Number.parseInt(process.env.PORT ?? "8080", 10);
const port = Number.isFinite(parsedPort) ? parsedPort : 8080;
const roomManager = new RoomManager();
const clients = new Map<WebSocket, ClientContext>();

const httpServer = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        ok: true,
        connections: clients.size,
        rooms: roomManager.roomCount,
      }),
    );
    return;
  }

  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: false }));
});

const webSocketServer = new WebSocketServer({
  server: httpServer,
  maxPayload: MAX_MESSAGE_BYTES,
  perMessageDeflate: false,
});

function sendError(socket: WebSocket, error: ErrorMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(error));
  }
}

function handleMessage(context: ClientContext, message: ClientMessage): void {
  switch (message.type) {
    case "join_room":
      roomManager.join(context, message.roomId);
      break;
    case "player_input":
      if (!context.playerId) {
        sendError(context.socket, {
          type: "error",
          code: "join_required",
          message: "Join a room before sending input.",
        });
        return;
      }
      roomManager.enqueueInput(context, message);
      break;
    case "ping":
      context.socket.send(
        JSON.stringify({
          type: "pong",
          nonce: message.nonce,
          clientTime: message.clientTime,
          serverTime: Date.now(),
        }),
      );
      break;
  }
}

webSocketServer.on("connection", (socket) => {
  const context: ClientContext = { socket, playerId: null, roomId: null };
  clients.set(socket, context);
  let windowStartedAt = performance.now();
  let messagesInWindow = 0;

  socket.on("message", (rawData) => {
    const now = performance.now();
    if (now - windowStartedAt >= 1_000) {
      windowStartedAt = now;
      messagesInWindow = 0;
    }
    messagesInWindow += 1;
    if (messagesInWindow > MAX_MESSAGES_PER_SECOND) {
      sendError(socket, {
        type: "error",
        code: "rate_limited",
        message: "Message rate limit exceeded.",
      });
      socket.close(1008, "Rate limit exceeded");
      return;
    }

    const message = decodeClientMessage(rawData);
    if (!message) {
      sendError(socket, {
        type: "error",
        code: "invalid_message",
        message: "Malformed or unsupported message.",
      });
      return;
    }
    handleMessage(context, message);
  });

  socket.on("close", () => {
    roomManager.remove(context);
    clients.delete(socket);
  });

  socket.on("error", () => {
    roomManager.remove(context);
    clients.delete(socket);
  });
});

const simulationLoop = new FixedTimestepLoop(
  () => roomManager.step(),
  (metrics) => roomManager.broadcastSnapshots(metrics),
);

httpServer.listen(port, "0.0.0.0", () => {
  simulationLoop.start();
  console.log(`SyncLab realtime server listening on 0.0.0.0:${port}`);
});

function shutdown(): void {
  simulationLoop.stop();
  for (const socket of clients.keys()) {
    socket.close(1001, "Server shutting down");
  }
  webSocketServer.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
