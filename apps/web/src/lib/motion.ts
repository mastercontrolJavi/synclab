"use client";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

/**
 * Motion tokens. GSAP drives UI and overlay effects only.
 * Game entities are never tweened: they stay on the sim/render loop.
 */
let registered = false;
export function registerGsap(): void {
  if (registered || typeof window === "undefined") {
    return;
  }
  gsap.registerPlugin(useGSAP, MotionPathPlugin);
  gsap.defaults({ ease: EASE.out, duration: DURATION.base });
  registered = true;
}

export const DURATION = {
  fast: 0.12,
  base: 0.22,
  slow: 0.42,
  xslow: 0.8,
} as const;

export const EASE = {
  /** Default for anything entering or settling. */
  out: "expo.out",
  /** Symmetric moves between two resting states. */
  inOut: "power2.inOut",
  /** Exits. */
  in: "power2.in",
  /** A small overshoot for highlights and chips. */
  pop: "back.out(1.7)",
  /** Linear for time-based progress. */
  linear: "none",
} as const;

export const STAGGER = {
  tight: 0.03,
  base: 0.06,
  loose: 0.1,
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, useGSAP };
