import {
  PLAYER_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Vector2,
} from "@synclab/shared";

import type { RenderFrame, RenderPlayer } from "./types";

interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function toCanvas(point: Vector2, transform: ViewportTransform): Vector2 {
  return {
    x: transform.offsetX + point.x * transform.scale,
    y: transform.offsetY + point.y * transform.scale,
  };
}

function drawGrid(
  context: CanvasRenderingContext2D,
  transform: ViewportTransform,
): void {
  const topLeft = toCanvas({ x: 0, y: 0 }, transform);
  const bottomRight = toCanvas({ x: WORLD_WIDTH, y: WORLD_HEIGHT }, transform);
  context.fillStyle = "#0d0f12";
  context.fillRect(
    topLeft.x,
    topLeft.y,
    bottomRight.x - topLeft.x,
    bottomRight.y - topLeft.y,
  );

  context.strokeStyle = "rgba(255, 255, 255, 0.035)";
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0; x <= WORLD_WIDTH; x += 60) {
    const point = toCanvas({ x, y: 0 }, transform);
    context.moveTo(Math.round(point.x) + 0.5, topLeft.y);
    context.lineTo(Math.round(point.x) + 0.5, bottomRight.y);
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += 60) {
    const point = toCanvas({ x: 0, y }, transform);
    context.moveTo(topLeft.x, Math.round(point.y) + 0.5);
    context.lineTo(bottomRight.x, Math.round(point.y) + 0.5);
  }
  context.stroke();

  context.strokeStyle = "rgba(255, 255, 255, 0.16)";
  context.strokeRect(
    Math.round(topLeft.x) + 0.5,
    Math.round(topLeft.y) + 0.5,
    Math.round(bottomRight.x - topLeft.x) - 1,
    Math.round(bottomRight.y - topLeft.y) - 1,
  );
}

function drawPlayer(
  context: CanvasRenderingContext2D,
  player: RenderPlayer,
  transform: ViewportTransform,
): void {
  const point = toCanvas(player, transform);
  const radius = PLAYER_RADIUS * transform.scale;
  const color = player.isLocal ? "#6ee7b7" : "#a78bfa";

  if (player.isIt) {
    context.beginPath();
    context.arc(point.x, point.y, radius + 7, 0, Math.PI * 2);
    context.strokeStyle = "rgba(251, 191, 36, 0.78)";
    context.lineWidth = 2;
    context.stroke();
  }

  context.save();
  context.shadowBlur = 16;
  context.shadowColor = `${color}35`;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.restore();

  context.beginPath();
  context.arc(point.x, point.y, Math.max(3, radius * 0.25), 0, Math.PI * 2);
  context.fillStyle = "rgba(10, 12, 15, 0.72)";
  context.fill();

  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.font = "600 10px Geist, ui-sans-serif, system-ui";
  context.fillStyle = "rgba(244, 244, 245, 0.82)";
  const label = player.isLocal ? "YOU" : player.isScripted ? "SCRIPTED" : "PEER";
  context.fillText(label, point.x, point.y - radius - 11);

  if (player.isIt) {
    context.font = "600 9px 'Geist Mono', ui-monospace, monospace";
    context.fillStyle = "#fbbf24";
    context.fillText("IT", point.x, point.y + radius + 21);
  }
}

function drawMarker(
  context: CanvasRenderingContext2D,
  position: Vector2,
  transform: ViewportTransform,
  color: string,
  label: string,
  radius: number,
): void {
  const point = toCanvas(position, transform);
  context.save();
  context.setLineDash([3, 3]);
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = color;
  context.font = "9px 'Geist Mono', ui-monospace, monospace";
  context.textAlign = "left";
  context.fillText(label, point.x + radius + 4, point.y - radius);
  context.restore();
}

export function renderArena(
  canvas: HTMLCanvasElement,
  frame: RenderFrame,
  debug: boolean,
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
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);

  const inset = 18;
  const scale = Math.min(
    (bounds.width - inset * 2) / WORLD_WIDTH,
    (bounds.height - inset * 2) / WORLD_HEIGHT,
  );
  const transform: ViewportTransform = {
    scale,
    offsetX: (bounds.width - WORLD_WIDTH * scale) / 2,
    offsetY: (bounds.height - WORLD_HEIGHT * scale) / 2,
  };

  drawGrid(context, transform);
  for (const player of frame.players) {
    drawPlayer(context, player, transform);
  }

  if (debug) {
    if (frame.localAuthoritative) {
      drawMarker(context, frame.localAuthoritative, transform, "#22d3ee", "AUTH", 8);
    }
    if (frame.localPredicted) {
      drawMarker(context, frame.localPredicted, transform, "#f472b6", "PRED", 11);
    }
    if (frame.localRendered) {
      drawMarker(context, frame.localRendered, transform, "#f4f4f5", "RENDER", 14);
    }
    for (const position of frame.remoteSnapshotPositions) {
      drawMarker(context, position, transform, "#a78bfa", "SNAP", 7);
    }
  }
}
