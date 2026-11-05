"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { GameClient } from "../game-client";
import { renderPacketLane } from "../packet-lane-renderer";
import { ArenaRenderer } from "../renderer";
import type { NetcodeSettings, RenderFrame } from "../types";

export interface PaneVisuals {
  ghosts: boolean;
  trail: boolean;
  packets: boolean;
}

export interface PaneOverlay {
  tone: "info" | "warning" | "error";
  title: string;
  body: ReactNode;
  action?: ReactNode;
}

interface LabPaneProps {
  client: GameClient | null;
  title: string;
  subtitle: string;
  tone: "naive" | "predicted";
  netcode: NetcodeSettings;
  visuals: PaneVisuals;
  reducedMotion: boolean;
  oneWayMs: number;
  overlay: PaneOverlay | null;
  badge?: ReactNode;
  className?: string;
  tourId?: string;
}

const EMPTY_FRAME: RenderFrame = {
  players: [],
  localAuthoritative: null,
  localPredicted: null,
  localRendered: null,
  remoteSnapshotPositions: [],
};

export function LabPane({
  client,
  title,
  subtitle,
  tone,
  netcode,
  visuals,
  reducedMotion,
  oneWayMs,
  overlay,
  badge,
  className,
  tourId,
}: LabPaneProps) {
  const arenaRef = useRef<HTMLCanvasElement>(null);
  const laneRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef({ netcode, visuals, reducedMotion });

  useLayoutEffect(() => {
    optionsRef.current = { netcode, visuals, reducedMotion };
  });

  useEffect(() => {
    const arenaCanvas = arenaRef.current;
    const laneCanvas = laneRef.current;
    if (!arenaCanvas || !laneCanvas) {
      return;
    }
    const renderer = new ArenaRenderer(arenaCanvas);
    let frame = 0;
    const draw = (now: number) => {
      const options = optionsRef.current;
      const telemetry = client?.getTelemetry() ?? null;
      renderer.render(
        client?.getRenderFrame(now) ?? EMPTY_FRAME,
        telemetry,
        {
          ghosts: options.visuals.ghosts,
          trail: options.visuals.trail,
          reducedMotion: options.reducedMotion,
        },
        {
          inputPreview: options.netcode.prediction ? null : client?.getInputPreview() ?? null,
          predictionEnabled: options.netcode.prediction,
        },
      );
      renderPacketLane(
        laneCanvas,
        options.visuals.packets ? telemetry : null,
        now,
        options.reducedMotion,
      );
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      renderer.destroy();
    };
  }, [client]);

  const accent = tone === "predicted" ? "bg-predicted" : "bg-ink-faint";

  return (
    <section
      data-pane={tone}
      data-tour={tourId}
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface-1 shadow-panel", className)}
      aria-label={`${title} arena`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", accent)} aria-hidden="true" />
            <h2 className="truncate text-[14px] font-semibold tracking-tight text-ink">{title}</h2>
          </div>
          <p className="mt-0.5 truncate text-[12px] text-ink-muted">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge}
          <NetcodeChips netcode={netcode} />
        </div>
      </header>

      <div className="relative aspect-[8/5] w-full bg-surface-0">
        <canvas ref={arenaRef} className="absolute inset-0 size-full" aria-hidden="true" />
        {overlay ? <PaneStateOverlay overlay={overlay} /> : null}
      </div>

      <div className="relative h-14 border-t border-line bg-surface-0/60" data-tour={tourId ? `${tourId}-lane` : undefined}>
        <canvas ref={laneRef} className="absolute inset-0 size-full" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-y-0 left-3 flex flex-col justify-center font-mono text-[10px] leading-3.5">
          <span className="text-predicted">CLIENT</span>
          <span className="text-ink-faint">inputs →</span>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex flex-col items-end justify-center font-mono text-[10px] leading-3.5">
          <span className="text-server">SERVER</span>
          <span className="text-ink-faint">← state</span>
        </div>
        <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-surface-0/80 px-1 font-mono text-[10px] text-ink-faint">
          {visuals.packets ? `≈${Math.round(oneWayMs)} ms each way` : "packet view off"}
        </span>
      </div>
    </section>
  );
}

function NetcodeChips({ netcode }: { netcode: NetcodeSettings }) {
  const items = [
    { key: "P", on: netcode.prediction, label: "Prediction" },
    { key: "R", on: netcode.reconciliation && netcode.prediction, label: "Reconciliation" },
    { key: "I", on: netcode.interpolation, label: "Interpolation" },
  ];
  return (
    <div className="hidden items-center gap-1 sm:flex" aria-label="Netcode for this pane">
      {items.map((item) => (
        <span
          key={item.key}
          title={`${item.label} ${item.on ? "on" : "off"}`}
          className={cn(
            "rounded-[5px] border px-1.5 py-0.5 font-mono text-[10px] leading-none",
            item.on
              ? "border-predicted/35 bg-predicted/10 text-predicted"
              : "border-line-strong text-ink-faint line-through decoration-ink-faint/60",
          )}
        >
          {item.label.slice(0, 4).toUpperCase()}
        </span>
      ))}
    </div>
  );
}

function PaneStateOverlay({ overlay }: { overlay: PaneOverlay }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-0/70 p-4 backdrop-blur-[2px]" role="status">
      <div className="max-w-xs rounded-lg border border-line-strong bg-surface-2/95 px-4 py-3 text-center shadow-pop">
        <div className="flex items-center justify-center gap-2">
          <span
            className={cn(
              "size-1.5 rounded-full",
              overlay.tone === "info" && "animate-pulse bg-predicted",
              overlay.tone === "warning" && "bg-rollback",
              overlay.tone === "error" && "bg-dropped",
            )}
            aria-hidden="true"
          />
          <p className="text-[13px] font-medium text-ink">{overlay.title}</p>
        </div>
        <div className="mt-1 text-[12px] leading-5 text-ink-muted">{overlay.body}</div>
        {overlay.action ? <div className="mt-2.5 flex justify-center">{overlay.action}</div> : null}
      </div>
    </div>
  );
}
