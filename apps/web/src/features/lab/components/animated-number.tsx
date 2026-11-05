"use client";

import { useRef } from "react";

import { DURATION, EASE, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion";

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  className?: string;
}

/** Tweens toward the latest value by writing textContent directly; no React re-render per frame. */
export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const proxy = useRef<{ value: number } | null>(null);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element) {
        return;
      }
      if (!proxy.current || prefersReducedMotion() || !Number.isFinite(value)) {
        proxy.current = { value };
        element.textContent = format(value);
        return;
      }
      const state = proxy.current;
      gsap.to(state, {
        value,
        duration: DURATION.slow,
        ease: EASE.out,
        overwrite: true,
        onUpdate: () => {
          element.textContent = format(state.value);
        },
      });
    },
    { dependencies: [value, format] },
  );

  return <span ref={ref} className={className} />;
}
