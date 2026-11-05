import { MAX_MESSAGES_PER_SECOND } from "../constants.js";
import { isClientMessage } from "../protocol.js";
import type { ClientMessage, ErrorMessage } from "../types.js";
import { FixedTimestepLoop } from "./fixed-timestep-loop.js";
import { RoomManager, SOCKET_OPEN, type ClientContext, type RoomSocket } from "./room-manager.js";

export interface ServerSocket extends RoomSocket {
  close(code?: number, reason?: string): void;
}

export interface ServerConnection {
  /** Feed one raw text frame from the transport. `null` means the frame could not be decoded. */
  receive(text: string | null): void;
  /** The transport closed or errored. */
  disconnect(): void;
}

export function decodeClientText(text: string | null): ClientMessage | null {
  if (text === null) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(text);
    return isClientMessage(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * The authoritative SyncLab server, independent of the transport.
 * The Node process runs it behind `ws`; the web app can run the exact same
 * code in the tab behind a loopback socket when the live server is asleep.
 */
export class AuthoritativeServer {
  readonly rooms = new RoomManager();
  private readonly connections = new Set<ClientContext>();
  private readonly loop = new FixedTimestepLoop(
    () => this.rooms.step(),
    (metrics) => this.rooms.broadcastSnapshots(metrics),
  );

  get connectionCount(): number {
    return this.connections.size;
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  connect(socket: ServerSocket): ServerConnection {
    const context: ClientContext = { socket, playerId: null, roomId: null };
    this.connections.add(context);
    let windowStartedAt = performance.now();
    let messagesInWindow = 0;

    return {
      receive: (text) => {
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

        const message = decodeClientText(text);
        if (!message) {
          sendError(socket, {
            type: "error",
            code: "invalid_message",
            message: "Malformed or unsupported message.",
          });
          return;
        }
        this.handleMessage(context, message);
      },
      disconnect: () => {
        this.rooms.remove(context);
        this.connections.delete(context);
      },
    };
  }

  /** Close every connection, e.g. on process shutdown. */
  closeAll(sockets: Iterable<ServerSocket>): void {
    for (const socket of sockets) {
      socket.close(1001, "Server shutting down");
    }
  }

  private handleMessage(context: ClientContext, message: ClientMessage): void {
    switch (message.type) {
      case "join_room":
        this.rooms.join(context, message.roomId);
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
        this.rooms.enqueueInput(context, message);
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
}

function sendError(socket: RoomSocket, error: ErrorMessage): void {
  if (socket.readyState === SOCKET_OPEN) {
    socket.send(JSON.stringify(error));
  }
}
