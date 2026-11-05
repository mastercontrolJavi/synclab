import {
  AuthoritativeServer,
  SOCKET_OPEN,
  type ServerConnection,
  type ServerSocket,
} from "@synclab/shared";

/**
 * The minimal WebSocket surface SimulatedTransport uses. Satisfied by the
 * browser WebSocket and by LoopbackSocket below.
 */
// The browser hands real events; the loopback hands plain objects with the same fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketListener = (event: any) => void;

export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open" | "close" | "error" | "message", listener: SocketListener): void;
  removeEventListener(type: "open" | "close" | "error" | "message", listener: SocketListener): void;
}

export type SocketFactory = (url: string) => SocketLike;

const CONNECTING = 0;
const CLOSED = 3;

type Listener = SocketListener;

/**
 * An in-tab "socket" wired straight into the shared AuthoritativeServer.
 * Frames are delivered on a macrotask so ordering matches a real socket.
 * Network latency, jitter and loss are still applied by SimulatedTransport,
 * exactly as they are for the live server.
 */
class LoopbackSocket implements SocketLike {
  readyState = CONNECTING;
  private readonly listeners = new Map<string, Set<Listener>>();
  private connection: ServerConnection | null = null;

  constructor(private readonly server: LocalServerHost) {
    window.setTimeout(() => {
      if (this.readyState !== CONNECTING) {
        return;
      }
      this.readyState = SOCKET_OPEN;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const owner = this;
      const serverSide: ServerSocket = {
        get readyState() {
          return owner.readyState;
        },
        bufferedAmount: 0,
        send: (data) => {
          window.setTimeout(() => {
            if (this.readyState === SOCKET_OPEN) {
              this.emit("message", { data });
            }
          }, 0);
        },
        close: () => this.close(),
      };
      this.connection = this.server.acquire(serverSide);
      this.emit("open", {});
    }, 30);
  }

  send(data: string): void {
    if (this.readyState !== SOCKET_OPEN) {
      return;
    }
    window.setTimeout(() => this.connection?.receive(data), 0);
  }

  close(): void {
    if (this.readyState === CLOSED) {
      return;
    }
    this.readyState = CLOSED;
    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
      this.server.release();
    }
    this.emit("close", {});
  }

  addEventListener(type: string, listener: Listener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

/** One shared in-tab server, started on first connection, stopped on last. */
class LocalServerHost {
  private server: AuthoritativeServer | null = null;
  private refs = 0;

  acquire(socket: ServerSocket): ServerConnection {
    if (!this.server) {
      this.server = new AuthoritativeServer();
      this.server.start();
    }
    this.refs += 1;
    return this.server.connect(socket);
  }

  release(): void {
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs === 0 && this.server) {
      this.server.stop();
      this.server = null;
    }
  }
}

const host = new LocalServerHost();

export const createLoopbackSocket: SocketFactory = () => new LoopbackSocket(host);

export const createBrowserSocket: SocketFactory = (url) =>
  new WebSocket(url) as unknown as SocketLike;
