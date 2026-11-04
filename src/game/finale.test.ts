import { afterEach, describe, expect, it } from "vitest";
import { headlessGame } from "../test/harness";
import type { Game } from "./Game";
import { ENEMIES } from "../data/enemies";
import { bossTimeAt } from "../constants";
import { FINALE, TRACE, TRACE_DEBUG, WIN, winScoreBonus } from "../data/trace";
import { shardsForRun } from "../data/metaPerks";

function quiet(seed = 91, difficulty: "easy" | "normal" | "hard" | "nightmare" = "normal"): Game {
  const game = headlessGame();
  game.startReplayableRun(seed, "keel", difficulty);
  game.cinematic = null;
  game.player.lift = 0;
  game.setPhase("playing");
  game.spawnTimer = 999;
  game.miniEvents.nextAt = Infinity;
  game.player.invuln = 1e9;
  return game;
}

function advance(game: Game, seconds: number, each?: (g: Game) => void) {
  for (let i = 0; i < seconds * 60; i++) {
    if (game.phase === "lost") return;
    if (game.phase === "levelup") game.pickUpgrade(0);
    if (game.phase === "cinematic" && game.cinematic) game.cinematic.t += 99;
    if (game.phase === "cutscene") game.cutscene.skip();
    each?.(game);
    game.update(1 / 60);
  }
}

function boss(game: Game) {
  return game.enemies.find((e) => e.kind === "boss-attacker" && !e.dead);
}

function untilBoss(game: Game, seconds = 20) {
  advance(game, seconds, (g) => {
    g.player.invuln = 1e9;
  });
  return boss(game)!;
}

function breakDecoys(game: Game) {
  for (const e of game.enemies) if (e.decoy && !e.dead) game.damageEnemy(e, 1e9);
}

function killFast(game: Game, target: ReturnType<typeof boss>) {
  for (let i = 0; i < 80 && target && !target.dead; i++) {
    breakDecoys(game);
    game.damageEnemy(target, target.maxHp * 0.5);
    advance(game, 0.1);
  }
}

function toEnding(game: Game): boolean {
  let cutscene = false;
  for (let i = 0; i < 900 && !(game.phase === "levelup" && game.choiceMode === "popup"); i++) {
    if (game.phase === "levelup") game.pickUpgrade(0);
    if (game.phase === "cutscene") {
      cutscene = true;
      game.cutscene.skip();
    }
    game.update(1 / 60);
  }
  return cutscene;
}

function offerTitles(game: Game) {
  return game.levelUpChoices.map((c) => c.title);
}

afterEach(() => {
  TRACE_DEBUG.rateMult = 1;
  TRACE_DEBUG.finaleHpMult = 1;
});

describe("trace accumulation", () => {
  it("trickles in with time and reports it on the HUD", () => {
    const game = quiet();
    game.bossesSpawned = 99;
    advance(game, 60);
    expect(game.trace).toBeGreaterThan(TRACE.perSec * 55);
    expect(game.trace).toBeLessThan(TRACE.perSec * 70);
  });

  it("pays out for bosses, bounty whales, whales and drainers", () => {
    const game = quiet();
    game.elapsed = 3600;
    game.bossesSpawned = 99;
    const before = () => game.trace;
    const killOf = (kind: Parameters<Game["spawnEnemyAt"]>[0], prep?: (e: ReturnType<Game["spawnEnemyAt"]>) => void) => {
      const e = game.spawnEnemyAt(kind, 5000, 5000, true);
      prep?.(e);
      const start = before();
      game.damageEnemy(e, 1e9);
      return before() - start;
    };
    expect(killOf("bridge-drainer")).toBeCloseTo(TRACE.drainer, 5);
    expect(killOf("script-kiddie", (e) => game.makeWhale(e))).toBeCloseTo(TRACE.whale, 5);
    expect(killOf("script-kiddie", (e) => {
      game.makeWhale(e);
      e.bounty = true;
    })).toBeCloseTo(TRACE.bounty, 5);
    expect(killOf("boss-shill")).toBeCloseTo(TRACE.boss, 5);
    expect(killOf("script-kiddie")).toBe(0);
  });

  it("scales by difficulty without touching contracts", () => {
    const rates = (["easy", "normal", "hard", "nightmare"] as const).map((d) => {
      const game = quiet(91, d);
      game.addTrace(10);
      return game.trace;
    });
    expect(rates[0]).toBeGreaterThan(rates[1]!);
    expect(rates[2]).toBeLessThanOrEqual(rates[1]!);
    expect(rates[3]).toBeLessThanOrEqual(rates[2]!);
    const contract = headlessGame();
    contract.runPlan = { setup: { perks: {}, mods: ["glass-cannon", "hunted"], unlocked: [], mode: "standard", date: null } };
    contract.startRun();
    contract.addTrace(10);
    expect(contract.trace).toBeCloseTo(10, 5);
  });

  it("budgets side sources by time so kills and points of interest cannot rush the trace", () => {
    const game = quiet();
    for (let i = 0; i < 100; i++) {
      game.addTrace(TRACE.merge, "merge", "poi");
      game.addTrace(TRACE.bounty, "bounty", "kills");
    }
    const early = game.trace;
    expect(early).toBeCloseTo(TRACE.pools.poi.head + TRACE.pools.kills.head, 5);
    game.elapsed = 600;
    for (let i = 0; i < 100; i++) {
      game.addTrace(TRACE.merge, "merge", "poi");
      game.addTrace(TRACE.bounty, "bounty", "kills");
    }
    expect(game.trace - early).toBeCloseTo(10 * (TRACE.pools.poi.perMin + TRACE.pools.kills.perMin), 5);
  });

  it("toasts at 25, 50 and 75 percent exactly once", () => {
    const game = quiet();
    const seen: string[] = [];
    for (const step of [26, 30, 5, 20]) {
      game.addTrace(step);
      for (const t of game.toasts) if (t.text.startsWith("TRACE") && !seen.includes(t.text)) seen.push(t.text);
    }
    expect(seen.map((t) => t.slice(0, 9))).toEqual(["TRACE 25%", "TRACE 50%", "TRACE 75%"]);
  });

  it("pays nothing from enemies once the finale begins or the run is won", () => {
    const game = quiet();
    game.addTrace(200);
    expect(game.trace).toBe(TRACE.goal);
    game.addTrace(5);
    expect(game.trace).toBe(TRACE.goal);
  });
});

describe("final confrontation", () => {
  it("waits for a live boss, then clears the board and enters with a boss cinematic", () => {
    const game = quiet();
    game.bossesSpawned = 99;
    for (let i = 0; i < 30; i++) game.spawnEnemyAt("script-kiddie", 200 + i * 10, 200, true);
    game.debugSetTrace(100);
    game.update(1 / 60);
    expect(game.phase).toBe("cinematic");
    expect(game.cinematic?.kind).toBe("boss");
    expect(game.cinematic?.bossKind).toBe("boss-attacker");
    expect(game.enemies.filter((e) => !e.dead && e.kind !== "boss-attacker")).toHaveLength(0);
    expect(game.finale).not.toBeNull();
  });

  it("holds the finale back while another boss is alive", () => {
    const game = quiet();
    game.bossesSpawned = 99;
    const other = game.spawnEnemyAt("boss-shill", 600, 0, true);
    game.debugSetTrace(100);
    advance(game, 2);
    expect(game.finale).toBeNull();
    game.damageEnemy(other, 1e9);
    advance(game, 2);
    expect(game.finale).not.toBeNull();
  });

  it("stops ordinary spawns and scheduled bosses during the fight", () => {
    const game = quiet();
    game.bossesSpawned = 0;
    game.debugSetTrace(100);
    game.debugSetTime(30);
    game.debugSetTrace(100);
    advance(game, 12, (g) => {
      g.spawnTimer = 0;
    });
    expect(boss(game)).toBeDefined();
    expect(game.enemies.filter((e) => !e.dead && !e.decoy && e.kind !== "boss-attacker" && e.kind !== "bridge-drainer")).toHaveLength(0);
    game.elapsed = 5000;
    advance(game, 2);
    expect(game.enemies.filter((e) => ENEMIES[e.kind].isBoss && !e.dead)).toHaveLength(1);
  });

  it("shields phase one behind decoys, and every decoy can be broken", () => {
    const game = quiet();
    game.bossesSpawned = 99;
    game.debugSetTrace(100);
    game.weapons = [];
    const attacker = untilBoss(game, 4);
    let decoys = game.enemies.filter((e) => e.decoy && !e.dead);
    for (let i = 0; i < 1200 && decoys.length === 0; i++) {
      advance(game, 0.1);
      decoys = game.enemies.filter((e) => e.decoy && !e.dead);
    }
    expect(decoys.length).toBe(FINALE.decoyCount);
    expect(game.attackerShielded(attacker)).toBe(true);
    const hp = attacker.hp;
    game.damageEnemy(attacker, 1000);
    expect(hp - attacker.hp).toBeCloseTo(1000 * FINALE.decoyShieldMult, -1);
    for (const d of decoys) game.damageEnemy(d, 1e9);
    expect(game.attackerShielded(attacker)).toBe(false);
    const open = attacker.hp;
    game.damageEnemy(attacker, 1000);
    expect(open - attacker.hp).toBeGreaterThan(900);
  });

  it("cannot skip a phase and runs the three phases in order", () => {
    const game = quiet();
    game.bossesSpawned = 99;
    game.debugSetTrace(100);
    const attacker = untilBoss(game, 14);
    const seen: number[] = [];
    const watch = () => {
      if (attacker.finalePhase && seen.at(-1) !== attacker.finalePhase) seen.push(attacker.finalePhase);
    };
    for (let i = 0; i < 10 && seen.length < 3; i++) {
      breakDecoys(game);
      game.damageEnemy(attacker, attacker.maxHp * 0.6);
      advance(game, 3, watch);
    }
    expect(seen).toEqual([1, 2, 3]);
    expect(attacker.hp).toBeGreaterThan(0);
  });

  it("telegraphs every attack for at least a second and has no instant projectiles", () => {
    const game = quiet();
    game.bossesSpawned = 99;
    game.debugSetTrace(100);
    const attacker = untilBoss(game, 14);
    const seen = new Map<string, number>();
    const phases = new Set<number>();
    const watch = (g: Game) => {
      g.player.invuln = 1e9;
      phases.add(attacker.finalePhase ?? 0);
      for (const h of g.hazards) if (h.source === "boss-attacker") seen.set(`${h.shape}:${h.label ?? ""}:${h.ring ? "ring" : ""}`, Math.min(seen.get(`${h.shape}:${h.label ?? ""}:${h.ring ? "ring" : ""}`) ?? 99, h.windup));
      expect(g.projectiles.filter((p) => !p.fromPlayer && p.source === "boss-attacker")).toHaveLength(0);
    };
    advance(game, 40, watch);
    breakDecoys(game);
    game.damageEnemy(attacker, attacker.maxHp * 0.4);
    advance(game, 40, watch);
    game.damageEnemy(attacker, attacker.maxHp * 0.4);
    advance(game, 40, watch);
    expect(phases.has(3)).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(6);
    for (const [, windup] of seen) expect(windup).toBeGreaterThanOrEqual(1);
    expect([...seen.keys()].some((k) => k.includes("ring"))).toBe(true);
  });

  it("drains funds in phase two but never below the floor", () => {
    const game = quiet();
    game.bossesSpawned = 99;
    game.debugSetTrace(100);
    const attacker = untilBoss(game, 14);
    for (const d of game.enemies.filter((e) => e.decoy)) d.dead = true;
    game.damageEnemy(attacker, attacker.maxHp * 0.4);
    advance(game, 2);
    expect(attacker.finalePhase).toBe(2);
    const lost = game.fundsLost;
    advance(game, 20, (g) => {
      g.player.invuln = 1e9;
    });
    expect(game.fundsLost).toBeGreaterThan(lost + FINALE.drainPerSec * 5);
    game.siphonFunds(1e12, FINALE.drainFloor);
    expect(game.fundsLeft / (game.fundsLeft + game.fundsLost)).toBeCloseTo(FINALE.drainFloor, 3);
    expect(game.enemies.some((e) => e.kind === "bridge-drainer" && !e.dead)).toBe(true);
  });

  it("expands the reorg ring so it can only be crossed, not outrun", () => {
    const game = quiet();
    game.bossesSpawned = 99;
    game.debugSetTrace(100);
    const attacker = untilBoss(game, 14);
    for (const d of game.enemies.filter((e) => e.decoy)) d.dead = true;
    game.damageEnemy(attacker, attacker.maxHp * 0.7);
    advance(game, 2);
    game.damageEnemy(attacker, attacker.maxHp * 0.4);
    let ring = undefined as (typeof game.hazards)[number] | undefined;
    for (let i = 0; i < 20 * 60 && !ring; i++) {
      advance(game, 1 / 60);
      ring = game.hazards.find((h) => h.ring && h.grow);
    }
    expect(ring).toBeDefined();
    expect(ring!.windup).toBeGreaterThanOrEqual(1);
    const r0 = ring!.r!;
    advance(game, ring!.windup + 1);
    expect(ring!.r!).toBeGreaterThan(r0 + FINALE.ringGrow * 0.9);
  });

  it("replays the same fight tick for tick", () => {
    const run = () => {
      const game = quiet(2024);
      game.bossesSpawned = 99;
      game.debugSetTrace(100);
      untilBoss(game, 14);
      advance(game, 30, (g) => {
        g.player.invuln = 1e9;
      });
      return game.stateHash();
    };
    expect(run()).toBe(run());
  });
});

describe("victory", () => {
  function won(difficulty: "easy" | "normal" | "hard" | "nightmare" = "normal") {
    const game = quiet(77, difficulty);
    game.bossesSpawned = 99;
    TRACE_DEBUG.finaleHpMult = 0.001;
    game.weapons = [];
    game.debugSetTrace(100);
    const attacker = untilBoss(game, 7);
    killFast(game, attacker);
    return game;
  }

  it("plays the victory cutscene and then offers exactly two cards", () => {
    const game = won();
    expect(game.won).toBe(true);
    const sawCutscene = toEnding(game);
    expect(sawCutscene).toBe(true);
    expect(game.phase).toBe("levelup");
    expect(game.choiceMode).toBe("popup");
    expect(offerTitles(game)).toEqual(["KEEP PLAYING · ENDLESS", "CASH OUT · FINISH RUN"]);
    expect(game.levelUpChoices.some((c) => c.recommended)).toBe(false);
  });

  it("does not trigger on a timer any more", () => {
    const game = quiet();
    game.bossesSpawned = 99;
    game.debugSetTime(21 * 60);
    advance(game, 3);
    expect(game.phase).toBe("playing");
    expect(game.won).toBe(false);
  });

  it("keeps playing in endless: tag, loops, scheduled bosses and climbing enemies", () => {
    const game = won();
    toEnding(game);
    expect(game.phase).toBe("levelup");
    const winAt = game.elapsed;
    game.pickUpgrade(0);
    expect(game.phase).toBe("playing");
    expect(game.endless).toBe(true);
    expect(game.won).toBe(true);
    const early = game.spawnEnemyAt("script-kiddie", 0, 0, true);
    let hud: { traceMode: string; loops: number } | undefined;
    game["cb"].onHudUpdate = (d) => {
      hud = d;
    };
    advance(game, WIN.loopSec * 3 + 5, (g) => {
      g.player.invuln = 1e9;
      g.spawnTimer = 999;
    });
    expect(game.loops).toBe(3);
    advance(game, 1);
    game["pushHud"]();
    expect(hud).toMatchObject({ traceMode: "endless", loops: 3 });
    const late = game.spawnEnemyAt("script-kiddie", 0, 0, true);
    expect(late.maxHp).toBeGreaterThan(early.maxHp);
    expect(game.elapsed).toBeGreaterThan(winAt + WIN.loopSec * 3);
    game.elapsed = bossTimeAt(game.bossesSpawned) + 1;
    advance(game, 2);
    const next = game.enemies.find((e) => ENEMIES[e.kind].isBoss && !e.dead);
    expect(next).toBeDefined();
    expect(next!.kind).not.toBe("boss-attacker");
    expect(game.finale).toBeNull();
    const trace = game.trace;
    game.damageEnemy(next!, 1e12);
    expect(game.trace).toBe(trace);
  });

  it("cashes out into the normal end screen as a win", () => {
    const game = won();
    toEnding(game);
    expect(game.phase).toBe("levelup");
    game.pickUpgrade(1);
    expect(game.phase).toBe("lost");
    expect(game.cashedOut).toBe(true);
    const m = game.postMortem();
    expect(m).toMatchObject({ won: true, cashedOut: true, endless: false, cause: "Cashed out" });
    expect(m.winTime).toBeGreaterThan(0);
  });

  it("pays a score and shard bonus only for wins, never for tainted runs", () => {
    const base = { timeSec: 900, baseScore: 15000, bosses: 6, shardMult: 1 };
    expect(shardsForRun({ ...base, tainted: false, won: true })).toBe(shardsForRun({ ...base, tainted: false }) + WIN.shards);
    expect(shardsForRun({ ...base, tainted: true, won: true })).toBe(0);
    expect(winScoreBonus(600)).toBeGreaterThan(winScoreBonus(1200));
    const lost = quiet();
    lost.stats.timeSurvived = 900;
    const before = lost.baseScore();
    lost.stats.won = true;
    lost.stats.winTime = 900;
    expect(lost.baseScore() - before).toBe(winScoreBonus(900));
  });

  it("includes trace and finale progress in the state hash", () => {
    const a = quiet();
    const b = quiet();
    expect(a.stateHash()).toBe(b.stateHash());
    b.addTrace(3);
    expect(a.stateHash()).not.toBe(b.stateHash());
    const c = quiet();
    c.stats.won = true;
    expect(a.stateHash()).not.toBe(c.stateHash());
    const d = quiet();
    d.endless = true;
    expect(a.stateHash()).not.toBe(d.stateHash());
  });
});
