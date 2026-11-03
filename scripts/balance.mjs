import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HEROES = ["keel", "nyx", "diff", "trace"];
const DT = 1 / 60;
const CAP_MINUTES = Number(process.env.CAP ?? 30);
const RUNS = Number(process.env.RUNS ?? 5);
const MOD_RUNS = Number(process.env.MOD_RUNS ?? 2);
const ONLY_MODS = process.env.ONLY_MODS === "1";
const SKIP_MODS = process.env.SKIP_MODS === "1";
const BASE_SEED = Number(process.env.SEED ?? 20261103);

const dir = mkdtempSync(join(tmpdir(), "revert-balance-"));
const out = join(dir, "game.mjs");
await build({ entryPoints: ["src/game/Game.ts"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error", define: { "import.meta.env.DEV": "false" } });
globalThis.window = { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720, addEventListener() {} };
const { Game } = await import(out);

function makeGame(move) {
  const input = { keys: new Set(), advanceHeld: false, clearEdges() {}, consumeMute: () => false, consumeConfirm: () => false, consumeRestart: () => false, consumeCardPick: () => null, consumeDash: () => false, consumeAbility: () => false, consumeSkip: () => false, consumePause: () => false, moveVector: move, focus() {} };
  const game = new Game({ clientWidth: 1280, clientHeight: 720 }, input, { onPhaseChange() {}, onLevelUpChoices() {}, onHudUpdate() {} });
  Object.assign(game.audio, { play() {}, setMusic() {}, unlock() {}, duck() {} });
  return { game, input };
}

function steer(g, skill) {
  const p = g.player;
  let fx = 0;
  let fy = 0;
  for (const e of g.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < skill.sight) {
      const w = ((skill.sight - d) / d / d) * 60;
      fx += dx * w;
      fy += dy * w;
    }
  }
  if (skill.dodge) {
    for (const pr of g.projectiles) {
      if (pr.fromPlayer) continue;
      const d = Math.hypot(p.x - pr.x, p.y - pr.y) || 1;
      if (d < 120) {
        fx += ((p.x - pr.x) / d) * 2;
        fy += ((p.y - pr.y) / d) * 2;
      }
    }
    for (const h of g.hazards) {
      if (h.shape !== "circle") continue;
      const d = Math.hypot(p.x - h.x, p.y - h.y) || 1;
      const r = h.r ?? 0;
      if (h.ring) {
        if (Math.abs(d - r) < 40) {
          const inward = d < r ? -1 : 1;
          fx += ((p.x - h.x) / d) * 3 * inward;
          fy += ((p.y - h.y) / d) * 3 * inward;
        }
      } else if (d < r + 30) {
        fx += ((p.x - h.x) / d) * 3;
        fy += ((p.y - h.y) / d) * 3;
      }
    }
  }
  let target = null;
  let best = skill.seek;
  for (const c of g.chests) {
    if (c.opened || p.coins < g.chestCost(c.coinCost)) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < best) {
      best = d;
      target = c;
    }
  }
  for (const it of g.interactables) {
    if (it.used || it.lift || g.elapsed < it.readyAt || it.kind === "bridge-gate") continue;
    const d = Math.hypot(it.x - p.x, it.y - p.y);
    if (d < best) {
      best = d;
      target = it;
    }
  }
  for (const pk of g.pickups) {
    const d = Math.hypot(pk.x - p.x, pk.y - p.y);
    if (d < best * 0.5) {
      best = d * 2;
      target = pk;
    }
  }
  if (target) {
    const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
    fx += ((target.x - p.x) / d) * 0.9;
    fy += ((target.y - p.y) / d) * 0.9;
  }
  return { x: fx, y: fy };
}

const SKILLS = {
  casual: { sight: 170, dodge: false, seek: 500, reaction: 18, dash: 400 },
  good: { sight: 260, dodge: true, seek: 900, reaction: 4, dash: 200 },
};

function seedFor(hero, index) {
  return (BASE_SEED + HEROES.indexOf(hero) * 7919 + index * 104729) >>> 0;
}

function run(hero, skillName, picker, difficulty, mods = [], index = 0) {
  const skill = SKILLS[skillName];
  let move = { x: 0, y: 0 };
  const { game: g, input } = makeGame(() => move);
  g.chooseHero(hero);
  g.chooseDifficulty(difficulty);
  g.runPlan = { setup: { ...g.runPlan.setup, mods }, seed: seedFor(hero, index) };
  g.startRun();
  g.cinematic = null;
  g.player.lift = 0;
  g.setPhase("playing");
  const stats = { popups: 0, levelUps: 0, bossLanded: [], bossKillSec: [], affixKills: 0, elites: new Set() };
  let dashCount = 0;
  let lastBosses = 0;
  let bossLandedAt = 0;
  let lastBossAlive = false;
  const limit = CAP_MINUTES * 3600;
  for (let i = 0; i < limit * 2 && g.elapsed < CAP_MINUTES * 60; i++) {
    if (g.phase === "lost") break;
    if (g.phase === "levelup") {
      if (g.choiceMode === "popup") stats.popups++;
      else stats.levelUps++;
      const cards = g.levelUpChoices;
      const recommended = cards.findIndex((c) => c.recommended);
      const index = picker === "smart" && recommended >= 0 ? recommended : Math.floor(Math.random() * cards.length);
      g.pickUpgrade(index);
      continue;
    }
    if (g.phase === "cinematic" && g.cinematic) g.cinematic.t += 99;
    if (g.phase === "cutscene") g.cutscene.skip();
    if (i % skill.reaction === 0) move = steer(g, skill);
    input.consumeDash = () => ++dashCount % skill.dash === 0;
    input.consumeAbility = () => dashCount % 300 === 0;
    g.update(DT);
    for (const e of g.enemies) if (e.affixes && !stats.elites.has(e.id)) stats.elites.add(e.id);
    const bossAlive = g.enemies.some((e) => e.kind.startsWith("boss"));
    if (bossAlive && !lastBossAlive) bossLandedAt = g.elapsed;
    if (g.stats.bossesDefeated > lastBosses) {
      lastBosses = g.stats.bossesDefeated;
      stats.bossKillSec.push(Math.round(g.elapsed - bossLandedAt));
    }
    lastBossAlive = bossAlive;
  }
  const damage = [...g.weaponDamage.entries()].sort((a, b) => b[1] - a[1]);
  return { t: g.elapsed, score: g.score(), level: g.player.level, kills: g.stats.kills, bosses: g.stats.bossesDefeated, cause: g.rootCause, coins: g.player.coins, ...stats, events: [...g.miniEvents.fired], elites: stats.elites.size, damage };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const toolShare = new Map();
const eventCounts = new Map();
const causes = new Map();
const allRuns = [];
for (const [skill, picker, difficulty] of ONLY_MODS ? [] : [["casual", "naive", "normal"], ["good", "smart", "normal"], ["good", "smart", "easy"], ["good", "smart", "hard"]]) {
  console.log(`\n${skill} / ${picker} / ${difficulty}`);
  for (const hero of HEROES) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(run(hero, skill, picker, difficulty, [], i));
    for (const r of runs) for (const id of r.events) eventCounts.set(id, (eventCounts.get(id) ?? 0) + 1);
    for (const r of runs) causes.set(r.cause, (causes.get(r.cause) ?? 0) + 1);
    for (const r of runs) {
      const total = r.damage.reduce((sum, [, v]) => sum + v, 0) || 1;
      for (const [kind, v] of r.damage) toolShare.set(kind, [...(toolShare.get(kind) ?? []), v / total]);
    }
    const minutes = median(runs.map((r) => r.t / 60));
    const perMin = (key) => (median(runs.map((r) => r[key] / (r.t / 60)))).toFixed(1);
    const kills = runs.flatMap((r) => r.bossKillSec);
    allRuns.push(...runs);
    console.log(`  ${hero.padEnd(6)} survive ${minutes.toFixed(1).padStart(5)}m  lv ${median(runs.map((r) => r.level))}  bosses ${median(runs.map((r) => r.bosses))}  levelups/min ${perMin("levelUps")}  popups/min ${perMin("popups")}  coins ${median(runs.map((r) => r.coins))}  firstBossKill ${median(runs.map((r) => r.bossKillSec[0] ?? -1))}s  bossKill(med) ${kills.length ? median(kills) : "-"}s  causes ${[...new Set(runs.map((r) => r.cause))].join(",")}`);
  }
}
function mean(values) {
  return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
}

const MODS = SKIP_MODS ? [] : ["", "glass-cannon", "immutable", "hunted", "dark-forest", "whale-season", "inflation", "low-latency", "bull-market", "thin-margin", "hardened"];
console.log(`\ncontracts · good / smart / normal · ${MOD_RUNS} runs per hero`);
for (const mod of MODS) {
  const runs = [];
  for (const hero of HEROES) for (let i = 0; i < MOD_RUNS; i++) runs.push(run(hero, "good", "smart", "normal", mod ? [mod] : [], i));
  const perMin = (key) => median(runs.map((r) => r[key] / (r.t / 60))).toFixed(1);
  console.log(`  ${(mod || "(none)").padEnd(13)} survive ${median(runs.map((r) => r.t / 60)).toFixed(1).padStart(5)}m (mean ${mean(runs.map((r) => r.t / 60)).toFixed(1)})  lv ${median(runs.map((r) => r.level))}  bosses ${median(runs.map((r) => r.bosses))}  levelups/min ${perMin("levelUps")}  kills/min ${perMin("kills")}  score ${median(runs.map((r) => r.score))} (mean ${Math.round(mean(runs.map((r) => r.score)))})`);
}
if (allRuns.length) {
  console.log("\nNetwork events and elites (all skill runs):");
  console.log(`  events/run ${mean(allRuns.map((r) => r.events.length)).toFixed(1)}  ${[...eventCounts.entries()].map(([id, n]) => `${id} ${n}`).join("  ")}`);
  console.log(`  affixed whales seen/run ${mean(allRuns.map((r) => r.elites)).toFixed(1)}`);
  console.log(`  causes of death: ${[...causes.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c ?? "none"} ${n}`).join(", ")}`);
}
console.log("\nAverage damage share when owned:");
for (const [kind, shares] of [...toolShare.entries()].sort((a, b) => median(b[1]) - median(a[1]))) {
  console.log(`  ${kind.padEnd(16)} ${(median(shares) * 100).toFixed(1)}%  (in ${shares.length} runs)`);
}
rmSync(dir, { recursive: true, force: true });
