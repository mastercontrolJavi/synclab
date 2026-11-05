import { AbsoluteFill, useCurrentFrame } from "remotion";

import { alpha, color } from "../theme";

/**
 * The film's stage: SyncLab's near-black blue surface, the arena grid at a
 * whisper, and two slow light pools in the concept colors. `tint` shifts the
 * dominant pool so each act gets a quiet color temperature.
 */
export function Backdrop({ tint = color.predicted, gridOpacity = 1 }: { tint?: string; gridOpacity?: number }) {
  const frame = useCurrentFrame();
  const drift = frame * 0.35;
  return (
    <AbsoluteFill style={{ background: color.surface0, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: [
            `radial-gradient(1200px 820px at ${1880 + Math.sin(frame / 90) * 80}px 180px, ${alpha(tint, 0.1)}, transparent 70%)`,
            `radial-gradient(1100px 760px at ${560 + Math.cos(frame / 110) * 70}px 1320px, ${alpha(color.remote, 0.07)}, transparent 70%)`,
          ].join(", "),
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.55 * gridOpacity,
          backgroundImage: [
            `linear-gradient(${color.line} 2px, transparent 2px)`,
            `linear-gradient(90deg, ${color.line} 2px, transparent 2px)`,
          ].join(", "),
          backgroundSize: "96px 96px",
          backgroundPosition: `${-drift}px ${-drift * 0.4}px`,
          maskImage: "radial-gradient(ellipse 70% 65% at 50% 50%, black 10%, transparent 75%)",
        }}
      />
      {/* Vignette */}
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 85% 80% at 50% 45%, transparent 55%, oklch(0 0 0 / 55%) 100%)" }}
      />
    </AbsoluteFill>
  );
}
