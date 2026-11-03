import type { Game } from "../game/Game";
import { CHECKPOINT_TICKS, decodeMove, SIM_VERSION, type RunLog } from "./runLog";

export type ReplayVerdict =
  | { ok: true; ticks: number; kills: number; level: number; score: number; timeSec: number; bosses: number }
  | { ok: false; reason: string; atTick?: number };

export type ReplayInput = {
  moveVector(): { x: number; y: number };
  consumeDash(): boolean;
  consumeAbility(): boolean;
};

export function replayInput(log: RunLog, tick: () => number): ReplayInput {
  let moveIndex = 0;
  let moveLeft = log.moves[1] ?? 0;
  const dashes = new Set(log.dashes);
  const abilities = new Set(log.abilities);
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
  };
}

export function replayRun(game: Game, log: RunLog): ReplayVerdict {
  if (log.sim !== SIM_VERSION) return { ok: false, reason: "wrong-game-version" };
  if (log.tainted) return { ok: false, reason: "tainted" };
  let aspectIndex = 0;
  let aspect = log.aspects[0]?.[1] ?? 16 / 9;
  game.aspectSource = () => {
    while (log.aspects[aspectIndex] && log.aspects[aspectIndex]![0] <= game.runTick) aspect = log.aspects[aspectIndex++]![1];
    return aspect;
  };
  game.startReplayableRun(log.seed, log.hero, log.difficulty);
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
    if (game.phase === "cinematic" && game.cinematic) game.cinematic.t += 99;
    if (game.phase === "cutscene") game.cutscene.skip();
    const before = game.runTick;
    game.update(1 / 60);
    if (game.runTick !== before && game.runTick % CHECKPOINT_TICKS === 0) {
      if (log.checkpoints[checkpoint] !== game.stateHash()) return { ok: false, reason: "state-mismatch", atTick: game.runTick };
      checkpoint++;
    }
  }
  if (game.runTick !== log.ticks) return { ok: false, reason: "length-mismatch", atTick: game.runTick };
  if (choice !== log.choices.length) return { ok: false, reason: "unused-choices", atTick: game.runTick };
  if (game.stateHash() !== log.finalHash) return { ok: false, reason: "final-state-mismatch", atTick: game.runTick };
  return { ok: true, ticks: game.runTick, kills: game.stats.kills, level: game.player.level, score: game.score(), timeSec: game.elapsed, bosses: game.stats.bossesDefeated };
}
