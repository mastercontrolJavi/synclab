/**
 * The five netcode concepts and their single, shared color.
 * CSS variables (globals.css) are the source of truth. The canvas resolves
 * them at runtime with `resolveConceptColors()`.
 */
export const CONCEPTS = {
  predicted: {
    label: "You (predicted)",
    short: "Predicted",
    cssVar: "--c-predicted",
    className: "text-predicted",
    description: "Where your client draws you right now, before the server confirms it.",
  },
  server: {
    label: "Server truth",
    short: "Authoritative",
    cssVar: "--c-server",
    className: "text-server",
    description: "The last position the server confirmed. The server owns the truth.",
  },
  remote: {
    label: "Other player",
    short: "Interpolated",
    cssVar: "--c-remote",
    className: "text-remote",
    description: "Other players are drawn 100 ms in the past, smoothly between two known snapshots.",
  },
  rollback: {
    label: "Correction",
    short: "Reconcile",
    cssVar: "--c-rollback",
    className: "text-rollback",
    description: "The server disagreed: rewind to its answer, then replay the inputs it has not seen yet.",
  },
  dropped: {
    label: "Dropped packet",
    short: "Dropped",
    cssVar: "--c-dropped",
    className: "text-dropped",
    description: "A message lost in transit. It never arrives.",
  },
} as const;

export type Concept = keyof typeof CONCEPTS;

export interface ConceptPalette {
  predicted: string;
  server: string;
  remote: string;
  rollback: string;
  dropped: string;
  ping: string;
  surface0: string;
  surface1: string;
  line: string;
  lineStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  fontSans: string;
  fontMono: string;
}

const FALLBACK: ConceptPalette = {
  predicted: "#3fd6ee",
  server: "#b6f04a",
  remote: "#b48cf2",
  rollback: "#f4b740",
  dropped: "#f0524a",
  ping: "#9aa3b2",
  surface0: "#0b0d11",
  surface1: "#11141a",
  line: "rgba(255,255,255,0.075)",
  lineStrong: "rgba(255,255,255,0.14)",
  text: "#f3f5f8",
  textMuted: "#a5adbb",
  textFaint: "#6f7786",
  fontSans: "ui-sans-serif, system-ui, sans-serif",
  fontMono: "ui-monospace, monospace",
};

let cached: ConceptPalette | null = null;

export function resolveConceptColors(): ConceptPalette {
  if (cached) {
    return cached;
  }
  if (typeof window === "undefined") {
    return FALLBACK;
  }
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  cached = {
    predicted: read("--c-predicted", FALLBACK.predicted),
    server: read("--c-server", FALLBACK.server),
    remote: read("--c-remote", FALLBACK.remote),
    rollback: read("--c-rollback", FALLBACK.rollback),
    dropped: read("--c-dropped", FALLBACK.dropped),
    ping: read("--c-ping", FALLBACK.ping),
    surface0: read("--surface-0", FALLBACK.surface0),
    surface1: read("--surface-1", FALLBACK.surface1),
    line: read("--line", FALLBACK.line),
    lineStrong: read("--line-strong", FALLBACK.lineStrong),
    text: read("--text", FALLBACK.text),
    textMuted: read("--text-muted", FALLBACK.textMuted),
    textFaint: read("--text-faint", FALLBACK.textFaint),
    fontSans: `${read("--font-geist-sans", "")}, ${FALLBACK.fontSans}`.replace(/^, /, ""),
    fontMono: `${read("--font-geist-mono", "")}, ${FALLBACK.fontMono}`.replace(/^, /, ""),
  };
  return cached;
}
