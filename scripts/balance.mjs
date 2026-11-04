import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HEROES = (process.env.HEROES ?? "keel,nyx,diff,trace,ledger,relay").split(",");
const DT = 1 / 60;
const CAP_MINUTES = Number(process.env.CAP ?? 30);
const RUNS = Number(process.env.RUNS ?? 5);
const MOD_RUNS = Number(process.env.MOD_RUNS ?? 2);
const ONLY_MODS = process.env.ONLY_MODS === "1";
const SKIP_MODS = process.env.SKIP_MODS === "1";
const BASE_SEED = Number(process.env.SEED ?? 20261103);
const WIN_BRANCH = process.env.WIN ?? "cashout";
const FORCE_TRACE_MIN = Number(process.env.FORCE_TRACE ?? 0);
const GOD = process.env.GOD === "1";
const PACE = process.env.PACE === "1";
const NO_OC = process.env.NO_OC === "1";
const NO_SURGE = process.env.NO_SURGE === "1";
const FORCE_SURGE = process.env.FORCE_SURGE ?? "";
const PACE_RUNS = Number(process.env.PACE_RUNS ?? 3);

const dir = mkdtempSync(join(tmpdir(), "revert-balance-"));
const out = join(dir, "game.mjs");
await build({ entryPoints: ["src/game/Game.ts"], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error", define: { "import.meta.env.DEV": "false" } });
globalThis.window = { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720, addEventListener() {} };
const { Game } = await import(out);

function makeGame(move) {
  const input = { keys: new Set(), advanceHeld: false, clearEdges() {}, consumeMute: () => false, consumeConfirm: () => false, consumeRestart: () => false, consumeCardPick: () => null, consumeDash: () => false, consumeAbility: () => false, consumeOverclock: () => false, consumeSkip: () => false, consumePause: () => false, moveVector: move, focus() {} };
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
      if (h.shape === "rect") {
        const dx = p.x - h.x;
        const dy = p.y - h.y;
        const ox = (h.w ?? 0) / 2 + 30 - Math.abs(dx);
        const oy = (h.h ?? 0) / 2 + 30 - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) fx += Math.sign(dx || 1) * 3;
          else fy += Math.sign(dy || 1) * 3;
        }
        continue;
      }
      if (h.shape === "beam") {
        const a = (h.angle ?? 0) + (h.spin ?? 0) * 0.4;
        const dx = p.x - h.x;
        const dy = p.y - h.y;
        const along = dx * Math.cos(a) + dy * Math.sin(a);
        const across = -dx * Math.sin(a) + dy * Math.cos(a);
        if (along > -20 && along < (h.length ?? 0) + 20 && Math.abs(across) < 70) {
          const side = Math.sign(across || -(h.spin ?? 1));
          fx += -Math.sin(a) * side * 3;
          fy += Math.cos(a) * side * 3;
        }
        continue;
      }
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
        const ux = d > 2 ? (p.x - h.x) / d : Math.cos(p.facing + Math.PI / 2);
        const uy = d > 2 ? (p.y - h.y) / d : Math.sin(p.facing + Math.PI / 2);
        fx += ux * 3;
        fy += uy * 3;
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

function run(hero, skillName, picker, difficulty, mods = [], index = 0, god = GOD, forceTraceMin = FORCE_TRACE_MIN) {
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
  if (god) g.god = true;
  const stats = { surgeOffered: {}, surgePicked: {}, popups: 0, levelUps: 0, bossLanded: [], bossKillSec: [], affixKills: 0, elites: new Set(), traceAt: {}, finaleStart: 0, winAt: 0, fightSec: 0, finalePhase: 0, endlessAt: 0, dpsAtFinale: 0, blocked: { boss: 0, popup: 0, other: 0 } };
  const marks = [25, 50, 75, 100];
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
      if (g.choiceMode === "popup" && cards.some((c) => c.id === "win-endless")) {
        stats.winAt = g.stats.winTime;
        stats.fightSec = g.stats.winTime - stats.finaleStart;
        if (WIN_BRANCH === "endless") {
          stats.endlessAt = g.elapsed;
          g.pickUpgrade(0);
        } else g.pickUpgrade(1);
        continue;
      }
      const recommended = cards.findIndex((c) => c.recommended);
      const index = picker === "smart" && recommended >= 0 ? recommended : Math.floor(Math.random() * cards.length);
      if (cards.some((c) => c.surge)) {
        for (const c of cards) stats.surgeOffered[c.id] = (stats.surgeOffered[c.id] ?? 0) + 1;
        stats.surgePicked[cards[index].id] = (stats.surgePicked[cards[index].id] ?? 0) + 1;
      }
      if (NO_SURGE && cards[index].surge) cards[index].apply = () => true;
      g.pickUpgrade(index);
      continue;
    }
    if (FORCE_SURGE && g.elapsed >= 90 && !g.spikes.surges.includes(FORCE_SURGE)) g["makeUpgradeContext"]().surge(FORCE_SURGE);
    if (g.phase === "cinematic" && g.cinematic) g.cinematic.t += 99;
    if (g.phase === "cutscene") g.cutscene.skip();
    if (i % skill.reaction === 0) move = steer(g, skill);
    input.consumeDash = () => ++dashCount % skill.dash === 0;
    input.consumeAbility = () => dashCount % 300 === 0;
    input.consumeOverclock = () => !NO_OC && g.spikes.charge >= 220 && i % 7 === 0;
    if (forceTraceMin > 0 && g.elapsed >= forceTraceMin * 60 && g.trace < 100 && !g.won) {
      if (process.env.FORCE_CLEAR === "1") for (const e of g.enemies) if (e.kind.startsWith("boss")) e.dead = true;
      if (!g.anyBossAlive() || process.env.FORCE_CLEAR === "1") g.debugSetTrace(100);
    }
    g.update(DT);
    if (g.trace >= 100 && !g.finale && !g.won) {
      if (g.anyBossAlive()) stats.blocked.boss++;
      else if (g['popupQueue'].length) stats.blocked.popup++;
      else stats.blocked.other++;
    }
    if (process.env.DEBUG_FINALE && g.trace >= 100 && i % 600 === 0) {
      const b = g.enemies.find((e) => e.kind === "boss-attacker");
      console.log(`  [${(g.elapsed / 60).toFixed(2)}m] phase ${g.phase} finale ${!!g.finale} won ${g.won} boss ${b ? `${Math.round(b.hp)}/${Math.round(b.maxHp)} p${b.finalePhase}` : "-"} bossesAlive ${g.enemies.filter((e) => e.kind.startsWith("boss") && !e.dead).map((e) => e.kind).join()}`);
    }
    if (g.finale && !stats.finaleStart) {
      stats.finaleStart = g.elapsed;
      stats.dpsAtFinale = g.totalDps();
    }
    if (g.finale) stats.finalePhase = Math.max(stats.finalePhase, g.finalePhase);
    for (const m of marks) if (g.trace >= m && stats.traceAt[m] === undefined) stats.traceAt[m] = g.elapsed / 60;
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
  return { spikeDamage: [...g.spikes.damage.entries()], ascensions: g.spikes.ascensions, overclocks: g.spikes.overclockUses, bestCrowd: g.spikes.bestCrowd, surgeList: [...g.spikes.surges], dpsAtFinale: stats.dpsAtFinale, finalePhase: stats.finalePhase, fightSec: stats.fightSec, blocked: stats.blocked, sources: { ...g.traceSources }, trace: g.trace, won: g.won, finale: stats.finaleStart > 0, finaleDied: stats.finaleStart > 0 && !g.won, funds: g.fundsLeft, dps: g.totalDps(), loops: g.loops, biomeHazards: g.biomeHazards.fired.length, t: g.elapsed, score: g.score(), level: g.player.level, kills: g.stats.kills, bosses: g.stats.bossesDefeated, cause: g.rootCause, coins: g.player.coins, ...stats, events: [...g.miniEvents.fired], elites: stats.elites.size, damage };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const toolShare = new Map();
const eventCounts = new Map();
const causes = new Map();
const allRuns = [];
const ONLY_CONFIGS = process.env.CONFIGS ? process.env.CONFIGS.split(",") : null;
for (const [skill, picker, difficulty] of (ONLY_MODS ? [] : [["casual", "naive", "normal"], ["good", "smart", "normal"], ["good", "smart", "easy"], ["good", "smart", "hard"], ["good", "smart", "nightmare"]]).filter(([sk, , d]) => (ONLY_CONFIGS ? ONLY_CONFIGS.includes(`${sk}-${d}`) : d !== "nightmare"))) {
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
    const traceLine = `trace ${median(runs.map((r) => r.trace)).toFixed(0)}% (max ${Math.max(...runs.map((r) => r.trace)).toFixed(0)}%)  finale ${runs.filter((r) => r.finale).length}/${runs.length}  wins ${runs.filter((r) => r.won).length}${runs.some((r) => r.won) ? `  fight ${median(runs.filter((r) => r.won).map((r) => r.fightSec)).toFixed(0)}s` : ""}${runs.some((r) => r.finale) ? `  maxPhase ${Math.max(...runs.map((r) => r.finalePhase))}  dps@finale ${Math.round(median(runs.filter((r) => r.finale).map((r) => r.dpsAtFinale)))}` : ""}`;
    console.log(`  ${hero.padEnd(6)} ${traceLine}  survive ${minutes.toFixed(1).padStart(5)}m  lv ${median(runs.map((r) => r.level))}  bosses ${median(runs.map((r) => r.bosses))}  levelups/min ${perMin("levelUps")}  popups/min ${perMin("popups")}  coins ${median(runs.map((r) => r.coins))}  firstBossKill ${median(runs.map((r) => r.bossKillSec[0] ?? -1))}s  bossKill(med) ${kills.length ? median(kills) : "-"}s  causes ${[...new Set(runs.map((r) => r.cause))].join(",")}`);
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
function fmtMin(v) {
  return v === undefined ? "-" : v.toFixed(1);
}

if (allRuns.length) {
  const byMark = (m) => allRuns.map((r) => r.traceAt[m]).filter((v) => v !== undefined);
  console.log("\nTrace pacing (all skill runs, minutes):");
  for (const m of [25, 50, 75, 100]) console.log(`  reached ${String(m).padStart(3)}%  ${byMark(m).length}/${allRuns.length} runs  median ${byMark(m).length ? fmtMin(median(byMark(m))) : "-"}m`);
  const names = [...new Set(allRuns.flatMap((r) => Object.keys(r.sources)))];
  console.log(`  mean trace points per minute by source: ${names.map((n) => `${n} ${(mean(allRuns.map((r) => (r.sources[n] ?? 0) / (r.t / 60)))).toFixed(2)}`).join("  ")}`);
  console.log(`  waiting at 100% (seconds, mean/run): boss alive ${mean(allRuns.map((r) => r.blocked.boss / 60)).toFixed(1)}  popup queued ${mean(allRuns.map((r) => r.blocked.popup / 60)).toFixed(1)}  other ${mean(allRuns.map((r) => r.blocked.other / 60)).toFixed(1)}`);
  console.log(`  trace at end: median ${median(allRuns.map((r) => r.trace)).toFixed(0)}%  mean ${mean(allRuns.map((r) => r.trace)).toFixed(0)}%`);
}

if (PACE) {
  console.log(`\npace · good / smart / ${PACE_RUNS} runs per hero · invulnerable (a bot that cannot die: upper bound for how fast trace fills)`);
  for (const difficulty of (process.env.PACE_DIFFS ?? "easy,normal,hard,nightmare").split(",")) {
    const runs = [];
    for (const hero of HEROES) for (let i = 0; i < PACE_RUNS; i++) runs.push(run(hero, "good", "smart", difficulty, [], i, true, 0));
    const reached = runs.map((r) => r.traceAt[100]).filter((v) => v !== undefined);
    const wins = runs.filter((r) => r.won);
    console.log(`  ${difficulty.padEnd(9)} t25 ${fmtMin(median(runs.map((r) => r.traceAt[25]).filter((v) => v !== undefined)))}m  t50 ${fmtMin(median(runs.map((r) => r.traceAt[50]).filter((v) => v !== undefined)))}m  t75 ${fmtMin(median(runs.map((r) => r.traceAt[75]).filter((v) => v !== undefined)))}m  t100 ${reached.length}/${runs.length} median ${reached.length ? fmtMin(median(reached)) : "-"}m  won ${wins.length}/${runs.length}  fight median ${wins.length ? median(wins.map((r) => r.fightSec)).toFixed(0) : "-"}s  bosses ${median(runs.map((r) => r.bosses))}  dps@end ${Math.round(median(runs.map((r) => r.dps)))}`);
  }
}

if (allRuns.length) {
  console.log("\nNetwork events and elites (all skill runs):");
  console.log(`  events/run ${mean(allRuns.map((r) => r.events.length)).toFixed(1)}  ${[...eventCounts.entries()].map(([id, n]) => `${id} ${n}`).join("  ")}`);
  console.log(`  affixed whales seen/run ${mean(allRuns.map((r) => r.elites)).toFixed(1)}  biome hazards/run ${mean(allRuns.map((r) => r.biomeHazards)).toFixed(1)}`);
  console.log(`  causes of death: ${[...causes.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c ?? "none"} ${n}`).join(", ")}`);
}
const surgeOffered = new Map();
const surgePicked = new Map();
for (const r of allRuns) {
  for (const [id, n] of Object.entries(r.surgeOffered)) surgeOffered.set(id, (surgeOffered.get(id) ?? 0) + n);
  for (const [id, n] of Object.entries(r.surgePicked)) surgePicked.set(id, (surgePicked.get(id) ?? 0) + n);
}
if (allRuns.length) {
  console.log(`\nPower spikes (all skill runs): ascensions/run ${mean(allRuns.map((r) => r.ascensions)).toFixed(2)}  overclocks/run ${mean(allRuns.map((r) => r.overclocks)).toFixed(2)}  overclocks/min ${mean(allRuns.map((r) => r.overclocks / (r.t / 60))).toFixed(2)}  best crowd kills ${Math.max(...allRuns.map((r) => r.bestCrowd))}  surges/run ${mean(allRuns.map((r) => r.surgeList.length)).toFixed(2)}`);
  console.log("Surge pick rate (picked / offered), share of total damage when taken:");
  for (const [id, offered] of [...surgeOffered.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const key = id.replace("surge-", "");
    const owners = allRuns.filter((r) => r.surgeList.includes(key));
    const share = owners.map((r) => {
      const total = r.damage.reduce((sum, [, v]) => sum + v, 0) + r.spikeDamage.reduce((sum, [, v]) => sum + v, 0) || 1;
      return (r.spikeDamage.find(([k]) => k === key)?.[1] ?? 0) / total;
    });
    console.log(`  ${key.padEnd(17)} picked ${String(surgePicked.get(id) ?? 0).padStart(3)} / ${String(offered).padStart(3)} (${(((surgePicked.get(id) ?? 0) / offered) * 100).toFixed(0)}%)  own-damage share ${owners.length ? (median(share) * 100).toFixed(1) : "-"}%`);
  }
  const ocDamage = allRuns.map((r) => {
    const total = r.damage.reduce((sum, [, v]) => sum + v, 0) + r.spikeDamage.reduce((sum, [, v]) => sum + v, 0) || 1;
    return { asc: (r.spikeDamage.find(([k]) => k === "ascension")?.[1] ?? 0) / total, ring: (r.spikeDamage.find(([k]) => k === "overclock")?.[1] ?? 0) / total };
  });
  console.log(`  ascension blast share of damage: median ${(median(ocDamage.map((d) => d.asc)) * 100).toFixed(2)}%  overclock ring: ${(median(ocDamage.map((d) => d.ring)) * 100).toFixed(2)}%`);
}
console.log("\nAverage damage share when owned:");
for (const [kind, shares] of [...toolShare.entries()].sort((a, b) => median(b[1]) - median(a[1]))) {
  console.log(`  ${kind.padEnd(16)} ${(median(shares) * 100).toFixed(1)}%  (in ${shares.length} runs)`);
}
rmSync(dir, { recursive: true, force: true });
