import type { CSSProperties } from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

import type { Rect } from "../anim";
import { alpha, color } from "../theme";

/** Capture viewport in CSS px; every crop is expressed in this space. */
export const SOURCE = { w: 1440, h: 810 } as const;

type Props = {
  src: string;
  /** First footage frame shown when this window's Sequence starts. */
  trimBefore: number;
  /** Window rectangle on the 2560x1440 canvas. */
  rect: Rect;
  /** Region of the app (CSS px of the 1440x810 capture) shown in the window. */
  crop: Rect;
  radius?: number;
  opacity?: number;
  glow?: number;
  style?: CSSProperties;
};

/**
 * A framed window onto real footage. Animating `rect` moves the window;
 * animating `crop` moves the camera inside it. The crop is fit with "cover",
 * so a crop of any aspect fills the window without distortion.
 */
export function FootageWindow({ src, trimBefore, rect, crop, radius = 28, opacity = 1, glow = 1, style }: Props) {
  const scale = Math.max(rect.w / crop.w, rect.h / crop.h);
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  const left = rect.w / 2 - cx * scale;
  const top = rect.h / 2 - cy * scale;
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        borderRadius: radius,
        overflow: "hidden",
        opacity,
        background: color.surface0,
        boxShadow: [
          `0 0 0 2px ${color.lineStrong}`,
          `0 60px 140px -40px oklch(0 0 0 / ${0.85 * glow})`,
          `0 0 160px -60px ${alpha(color.predicted, 0.35 * glow)}`,
        ].join(", "),
        ...style,
      }}
    >
      <OffthreadVideo
        src={staticFile(src)}
        trimBefore={trimBefore}
        muted
        style={{
          position: "absolute",
          left,
          top,
          width: SOURCE.w * scale,
          height: SOURCE.h * scale,
          maxWidth: "none",
        }}
      />
      {/* Hairline glass edge */}
      <AbsoluteFill
        style={{
          borderRadius: radius,
          boxShadow: "inset 0 1px 0 oklch(1 0 0 / 8%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
