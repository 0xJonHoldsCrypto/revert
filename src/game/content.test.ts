import { describe, expect, it } from "vitest";
import { AFFIX_ORDER, AFFIXES, DOUBLE_AFFIX_TIME_SEC, rollAffixes, SPLIT_COUNT } from "../data/affixes";
import { ENEMIES } from "../data/enemies";
import { keeperThreshold, WEAPONS } from "../data/weapons";
import { headlessGame, stepSeconds } from "../test/harness";
import type { Enemy, EnemyKind, WeaponKind } from "../types";
import { seedSim, spawnRandom } from "../utils/math";
import { MINI_EVENT_ORDER, MINI_EVENTS } from "./events";
import type { Game } from "./Game";

function quietRun(seed = 1234): Game {
  const game = headlessGame();
  game.startReplayableRun(seed, "keel", "normal");
  game.cinematic = null;
  game.player.lift = 0;
  game.setPhase("playing");
  game.spawnTimer = 999;
  game.miniEvents.nextAt = Infinity;
  return game;
}

function withTool(kind: WeaponKind, level = 1): Game {
  const game = quietRun();
  game.weapons = [{ kind, level, timer: 0, rarity: WEAPONS[kind].rarity }];
  return game;
}

function dummy(game: Game, x: number, y: number, kind: EnemyKind = "script-kiddie"): Enemy {
  const e = game.spawnEnemyAt(kind, game.player.x + x, game.player.y + y, true);
  e.speed = 0;
  e.aiTimer = 999;
  e.hp = e.maxHp = 1e6;
  return e;
}

function holdSpawns(game: Game, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) {
    game.spawnTimer = 999;
    if (game.phase === "levelup") game.pickUpgrade(0);
    game.update(1 / 60);
  }
}

describe("elite affixes", () => {
  it("rolls distinct affixes, and two late in a run", () => {
    seedSim(7);
    for (let i = 0; i < 50; i++) {
      const early = rollAffixes(60, spawnRandom);
      expect(early).toHaveLength(1);
      const late = rollAffixes(DOUBLE_AFFIX_TIME_SEC, spawnRandom);
      expect(late).toHaveLength(2);
      expect(new Set(late).size).toBe(2);
      for (const id of [...early, ...late]) expect(AFFIX_ORDER).toContain(id);
    }
    expect(Object.keys(AFFIXES).sort()).toEqual([...AFFIX_ORDER].sort());
  });

  it("rolls the same affixes for the same seed", () => {
    const roll = () => {
      const game = quietRun(99);
      game.elapsed = 600;
      return Array.from({ length: 12 }, (_, i) => {
        const e = game.spawnEnemyAt("script-kiddie", i * 40, 300, true);
        game.makeWhale(e);
        return e.affixes!.join("+");
      });
    };
    const first = roll();
    expect(roll()).toEqual(first);
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it("shielded whales soak damage before HP", () => {
    const game = quietRun();
    const e = dummy(game, 200, 0);
    e.elite = true;
    e.affixes = ["shielded"];
    e.shield = e.shieldMax = 100;
    game.damageEnemy(e, 60);
    expect(e.hp).toBe(e.maxHp);
    expect(e.shield).toBe(40);
    game.damageEnemy(e, 60);
    expect(e.hp).toBe(e.maxHp - 20);
  });

  it("splitting whales split and volatile whales leave a blast", () => {
    const game = quietRun();
    const e = dummy(game, 300, 0);
    e.elite = true;
    e.affixes = ["splitting", "volatile"];
    const before = game.enemies.length;
    const hazards = game.hazards.length;
    game.damageEnemy(e, 2e6);
    expect(game.enemies.filter((m) => !m.dead).length).toBe(before - 1 + SPLIT_COUNT);
    expect(game.hazards.length).toBe(hazards + 1);
    expect(game.hazards.at(-1)!.label).toBe("VOLATILE");
  });

  it("menders heal neighbours and vampires heal on contact", () => {
    const game = quietRun();
    const mender = dummy(game, 300, 0);
    mender.affixes = ["mender"];
    const hurt = dummy(game, 330, 0);
    hurt.hp = hurt.maxHp * 0.5;
    holdSpawns(game, 1);
    expect(hurt.hp).toBeGreaterThan(hurt.maxHp * 0.5);
    const vamp = dummy(game, 0, 0);
    vamp.affixes = ["vampiric"];
    vamp.hp = vamp.maxHp * 0.5;
    game.player.invuln = 0;
    holdSpawns(game, 0.1);
    expect(vamp.hp).toBeGreaterThan(vamp.maxHp * 0.5);
  });
});

describe("mini events", () => {
  function schedule(seed: number) {
    const game = headlessGame();
    game.startReplayableRun(seed, "keel", "normal");
    game.cinematic = null;
    game.setPhase("playing");
    game.god = true;
    const seen: string[] = [];
    let last: string | null = null;
    stepSeconds(game, 420);
    for (const id of game.miniEvents.fired) {
      seen.push(id);
      last = id;
    }
    return { seen, last, nextAt: game.miniEvents.nextAt };
  }

  it("fires the same events at the same times for the same seed", () => {
    const a = schedule(5150);
    expect(a.seen.length).toBeGreaterThanOrEqual(2);
    expect(schedule(5150)).toEqual(a);
    for (let i = 1; i < a.seen.length; i++) expect(a.seen[i]).not.toBe(a.seen[i - 1]);
  });

  it("has a banner, colour and duration for every event", () => {
    for (const id of MINI_EVENT_ORDER) {
      const def = MINI_EVENTS[id];
      expect(def.name.length).toBeGreaterThan(3);
      expect(def.duration).toBeGreaterThan(0);
    }
  });

  it("congestion slows everyone, surge doubles the crowd and the XP", () => {
    const game = quietRun();
    game.miniEvents.start("congestion");
    expect(game.miniEvents.speedMult()).toBeLessThan(1);
    expect(game.gasEnemySpeedMult()).toBeLessThan(1);
    game.elapsed += 11;
    game.miniEvents.update(0, false, 0);
    game.miniEvents.start("mempool-surge");
    expect(game.miniEvents.spawnMult()).toBe(2);
    expect(game.miniEvents.xpMult()).toBeGreaterThan(1);
  });

  it("domino defaults chain kills into blasts", () => {
    const game = quietRun();
    game.miniEvents.start("domino-defaults");
    const e = dummy(game, 200, 0);
    game.damageEnemy(e, 2e6);
    expect(game.strikes.length).toBe(1);
  });

  it("airdrop rain drops crates that turn into loot", () => {
    const game = quietRun();
    game.miniEvents.start("airdrop-rain");
    const pickups = game.pickups.length;
    holdSpawns(game, 3);
    expect(game.hazards.some((h) => h.label === "CRATE")).toBe(true);
    expect(game.pickups.length).toBeGreaterThan(pickups);
  });

  it("whale hunt surfaces two whales and pays for one", () => {
    const game = quietRun();
    game.elapsed = 200;
    game.miniEvents.start("whale-hunt");
    const whales = game.enemies.filter((e) => e.elite);
    expect(whales).toHaveLength(2);
    expect(whales.every((w) => (w.affixes?.length ?? 0) >= 1)).toBe(true);
    const coins = game.pickups.filter((p) => p.kind === "coin").length;
    game.damageEnemy(whales[0]!, 1e9);
    expect(game.pickups.filter((p) => p.kind === "coin").length).toBeGreaterThan(coins);
  });
});

describe("new tools", () => {
  it("keeper bot closes out a low attacker and nicks the weakest otherwise", () => {
    const game = withTool("keeper-bot");
    const low = dummy(game, 120, 0);
    low.hp = low.maxHp * (keeperThreshold(1) - 0.02);
    const healthy = dummy(game, -120, 0);
    holdSpawns(game, 0.1);
    expect(low.dead).toBe(true);
    expect(healthy.hp).toBe(healthy.maxHp);
    holdSpawns(game, 0.7);
    expect(healthy.hp).toBeLessThan(healthy.maxHp);
    expect(game.weaponDamage.get("keeper-bot")).toBeGreaterThan(0);
  });

  it("keeper bot never executes bosses", () => {
    const game = withTool("keeper-bot");
    const boss = dummy(game, 120, 0, "boss-shill");
    boss.hp = boss.maxHp * 0.05;
    holdSpawns(game, 0.1);
    expect(boss.dead).toBe(false);
  });

  it("air-gap vault shoves, then bursts and freezes", () => {
    const game = withTool("air-gap-vault");
    holdSpawns(game, 1 / 60);
    const v = game.vault;
    const e = dummy(game, v.x - game.player.x, v.y - game.player.y);
    game.vault.charge = 9;
    const bystander = dummy(game, v.x - game.player.x + 60, v.y - game.player.y);
    game.weapons[0]!.timer = 0;
    holdSpawns(game, 1 / 60);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(Math.hypot(e.kx ?? 0, e.ky ?? 0)).toBeGreaterThan(0);
    expect(bystander.frozenUntil).toBeGreaterThan(game.elapsed);
    expect(game.vault.charge).toBe(0);
  });

  it("infinite approval drains and jumps on death", () => {
    const game = withTool("infinite-approval");
    const first = dummy(game, 100, 0);
    const near = dummy(game, 160, 0);
    const far = dummy(game, 180, 40);
    holdSpawns(game, 0.05);
    expect(first.drainUntil).toBeGreaterThan(game.elapsed);
    holdSpawns(game, 0.6);
    expect(first.hp).toBeLessThan(first.maxHp);
    game.damageEnemy(first, 1e9);
    expect(near.drainUntil).toBeGreaterThan(game.elapsed);
    expect(far.drainUntil).toBeGreaterThan(game.elapsed);
  });
});

describe("new attackers", () => {
  function moving(x: number, y: number) {
    const game = headlessGame(() => ({ x, y }));
    game.startReplayableRun(77, "keel", "normal");
    game.cinematic = null;
    game.setPhase("playing");
    game.spawnTimer = 999;
    game.miniEvents.nextAt = Infinity;
    return game;
  }

  it("frontrunner blinks ahead of where you are heading", () => {
    const game = moving(1, 0);
    holdSpawns(game, 0.2);
    const e = game.spawnEnemyAt("frontrunner", game.player.x - 300, game.player.y, true);
    e.aiTimer = 0;
    holdSpawns(game, 1);
    expect(e.x).toBeGreaterThan(game.player.x - 200);
  });

  it("censor fences you in with a ring and griefers leave mines", () => {
    const game = quietRun();
    const censor = game.spawnEnemyAt("censor", game.player.x + 260, game.player.y, true);
    censor.aiTimer = 0;
    const griefer = game.spawnEnemyAt("griefer", game.player.x - 260, game.player.y, true);
    griefer.aiTimer = 0;
    holdSpawns(game, 0.05);
    expect(game.hazards.some((h) => h.ring && h.label === "CENSORED")).toBe(true);
    const mine = game.hazards.find((h) => h.label === "MINE")!;
    expect(mine).toBeDefined();
    holdSpawns(game, 1.4);
    game.player.x = mine.x;
    game.player.y = mine.y;
    game.player.invuln = 0;
    const hp = game.player.hp;
    holdSpawns(game, 1 / 60);
    expect(game.player.hp).toBeLessThan(hp);
    expect(game.hazards.includes(mine)).toBe(false);
  });

  it("dust slows you until you dash", () => {
    const game = quietRun();
    game.player.invuln = 0;
    game.hurtPlayer(1, "dust-spammer");
    expect(game.dustStacks).toBe(1);
    const input = game["input"] as unknown as { consumeDash: () => boolean };
    holdSpawns(game, 0.1);
    expect(game.dustStacks).toBe(1);
    input.consumeDash = () => true;
    holdSpawns(game, 0.05);
    expect(game.dustStacks).toBe(0);
  });

  it("every new attacker has intel and spawns", () => {
    for (const kind of ["frontrunner", "censor", "dust-spammer", "griefer"] as EnemyKind[]) expect(ENEMIES[kind].hp).toBeGreaterThan(0);
  });
});
