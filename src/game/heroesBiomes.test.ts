import { describe, expect, it } from "vitest";
import { headlessGame, stepSeconds } from "../test/harness";
import { biomeAt, biomeOfFloorCell, BIOMES, FLOOR_CELL, setBiomeSeed, type BiomeId } from "../data/environment";
import { BIOME_HAZARD_ORDER, BIOME_HAZARDS, HAZARD_OF_BIOME } from "../data/biomeHazards";
import { getCharacter, LEDGER_SHIELD_FRACTION, LEDGER_THORNS_MULT, RELAY_MAX_RIGS, RELAY_RIG_OUTPUT } from "../data/characters";
import { SIDEKICKS } from "../data/sidekicks";
import { heroAvailable, heroUnlockId, UNLOCK_BY_ID } from "../data/unlocks";
import { dailyPlan } from "../daily";
import { utcDate } from "../daily";
import { replayInput, replayRun } from "../replay/replayRun";
import { MAX_HAZARDS } from "./threats";
import { BIOME_HAZARD_FIRST_SEC, CHILL_SPEED_MULT } from "./biomeHazards";
import type { Game } from "./Game";
import type { Input } from "../engine/Input";
import type { CharacterId, Interactable } from "../types";
import type { RunLog } from "../replay/runLog";

function heroGame(hero: CharacterId, seed = 4242, move: () => { x: number; y: number } = () => ({ x: 0, y: 0 })) {
  const game = headlessGame(move);
  game.startReplayableRun(seed, hero, "normal");
  game.cinematic = null;
  game.player.lift = 0;
  game.setPhase("playing");
  return game;
}

function findCell(biome: BiomeId, maxRing = 12): { x: number; y: number } | null {
  let best: { x: number; y: number; d: number } | null = null;
  for (let cx = -maxRing; cx <= maxRing; cx++) {
    for (let cy = -maxRing; cy <= maxRing; cy++) {
      if (biomeOfFloorCell(cx, cy) !== biome) continue;
      const x = (cx + 0.5) * FLOOR_CELL;
      const y = (cy + 0.5) * FLOOR_CELL;
      const d = Math.hypot(x, y);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  return best;
}

function placeIn(game: Game, biome: BiomeId) {
  const at = findCell(biome)!;
  game.player.x = game.player.px = at.x;
  game.player.y = game.player.py = at.y;
  expect(biomeAt(game.player.x, game.player.y)).toBe(biome);
}

describe("new heroes", () => {
  it("Ledger's audit shield soaks a hit and books it back as thorns", () => {
    const game = heroGame("ledger");
    const p = game.player;
    const max = p.maxHp * LEDGER_SHIELD_FRACTION;
    expect(game.ledgerShield).toBeCloseTo(max);
    const target = game.spawnEnemyAt("script-kiddie", p.x + 60, p.y, true);
    target.hp = target.maxHp = 100000;
    const hp = p.hp;
    game.hurtPlayer(10, "script-kiddie");
    expect(p.hp).toBe(hp);
    const blocked = max - game.ledgerShield;
    expect(blocked).toBeGreaterThan(0);
    expect(100000 - target.hp).toBeGreaterThanOrEqual(Math.floor(blocked * LEDGER_THORNS_MULT * game.damageTotal()) - 1);
    p.invuln = 0;
    game.hurtPlayer(10000, "script-kiddie");
    expect(game.ledgerShield).toBe(0);
    expect(p.hp).toBeLessThan(hp);
  });

  it("Ledger's shield recharges only after a quiet spell", () => {
    const game = heroGame("ledger");
    const max = game.ledgerShieldMax();
    game.player.invuln = 0;
    game.hurtPlayer(15, "script-kiddie");
    const after = game.ledgerShield;
    game.god = true;
    game.player.invuln = 999;
    for (let i = 0; i < 120; i++) game.update(1 / 60);
    expect(game.ledgerShield).toBeLessThan(max);
    stepSeconds(game, 6);
    expect(game.ledgerShield).toBeCloseTo(max);
    expect(after).toBeLessThan(max);
  });

  it("other heroes have no audit shield", () => {
    const game = heroGame("keel");
    expect(game.ledgerShield).toBe(0);
    game.hurtPlayer(10, "script-kiddie");
    expect(game.player.hp).toBeLessThan(game.player.maxHp);
  });

  it("Relay starts with a rig, runs three, and gets faster, cheaper rigs", () => {
    const relay = heroGame("relay");
    const keel = heroGame("keel");
    expect(relay.rigs.map((r) => r.kind)).toEqual(["dev-laptop"]);
    expect(keel.rigs).toEqual([]);
    expect(relay.maxRigs()).toBe(RELAY_MAX_RIGS);
    expect(keel.maxRigs()).toBe(2);
    expect(relay.rigOutput(relay.rigs[0]!)).toBeCloseTo(RELAY_RIG_OUTPUT);
    const rack: Interactable = { id: 1, kind: "hardware-rack", x: 0, y: 0, radius: 60, progress: 0, used: false, readyAt: 0, rig: "asic-miner" };
    relay.rigCards("asic-miner", { ...rack })[0]!.apply({} as never);
    relay.rigCards("codebase-guardian", { ...rack })[0]!.apply({} as never);
    expect(relay.rigs.length).toBe(3);
    relay.player.coins = 100;
    const upgrade = relay.rigCards("block-builder", { ...rack }).find((c) => c.id === "rig-upgrade")!;
    upgrade.apply({} as never);
    expect(relay.player.coins).toBe(100 - Math.ceil(20 * 0.7));
    const laptop = relay.rigs[0]!;
    relay.spawnEnemyAt("script-kiddie", relay.player.x + 120, relay.player.y, true);
    laptop.attackTimer = 0;
    relay.update(1 / 60);
    expect(laptop.attackTimer).toBeCloseTo((SIDEKICKS["dev-laptop"].attackCooldown * (1 + laptop.tier * 0.4)) / relay.rigOutput(laptop) / (1 + laptop.tier * 0.4));
    expect(getCharacter("relay").startWeapon).not.toBe(getCharacter("ledger").startWeapon);
  });

  it("are locked behind an achievement or shards, and join the daily rotation", () => {
    for (const hero of ["ledger", "relay"] as const) {
      const def = UNLOCK_BY_ID[heroUnlockId(hero)]!;
      expect(def.shards).toBeGreaterThan(0);
      expect(heroAvailable(hero, [])).toBe(false);
      expect(heroAvailable(hero, [def.id])).toBe(true);
    }
    const heroes = new Set(Array.from({ length: 60 }, (_, i) => dailyPlan(utcDate(Date.UTC(2026, 0, 1) + i * 86_400_000)).hero));
    expect(heroes.has("ledger")).toBe(true);
    expect(heroes.has("relay")).toBe(true);
  });
});

describe("biome map", () => {
  it("assigns the same biomes for the same seed and covers all five", () => {
    const sample = () => {
      const out: BiomeId[] = [];
      for (let cx = -30; cx <= 30; cx += 2) for (let cy = -30; cy <= 30; cy += 2) out.push(biomeOfFloorCell(cx, cy));
      return out;
    };
    setBiomeSeed(9001);
    const a = sample();
    setBiomeSeed(17);
    const other = sample();
    setBiomeSeed(9001);
    expect(sample()).toEqual(a);
    expect(other).not.toEqual(a);
    expect(new Set(a)).toEqual(new Set(BIOMES));
    expect(biomeAt(0, 0)).toBe("mempool");
  });
});

describe("biome hazards", () => {
  it("each biome fires its own telegraphed hazard", () => {
    for (const biome of BIOMES) {
      const game = heroGame("keel", 77);
      placeIn(game, biome);
      game.elapsed = BIOME_HAZARD_FIRST_SEC + 1;
      game.biomeHazards.update();
      const id = HAZARD_OF_BIOME[biome];
      const made = game.hazards.filter((h) => h.source === id);
      expect(made.length).toBeGreaterThan(0);
      for (const h of made) {
        expect(h.windup).toBeGreaterThanOrEqual(1.1);
        expect(h.label).toBe(BIOME_HAZARDS[id].label);
        if (h.track !== undefined) expect(h.windup - h.track).toBeGreaterThanOrEqual(0.5);
      }
      expect(game.biomeHazards.fired).toEqual([id]);
    }
    expect(new Set(BIOMES.map((b) => HAZARD_OF_BIOME[b])).size).toBe(BIOME_HAZARD_ORDER.length);
  });

  it("does not fire before the first window or past the hazard cap", () => {
    const game = heroGame("keel", 78);
    game.biomeHazards.update();
    expect(game.hazards.length).toBe(0);
    game.elapsed = BIOME_HAZARD_FIRST_SEC + 1;
    for (let i = 0; i < MAX_HAZARDS; i++) game.addHazard({ shape: "circle", x: 9999, y: 9999, r: 1, windup: 99, active: 0, damage: 0, color: "#fff", source: "griefer", knock: 0 });
    game.biomeHazards.update();
    expect(game.hazards.length).toBe(MAX_HAZARDS);
  });

  it("is deterministic for a seed", () => {
    const run = () => {
      const game = heroGame("diff", 31337, () => ({ x: Math.cos(game.elapsed / 5), y: Math.sin(game.elapsed / 7) }));
      game.god = true;
      const seen: string[] = [];
      let fired = 0;
      for (let i = 0; i < 150 * 60; i++) {
        if (game.phase === "levelup") game.pickUpgrade(0);
        if (game.phase === "cinematic" && game.cinematic) game.cinematic.t += 99;
        if (game.phase === "cutscene") game.cutscene.skip();
        game.update(1 / 60);
        if (game.biomeHazards.fired.length === fired) continue;
        fired = game.biomeHazards.fired.length;
        for (const h of game.hazards) if (h.source in BIOME_HAZARDS) seen.push(`${game.runTick}:${h.source}:${Math.round(h.x)}:${Math.round(h.y)}:${h.windup}`);
      }
      return { seen, fired: [...game.biomeHazards.fired], hash: game.stateHash() };
    };
    const a = run();
    expect(a.fired.length).toBeGreaterThanOrEqual(3);
    expect(run()).toEqual(a);
  });

  it("the sniper tracks, then locks before it fires", () => {
    const game = heroGame("keel", 79);
    placeIn(game, "forest");
    game.elapsed = BIOME_HAZARD_FIRST_SEC + 1;
    game.biomeHazards.update();
    const sniper = game.hazards.find((h) => h.source === "sniper-glint")!;
    game.player.x += 30;
    sniper.t = 0.5;
    game.hazards = [sniper];
    game.update(1 / 60);
    expect(sniper.x).toBeCloseTo(game.player.x);
    sniper.t = sniper.track! + 0.01;
    const lockedX = sniper.x;
    game.player.x += 200;
    game.update(1 / 60);
    expect(sniper.x).toBe(lockedX);
  });

  it("frost vents chill you while you stand in them", () => {
    const game = heroGame("keel", 80);
    game.god = true;
    const p = game.player;
    game.addHazard({ shape: "circle", x: p.x, y: p.y, r: 72, windup: 0, active: 2, damage: 1, color: "#9fe8ff", source: "frost-vent", knock: 0, slow: CHILL_SPEED_MULT });
    game.update(1 / 60);
    expect(game.chillUntil).toBeGreaterThan(game.elapsed);
    expect(game.chillMult).toBe(CHILL_SPEED_MULT);
  });
});

describe("replay through the fifth biome", () => {
  it("verifies a run that walks into Cold Storage and lives through its hazard", () => {
    let seed = 0;
    let target: { x: number; y: number } | null = null;
    for (let s = 1; s < 400 && !target; s++) {
      setBiomeSeed(s);
      const at = findCell("cold", 5);
      if (at && Math.hypot(at.x, at.y) < 3000) {
        seed = s;
        target = at;
      }
    }
    expect(target).not.toBeNull();
    let tick = 0;
    const goal = target!;
    const game = headlessGame(() => {
      const p = game.player;
      const dx = goal.x - p.x;
      const dy = goal.y - p.y;
      if (Math.hypot(dx, dy) > 120) return { x: dx, y: dy };
      return { x: Math.cos(tick / 40), y: Math.sin(tick / 40) };
    });
    game.god = false;
    game.startReplayableRun(seed, "relay", "easy");
    game.skipCinematic();
    game.setPhase("playing");
    let cards = 0;
    let coldTicks = 0;
    while (game.runTick < 75 * 60 && game.phase !== "lost") {
      tick++;
      if (game.phase === "levelup") {
        game.pickUpgrade(cards++ % game.levelUpChoices.length);
        continue;
      }
      if (game.phase === "cinematic") game.skipCinematic();
      if (game.phase === "cutscene") game.cutscene.skip();
      game.update(1 / 60);
      if (biomeAt(game.player.x, game.player.y) === "cold") coldTicks++;
    }
    expect(coldTicks).toBeGreaterThan(600);
    expect(game.biomeHazards.fired).toContain("frost-vent");
    const log: RunLog = game.runLog();
    const verifier = headlessGame();
    const scripted = replayInput(log, () => verifier.runTick);
    const input = verifier["input"] as unknown as Input & typeof scripted;
    input.moveVector = scripted.moveVector;
    input.consumeDash = scripted.consumeDash;
    input.consumeAbility = scripted.consumeAbility;
    expect(replayRun(verifier, log)).toMatchObject({ ok: true, kills: game.stats.kills, level: game.player.level });
  });
});
