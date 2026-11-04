import type { Game } from "../game/Game";
import { decodeMove, setupOf, SIM_VERSION, type RunLog } from "./runLog";
import { dailyPlan } from "../daily";
import { heroAvailable } from "../data/unlocks";
import { OVERCLOCK_LOG_BASE } from "../data/spikes";

export type ReplayVerdict =
  | { ok: true; ticks: number; kills: number; level: number; score: number; timeSec: number; bosses: number; ranked: boolean; mode: RunLog["mode"] }
  | { ok: false; reason: string; atTick?: number };

export type ReplayInput = {
  moveVector(): { x: number; y: number };
  consumeDash(): boolean;
  consumeAbility(): boolean;
  consumeOverclock(): boolean;
};

export function replayInput(log: RunLog, tick: () => number): ReplayInput {
  let moveIndex = 0;
  let moveLeft = log.moves[1] ?? 0;
  const dashes = new Set(log.dashes);
  const abilities = new Set(log.abilities.filter((t) => t < OVERCLOCK_LOG_BASE));
  const overclocks = new Set(log.abilities.filter((t) => t >= OVERCLOCK_LOG_BASE).map((t) => t - OVERCLOCK_LOG_BASE));
  return {
    moveVector() {
      const code = log.moves[moveIndex] ?? 0;
      moveLeft--;
      if (moveLeft <= 0) {
        moveIndex += 2;
        moveLeft = log.moves[moveIndex + 1] ?? 0;
      }
      return decodeMove(code);
    },
    consumeDash: () => dashes.delete(tick()),
    consumeAbility: () => abilities.delete(tick()),
    consumeOverclock: () => overclocks.delete(tick()),
  };
}

export function replayRun(game: Game, log: RunLog): ReplayVerdict {
  if (log.sim !== SIM_VERSION) return { ok: false, reason: "wrong-game-version" };
  if (log.tainted) return { ok: false, reason: "tainted" };
  if (log.mode === "daily") {
    const plan = log.date ? dailyPlan(log.date) : null;
    if (!plan || plan.seed !== log.seed || plan.hero !== log.hero || plan.difficulty !== log.difficulty || plan.setup.mods.join() !== log.mods.join() || plan.setup.unlocked.join() !== log.unlocked.join() || Object.keys(log.perks).length) return { ok: false, reason: "daily-mismatch" };
  } else if (!heroAvailable(log.hero, log.unlocked)) {
    return { ok: false, reason: "locked-hero" };
  }
  let aspectIndex = 0;
  let aspect = log.aspects[0]?.[1] ?? 16 / 9;
  game.aspectSource = () => {
    while (log.aspects[aspectIndex] && log.aspects[aspectIndex]![0] <= game.runTick) aspect = log.aspects[aspectIndex++]![1];
    return aspect;
  };
  game.startReplayableRun(log.seed, log.hero, log.difficulty, setupOf(log));
  game.cinematic = null;
  game.player.lift = 0;
  game.setPhase("playing");
  let choice = 0;
  let checkpoint = 0;
  const limit = log.ticks * 2 + log.choices.length + 100_000;
  for (let guard = 0; guard < limit; guard++) {
    if (game.phase === "levelup") {
      const next = log.choices[choice++];
      if (!next) return { ok: false, reason: "missing-choice", atTick: game.runTick };
      if (next[0] !== game.runTick) return { ok: false, reason: "choice-tick-mismatch", atTick: game.runTick };
      if (next[1] === "pick") game.pickUpgrade(next[2]);
      else if (next[1] === "reroll") game.rerollCards();
      else if (next[1] === "skip") game.skipCards();
      else game.banishCard(next[2]);
      continue;
    }
    if (game.runTick >= log.ticks || game.phase === "lost") break;
    if (game.phase === "cinematic") game.skipCinematic();
    if (game.phase === "cutscene") game.cutscene.skip();
    game.update(1 / 60);
    if (game.checkpointCount > checkpoint) {
      if (log.checkpoints[checkpoint] !== game.lastCheckpoint) return { ok: false, reason: "state-mismatch", atTick: game.runTick };
      checkpoint++;
    }
  }
  if (checkpoint !== log.checkpoints.length) return { ok: false, reason: "checkpoint-count-mismatch", atTick: game.runTick };
  if (game.runTick !== log.ticks) return { ok: false, reason: "length-mismatch", atTick: game.runTick };
  if (choice !== log.choices.length) return { ok: false, reason: "unused-choices", atTick: game.runTick };
  if (game.stateHash() !== log.finalHash) return { ok: false, reason: "final-state-mismatch", atTick: game.runTick };
  return { ok: true, ticks: game.runTick, kills: game.stats.kills, level: game.player.level, score: game.score(), timeSec: game.elapsed, bosses: game.stats.bossesDefeated, ranked: log.ranked, mode: log.mode };
}
