import {
  FIXED_DT,
  MAX_CATCH_UP_STEPS,
  SNAPSHOT_INTERVAL_MS,
} from "@synclab/shared";

interface LoopMetrics {
  actualTickRate: number;
  actualSnapshotRate: number;
}

export class FixedTimestepLoop {
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private previousTime = 0;
  private simulationAccumulator = 0;
  private snapshotAccumulatorMs = 0;
  private ticksInWindow = 0;
  private snapshotsInWindow = 0;
  private metricsWindowStartedAt = 0;
  private metrics: LoopMetrics = { actualTickRate: 0, actualSnapshotRate: 0 };

  constructor(
    private readonly step: () => void,
    private readonly broadcast: (metrics: LoopMetrics) => void,
  ) {}

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.previousTime = performance.now();
    this.metricsWindowStartedAt = this.previousTime;
    this.run();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private run = (): void => {
    if (!this.running) {
      return;
    }

    const now = performance.now();
    const elapsedMs = Math.min(now - this.previousTime, 250);
    this.previousTime = now;
    this.simulationAccumulator += elapsedMs / 1_000;
    this.snapshotAccumulatorMs += elapsedMs;

    let catchUpSteps = 0;
    while (
      this.simulationAccumulator >= FIXED_DT &&
      catchUpSteps < MAX_CATCH_UP_STEPS
    ) {
      this.step();
      this.simulationAccumulator -= FIXED_DT;
      this.ticksInWindow += 1;
      catchUpSteps += 1;
    }

    if (catchUpSteps === MAX_CATCH_UP_STEPS && this.simulationAccumulator >= FIXED_DT) {
      this.simulationAccumulator = 0;
    }

    while (this.snapshotAccumulatorMs >= SNAPSHOT_INTERVAL_MS) {
      this.broadcast(this.metrics);
      this.snapshotAccumulatorMs -= SNAPSHOT_INTERVAL_MS;
      this.snapshotsInWindow += 1;
    }

    const windowElapsed = now - this.metricsWindowStartedAt;
    if (windowElapsed >= 1_000) {
      const scale = 1_000 / windowElapsed;
      this.metrics = {
        actualTickRate: this.ticksInWindow * scale,
        actualSnapshotRate: this.snapshotsInWindow * scale,
      };
      this.ticksInWindow = 0;
      this.snapshotsInWindow = 0;
      this.metricsWindowStartedAt = now;
    }

    this.timer = setTimeout(this.run, 2);
  };
}
