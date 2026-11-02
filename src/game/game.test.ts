import { describe, expect, it } from "vitest";
import { ABILITIES } from "../data/abilities";
import { CHESTS, ENV_OBSTACLES } from "../data/environment";
import { GEAR, gearStats, type GearId } from "../data/gear";
import { DEFI_PROTOCOL_UPGRADES } from "../data/defiProtocols";
import { TIMED_BUFFS } from "../data/timedBuffs";
import { STAT_UPGRADES } from "../data/upgrades";
import { WELL_STATS } from "../data/wells";
import { EVOLUTIONS, weaponAtLevel, WEAPONS } from "../data/weapons";
import { bossKindAt, bossTierAt, bossTimeAt } from "../constants";
import type { WeaponKind } from "../types";
import { headlessGame, startRun, stepSeconds } from "../test/harness";
import { biomeAt, setBiomeSeed } from "../data/environment";
import { WorldStream } from "./worldGen";

function withTool(kind: WeaponKind) {
  const game = headlessGame();
  startRun(game);
  game.god = true;
  game.weapons = [{ kind, level: 1, timer: 0, rarity: WEAPONS[kind].rarity }];
  return game;
}

describe("content", () => {
  it("has no duplicate display names across player-facing content", () => {
    const names = [
      ...Object.values(WEAPONS).map((w) => w.name),
      ...STAT_UPGRADES.map((u) => u.title),
      ...DEFI_PROTOCOL_UPGRADES.map((u) => u.title),
      ...Object.values(TIMED_BUFFS).map((b) => b.name),
      ...Object.values(WELL_STATS).map((w) => w.title),
      ...Object.values(ABILITIES).map((a) => a.name),
      ...Object.values(ENV_OBSTACLES).map((o) => o.name),
      ...Object.values(CHESTS).map((c) => c.name),
    ];
    expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([]);
  });

  it("gives every tool an evolution recipe that exists", () => {
    const ids = new Set([...STAT_UPGRADES, ...DEFI_PROTOCOL_UPGRADES].map((u) => u.id));
    for (const kind of Object.keys(WEAPONS) as WeaponKind[]) expect(ids.has(EVOLUTIONS[kind].needs), kind).toBe(true);
  });

  it("scales tools with level and floors cooldown", () => {
    const low = weaponAtLevel("audit-dart", 1);
    const high = weaponAtLevel("audit-dart", 8);
    expect(high.damage).toBeGreaterThan(low.damage);
    expect(high.cooldown).toBeLessThan(low.cooldown);
    expect(high.cooldown).toBeGreaterThanOrEqual(low.cooldown * 0.45);
  });

  it("makes merged gear stronger", () => {
    const id = Object.keys(GEAR)[0] as GearId;
    expect(gearStats({ id, tier: 1 }).armor!).toBeGreaterThan(gearStats({ id, tier: 0 }).armor!);
  });

  it("keeps bosses coming forever", () => {
    expect(bossTimeAt(0)).toBe(120);
    expect(bossTimeAt(40)).toBeGreaterThan(bossTimeAt(39));
    expect(bossKindAt(9)).toBe(bossKindAt(0));
    expect(bossTierAt(9)).toBe(1);
  });
});

describe("tools behave differently", () => {
  function target(game: ReturnType<typeof headlessGame>, x: number, y: number) {
    const e = game.spawnEnemyAt("script-kiddie", game.player.x + x, game.player.y + y);
    e.speed = 0;
    e.hp = e.maxHp = 1e6;
    return e;
  }

  it("whip hits in front, not behind", () => {
    const game = withTool("reorg-whip");
    game.player.facing = 0;
    const front = target(game, 80, 0);
    const back = target(game, -80, 0);
    game.spawnTimer = 999;
    stepSeconds(game, 0.1);
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(back.hp).toBe(back.maxHp);
  });

  it("pulse waits for a crowd", () => {
    const game = withTool("memo-pulse");
    const lone = target(game, 60, 0);
    game.spawnTimer = 999;
    stepSeconds(game, 3);
    expect(lone.hp).toBe(lone.maxHp);
  });

  it("flash loan defaults and costs HP when ignored", () => {
    const game = withTool("flash-loan");
    game.god = false;
    game.spawnTimer = 999;
    const hp = game.player.hp;
    stepSeconds(game, 3);
    expect(game.player.hp).toBeLessThan(hp);
  });

  it("repaying a loan avoids the penalty", () => {
    const game = withTool("flash-loan");
    game.god = false;
    game.spawnTimer = 999;
    stepSeconds(game, 0.1);
    const loan = game.loans[0]!;
    game.player.x = loan.x;
    game.player.y = loan.y;
    const hp = game.player.hp;
    stepSeconds(game, 0.1);
    expect(game.loans[0]).not.toBe(loan);
    expect(game.player.hp).toBe(hp);
  });

  it("slashing field makes targets take more damage", () => {
    const game = withTool("slashing-field");
    const e = target(game, 40, 0);
    game.spawnTimer = 999;
    stepSeconds(game, 0.6);
    expect(e.slashedUntil).toBeGreaterThan(game.elapsed);
  });

  it("stablecoin deletes enemy bullets", () => {
    const game = withTool("stable-shield");
    game.spawnTimer = 999;
    game.offerGear({ id: "paper-wallet", tier: 0 });
    game.update(1 / 60);
    game.pickUpgrade(0);
    const orbiter = game.orbiters[0]!;
    game.projectiles.push({ id: 99999, x: orbiter.x, y: orbiter.y, vx: 0, vy: 0, radius: 7, dead: false, damage: 5, life: 5, pierce: 0, fromPlayer: false, color: "#f00", homing: false, source: "shadow-op" });
    stepSeconds(game, 0.05);
    expect(game.projectiles.some((p) => p.id === 99999)).toBe(false);
  });
});

describe("rules", () => {
  it("timed buffs refresh instead of stacking", () => {
    const game = headlessGame();
    startRun(game);
    for (let i = 0; i < 20; i++) game.applyTimedBuff("gas-surge");
    expect(game.player.activeBuffs).toHaveLength(1);
  });

  it("caps movement speed", () => {
    const game = headlessGame(() => ({ x: 1, y: 0 }));
    startRun(game);
    game.god = true;
    game.spawnTimer = 999;
    game.player.moveSpeed = 5000;
    game.applyTimedBuff("gas-surge");
    stepSeconds(game, 0.1);
    expect(Math.abs(game.player.vx)).toBeLessThanOrEqual(210 * 1.6 * 1.2);
  });

  it("spaces out level-ups when XP floods in", () => {
    const game = headlessGame();
    startRun(game);
    game.god = true;
    game.spawnTimer = 999;
    game.elapsed = 600;
    game.player.xp = 1e7;
    let levelUps = 0;
    for (let i = 0; i < 60 * 30; i++) {
      if (game.phase === "levelup") {
        levelUps++;
        game.pickUpgrade(0);
      }
      game.update(1 / 60);
    }
    expect(levelUps).toBeLessThanOrEqual(3);
  });

  it("chests offer gear, an ability or evolution, and tokens, with one recommended", () => {
    const game = headlessGame();
    startRun(game);
    game.openChest("TEST", "common", "#fff", 0, 0);
    game.update(1 / 60);
    expect(game.phase).toBe("levelup");
    expect(game.levelUpChoices).toHaveLength(3);
    expect(game.levelUpChoices.filter((c) => c.recommended)).toHaveLength(1);
    expect(game.levelUpChoices[2]!.tag).toBe("TOKENS");
  });

  it("gear card recommends against a downgrade and keeps old item", () => {
    const game = headlessGame();
    startRun(game);
    game.offerGear({ id: "deep-cold", tier: 0 });
    game.update(1 / 60);
    game.pickUpgrade(0);
    game.offerGear({ id: "paper-wallet", tier: 0 });
    game.update(1 / 60);
    expect(game.levelUpChoices[0]!.recommended).toBe(false);
    game.pickUpgrade(0);
    expect(game.player.stash.map((i) => i.id)).toContain("deep-cold");
  });

  it("merges two identical items into a stronger one", () => {
    const game = headlessGame();
    startRun(game);
    game.player.gear.hardware = { id: "ledger-stick", tier: 0 };
    game.player.stash = [{ id: "ledger-stick", tier: 0 }];
    expect(game.mergeOptions()).toHaveLength(1);
    game.merge(game.mergeOptions()[0]!);
    expect(game.player.gear.hardware).toEqual({ id: "ledger-stick", tier: 1 });
    expect(game.player.stash).toHaveLength(0);
  });

  it("does not lose a level-up when a boss arrives on the same tick", () => {
    const game = headlessGame();
    startRun(game);
    game.god = true;
    game.spawnTimer = 999;
    game.elapsed = 119.99;
    game.player.xp = 1000;
    stepSeconds(game, 0.2, () => 0);
    expect(game.player.level).toBeGreaterThan(1);
  });

  it("rig upgrades raise tier and charge coins", () => {
    const game = headlessGame();
    startRun(game);
    const rack = { id: 1, kind: "hardware-rack", x: 0, y: 0, radius: 60, progress: 0, used: false, readyAt: 0, rig: "dev-laptop" } as const;
    game.rigCards("dev-laptop", { ...rack })[0]!.apply({} as never);
    expect(game.rigs).toHaveLength(1);
    game.player.coins = 100;
    game.rigCards("dev-laptop", { ...rack })[0]!.apply({} as never);
    expect(game.rigs[0]!.tier).toBe(1);
    expect(game.player.coins).toBe(80);
  });
});

describe("world", () => {
  it("generates the same sector for the same seed and keeps spawn clear", () => {
    setBiomeSeed(7);
    const a = new WorldStream(7);
    const b = new WorldStream(7);
    a.update(0, 0);
    b.update(0, 0);
    expect(a.chests.map((c) => [c.x, c.y])).toEqual(b.chests.map((c) => [c.x, c.y]));
    expect(a.obstacles.every((o) => Math.hypot(o.x, o.y) > 200)).toBe(true);
    expect(biomeAt(0, 0)).toBe("mempool");
  });
});

describe("soak", () => {
  it("runs five minutes with bounded state", () => {
    const game = headlessGame(() => ({ x: Math.cos(game.elapsed / 3), y: Math.sin(game.elapsed / 4) }));
    startRun(game);
    game.god = true;
    stepSeconds(game, 300);
    expect(Number.isFinite(game.player.x)).toBe(true);
    expect(game.pickups.length).toBeLessThan(800);
    expect(game.enemies.length).toBeLessThan(700);
    expect(game.player.activeBuffs.length).toBeLessThanOrEqual(Object.keys(TIMED_BUFFS).length);
  });
});
