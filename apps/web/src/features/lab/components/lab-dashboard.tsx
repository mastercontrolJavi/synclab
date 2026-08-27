"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_NETCODE_SETTINGS,
  DEFAULT_NETWORK_CONDITIONS,
} from "@synclab/shared";
import { AlertTriangle } from "lucide-react";

import { GameClient } from "../game-client";
import type {
  ClientMetrics,
  ConnectionState,
  LabSettings,
  NetworkEvent,
} from "../types";
import { Arena } from "./arena";
import { ControlPanel } from "./control-panel";
import { DiagnosticsPanel } from "./diagnostics-panel";
import { NetworkFlow } from "./network-flow";
import { StatusHeader } from "./status-header";

const INITIAL_METRICS: ClientMetrics = {
  rttMs: 0,
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

function defaultSettings(): LabSettings {
  return {
    ...DEFAULT_NETWORK_CONDITIONS,
    ...DEFAULT_NETCODE_SETTINGS,
  };
}

interface LabDashboardProps {
  roomId: string;
  debug: boolean;
}

export function LabDashboard({ roomId, debug }: LabDashboardProps) {
  const [status, setStatus] = useState<ConnectionState>("connecting");
  const [settings, setSettings] = useState<LabSettings>(defaultSettings);
  const [metrics, setMetrics] = useState<ClientMetrics>(INITIAL_METRICS);
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [copied, setCopied] = useState(false);
  const [client] = useState(
    () =>
      new GameClient({
        roomId,
        serverUrl: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080",
        initialSettings: defaultSettings(),
        observer: {
          onStatus: setStatus,
          onMetrics: setMetrics,
          onEvents: setEvents,
        },
      }),
  );

  useEffect(() => {
    client.start();
    return () => client.destroy();
  }, [client]);

  useEffect(() => {
    client?.updateSettings(settings);
  }, [client, settings]);

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <StatusHeader
        roomId={roomId}
        status={status}
        copied={copied}
        onCopy={copyRoomLink}
        onRetry={() => client?.retry()}
      />

      {status === "room_full" || status === "server_unavailable" ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 border-b border-amber-300/15 bg-amber-300/[0.04] px-4 py-2 text-[11px] text-amber-100/80"
        >
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          {status === "room_full"
            ? "This room already has two active players. Change the room query or use a fresh link."
            : "The realtime server could not be reached. Check NEXT_PUBLIC_WS_URL, then retry."}
        </div>
      ) : null}

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:h-[calc(100dvh-3.5rem)] lg:flex-none lg:grid-cols-[minmax(0,1fr)_350px] lg:grid-rows-[minmax(430px,1fr)_280px] lg:overflow-hidden">
        <Arena
          client={client}
          connectedPlayers={metrics.connectedPlayers}
          connectionState={status}
          debug={debug}
        />
        <ControlPanel
          settings={settings}
          onChange={setSettings}
          onReset={() => setSettings(defaultSettings())}
        />
        <NetworkFlow events={events} />
        <DiagnosticsPanel metrics={metrics} settings={settings} />
      </main>
    </div>
  );
}
