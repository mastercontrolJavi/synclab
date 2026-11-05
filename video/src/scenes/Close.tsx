import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import { easeIn, easeOut, keyedRect, mix, progress } from "../anim";
import { FootageWindow } from "../components/FootageWindow";
import { LogoMark } from "../components/LogoMark";
import { Words } from "../components/Words";
import { color, font } from "../theme";

/** Local frame of the end card (cue "endcard" − cue "close"). */
export const ENDCARD_AT = 75;
const COMPARE_FROM = 330;

/**
 * 0:21–0:26. Hero shot: the whole lab settling out of a tilt while the camera
 * pulls back. Then the window falls away and the mark and name take the frame.
 */
export function Close() {
  const frame = useCurrentFrame();
  const settle = progress(frame, 0, 60, easeOut);
  const away = progress(frame, ENDCARD_AT - 14, ENDCARD_AT + 2, easeIn);
  const rect = { x: 400, y: 400, w: 1760, h: 990 };
  const crop = keyedRect(frame, [
    [0, { x: 100, y: 56, w: 1240, h: 697.5 }],
    [ENDCARD_AT, { x: 0, y: 0, w: 1440, h: 810 }],
  ]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", top: 168 }}>
        <Words
          text="Networking, made visible."
          start={2}
          stagger={4}
          exit={ENDCARD_AT - 12}
          accent={{ 2: color.predicted }}
          style={{ fontFamily: font.sans, fontSize: 150, fontWeight: 600, letterSpacing: "-0.045em", color: color.text, justifyContent: "center" }}
        />
      </AbsoluteFill>
      <FootageWindow
        src="footage/compare.mp4"
        trimBefore={COMPARE_FROM}
        rect={rect}
        crop={crop}
        opacity={progress(frame, 0, 14) * (1 - away)}
        glow={1.4}
        style={{
          transform: `perspective(2600px) rotateX(${mix(18, 0, settle)}deg) translateY(${mix(120, 0, settle) + away * 60}px) scale(${mix(1.05, 1, settle) * mix(1, 0.9, away)})`,
          transformOrigin: "50% 100%",
          filter: away > 0 ? `blur(${away * 20}px)` : undefined,
        }}
      />
      <Sequence from={ENDCARD_AT + 2} layout="none">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
}

function EndCard() {
  const frame = useCurrentFrame();
  const mark = progress(frame, 0, 30, easeOut);
  const glow = progress(frame, 0, 45, easeOut);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 1500,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, oklch(0.84 0.14 205 / 0.12), transparent)",
          opacity: glow,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: "translateY(-30px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
          <div
            style={{
              opacity: mark,
              transform: `scale(${mix(0.7, 1, mark)})`,
              filter: `drop-shadow(0 0 70px oklch(0.84 0.14 205 / ${0.5 * mark}))`,
            }}
          >
            <LogoMark size={210} ghostOffset={mix(2.2, 1, progress(frame, 4, 40, easeOut))} spin={-frame * 0.4} />
          </div>
          <Words
            text="SyncLab"
            start={4}
            duration={26}
            style={{ fontFamily: font.sans, fontSize: 236, fontWeight: 620, letterSpacing: "-0.05em", color: color.text }}
          />
        </div>
        <Words
          text="A multiplayer lab where the netcode is the game."
          start={16}
          stagger={1.6}
          style={{ marginTop: 56, fontFamily: font.sans, fontSize: 66, fontWeight: 430, letterSpacing: "-0.02em", color: color.textMuted, justifyContent: "center" }}
        />
      </div>
    </AbsoluteFill>
  );
}
