import { Composition } from "remotion";

import { DURATION, Launch } from "./Launch";
import timeline from "./timeline.json";

export function Root() {
  return (
    <Composition
      id="SyncLabLaunch"
      component={Launch}
      durationInFrames={DURATION}
      fps={timeline.fps}
      width={timeline.width}
      height={timeline.height}
    />
  );
}
