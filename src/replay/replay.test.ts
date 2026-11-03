import { describe, expect, it } from "vitest";
import { headlessGame, startRun } from "../test/harness";
import type { Game } from "../game/Game";
import type { Input } from "../engine/Input";
import { replayInput, replayRun } from "./replayRun";
import { encodeMove, decodeMove, parseRunLog, serializeRunLog, SIM_VERSION, type RunLog } from "./runLog";

function scriptedRun(seconds: number, aspect = 16 / 9) {
  let tick = 0;
  const game = headlessGame(() => ({ x: Math.cos(tick / 90) + (tick % 700 < 90 ? 1 : 0), y: Math.sin(tick / 130) }));
  game.aspectSource = () => aspect;
  game.chooseHero("keel");
  startRun(game);
  const input = game["input"] as unknown as { consumeDash: () => boolean; consumeAbility: () => boolean };
  input.consumeDash = () => tick % 170 === 0;
  input.consumeAbility = () => tick % 400 === 0;
  let cards = 0;
  while (game.runTick < seconds * 60 && game.phase !== "lost") {
    tick++;
    if (game.phase === "levelup") {
      cards++;
      if (cards % 7 === 0 && game.rerolls > 0 && game.choiceMode === "levelup") game.rerollCards();
      else if (cards % 11 === 0 && game.choiceMode === "levelup") game.skipCards();
      else game.pickUpgrade(cards % game.levelUpChoices.length);
      continue;
    }
    if (game.phase === "cinematic" && game.cinematic) game.cinematic.t += 99;
    if (game.phase === "cutscene") game.cutscene.skip();
    game.update(1 / 60);
  }
  return { game, log: game.runLog() };
}

function replayerFor(log: RunLog): Game {
  const game = headlessGame();
  const scripted = replayInput(log, () => game.runTick);
  const input = game["input"] as unknown as Input & typeof scripted;
  input.moveVector = scripted.moveVector;
  input.consumeDash = scripted.consumeDash;
  input.consumeAbility = scripted.consumeAbility;
  return game;
}

describe("move encoding", () => {
  it("survives a round trip", () => {
    for (let code = 0; code <= 256; code++) expect(encodeMove(decodeMove(code))).toBe(code);
  });
});

describe("replay", () => {
  it("records everything needed and replays to the same state", () => {
    const { game, log } = scriptedRun(180);
    expect(log.sim).toBe(SIM_VERSION);
    expect(log.choices.length).toBeGreaterThan(3);
    expect(log.dashes.length).toBeGreaterThan(0);
    expect(log.checkpoints.length).toBeGreaterThan(1);
    const verdict = replayRun(replayerFor(log), log);
    expect(verdict).toMatchObject({ ok: true, kills: game.stats.kills, level: game.player.level });
  });

  it("is not affected by earlier runs in the same page", () => {
    const { log } = scriptedRun(60);
    scriptedRun(30);
    const game = replayerFor(log);
    startRun(game);
    expect(replayRun(game, log).ok).toBe(true);
  });

  it("replays regardless of the verifier's own window, and records aspect changes", () => {
    const { log } = scriptedRun(60, 9 / 19);
    const game = replayerFor(log);
    Object.assign(game["canvas"], { clientWidth: 2000, clientHeight: 400 });
    expect(replayRun(game, log).ok).toBe(true);
  });

  it("rejects tampered runs", () => {
    const { log } = scriptedRun(60);
    const edited: RunLog = structuredClone(log);
    edited.moves[1] = (edited.moves[1] ?? 0) + 200;
    edited.moves[edited.moves.length - 1] = Math.max(1, (edited.moves.at(-1) ?? 1) - 200);
    expect(replayRun(replayerFor(edited), edited).ok).toBe(false);
    const fake: RunLog = { ...structuredClone(log), finalHash: log.finalHash + 1 };
    expect(replayRun(replayerFor(fake), fake)).toMatchObject({ ok: false, reason: "final-state-mismatch" });
  });

  it("rejects other versions and debug-tainted runs", () => {
    const { log } = scriptedRun(5);
    expect(replayRun(replayerFor(log), { ...log, sim: SIM_VERSION + 1 })).toMatchObject({ ok: false, reason: "wrong-game-version" });
    expect(replayRun(replayerFor(log), { ...log, tainted: true })).toMatchObject({ ok: false, reason: "tainted" });
  });

  it("parses only well-formed logs", () => {
    const { log } = scriptedRun(5);
    expect(parseRunLog(serializeRunLog(log))).not.toBeNull();
    expect(parseRunLog("{}")).toBeNull();
    expect(parseRunLog("not json")).toBeNull();
    expect(parseRunLog(serializeRunLog({ ...log, moves: [999, 1] }))).toBeNull();
  });

  it("keeps a three minute log small", () => {
    const { log } = scriptedRun(180);
    expect(serializeRunLog(log).length).toBeLessThan(40_000);
  });
});
