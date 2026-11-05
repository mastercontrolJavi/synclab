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
