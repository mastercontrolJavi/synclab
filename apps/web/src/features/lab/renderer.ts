import {
  PLAYER_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Vector2,
} from "@synclab/shared";

import { resolveConceptColors, type ConceptPalette } from "@/lib/concepts";
import { DURATION, EASE, gsap } from "@/lib/motion";

import type {
  ClientTelemetry,
  CorrectionRecord,
  RenderFrame,
  RenderPlayer,
} from "./types";

export interface ArenaVisuals {
  /** Server-authoritative ghost, input ghost and raw snapshot markers. */
  ghosts: boolean;
  /** Re-simulated input path on reconciliation. */
  trail: boolean;
  reducedMotion: boolean;
}

export interface ArenaExtras {
  /** Where pending input would put you; shown only when prediction is off. */
  inputPreview: Vector2 | null;
  predictionEnabled: boolean;
}

interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * A short-lived correction overlay. GSAP tweens only these scalar fields
 * (alpha, ring, trail). Entity positions always come from the sim loop.
 */
interface CorrectionEffect {
  record: CorrectionRecord;
  flash: number;
  ring: number;
  trail: number;
  label: number;
  tween: gsap.core.Timeline;
}

interface LabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_EFFECTS = 4;
const MIN_VISIBLE_CORRECTION = 1;

function toCanvas(point: Vector2, transform: ViewportTransform): Vector2 {
  return {
    x: transform.offsetX + point.x * transform.scale,
    y: transform.offsetY + point.y * transform.scale,
  };
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export class ArenaRenderer {
  private readonly effects = new Map<number, CorrectionEffect>();
  private lastCorrectionId = -1;
  private palette: ConceptPalette = resolveConceptColors();
  private labels: LabelBox[] = [];
  private bounds = { width: 0, height: 0 };

  constructor(private readonly canvas: HTMLCanvasElement) {}

  destroy(): void {
    for (const effect of this.effects.values()) {
      effect.tween.kill();
    }
    this.effects.clear();
  }

  render(
    frame: RenderFrame,
    telemetry: ClientTelemetry | null,
    visuals: ArenaVisuals,
    extras: ArenaExtras,
  ): void {
    const canvas = this.canvas;
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
    this.palette = resolveConceptColors();
    this.bounds = { width: bounds.width, height: bounds.height };
    this.labels = [];
    this.reservedNames.clear();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);

    const inset = Math.max(10, Math.min(20, bounds.width * 0.02));
    const scale = Math.min(
      (bounds.width - inset * 2) / WORLD_WIDTH,
      (bounds.height - inset * 2) / WORLD_HEIGHT,
    );
    const transform: ViewportTransform = {
      scale,
      offsetX: (bounds.width - WORLD_WIDTH * scale) / 2,
      offsetY: (bounds.height - WORLD_HEIGHT * scale) / 2,
    };

    this.drawField(context, transform);
    if (telemetry) {
      this.syncEffects(telemetry, visuals);
    }

    const local = frame.players.find((player) => player.isLocal) ?? null;
    const remotes = frame.players.filter((player) => !player.isLocal);

    // Entity discs are obstacles, so ghost and correction labels never cover a player.
    const discRadius = PLAYER_RADIUS * transform.scale + 2;
    for (const player of frame.players) {
      const point = toCanvas(player, transform);
      this.labels.push({
        x: point.x - discRadius,
        y: point.y - discRadius,
        width: discRadius * 2,
        height: discRadius * 2,
      });
    }
    // Player name labels claim their spot first; overlays yield to them.
    if (local) {
      this.reserveNameLabel(context, local, transform);
    }
    for (const remote of remotes) {
      this.reserveNameLabel(context, remote, transform);
    }

    // Under-layer: ghosts and tethers sit beneath the entities.
    if (visuals.ghosts) {
      remotes.forEach((remote, index) => {
        const raw = frame.remoteSnapshotPositions[index];
        if (raw) {
          this.drawSnapshotMarker(context, raw, remote, transform);
        }
      });
      if (frame.localAuthoritative && local) {
        this.drawServerGhost(context, frame.localAuthoritative, local, transform);
      }
      if (!extras.predictionEnabled && extras.inputPreview && local) {
        this.drawInputGhost(context, extras.inputPreview, local, transform);
      }
    }
    if (visuals.trail) {
      for (const effect of this.effects.values()) {
        this.drawReplayTrail(context, effect, transform);
      }
    }

    for (const remote of remotes) {
      this.drawPlayer(context, remote, transform);
    }
    if (local) {
      this.drawPlayer(context, local, transform);
    }

    let newest: CorrectionEffect | null = null;
    for (const effect of this.effects.values()) {
      newest = effect;
    }
    for (const effect of this.effects.values()) {
      this.drawCorrection(context, effect, transform, effect === newest);
    }
  }

  private drawField(context: CanvasRenderingContext2D, transform: ViewportTransform): void {
    const { palette } = this;
    const topLeft = toCanvas({ x: 0, y: 0 }, transform);
    const bottomRight = toCanvas({ x: WORLD_WIDTH, y: WORLD_HEIGHT }, transform);
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;

    context.fillStyle = palette.surface0;
    context.fillRect(topLeft.x, topLeft.y, width, height);

    context.strokeStyle = palette.line;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 60; x < WORLD_WIDTH; x += 60) {
      const px = Math.round(toCanvas({ x, y: 0 }, transform).x) + 0.5;
      context.moveTo(px, topLeft.y);
      context.lineTo(px, bottomRight.y);
    }
    for (let y = 60; y < WORLD_HEIGHT; y += 60) {
      const py = Math.round(toCanvas({ x: 0, y }, transform).y) + 0.5;
      context.moveTo(topLeft.x, py);
      context.lineTo(bottomRight.x, py);
    }
    context.stroke();

    context.strokeStyle = palette.lineStrong;
    context.strokeRect(
      Math.round(topLeft.x) + 0.5,
      Math.round(topLeft.y) + 0.5,
      Math.round(width) - 1,
      Math.round(height) - 1,
    );

    // Corner ticks: mission-control framing.
    const tick = 10;
    context.strokeStyle = palette.textFaint;
    context.beginPath();
    for (const [cx, cy, dx, dy] of [
      [topLeft.x, topLeft.y, 1, 1],
      [bottomRight.x, topLeft.y, -1, 1],
      [topLeft.x, bottomRight.y, 1, -1],
      [bottomRight.x, bottomRight.y, -1, -1],
    ] as const) {
      context.moveTo(cx + dx * tick, cy + 0.5 * dy);
      context.lineTo(cx, cy + 0.5 * dy);
      context.lineTo(cx, cy + dy * tick);
    }
    context.stroke();
  }

  private drawPlayer(
    context: CanvasRenderingContext2D,
    player: RenderPlayer,
    transform: ViewportTransform,
  ): void {
    const { palette } = this;
    const point = toCanvas(player, transform);
    const radius = PLAYER_RADIUS * transform.scale;
    const color = player.isLocal ? palette.predicted : palette.remote;

    if (player.isIt) {
      context.save();
      context.setLineDash([3, 4]);
      context.strokeStyle = palette.text;
      context.globalAlpha = 0.7;
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(point.x, point.y, radius + 6, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    context.save();
    context.shadowBlur = 18;
    context.shadowColor = color;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.restore();

    context.beginPath();
    context.arc(point.x, point.y, Math.max(2.5, radius * 0.28), 0, Math.PI * 2);
    context.fillStyle = palette.surface0;
    context.globalAlpha = 0.8;
    context.fill();
    context.globalAlpha = 1;

    const reserved = this.reservedNames.get(player.id);
    if (reserved) {
      this.paintLabel(context, reserved.text, reserved.box, color, 1);
    }
  }

  private readonly reservedNames = new Map<string, { text: string; box: LabelBox }>();

  private reserveNameLabel(
    context: CanvasRenderingContext2D,
    player: RenderPlayer,
    transform: ViewportTransform,
  ): void {
    const name = player.isLocal ? "YOU" : player.isScripted ? "BOT" : "PEER";
    const text = player.isIt ? `${name} · IT` : name;
    const point = toCanvas(player, transform);
    const box = this.placeLabel(context, text, point, PLAYER_RADIUS * transform.scale + 8);
    this.reservedNames.set(player.id, { text, box });
  }

  /** Finds a free spot above, below, right or left of a point and claims it. */
  private placeLabel(
    context: CanvasRenderingContext2D,
    text: string,
    point: Vector2,
    offset: number,
  ): LabelBox {
    context.save();
    context.font = `600 10px ${this.palette.fontMono}`;
    const width = context.measureText(text).width + 10;
    context.restore();
    const height = 16;
    const candidates: LabelBox[] = [
      { x: point.x - width / 2, y: point.y - offset - height, width, height },
      { x: point.x - width / 2, y: point.y + offset, width, height },
      { x: point.x + offset, y: point.y - height / 2, width, height },
      { x: point.x - offset - width, y: point.y - height / 2, width, height },
    ];
    const clamp = (candidate: LabelBox): LabelBox => ({
      ...candidate,
      x: Math.min(Math.max(4, candidate.x), this.bounds.width - candidate.width - 4),
      y: Math.min(Math.max(4, candidate.y), this.bounds.height - candidate.height - 4),
    });
    const clamped = candidates.map(clamp);
    const box =
      clamped.find((candidate) => !this.labels.some((other) => overlaps(candidate, other))) ??
      clamped[0]!;
    this.labels.push(box);
    return box;
  }

  /** A label chip near a point, avoiding everything already placed. */
  private drawLabel(
    context: CanvasRenderingContext2D,
    text: string,
    point: Vector2,
    offset: number,
    color: string,
    alpha = 1,
  ): void {
    this.paintLabel(context, text, this.placeLabel(context, text, point, offset), color, alpha);
  }

  private paintLabel(
    context: CanvasRenderingContext2D,
    text: string,
    box: LabelBox,
    color: string,
    alpha: number,
  ): void {
    const { palette } = this;
    context.save();
    context.font = `600 10px ${palette.fontMono}`;
    context.fillStyle = palette.surface1;
    context.globalAlpha = alpha * 0.85;
    context.beginPath();
    context.roundRect(box.x, box.y, box.width, box.height, 4);
    context.fill();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, box.x + box.width / 2, box.y + box.height / 2 + 0.5);
    context.restore();
  }

  private drawServerGhost(
    context: CanvasRenderingContext2D,
    authoritative: Vector2,
    local: RenderPlayer,
    transform: ViewportTransform,
  ): void {
    const { palette } = this;
    const ghost = toCanvas(authoritative, transform);
    const you = toCanvas(local, transform);
    const radius = PLAYER_RADIUS * transform.scale;
    const gap = Math.hypot(ghost.x - you.x, ghost.y - you.y);

    context.save();
    if (gap > 2) {
      context.strokeStyle = palette.server;
      context.globalAlpha = 0.55;
      context.setLineDash([2, 3]);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(ghost.x, ghost.y);
      context.lineTo(you.x, you.y);
      context.stroke();
      context.setLineDash([]);
    }
    context.globalAlpha = 0.16;
    context.fillStyle = palette.server;
    context.beginPath();
    context.arc(ghost.x, ghost.y, radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.9;
    context.strokeStyle = palette.server;
    context.lineWidth = 1.25;
    context.setLineDash([4, 3]);
    context.stroke();
    context.restore();

    if (gap > radius * 1.2) {
      this.drawLabel(context, "SERVER", ghost, radius + 6, palette.server, 0.9);
    }
  }

  private drawInputGhost(
    context: CanvasRenderingContext2D,
    preview: Vector2,
    local: RenderPlayer,
    transform: ViewportTransform,
  ): void {
    const { palette } = this;
    const target = toCanvas(preview, transform);
    const you = toCanvas(local, transform);
    const radius = PLAYER_RADIUS * transform.scale;
    const gap = Math.hypot(target.x - you.x, target.y - you.y);
    if (gap < 2) {
      return;
    }
    context.save();
    context.strokeStyle = palette.predicted;
    context.globalAlpha = 0.5;
    context.setLineDash([2, 3]);
    context.beginPath();
    context.moveTo(you.x, you.y);
    context.lineTo(target.x, target.y);
    context.stroke();
    context.globalAlpha = 0.85;
    context.setLineDash([4, 3]);
    context.lineWidth = 1.25;
    context.beginPath();
    context.arc(target.x, target.y, radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    if (gap > radius * 1.2) {
      this.drawLabel(context, "YOUR INPUT", target, radius + 6, palette.predicted, 0.9);
    }
  }

  private drawSnapshotMarker(
    context: CanvasRenderingContext2D,
    raw: Vector2,
    remote: RenderPlayer,
    transform: ViewportTransform,
  ): void {
    const { palette } = this;
    const point = toCanvas(raw, transform);
    const drawn = toCanvas(remote, transform);
    context.save();
    context.strokeStyle = palette.remote;
    context.globalAlpha = 0.45;
    context.setLineDash([2, 3]);
    context.beginPath();
    context.moveTo(drawn.x, drawn.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 0.8;
    context.beginPath();
    context.arc(point.x, point.y, Math.max(3, PLAYER_RADIUS * transform.scale * 0.35), 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  private syncEffects(telemetry: ClientTelemetry, visuals: ArenaVisuals): void {
    for (const record of telemetry.corrections) {
      if (record.id <= this.lastCorrectionId) {
        continue;
      }
      this.lastCorrectionId = record.id;
      if (record.distance < MIN_VISIBLE_CORRECTION) {
        continue;
      }
      if (this.effects.size >= MAX_EFFECTS) {
        const oldest = this.effects.values().next().value;
        if (oldest) {
          oldest.tween.kill();
          this.effects.delete(oldest.record.id);
        }
      }
      this.effects.set(record.id, this.createEffect(record, visuals.reducedMotion));
    }
  }

  private createEffect(record: CorrectionRecord, reducedMotion: boolean): CorrectionEffect {
    const effect = { record, flash: 1, ring: reducedMotion ? 1 : 0, trail: 1, label: 1 } as CorrectionEffect;
    const timeline = gsap.timeline({
      onComplete: () => {
        this.effects.delete(record.id);
      },
    });
    if (reducedMotion) {
      timeline.to(effect, { flash: 0, trail: 0, label: 0, duration: DURATION.slow, ease: EASE.linear });
    } else {
      timeline
        .to(effect, { ring: 1, duration: DURATION.slow, ease: EASE.out }, 0)
        .to(effect, { flash: 0, duration: DURATION.slow + 0.18, ease: EASE.in }, 0.05)
        .to(effect, { trail: 0, duration: DURATION.xslow, ease: EASE.in }, 0.25)
        .to(effect, { label: 0, duration: DURATION.slow, ease: EASE.in }, 0.7);
    }
    effect.tween = timeline;
    return effect;
  }

  private drawReplayTrail(
    context: CanvasRenderingContext2D,
    effect: CorrectionEffect,
    transform: ViewportTransform,
  ): void {
    const { palette } = this;
    const points = effect.record.replay.map((point) => toCanvas(point, transform));
    if (points.length < 2 || effect.trail <= 0.01) {
      return;
    }
    context.save();
    context.globalAlpha = effect.trail * 0.9;
    context.strokeStyle = palette.rollback;
    context.lineWidth = 1.5;
    context.setLineDash([3, 3]);
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = palette.rollback;
    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, 1.75, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  private drawCorrection(
    context: CanvasRenderingContext2D,
    effect: CorrectionEffect,
    transform: ViewportTransform,
    withLabel: boolean,
  ): void {
    const { palette } = this;
    const from = toCanvas(effect.record.from, transform);
    const to = toCanvas(effect.record.to, transform);
    const radius = PLAYER_RADIUS * transform.scale;

    if (effect.flash > 0.01) {
      // Snap line: where you were drawn -> where the server corrected you.
      context.save();
      context.globalAlpha = effect.flash;
      context.strokeStyle = palette.rollback;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      context.fillStyle = palette.rollback;
      context.beginPath();
      context.moveTo(to.x, to.y);
      context.lineTo(to.x - Math.cos(angle - 0.5) * 7, to.y - Math.sin(angle - 0.5) * 7);
      context.lineTo(to.x - Math.cos(angle + 0.5) * 7, to.y - Math.sin(angle + 0.5) * 7);
      context.closePath();
      context.fill();
      // Hollow "was here" marker.
      context.globalAlpha = effect.flash * 0.6;
      context.setLineDash([2, 2]);
      context.beginPath();
      context.arc(from.x, from.y, radius * 0.8, 0, Math.PI * 2);
      context.stroke();
      context.restore();

      // Flash ring.
      context.save();
      context.globalAlpha = effect.flash * 0.9;
      context.strokeStyle = palette.rollback;
      context.lineWidth = 2;
      context.shadowBlur = 16;
      context.shadowColor = palette.rollback;
      context.beginPath();
      context.arc(to.x, to.y, radius + 4 + effect.ring * radius * 1.4, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    if (withLabel && effect.label > 0.01) {
      const text = `−${effect.record.distance.toFixed(0)}px · replayed ${effect.record.replayed}`;
      this.drawLabel(context, text, to, radius + 26, palette.rollback, effect.label);
    }
  }
}
