"use client";

import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DURATION, EASE, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion";

export interface TourStep {
  /** `data-tour` value of the element to highlight. */
  target: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: "panes",
    title: "Same network, two clients",
    body: "Both panes get identical latency, jitter and loss. Left waits for the server. Right predicts. Watch which one feels alive.",
  },
  {
    target: "pane-predicted",
    title: "Cyan is you. Lime is the server.",
    body: "The lime ghost is the last position the server confirmed. When they disagree, an amber flash shows the client snapping back and replaying inputs.",
  },
  {
    target: "pane-predicted-lane",
    title: "Every dot is a real message",
    body: "Inputs fly right, server snapshots fly left. Speed equals the simulated latency. Red bursts are lost packets.",
  },
  {
    target: "presets",
    title: "Make the network worse",
    body: "Try Mobile 3G or Chaos (keys 1 to 4). The sliders glide, and the network changes live.",
  },
  {
    target: "telemetry",
    title: "Measured, not configured",
    body: "These numbers are observed from real traffic. Hover any metric for a one-line explanation. Press ? for every shortcut.",
  },
];

const PADDING = 8;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function measure(target: string): Rect | null {
  const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }
  return {
    x: rect.left - PADDING,
    y: rect.top - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };
}

interface GuidedTourProps {
  open: boolean;
  onClose: () => void;
  steps?: readonly TourStep[];
}

export function GuidedTour({ open, onClose, steps = TOUR_STEPS }: GuidedTourProps) {
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const holeRef = useRef<SVGRectElement>(null);
  const ringRef = useRef<SVGRectElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const maskId = useId();
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  const finish = useCallback(() => {
    onClose();
    setIndex(0);
  }, [onClose]);

  const place = useCallback(
    (animate: boolean) => {
      const hole = holeRef.current;
      const ring = ringRef.current;
      const card = cardRef.current;
      if (!step || !hole || !ring || !card) {
        return;
      }
      const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      target?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      const rect = measure(step.target) ?? {
        x: window.innerWidth / 2 - 1,
        y: window.innerHeight / 2 - 1,
        width: 2,
        height: 2,
      };
      const cardWidth = Math.min(340, window.innerWidth - 24);
      const cardHeight = card.offsetHeight || 170;
      const below = rect.y + rect.height + 12;
      const fitsBelow = below + cardHeight < window.innerHeight - 12;
      const cardY = fitsBelow ? below : Math.max(12, rect.y - cardHeight - 12);
      const cardX = Math.min(Math.max(12, rect.x + rect.width / 2 - cardWidth / 2), window.innerWidth - cardWidth - 12);
      const duration = animate && !prefersReducedMotion() ? DURATION.slow + 0.1 : 0;
      gsap.to(hole, { attr: { ...rect }, duration, ease: EASE.out, overwrite: true });
      gsap.to(ring, { attr: { ...rect }, duration, ease: EASE.out, overwrite: true });
      gsap.set(card, { width: cardWidth });
      gsap.to(card, { x: cardX, y: cardY, duration, ease: EASE.out, overwrite: true });
    },
    [step],
  );

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      if (!open) {
        gsap.to(root, { autoAlpha: 0, duration: DURATION.base, ease: EASE.in });
        return;
      }
      gsap.to(root, { autoAlpha: 1, duration: DURATION.base, ease: EASE.out });
      place(index > 0);
      const body = cardRef.current?.querySelectorAll("[data-tour-copy]");
      if (body && !prefersReducedMotion()) {
        gsap.fromTo(body, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: DURATION.slow, ease: EASE.out, stagger: 0.05 });
      }
    },
    { dependencies: [open, index, place] },
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const onResize = () => place(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        finish();
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (last) {
          finish();
        } else {
          setIndex((value) => value + 1);
        }
      } else if (event.key === "ArrowLeft") {
        event.stopPropagation();
        setIndex((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKeyDown, true);
    cardRef.current?.focus();
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, last, finish, place]);

  return (
    <div
      ref={rootRef}
      className="invisible fixed inset-0 opacity-0"
      style={{ zIndex: 60 }}
      inert={!open}
      aria-hidden={!open}
    >
      <svg className="absolute inset-0 size-full" aria-hidden="true" onClick={finish}>
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            <rect ref={holeRef} rx="14" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(0 0 0 / 0.62)" mask={`url(#${maskId})`} />
        <rect
          ref={ringRef}
          rx="14"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          style={{ filter: "drop-shadow(0 0 10px oklch(0.84 0.14 205 / 0.55))" }}
        />
      </svg>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={step ? `Tour: ${step.title}` : "Tour"}
        tabIndex={-1}
        className="absolute top-0 left-0 rounded-xl border border-line-strong bg-surface-2 p-4 shadow-pop outline-none"
      >
        <div className="flex items-center justify-between" data-tour-copy>
          <span className="eyebrow">
            {index + 1} / {steps.length}
          </span>
          <button type="button" onClick={finish} className="rounded text-[12px] text-ink-faint outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring">
            Skip tour
          </button>
        </div>
        <h2 className="mt-2 text-[15px] font-semibold tracking-tight text-ink" data-tour-copy>
          {step?.title}
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-ink-muted" data-tour-copy>
          {step?.body}
        </p>
        <div className="mt-3.5 flex items-center justify-between" data-tour-copy>
          <div className="flex gap-1" aria-hidden="true">
            {steps.map((item, dotIndex) => (
              <span
                key={item.target}
                className={dotIndex === index ? "h-1.5 w-4 rounded-full bg-brand" : "size-1.5 rounded-full bg-line-strong"}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            {index > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setIndex((value) => value - 1)}>
                Back
              </Button>
            ) : null}
            <Button size="sm" onClick={() => (last ? finish() : setIndex((value) => value + 1))}>
              {last ? "Start exploring" : "Next"}
              {last ? null : <ArrowRight className="size-3.5" aria-hidden="true" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
