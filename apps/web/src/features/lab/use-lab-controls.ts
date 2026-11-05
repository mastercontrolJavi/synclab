"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DURATION, EASE, gsap, prefersReducedMotion } from "@/lib/motion";

import { DEFAULT_SETTINGS, SLIDER_LIMITS, type NetworkPreset } from "./presets";
import type { LabSettings, NetcodeSettings, NetworkConditions } from "./types";

export interface VizSettings {
  ghosts: boolean;
  trail: boolean;
  packets: boolean;
}

export type ViewMode = "split" | "single";

export const DEFAULT_VIZ: VizSettings = { ghosts: true, trail: true, packets: true };

function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export interface LabControls {
  settings: LabSettings;
  viz: VizSettings;
  view: ViewMode;
  setCondition: (key: keyof NetworkConditions, value: number) => void;
  applyPreset: (preset: NetworkPreset) => void;
  toggleNetcode: (key: keyof NetcodeSettings) => void;
  setNetcode: (key: keyof NetcodeSettings, value: boolean) => void;
  toggleViz: (key: keyof VizSettings) => void;
  setView: (view: ViewMode) => void;
}

export function useLabControls(): LabControls {
  const [settings, setSettings] = useState<LabSettings>(DEFAULT_SETTINGS);
  const [viz, setViz] = useState<VizSettings>(DEFAULT_VIZ);
  const [view, setView] = useState<ViewMode>("split");
  const settingsRef = useRef(settings);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  });

  useEffect(() => () => void tweenRef.current?.kill(), []);

  const setCondition = useCallback((key: keyof NetworkConditions, value: number) => {
    tweenRef.current?.kill();
    setSettings((previous) => ({ ...previous, [key]: value }));
  }, []);

  /** Glide the sliders (and the live network) to the preset over ~0.6 s. */
  const applyPreset = useCallback((preset: NetworkPreset) => {
    tweenRef.current?.kill();
    const target = {
      rttMs: preset.rttMs,
      jitterMs: preset.jitterMs,
      packetLossPercent: preset.packetLossPercent,
    };
    if (prefersReducedMotion()) {
      setSettings((previous) => ({ ...previous, ...target }));
      return;
    }
    const current = settingsRef.current;
    const proxy = {
      rttMs: current.rttMs,
      jitterMs: current.jitterMs,
      packetLossPercent: current.packetLossPercent,
    };
    tweenRef.current = gsap.to(proxy, {
      ...target,
      duration: DURATION.xslow * 0.75,
      ease: EASE.inOut,
      onUpdate: () => {
        setSettings((previous) => ({
          ...previous,
          rttMs: snap(proxy.rttMs, SLIDER_LIMITS.rttMs.step / 10),
          jitterMs: snap(proxy.jitterMs, 1),
          packetLossPercent: snap(proxy.packetLossPercent, 0.1),
        }));
      },
      onComplete: () => {
        setSettings((previous) => ({ ...previous, ...target }));
      },
    });
  }, []);

  const setNetcode = useCallback((key: keyof NetcodeSettings, value: boolean) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  }, []);

  const toggleNetcode = useCallback((key: keyof NetcodeSettings) => {
    setSettings((previous) => ({ ...previous, [key]: !previous[key] }));
  }, []);

  const toggleViz = useCallback((key: keyof VizSettings) => {
    setViz((previous) => ({ ...previous, [key]: !previous[key] }));
  }, []);

  return { settings, viz, view, setCondition, applyPreset, toggleNetcode, setNetcode, toggleViz, setView };
}
