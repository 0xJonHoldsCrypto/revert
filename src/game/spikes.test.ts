import { describe, expect, it } from "vitest";
import { headlessGame, startRun, stepSeconds } from "../test/harness";
import { OVERCLOCK, OVERCLOCK_LOG_BASE, SURGE_TUNING } from "../data/spikes";
import { isSurgeLevel, SURGE_ORDER, SURGES, type SurgeId } from "../data/surges";
import { EVOLUTIONS, EVOLVED_COOLDOWN_MULT, EVOLVED_DAMAGE_MULT, WEAPONS } from "../data/weapons";
import { buildUpgradePool } from "../data/upgrades";
import { ACHIEVEMENT_BY_ID } from "../data/achievements";
import { RunTracker } from "./achievements";
import { replayInput, replayRun } from "../replay/replayRun";
import { decodeRunCode, encodeRunCode } from "../replay/runCode";
import { defaultSetup } from "./runSetup";
import { parseRunLog, serializeRunLog, type RunLog } from "../replay/runLog";
import * as save from "../save";
import { AREA_RULES } from "../data/biomeSpawns";
import { biomeAt } from "../data/environment";
import type { Game } from "./Game";
import { absorbBarrier, activateOverclock, applySurge, ascend, chargeOverclock, fillOverclock, evolveTool, hasSurge, overclockReady, surgeAvailable, surgeCards, updateSpikes } from "./spikes";
import type { Input } from "../engine/Input";
import type { CharacterId, Enemy } from "../types";

function fresh(hero: CharacterId = "keel", seed = 4242, move: () => { x: number; y: number } = () => ({ x: 0, y: 0 })) {
  const game = headlessGame(move);
  game.startReplayableRun(seed, hero, "normal");
  game.cinematic = null;
  game.player.lift = 0;
  game.setPhase("playing");
  return game;
}

function dummy(game: Game, dx: number, dy = 0, hp = 1e6): Enemy {
  const e = game.spawnEnemyAt("liquidator", game.player.x + dx, game.player.y + dy, true);
  e.hp = e.maxHp = hp;
  return e;
}

function maxed(game: Game) {
  const w = game.weapons[0]!;
  w.level = WEAPONS[w.kind].maxLevel;
  return w;
}

describe("ascension", () => {
  it("evolved forms deal and fire noticeably better, and the compare line says so", () => {
    const game = fresh();
    const w = game.weapons[0]!;
    const base = game.toolDps(w.kind, 8, w.rarity);
    const evolved = game.toolDps(w.kind, 8, w.rarity, true);
    expect(evolved / base).toBeCloseTo(EVOLVED_DAMAGE_MULT / EVOLVED_COOLDOWN_MULT, 5);
    expect(evolved).toBeGreaterThan(base * 1.3);
    const maxedTool = maxed(game);
    game.perks.pierce = 0;
    const pool = buildUpgradePool({ ...game["makeUpgradeContext"](), hasUpgrade: () => true });
    const card = pool.find((c) => c.id === `upgrade-${maxedTool.kind}`)!;
    expect(card.tag).toBe("EVOLVE");
    expect(card.compare!.join(" ")).toContain("Damage");
    expect(card.compare!.join(" ")).toContain("Ascension");
  });

  it("hits nearby attackers for the same damage every time and shoves them back", () => {
    const outcome = () => {
      const game = fresh();
      const near = dummy(game, 90);
      const mid = dummy(game, 0, 220);
      const far = dummy(game, 900);
      const boss = game.spawnEnemyAt("boss-shill", game.player.x - 120, game.player.y, true);
      const bossHp = boss.hp;
      const w = maxed(game);
      evolveTool(game, w);
      return { game, near, mid, far, boss, bossHp, w };
    };
    const a = outcome();
    const b = outcome();
    expect(a.near.hp).toBe(b.near.hp);
    expect(a.mid.hp).toBe(b.mid.hp);
    expect(a.near.hp).toBeLessThan(1e6);
    expect(a.mid.hp).toBeLessThan(1e6);
    expect(a.mid.hp).toBeGreaterThan(a.near.hp);
    expect(a.far.hp).toBe(1e6);
    expect(a.near.kx!).toBeGreaterThan(300);
    expect(a.boss.hp).toBeLessThan(a.bossHp);
    expect(a.boss.kx ?? 0).toBe(0);
    expect(a.w.evolved).toBe(true);
    expect(a.game.spikes.ascensions).toBe(1);
    expect(a.game.spikes.damage.get("ascension")).toBeGreaterThan(0);
    expect(a.game.spikes.damage.get("ascension")).toBe(b.game.spikes.damage.get("ascension"));
  });

  it("kills what it can reach and scales with the clock", () => {
    const early = fresh();
    const weak = early.spawnEnemyAt("airdrop-farmer", early.player.x + 60, early.player.y, true);
    ascend(early, maxed(early));
    expect(weak.dead).toBe(true);
    const late = fresh();
    late.elapsed = 600;
    const tank = dummy(late, 100);
    ascend(late, maxed(late));
    const lateHit = 1e6 - tank.hp;
    const early2 = fresh();
    const tank2 = dummy(early2, 100);
    ascend(early2, maxed(early2));
    expect(lateHit).toBeGreaterThan((1e6 - tank2.hp) * 3);
  });

  it("freezes sim time for at most 0.15s and the slow-mo is real-time cosmetic", () => {
    const game = fresh();
    ascend(game, maxed(game));
    expect(game.hitstop).toBeLessThanOrEqual(0.15);
    expect(game.hitstop).toBeGreaterThan(0);
    let slow = 0;
    for (let i = 0; i < 200 && game.timeScale(1 / 60) < 1; i++) slow += 1 / 60;
    expect(slow).toBeGreaterThan(0.5);
    expect(slow).toBeLessThan(0.7);
    expect(game.banner?.title).toContain("ASCENSION");
    expect(game.banner?.title).toContain(EVOLUTIONS[game.weapons[0]!.kind].name.toUpperCase());
    expect(game.spikes.flashSerial).toBe(1);
  });

  it("keeps slow-mo and flash under 0.15s for reduced motion", () => {
    const game = fresh();
    game.cosmetics.calm = true;
    ascend(game, maxed(game));
    let slow = 0;
    for (let i = 0; i < 200 && game.timeScale(1 / 60) < 1; i++) slow += 1 / 60;
    expect(slow).toBeLessThanOrEqual(0.15 + 1 / 60);
    expect(game.timeScale(1 / 60)).toBe(1);
  });

  it("does not run slow-mo while a menu is open", () => {
    const game = fresh();
    ascend(game, maxed(game));
    game.setPhase("paused");
    expect(game.timeScale(0.5)).toBe(1);
    expect(game.spikes.slowLeft).toBeGreaterThan(0.5);
  });

  it("pings haptics for all three spikes", () => {
    const game = fresh();
    const seen: string[] = [];
    game.onHaptic = (kind) => seen.push(kind);
    ascend(game, maxed(game));
    applySurge(game, "overdrive");
    game.spikes.charge = OVERCLOCK.need - 1;
    chargeOverclock(game, 5);
    activateOverclock(game);
    expect(seen).toEqual(expect.arrayContaining(["ascend", "surge", "ready", "overclock"]));
  });
});

describe("surges", () => {
  it("lands on milestone levels only", () => {
    const levels = Array.from({ length: 60 }, (_, i) => i + 1).filter(isSurgeLevel);
    expect(levels).toEqual([5, 10, 15, 20, 30, 40, 50, 60]);
  });

  it("has nine distinct build-defining options", () => {
    expect(SURGE_ORDER).toHaveLength(9);
    expect(new Set(SURGE_ORDER.map((id) => SURGES[id].line)).size).toBe(9);
  });

  it("opens three gold cards through the popup path at level 5 with one recommended", () => {
    const game = fresh();
    game.player.level = 4;
    game.player.xp = game.player.xpToNext;
    for (let i = 0; i < 5 && game.phase === "playing"; i++) game.update(1 / 60);
    expect(game.phase).toBe("levelup");
    expect(game.choiceMode).toBe("levelup");
    game.pickUpgrade(0);
    for (let i = 0; i < 300 && game.phase === "playing"; i++) game.update(1 / 60);
    expect(game.phase).toBe("levelup");
    expect(game.choiceMode).toBe("popup");
    expect(game.popupTitle).toContain("SURGE");
    expect(game.levelUpChoices).toHaveLength(3);
    expect(game.levelUpChoices.every((c) => c.surge && c.tag === "SURGE" && c.rarity === "legendary")).toBe(true);
    expect(game.levelUpChoices.filter((c) => c.recommended)).toHaveLength(1);
    expect(game.levelUpChoices.every((c) => (c.value ?? 0) > 0)).toBe(true);
    const picked = game.levelUpChoices[1]!.id.replace("surge-", "") as SurgeId;
    game.pickUpgrade(1);
    expect(game.phase).toBe("playing");
    expect(game.spikes.surges).toEqual([picked]);
  });

  it("applies each surge exactly once and keeps it", () => {
    for (const id of SURGE_ORDER) {
      const game = fresh("keel", 99);
      game.weapons.push({ kind: "audit-dart", level: 3, timer: 0, rarity: "common" });
      const levels = game.weapons.map((w) => w.level);
      const ctx = game["makeUpgradeContext"]();
      ctx.surge(id);
      ctx.surge(id);
      expect(game.spikes.surges.filter((s) => s === id)).toHaveLength(1);
      expect(surgeAvailable(game, id)).toBe(false);
      if (id === "overdrive") expect(game.weapons.map((w) => w.level)).toEqual(levels.map((l) => l + 1));
      stepSeconds(game, 20);
      expect(hasSurge(game, id)).toBe(true);
    }
  });

  it("never offers a taken surge again, and nothing once all are taken", () => {
    const game = fresh();
    game.weapons.push({ kind: "reorg-whip", level: 2, timer: 0, rarity: "rare" });
    for (const id of SURGE_ORDER) if (id !== "echo-volley") applySurge(game, id);
    expect(surgeCards(game).map((c) => c.id)).toEqual(["surge-echo-volley"]);
    applySurge(game, "echo-volley");
    expect(surgeCards(game)).toEqual([]);
  });

  it("echo volley fires every 6th shot twice", () => {
    const run = (surge: boolean) => {
      const game = fresh();
      dummy(game, 150);
      if (surge) applySurge(game, "echo-volley");
      const w = game.weapons[0]!;
      let fired = 0;
      for (let i = 0; i < 12; i++) {
        const before = game.projectiles.length;
        w.timer = 0;
        game["updateWeapons"](0);
        fired += game.projectiles.length - before;
      }
      return fired;
    };
    const plain = run(false);
    expect(run(true)).toBe(plain + (plain / 12) * 2);
  });

  it("blade storm drops an orbiting blade per kill that cuts attackers", () => {
    const game = fresh();
    applySurge(game, "blade-storm");
    const weak = dummy(game, 40, 0, 1);
    game.damageEnemy(weak, 50);
    expect(game.spikes.blades).toHaveLength(1);
    const victim = dummy(game, SURGE_TUNING.bladeReach, 0);
    victim.speed = 0;
    for (let i = 0; i < 90; i++) game.update(1 / 60);
    expect(victim.hp).toBeLessThan(1e6);
    expect(game.spikes.damage.get("blade-storm")).toBeGreaterThan(0);
    game.spikes.blades.forEach((b) => (b.until = game.elapsed + 0.1));
    stepSeconds(game, 0.5);
    expect(game.spikes.blades.every((b) => b.until > game.elapsed)).toBe(true);
    expect(game.spikes.blades.length).toBeLessThan(10);
  });

  it("volatile pickups blast when you collect something", () => {
    const game = fresh();
    applySurge(game, "volatile-pickups");
    const target = dummy(game, 30);
    target.speed = 0;
    game.spawnPickup(game.player.x, game.player.y, "coin", 1);
    game.update(1 / 60);
    expect(target.hp).toBeLessThan(1e6);
    expect(game.spikes.damage.get("volatile-pickups")).toBeGreaterThan(0);
  });

  it("wake trail lays a burning path while dashing", () => {
    const game = fresh();
    applySurge(game, "wake-trail");
    game.player.dashTimer = 0.3;
    stepSeconds(game, 0.2);
    expect(game.spikes.trail.length).toBeGreaterThan(2);
    const first = game.spikes.trail[0]!;
    const target = dummy(game, first.x - game.player.x, first.y - game.player.y);
    target.speed = 0;
    stepSeconds(game, 0.5);
    expect(target.hp).toBeLessThan(1e6);
  });

  it("free ascension evolves the best tool whose catalyst is missing, with the full blast", () => {
    const game = fresh();
    const w = game.weapons[0]!;
    const near = dummy(game, 80);
    expect(game.ownsUpgrade(EVOLUTIONS[w.kind].needs)).toBe(false);
    applySurge(game, "free-ascension");
    expect(w.evolved).toBe(true);
    expect(w.level).toBe(1 + SURGE_TUNING.freeAscensionLevels);
    expect(game.spikes.ascensions).toBe(1);
    expect(near.hp).toBeLessThan(1e6);
    expect(surgeAvailable(game, "free-ascension")).toBe(false);
  });

  it("overcharge speeds up the meter, lengthens the window and starts half full", () => {
    const game = fresh();
    applySurge(game, "overcharge");
    expect(game.spikes.charge).toBeCloseTo(OVERCLOCK.need * OVERCLOCK.overchargeStart);
    const plain = fresh();
    chargeOverclock(plain, 10);
    const boosted = fresh();
    applySurge(boosted, "overcharge");
    const start = boosted.spikes.charge;
    chargeOverclock(boosted, 10);
    expect(boosted.spikes.charge - start).toBeCloseTo(10 * OVERCLOCK.overchargeRate);
    fillOverclock(game);
    activateOverclock(game);
    expect(game.spikes.overclockUntil - game.elapsed).toBeCloseTo(OVERCLOCK.duration + OVERCLOCK.overchargeSec);
  });

  it("kill barrier soaks damage after the Ledger shield and is not offered under no-heal contracts", () => {
    const game = fresh("ledger");
    applySurge(game, "kill-barrier");
    for (let i = 0; i < SURGE_TUNING.barrierEvery; i++) game.damageEnemy(dummy(game, 60, 0, 1), 5);
    const barrier = game.spikes.barrier;
    expect(barrier).toBeCloseTo(game.player.maxHp * SURGE_TUNING.barrierShare);
    const shield = game.ledgerShield;
    const hp = game.player.hp;
    const taken = game["diffMult"]().playerDamageTakenMult * (1 - game["totalArmor"]()) * AREA_RULES[biomeAt(game.player.x, game.player.y)].damageTaken;
    game.hurtPlayer((shield + barrier * 0.5) / taken, "liquidator");
    expect(game.ledgerShield).toBeLessThan(1e-9);
    expect(game.spikes.barrier).toBeCloseTo(barrier * 0.5, 1);
    expect(game.player.hp).toBe(hp);
    game.player.invuln = 0;
    expect(absorbBarrier(game, 1e6)).toBeGreaterThan(0);
    const noHeal = fresh();
    noHeal.effects.healMult = 0;
    expect(surgeAvailable(noHeal, "kill-barrier")).toBe(false);
    expect(surgeCards(noHeal).every((c) => c.id !== "surge-kill-barrier")).toBe(true);
  });

  it("stasis pulse freezes regular attackers on a timer and leaves bosses moving", () => {
    const game = fresh();
    applySurge(game, "stasis-pulse");
    const grunt = dummy(game, 200);
    const boss = game.spawnEnemyAt("boss-shill", game.player.x + 250, game.player.y, true);
    expect(game.spikes.stasisAt).toBeCloseTo(game.elapsed + SURGE_TUNING.stasisEvery);
    updateSpikes(game, 1 / 60);
    expect(grunt.frozenUntil ?? 0).toBe(0);
    game.elapsed = SURGE_TUNING.stasisEvery;
    updateSpikes(game, 1 / 60);
    expect(game.spikes.stasisAt).toBeCloseTo(SURGE_TUNING.stasisEvery * 2);
    expect(grunt.frozenUntil ?? 0).toBeCloseTo(game.elapsed + SURGE_TUNING.stasisSec);
    expect(grunt.slashedUntil ?? 0).toBeGreaterThan(game.elapsed);
    expect(boss.frozenUntil ?? 0).toBe(0);
  });

  it("overdrive levels tools and rigs without evolving anything", () => {
    const game = fresh("relay");
    const before = game.rigs.map((r) => r.tier);
    const tool = game.weapons[0]!;
    tool.level = WEAPONS[tool.kind].maxLevel - 1;
    applySurge(game, "overdrive");
    expect(tool.level).toBe(WEAPONS[tool.kind].maxLevel);
    expect(tool.evolved).toBeFalsy();
    expect(game.rigs.map((r) => r.tier)).toEqual(before.map((t) => t + 1));
  });

  it("scores surge cards and recommends exactly one, preferring the one that fits the build", () => {
    const game = fresh();
    const cards = surgeCards(game);
    game["scoreCards"](cards, true);
    expect(cards.filter((c) => c.recommended)).toHaveLength(1);
    expect(Math.max(...cards.map((c) => c.value ?? 0))).toBe(cards.find((c) => c.recommended)!.value);
  });
});

describe("overclock", () => {
  it("charges from kills, not time", () => {
    const game = fresh();
    stepSeconds(game, 5);
    const idle = game.spikes.charge;
    expect(idle).toBeLessThan(5);
    for (let i = 0; i < 40; i++) game.damageEnemy(dummy(game, 60, 0, 1), 5);
    expect(game.spikes.charge).toBeGreaterThan(idle + 5);
    expect(game.spikes.charge).toBeLessThanOrEqual(idle + OVERCLOCK.burst + 1e-9);
    expect(overclockReady(game)).toBe(false);
    const swarm = game.spikes.charge;
    game.elapsed += 2;
    for (let i = 0; i < 40; i++) game.damageEnemy(dummy(game, 60, 0, 1), 5);
    expect(game.spikes.charge - swarm).toBeLessThanOrEqual(2 * OVERCLOCK.maxRate + 1e-9);
    expect(game.spikes.charge - swarm).toBeGreaterThan(5);
  });

  it("takes about a minute of real fighting to fill", () => {
    const times: number[] = [];
    for (const hero of ["keel", "relay"] as const) {
      let tick = 0;
      const game = fresh(hero, 777, () => ({ x: Math.cos(tick / 70), y: Math.sin(tick / 90) }));
      let ready = 0;
      while (game.elapsed < 240 && !ready && game.phase !== "lost") {
        tick++;
        if (game.phase === "levelup") {
          game.pickUpgrade(0);
          continue;
        }
        game.update(1 / 60);
        if (overclockReady(game)) ready = game.elapsed;
      }
      times.push(ready);
    }
    for (const t of times) {
      expect(t).toBeGreaterThan(40);
      expect(t).toBeLessThan(150);
    }
  });

  it("needs a full meter, runs for 8s, halves cooldowns, multiplies damage, then ends", () => {
    const game = fresh();
    expect(activateOverclock(game)).toBe(false);
    const dmg = game.damageTotal();
    const cd = game["weaponCooldownMult"]();
    fillOverclock(game);
    expect(overclockReady(game)).toBe(true);
    const near = dummy(game, 120);
    expect(activateOverclock(game)).toBe(true);
    expect(game.spikes.charge).toBe(0);
    expect(game.overclocking).toBe(true);
    expect(game.damageTotal()).toBeCloseTo(dmg * OVERCLOCK.damageMult);
    expect(game["weaponCooldownMult"]()).toBeCloseTo(Math.max(OVERCLOCK.minCooldownMult, cd * OVERCLOCK.cooldownMult));
    expect(near.hp).toBeLessThan(1e6);
    expect(near.kx!).toBeGreaterThan(200);
    chargeOverclock(game, 10);
    expect(game.spikes.charge).toBe(0);
    expect(activateOverclock(game)).toBe(false);
    stepSeconds(game, OVERCLOCK.duration - 0.5);
    expect(game.overclocking).toBe(true);
    stepSeconds(game, 1);
    expect(game.overclocking).toBe(false);
    expect(game.damageTotal()).toBeCloseTo(dmg);
    const after = game.spikes.charge;
    chargeOverclock(game, 10);
    expect(game.spikes.charge).toBeCloseTo(after + 10);
  });

  it("makes shots bigger and area wider while active", () => {
    const game = fresh();
    dummy(game, 150);
    const w = game.weapons[0]!;
    const radius = (): number => {
      game.projectiles.length = 0;
      w.timer = 0;
      game["updateWeapons"](0);
      return game.projectiles[0]?.radius ?? 0;
    };
    const normal = radius();
    fillOverclock(game);
    activateOverclock(game);
    expect(radius()).toBeCloseTo(normal * OVERCLOCK.shotSize);
  });

  it("refills part of the Ledger shield and works for every hero", () => {
    const ledger = fresh("ledger");
    ledger.ledgerShield = 0;
    fillOverclock(ledger);
    activateOverclock(ledger);
    expect(ledger.ledgerShield).toBeCloseTo(ledger.ledgerShieldMax() * OVERCLOCK.ledgerRefill);
    for (const hero of ["keel", "nyx", "diff", "trace", "relay"] as const) {
      const game = fresh(hero);
      fillOverclock(game);
      expect(activateOverclock(game)).toBe(true);
    }
  });

  it("speeds up Relay rigs", () => {
    const game = fresh("relay");
    const rig = game.rigs[0]!;
    rig.attackTimer = 10;
    game["updateRigs"](1 / 60);
    const normal = 10 - rig.attackTimer;
    rig.attackTimer = 10;
    fillOverclock(game);
    activateOverclock(game);
    game["updateRigs"](1 / 60);
    expect(10 - rig.attackTimer).toBeCloseTo(normal * OVERCLOCK.rigSpeed);
  });

  it("is a clean no-op in the accessibility sense: no flashes above the reduced-motion cap", () => {
    const game = fresh();
    game.cosmetics.calm = true;
    fillOverclock(game);
    activateOverclock(game);
    expect(game.hitstop).toBeLessThanOrEqual(0.15);
    expect(game.spikes.slowLeft).toBe(0);
  });

  it("counts crowd kills for the achievement", () => {
    const tracker = new RunTracker();
    tracker.apply("overclock", 100, { kills: 24 });
    expect(tracker.step("overclock", 100, { kills: 24 }, new Set())).not.toContain("overclock-crowd");
    expect(tracker.step("overclock", 120, { kills: 26 }, new Set())).toContain("overclock-crowd");
    expect(new RunTracker().step("surge", 1, {}, new Set())).toContain("first-surge");
    expect(ACHIEVEMENT_BY_ID["first-evolve"]!.name).toBe("First Ascension");
  });
});

function spikeRun(seconds: number, seed: number) {
  let tick = 0;
  const game = headlessGame(() => ({ x: Math.cos(tick / 90) + (tick % 700 < 90 ? 1 : 0), y: Math.sin(tick / 130) }));
  game.aspectSource = () => 16 / 9;
  game.chooseHero("keel");
  game.runPlan = { setup: defaultSetup(), seed };
  startRun(game);
  const input = game["input"] as unknown as { consumeDash: () => boolean; consumeAbility: () => boolean; consumeOverclock: () => boolean };
  input.consumeDash = () => tick % 170 === 0;
  input.consumeAbility = () => tick % 400 === 0;
  input.consumeOverclock = () => tick % 90 === 0 && game.spikes.charge >= OVERCLOCK.need;
  while (game.runTick < seconds * 60 && game.phase !== "lost") {
    tick++;
    if (game.phase === "levelup") {
      const prefer = game.levelUpChoices.findIndex((c) => c.id === "surge-free-ascension" || c.id === "surge-overcharge");
      game.pickUpgrade(prefer >= 0 ? prefer : 0);
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
  input.consumeOverclock = scripted.consumeOverclock;
  return game;
}

describe("replay", () => {
  it("round-trips a run with surges, an ascension and overclocks", async () => {
    const { game, log } = spikeRun(420, 2468);
    expect(game.spikes.surges.length).toBeGreaterThanOrEqual(2);
    expect(game.spikes.ascensions).toBeGreaterThanOrEqual(1);
    expect(game.spikes.overclockUses).toBeGreaterThanOrEqual(2);
    expect(log.abilities.some((t) => t >= OVERCLOCK_LOG_BASE)).toBe(true);
    expect(log.abilities.some((t) => t < OVERCLOCK_LOG_BASE)).toBe(true);
    const parsed = parseRunLog(serializeRunLog(log))!;
    expect(parsed).toEqual(log);
    expect(await decodeRunCode(await encodeRunCode(log))).toEqual(log);
    const verdict = replayRun(replayerFor(parsed), parsed);
    expect(verdict).toMatchObject({ ok: true, kills: game.stats.kills, level: game.player.level });
  });

  it("rejects a log whose overclock was removed", () => {
    const { game, log } = spikeRun(300, 2468);
    expect(game.spikes.overclockUses).toBeGreaterThanOrEqual(1);
    const forged: RunLog = { ...log, abilities: log.abilities.filter((t) => t < OVERCLOCK_LOG_BASE) };
    expect(replayRun(replayerFor(forged), forged).ok).toBe(false);
  });

  it("records the same hash for the same inputs", () => {
    const a = spikeRun(200, 31);
    const b = spikeRun(200, 31);
    expect(a.log.finalHash).toBe(b.log.finalHash);
    expect(a.log.abilities).toEqual(b.log.abilities);
  });
});

describe("codex and save", () => {
  it("records surges, ascension and overclock", () => {
    const game = fresh();
    applySurge(game, "echo-volley");
    ascend(game, maxed(game));
    fillOverclock(game);
    activateOverclock(game);
    game["flushCodex"]();
    const seen = save.get().codex.seen;
    expect(seen["s:echo-volley"]).toBe(1);
    expect(seen["x:ascend"]).toBe(1);
    expect(seen["x:overclock"]).toBe(1);
    expect(save.sanitize(JSON.parse(JSON.stringify(save.get()))).codex.seen["s:echo-volley"]).toBe(1);
  });
});
