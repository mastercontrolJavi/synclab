"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { MotionOverlay } from "@/components/ui/motion-overlay";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DURATION, EASE, gsap, STAGGER, useGSAP } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { NETWORK_PRESETS } from "../presets";
import type { ConnectionState, LabSettings, NetcodeSettings } from "../types";
import { useLabControls } from "../use-lab-controls";
import { useLabInput } from "../use-lab-input";
import { NAIVE_NETCODE, useLabSession, type ServerMode, type ServerPreference } from "../use-lab-session";
import { ControlDock } from "./control-dock";
import { GuidedTour } from "./guided-tour";
import { HowItWorks } from "./how-it-works";
import { IntroOverlay } from "./intro-overlay";
import { LabPane, type PaneOverlay } from "./lab-pane";
import { Legend } from "./legend";
import { ShortcutsOverlay } from "./shortcuts-overlay";
import { SiteFooter } from "./site-footer";
import { TelemetryPanel } from "./telemetry-panel";
import { TopBar } from "./top-bar";
import { TouchJoystick } from "./touch-joystick";

const TOUR_STORAGE_KEY = "synclab.tour.v1";

function readTourDone(): boolean {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === "done";
  } catch {
    return false;
  }
}

function writeTourDone(): void {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "done");
  } catch {
    // Private mode or blocked storage: the tour simply shows again next time.
  }
}

const subscribeReducedMotion = (callback: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function predictedSubtitle(settings: NetcodeSettings): string {
  if (!settings.prediction) {
    return "Prediction off: it waits for the server, like the naive client";
  }
  if (!settings.reconciliation) {
    return "Predicts but never corrects. Watch it drift from the server";
  }
  if (!settings.interpolation) {
    return "Instant and corrected, but other players stutter";
  }
  return "Moves instantly, then corrects to the server";
}

function paneOverlay(
  status: ConnectionState,
  serverMode: ServerMode,
  onRetry: () => void,
  onFreshRoom: () => void,
): PaneOverlay | null {
  switch (status) {
    case "connected":
      return null;
    case "connecting":
    case "reconnecting":
      return serverMode === "live"
        ? {
            tone: "info",
            title: status === "connecting" ? "Waking the live server" : "Reconnecting",
            body: "Free-tier servers sleep when idle. If it isn't up in a few seconds, the same server code starts in your tab.",
          }
        : { tone: "info", title: "Starting the in-browser server", body: "Same authoritative code, same simulated network." };
    case "room_full":
      return {
        tone: "warning",
        title: "This room already has two players",
        body: "Rooms hold two people. Open a fresh room to play.",
        action: (
          <Button size="sm" onClick={onFreshRoom}>
            Open a fresh room
          </Button>
        ),
      };
    case "server_unavailable":
    case "disconnected":
      return {
        tone: "error",
        title: "Can't reach the server",
        body: "The connection dropped and automatic retries ran out.",
        action: (
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        ),
      };
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

interface LabDashboardProps {
  roomId: string;
  serverPreference: ServerPreference;
  showIntro: boolean;
}

function introServerLine(status: ConnectionState, serverMode: ServerMode): string {
  if (status !== "connected") {
    return serverMode === "live" ? "Waking the live server…" : "Starting the in-browser server…";
  }
  return serverMode === "live" ? "Live server connected" : "Running on the in-browser server";
}

export function LabDashboard({ roomId, serverPreference, showIntro }: LabDashboardProps) {
  const controls = useLabControls();
  const { settings, viz, view } = controls;
  const reducedMotion = useReducedMotion();
  const split = view === "split";
  const session = useLabSession({ roomId, split, serverPreference, settings });
  const [launched, setLaunched] = useState(!showIntro);
  const [settled, setSettled] = useState(!showIntro);
  const input = useLabInput([session.main, session.naive], launched);
  const rootRef = useRef<HTMLDivElement>(null);

  const [copied, setCopied] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourChecked, setTourChecked] = useState(false);

  // First run: start the tour once the lab is launched and actually live.
  const connected = session.status === "connected";
  if (settled && connected && !tourChecked) {
    setTourChecked(true);
    if (typeof window !== "undefined" && !readTourDone()) {
      setTourOpen(true);
    }
  }

  const closeTour = useCallback(() => {
    setTourOpen(false);
    writeTourDone();
  }, []);

  const copyRoomLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  }, []);

  const router = useRouter();
  const openFreshRoom = useCallback(() => {
    router.push("/");
  }, [router]);

  const launch = useCallback(() => {
    setLaunched(true);
    // Let the launch reveal finish before anything (like the tour) asks for attention.
    window.setTimeout(() => setSettled(true), reducedMotion ? 300 : 1_700);
  }, [reducedMotion]);

  // Launch: the lab settles into place in reading order.
  useGSAP(
    () => {
      if (!launched || !showIntro) {
        return;
      }
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduce: "(prefers-reduced-motion: reduce)",
          full: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          if (context.conditions?.reduce) {
            gsap.from("[data-reveal-root]", { opacity: 0, duration: DURATION.slow });
            return;
          }
          const timeline = gsap.timeline({ defaults: { ease: EASE.out }, delay: 0.15 });
          timeline
            .from("[data-reveal-header]", { y: -12, opacity: 0, duration: DURATION.slow })
            .from("[data-pane]", { y: 24, opacity: 0, scale: 0.985, duration: DURATION.xslow, stagger: STAGGER.loose }, "-=0.2")
            .from("aside [data-reveal]", { x: 12, opacity: 0, duration: DURATION.slow, stagger: STAGGER.tight }, "-=0.6")
            .from("[data-tour='legend'] [data-reveal]", { y: 6, opacity: 0, duration: DURATION.slow, stagger: STAGGER.tight }, "-=0.5")
            .from("[data-tour='telemetry'] [data-reveal]", { y: 10, opacity: 0, duration: DURATION.slow, stagger: STAGGER.base }, "-=0.45");
        },
      );
      return () => mm.revert();
    },
    { dependencies: [launched], scope: rootRef },
  );

  const anyOverlayOpen = !launched || howOpen || shortcutsOpen || sheetOpen || tourOpen;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen((value) => !value);
        return;
      }
      if (anyOverlayOpen && event.key.toLowerCase() !== "h") {
        return;
      }
      const preset = NETWORK_PRESETS.find((item) => item.shortcut === event.key);
      if (preset) {
        controls.applyPreset(preset);
        return;
      }
      switch (event.key.toLowerCase()) {
        case "p":
          controls.toggleNetcode("prediction");
          break;
        case "r":
          controls.toggleNetcode("reconciliation");
          break;
        case "i":
          controls.toggleNetcode("interpolation");
          break;
        case "g":
          controls.toggleViz("ghosts");
          break;
        case "t":
          controls.toggleViz("trail");
          break;
        case "k":
          controls.toggleViz("packets");
          break;
        case "v":
          controls.setView(view === "split" ? "single" : "split");
          break;
        case "h":
          setHowOpen((value) => !value);
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anyOverlayOpen, controls, view]);

  const naiveSettings: LabSettings = { ...settings, ...NAIVE_NETCODE };
  const oneWayMs = settings.rttMs / 2;
  const mainOverlay = paneOverlay(session.status, session.serverMode, session.retry, openFreshRoom);
  const naiveOverlay = paneOverlay(session.naiveStatus, session.serverMode, session.retry, openFreshRoom);

  const autopilotBadge = input.autopilot && connected ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="flex items-center gap-1.5 rounded-[5px] border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] leading-none text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-predicted" aria-hidden="true" />
          AUTOPILOT
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Driving itself so you can watch. Press W A S D (or drag the joystick) to take over.
      </TooltipContent>
    </Tooltip>
  ) : null;

  return (
    <div ref={rootRef} data-reveal-root className="flex min-h-dvh flex-col bg-background bg-grid text-foreground">
      <TopBar
        view={view}
        onViewChange={controls.setView}
        status={session.status}
        serverMode={session.serverMode}
        liveReady={session.liveReady}
        onSwitchToLive={session.switchToLive}
        onRetry={session.retry}
        roomId={roomId}
        copied={copied}
        onCopy={copyRoomLink}
        onOpenHowItWorks={() => setHowOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <main className="mx-auto grid w-full max-w-[1680px] flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div
            data-tour="panes"
            className={cn(
              "grid gap-3",
              split ? "md:grid-cols-2" : "mx-auto w-full max-w-[max(480px,calc(160dvh-640px))]",
            )}
          >
            {split ? (
              <LabPane
                client={session.naive}
                title="Naive client"
                subtitle="Waits for the server before it moves you"
                tone="naive"
                netcode={naiveSettings}
                visuals={viz}
                reducedMotion={reducedMotion}
                oneWayMs={oneWayMs}
                overlay={naiveOverlay}
                tourId="pane-naive"
              />
            ) : null}
            <LabPane
              client={session.main}
              title={split ? "Predicted + reconciled" : "Your client"}
              subtitle={predictedSubtitle(settings)}
              tone="predicted"
              netcode={settings}
              visuals={viz}
              reducedMotion={reducedMotion}
              oneWayMs={oneWayMs}
              overlay={mainOverlay}
              badge={autopilotBadge}
              tourId="pane-predicted"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-1">
            <Legend />
            <p className="hidden text-[12px] text-ink-faint xl:block">
              <kbd className="kbd">W</kbd> <kbd className="kbd">A</kbd> <kbd className="kbd">S</kbd> <kbd className="kbd">D</kbd> to drive ·{" "}
              <kbd className="kbd">?</kbd> for shortcuts
            </p>
          </div>

          <TelemetryPanel metrics={session.metrics} history={session.history} settings={settings} />
        </div>

        <aside
          aria-label="Lab controls"
          className="hidden self-start overflow-hidden rounded-xl border border-line bg-surface-1 shadow-panel lg:sticky lg:top-[68px] lg:block"
        >
          <ControlDock controls={controls} />
        </aside>
      </main>

      <SiteFooter />

      {/* Mobile: joystick + controls sheet */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[40] flex items-end justify-between p-4 lg:hidden">
        <TouchJoystick onChange={input.setAnalog} className="pointer-events-auto" />
        <Button
          size="lg"
          onClick={() => setSheetOpen(true)}
          className="pointer-events-auto h-11 rounded-xl px-4 shadow-pop"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Controls
        </Button>
      </div>
      <MotionOverlay
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        placement="bottom"
        title="Lab controls"
        description="Network conditions, netcode switches and what to show."
        zIndex={45}
      >
        <ControlDock controls={controls} />
      </MotionOverlay>

      <IntroOverlay
        open={!launched}
        serverLine={introServerLine(session.status, session.serverMode)}
        serverReady={connected}
        onLaunch={launch}
        onHowItWorks={() => setHowOpen(true)}
      />
      <HowItWorks open={howOpen} onClose={() => setHowOpen(false)} />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <GuidedTour open={tourOpen} onClose={closeTour} />
    </div>
  );
}
