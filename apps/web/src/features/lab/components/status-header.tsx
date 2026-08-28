"use client";

import { Check, Copy, FlaskConical, Radio, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { ConnectionState } from "../types";

interface StatusHeaderProps {
  roomId: string;
  status: ConnectionState;
  copied: boolean;
  onCopy: () => void;
  onRetry: () => void;
}

const STATUS_LABELS: Record<ConnectionState, string> = {
  connecting: "Connecting",
  connected: "Connected",
  reconnecting: "Reconnecting",
  disconnected: "Disconnected",
  room_full: "Room full",
  server_unavailable: "Server unavailable",
};

export function StatusHeader({
  roomId,
  status,
  copied,
  onCopy,
  onRetry,
}: StatusHeaderProps) {
  const shouldRetry = status === "server_unavailable" || status === "disconnected";

  return (
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-2.5 sm:px-5">
      <div className="flex items-center gap-3">
        <div className="flex size-7 items-center justify-center rounded-md border border-border bg-card">
          <FlaskConical className="size-3.5 text-primary" aria-hidden="true" />
        </div>
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-sm font-semibold tracking-tight">SyncLab</h1>
          <span className="hidden text-[11px] text-muted-foreground md:inline">
            Real-time networking laboratory
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex h-7 items-center gap-2 rounded-md border border-border bg-card px-2.5"
          aria-label={`Connection status: ${STATUS_LABELS[status]}`}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              status === "connected" && "bg-emerald-400",
              (status === "connecting" || status === "reconnecting") &&
                "animate-pulse bg-amber-300",
              (status === "disconnected" || status === "server_unavailable") &&
                "bg-red-400",
              status === "room_full" && "bg-violet-400",
            )}
          />
          <span className="text-[11px] text-muted-foreground">
            {STATUS_LABELS[status]}
          </span>
        </div>

        {shouldRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" />
            Retry
          </Button>
        ) : null}

        <div className="hidden h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 sm:flex">
          <Radio className="size-3 text-muted-foreground" aria-hidden="true" />
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Room
          </span>
          <code className="font-mono text-[11px] text-foreground">{roomId || "N/A"}</code>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onCopy}
              disabled={!roomId}
              aria-label="Copy room link"
              data-testid="copy-room-link"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {copied ? "Copied room link" : "Copy room link"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
