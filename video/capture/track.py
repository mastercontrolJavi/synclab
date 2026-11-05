#!/usr/bin/env python3
"""
Builds a smooth camera track from real footage, so close-ups can follow the
action instead of guessing where it is.

    python3 capture/track.py            -> src/tracks/single.json

It finds the cyan "you" disc and the violet remote player inside the arena of
footage/single.mp4 by their concept colors (the app draws each concept in one
hue), then smooths the path with a Gaussian so the camera glides. Coordinates
are in CSS pixels of the 1440x810 capture viewport.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.ndimage import gaussian_filter1d

ROOT = Path(__file__).resolve().parent.parent
W, H = 1440, 810
# Single-view arena canvas in CSS px (measured from the running app).
ARENA = (227, 131, 654, 409)

# Concept colors as rendered (sRGB): predicted cyan, interpolated remote violet.
TARGETS = {
    "you": np.array([63, 214, 238]),
    "remote": np.array([180, 140, 242]),
}


def frames(path: Path):
    proc = subprocess.Popen(
        ["ffmpeg", "-loglevel", "error", "-i", str(path), "-vf", f"scale={W}:{H}:flags=area",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE,
    )
    size = W * H * 3
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    proc.wait()


def centroid(region: np.ndarray, color: np.ndarray, ox: int, oy: int):
    dist = np.linalg.norm(region.astype(np.int16) - color, axis=2)
    ys, xs = np.nonzero(dist < 48)
    if len(xs) < 12:
        return None
    # Use the densest blob: median is robust to labels and stray packets.
    return float(np.median(xs) + ox), float(np.median(ys) + oy)


def build(name: str) -> None:
    x0, y0, w, h = ARENA
    raw = {key: [] for key in TARGETS}
    for frame in frames(ROOT / "public" / "footage" / f"{name}.mp4"):
        region = frame[y0 : y0 + h, x0 : x0 + w]
        for key, color in TARGETS.items():
            raw[key].append(centroid(region, color, x0, y0))
    out = {"name": name, "fps": 30, "space": "css-px 1440x810", "arena": ARENA}
    for key, points in raw.items():
        # Fill gaps with the last known point, then smooth.
        filled, last = [], (x0 + w / 2, y0 + h / 2)
        for p in points:
            last = p or last
            filled.append(last)
        arr = np.array(filled)
        smooth = gaussian_filter1d(arr, sigma=10, axis=0, mode="nearest")
        out[key] = [[round(float(x), 1), round(float(y), 1)] for x, y in smooth]
        out[f"{key}_found"] = sum(p is not None for p in points)
    target = ROOT / "src" / "tracks" / f"{name}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(out))
    print(f"wrote {target.relative_to(ROOT)}: {len(raw['you'])} frames,",
          {k: out[f'{k}_found'] for k in TARGETS})


if __name__ == "__main__":
    build("single")
