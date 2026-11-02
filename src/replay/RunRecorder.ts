export type ReplayFrame = {
  t: number;
  mx: number;
  my: number;
  dash: number;
  seed: number;
};

export type ReplayPayload = {
  version: 1;
  characterId: string;
  seed: number;
  frames: ReplayFrame[];
  score: number;
  timeSurvived: number;
  kills: number;
};

export class RunRecorder {
  frames: ReplayFrame[] = [];
  seed = (Math.random() * 2 ** 31) | 0;
  private lastSample = 0;

  reset() {
    this.frames = [];
    this.seed = (Math.random() * 2 ** 31) | 0;
    this.lastSample = 0;
  }

  sample(elapsed: number, mx: number, my: number, dash: boolean) {
    if (elapsed - this.lastSample < 1 / 30) return;
    this.lastSample = elapsed;
    this.frames.push({
      t: Math.round(elapsed * 1000),
      mx: Math.round(mx * 100) / 100,
      my: Math.round(my * 100) / 100,
      dash: dash ? 1 : 0,
      seed: this.seed,
    });
  }

  build(characterId: string, score: number, timeSurvived: number, kills: number): ReplayPayload {
    return {
      version: 1,
      characterId,
      seed: this.seed,
      frames: this.frames,
      score,
      timeSurvived,
      kills,
    };
  }
}
