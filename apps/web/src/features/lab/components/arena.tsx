"use client";

import { useCallback, useEffect, useRef } from "react";
import { Crosshair, Keyboard } from "lucide-react";

import type { GameClient } from "../game-client";
import { renderArena } from "../renderer";
import type { ConnectionState } from "../types";

interface ArenaProps {
  client: GameClient | null;
  connectedPlayers: number;
  connectionState: ConnectionState;
  debug: boolean;
  caption: string;
}

const MOVEMENT_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
]);

export function Arena({
  client,
  connectedPlayers,
  connectionState,
  debug,
  caption,
}: ArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const pressedKeys = useRef(new Set<string>());

  const updateDirection = useCallback(() => {
    const keys = pressedKeys.current;
    const moveX = Number(keys.has("d") || keys.has("arrowright"))
      - Number(keys.has("a") || keys.has("arrowleft"));
    const moveY = Number(keys.has("s") || keys.has("arrowdown"))
      - Number(keys.has("w") || keys.has("arrowup"));
    client?.setInputDirection(moveX, moveY);
  }, [client]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    let animationFrame = 0;
    const draw = (now: number) => {
      renderArena(
        canvas,
        client?.getRenderFrame(now) ?? {
          players: [],
          localAuthoritative: null,
          localPredicted: null,
          localRendered: null,
          remoteSnapshotPositions: [],
        },
        debug,
      );
      animationFrame = window.requestAnimationFrame(draw);
    };
    animationFrame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [client, debug]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if (!MOVEMENT_KEYS.has(key)) {
      return;
    }
    event.preventDefault();
    pressedKeys.current.add(key);
    updateDirection();
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if (!MOVEMENT_KEYS.has(key)) {
      return;
    }
    event.preventDefault();
    pressedKeys.current.delete(key);
    updateDirection();
  };

  const clearInput = () => {
    pressedKeys.current.clear();
    client?.setInputDirection(0, 0);
  };

  return (
    <section className="flex min-h-0 flex-col border-b border-border bg-card/30 lg:border-r">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Crosshair className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-xs font-medium text-foreground">Authoritative arena</h2>
        </div>
        <div className="font-mono text-[10px] tracking-wide text-muted-foreground">
          960 × 600 UNITS · 30 HZ
        </div>
      </div>

      <div
        ref={arenaRef}
        role="application"
        aria-label="SyncLab arena. Focus and use WASD or arrow keys to move."
        tabIndex={0}
        data-testid="arena"
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={clearInput}
        onPointerDown={() => arenaRef.current?.focus()}
        className="group relative min-h-[360px] flex-1 cursor-crosshair overflow-hidden bg-[#090a0c] outline-none ring-inset transition-shadow focus-visible:ring-2 focus-visible:ring-primary/50 lg:min-h-0"
      >
        <canvas ref={canvasRef} className="absolute inset-0 size-full" />

        {connectionState === "connected" && connectedPlayers < 2 ? (
          <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center">
            <div className="rounded-md border border-border bg-background/90 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-sm">
              Solo mode · scripted peer active — share the room to replace it
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-white/10 bg-black/55 px-2.5 py-1.5 text-[10px] text-zinc-400 backdrop-blur-sm">
          <Keyboard className="size-3" aria-hidden="true" />
          <span>Click to focus · WASD / arrows</span>
        </div>
        {debug ? (
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-cyan-400/20 bg-black/55 px-2.5 py-1.5 font-mono text-[9px] text-cyan-300">
            DEBUG OVERLAY
          </div>
        ) : null}
      </div>
      <p
        className="h-8 shrink-0 truncate px-4 py-2 text-[10px] text-muted-foreground sm:text-[11px]"
        title={caption || undefined}
      >
        {caption || "\u00a0"}
      </p>
    </section>
  );
}
