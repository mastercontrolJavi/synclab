import {
  DEFAULT_NETCODE_SETTINGS,
  DEFAULT_NETWORK_CONDITIONS,
} from "@synclab/shared";

import type { LabSettings } from "./types";

export type GuidedPreset = "naive" | "modern" | "reset";

export const GUIDED_PRESETS: Record<GuidedPreset, LabSettings> = {
  naive: {
    rttMs: 200,
    jitterMs: 40,
    packetLossPercent: 2,
    prediction: false,
    reconciliation: false,
    interpolation: false,
  },
  modern: {
    rttMs: 200,
    jitterMs: 40,
    packetLossPercent: 2,
    prediction: true,
    reconciliation: true,
    interpolation: true,
  },
  reset: {
    ...DEFAULT_NETWORK_CONDITIONS,
    ...DEFAULT_NETCODE_SETTINGS,
  },
};

export const PRESET_CAPTIONS: Partial<Record<GuidedPreset, string>> = {
  naive:
    "Same 200ms connection. Watch your own movement lag behind your keypress.",
  modern:
    "Same 200ms connection. Prediction makes you instant. Reconciliation keeps the server authoritative.",
};

export function getActivePreset(settings: LabSettings): GuidedPreset | null {
  for (const preset of ["naive", "modern", "reset"] as const) {
    const values = GUIDED_PRESETS[preset];
    if (
      values.rttMs === settings.rttMs &&
      values.jitterMs === settings.jitterMs &&
      values.packetLossPercent === settings.packetLossPercent &&
      values.prediction === settings.prediction &&
      values.reconciliation === settings.reconciliation &&
      values.interpolation === settings.interpolation
    ) {
      return preset;
    }
  }
  return null;
}
