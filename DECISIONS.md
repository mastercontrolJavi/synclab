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

## Phase 2: Making the netcode visible

| # | Decision | Why |
|---|---|---|
| D2.1 | **Netcode-adjacent change, no rule change:** `RoomManager`, `FixedTimestepLoop` and the message dispatch and rate limit from `apps/server/src/index.ts` moved into `packages/shared/src/server/`, unchanged except that `ws.WebSocket` became a 3-field `RoomSocket` interface and `node:crypto.randomUUID` became `globalThis.crypto.randomUUID` (with a fallback for insecure contexts). Tick rates, input caps, tag rules, ack semantics and message shapes are identical. All 14 existing tests pass unmodified. | Implements D0.4. The Node server and the in-tab fallback must run the *same* authoritative code. |
| D2.2 | `/health` now sends `access-control-allow-origin: *`. | Lets the web app probe and wake the Render free-tier server from the browser. Read-only endpoint, no data exposed. |
| D2.3 | Live → local fallback: try live for 4.5 s, or fall back right away on `reconnecting` or `server_unavailable`. While local, probe `/health` every 8 s. Once it answers, offer "Switch to live server". `?server=live` or `?server=local` pins a mode. | The lab never shows a dead canvas. Multiplayer across devices still needs the live server, and the UI says so. |
| D2.4 | Client lifecycle lives in a small external store (`LabSessionStore`) read through `useSyncExternalStore`. | React Compiler lint forbids ref reads during render. Constructing clients in effects keeps StrictMode double-mounts clean. |
| D2.5 | Telemetry is instrumentation only: `GameClient` records packet flights (direction, kind, real scheduled delay, dropped), correction records, RFC 3550 inter-arrival jitter on snapshots, and a 5 s loss window. The replay path is re-derived with the shared `applyMovement` **for display only**. | D0.2/D0.3. Nothing feeds back into simulation state. |
| D2.6 | Ghosts: a lime translucent disc at the last authoritative position, tethered to the predicted entity. When prediction is **off**, a cyan "YOUR INPUT" ghost shows where pending inputs would put you, computed with the existing `reconcilePosition`. Raw remote snapshots get a small violet marker tethered to the interpolated drawing. | The naive pane's lag becomes a visible gap between intent and authority. The predicted pane's gap shows authority trailing you. |
| D2.7 | Corrections draw an amber snap line with an arrow (where you were drawn → where you were corrected to), a flash ring, the dashed replay path with one dot per replayed input, and a "−7px · replayed 5" chip. GSAP tweens only the effect's `flash/ring/trail/label` scalars. Effects are capped at 6 and corrections under 1 px are ignored. | The brief asks to *see* the rollback. GSAP never touches entity positions. |
| D2.8 | Packet lane: the dot position is `elapsed / scheduledDelay`, so speed equals real simulated latency. Inputs are cyan, snapshots lime, pings grey. Drops travel 55% of the lane, then fall with a red burst. A 60 ms floor keeps 0 ms RTT legible. | Latency, jitter (uneven dot spacing) and loss become spatial. |
| D2.9 | Telemetry shows 6 primary cards (RTT, jitter, loss, tick rate, pending inputs, corrections/s), each with a tooltip sentence, the configured value next to the measured one, a GSAP-tweened number and a 15 s SVG sparkline. Snapshot rate, last ack, prediction gap and packet counters move to a quiet footer row. | Hierarchy (audit #8). Configured vs measured teaches that sliders are inputs and the cards are observations. |
| D2.10 | Removed the raw event log and the fake "simulated transit" bar. | The packet lane and canvas correction chips carry the same information spatially. Prefer deleting over adding. |
| D2.11 | Canvas labels claim space in priority order (player names, then ghosts, then correction chips) and try 4 positions to avoid overlap. | Fixes audit #10. |

## Phase 3: Controls and UX

| # | Decision | Why |
|---|---|---|
| D3.1 | **Compare (split) view is the default on every screen size.** On phones the panes stack vertically. The top bar has a two-option switch, Compare / Single (`V`). | The comparison is the money shot (audit #3). Stacked panes still read at 375 px. |
| D3.2 | In Compare view the left pane is a locked naive baseline (prediction, reconciliation and interpolation all off). The netcode switches drive the right pane. The dock says "right pane", with a tooltip explaining why. | One fixed reference plus one experimental pane keeps every toggle a comparison, not a memory test. |
| D3.3 | The right pane's subtitle rewrites itself for each switch combination ("Predicts but never corrects. Watch it drift from the server"). | Every toggle explains its own consequence in place. |
| D3.4 | Presets became network presets only: Perfect LAN (10/0/0), Bad Wi-Fi (150/30/3, the default), Mobile 3G (300/80/6) and Chaos (400/100/15), on keys `1`–`4`. The netcode switches are separate. The old "Naive/Modern" presets are gone because Compare view replaces them. | Conditions and techniques are orthogonal. Mixing them hid which one caused the change. |
| D3.5 | Choosing a preset tweens the real settings for ~0.6 s with GSAP, so sliders glide and the network degrades live. Dragging a slider kills any running tween. | "Animate sliders to new values", and the viewer sees cause and effect. |
| D3.6 | Shortcuts: `WASD`/arrows move, `1–4` presets, `P R I` netcode, `G T K` visualizations, `V` view, `H` how it works, `?` list, `Esc` close. None collide with `WASD`. | Audit #14. Letters are mnemonic. |
| D3.7 | The tour has 5 steps (panes, ghost, packet lane, presets, telemetry). The spotlight is an SVG mask with a stroked rect, both moved with GSAP attribute tweens (no layout). It starts once the lab first connects, is skippable (Esc/Skip), supports ←/→/Enter, and is remembered in `localStorage` with every access wrapped in try/catch. | Brief. It waits for a live canvas so the tour never points at an empty state. |
| D3.8 | Every metric, slider, switch, preset, legend item and visualization toggle has a one-sentence tooltip. Tooltips moved to a dark surface token. | Audit #8/#14. |
| D3.9 | Pane states: connecting (live: "Waking the live server…", local: "Starting the in-browser server…"), room full (with "Open a fresh room"), unavailable (with Retry). The canvas grid always draws underneath, so it is never blank. | Audit #1/#14. |
| D3.10 | Mobile: below `lg` the dock lives in a GSAP bottom sheet opened from a floating "Controls" button, and a touch joystick feeds the same input path as the keyboard. | Audit #6. Touch had no input at all before. |
| D3.11 | `MotionOverlay` is one always-mounted, `inert`-when-closed primitive for the dialog, drawer and sheet, with GSAP enter and exit and focus return. | Exit animations need the node mounted, and one primitive keeps motion consistent. |
| D3.12 | The "How it works" drawer shipped in this phase (it was planned for Phase 5) because the top bar and the `H` shortcut point to it. | Never ship a button that leads nowhere. |
| D3.13 | Assumptions: author name "Javier" (from the account handle) and default site URL `https://synclab.vercel.app`, overridable with `NEXT_PUBLIC_SITE_URL`. Both live in `src/lib/site.ts`. | Brief: don't ask, state assumptions. Edit one file to change them. |
| D3.14 | Under heavy correction rates, only the newest correction gets a text chip, there are at most 4 live effects, and labels are clamped inside the canvas. | Chaos preset stacked 4 chips and pushed one past the edge. |
| D3.15 | Removed the `?debug=true` mode. Ghosts are on by default and can be toggled with `G`. | The debug overlay was the most important visualization and it was hidden. |
