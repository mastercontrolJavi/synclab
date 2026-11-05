/**
 * Mirrors SyncLab's design tokens (apps/web/src/app/globals.css), so the film
 * and the product share one palette: one color per concept, everywhere.
 */
export const color = {
  surface0: "oklch(0.118 0.007 255)",
  surface1: "oklch(0.148 0.009 255)",
  surface2: "oklch(0.182 0.011 255)",
  line: "oklch(1 0 0 / 7.5%)",
  lineStrong: "oklch(1 0 0 / 14%)",
  text: "oklch(0.965 0.004 255)",
  textMuted: "oklch(0.72 0.013 255)",
  textFaint: "oklch(0.54 0.013 255)",
  predicted: "oklch(0.84 0.14 205)", // you, predicted locally: cyan
  server: "oklch(0.89 0.19 130)", // server authoritative: lime
  remote: "oklch(0.74 0.16 300)", // interpolated remote: violet
  rollback: "oklch(0.82 0.16 72)", // reconciliation / correction: amber
  dropped: "oklch(0.67 0.22 25)", // dropped packet: red
} as const;

export const alpha = (oklch: string, a: number) => oklch.replace(")", ` / ${a})`);

export const font = {
  sans: "Geist, ui-sans-serif, system-ui, sans-serif",
  mono: "Geist Mono, ui-monospace, monospace",
} as const;

/** Safe area: 7% horizontally, 9% vertically of 2560x1440. */
export const SAFE = { x: 180, y: 130 } as const;
