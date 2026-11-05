"use client";

import { BookOpen, Check, Columns2, Keyboard, Link2, RefreshCw, Square } from "lucide-react";

import { GithubIcon } from "@/components/brand/github-icon";
import { LogoMark } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

import type { ConnectionState } from "../types";
import type { ViewMode } from "../use-lab-controls";
import type { ServerMode } from "../use-lab-session";

interface TopBarProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  status: ConnectionState;
  serverMode: ServerMode;
  liveReady: boolean;
  onSwitchToLive: () => void;
  onRetry: () => void;
  roomId: string;
  copied: boolean;
  onCopy: () => void;
  onOpenHowItWorks: () => void;
  onOpenShortcuts: () => void;
}

export function TopBar(props: TopBarProps) {
  const { view, onViewChange, roomId, copied, onCopy, onOpenHowItWorks, onOpenShortcuts } = props;
  return (
    <header
      data-reveal-header
      className="sticky top-0 z-[30] flex h-14 items-center gap-3 border-b border-line bg-surface-0/85 px-3 backdrop-blur-md sm:px-4"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <LogoMark />
        <div className="min-w-0 leading-tight">
          <h1 className="sr-only text-[15px] font-semibold tracking-tight sm:not-sr-only">{SITE.name}</h1>
          <p className="hidden truncate text-[11.5px] text-ink-faint md:block">{SITE.tagline}</p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="View"
        data-tour="view"
        className="ml-1 flex h-8 items-center rounded-lg border border-line bg-surface-1 p-0.5 sm:ml-3"
      >
        {(
          [
            { id: "split", label: "Compare", icon: Columns2 },
            { id: "single", label: "Single", icon: Square },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={view === option.id}
            onClick={() => onViewChange(option.id)}
            className={cn(
              "flex h-full items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              view === option.id ? "bg-surface-3 text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            <option.icon className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ServerChip {...props} />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onCopy}
              data-testid="copy-room-link"
              aria-label="Copy room link"
              className="hidden h-8 items-center gap-1.5 rounded-lg border border-line bg-surface-1 px-2.5 font-mono text-[12px] text-ink-muted transition-colors outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring md:flex"
            >
              {copied ? <Check className="size-3.5 text-server" aria-hidden="true" /> : <Link2 className="size-3.5" aria-hidden="true" />}
              {roomId}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {copied
              ? "Link copied."
              : props.serverMode === "live"
                ? "Copy this room's link. Open it in another tab or device to play against a real peer."
                : "Copy this room's link. Playing against a real peer needs the live server, which is still waking up."}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onOpenHowItWorks} className="h-8 text-ink-muted hover:text-ink" data-tour="how">
              <BookOpen className="size-3.5" aria-hidden="true" />
              <span className="hidden lg:inline">How it works</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            How it works <kbd className="kbd ml-1">H</kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onOpenShortcuts} aria-label="Keyboard shortcuts" className="hidden size-8 text-ink-muted hover:text-ink sm:inline-flex">
              <Keyboard className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Keyboard shortcuts <kbd className="kbd ml-1">?</kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" asChild className="size-8 text-ink-muted hover:text-ink">
              <a href={SITE.github} target="_blank" rel="noreferrer" aria-label="Source on GitHub">
                <GithubIcon />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Source on GitHub</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

function ServerChip({ status, serverMode, liveReady, onSwitchToLive, onRetry }: TopBarProps) {
  const connected = status === "connected";
  const failed = status === "server_unavailable" || status === "room_full" || status === "disconnected";
  const label = failed
    ? status === "room_full"
      ? "Room full"
      : "Offline"
    : !connected
      ? "Connecting"
      : serverMode === "live"
        ? "Live server"
        : "In-browser server";
  const explain = failed
    ? status === "room_full"
      ? "This room already has two players. Open a fresh room to play."
      : "The server could not be reached. Retry to reconnect."
    : !connected
      ? "Connecting to the authoritative server."
      : serverMode === "live"
        ? "Connected to the authoritative Node.js server. Room links work across devices."
        : "The free-tier live server is asleep, so the same authoritative server code runs in this tab. Latency, jitter and loss are simulated the same way.";

  return (
    <div className="flex items-center gap-1.5" data-tour="server">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            tabIndex={0}
            role="status"
            aria-label={`Server: ${label}`}
            className="flex h-8 items-center gap-2 rounded-lg border border-line bg-surface-1 px-2.5 text-[12.5px] text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                failed && "bg-dropped",
                !failed && !connected && "animate-pulse bg-ink-muted",
                connected && serverMode === "live" && "bg-server shadow-glow-server",
                connected && serverMode === "local" && "bg-predicted",
              )}
              aria-hidden="true"
            />
            <span className="hidden max-w-[9rem] truncate min-[400px]:inline">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">{explain}</TooltipContent>
      </Tooltip>
      {serverMode === "local" && liveReady ? (
        <Button size="sm" variant="outline" className="h-8 border-server/40 text-server hover:text-server" onClick={onSwitchToLive}>
          Go live
        </Button>
      ) : null}
      {failed && status !== "room_full" ? (
        <Button size="sm" variant="outline" className="h-8" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
