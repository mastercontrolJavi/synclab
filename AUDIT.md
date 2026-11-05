# SyncLab UI/UX Audit

Phase 0 recon, before any UI changes. The audit ranks problems by how much they hurt a first-time viewer (recruiter or engineer) who gives the page 60 to 90 seconds.

## 1. System map

| Layer | Where | What it does |
|---|---|---|
| Stack | pnpm monorepo | Next.js 16.3 (App Router) + React 19.2 + Tailwind v4 + shadcn (radix-nova) in `apps/web`. Node + `ws` in `apps/server`. Shared TypeScript in `packages/shared`. |
| Simulation | `packages/shared/src/simulation.ts` | `applyMovement` is one fixed-delta movement rule, used by both server and client. |
| Server loop | `apps/server/src/fixed-timestep-loop.ts` | Accumulator loop: 30 Hz sim, 20 Hz snapshots, catch-up capped at 5 steps. |
| Rooms | `apps/server/src/room-manager.ts` | 2 humans per room. A scripted bot fills the second slot when you play solo. Tag game, ack per player. |
| Protocol | `packages/shared/src/types.ts`, `protocol.ts` | JSON messages with runtime guards. Client sends `join_room`, `player_input` (sequence + direction) and `ping`. Server sends `welcome`, `snapshot` (players + acks + rates), `pong`, `room_full`, `player_joined/left` and `error`. |
| Network sim | `apps/web/src/features/lab/network-simulator.ts` | `SimulatedTransport` wraps the WebSocket. It adds a seeded delay of RTT/2 ± jitter/2 and seeded drops in both directions. |
| Client runtime | `apps/web/src/features/lab/game-client.ts` | 30 Hz input sampler, prediction, reconciliation (`reconcilePosition`), 100 ms snapshot interpolation, ping/clock offset, reconnect backoff. Publishes metrics and events to React at 4 Hz. |
| Render loop | `components/arena.tsx` + `renderer.ts` | A `requestAnimationFrame` loop that reads `client.getRenderFrame()` and draws the canvas 2D context. React never re-renders per frame. |
| State | `components/lab-dashboard.tsx` | Local `useState` only: settings, status, metrics, events. No store library. |
| UI components | `components/*.tsx` | `StatusHeader`, `Arena`, `ControlPanel`, `NetworkFlow`, `DiagnosticsPanel`, shadcn `Button/Slider/Switch/Tooltip`. |

Baseline checks: `pnpm test` passes (14 tests) and `pnpm lint` passes. **`pnpm typecheck` fails on a fresh clone** (`LayoutProps` exists only after Next generates route types). The dev server shows a hydration-mismatch error badge from Radix hidden inputs. FPS with debug on: 60.

## 2. Screen and state map

There is one route (`/?room=<id>[&debug=true]`). A missing room ID redirects to a random one.

| State | What the viewer sees today |
|---|---|
| Connecting (cold start) | An empty black canvas with no grid, a "Connecting" pill, and the event log reading "Events appear when the connection starts". The Render free tier can take ~60 s to wake. |
| Connected, solo | Grid, YOU plus a SCRIPTED bot, and a "Solo mode" pill. YOU, SCRIPTED and IT labels overlap at spawn. |
| Connected, two clients | YOU and PEER. Works. |
| Room full | A thin amber banner, an empty grid, and controls that stay interactive but do nothing. |
| Reconnecting / server unavailable | Status pill plus banner. The canvas keeps showing stale or empty content. |
| `?debug=true` | Dashed AUTH/PRED/RENDER/SNAP rings with overlapping 9 px labels. Discoverable only from the README. |
| Mobile 375 px | A 1742 px tall stack. Arena ~340×210. **No touch input at all.** |

Controls: 3 presets (Naive, Modern, Reset), 3 sliders (RTT 0–400, jitter 0–100, loss 0–20), 3 switches (prediction, reconciliation, interpolation) and a copy-room-link button.

## 3. Top 15 problems, ranked by impact on a first-time viewer

1. **Cold start looks broken.** The Render free tier sleeps. The first visit can sit on "Connecting" with a black, gridless canvas for up to a minute, with no progress, explanation or fallback. Most 60-second visitors leave here and never see the netcode.
2. **The netcode is invisible by default.** Authoritative and predicted positions show only with an undocumented `?debug=true`, and even then as thin dashed rings with colliding 9 px labels. Reconciliation is silent: a counter goes up. Packets, latency and loss have no visual form.
3. **No split view, so no "money shot".** To compare naive and predicted play, the viewer must toggle switches and remember how the last mode felt. The Naive/Modern presets swap the whole lab, and their explanation is a 10 px caption under the canvas.
4. **No framing.** The page opens straight into a dense four-panel dashboard. It has no title moment, no one-line pitch, no "what you're seeing" and no first action. "Real-time networking laboratory" does not say why anyone should care.
5. **Input breaks silently.** Keys work only while the arena has focus. Clicking any preset, slider or switch steals focus and movement stops, with no feedback. The only hint is a 10 px pill.
6. **Mobile is unusable.** There is no touch or joystick input, the page is 1742 px tall at 375 px, the arena is tiny, and the controls don't collapse.
7. **The "network flow" panel is mostly decorative.** The "Simulated transit" bar is a fixed 2/3-width `animate-pulse`, which is UI that lies. The client and server nodes show only the last label. Latency has no spatial or temporal form.
8. **Telemetry has no hierarchy and no trends.** It shows 14 equal rows of 10 px mono text, with no sparklines and no one-line explanations. Jitter and loss % are shown only as configured values, not measured ones. Corrections are a lifetime count instead of a rate.
9. **Color means different things in different places.** Local is emerald, remote is violet, AUTH is cyan, PRED is pink, RENDER is white and SNAP is violet. Amber means IT, reconcile and connecting at once. Event-log colors differ from canvas colors. No legend.
10. **Canvas label collisions.** YOU, SCRIPTED and IT overlap at spawn. AUTH, PRED and RENDER stack on top of each other in debug mode. The player-is-IT ring and label are clipped at the arena edge.
11. **The type scale is too small and too uniform.** Most of the UI is 9–11 px, with uppercase tracked micro-labels and low-contrast muted text. It reads as cramped at a normal viewing distance and gives no focal point.
12. **One of the three key switches is below the fold.** At 1440×900, "Remote interpolation" is cut off inside a nested scroll region.
13. **Presets are thin and changes are abrupt.** There are no network-condition presets (LAN, Wi-Fi, 3G, chaos). Values jump instead of moving visibly, and "custom" vs "preset" state is unclear.
14. **Weak edge states, no help layer.** Room-full and server-unavailable are thin text strips over a dead canvas. There are no keyboard shortcuts, no help overlay and no tooltips on metrics. The dev overlay shows a hydration error badge.
15. **The portfolio surface is missing.** There is no OG image or social meta, no author or GitHub link, and no stack badges. The README has no hero visual and tells readers to copy a non-existent `apps/web/.env.example`. `pnpm typecheck` fails on a fresh clone.

## 4. What is already good (keep)

- The architecture is a correct teaching model: authoritative server, shared movement function, ack-based replay, interpolation of remote players only.
- Canvas runs outside React, and React gets 4 Hz metrics. That is the right performance boundary, and the redesign keeps it.
- Bounded buffers, runtime guards and a deterministic seeded transport.
- The netcode switches change real code paths, not cosmetics. The UI should say so loudly.
