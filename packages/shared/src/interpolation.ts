import type { PlayerSnapshot, SnapshotMessage } from "./types.js";

export function insertSnapshotSorted(
  buffer: SnapshotMessage[],
  snapshot: SnapshotMessage,
  maximumLength: number,
): void {
  if (buffer.some((item) => item.serverTick === snapshot.serverTick)) {
    return;
  }

  let low = 0;
  let high = buffer.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const item = buffer[middle];
    if (item && item.serverTime < snapshot.serverTime) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  buffer.splice(low, 0, snapshot);
  if (buffer.length > maximumLength) {
    buffer.splice(0, buffer.length - maximumLength);
  }
}

export function interpolatePlayer(
  snapshots: readonly SnapshotMessage[],
  playerId: string,
  renderServerTime: number,
): PlayerSnapshot | null {
  if (snapshots.length === 0) {
    return null;
  }

  let before: SnapshotMessage | undefined;
  let after: SnapshotMessage | undefined;

  for (const snapshot of snapshots) {
    if (!snapshot.players[playerId]) {
      continue;
    }
    if (snapshot.serverTime <= renderServerTime) {
      before = snapshot;
      continue;
    }
    after = snapshot;
    break;
  }

  const fallback = before ?? after;
  if (!fallback) {
    return null;
  }

  const from = before?.players[playerId] ?? fallback.players[playerId];
  const to = after?.players[playerId] ?? from;
  if (!from || !to || !before || !after) {
    return from ?? to ?? null;
  }

  const duration = after.serverTime - before.serverTime;
  const alpha = duration <= 0
    ? 1
    : Math.min(1, Math.max(0, (renderServerTime - before.serverTime) / duration));

  return {
    ...to,
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
  };
}
