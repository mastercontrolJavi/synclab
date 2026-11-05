#!/usr/bin/env node
/**
 * Captures real SyncLab footage, frame by frame, under a virtual clock.
 *
 *   node capture/capture.mjs [--url http://localhost:3100] [--only compare,single] [--preview]
 *
 * Requires the production web app running (see video/README.md). Each scene is
 * piped straight into ffmpeg as a 30 fps H.264 clip (3840x2160 by default) in
 * video/public/footage/<scene>.mp4, so the edit can zoom in without upscaling.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SCENES } from "./scenes.mjs";

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const candidate of ["playwright", "/opt/node-tools/node_modules/playwright"]) {
    try {
      return require(candidate);
    } catch {
      /* try next */
    }
  }
  throw new Error("Playwright not found. Install it with `npm i -D playwright` in video/.");
}
const { chromium } = loadPlaywright();

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "footage");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};

const BASE_URL = option("url", "http://localhost:3100");
const PREVIEW = flag("preview");
const ONLY = option("only", "")
  .split(",")
  .filter(Boolean);
const FPS = 30;
const VIEWPORT = { width: 1440, height: 810 };
// 1440x810 CSS px at 8/3 = 3840x2160 device px.
const DEFAULT_SCALE = 8 / 3;

function ffmpegWriter(file) {
  const ff = spawn(
    "ffmpeg",
    [
      "-y", "-loglevel", "error",
      "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "-",
      "-c:v", "libx264", "-preset", "medium", "-crf", PREVIEW ? "23" : "12",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      file,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((resolve, reject) => {
    ff.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  return {
    write: (buffer) =>
      new Promise((resolve) => (ff.stdin.write(buffer) ? resolve() : ff.stdin.once("drain", resolve))),
    close: async () => {
      ff.stdin.end();
      await done;
    },
  };
}

/** Key timeline helper: holds exactly the keys the script says, at frame boundaries. */
function makeDriver(page, path) {
  // path: [{ keys: "wd", ms }] looping. Returns tick(ms) to call each frame.
  const steps = path.map((step) => ({ keys: new Set(step.keys.split("")), ms: step.ms }));
  const total = steps.reduce((sum, step) => sum + step.ms, 0);
  let elapsed = 0;
  let held = new Set();
  return async (ms) => {
    let t = elapsed % total;
    let current = steps[0];
    for (const step of steps) {
      if (t < step.ms) {
        current = step;
        break;
      }
      t -= step.ms;
    }
    for (const key of held) if (!current.keys.has(key)) await page.keyboard.up(key);
    for (const key of current.keys) if (!held.has(key)) await page.keyboard.down(key);
    held = new Set(current.keys);
    elapsed += ms;
  };
}

async function runScene(browser, scene) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: PREVIEW ? 1 : (scene.scale ?? DEFAULT_SCALE) });
  await context.addInitScript({ path: join(here, "virtual-clock.js") });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${BASE_URL}/?room=${scene.room}&server=local&intro=0`, { waitUntil: "load" });
  await page.mouse.move(VIEWPORT.width - 2, VIEWPORT.height - 2);

  const frameMs = 1000 / FPS;
  const drive = makeDriver(page, scene.path);
  const step = async () => {
    await drive(frameMs);
    await page.evaluate((ms) => window.__vclockAdvance(ms), frameMs);
  };

  // Warm-up (not recorded): let the reveal finish, sparklines fill, setup keys land.
  const warmFrames = Math.round(scene.warmupMs / frameMs);
  for (let frame = 0; frame < warmFrames; frame += 1) {
    for (const action of scene.setup ?? []) {
      if (Math.round(action.atMs / frameMs) === frame) await page.keyboard.press(action.key);
    }
    await step();
  }

  const totalFrames = Math.round((scene.durationMs / 1000) * FPS);
  const file = join(outDir, `${scene.name}${PREVIEW ? ".preview" : ""}.mp4`);
  const writer = ffmpegWriter(file);
  const started = Date.now();
  for (let frame = 0; frame < totalFrames; frame += 1) {
    for (const action of scene.actions ?? []) {
      if (action.frame === frame) await page.keyboard.press(action.key);
    }
    await step();
    await writer.write(await page.screenshot({ type: "jpeg", quality: 94 }));
    if (frame % 30 === 0) {
      process.stdout.write(`  ${scene.name}: frame ${frame}/${totalFrames} (${((Date.now() - started) / 1000).toFixed(0)} s)\n`);
    }
  }
  await writer.close();
  await context.close();
  if (errors.length) console.warn(`  ${scene.name}: ${errors.length} console errors`, errors.slice(0, 3));
  console.log(`✓ ${file}`);
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const scene of SCENES) {
    if (ONLY.length && !ONLY.includes(scene.name)) continue;
    console.log(`● ${scene.name}: ${scene.description}`);
    await runScene(browser, scene);
  }
} finally {
  await browser.close();
}
