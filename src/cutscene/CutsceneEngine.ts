import type { AudioEngine } from "../audio/AudioEngine";
import { scoreDuration, SCORES, stepSeconds, type CutsceneId, type Ease, type Score, type ScoreCue } from "./scores";

export type { CutsceneId };

function applyEase(t: number, ease: Ease | undefined): number {
  switch (ease) {
    case "out": return 1 - (1 - t) * (1 - t);
    case "in": return t * t;
    case "inOut": return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    case "back": {
      const c = 1.7;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    }
    case "step": return 1;
    default: return t;
  }
}

export type CompiledSpan = { start: number; end: number; from: number | null; to: number; ease?: Ease };

export function compileChannels(score: Score): Map<string, CompiledSpan[]> {
  const channels = new Map<string, CompiledSpan[]>();
  const spans = [...score.events].sort((a, b) => a.at - b.at);
  for (const e of spans) {
    const list = channels.get(e.ch) ?? [];
    list.push({ start: e.at, end: e.at + (e.dur ?? 0), from: e.from ?? null, to: e.to, ease: e.ease });
    channels.set(e.ch, list);
  }
  return channels;
}

export function sampleChannel(spans: CompiledSpan[] | undefined, step: number, fallback: number): number {
  if (!spans) return fallback;
  let value = fallback;
  for (const span of spans) {
    if (step < span.start) break;
    const from = span.from ?? value;
    if (step >= span.end) {
      value = span.to;
      continue;
    }
    const t = (step - span.start) / (span.end - span.start);
    value = from + (span.to - from) * applyEase(t, span.ease);
  }
  return value;
}

export class CutsceneEngine {
  active = false;
  score: Score | null = null;
  time = 0;
  skipProgress = 0;
  private cues: ScoreCue[] = [];
  private cueIndex = 0;
  private onComplete: (() => void) | null = null;
  private audio: AudioEngine | null = null;

  setAudio(audio: AudioEngine) {
    this.audio = audio;
  }

  get step(): number {
    return this.score ? this.time / stepSeconds(this.score) : 0;
  }

  play(id: CutsceneId, onComplete: () => void) {
    this.score = SCORES[id];
    this.cues = [...this.score.cues].sort((a, b) => a.at - b.at);
    this.cueIndex = 0;
    this.time = 0;
    this.onComplete = onComplete;
    this.active = true;
    this.fireCues();
  }

  skip() {
    if (this.active) this.finish();
  }

  advance() {
    return;
  }

  update(dt: number) {
    if (!this.active || !this.score) return;
    this.time += dt;
    this.fireCues();
    if (this.time >= scoreDuration(this.score)) this.finish();
  }

  private fireCues() {
    while (this.cueIndex < this.cues.length && this.cues[this.cueIndex]!.at <= this.step) {
      const cue = this.cues[this.cueIndex++]!;
      if (cue.sfx) this.audio?.play(cue.sfx);
      if (cue.music !== undefined) this.audio?.setMusic(cue.music, true);
    }
  }

  private finish() {
    this.active = false;
    const cb = this.onComplete;
    this.onComplete = null;
    cb?.();
  }
}
