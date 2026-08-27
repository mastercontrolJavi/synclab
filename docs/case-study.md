# Making Multiplayer Feel Instant on a 200ms Connection

## The problem was not movement

SyncLab began with the smallest multiplayer interaction I could make useful: two circles move in a bounded arena, and whichever circle is “it” transfers that state by touching the other. The rules are intentionally forgettable. Their job is to expose a systems problem that is easy to feel and difficult to explain with a static diagram:

> How can a client respond immediately when the server still owns the truth?

A naive implementation sends a position from each browser and repeats that position to everyone else. It looks fine on localhost. It also makes every client authoritative, makes teleporting trivial, and leaves two players free to disagree about a collision.

SyncLab instead makes the server authoritative. That solves truth, but creates a responsiveness problem.

## Step 1: move authority to the server

The client sends a direction and a monotonically increasing sequence number:

```ts
{
  type: "player_input",
  sequence: 108,
  moveX: 1,
  moveY: 0,
  clientTime: 1730000000000
}
```

It never sends its position. The server validates the payload, queues it for that player, advances a shared movement rule, clamps the result to the arena, resolves tagging, and includes the result in an authoritative snapshot.

The server uses an accumulated fixed timestep rather than treating a timer callback as elapsed simulation time. If the event loop is briefly late, it can run a small number of fixed 1/30-second steps to catch up. A hard cap prevents a long stall from becoming a spiral of work. Snapshot delivery has its own 20 Hz accumulator, because simulation rate and bandwidth are different concerns.

This architecture is correct, but with 200 ms RTT it feels broken. A key press takes roughly 100 ms to reach the server and another 100 ms for the resulting snapshot to return. The local player appears to ignore the user.

## Step 2: predict local movement

Client-side prediction applies the input locally before the message completes its trip. The important constraint is that prediction is not a second movement implementation. The web client and server import the same `applyMovement` function and constants from `packages/shared`.

With prediction enabled, the interaction becomes immediate:

```text
key press
  ├─ apply shared movement now → responsive local render
  └─ send sequenced input → authoritative server
```

Turning prediction off in SyncLab removes that local step. At 200 ms RTT, the delay is visible immediately. Turning it back on restores responsiveness without changing the network conditions. That A/B comparison is the shortest explanation of why prediction exists.

Prediction introduces a second state, however. The client now has an estimate and the server has authority. Under packet loss, a command that moved the predicted player may never move the server player. A boundary or another player can also change the authoritative result.

## Step 3: reconcile without forgetting recent input

Every snapshot includes the last input sequence processed for each player. Suppose the client is waiting on inputs 107 and 108, and receives an authoritative position that acknowledges 106.

```text
authoritative position after #106
  + replay #107
  + replay #108
  = corrected present-time prediction
```

The algorithm is deliberately mechanical:

1. Measure prediction error before changing state.
2. Restore the authoritative local position.
3. Remove buffered inputs with sequence numbers at or below the acknowledgement.
4. Replay the remaining inputs with the shared fixed-delta movement function.
5. Keep the corrected simulation state exact.

The renderer may ease a small visual correction with a decaying offset. That offset never feeds back into simulation. Large corrections snap because hiding a materially wrong state would make the tool dishonest.

Turning reconciliation off stops the restore-and-replay path. A predicted client can then accumulate divergence under degraded conditions. The acknowledgement still prunes history so the demonstration cannot create an unbounded buffer.

## Step 4: do not predict what the client cannot know

The local client knows which keys are currently pressed. It does not know what a remote player will press next. Predicting remote input would be speculation.

Rendering every remote snapshot immediately avoids speculation but exposes delivery timing. A nominal 20 Hz stream does not arrive every 50 ms once jitter is involved. The remote avatar advances in uneven steps.

SyncLab stores authoritative snapshots in a bounded buffer, ordered by server timestamp even if messages arrive out of order. It estimates the server clock from ping/pong samples and renders remote players 100 ms in the past. The renderer usually has a snapshot on both sides of that target time and can interpolate between known positions.

That choice adds a small, stable visual delay to remote entities in exchange for smooth motion. Turning interpolation off reads the latest snapshot directly, which makes jitter visible.

## Step 5: make bad networks controllable

The simulator sits between application code and the WebSocket in both directions:

```text
GameClient.send(message)
        ↓
deterministic delay/drop scheduler
        ↓
WebSocket.send(serialized message)
```

Incoming WebSocket messages pass through an equivalent scheduler before the game client can process them. RTT is divided between the two directions, jitter perturbs each scheduled delay, and packet loss discards whole application messages. Scheduling uses timers; it never sleeps or blocks the main thread.

This is not an emulation of TCP internals. WebSocket still uses TCP underneath. It is a controlled impairment layer for observing how the application's synchronization strategy behaves when messages are late, uneven, or absent.

The deterministic pseudo-random generator is seeded from the room ID. That makes behavior understandable and repeatable within a session while keeping the implementation small.

## The interface is part of the explanation

The page is arranged like a developer tool rather than a game menu:

- the arena occupies the primary surface;
- conditions and real netcode switches remain visible beside it;
- a compact flow view shows real recent inputs, snapshots, acknowledgements, corrections, and drops;
- diagnostics expose both configured conditions and observed results.

Canvas rendering runs at the browser refresh rate and reads the game runtime directly. The 30 Hz input sampler, 30 Hz server simulation, 20 Hz snapshots, and display refresh are deliberately independent. React owns controls and receives a metrics snapshot four times per second, so a packet or frame does not become a component render.

The optional `?debug=true` overlay draws four truths at once: the latest authoritative local position, the corrected predicted position, the cosmetic rendered position, and the latest remote snapshot marker. Reconciliation stops being an abstract word when those markers separate and converge.

## What I would carry into a larger system

The most reusable lesson is not a particular tick rate. It is the separation of concerns:

- transport does not own simulation;
- simulated network conditions do not corrupt WebSocket internals;
- the server consumes intent, not client truth;
- local and remote entities use different latency strategies;
- acknowledgements make correction explicit;
- simulation correctness and visual smoothing are separate states;
- every high-frequency buffer has a limit.

SyncLab stops before production game infrastructure. It has no distributed room coordination, UDP transport, state compression, input redundancy, or historical lag compensation. Those omissions are deliberate. The project isolates the networking techniques that explain why an authoritative multiplayer client can still feel immediate on a 200 ms connection.
