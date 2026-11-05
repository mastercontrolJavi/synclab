import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import { type Rect, easeIn, easeOut, keyedNumber, mix, progress } from "../anim";
import { FootageWindow } from "../components/FootageWindow";
import { Words } from "../components/Words";
import track from "../tracks/single.json";
import { alpha, color, font } from "../theme";

/**
 * 0:08–0:16. One continuous take of the Single view on Mobile 3G (300 ms,
 * 80 ms jitter, 6% loss). The camera follows the action using a track built
 * from the footage itself (capture/track.py), so each concept is framed on
 * the thing it names, at the moment it really happens.
 */
const SINGLE_FROM = 30; // footage frame at this Sequence's frame 0

type Concept = {
  key: string;
  at: number; // local start frame
  index: string;
  eyebrow: string;
  title: string;
  body: string;
  tone: string;
  follow: "you" | "remote";
  zoom: number; // crop width in CSS px
};

export const CONCEPTS: Concept[] = [
  {
    key: "prediction",
    at: 0,
    index: "01",
    eyebrow: "Your client",
    title: "Prediction.",
    body: "You move the instant you press a key. No waiting for the server.",
    tone: color.predicted,
    follow: "you",
    zoom: 450,
  },
  {
    key: "reconciliation",
    at: 75,
    index: "02",
    eyebrow: "The server",
    title: "Reconciliation.",
    body: "When the server disagrees, your client snaps to its answer and replays your inputs.",
    tone: color.rollback,
    follow: "you",
    zoom: 400,
  },
  {
    key: "interpolation",
    at: 150,
    index: "03",
    eyebrow: "Other players",
    title: "Interpolation.",
    body: "Everyone else is drawn 100 ms in the past, smoothly, between real snapshots.",
    tone: color.remote,
    follow: "remote",
    zoom: 460,
  },
];
export const SYSTEM_AT = 210;
const END = 240;

const WINDOW: Rect = { x: 1060, y: 170, w: 1320, h: 1100 };
// Single-view arena + packet lane, in CSS px of the capture.
const BOUNDS = { x0: 212, y0: 118, x1: 896, y1: 604 };

function cropAround(cx: number, cy: number, w: number): Rect {
  const h = (w * WINDOW.h) / WINDOW.w;
  const x = Math.min(Math.max(cx - w / 2, BOUNDS.x0), BOUNDS.x1 - w);
  const y = Math.min(Math.max(cy - h / 2, BOUNDS.y0), BOUNDS.y1 - h);
  return { x, y, w, h };
}

function trackAt(kind: "you" | "remote", frame: number): [number, number] {
  const points = track[kind] as [number, number][];
  return points[Math.min(points.length - 1, Math.max(0, Math.round(frame)))];
}

function Rail({ frame }: { frame: number }) {
  return (
    <div style={{ position: "absolute", left: 180, top: 1046, display: "flex", flexDirection: "column", gap: 22 }}>
      {CONCEPTS.map((concept, i) => {
        const next = CONCEPTS[i + 1]?.at ?? SYSTEM_AT;
        const active = frame >= concept.at && frame < next;
        const lit = Math.max(
          progress(frame, concept.at, concept.at + 10) * (1 - progress(frame, next, next + 10)),
          progress(frame, SYSTEM_AT, SYSTEM_AT + 12),
        );
        return (
          <div key={concept.key} style={{ display: "flex", alignItems: "center", gap: 22, opacity: mix(0.34, 1, lit) }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: concept.tone,
                boxShadow: active || lit > 0.5 ? `0 0 24px ${alpha(concept.tone, 0.7)}` : "none",
              }}
            />
            <div style={{ fontFamily: font.mono, fontSize: 38, letterSpacing: "0.02em", color: lit > 0.5 ? color.text : color.textMuted }}>
              {concept.title.replace(".", "")}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Concepts() {
  const frame = useCurrentFrame();
  const enter = progress(frame, 0, 22, easeOut);
  const exit = progress(frame, END - 10, END, easeIn);

  // Camera: which subject, how wide. Eased between concepts (18 frames).
  const followRemote = keyedNumber(frame, [
    [CONCEPTS[2].at - 9, 0],
    [CONCEPTS[2].at + 9, 1],
  ]);
  const zoom = keyedNumber(frame, [
    [0, 560],
    [24, CONCEPTS[0].zoom],
    [CONCEPTS[1].at - 9, CONCEPTS[0].zoom],
    [CONCEPTS[1].at + 9, CONCEPTS[1].zoom],
    [CONCEPTS[2].at - 9, CONCEPTS[1].zoom],
    [CONCEPTS[2].at + 9, CONCEPTS[2].zoom],
    [SYSTEM_AT, CONCEPTS[2].zoom],
    [SYSTEM_AT + 24, 684],
  ]);
  const clipFrame = frame + SINGLE_FROM;
  const [yx, yy] = trackAt("you", clipFrame);
  const [rx, ry] = trackAt("remote", clipFrame);
  const toCenter = keyedNumber(frame, [
    [SYSTEM_AT, 0],
    [SYSTEM_AT + 24, 1],
  ]);
  const cx = mix(mix(yx, rx, followRemote), (BOUNDS.x0 + BOUNDS.x1) / 2, toCenter);
  const cy = mix(mix(yy, ry, followRemote), (BOUNDS.y0 + BOUNDS.y1) / 2, toCenter);
  const crop = cropAround(cx, cy, zoom);

  return (
    <AbsoluteFill style={{ opacity: 1 - exit }}>
      {CONCEPTS.map((concept, i) => {
        const end = CONCEPTS[i + 1]?.at ?? SYSTEM_AT;
        return (
          <Sequence key={concept.key} from={concept.at} durationInFrames={end - concept.at + 2} layout="none">
            <ConceptCopy concept={concept} duration={end - concept.at} />
          </Sequence>
        );
      })}
      <Sequence from={SYSTEM_AT} layout="none">
        <SystemCopy />
      </Sequence>
      <Rail frame={frame} />

      <FootageWindow
        src="footage/single.mp4"
        trimBefore={SINGLE_FROM}
        rect={WINDOW}
        crop={crop}
        opacity={enter}
        style={{
          transform: `translateX(${mix(140, 0, enter)}px) scale(${mix(0.96, 1, enter)})`,
          filter: enter < 1 ? `blur(${mix(16, 0, enter)}px)` : undefined,
        }}
      />
      {/* Concept-colored hairline on the window, so the frame carries the idea */}
      <ToneEdge frame={frame} enter={enter} />
    </AbsoluteFill>
  );
}

function ToneEdge({ frame, enter }: { frame: number; enter: number }) {
  const current = [...CONCEPTS].reverse().find((c) => frame >= c.at) ?? CONCEPTS[0];
  const pulse = 1 - progress(frame, current.at, current.at + 24);
  return (
    <div
      style={{
        position: "absolute",
        left: WINDOW.x,
        top: WINDOW.y,
        width: WINDOW.w,
        height: WINDOW.h,
        borderRadius: 28,
        opacity: enter * (frame >= SYSTEM_AT ? 0.35 : 1),
        boxShadow: `0 0 0 2px ${alpha(current.tone, 0.35 + 0.4 * pulse)}, 0 0 ${80 + 60 * pulse}px -30px ${alpha(current.tone, 0.6)}`,
        pointerEvents: "none",
      }}
    />
  );
}

function ConceptCopy({ concept, duration }: { concept: Concept; duration: number }) {
  const frame = useCurrentFrame();
  const exitAt = duration - 9;
  const dot = progress(frame, 0, 14, easeOut) * (1 - progress(frame, exitAt, exitAt + 9, easeIn));
  return (
    <div style={{ position: "absolute", left: 180, top: 300, width: 800 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontFamily: font.mono,
          fontSize: 34,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: concept.tone,
          opacity: dot,
          marginBottom: 30,
        }}
      >
        <span>{concept.index}</span>
        <span style={{ width: 48, height: 2, background: alpha(concept.tone, 0.6) }} />
        <span style={{ color: color.textMuted }}>{concept.eyebrow}</span>
      </div>
      <Words
        text={concept.title}
        start={2}
        exit={exitAt}
        exitDuration={9}
        style={{ fontFamily: font.sans, fontSize: 124, fontWeight: 600, letterSpacing: "-0.045em", color: color.text, lineHeight: 1 }}
      />
      <Words
        text={concept.body}
        start={8}
        stagger={1.2}
        duration={18}
        exit={exitAt}
        exitDuration={9}
        style={{ marginTop: 44, fontFamily: font.sans, fontSize: 54, fontWeight: 420, lineHeight: 1.28, letterSpacing: "-0.015em", color: color.textMuted, columnGap: "0.26em" }}
      />
    </div>
  );
}

function SystemCopy() {
  return (
    <div style={{ position: "absolute", left: 180, top: 300, width: 820 }}>
      <Words
        text="One system,"
        start={0}
        style={{ fontFamily: font.sans, fontSize: 124, fontWeight: 600, letterSpacing: "-0.045em", color: color.text, lineHeight: 1.04 }}
      />
      <Words
        text="running live."
        start={4}
        style={{ fontFamily: font.sans, fontSize: 124, fontWeight: 600, letterSpacing: "-0.045em", color: color.textMuted, lineHeight: 1.04 }}
      />
    </div>
  );
}
