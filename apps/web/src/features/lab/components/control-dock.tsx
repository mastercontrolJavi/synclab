"use client";

import { useId } from "react";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { getActivePreset, NETWORK_PRESETS, SLIDER_LIMITS } from "../presets";
import type { NetcodeSettings, NetworkConditions } from "../types";
import type { LabControls, VizSettings } from "../use-lab-controls";

interface ControlDockProps {
  controls: LabControls;
  className?: string;
}

const NETCODE_ROWS: readonly {
  key: keyof NetcodeSettings;
  label: string;
  explain: string;
  shortcut: string;
}[] = [
  {
    key: "prediction",
    label: "Client prediction",
    explain: "Move your player the instant you press a key, using the same movement code the server runs.",
    shortcut: "P",
  },
  {
    key: "reconciliation",
    label: "Server reconciliation",
    explain: "When a snapshot arrives, snap to the server's answer and replay inputs it has not processed yet.",
    shortcut: "R",
  },
  {
    key: "interpolation",
    label: "Remote interpolation",
    explain: "Draw other players 100 ms in the past, blending between two snapshots so they glide instead of stutter.",
    shortcut: "I",
  },
];

const VIZ_ROWS: readonly { key: keyof VizSettings; label: string; explain: string; shortcut: string; swatch: string }[] = [
  {
    key: "ghosts",
    label: "Ghosts",
    explain: "Show the server's authoritative position (lime) next to what the client draws.",
    shortcut: "G",
    swatch: "bg-server",
  },
  {
    key: "trail",
    label: "Replay trail",
    explain: "On each correction, draw the inputs the client re-simulated from the server's position.",
    shortcut: "T",
    swatch: "bg-rollback",
  },
  {
    key: "packets",
    label: "Packets",
    explain: "Animate every message between client and server. Dot speed equals the simulated latency.",
    shortcut: "K",
    swatch: "bg-predicted",
  },
];

const SLIDERS: readonly {
  key: keyof NetworkConditions;
  label: string;
  unit: string;
  explain: string;
}[] = [
  {
    key: "rttMs",
    label: "Latency (round trip)",
    unit: "ms",
    explain: "Time for a message to reach the server and come back. Split evenly between both directions.",
  },
  {
    key: "jitterMs",
    label: "Jitter",
    unit: "ms",
    explain: "Random variation added to each message's delay, so packets arrive unevenly.",
  },
  {
    key: "packetLossPercent",
    label: "Packet loss",
    unit: "%",
    explain: "Chance that any single message, in either direction, is dropped and never arrives.",
  },
];

export function ControlDock({ controls, className }: ControlDockProps) {
  const { settings, viz, view } = controls;
  const scope = useId();
  const activePreset = getActivePreset(settings);

  return (
    <div className={cn("flex flex-col", className)}>
      <DockSection title="Network" aside={activePreset ? activePreset.label : "Custom"} tourId="presets">
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Network presets">
          {NETWORK_PRESETS.map((preset) => {
            const active = activePreset?.id === preset.id;
            return (
              <Tooltip key={preset.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-reveal
                    aria-pressed={active}
                    onClick={() => controls.applyPreset(preset)}
                    className={cn(
                      "group flex h-9 items-center justify-between gap-2 rounded-lg border px-2.5 text-left text-[12.5px] font-medium transition-[background-color,border-color,color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-brand/50 bg-brand/10 text-ink shadow-glow-accent"
                        : "border-line bg-surface-2/60 text-ink-muted hover:border-line-strong hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <span className="truncate">{preset.label}</span>
                    <kbd className="kbd !h-4.5 !min-w-4.5 !text-[10px]">{preset.shortcut}</kbd>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">{preset.blurb}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="mt-4 space-y-4">
          {SLIDERS.map((slider) => {
            const limits = SLIDER_LIMITS[slider.key];
            const value = settings[slider.key];
            const id = `${scope}-slider-${slider.key}`;
            return (
              <div key={slider.key} data-reveal className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label htmlFor={id} className="cursor-help text-[12.5px] text-ink-muted">
                        {slider.label}
                      </label>
                    </TooltipTrigger>
                    <TooltipContent side="left">{slider.explain}</TooltipContent>
                  </Tooltip>
                  <output htmlFor={id} className="font-mono text-[12.5px] text-ink">
                    {Number.isInteger(value) ? value : value.toFixed(1)}
                    <span className="text-ink-faint">{slider.unit}</span>
                  </output>
                </div>
                <Slider
                  id={id}
                  aria-label={slider.label}
                  min={limits.min}
                  max={limits.max}
                  step={limits.step}
                  value={[value]}
                  onValueChange={(values) => controls.setCondition(slider.key, values[0] ?? value)}
                />
              </div>
            );
          })}
        </div>
      </DockSection>

      <DockSection
        title="Netcode"
        aside={view === "split" ? "right pane" : undefined}
        asideHint="The left pane is the naive baseline with everything off. These switches change the right pane."
        tourId="netcode"
      >
        <div className="-my-1 divide-y divide-line">
          {NETCODE_ROWS.map((row) => {
            const id = `${scope}-netcode-${row.key}`;
            const disabled = row.key === "reconciliation" && !settings.prediction;
            return (
              <div key={row.key} data-reveal className="flex items-center justify-between gap-3 py-2.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label
                      htmlFor={id}
                      className={cn("flex cursor-pointer items-center gap-2 text-[13px] text-ink", disabled && "text-ink-faint")}
                    >
                      {row.label}
                      <kbd className="kbd !h-4.5 !min-w-4.5 !text-[10px]">{row.shortcut}</kbd>
                    </label>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {disabled ? "Reconciliation corrects a prediction, so it needs prediction on." : row.explain}
                  </TooltipContent>
                </Tooltip>
                <Switch
                  id={id}
                  checked={settings[row.key]}
                  onCheckedChange={(checked) => controls.setNetcode(row.key, checked)}
                  aria-label={row.label}
                />
              </div>
            );
          })}
        </div>
      </DockSection>

      <DockSection title="Show" tourId="viz">
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Visualizations">
          {VIZ_ROWS.map((row) => (
            <Tooltip key={row.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  data-reveal
                  aria-pressed={viz[row.key]}
                  onClick={() => controls.toggleViz(row.key)}
                  className={cn(
                    "flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    viz[row.key]
                      ? "border-line-strong bg-surface-2 text-ink"
                      : "border-line bg-transparent text-ink-faint hover:text-ink-muted",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", viz[row.key] ? row.swatch : "bg-ink-faint/50")} aria-hidden="true" />
                  {row.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {row.explain} <kbd className="kbd ml-1">{row.shortcut}</kbd>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </DockSection>
    </div>
  );
}

function DockSection({
  title,
  aside,
  asideHint,
  tourId,
  children,
}: {
  title: string;
  aside?: string;
  asideHint?: string;
  tourId?: string;
  children: React.ReactNode;
}) {
  return (
    <section data-tour={tourId} className="border-b border-line px-4 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="eyebrow">{title}</h3>
        {aside ? (
          asideHint ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="cursor-help rounded font-mono text-[11px] text-brand outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {aside}
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">{asideHint}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="font-mono text-[11px] text-brand">{aside}</span>
          )
        ) : null}
      </div>
      {children}
    </section>
  );
}
