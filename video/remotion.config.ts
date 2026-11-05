import { Config } from "@remotion/cli/config";

// Use the machine's Chromium when REMOTION_BROWSER is set (e.g. CI/containers);
// otherwise Remotion downloads its own headless shell.
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setChromiumOpenGlRenderer("swangle");
