export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 600;
export const PLAYER_RADIUS = 16;
export const PLAYER_SPEED = 220;

export const SERVER_TICK_RATE = 30;
export const SNAPSHOT_RATE = 20;
export const INPUT_RATE = 30;
export const FIXED_DT = 1 / SERVER_TICK_RATE;
export const SNAPSHOT_INTERVAL_MS = 1_000 / SNAPSHOT_RATE;
export const INTERPOLATION_DELAY_MS = 100;

export const MAX_CATCH_UP_STEPS = 5;
export const MAX_INPUTS_PER_TICK = 3;
export const MAX_INPUT_QUEUE = 120;
export const MAX_PENDING_INPUTS = 180;
export const MAX_SNAPSHOT_BUFFER = 120;
export const MAX_NETWORK_EVENTS = 50;
export const TAG_COOLDOWN_TICKS = SERVER_TICK_RATE;

export const ROOM_ID_PATTERN = /^[a-z0-9-]{3,12}$/;
export const MAX_MESSAGE_BYTES = 16 * 1024;
export const MAX_MESSAGES_PER_SECOND = 120;

export const DEFAULT_NETWORK_CONDITIONS = {
  rttMs: 60,
  jitterMs: 10,
  packetLossPercent: 0,
} as const;

export const DEFAULT_NETCODE_SETTINGS = {
  prediction: true,
  reconciliation: true,
  interpolation: true,
} as const;
