"use client";

import { useState } from "react";

import { useLabInput } from "../use-lab-input";
import { useLabSession } from "../use-lab-session";
import type { LabSettings } from "../types";
import { ControlPanel } from "./control-panel";
import { LabPane, type PaneVisuals } from "./lab-pane";
import { StatusHeader } from "./status-header";
import { TelemetryPanel } from "./telemetry-panel";

const BAD_WIFI: LabSettings = {
  rttMs: 150,
  jitterMs: 30,
  packetLossPercent: 3,
  prediction: true,
  reconciliation: true,
  interpolation: true,
};

interface LabDashboardProps {
  roomId: string;
  debug: boolean;
}

export function LabDashboard({ roomId }: LabDashboardProps) {
  const [settings, setSettings] = useState<LabSettings>(BAD_WIFI);
  const [copied, setCopied] = useState(false);
  const session = useLabSession({ roomId, split: true, settings, serverPreference: "auto" });
  useLabInput([session.main, session.naive], true);
  const visuals: PaneVisuals = { ghosts: true, trail: true, packets: true };

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
      <StatusHeader roomId={roomId} status={session.status} copied={copied} onCopy={copyRoomLink} onRetry={session.retry} />
      <main className="grid flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <LabPane
              client={session.naive}
              title="Naive client"
              subtitle="Waits for the server before moving you"
              tone="naive"
              netcode={{ prediction: false, reconciliation: false, interpolation: false }}
              visuals={visuals}
              reducedMotion={false}
              oneWayMs={settings.rttMs / 2}
              overlay={null}
            />
            <LabPane
              client={session.main}
              title="Predicted + reconciled"
              subtitle="Moves instantly, corrects to the server"
              tone="predicted"
              netcode={settings}
              visuals={visuals}
              reducedMotion={false}
              oneWayMs={settings.rttMs / 2}
              overlay={null}
            />
          </div>
          <TelemetryPanel metrics={session.metrics} history={session.history} settings={settings} />
        </div>
        <ControlPanel settings={settings} onChange={setSettings} onReset={() => setSettings(BAD_WIFI)} />
      </main>
    </div>
  );
}
