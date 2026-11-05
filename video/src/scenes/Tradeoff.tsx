import { AbsoluteFill, useCurrentFrame } from "remotion";

import { type Rect, easeIn, easeOut, keyedRect, mix, progress } from "../anim";
import { FootageWindow } from "../components/FootageWindow";
import { Words } from "../components/Words";
import { alpha, color, font } from "../theme";

/**
 * 0:16–0:21. One continuous take. The app starts on Perfect LAN; at local
 * frame 45 (0:17.5) the Chaos preset is pressed (key 4) and the real sliders
 * glide to 400 ms / 100 ms / 15%. Then the camera reframes onto both panes,
 * which share that same simulated network: naive on the left, predicted +
 * reconciled on the right.
 */
const TRADEOFF_FROM = 30; // footage frame at local 0; the key press is footage frame 75
export const PRESS_AT = 45;
const REFRAME_AT = 75;

const DOCK_WINDOW: Rect = { x: 1180, y: 170, w: 1200, h: 1100 };
const DOCK_CROP: Rect = { x: 1104, y: 64, w: 328, h: 301 };
const PANES_WINDOW: Rect = { x: 180, y: 372, w: 2200, h: 930 };
const PANES_CROP: Rect = { x: 6, y: 64, w: 1096, h: 463 };

function Condition({ label, detail, tone, t }: { label: string; detail: string; tone: string; t: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        display: "flex",
        alignItems: "center",
        gap: 22,
        opacity: t,
        transform: `translateY(${mix(24, 0, t)}px)`,
        fontFamily: font.mono,
        fontSize: 40,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: tone, boxShadow: `0 0 22px ${alpha(tone, 0.7)}` }} />
      <span style={{ color: color.text }}>{label}</span>
      <span style={{ color: color.textFaint }}>{detail}</span>
    </div>
  );
}

export function Tradeoff() {
  const frame = useCurrentFrame();
  const enter = progress(frame, 0, 20, easeOut);
  const leftOut = progress(frame, REFRAME_AT - 8, REFRAME_AT + 4, easeIn);
  const exit = progress(frame, 140, 150, easeIn);
  const before = progress(frame, 6, 22) * (1 - progress(frame, PRESS_AT, PRESS_AT + 8, easeIn));
  const after = progress(frame, PRESS_AT + 4, PRESS_AT + 18);

  const rect = keyedRect(frame, [
    [REFRAME_AT - 4, DOCK_WINDOW],
    [REFRAME_AT + 22, PANES_WINDOW],
  ]);
  const crop = keyedRect(frame, [
    [0, { ...DOCK_CROP, x: DOCK_CROP.x + 10, y: DOCK_CROP.y + 8, w: DOCK_CROP.w - 24, h: DOCK_CROP.h - 22 }],
    [REFRAME_AT - 4, DOCK_CROP],
    [REFRAME_AT + 22, PANES_CROP],
    [150, { x: PANES_CROP.x + 14, y: PANES_CROP.y + 6, w: PANES_CROP.w - 28, h: PANES_CROP.h - 12 }],
  ]);

  return (
    <AbsoluteFill style={{ opacity: 1 - exit }}>
      {/* Shot A copy */}
      <div style={{ position: "absolute", left: 180, top: 300, width: 900, opacity: 1 - leftOut }}>
        <Words
          text="Change the conditions."
          start={2}
          stagger={3}
          style={{ fontFamily: font.sans, fontSize: 150, fontWeight: 600, letterSpacing: "-0.045em", color: color.text, lineHeight: 1.02 }}
        />
        <div style={{ position: "relative", marginTop: 70, height: 60 }}>
          <Condition label="Perfect LAN" detail="10 ms · 0% loss" tone={color.server} t={before} />
          <Condition label="Chaos" detail="400 ms · 15% loss" tone={color.dropped} t={after} />
        </div>
      </div>

      {/* Shot B copy */}
      <div style={{ position: "absolute", left: 180, top: 150, width: 2200, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Words
          text="See the difference."
          start={REFRAME_AT + 2}
          stagger={3}
          style={{ fontFamily: font.sans, fontSize: 140, fontWeight: 600, letterSpacing: "-0.045em", color: color.text, lineHeight: 1 }}
        />
        <div
          style={{
            opacity: progress(frame, REFRAME_AT + 14, REFRAME_AT + 30),
            fontFamily: font.mono,
            fontSize: 36,
            color: color.textMuted,
            paddingBottom: 18,
            display: "flex",
            gap: 18,
            alignItems: "center",
          }}
        >
          <span style={{ width: 18, height: 18, borderRadius: "50%", background: color.dropped }} />
          Same network for both · 400 ms · 15% loss
        </div>
      </div>

      <FootageWindow
        src="footage/tradeoff.mp4"
        trimBefore={TRADEOFF_FROM}
        rect={rect}
        crop={crop}
        opacity={enter}
        style={{
          transform: `translateY(${mix(80, 0, enter)}px)`,
          filter: enter < 1 ? `blur(${mix(16, 0, enter)}px)` : undefined,
        }}
      />
      {/* Keypress ring on the Chaos preset, from the real press frame */}
      <PressRing frame={frame} />
    </AbsoluteFill>
  );
}

function PressRing({ frame }: { frame: number }) {
  const t = progress(frame, PRESS_AT, PRESS_AT + 22, easeOut);
  if (frame < PRESS_AT || t >= 1) return null;
  // Chaos button center in CSS px of the capture (dock second row, right column).
  const scale = DOCK_WINDOW.w / DOCK_CROP.w;
  const cx = DOCK_WINDOW.x + (1340 - DOCK_CROP.x) * scale;
  const cy = DOCK_WINDOW.y + (173 - DOCK_CROP.y) * scale;
  const r = mix(40, 260, t);
  return (
    <div
      style={{
        position: "absolute",
        left: cx - r,
        top: cy - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        border: `4px solid ${alpha(color.dropped, 0.9 * (1 - t))}`,
        pointerEvents: "none",
      }}
    />
  );
}
