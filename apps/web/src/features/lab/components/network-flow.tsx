"use client";

import { ArrowDown, ArrowUp, Network, Server, SquareTerminal } from "lucide-react";

import { cn } from "@/lib/utils";

import type { NetworkEvent } from "../types";

interface NetworkFlowProps {
  events: NetworkEvent[];
}

const EVENT_STYLES: Record<NetworkEvent["type"], string> = {
  input: "text-emerald-300",
  snapshot: "text-violet-300",
  ack: "text-sky-300",
  reconcile: "text-amber-300",
  drop: "text-red-300",
  system: "text-zinc-300",
};

function FlowNode({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof SquareTerminal;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-foreground">{value}</div>
      </div>
    </div>
  );
}

export function NetworkFlow({ events }: NetworkFlowProps) {
  const lastOutbound = events.find((event) => event.direction === "outbound");
  const lastInbound = events.find((event) => event.direction === "inbound");

  return (
    <section className="min-h-0 border-b border-border bg-background lg:border-r lg:border-b-0">
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Network className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-xs font-medium">Live network flow</h2>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          Most recent first
        </span>
      </div>

      <div className="grid min-h-0 gap-4 p-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(280px,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-stretch gap-2">
            <FlowNode
              icon={SquareTerminal}
              label="Client"
              value={lastOutbound?.label ?? "Awaiting input"}
            />
            <div className="flex w-6 shrink-0 flex-col items-center justify-center gap-0.5 text-muted-foreground/60">
              <ArrowUp className="size-3" aria-hidden="true" />
              <ArrowDown className="size-3" aria-hidden="true" />
            </div>
            <FlowNode
              icon={Server}
              label="Server"
              value={lastInbound?.label ?? "Awaiting snapshot"}
            />
          </div>
          <div className="rounded-md border border-border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Simulated transit
              </span>
              <span className="font-mono text-[9px] text-muted-foreground">
                queued · delayed · dropped
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-primary/45" />
            </div>
          </div>
        </div>

        <div
          className="min-h-[132px] overflow-hidden rounded-md border border-border bg-[#0a0b0d]"
          aria-live="polite"
          aria-label="Recent network events"
        >
          {events.length === 0 ? (
            <div className="flex h-full min-h-[132px] items-center justify-center text-[10px] text-muted-foreground">
              Events appear when the connection starts
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {events.slice(0, 6).map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5 font-mono text-[9px]"
                >
                  <span className="text-zinc-600">
                    {new Date(event.timestamp).toLocaleTimeString([], {
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span className={cn("truncate", EVENT_STYLES[event.type])}>
                    {event.label}
                  </span>
                  <span className="max-w-36 truncate text-right text-zinc-500">
                    {event.detail}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
