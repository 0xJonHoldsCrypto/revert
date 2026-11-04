import { describe, expect, it } from "vitest";
import { headlessGame, startRun } from "../test/harness";
import type { Game } from "../game/Game";
import type { Input } from "../engine/Input";
import { replayInput, replayRun } from "./replayRun";
import { encodeMove, decodeMove, parseRunLog, serializeRunLog, SIM_VERSION, type RunLog } from "./runLog";
import type { RunPlan } from "../game/Game";
import { defaultSetup } from "../game/runSetup";
import { dailyPlan } from "../daily";
import { heroUnlockId, toolUnlockId } from "../data/unlocks";
import { TRACE_DEBUG } from "../data/trace";

function scriptedRun(seconds: number, aspect = 16 / 9, idle = 0, plan?: RunPlan) {
  let tick = 0;
  const game = headlessGame(() => ({ x: Math.cos(tick / 90) + (tick % 700 < 90 ? 1 : 0), y: Math.sin(tick / 130) }));
  game.aspectSource = () => aspect;
  game.chooseHero("keel");
  if (plan) game.runPlan = plan;
  startRun(game);
  const input = game["input"] as unknown as { consumeDash: () => boolean; consumeAbility: () => boolean };
  input.consumeDash = () => tick % 170 === 0;
  input.consumeAbility = () => tick % 400 === 0;
  let cards = 0;
  while (game.runTick < seconds * 60 && game.phase !== "lost") {
    tick++;
    if (game.phase === "levelup") {
      for (let i = 0; i < idle; i++) game.update(1 / 60);
      cards++;
      if (cards % 7 === 0 && game.rerolls > 0 && game.choiceMode === "levelup") game.rerollCards();
      else if (cards % 11 === 0 && game.choiceMode === "levelup") game.skipCards();
      else game.pickUpgrade(cards % game.levelUpChoices.length);
      continue;
    }
    if (game.phase === "cinematic" && game.cinematic) game.cinematic.t += 99;
    if (game.phase === "cutscene") game.cutscene.skip();
    game.update(1 / 60);
    if (idle && game.phase === "playing" && game.runTick % 200 === 0) {
      game.togglePause();
      for (let i = 0; i < idle; i++) game.update(1 / 60);
      game.togglePause();
    }
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
  input.consumeOverclock = scripted.consumeOverclock;
  return game;
}

function scriptedWin(branch: "endless" | "cashout", endlessSeconds = 25) {
  let tick = 0;
  const game = headlessGame(() => ({ x: Math.cos(tick / 90), y: Math.sin(tick / 130) }));
  game.chooseHero("keel");
  game.runPlan = { setup: defaultSetup(), seed: 4242 };
  startRun(game);
  let endlessAt = 0;
  while (game.runTick < 60 * 120 && game.phase !== "lost") {
    tick++;
    if (game.phase === "levelup") {
      const win = game.choiceMode === "popup" && game.levelUpChoices.some((c) => c.id === "win-endless");
      if (win) {
        game.pickUpgrade(branch === "endless" ? 0 : 1);
        endlessAt = game.runTick;
      } else game.pickUpgrade(0);
      continue;
    }
    if (game.phase === "cinematic" && game.cinematic) game.cinematic.t += 99;
    if (game.phase === "cutscene") game.cutscene.skip();
    game.update(1 / 60);
    if (endlessAt && game.runTick - endlessAt > endlessSeconds * 60) break;
  }
  return { game, log: game.runLog(), winTick: endlessAt };
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

  it("replays a long run through network events, whales and the new tools", () => {
    const { game, log } = scriptedRun(330, 16 / 9, 0, { setup: defaultSetup(), seed: 31337 });
    expect(game.miniEvents.fired.length).toBeGreaterThanOrEqual(1);
    const verdict = replayRun(replayerFor(log), log);
    expect(verdict).toMatchObject({ ok: true, kills: game.stats.kills, level: game.player.level });
  });

  it("verifies runs that sat through many ticks of level-up and pause", () => {
    const { log } = scriptedRun(90, 16 / 9, 37);
    expect(replayRun(replayerFor(log), log).ok).toBe(true);
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
    const forged: RunLog = { ...structuredClone(log), checkpoints: log.checkpoints.map((h) => h + 1) };
    expect(replayRun(replayerFor(forged), forged)).toMatchObject({ ok: false, reason: "state-mismatch" });
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

  it("replays runs with meta perks, contracts and locked tools from the log alone", () => {
    const setup = { ...defaultSetup(), perks: { edge: 3, vault: 2, reorg: 2, blocklist: 1, seed: 2 }, mods: ["glass-cannon" as const, "hunted" as const, "inflation" as const], unlocked: [heroUnlockId("diff")] };
    const { game, log } = scriptedRun(120, 16 / 9, 0, { setup });
    expect(log).toMatchObject({ perks: setup.perks, mods: setup.mods, unlocked: setup.unlocked, mode: "standard", date: null, ranked: false });
    const parsed = parseRunLog(serializeRunLog(log))!;
    expect(parsed).not.toBeNull();
    expect(replayRun(replayerFor(parsed), parsed)).toMatchObject({ ok: true, kills: game.stats.kills, ranked: false, mode: "standard" });
    const fresh = replayerFor(parsed);
    expect(replayRun(fresh, { ...parsed, perks: { edge: 2, vault: 2, reorg: 2, blocklist: 1, seed: 2 } })).toMatchObject({ ok: false });
    expect(replayRun(replayerFor(parsed), { ...parsed, mods: ["glass-cannon", "hunted"] })).toMatchObject({ ok: false });
    expect(replayRun(replayerFor(parsed), { ...parsed, unlocked: [...parsed.unlocked, toolUnlockId("whale-alert")] })).toMatchObject({ ok: false });
  });

  it("never offers a locked tool", () => {
    const { game } = scriptedRun(1, 16 / 9, 0, { setup: { ...defaultSetup(), unlocked: [] } });
    for (let i = 0; i < 40; i++) {
      game.triggerLevelUp();
      expect(game.levelUpChoices.map((c) => c.id)).not.toContain("weapon-whale-alert");
      expect(game.levelUpChoices.map((c) => c.id)).not.toContain("weapon-nonce-shard");
      if (game.phase === "levelup") game.skipCards();
    }
  });

  it("replays a daily run and pins it to the date", () => {
    const plan = dailyPlan("2026-11-03");
    const { game, log } = scriptedRun(90, 16 / 9, 0, plan);
    expect(game.player.characterId).toBe(plan.hero);
    expect(log).toMatchObject({ seed: plan.seed, hero: plan.hero, mode: "daily", date: "2026-11-03", mods: plan.setup.mods, ranked: true });
    expect(replayRun(replayerFor(log), log).ok).toBe(true);
    expect(replayRun(replayerFor(log), { ...log, date: "2026-11-04" })).toMatchObject({ ok: false, reason: "daily-mismatch" });
    expect(replayRun(replayerFor(log), { ...log, mods: [] })).toMatchObject({ ok: false, reason: "daily-mismatch" });
  });

  it("rejects a standard run with a hero that was locked", () => {
    const { log } = scriptedRun(2);
    expect(replayRun(replayerFor(log), { ...log, hero: "trace", unlocked: [] })).toMatchObject({ ok: false, reason: "locked-hero" });
  });

  it("rejects logs with perks over the cap, unknown contracts or a lying ranked flag", () => {
    const { log } = scriptedRun(2);
    const bad = (patch: Partial<Record<keyof RunLog, unknown>>) => parseRunLog(JSON.stringify({ ...log, ...patch }));
    expect(bad({})).not.toBeNull();
    expect(bad({ perks: { edge: 5, vault: 5, alpha: 4 } })).toBeNull();
    expect(bad({ perks: { edge: 9 } })).toBeNull();
    expect(bad({ perks: { edge: 1 } })).toBeNull();
    expect(bad({ perks: { edge: 1 }, ranked: false })).not.toBeNull();
    expect(bad({ mods: ["moon-mode"] })).toBeNull();
    expect(bad({ mode: "daily", date: null })).toBeNull();
    expect(bad({ unlocked: ["hero:keel"] })).toBeNull();
    expect(bad({ format: 1 })).toBeNull();
  });

  it("keeps a three minute log small", () => {
    const { log } = scriptedRun(180);
    expect(serializeRunLog(log).length).toBeLessThan(40_000);
  });

  describe("through the win", () => {
    const tune = () => {
      TRACE_DEBUG.rateMult = 700;
      TRACE_DEBUG.finaleHpMult = 0.0001;
    };
    const untune = () => {
      TRACE_DEBUG.rateMult = 1;
      TRACE_DEBUG.finaleHpMult = 1;
    };

    it("replays a run that wins and keeps playing in endless", () => {
      tune();
      try {
        const { game, log } = scriptedWin("endless");
        expect(game.won).toBe(true);
        expect(game.endless).toBe(true);
        expect(log.choices.some(([, type]) => type === "pick")).toBe(true);
        const parsed = parseRunLog(serializeRunLog(log))!;
        const replayer = replayerFor(parsed);
        const verdict = replayRun(replayer, parsed);
        expect(verdict).toMatchObject({ ok: true, kills: game.stats.kills });
        expect(replayer.won).toBe(true);
        expect(replayer.endless).toBe(true);
        expect(replayer.stats.winTime).toBeCloseTo(game.stats.winTime, 6);
        expect(replayer.loops).toBe(game.loops);
      } finally {
        untune();
      }
    });

    it("replays a run that wins and cashes out", () => {
      tune();
      try {
        const { game, log } = scriptedWin("cashout");
        expect(game.phase).toBe("lost");
        expect(game.cashedOut).toBe(true);
        const replayer = replayerFor(log);
        expect(replayRun(replayer, log)).toMatchObject({ ok: true, score: game.score() });
        expect(replayer.phase).toBe("lost");
        expect(replayer.won).toBe(true);
      } finally {
        untune();
      }
    });

    it("rejects a win log whose continue and cash-out choice was swapped", () => {
      tune();
      try {
        const { log, winTick } = scriptedWin("endless");
        const swapped: RunLog = structuredClone(log);
        const at = swapped.choices.findIndex(([tick, type]) => tick === winTick && type === "pick");
        expect(at).toBeGreaterThanOrEqual(0);
        swapped.choices[at] = [winTick, "pick", 1];
        expect(replayRun(replayerFor(swapped), swapped).ok).toBe(false);
      } finally {
        untune();
      }
    });
  });
});
