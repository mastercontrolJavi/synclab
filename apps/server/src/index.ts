import { createServer } from "node:http";

import { AuthoritativeServer, MAX_MESSAGE_BYTES } from "@synclab/shared";
import { WebSocketServer } from "ws";

import { rawDataToText } from "./validation.js";

const parsedPort = Number.parseInt(process.env.PORT ?? "8080", 10);
const port = Number.isFinite(parsedPort) ? parsedPort : 8080;
const server = new AuthoritativeServer();

const httpServer = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      // Lets the web app detect a warm server from the landing page.
      "access-control-allow-origin": "*",
    });
    response.end(
      JSON.stringify({
        ok: true,
        connections: server.connectionCount,
        rooms: server.rooms.roomCount,
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

webSocketServer.on("connection", (socket) => {
  const connection = server.connect(socket);
  socket.on("message", (rawData) => connection.receive(rawDataToText(rawData)));
  socket.on("close", () => connection.disconnect());
  socket.on("error", () => connection.disconnect());
});

httpServer.listen(port, "0.0.0.0", () => {
  server.start();
  console.log(`SyncLab realtime server listening on 0.0.0.0:${port}`);
});

function shutdown(): void {
  server.stop();
  server.closeAll(webSocketServer.clients);
  webSocketServer.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
