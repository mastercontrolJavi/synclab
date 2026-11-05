import type { LabSettings, NetworkConditions } from "./types";

export type NetworkPresetId = "lan" | "wifi" | "mobile" | "chaos";

export interface NetworkPreset extends NetworkConditions {
  id: NetworkPresetId;
  label: string;
  /** One line for the tooltip. */
  blurb: string;
  shortcut: string;
}

export const NETWORK_PRESETS: readonly NetworkPreset[] = [
  {
    id: "lan",
    label: "Perfect LAN",
    blurb: "10 ms, steady, no loss. Every technique looks the same here.",
    shortcut: "1",
    rttMs: 10,
    jitterMs: 0,
    packetLossPercent: 0,
  },
  {
    id: "wifi",
    label: "Bad Wi-Fi",
    blurb: "150 ms with some jitter and 3% loss. The naive client starts to feel sticky.",
    shortcut: "2",
    rttMs: 150,
    jitterMs: 30,
    packetLossPercent: 3,
  },
  {
    id: "mobile",
    label: "Mobile 3G",
    blurb: "300 ms, very uneven, 6% loss. Prediction is the difference between playable and not.",
    shortcut: "3",
    rttMs: 300,
    jitterMs: 80,
    packetLossPercent: 6,
  },
  {
    id: "chaos",
    label: "Chaos",
    blurb: "400 ms, 100 ms jitter, 15% loss. Watch reconciliation work overtime.",
    shortcut: "4",
    rttMs: 400,
    jitterMs: 100,
    packetLossPercent: 15,
  },
];

export const DEFAULT_PRESET: NetworkPreset = NETWORK_PRESETS[1] as NetworkPreset;

export const DEFAULT_SETTINGS: LabSettings = {
  rttMs: DEFAULT_PRESET.rttMs,
  jitterMs: DEFAULT_PRESET.jitterMs,
  packetLossPercent: DEFAULT_PRESET.packetLossPercent,
  prediction: true,
  reconciliation: true,
  interpolation: true,
};

export function getActivePreset(conditions: NetworkConditions): NetworkPreset | null {
  return (
    NETWORK_PRESETS.find(
      (preset) =>
        preset.rttMs === conditions.rttMs &&
        preset.jitterMs === conditions.jitterMs &&
        preset.packetLossPercent === conditions.packetLossPercent,
    ) ?? null
  );
}

export const SLIDER_LIMITS = {
  rttMs: { min: 0, max: 400, step: 10 },
  jitterMs: { min: 0, max: 100, step: 5 },
  packetLossPercent: { min: 0, max: 20, step: 1 },
} as const;
