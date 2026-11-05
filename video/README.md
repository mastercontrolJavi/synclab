# SyncLab launch video

A 26-second, 2560×1440, 30 fps product film built entirely from code. It uses real SyncLab footage, an edit in [Remotion](https://www.remotion.dev/), and an original score generated locally.

**Final file:** [`out/synclab-launch-2560x1440.mp4`](out/synclab-launch-2560x1440.mp4) (H.264 High, yuv420p, AAC 320 kb/s, faststart).

This folder is a standalone npm project. It sits outside the pnpm workspace and never touches the app's dependencies.

## Story

| Time | Act | On screen |
|---|---|---|
| 0:00 | Hook | "Multiplayer is more than what you see." Two players, then the network behind them draws in: cyan inputs, lime snapshots, one red lost packet. |
| 0:04 | Meet | The SyncLab mark and "Meet SyncLab.", then the real lab rises in: Compare view on the default Bad Wi-Fi network. |
| 0:08 | Concepts | One continuous take of Single view on Mobile 3G. The camera follows the action for **Prediction**, **Reconciliation** (real "−15px · replayed 8" chips) and **Interpolation** (the violet remote player), then "One system, running live." |
| 0:16 | Tradeoff | "Change the conditions." The real Perfect LAN → Chaos preset switch: the sliders glide live. "See the difference." reframes onto both panes under the same network. |
| 0:21 | Close | "Networking, made visible." over a hero shot, then the end card: **SyncLab**, "A multiplayer lab where the netcode is the game." |

## How the footage is real

`capture/capture.mjs` runs the production build in headless Chromium and steps it one frame at a time with a **virtual clock** (`capture/virtual-clock.js`). SyncLab keeps time only through `performance.now`, `Date.now`, timers and `requestAnimationFrame`. With `?server=local`, the authoritative server also runs in the tab, using the same `packages/shared` code the Node server runs (the UI labels it "In-browser server"). Every clock advances exactly 1/30 s per frame, so the netcode, the GSAP motion and the CSS animations all play at real speed, and the footage is perfectly smooth however long each screenshot takes.

- Every state is reached through the app's own controls: `V` for Single view, `1`/`3`/`4` for the presets, and a scripted WASD route (`capture/scenes.mjs`). The app and the netcode are not modified.
- Scenes are captured at 3840×2160 (compare) and 5760×3240 (single, tradeoff), so close-ups stay sharp in a 2560 frame.
- `capture/track.py` finds the cyan "you" disc and the violet remote player in the footage by their concept colors and smooths that path into the camera track (`src/tracks/single.json`).

## Rerender

Requirements: Node 20+, ffmpeg, Python 3 with numpy and scipy (only to regenerate audio or tracks).

```bash
cd video
```

```bash
npm install
```

```bash
npm run render
```

On a machine without Remotion's downloadable headless shell (for example a locked-down container), point it at an existing Chromium headless shell first:

```bash
export REMOTION_BROWSER=/path/to/chrome-headless-shell
```

To preview and scrub the edit interactively:

```bash
npm run studio
```

## Recapture footage (optional)

The committed clips in `public/footage/` are enough to rerender. To recapture them from the app, build and start the production web app from the repo root:

```bash
pnpm install && pnpm build
```

```bash
pnpm --filter @synclab/web exec next start -p 3100
```

Then, in `video/`:

```bash
npm run capture
```

```bash
python3 capture/track.py
```

`npm run capture -- --only tradeoff` recaptures one scene, and `--preview` captures at 1× for quick checks. The edit's timings depend on the scene definitions (for example, the Chaos key press is footage frame 75), so keep `capture/scenes.mjs` and `src/scenes/*.tsx` in step.

## Music and sound

The score and the sound effects are **original and synthesized locally** by `music/compose.py` from oscillators and noise (numpy + scipy). No samples, loops or third-party recordings are used, so there are no third-party rights to clear. The track is 120 BPM in D minor, and its section changes land on the cues in `src/timeline.json`. That includes the stutter at 0:17.5, when the Chaos preset lands.

- `public/audio/music.wav` is the music bed (−14.4 LUFS integrated, −1 dBFS peak).
- `public/audio/sfx.wav` holds the transitions, impacts, packet blips and the lost-packet crackle.
- The final mix (music × 0.8 + sfx × 0.55, set in `src/Launch.tsx`) measures −16.2 LUFS integrated with a −1.6 dBTP true peak, leaving headroom for platform re-encoding.

To regenerate both after editing the cue times:

```bash
npm run music
```

**To replace the music** with a licensed track, overwrite `public/audio/music.wav` with a 26-second WAV (48 kHz stereo) and rerender. The volumes are in `src/Launch.tsx`. Keep `sfx.wav`, or set its volume to 0. Cut points sit on a 120 BPM grid (one bar is 2 s), so a 120 BPM track lines up with the edit.

## Files

```text
video/
  capture/        virtual clock, capture script, scene list, camera tracker
  music/          score + sound design generator
  public/
    footage/      captured clips (H.264)
    audio/        music.wav, sfx.wav
    fonts/        Geist + Geist Mono (SIL OFL, license included)
  src/
    timeline.json cue sheet shared by the edit and the score
    Launch.tsx    master composition (acts + audio)
    scenes/       Hook, Meet, Concepts, Tradeoff, Close
    components/   FootageWindow (window + camera crop), Words, Backdrop, LogoMark
    tracks/       camera track derived from the footage
  out/            rendered MP4
```

## Licensing notes

- Geist and Geist Mono are under the SIL Open Font License 1.1 (`public/fonts/OFL-LICENSE.txt`).
- Remotion is free for individuals and companies with up to 3 employees. Larger companies need a [company license](https://www.remotion.pro/license).
- The video is not affiliated with any other company or brand.
