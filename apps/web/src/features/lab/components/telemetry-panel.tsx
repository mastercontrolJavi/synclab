"use client";

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { HISTORY_LENGTH, METRICS, type MetricHistory } from "../telemetry";
import type { ClientMetrics, LabSettings } from "../types";
import { AnimatedNumber } from "./animated-number";
import { Sparkline } from "./sparkline";

interface TelemetryPanelProps {
  metrics: ClientMetrics;
  history: MetricHistory;
  settings: LabSettings;
  className?: string;
}

const formatAck = (value: number) => (value < 0 ? "none" : `#${Math.round(value)}`);
const formatPx = (value: number) => value.toFixed(1);

export function TelemetryPanel({ metrics, history, settings, className }: TelemetryPanelProps) {
  return (
    <section
      aria-label="Live telemetry"
      data-tour="telemetry"
      className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 xl:grid-cols-6", className)}
    >
      {METRICS.map((metric) => (
        <div key={metric.key} data-reveal className="flex min-w-0 flex-col gap-1.5 bg-surface-1 px-3.5 pt-3 pb-2.5">
          <div className="flex items-center justify-between gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="group flex min-w-0 items-center gap-1.5 rounded text-left text-[12px] text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: metric.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{metric.label}</span>
                  <Info className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{metric.explain}</TooltipContent>
            </Tooltip>
            {metric.configured ? (
              <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                {metric.configured(settings)}
              </span>
            ) : null}
          </div>
          <div className="flex items-baseline gap-1">
            <AnimatedNumber
              value={metric.read(metrics)}
              format={metric.format}
              className="font-mono text-[22px] leading-none font-medium tracking-tight text-ink tabular-nums"
            />
            <span className="font-mono text-[11px] text-ink-faint">{metric.unit}</span>
          </div>
          <Sparkline
            values={history[metric.key]}
            color={metric.color}
            minRange={metric.minRange}
            capacity={HISTORY_LENGTH}
            className="h-7 w-full"
          />
        </div>
      ))}
      <dl className="col-span-full flex flex-wrap items-center gap-x-5 gap-y-1 bg-surface-1 px-3.5 py-2 font-mono text-[11px] text-ink-faint">
        <Stat label="Snapshots" value={`${metrics.snapshotRate.toFixed(1)} Hz`} hint="Authoritative state updates per second from the server. Target is 20." />
        <Stat label="Last ack" value={formatAck(metrics.lastAcknowledgedInput)} hint="The newest input sequence number the server says it has applied." />
        <Stat label="Prediction gap" value={`${formatPx(metrics.predictionError)} px`} hint="Distance between where you were drawn and where the latest snapshot put you." />
        <Stat
          label="Packets"
          value={`↑${metrics.packetsSent} ↓${metrics.packetsReceived} ✕${metrics.packetsDropped}`}
          hint="Messages sent, received and dropped since this session connected."
        />
      </dl>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div tabIndex={0} className="flex items-center gap-1.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <dt>{label}</dt>
          <dd className="text-ink-muted">{value}</dd>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">{hint}</TooltipContent>
    </Tooltip>
  );
}
