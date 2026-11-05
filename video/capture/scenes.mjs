/**
 * Scene list for the capture script. Every scene is real app state, reached
 * only through the app's own keyboard shortcuts:
 *   1-4 network presets · V Compare/Single view · WASD movement.
 *
 * The driving path is a closed loop (net displacement zero) with diagonals and
 * short pauses, so the player keeps moving like a person would and never pins
 * against a wall. Room ids must match /^[a-z0-9-]{3,12}$/. Frame numbers are at 30 fps from the first recorded frame;
 * the edit in src/ relies on these timings (see src/timing.ts).
 */
const LOOP = [
  { keys: "d", ms: 900 },
  { keys: "sd", ms: 700 },
  { keys: "s", ms: 400 },
  { keys: "", ms: 300 },
  { keys: "a", ms: 1100 },
  { keys: "aw", ms: 700 },
  { keys: "w", ms: 400 },
  { keys: "", ms: 250 },
  { keys: "d", ms: 200 },
];

export const SCENES = [
  {
    name: "compare",
    description: "Compare view, default Bad Wi-Fi (150 ms, 30 ms jitter, 3% loss)",
    room: "film-compare",
    // Starts at page load so the clip opens on the app's own launch reveal.
    warmupMs: 100,
    durationMs: 16000,
    path: LOOP,
  },
  {
    name: "single",
    description: "Single view, Mobile 3G (300 ms, 80 ms jitter, 6% loss): big arena for close-ups",
    room: "film-single",
    // 1440x810 at 4x = 5760x3240, so arena close-ups stay sharp in a 2560 frame.
    scale: 4,
    setup: [
      { atMs: 400, key: "v" },
      { atMs: 700, key: "3" },
    ],
    warmupMs: 6000,
    durationMs: 10000,
    path: LOOP,
  },
  {
    name: "tradeoff",
    description: "Compare view: Perfect LAN, then the Chaos preset at frame 75 (sliders glide live)",
    room: "film-trade",
    // 4x as well: the edit holds a tight close-up on the dock's sliders.
    scale: 4,
    setup: [{ atMs: 300, key: "1" }],
    warmupMs: 8000,
    durationMs: 9000,
    actions: [{ frame: 75, key: "4" }],
    path: LOOP,
  },
];
