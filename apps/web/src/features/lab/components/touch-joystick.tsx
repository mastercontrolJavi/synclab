"use client";

import { useRef } from "react";

import { DURATION, EASE, gsap } from "@/lib/motion";
import { cn } from "@/lib/utils";

const RADIUS = 48;
const DEAD_ZONE = 0.18;

interface TouchJoystickProps {
  onChange: (x: number, y: number) => void;
  className?: string;
}

/** Virtual stick for touch screens. The knob follows the finger; GSAP springs it home. */
export function TouchJoystick({ onChange, className }: TouchJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  const update = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) {
      return;
    }
    const rect = base.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance > RADIUS) {
      dx = (dx / distance) * RADIUS;
      dy = (dy / distance) * RADIUS;
    }
    gsap.set(knob, { x: dx, y: dy });
    const x = dx / RADIUS;
    const y = dy / RADIUS;
    if (Math.hypot(x, y) < DEAD_ZONE) {
      onChange(0, 0);
    } else {
      onChange(x, y);
    }
  };

  const release = () => {
    pointer.current = null;
    onChange(0, 0);
    if (knobRef.current) {
      gsap.to(knobRef.current, { x: 0, y: 0, duration: DURATION.slow, ease: EASE.pop });
    }
  };

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="Movement joystick. Drag to move your player."
      className={cn(
        "relative size-28 touch-none rounded-full border border-line-strong bg-surface-1/80 shadow-pop backdrop-blur-md select-none",
        className,
      )}
      onPointerDown={(event) => {
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (pointer.current === event.pointerId) {
          update(event.clientX, event.clientY);
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div className="pointer-events-none absolute inset-3 rounded-full border border-dashed border-line" />
      <div
        ref={knobRef}
        className="pointer-events-none absolute top-1/2 left-1/2 -mt-6 -ml-6 size-12 rounded-full bg-predicted shadow-glow-accent"
      >
        <span className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-0/80" />
      </div>
    </div>
  );
}
