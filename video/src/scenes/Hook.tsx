import { AbsoluteFill, useCurrentFrame } from "remotion";

import { easeIn, easeInOut, mix, progress } from "../anim";
import { Words } from "../components/Words";
import { alpha, color, font } from "../theme";

/**
 * 0:00–0:04. Two players on a quiet grid: "what you see". Then the network
 * behind them draws in, in the app's packet-lane language: cyan inputs go up
 * to the server, lime snapshots come back, one packet is lost in red.
 * Packet arrivals land on 1.5 / 2.0 / 2.5 / 3.0 s, where the score's blips sit.
 */
type Point = { x: number; y: number };

const YOU: Point = { x: 800, y: 1010 };
const SERVER: Point = { x: 1280, y: 1190 };
const OTHER: Point = { x: 1760, y: 1010 };

// Quadratic paths between nodes; control points bow the lines downward.
const PATHS = {
  youToServer: [YOU, { x: 960, y: 1210 }, SERVER],
  serverToOther: [SERVER, { x: 1600, y: 1210 }, OTHER],
} as const;

type Packet = { start: number; path: keyof typeof PATHS; reverse?: boolean; tone: string; dropAt?: number };

const TRAVEL = 16;
const PACKETS: Packet[] = [
  { start: 29, path: "youToServer", tone: color.predicted },
  { start: 36, path: "serverToOther", tone: color.server, reverse: false },
  { start: 44, path: "youToServer", reverse: true, tone: color.server },
  { start: 50, path: "youToServer", tone: color.predicted, dropAt: 0.55 },
  { start: 59, path: "serverToOther", tone: color.server },
  { start: 66, path: "youToServer", tone: color.predicted },
  { start: 74, path: "serverToOther", reverse: true, tone: color.remote },
  { start: 82, path: "youToServer", reverse: true, tone: color.server },
  { start: 88, path: "youToServer", tone: color.predicted },
  { start: 92, path: "serverToOther", tone: color.server },
];

function bezier([a, c, b]: readonly Point[], t: number): Point {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

function Disc({ at, tone, size, label, ring }: { at: Point; tone: string; size: number; label: string; ring?: boolean }) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: at.x - size / 2,
          top: at.y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          background: ring ? "transparent" : tone,
          border: ring ? `5px dashed ${tone}` : undefined,
          boxShadow: ring ? `0 0 40px ${alpha(tone, 0.25)}` : `0 0 60px ${alpha(tone, 0.55)}`,
          boxSizing: "border-box",
        }}
      >
        {!ring && (
          <div
            style={{
              position: "absolute",
              inset: size * 0.35,
              borderRadius: "50%",
              background: color.surface0,
            }}
          />
        )}
      </div>
      <div
        style={{
          position: "absolute",
          left: at.x - 300,
          width: 600,
          top: at.y + size / 2 + 22,
          textAlign: "center",
          fontFamily: font.mono,
          fontSize: 30,
          letterSpacing: "0.12em",
          color: tone,
        }}
      >
        {label}
      </div>
    </>
  );
}

export function Hook() {
  const frame = useCurrentFrame();
  const players = progress(frame, 6, 30);
  const network = progress(frame, 34, 58, easeInOut);
  const exit = progress(frame, 100, 120, easeIn);
  const wobble = (seed: number) => ({ x: Math.sin(frame / 17 + seed) * 10, y: Math.cos(frame / 23 + seed) * 6 });
  const you = { x: YOU.x + wobble(0).x, y: YOU.y + wobble(0).y };
  const other = { x: OTHER.x + wobble(2).x, y: OTHER.y + wobble(2).y };

  return (
    <AbsoluteFill
      style={{
        opacity: 1 - exit,
        transform: `scale(${mix(1, 1.08, exit)})`,
        filter: exit > 0 ? `blur(${exit * 18}px)` : undefined,
      }}
    >
      <AbsoluteFill style={{ alignItems: "center", top: 330 }}>
        <Words
          text="Multiplayer is more"
          start={8}
          stagger={4}
          style={{ fontFamily: font.sans, fontSize: 156, fontWeight: 560, letterSpacing: "-0.04em", color: color.text, lineHeight: 1.05, justifyContent: "center" }}
        />
        <Words
          text="than what you see."
          start={20}
          stagger={4}
          style={{ fontFamily: font.sans, fontSize: 156, fontWeight: 560, letterSpacing: "-0.04em", color: color.textMuted, lineHeight: 1.05, justifyContent: "center" }}
        />
      </AbsoluteFill>

      {/* The network behind the game */}
      <svg width={2560} height={1440} style={{ position: "absolute", inset: 0, opacity: network }}>
        {Object.entries(PATHS).map(([key, [a, c, b]]) => (
          <path
            key={key}
            d={`M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`}
            fill="none"
            stroke="oklch(1 0 0 / 24%)"
            strokeWidth={4}
            strokeDasharray="6 12"
            pathLength={1000}
            strokeDashoffset={-frame * 2}
          />
        ))}
        {PACKETS.map((packet, index) => {
          const t = (frame - packet.start) / TRAVEL;
          if (t < 0 || t > 1.6) return null;
          const path = PATHS[packet.path];
          if (packet.dropAt !== undefined && t > packet.dropAt) {
            // Lost: stop, fall a little, burst red.
            const fall = Math.min(1, (t - packet.dropAt) / 0.6);
            const p = bezier(path, packet.dropAt);
            return (
              <g key={index} opacity={1 - fall}>
                <circle cx={p.x} cy={p.y + fall * 60} r={10} fill={color.dropped} />
                <circle cx={p.x} cy={p.y + fall * 60} r={10 + fall * 46} fill="none" stroke={color.dropped} strokeWidth={4} />
              </g>
            );
          }
          if (t > 1) return null;
          const p = bezier(path, packet.reverse ? 1 - t : t);
          return (
            <g key={index}>
              <circle cx={p.x} cy={p.y} r={24} fill={alpha(packet.tone, 0.16)} />
              <circle cx={p.x} cy={p.y} r={10} fill={packet.tone} />
            </g>
          );
        })}
      </svg>

      <div style={{ opacity: players }}>
        <Disc at={you} tone={color.predicted} size={84} label="YOU" />
        <Disc at={other} tone={color.remote} size={84} label="OTHER PLAYER" />
      </div>
      <div style={{ opacity: network, transform: `translateY(${mix(30, 0, network)}px)` }}>
        <Disc at={SERVER} tone={color.server} size={72} label="SERVER" ring />
      </div>
    </AbsoluteFill>
  );
}
