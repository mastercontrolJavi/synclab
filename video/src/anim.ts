import { Easing, interpolate } from "remotion";

/** The UI's --ease-out (cubic-bezier(0.16, 1, 0.3, 1)): fast start, long settle. */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.55, 0, 1, 0.45);

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 between frames a and b with an easing. */
export function progress(frame: number, a: number, b: number, easing = easeOut): number {
  return interpolate(frame, [a, b], [0, 1], { ...clamp, easing });
}

export const mix = (from: number, to: number, t: number) => from + (to - from) * t;

export type Rect = { x: number; y: number; w: number; h: number };

export const mixRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
  w: mix(a.w, b.w, t),
  h: mix(a.h, b.h, t),
});

/**
 * Keyframed value: [[frame, value], ...] with easeInOut between keys.
 * Used for every camera move so reframes feel like one continuous camera.
 */
export function keyed<T>(
  frame: number,
  keys: readonly (readonly [number, T])[],
  lerp: (a: T, b: T, t: number) => T,
  easing = easeInOut,
): T {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i += 1) {
    const [fa, va] = keys[i];
    const [fb, vb] = keys[i + 1];
    if (frame <= fb) return lerp(va, vb, easing((frame - fa) / Math.max(1, fb - fa)));
  }
  return keys[keys.length - 1][1];
}

export const keyedNumber = (frame: number, keys: readonly (readonly [number, number])[], easing = easeInOut) =>
  keyed(frame, keys, mix, easing);
export const keyedRect = (frame: number, keys: readonly (readonly [number, Rect])[], easing = easeInOut) =>
  keyed(frame, keys, mixRect, easing);
