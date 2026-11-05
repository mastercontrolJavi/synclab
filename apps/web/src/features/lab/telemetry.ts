import type { ClientMetrics, LabSettings } from "./types";

export const HISTORY_LENGTH = 60; // 15 s at the 4 Hz publish rate

export type MetricKey =
  | "rtt"
  | "jitter"
  | "loss"
  | "tick"
  | "pending"
  | "corrections";

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: string;
  /** One plain-English sentence for the tooltip. */
  explain: string;
  color: string;
  minRange: number;
  read: (metrics: ClientMetrics) => number;
  format: (value: number) => string;
  /** What the viewer configured, shown next to what was measured. */
  configured?: (settings: LabSettings) => string;
}

const whole = (value: number) => Math.round(value).toString();
const oneDecimal = (value: number) => value.toFixed(1);

export const METRICS: readonly MetricDefinition[] = [
  {
    key: "rtt",
    label: "Round trip",
    unit: "ms",
    explain: "How long a message takes to reach the server and come back, measured with pings.",
    color: "var(--text-muted)",
    minRange: 40,
    read: (metrics) => metrics.rttMs,
    format: whole,
    configured: (settings) => `set ${settings.rttMs}`,
  },
  {
    key: "jitter",
    label: "Jitter",
    unit: "ms",
    explain: "How unevenly server snapshots arrive, measured per RFC 3550, so it reads lower than the slider. Interpolation hides it for other players.",
    color: "var(--text-muted)",
    minRange: 10,
    read: (metrics) => metrics.jitterMs,
    format: oneDecimal,
    configured: (settings) => `set ${settings.jitterMs}`,
  },
  {
    key: "loss",
    label: "Packet loss",
    unit: "%",
    explain: "Share of messages lost in transit over the last five seconds, in both directions.",
    color: "var(--c-dropped)",
    minRange: 5,
    read: (metrics) => metrics.lossPercent,
    format: oneDecimal,
    configured: (settings) => `set ${settings.packetLossPercent}`,
  },
  {
    key: "tick",
    label: "Tick rate",
    unit: "Hz",
    explain: "How many times per second the server advances the authoritative simulation. Target is 30.",
    color: "var(--c-server)",
    minRange: 10,
    read: (metrics) => metrics.serverTickRate,
    format: oneDecimal,
    configured: () => "target 30",
  },
  {
    key: "pending",
    label: "Pending inputs",
    unit: "",
    explain: "Inputs you sent that the server has not confirmed yet. Prediction replays these after every snapshot.",
    color: "var(--c-predicted)",
    minRange: 4,
    read: (metrics) => metrics.pendingInputs,
    format: whole,
  },
  {
    key: "corrections",
    label: "Corrections",
    unit: "/s",
    explain: "How often the server disagreed with your prediction and the client had to rewind and replay.",
    color: "var(--c-rollback)",
    minRange: 1,
    read: (metrics) => metrics.correctionsPerSecond,
    format: oneDecimal,
  },
];

export type MetricHistory = Record<MetricKey, number[]>;

export function emptyHistory(): MetricHistory {
  return { rtt: [], jitter: [], loss: [], tick: [], pending: [], corrections: [] };
}

export function appendHistory(history: MetricHistory, metrics: ClientMetrics): MetricHistory {
  const next = { ...history };
  for (const metric of METRICS) {
    const series = [...history[metric.key], metric.read(metrics)];
    if (series.length > HISTORY_LENGTH) {
      series.splice(0, series.length - HISTORY_LENGTH);
    }
    next[metric.key] = series;
  }
  return next;
}
