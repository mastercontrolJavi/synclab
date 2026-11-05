# Decisions log

Every non-obvious decision in the UI/UX revamp, with its reason. Tie-break rule: **pick the option that makes the netcode easier to understand for a non-expert in 10 seconds.**

## Phase 0: Recon

| # | Decision | Why |
|---|---|---|
| D0.1 | Run all phases autonomously in order and commit after each one. | Requested. Every phase must leave the app building and running. |
| D0.2 | Netcode stays sacred: tick rates (30/20/30 Hz), `applyMovement`, `reconcilePosition`, interpolation, the transport delay/drop math and the message format do not change. | Hard rule. The visualizations read state; they never steer it. |
| D0.3 | Add read-only telemetry hooks to `GameClient` and `SimulatedTransport` (packet flight records, reconciliation records with before/after positions, RTT samples). | The visualizations need data that already exists inside those classes but isn't exposed. Exposing it changes no behavior. |
| D0.4 | Fix the cold start (audit #1) with a **same-code in-browser authoritative server**. Move `RoomManager` and `FixedTimestepLoop` into `packages/shared` behind a tiny socket interface. The Node server and a loopback "local server" in the tab both run that one implementation. The lab tries the live server first and falls back to local if it isn't up within a few seconds. The UI labels this clearly. | A portfolio demo must never show a dead canvas. Duplicating the server logic would be dishonest and drift-prone. Moving it keeps one source of truth. No rule or rate changes. |
| D0.5 | Split view runs two `GameClient`s in two rooms (`<room>` and `<room>-n`), fed by one keyboard. Left: naive (all netcode off). Right: predicted + reconciled + interpolated. Both get the same network conditions. | That is the only honest way to show both behaviors at once under identical conditions. |
| D0.6 | Add a **demo autopilot**: scripted local input drives the player until the viewer presses a movement key. Pressing any key hands control over immediately. | Many viewers won't press a key in the first 10 seconds. Without movement there is no prediction gap, no reconciliation and nothing to see. The autopilot generates input only; netcode is untouched. |
| D0.7 | Default lab conditions become the "Bad Wi-Fi" preset (150 ms RTT, 30 ms jitter, 3% loss) and split view is the default on desktop. | At the old default (60 ms, 0% loss) naive and predicted look identical, so the lesson is invisible. |
| D0.8 | Movement keys are captured globally, not only while the arena is focused. Arrow keys still go to a focused slider. WASD always moves. | Fixes audit #5: clicking a control used to break movement silently. |

## Phase 1: Design system

| # | Decision | Why |
|---|---|---|
| D1.1 | Direction: dark "mission control". Near-black blue-cast surfaces (`--surface-0..3`), a 4px spacing grid, 6/8/12/16 px radii, Geist for UI and Geist Mono for data. | This is the default the brief asked for. Geist was already installed, so no new font weight ships. |
| D1.2 | The single accent is **cyan**, and it doubles as the "you / predicted" color. | The accent marks what *you* control, so the UI and the canvas agree on what is yours. |
| D1.3 | Concept colors: predicted = cyan, server-authoritative = lime, interpolated remote = violet, rollback/correction = amber, dropped = red, control traffic = grey. Input packets use the predicted color (they come from you). Snapshot packets use the server color. | Each concept gets exactly one hue across canvas, legend, sparklines and tooltips. Amber now means only "correction". The old IT ring (also amber) becomes neutral white. |
| D1.4 | CSS variables are the single source of truth. The canvas reads them through `resolveConceptColors()` (`src/lib/concepts.ts`). Tailwind exposes them as `text-predicted`, `bg-server` and so on. | No hex duplication between CSS and canvas. |
| D1.5 | Motion tokens live in `src/lib/motion.ts` (`DURATION`, `EASE` names mapped to GSAP eases, `STAGGER`), with a CSS mirror in `--dur-*` and `--ease-*`. Plugins registered: `useGSAP`, `MotionPathPlugin`. | Named eases keep every animation consistent. |
| D1.6 | Typecheck runs `next typegen` before `tsc`. | `LayoutProps` is a generated global type, and a fresh clone failed `pnpm typecheck` (audit #15). |
| D1.7 | Installed `gsap` and `@gsap/react` and nothing else. No chart library. | Brief: no heavy chart libraries. Sparklines will be hand-drawn SVG. |
