"use client";

import { Activity } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ClientMetrics, LabSettings } from "../types";

interface DiagnosticsPanelProps {
  metrics: ClientMetrics;
  settings: LabSettings;
}

interface MetricRowProps {
  label: string;
  value: string;
  accent?: "positive" | "warning" | "neutral";
}

function MetricRow({ label, value, accent = "neutral" }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 py-1.5 last:border-b-0">
      <dt className="truncate text-[10px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "shrink-0 font-mono text-[10px] tabular-nums",
          accent === "neutral" && "text-foreground",
          accent === "positive" && "text-emerald-300",
          accent === "warning" && "text-amber-300",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function DiagnosticsPanel({ metrics, settings }: DiagnosticsPanelProps) {
  const socketLabel = metrics.webSocketState.replaceAll("_", " ").toUpperCase();

  return (
    <section className="min-h-0 bg-background">
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-xs font-medium">Diagnostics</h2>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
          <span className="size-1 rounded-full bg-emerald-400" />
          LIVE
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-5 p-4">
        <div>
          <MetricRow label="Round trip time" value={`${metrics.rttMs.toFixed(0)} ms`} />
          <MetricRow label="Server tick rate" value={`${metrics.serverTickRate.toFixed(1)} Hz`} />
          <MetricRow label="Snapshot rate" value={`${metrics.snapshotRate.toFixed(1)} Hz`} />
          <MetricRow label="Pending inputs" value={String(metrics.pendingInputs)} />
          <MetricRow
            label="Last acknowledged"
            value={metrics.lastAcknowledgedInput < 0 ? "N/A" : `#${metrics.lastAcknowledgedInput}`}
          />
          <MetricRow label="Prediction error" value={`${metrics.predictionError.toFixed(1)} px`} />
          <MetricRow label="Reconciliations" value={String(metrics.reconciliationCount)} />
        </div>
        <div>
          <MetricRow label="Packets sent" value={String(metrics.packetsSent)} />
          <MetricRow label="Packets received" value={String(metrics.packetsReceived)} />
          <MetricRow
            label="Packets dropped"
            value={String(metrics.packetsDropped)}
            accent={metrics.packetsDropped > 0 ? "warning" : "neutral"}
          />
          <MetricRow label="Configured loss" value={`${settings.packetLossPercent}%`} />
          <MetricRow label="Connected players" value={`${metrics.connectedPlayers} / 2`} />
          <MetricRow
            label="WebSocket state"
            value={socketLabel}
            accent={metrics.webSocketState === "connected" ? "positive" : "warning"}
          />
          <MetricRow
            label="Interpolation buffer"
            value={settings.interpolation ? "100 ms" : "OFF"}
          />
        </div>
      </dl>
    </section>
  );
}
