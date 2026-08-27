"use client";

import { Gauge, RotateCcw, SlidersHorizontal, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { LabSettings } from "../types";

interface ControlPanelProps {
  settings: LabSettings;
  onChange: (settings: LabSettings) => void;
  onReset: () => void;
}

interface RangeControlProps {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

function RangeControl({
  label,
  value,
  minimum,
  maximum,
  step,
  unit,
  onChange,
}: RangeControlProps) {
  const controlId = `range-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground" htmlFor={controlId}>
          {label}
        </label>
        <output className="min-w-14 text-right font-mono text-[11px] tabular-nums text-foreground">
          {value}{unit}
        </output>
      </div>
      <Slider
        id={controlId}
        aria-label={label}
        min={minimum}
        max={maximum}
        step={step}
        value={[value]}
        onValueChange={(values) => onChange(values[0] ?? value)}
      />
      <div className="flex justify-between font-mono text-[9px] text-muted-foreground/60">
        <span>{minimum}</span>
        <span>{maximum}{unit}</span>
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: ToggleRowProps) {
  const controlId = `toggle-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <label
          htmlFor={controlId}
          className="block cursor-pointer text-[11px] font-medium text-foreground"
        >
          {label}
        </label>
        <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={controlId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className="mt-0.5"
      />
    </div>
  );
}

const PRESETS: Array<{
  label: string;
  description: string;
  values: Pick<LabSettings, "rttMs" | "jitterMs" | "packetLossPercent">;
}> = [
  {
    label: "Clean",
    description: "0ms",
    values: { rttMs: 0, jitterMs: 0, packetLossPercent: 0 },
  },
  {
    label: "200ms",
    description: "Latency",
    values: { rttMs: 200, jitterMs: 10, packetLossPercent: 0 },
  },
  {
    label: "Jitter",
    description: "80ms",
    values: { rttMs: 100, jitterMs: 80, packetLossPercent: 0 },
  },
  {
    label: "Lossy",
    description: "10%",
    values: { rttMs: 120, jitterMs: 25, packetLossPercent: 10 },
  },
];

export function ControlPanel({ settings, onChange, onReset }: ControlPanelProps) {
  const update = <Key extends keyof LabSettings>(key: Key, value: LabSettings[Key]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <aside className="min-h-0 border-b border-border bg-background lg:overflow-y-auto">
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-xs font-medium">Lab controls</h2>
        </div>
        <Button variant="ghost" size="xs" onClick={onReset}>
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
      </div>

      <div className="divide-y divide-border">
        <section className="space-y-3.5 p-4" aria-labelledby="presets-heading">
          <div className="flex items-center gap-2">
            <Zap className="size-3 text-muted-foreground" aria-hidden="true" />
            <h3
              id="presets-heading"
              className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Lab presets
            </h3>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((preset) => {
              const active =
                preset.values.rttMs === settings.rttMs &&
                preset.values.jitterMs === settings.jitterMs &&
                preset.values.packetLossPercent === settings.packetLossPercent;
              return (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => onChange({ ...settings, ...preset.values })}
                  className={cn(
                    "rounded-md border px-1.5 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <span className="block text-[10px] font-medium">{preset.label}</span>
                  <span className="mt-0.5 block font-mono text-[8px] opacity-65">
                    {preset.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 p-4" aria-labelledby="conditions-heading">
          <div className="flex items-center gap-2">
            <Gauge className="size-3 text-muted-foreground" aria-hidden="true" />
            <h3
              id="conditions-heading"
              className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Network conditions
            </h3>
          </div>
          <RangeControl
            label="Round-trip latency"
            value={settings.rttMs}
            minimum={0}
            maximum={400}
            step={10}
            unit="ms"
            onChange={(value) => update("rttMs", value)}
          />
          <RangeControl
            label="Jitter"
            value={settings.jitterMs}
            minimum={0}
            maximum={100}
            step={5}
            unit="ms"
            onChange={(value) => update("jitterMs", value)}
          />
          <RangeControl
            label="Packet loss"
            value={settings.packetLossPercent}
            minimum={0}
            maximum={20}
            step={1}
            unit="%"
            onChange={(value) => update("packetLossPercent", value)}
          />
        </section>

        <section className="p-4" aria-labelledby="netcode-heading">
          <h3
            id="netcode-heading"
            className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
          >
            Netcode
          </h3>
          <div className="divide-y divide-border">
            <ToggleRow
              label="Client prediction"
              description="Apply local input immediately."
              checked={settings.prediction}
              onCheckedChange={(value) => update("prediction", value)}
            />
            <ToggleRow
              label="Server reconciliation"
              description="Restore authority, then replay pending input."
              checked={settings.reconciliation}
              onCheckedChange={(value) => update("reconciliation", value)}
            />
            <ToggleRow
              label="Remote interpolation"
              description="Render peers 100ms behind snapshots."
              checked={settings.interpolation}
              onCheckedChange={(value) => update("interpolation", value)}
            />
          </div>
        </section>
      </div>
    </aside>
  );
}
