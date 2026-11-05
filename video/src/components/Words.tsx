import type { CSSProperties, ReactNode } from "react";
import { useCurrentFrame } from "remotion";

import { easeIn, easeOut, mix, progress } from "../anim";

type Props = {
  text: string;
  /** Frame (relative to the Sequence) when the first word starts rising. */
  start: number;
  stagger?: number;
  duration?: number;
  /** Frame when the whole line starts leaving. Omit to hold. */
  exit?: number;
  exitDuration?: number;
  style?: CSSProperties;
  /** Optional per-word color overrides by word index. */
  accent?: Record<number, string>;
  prefix?: ReactNode;
};

/**
 * Words rise into place with a soft blur, one after another, then leave
 * together. Motion uses the UI's ease-out curve, so the film moves like the app.
 */
export function Words({ text, start, stagger = 3, duration = 22, exit, exitDuration = 12, style, accent, prefix }: Props) {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const out = exit === undefined ? 0 : progress(frame, exit, exit + exitDuration, easeIn);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        columnGap: "0.25em",
        opacity: 1 - out,
        transform: `translateY(${mix(0, -0.18, out)}em)`,
        filter: out > 0 ? `blur(${out * 14}px)` : undefined,
        ...style,
      }}
    >
      {prefix}
      {words.map((word, index) => {
        const t = progress(frame, start + index * stagger, start + index * stagger + duration, easeOut);
        return (
          <span
            key={`${word}-${index}`}
            style={{
              display: "inline-block",
              opacity: t,
              transform: `translateY(${mix(0.42, 0, t)}em)`,
              filter: t < 1 ? `blur(${mix(16, 0, t)}px)` : undefined,
              color: accent?.[index],
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}
