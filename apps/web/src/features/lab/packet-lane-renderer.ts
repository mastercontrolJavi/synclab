import { resolveConceptColors } from "@/lib/concepts";

import type { ClientTelemetry, PacketFlight } from "./types";

const NODE_INSET = 64;
const DROP_POINT = 0.55;
const FALL_MS = 420;
/** Below this a dot would teleport; clamp so 0 ms still reads as a blip. */
const MIN_VISUAL_DELAY_MS = 60;

/**
 * Draws the client⇄server lane. Dot position is a pure function of the
 * packet's real scheduled delay, so a 300 ms RTT is visibly twice as slow
 * as 150 ms. Drops fall out of the lane with a red burst.
 */
export function renderPacketLane(
  canvas: HTMLCanvasElement,
  telemetry: ClientTelemetry | null,
  now: number,
  reducedMotion: boolean,
): void {
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) {
    return;
  }
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(bounds.width * pixelRatio);
  const pixelHeight = Math.round(bounds.height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const palette = resolveConceptColors();
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);

  const left = NODE_INSET;
  const right = bounds.width - NODE_INSET;
  const outboundY = Math.round(bounds.height * 0.32) + 0.5;
  const inboundY = Math.round(bounds.height * 0.68) + 0.5;

  // Rails.
  context.strokeStyle = palette.line;
  context.lineWidth = 1;
  context.setLineDash([2, 4]);
  context.beginPath();
  context.moveTo(left, outboundY);
  context.lineTo(right, outboundY);
  context.moveTo(left, inboundY);
  context.lineTo(right, inboundY);
  context.stroke();
  context.setLineDash([]);

  // Endpoints.
  for (const [x, color] of [
    [left, palette.predicted],
    [right, palette.server],
  ] as const) {
    context.fillStyle = color;
    context.globalAlpha = 0.9;
    context.fillRect(x - 1, outboundY - 6, 2, inboundY - outboundY + 12);
    context.globalAlpha = 1;
  }

  if (!telemetry) {
    return;
  }

  for (const packet of telemetry.packets) {
    drawPacket(context, packet, now, { left, right, outboundY, inboundY }, palette, reducedMotion);
  }
}

interface LaneGeometry {
  left: number;
  right: number;
  outboundY: number;
  inboundY: number;
}

function drawPacket(
  context: CanvasRenderingContext2D,
  packet: PacketFlight,
  now: number,
  lane: LaneGeometry,
  palette: ReturnType<typeof resolveConceptColors>,
  reducedMotion: boolean,
): void {
  const duration = Math.max(packet.delayMs, MIN_VISUAL_DELAY_MS);
  const elapsed = now - packet.sentAt;
  const progress = elapsed / duration;
  const outbound = packet.direction === "outbound";
  const y = outbound ? lane.outboundY : lane.inboundY;
  const xAt = (t: number) =>
    outbound ? lane.left + (lane.right - lane.left) * t : lane.right - (lane.right - lane.left) * t;

  const color =
    packet.kind === "input"
      ? palette.predicted
      : packet.kind === "snapshot"
        ? palette.server
        : palette.ping;
  const radius = packet.kind === "snapshot" ? 3 : packet.kind === "input" ? 2.5 : 2;

  if (packet.dropped) {
    if (progress < DROP_POINT) {
      dot(context, xAt(progress), y, radius, color, 1);
      return;
    }
    const fallElapsed = elapsed - duration * DROP_POINT;
    if (fallElapsed > FALL_MS) {
      return;
    }
    const t = fallElapsed / FALL_MS;
    const x = xAt(DROP_POINT);
    // Red burst at the point of loss.
    context.save();
    context.strokeStyle = palette.dropped;
    context.globalAlpha = 1 - t;
    context.lineWidth = 1.5;
    const burst = reducedMotion ? 5 : 4 + t * 9;
    context.beginPath();
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2 + 0.3;
      context.moveTo(x + Math.cos(angle) * (burst * 0.4), y + Math.sin(angle) * (burst * 0.4));
      context.lineTo(x + Math.cos(angle) * burst, y + Math.sin(angle) * burst);
    }
    context.stroke();
    context.restore();
    // The packet itself falls out of the lane.
    const fall = reducedMotion ? 0 : t * t * 22;
    dot(context, x, y + fall, radius, palette.dropped, 1 - t);
    return;
  }

  if (progress <= 1) {
    dot(context, xAt(progress), y, radius, color, 1);
    return;
  }
  // Arrival pulse at the receiving node.
  const arrived = elapsed - duration;
  if (arrived < 180 && packet.kind !== "ping") {
    const t = arrived / 180;
    context.save();
    context.globalAlpha = (1 - t) * 0.7;
    context.strokeStyle = color;
    context.beginPath();
    context.arc(xAt(1), y, radius + t * 6, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}

function dot(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  // A translucent halo instead of shadowBlur: same glow, a fraction of the cost.
  context.save();
  context.fillStyle = color;
  context.globalAlpha = Math.max(0, alpha) * 0.22;
  context.beginPath();
  context.arc(x, y, radius * 2.4, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = Math.max(0, alpha);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}
