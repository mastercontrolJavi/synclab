import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import { easeIn, easeOut, keyedRect, mix, progress } from "../anim";
import { FootageWindow } from "../components/FootageWindow";
import { LogoMark } from "../components/LogoMark";
import { Words } from "../components/Words";
import { color, font } from "../theme";

/** Local frame where the window and the second line arrive (cue "lab" − cue "meet"). */
export const LAB_AT = 52;
/** Compare footage frame shown when the window arrives: sparklines already full. */
const COMPARE_FROM = 120;

/**
 * 0:04–0:08. Impact on the mark and the name, then the real lab rises in:
 * Compare view, the default Bad Wi-Fi conditions, a player being driven.
 */
export function Meet() {
  const frame = useCurrentFrame();
  const mark = progress(frame, 0, 26, easeOut);
  const nameOut = progress(frame, LAB_AT - 8, LAB_AT + 6, easeIn);
  const rise = progress(frame, LAB_AT - 6, LAB_AT + 26, easeOut);
  const exit = progress(frame, 112, 122, easeIn);

  const rect = { x: 340, y: mix(620, 360, rise), w: 1880, h: 1057.5 };
  const crop = keyedRect(frame, [
    [LAB_AT - 6, { x: 0, y: 0, w: 1440, h: 810 }],
    [120, { x: 22, y: 12, w: 1396, h: 785 }],
  ]);

  return (
    <AbsoluteFill>
      {/* Mark + name */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          opacity: 1 - nameOut,
          filter: nameOut > 0 ? `blur(${nameOut * 16}px)` : undefined,
          transform: `translateY(${mix(0, -80, nameOut)}px) scale(${mix(1.04, 1, mark)})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 64 }}>
          <div
            style={{
              opacity: mark,
              transform: `scale(${mix(0.6, 1, mark)}) rotate(${mix(-12, 0, mark)}deg)`,
              filter: `drop-shadow(0 0 60px oklch(0.84 0.14 205 / ${0.45 * mark}))`,
            }}
          >
            <LogoMark size={196} ghostOffset={mix(1.9, 1, mark)} spin={-frame * 0.4} />
          </div>
          <Words
            text="Meet SyncLab."
            start={3}
            stagger={5}
            style={{ fontFamily: font.sans, fontSize: 210, fontWeight: 600, letterSpacing: "-0.045em", color: color.text }}
            accent={{ 0: color.textMuted }}
          />
        </div>
      </AbsoluteFill>

      {/* Second line, above the window */}
      <AbsoluteFill style={{ alignItems: "center", top: 168, opacity: 1 - exit }}>
        <Words
          text="A multiplayer networking lab."
          start={LAB_AT}
          stagger={3}
          style={{ fontFamily: font.sans, fontSize: 92, fontWeight: 520, letterSpacing: "-0.03em", color: color.text, justifyContent: "center" }}
        />
      </AbsoluteFill>

      <Sequence from={LAB_AT - 6} layout="none">
        <FootageWindow
          src="footage/compare.mp4"
          trimBefore={COMPARE_FROM}
          rect={rect}
          crop={crop}
          opacity={rise * (1 - exit)}
          style={{
            transform: `perspective(2400px) rotateX(${mix(14, 0, rise)}deg) scale(${mix(0.94, 1, rise) * mix(1, 0.97, exit)})`,
            transformOrigin: "50% 0%",
            filter: rise < 1 ? `blur(${mix(18, 0, rise)}px)` : exit > 0 ? `blur(${exit * 12}px)` : undefined,
          }}
        />
      </Sequence>
    </AbsoluteFill>
  );
}
