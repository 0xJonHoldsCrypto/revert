import type { SfxId } from "../audio/AudioEngine";
import type { MusicTrackId } from "../audio/music";

export type Ease = "linear" | "out" | "in" | "inOut" | "back" | "step";

export type ScoreEvent = { at: number; dur?: number; ch: string; to: number; from?: number; ease?: Ease };
export type ScoreCue = { at: number; sfx?: SfxId; music?: MusicTrackId | null };
export type PanelId = "soc" | "pager" | "explorer" | "face" | "multisig" | "wallet" | "tear" | "vaultSafe" | "signers";
export type Score = {
  id: string;
  bpm: number;
  steps: number;
  panels: PanelId[];
  events: ScoreEvent[];
  cues: ScoreCue[];
  endFlash: boolean;
};

export type CutsceneId = "intro" | "victory";

export const stepSeconds = (score: Score) => 60 / score.bpm / 4;
export const scoreDuration = (score: Score) => score.steps * stepSeconds(score);

type SlamOpts = { fromX?: number; fromY?: number; fromRot?: number; rot?: number; dur?: number; x?: number; y?: number; scale?: number };

function slam(panel: PanelId, at: number, o: SlamOpts = {}): ScoreEvent[] {
  const dur = o.dur ?? 2;
  return [
    { at, ch: `${panel}.visible`, to: 1, ease: "step" },
    { at, dur, ch: `${panel}.x`, from: o.fromX ?? 0, to: o.x ?? 0, ease: "out" },
    { at, dur, ch: `${panel}.y`, from: o.fromY ?? -1.6, to: o.y ?? 0, ease: "out" },
    { at, dur, ch: `${panel}.rot`, from: o.fromRot ?? 0.13, to: o.rot ?? -0.025, ease: "out" },
    { at, ch: `${panel}.scale`, to: o.scale ?? 1, ease: "step" },
    { at, ch: `${panel}.dim`, to: 1, ease: "step" },
  ];
}

function recede(panel: PanelId, at: number, dur = 2): ScoreEvent[] {
  return [
    { at, dur, ch: `${panel}.dim`, to: 0.62, ease: "out" },
    { at, dur, ch: `${panel}.scale`, to: 0.92, ease: "out" },
  ];
}

const hide = (panel: PanelId, at: number): ScoreEvent => ({ at, ch: `${panel}.visible`, to: 0, ease: "step" });

function shake(at: number, amount: number, dur: number): ScoreEvent[] {
  return [
    { at, ch: "cam.shake", to: amount, ease: "step" },
    { at, dur, ch: "cam.shake", to: 0, ease: "out" },
  ];
}

function lightPunch(at: number, peak: number, rest: number, dur: number): ScoreEvent[] {
  return [
    { at, ch: "cam.light", to: peak, ease: "step" },
    { at, dur, ch: "cam.light", to: rest, ease: "out" },
  ];
}

export const INTRO_SCORE: Score = {
  id: "intro",
  bpm: 124,
  steps: 106,
  panels: ["soc", "pager", "explorer", "face", "multisig", "wallet", "tear"],
  endFlash: true,
  cues: [
    { at: 0, music: "intro" },
    { at: 12, sfx: "pager" },
    { at: 19, sfx: "whoosh" },
    { at: 22, sfx: "alarm" },
    { at: 34, sfx: "blip" },
    { at: 35, sfx: "blip" },
    { at: 53, sfx: "blip" },
    { at: 56, sfx: "sting" },
    { at: 62, sfx: "snore" },
    { at: 72, sfx: "riser" },
    { at: 83, sfx: "impact" },
    { at: 86, sfx: "glitch" },
    { at: 93, sfx: "suck" },
    { at: 104, sfx: "whoosh" },
  ],
  events: [
    { at: 0, ch: "cam.light", to: 1, ease: "step" },
    { at: 0, ch: "cam.flash", to: 0, ease: "step" },
    ...slam("soc", 0, { fromY: 0, fromRot: -0.02, rot: -0.02, dur: 1 }),
    { at: 0, dur: 12, ch: "soc.zoom", from: 1, to: 1.1, ease: "linear" },

    ...recede("soc", 12),
    ...slam("pager", 12, { fromY: -1.7, fromRot: 0.16, rot: -0.03, dur: 1.3 }),
    ...shake(12, 0.05, 6),

    { at: 18, dur: 3, ch: "pager.scale", to: 3.1, ease: "in" },
    hide("soc", 21),
    hide("pager", 21),
    ...slam("explorer", 21, { fromY: 0, fromRot: 0, rot: 0, dur: 1 }),
    ...lightPunch(21, 2.1, 1.05, 4),
        { at: 21, dur: 35, ch: "explorer.counter", from: 1.2, to: 3.84, ease: "in" },
    { at: 34, ch: "explorer.gm", to: 1, ease: "step" },
    { at: 53, ch: "explorer.thx", to: 1, ease: "step" },

    ...recede("explorer", 56),
    ...slam("face", 56, { fromX: 1.7, fromY: 0, fromRot: 0.15, rot: 0.03, dur: 1.5 }),
    ...shake(56, 0.035, 5),

    ...recede("face", 62),
    ...slam("multisig", 62, { fromX: -1.7, fromY: 0.1, fromRot: -0.15, rot: -0.02, dur: 1.6 }),

    hide("explorer", 72),
    hide("face", 72),
    hide("multisig", 72),
    ...slam("wallet", 72, { fromY: -1.7, fromRot: 0.09, rot: 0.02, dur: 1.5 }),
    { at: 72, dur: 11, ch: "cam.light", to: 2.2, ease: "in" },
    { at: 72, dur: 11, ch: "wallet.zoom", from: 1, to: 1.3, ease: "in" },
    { at: 72, dur: 11, ch: "cam.shake", from: 0, to: 0.03, ease: "in" },
    { at: 72, dur: 11, ch: "wallet.thumb", from: 0, to: 0.65, ease: "in" },

    { at: 83, ch: "wallet.thumb", to: 1, ease: "step" },
    { at: 83, ch: "cam.impact", to: 1, ease: "step" },
    { at: 84.2, ch: "cam.impact", to: 0, ease: "step" },
    ...shake(83, 0.09, 4),
    ...lightPunch(83, 3, 1.1, 3),

    hide("wallet", 86),
    ...slam("tear", 86, { fromY: 0, fromRot: 0, rot: 0, dur: 0.6 }),
    { at: 86, dur: 7, ch: "tear.rift", from: 0, to: 0.42, ease: "out" },
    { at: 88, ch: "tear.gas", to: 1, ease: "step" },
    { at: 93, dur: 9, ch: "tear.rift", to: 1, ease: "in" },
    { at: 93, dur: 9, ch: "tear.pull", from: 0, to: 1, ease: "in" },
    { at: 93, dur: 9, ch: "cam.roll", from: 0, to: 0.22, ease: "in" },
    { at: 93, dur: 9, ch: "cam.light", to: 2.4, ease: "in" },
    { at: 93, dur: 11, ch: "cam.shake", from: 0.01, to: 0.06, ease: "in" },
    { at: 100, dur: 4, ch: "tear.scale", from: 1, to: 0.05, ease: "in" },
    { at: 101, dur: 5, ch: "cam.flash", from: 0, to: 1, ease: "in" },
  ],
};

export const VICTORY_SCORE: Score = {
  id: "victory",
  bpm: 112,
  steps: 72,
  panels: ["vaultSafe", "signers"],
  endFlash: false,
  cues: [
    { at: 0, music: "win" },
    { at: 8, sfx: "riser" },
    { at: 22, sfx: "txConfirmed" },
    { at: 36, sfx: "whoosh" },
    { at: 44, sfx: "snore" },
    { at: 54, sfx: "blip" },
  ],
  events: [
    { at: 0, ch: "cam.light", to: 1.1, ease: "step" },
    { at: 0, ch: "cam.flash", to: 0, ease: "step" },
    ...slam("vaultSafe", 0, { fromY: 0, fromRot: 0, rot: 0, dur: 1 }),
    { at: 0, ch: "vaultSafe.counter", to: 3.84, ease: "step" },
    { at: 8, dur: 14, ch: "vaultSafe.counter", to: 0, ease: "inOut" },
    { at: 22, ch: "vaultSafe.safe", to: 1, ease: "step" },
    ...lightPunch(22, 2.4, 1.1, 5),
    ...shake(22, 0.03, 4),
    ...recede("vaultSafe", 36),
    ...slam("signers", 36, { fromX: 1.7, fromY: 0, fromRot: 0.12, rot: -0.02, dur: 2 }),
    { at: 44, ch: "signers.awake", to: 1, ease: "step" },
    { at: 54, ch: "signers.line", to: 1, ease: "step" },
  ],
};

export const SCORES: Record<CutsceneId, Score> = { intro: INTRO_SCORE, victory: VICTORY_SCORE };
