"use client";

import { useRef } from "react";

import { DURATION, EASE, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface AutopilotHintProps {
  active: boolean;
  touch: boolean;
  className?: string;
}

const KEYS = ["W", "A", "S", "D"] as const;

/**
 * The call to action that hands control to the viewer. Floats over the arena
 * while the autopilot drives; the keys light up in sequence like someone is
 * pressing them. Hides the moment a key (or the joystick) takes over.
 */
export function AutopilotHint({ active, touch, className }: AutopilotHintProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) {
        return;
      }
      const reduce = prefersReducedMotion();
      if (!active) {
        gsap.to(root, { autoAlpha: 0, y: reduce ? 0 : 8, duration: DURATION.base, ease: EASE.in, overwrite: true });
        return;
      }
      gsap.fromTo(
        root,
        { autoAlpha: 0, y: reduce ? 0 : 10 },
        { autoAlpha: 1, y: 0, duration: DURATION.slow, ease: EASE.out, overwrite: true },
      );
      if (reduce) {
        return;
      }
      // Keys "press" one after another, then the whole pill breathes.
      const keys = root.querySelectorAll("[data-key]");
      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 0.4 });
      keys.forEach((key) => {
        timeline
          .to(key, { y: 2, backgroundColor: "var(--accent)", color: "var(--accent-ink)", borderColor: "var(--accent)", duration: 0.12, ease: EASE.out })
          .to(key, { y: 0, backgroundColor: "var(--surface-2)", color: "var(--text)", borderColor: "var(--line-strong)", duration: 0.25, ease: EASE.out }, "+=0.08");
      });
      timeline.fromTo(
        "[data-glow]",
        { opacity: 0.25 },
        { opacity: 0.9, duration: 0.5, yoyo: true, repeat: 1, ease: EASE.inOut },
        "<",
      );
    },
    { dependencies: [active, touch], scope: ref, revertOnUpdate: true },
  );

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      aria-hidden={!active}
      className={cn("pointer-events-none invisible absolute inset-x-0 bottom-3 z-[5] flex justify-center px-3 opacity-0", className)}
    >
      <div className="relative flex max-w-full items-center gap-2.5 rounded-full border border-brand/40 bg-surface-1/90 py-1.5 pr-1.5 pl-3 shadow-pop backdrop-blur-md">
        <span
          data-glow
          className="pointer-events-none absolute inset-0 rounded-full opacity-25"
          style={{ boxShadow: "0 0 0 1px var(--accent), 0 0 28px -4px oklch(0.84 0.14 205 / 0.7)" }}
          aria-hidden="true"
        />
        <span className="flex items-center gap-1.5 text-[12px] whitespace-nowrap text-ink-muted">
          <span className="size-1.5 animate-pulse rounded-full bg-predicted" aria-hidden="true" />
          Autopilot
        </span>
        <span className="h-4 w-px bg-line-strong" aria-hidden="true" />
        {touch ? (
          <span className="pr-1.5 text-[12.5px] font-medium whitespace-nowrap text-ink">Drag the joystick to take control</span>
        ) : (
          <>
            <span className="text-[12.5px] font-medium whitespace-nowrap text-ink">Press</span>
            <span className="flex gap-1" aria-label="W A S D">
              {KEYS.map((key) => (
                <kbd
                  key={key}
                  data-key
                  className="flex size-6 items-center justify-center rounded-md border border-b-2 border-line-strong bg-surface-2 font-mono text-[11px] font-semibold text-ink"
                >
                  {key}
                </kbd>
              ))}
            </span>
            <span className="hidden pr-1.5 text-[12.5px] font-medium whitespace-nowrap text-ink min-[480px]:inline">to take control</span>
          </>
        )}
      </div>
    </div>
  );
}
