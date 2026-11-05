"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { GameClient } from "./game-client";
import { createLoopbackSocket } from "./local-server";
import { appendHistory, emptyHistory, type MetricHistory } from "./telemetry";
import type { ClientMetrics, ConnectionState, LabSettings, NetcodeSettings } from "./types";

export type ServerMode = "live" | "local";
export type ServerPreference = "auto" | ServerMode;

const DEFAULT_SERVER_URL = "wss://synclab-realtime-javiertpga.onrender.com";
/** How long the live server gets before the lab falls back to the in-tab server. */
const LIVE_CONNECT_TIMEOUT_MS = 4_500;
const WARMUP_INTERVAL_MS = 8_000;

export const NAIVE_NETCODE: NetcodeSettings = {
  prediction: false,
  reconciliation: false,
  interpolation: false,
};

export const INITIAL_METRICS: ClientMetrics = {
  rttMs: 0,
  jitterMs: 0,
  lossPercent: 0,
  correctionsPerSecond: 0,
  serverTickRate: 0,
  snapshotRate: 0,
  pendingInputs: 0,
  lastAcknowledgedInput: -1,
  predictionError: 0,
  reconciliationCount: 0,
  packetsSent: 0,
  packetsReceived: 0,
  packetsDropped: 0,
  connectedPlayers: 0,
  webSocketState: "connecting",
};

export function liveServerUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL ?? DEFAULT_SERVER_URL;
}

export function healthUrl(socketUrl: string): string {
  return `${socketUrl.replace(/^ws/, "http").replace(/\/$/, "")}/health`;
}

/** Room for the naive comparison client, kept within ROOM_ID_PATTERN (3–12 chars). */
export function naiveRoomId(roomId: string): string {
  return `${roomId.slice(0, 10)}-n`;
}

export interface LabSessionState {
  main: GameClient | null;
  naive: GameClient | null;
  status: ConnectionState;
  naiveStatus: ConnectionState;
  metrics: ClientMetrics;
  history: MetricHistory;
  serverMode: ServerMode;
  liveReady: boolean;
  /** performance.now() when the current connection attempt began. */
  connectingSince: number;
}

interface SessionConfig {
  roomId: string;
  split: boolean;
  serverPreference: ServerPreference;
}

const INITIAL_STATE: LabSessionState = {
  main: null,
  naive: null,
  status: "connecting",
  naiveStatus: "connecting",
  metrics: INITIAL_METRICS,
  history: emptyHistory(),
  serverMode: "live",
  liveReady: false,
  connectingSince: 0,
};

/**
 * Owns the lab's GameClients outside React. Clients are created and
 * destroyed only from effects, and React reads an immutable snapshot.
 */
class LabSessionStore {
  private state: LabSessionState = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();
  private config: SessionConfig | null = null;
  private settings: LabSettings | null = null;
  private fallbackTimer: number | null = null;
  private warmupTimer: number | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  getServerSnapshot = () => INITIAL_STATE;

  configure(config: SessionConfig, settings: LabSettings): void {
    this.settings = settings;
    const previous = this.config;
    this.config = config;
    const modeChanged = !previous || previous.serverPreference !== config.serverPreference;
    const serverMode = modeChanged
      ? config.serverPreference === "local"
        ? "local"
        : "live"
      : this.state.serverMode;
    if (modeChanged || previous.roomId !== config.roomId) {
      this.rebuild(serverMode, true, true);
    } else if (previous.split !== config.split) {
      this.rebuild(serverMode, false, true);
    }
  }

  setSettings(settings: LabSettings): void {
    this.settings = settings;
    this.state.main?.updateSettings(settings);
    this.state.naive?.updateSettings({ ...settings, ...NAIVE_NETCODE });
  }

  retry = (): void => {
    this.rebuild(this.state.serverMode, true, true);
  };

  switchToLive = (): void => {
    this.rebuild("live", true, true);
  };

  destroy(): void {
    this.clearTimers();
    this.state.main?.destroy();
    this.state.naive?.destroy();
    this.state = INITIAL_STATE;
    this.config = null;
  }

  private rebuild(serverMode: ServerMode, rebuildMain: boolean, rebuildNaive: boolean): void {
    const config = this.config;
    const settings = this.settings;
    if (!config || !settings) {
      return;
    }
    let { main, naive } = this.state;
    if (rebuildMain) {
      main?.destroy();
      main = this.createMain(config.roomId, serverMode, settings);
    }
    if (rebuildNaive) {
      naive?.destroy();
      naive = config.split ? this.createNaive(config.roomId, serverMode, settings) : null;
    }
    this.update({
      main,
      naive,
      serverMode,
      liveReady: false,
      ...(rebuildMain
        ? {
            status: "connecting" as const,
            metrics: INITIAL_METRICS,
            history: emptyHistory(),
            connectingSince: performance.now(),
          }
        : {}),
      ...(rebuildNaive ? { naiveStatus: "connecting" as const } : {}),
    });
    main?.start();
    if (rebuildNaive) {
      naive?.start();
    }
    if (rebuildMain) {
      this.scheduleFallback();
    }
    this.scheduleWarmup();
  }

  private createMain(roomId: string, serverMode: ServerMode, settings: LabSettings): GameClient {
    const client: GameClient = new GameClient({
      roomId,
      serverUrl: liveServerUrl(),
      initialSettings: settings,
      socketFactory: serverMode === "local" ? createLoopbackSocket : undefined,
      observer: {
        onStatus: (status) => {
          if (this.state.main !== client) {
            return;
          }
          this.update({ status });
          if (status === "reconnecting" || status === "server_unavailable") {
            this.fallBackToLocal();
          }
        },
        onMetrics: (metrics) => {
          if (this.state.main !== client) {
            return;
          }
          this.update({ metrics, history: appendHistory(this.state.history, metrics) });
        },
        onEvents: () => undefined,
      },
    });
    return client;
  }

  private createNaive(roomId: string, serverMode: ServerMode, settings: LabSettings): GameClient {
    const client: GameClient = new GameClient({
      roomId: naiveRoomId(roomId),
      serverUrl: liveServerUrl(),
      initialSettings: { ...settings, ...NAIVE_NETCODE },
      socketFactory: serverMode === "local" ? createLoopbackSocket : undefined,
      observer: {
        onStatus: (naiveStatus) => {
          if (this.state.naive === client) {
            this.update({ naiveStatus });
          }
        },
        onMetrics: () => undefined,
        onEvents: () => undefined,
      },
    });
    return client;
  }

  /** Give the live server a few seconds, then run the same server code in-tab. */
  private scheduleFallback(): void {
    if (this.fallbackTimer !== null) {
      window.clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.state.serverMode !== "live" || this.config?.serverPreference === "live") {
      return;
    }
    this.fallbackTimer = window.setTimeout(() => {
      this.fallbackTimer = null;
      if (this.state.main?.getStatus() !== "connected") {
        this.fallBackToLocal();
      }
    }, LIVE_CONNECT_TIMEOUT_MS);
  }

  private fallBackToLocal(): void {
    if (this.config?.serverPreference === "live" || this.state.serverMode === "local") {
      return;
    }
    // Defer: this can be called from inside a client's own callback.
    window.setTimeout(() => {
      if (this.config && this.state.serverMode === "live") {
        this.rebuild("local", true, true);
      }
    }, 0);
  }

  /** While running locally, keep waking the live server so the viewer can switch. */
  private scheduleWarmup(): void {
    if (this.warmupTimer !== null) {
      window.clearInterval(this.warmupTimer);
      this.warmupTimer = null;
    }
    if (this.state.serverMode !== "local" || this.config?.serverPreference === "local") {
      return;
    }
    const probe = async () => {
      try {
        await fetch(healthUrl(liveServerUrl()), { mode: "no-cors", cache: "no-store" });
        if (this.state.serverMode === "local") {
          this.update({ liveReady: true });
        }
      } catch {
        // Still asleep or unreachable; the next interval tries again.
      }
    };
    void probe();
    this.warmupTimer = window.setInterval(() => void probe(), WARMUP_INTERVAL_MS);
  }

  private clearTimers(): void {
    if (this.fallbackTimer !== null) {
      window.clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.warmupTimer !== null) {
      window.clearInterval(this.warmupTimer);
      this.warmupTimer = null;
    }
  }

  private update(partial: Partial<LabSessionState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export interface LabSession extends LabSessionState {
  retry: () => void;
  switchToLive: () => void;
}

interface UseLabSessionOptions extends SessionConfig {
  settings: LabSettings;
}

export function useLabSession({ roomId, split, serverPreference, settings }: UseLabSessionOptions): LabSession {
  const [store] = useState(() => new LabSessionStore());
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    store.configure({ roomId, split, serverPreference }, settings);
    // Settings changes are pushed separately below without rebuilding clients.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, roomId, split, serverPreference]);

  useEffect(() => {
    store.setSettings(settings);
  }, [store, settings]);

  useEffect(() => () => store.destroy(), [store]);

  return { ...state, retry: store.retry, switchToLive: store.switchToLive };
}
