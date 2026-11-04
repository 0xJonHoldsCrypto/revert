import { describe, expect, it } from "vitest";
import { headlessGame } from "../test/harness";
import { FUNDS_TOTAL, type Game } from "./Game";

function quietRun(seed = 77): Game {
  const game = headlessGame();
  game.startReplayableRun(seed, "keel", "normal");
  game.cinematic = null;
  game.player.lift = 0;
  game.setPhase("playing");
  game.spawnTimer = 999;
  game.miniEvents.nextAt = Infinity;
  game.player.invuln = 1e9;
  return game;
}

function advance(game: Game, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) {
    if (game.phase === "levelup") game.pickUpgrade(0);
    if (game.phase === "cinematic" && game.cinematic) game.cinematic.t += 99;
    if (game.phase === "cutscene") game.cutscene.skip();
    game.update(1 / 60);
  }
}

describe("funds", () => {
  it("never records debt past the total", () => {
    const game = quietRun();
    game.loseFunds(FUNDS_TOTAL * 5);
    expect(game.fundsLost).toBe(FUNDS_TOTAL);
    expect(game.fundsLeft).toBe(0);
  });

  it("returns recovered funds immediately after hitting zero", () => {
    const game = quietRun();
    game.loseFunds(FUNDS_TOTAL * 5);
    game.fundsLost = Math.max(0, game.fundsLost - 200_000_000);
    expect(game.fundsLeft).toBe(200_000_000);
  });

  it("tapers ambient drain as the run goes on", () => {
    const early = quietRun();
    early.bossesSpawned = 99;
    advance(early, 30);
    const late = quietRun();
    late.debugSetTime(1700);
    late.bossesSpawned = 99;
    advance(late, 30);
    expect(late.fundsLost).toBeLessThan(early.fundsLost * 0.6);
  });
});

describe("late game pressure", () => {
  it("scales new enemies harder after the late-game mark", () => {
    const early = quietRun();
    early.debugSetTime(600);
    const late = quietRun();
    late.debugSetTime(1500);
    const a = early.spawnEnemyAt("script-kiddie", 0, 0, true);
    const b = late.spawnEnemyAt("script-kiddie", 0, 0, true);
    const minutesEarly = 10;
    const minutesLate = 25;
    const base = (m: number) => 1 + m * 0.25 + m * m * 0.08;
    expect(b.hp / a.hp).toBeGreaterThan((base(minutesLate) / base(minutesEarly)) * 2);
  });

  it("sends hunting whales when the player stands still", () => {
    const game = quietRun();
    game.debugSetTime(300);
    game.bossesSpawned = 99;
    game.campSince = 300;
    game.campX = game.player.x;
    game.campY = game.player.y;
    advance(game, 9);
    expect(game.enemies.some((e) => e.elite)).toBe(true);
  });

  it("does not hunt a player who keeps moving", () => {
    const game = quietRun();
    game.debugSetTime(300);
    game.bossesSpawned = 99;
    for (let i = 0; i < 15 * 60; i++) {
      game.player.x += 1.2;
      game.update(1 / 60);
    }
    expect(game.campHuntAt).toBe(0);
  });
});
