#!/usr/bin/env python3
"""
Original score and sound design for the SyncLab launch video.

Everything is synthesized here from oscillators and noise (numpy + scipy).
No samples, loops or third-party recordings are used, so the audio is
original work owned by the project and free of third-party rights.

    python3 music/compose.py          -> public/audio/music.wav, public/audio/sfx.wav

120 BPM (one bar = 2 s), D minor, progression i-VI-III-VII. Section changes
land on the cue times in src/timeline.json, so the edit and the music stay
locked together:
  0-4    hook: pad swell, sub drone, sparse packet blips, riser
  4      impact; half-time kick
  8-16   full groove: kick, hats, clap, pulsing bass, 16th arpeggio
  16-17.5 filter climb; 17.5 the Chaos preset lands: a gated stutter
  18.5   groove returns
  21     close: impact, drums out, wide Bb pad
  23.5   end card: final F(add9) hit with a bell, rings out
"""
from __future__ import annotations

import json
import wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
TIMELINE = json.loads((ROOT / "src" / "timeline.json").read_text())
CUES = TIMELINE["cues"]
SR = 48_000
DUR = float(TIMELINE["durationSec"])
N = int(SR * DUR)
BEAT = 60.0 / TIMELINE["bpm"]
RNG = np.random.default_rng(7)


def t_axis(n: int) -> np.ndarray:
    return np.arange(n) / SR


def midi(note: float) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def lowpass(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    b, a = signal.butter(order, min(hz, SR * 0.45) / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def highpass(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    b, a = signal.butter(order, hz / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bandpass(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def sweep_lowpass(x: np.ndarray, cutoff: np.ndarray, block: int = 256) -> np.ndarray:
    """Time-varying one-pole-pair lowpass (cutoff per sample), processed in blocks."""
    out = np.zeros_like(x)
    zi = None
    for start in range(0, len(x), block):
        hz = float(np.clip(cutoff[min(start, len(cutoff) - 1)], 30, SR * 0.45))
        b, a = signal.butter(2, hz / (SR / 2), "low")
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        seg, zi = signal.lfilter(b, a, x[start : start + block], zi=zi)
        out[start : start + block] = seg
    return out


def saw(freq: float, n: int, phase: float = 0.0) -> np.ndarray:
    ph = (phase + freq * t_axis(n)) % 1.0
    return 2.0 * ph - 1.0


def adsr(n: int, a: float, d: float, s: float, r: float) -> np.ndarray:
    env = np.full(n, float(s))
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n)
    env[:na] = np.linspace(0, 1, na, endpoint=False) if na else env[:na]
    nd = min(nd, n - na)
    env[na : na + nd] = np.linspace(1, s, nd, endpoint=False) if nd else env[na : na + nd]
    if nr and n > nr:
        env[-nr:] *= np.linspace(1, 0, nr)
    return env


def place(buf: np.ndarray, x: np.ndarray, at: float, gain: float = 1.0) -> None:
    """Mix mono or stereo x into stereo buf at time `at` (seconds)."""
    start = int(at * SR)
    if start >= buf.shape[1]:
        return
    if x.ndim == 1:
        x = np.vstack([x, x])
    end = min(buf.shape[1], start + x.shape[1])
    buf[:, start:end] += gain * x[:, : end - start]


def reverb_ir(seconds: float, decay: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = t_axis(n)
    env = np.exp(-tt / decay)
    ir = rng.standard_normal((2, n)) * env
    ir = np.vstack([lowpass(ir[0], 7000), lowpass(ir[1], 6500)])
    ir[:, : int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))  # predelay softening
    return ir / np.sqrt(np.sum(ir**2) / 2)


def apply_reverb(x: np.ndarray, ir: np.ndarray, wet: float) -> np.ndarray:
    l = signal.fftconvolve(x[0], ir[0])[: x.shape[1]]
    r = signal.fftconvolve(x[1], ir[1])[: x.shape[1]]
    return x * (1 - wet) + np.vstack([l, r]) * wet


# ---------------------------------------------------------------- harmony
# D minor: i (Dm) - VI (Bb) - III (F) - VII (C)
CHORDS = {
    "Dm": [50, 57, 62, 65, 69],
    "Bb": [46, 53, 58, 62, 65],
    "F": [41, 53, 57, 60, 67],  # F with add9 (G) on top
    "C": [48, 55, 60, 64, 67],
}
ROOTS = {"Dm": 38, "Bb": 34, "F": 41, "C": 36}

# (start, end, chord) for pad and bass
PROGRESSION = [
    (0.0, 4.0, "Dm"),
    (4.0, 6.0, "Bb"),
    (6.0, 8.0, "F"),
    (8.0, 10.0, "Dm"),
    (10.0, 12.0, "Bb"),
    (12.0, 14.0, "F"),
    (14.0, 16.0, "C"),
    (16.0, 18.0, "Dm"),
    (18.0, 20.0, "Bb"),
    (20.0, 21.0, "C"),
    (21.0, 23.5, "Bb"),
    (23.5, DUR, "F"),
]


def pad_layer() -> np.ndarray:
    out = np.zeros((2, N))
    for start, end, name in PROGRESSION:
        length = end - start + (2.5 if end >= DUR else 0.9)
        n = int(length * SR)
        attack = 1.4 if start == 0 else 0.35
        env = adsr(n, attack, 0.5, 0.85, 0.9)
        voice = np.zeros((2, n))
        for note in CHORDS[name]:
            f = midi(note)
            for d, pan in ((-0.09, 0.2), (0.0, 0.5), (0.11, 0.8)):
                tone = saw(f * 2 ** (d / 12), n, phase=RNG.random())
                voice[0] += tone * (1 - pan)
                voice[1] += tone * pan
        cutoff = 900 + 500 * np.sin(2 * np.pi * 0.15 * t_axis(n) + start)
        if start >= 21.0:
            cutoff = cutoff + 900
        voice = np.vstack([sweep_lowpass(voice[0], cutoff), sweep_lowpass(voice[1], cutoff)])
        place(out, voice * env / 18, start)
    return out


def sub_drone() -> np.ndarray:
    n = int(4.4 * SR)
    tt = t_axis(n)
    tone = np.sin(2 * np.pi * midi(26) * tt) * adsr(n, 1.5, 0.1, 1.0, 0.6)
    out = np.zeros((2, N))
    place(out, tone * 0.22, 0.0)
    return out


def kick(gain: float = 1.0) -> np.ndarray:
    n = int(0.45 * SR)
    tt = t_axis(n)
    freq = 46 + 120 * np.exp(-tt / 0.035)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-tt / 0.16)
    click = highpass(RNG.standard_normal(n), 2500) * np.exp(-tt / 0.004) * 0.25
    return (body + click) * gain


def hat(open_: bool = False) -> np.ndarray:
    n = int((0.22 if open_ else 0.06) * SR)
    tt = t_axis(n)
    noise = highpass(RNG.standard_normal(n), 7500, order=4)
    return noise * np.exp(-tt / (0.07 if open_ else 0.014))


def clap() -> np.ndarray:
    n = int(0.3 * SR)
    tt = t_axis(n)
    noise = bandpass(RNG.standard_normal(n), 900, 4200)
    env = np.exp(-tt / 0.09)
    for offset in (0.0, 0.011, 0.022):
        k = int(offset * SR)
        env[k : k + int(0.004 * SR)] += 0.6
    return noise * env * 0.5


def pluck(note: float, length: float = 0.3) -> np.ndarray:
    n = int(length * SR)
    tt = t_axis(n)
    f = midi(note)
    tone = 0.6 * signal.sawtooth(2 * np.pi * f * tt, 0.5) + 0.4 * np.sign(np.sin(2 * np.pi * f * tt)) * 0.5
    tone = lowpass(tone * np.exp(-tt / 0.09), 3800)
    return tone


def drum_layer(sidechain: np.ndarray) -> np.ndarray:
    out = np.zeros((2, N))
    beats = np.arange(0, DUR, BEAT)
    for b in beats:
        if 4.0 <= b < 8.0 and (b - 4.0) % (2 * BEAT) < 1e-6:  # half time
            place(out, kick(0.85), b)
            sidechain_hit(sidechain, b)
        elif 8.0 <= b < 21.0 and not (17.5 <= b < 18.5):
            place(out, kick(1.0), b)
            sidechain_hit(sidechain, b)
    # hats and claps in the groove
    for i, b in enumerate(np.arange(8.0, 21.0, BEAT / 2)):
        if 17.5 <= b < 18.5:
            continue
        offbeat = i % 2 == 1
        h = hat(open_=offbeat and i % 8 == 7)
        pan = np.vstack([h * 0.42, h * 0.58])
        place(out, pan, b, gain=0.22 if offbeat else 0.1)
    for b in np.arange(8.0 + BEAT, 21.0, 2 * BEAT):
        if 17.5 <= b < 18.5:
            continue
        place(out, clap(), b, gain=0.45)
    # snare-ish fill into the close
    for k, b in enumerate(np.arange(20.0, 21.0, BEAT / 4)):
        place(out, clap(), b, gain=0.12 + 0.05 * k)
    return out


def sidechain_hit(env: np.ndarray, at: float) -> None:
    start = int(at * SR)
    n = int(0.32 * SR)
    curve = 1 - 0.65 * np.exp(-t_axis(n) / 0.09)
    end = min(len(env), start + n)
    env[start:end] = np.minimum(env[start:end], curve[: end - start])


def bass_layer() -> np.ndarray:
    out = np.zeros(N)
    for start, end, name in PROGRESSION:
        if start < 8.0 or start >= 21.0:
            continue
        root = ROOTS[name]
        for b in np.arange(start, end, BEAT / 2):
            n = int(BEAT / 2 * SR)
            tt = t_axis(n)
            f = midi(root)
            tone = saw(f, n) * 0.6 + np.sin(2 * np.pi * f / 2 * tt) * 0.9
            env = np.exp(-tt / 0.18) * adsr(n, 0.004, 0.0, 1.0, 0.02)
            climb = 1.0 + (np.clip((b - 16.0) / 1.5, 0, 1) * 3.0 if 16.0 <= b < 17.5 else 0)
            cut = (420 + 2400 * np.exp(-tt / 0.06)) * climb
            seg = sweep_lowpass(tone * env, cut, block=128)
            s = int(b * SR)
            out[s : s + n] += seg[: max(0, min(n, N - s))]
    return np.vstack([out, out]) * 0.32


def arp_layer() -> np.ndarray:
    out = np.zeros((2, N))
    step = BEAT / 4
    for start, end, name in PROGRESSION:
        if not (6.0 <= start < 21.0):
            continue
        notes = sorted(CHORDS[name][1:]) + [CHORDS[name][2] + 12]
        pattern = [0, 2, 1, 3, 4, 3, 1, 2]
        for i, b in enumerate(np.arange(start, end, step)):
            if 17.5 <= b < 18.5:
                continue
            note = notes[pattern[i % len(pattern)] % len(notes)] + 12
            p = pluck(note)
            gain = 0.11 if start >= 8.0 else 0.06 * (b - 6.0) / 2.0
            pan = 0.3 if i % 2 == 0 else 0.7
            place(out, np.vstack([p * (1 - pan), p * pan]), b, gain=gain)
    # ping-pong eighth-note delay
    d = int(BEAT / 2 * SR)
    delayed = np.zeros_like(out)
    delayed[0, d:] = out[1, :-d] * 0.38
    delayed[1, 2 * d :] = out[0, : -2 * d] * 0.26
    return out + lowpass(delayed[0], 3000)[None, :] * np.array([[1], [0]]) + lowpass(delayed[1], 3000)[None, :] * np.array([[0], [1]])


def stutter(mix: np.ndarray, at: float, length: float) -> np.ndarray:
    """Packet-loss nod: repeat a 1/16 slice with gaps and a crushed tone, then let go."""
    s = int(at * SR)
    slice_n = int(BEAT / 4 * SR)
    grab = mix[:, s - slice_n : s].copy()
    span = int(length * SR)
    seg = np.zeros((2, span))
    pos = 0
    k = 0
    while pos < span:
        piece = grab.copy()
        if k % 3 == 2:  # a "dropped" slice
            piece *= 0.0
        crushed = np.round(piece * 12) / 12
        fade = np.linspace(1, 0.85, piece.shape[1])
        m = min(slice_n, span - pos)
        seg[:, pos : pos + m] = (crushed * fade)[:, :m] * (0.9 - 0.4 * pos / span)
        pos += slice_n
        k += 1
    out = mix.copy()
    out[:, s : s + span] = seg[:, : max(0, min(span, N - s))]
    return out


# ---------------------------------------------------------------- sfx
def whoosh(length: float, up: bool = True) -> np.ndarray:
    n = int(length * SR)
    tt = np.linspace(0, 1, n)
    cutoff = (300 + 6000 * tt**2) if up else (6000 - 5600 * tt**0.5)
    noise = RNG.standard_normal(n)
    sw = sweep_lowpass(noise, cutoff, block=128)
    env = np.sin(np.pi * np.clip(tt, 0, 1)) ** 2 if not up else tt**2.2
    return np.vstack([sw * env * 0.9, np.roll(sw, 90) * env * 0.9])


def impact(size: float = 1.0) -> np.ndarray:
    n = int(2.8 * SR)
    tt = t_axis(n)
    freq = 34 + 90 * np.exp(-tt / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-tt / 0.7)
    thud = lowpass(RNG.standard_normal(n), 900) * np.exp(-tt / 0.06) * 0.5
    air = highpass(RNG.standard_normal(n), 3000) * np.exp(-tt / 0.5) * 0.06
    x = boom + thud + air
    return np.vstack([x, x]) * size


def blip(freq: float, length: float = 0.12) -> np.ndarray:
    n = int(length * SR)
    tt = t_axis(n)
    tone = np.sin(2 * np.pi * freq * tt) * np.exp(-tt / 0.03)
    return tone


def tick() -> np.ndarray:
    n = int(0.05 * SR)
    tt = t_axis(n)
    return highpass(RNG.standard_normal(n), 4000) * np.exp(-tt / 0.006) + np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt / 0.01) * 0.5


def drop_crackle() -> np.ndarray:
    n = int(0.25 * SR)
    tt = t_axis(n)
    pulses = (RNG.random(n) > 0.985).astype(float) * RNG.standard_normal(n)
    return bandpass(pulses, 1500, 9000) * np.exp(-tt / 0.08) * 3


def bell(note: float, length: float = 3.5) -> np.ndarray:
    n = int(length * SR)
    tt = t_axis(n)
    f = midi(note)
    x = (
        np.sin(2 * np.pi * f * tt) * np.exp(-tt / 1.4)
        + 0.5 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt / 0.5)
        + 0.25 * np.sin(2 * np.pi * f * 5.4 * tt) * np.exp(-tt / 0.25)
    )
    return x * adsr(n, 0.003, 0, 1, 0.4)


def sfx_layer() -> np.ndarray:
    out = np.zeros((2, N))
    # hook: packet blips (cyan up, lime down), one dropped packet
    for k, at in enumerate([1.5, 2.0, 2.5, 3.0]):  # packet arrivals in the hook
        place(out, blip(midi(86 if k % 2 == 0 else 81)), at, gain=0.16)
    place(out, drop_crackle(), 2.13, gain=0.12)  # the lost packet
    # risers and impacts on the big cues
    place(out, whoosh(1.4, up=True), CUES["meet"] - 1.4, gain=0.18)
    place(out, impact(1.0), CUES["meet"], gain=0.55)
    place(out, whoosh(0.7, up=False), CUES["lab"] - 0.05, gain=0.12)
    for key in ("prediction", "reconciliation", "interpolation", "system"):
        place(out, tick(), CUES[key], gain=0.18)
        place(out, whoosh(0.5, up=False), CUES[key] - 0.08, gain=0.07)
    place(out, whoosh(1.4, up=True), CUES["chaos"] - 1.4, gain=0.12)
    place(out, drop_crackle(), CUES["chaos"] + 0.05, gain=0.2)
    place(out, drop_crackle(), CUES["chaos"] + 0.45, gain=0.14)
    place(out, whoosh(0.6, up=False), CUES["difference"] - 0.1, gain=0.1)
    place(out, whoosh(1.2, up=True), CUES["close"] - 1.2, gain=0.16)
    place(out, impact(0.9), CUES["close"], gain=0.45)
    place(out, impact(0.6), CUES["endcard"], gain=0.4)
    b = bell(81) + bell(88) * 0.4
    place(out, np.vstack([b * 0.6, b * 0.5]), CUES["endcard"], gain=0.12)
    return out


# ---------------------------------------------------------------- mix
def write_wav(path: Path, stereo: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (np.clip(stereo, -1, 1).T * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(data.tobytes())


def master(x: np.ndarray, peak: float) -> np.ndarray:
    x = np.tanh(x * 1.2) / np.tanh(1.2)
    fade = int(0.9 * SR)
    x[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
    x[:, : int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    return x / (np.max(np.abs(x)) + 1e-9) * peak


def main() -> None:
    ir = reverb_ir(3.2, 0.9, seed=3)
    side = np.ones(N)
    drums = drum_layer(side)
    pad = pad_layer() * side
    music = pad + sub_drone() + drums * 0.62 + bass_layer() * side + arp_layer() * side
    music = apply_reverb(music, ir, wet=0.22)
    music = stutter(music, CUES["chaos"], CUES["difference"] - CUES["chaos"])
    music = master(music, peak=0.89)
    sfx = apply_reverb(sfx_layer(), ir, wet=0.28)
    sfx = sfx / (np.max(np.abs(sfx)) + 1e-9) * 0.89
    write_wav(ROOT / "public" / "audio" / "music.wav", music)
    write_wav(ROOT / "public" / "audio" / "sfx.wav", sfx)
    print("wrote public/audio/music.wav and public/audio/sfx.wav", f"({DUR:.1f} s, {SR} Hz)")


if __name__ == "__main__":
    main()
