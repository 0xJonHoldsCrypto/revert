import { FINALE } from "../data/trace";
import type { Enemy } from "../types";
import { angleBetween, dist } from "../utils/math";
import type { Game } from "./Game";

const COLOR = "#ff2e63";
const SOURCE = "boss-attacker";
const PHASE_BANNER: Record<number, [string, string, string]> = {
  1: ["THE ATTACKER · PHASE 1", "Fake wallets shield him. Break every one before they detonate.", COLOR],
  2: ["PHASE 2 · SIPHON", "The treasury is draining. Kill the bridge drainers, thread the beams and lanes.", "#ffc23d"],
  3: ["PHASE 3 · REORG", "A rewind ring is coming. Dash THROUGH it when it reaches you.", "#d05cff"],
};

export function attackerPhase(boss: Enemy): number {
  const share = boss.hp / boss.maxHp;
  return share <= FINALE.phaseThreeAt ? 3 : share <= FINALE.phaseTwoAt ? 2 : 1;
}

export function decoysAlive(game: Game): number {
  let n = 0;
  for (let i = 0; i < game.enemies.length; i++) {
    const e = game.enemies[i]!;
    if (e.decoy && !e.dead) n++;
  }
  return n;
}

function hit(game: Game, boss: Enemy, x: number, y: number, r: number, windup: number, scale: number, label?: string) {
  game.addHazard({ shape: "circle", x, y, r, windup, active: 0, damage: boss.damage * 0.5 * scale, color: COLOR, source: SOURCE, knock: 220, label });
}

function beam(game: Game, boss: Enemy, angle: number, windup: number, active: number, scale: number, spin = 0, follow = false) {
  game.addHazard({
    shape: "beam",
    x: boss.x,
    y: boss.y,
    angle,
    spin: spin || undefined,
    length: 640,
    windup,
    active,
    damage: boss.damage * scale,
    color: COLOR,
    source: SOURCE,
    knock: 0,
    follow: follow ? boss.id : undefined,
  });
}

function spawnDecoys(game: Game, boss: Enemy) {
  const p = game.player;
  const base = game.rand() * Math.PI * 2;
  for (let i = 0; i < FINALE.decoyCount; i++) {
    const a = base + (i / FINALE.decoyCount) * Math.PI * 2;
    const reach = 250 + (i % 2) * 70;
    const e = game.spawnEnemyAt("sybil-mini", p.x + Math.cos(a) * reach, p.y + Math.sin(a) * reach, true);
    e.decoy = true;
    e.hp = e.maxHp = FINALE.decoyHp * (boss.maxHp / FINALE.hp);
    e.damage = boss.damage * 0.4;
    e.contactCd = 1e9;
    e.scale = 1.7;
    e.radius *= 1.7;
    e.speed = 60;
    game.burstParticles(e.x, e.y, COLOR, 8);
  }
  game.addFloater(boss.x, boss.y - 170, "FAKE WALLETS", COLOR);
  game.pushFeed("The Attacker spun up decoy wallets");
  game.audio.play("glitch");
}

export function updateDecoy(game: Game, e: Enemy, dt: number) {
  const p = game.player;
  e.age = (e.age ?? 0) + dt;
  const armAt = FINALE.decoyFuse - FINALE.decoyArm;
  if (e.age < armAt) {
    if (dist(e.x, e.y, p.x, p.y) > 170) {
      const a = angleBetween(e.x, e.y, p.x, p.y);
      e.x += Math.cos(a) * e.speed * dt;
      e.y += Math.sin(a) * e.speed * dt;
    }
    return;
  }
  if (!e.charge) {
    e.charge = { t: FINALE.decoyArm, dash: 0, angle: 0 };
    game.addHazard({ shape: "circle", x: e.x, y: e.y, r: 115, windup: FINALE.decoyArm, active: 0, damage: e.damage, color: COLOR, source: SOURCE, knock: 240, label: "DECOY" });
    game.addFloater(e.x, e.y - 40, "DETONATING", COLOR);
    return;
  }
  if (e.age >= FINALE.decoyFuse) {
    e.dead = true;
    game.burstParticles(e.x, e.y, COLOR, 10);
  }
}

function enterPhase(game: Game, boss: Enemy, phase: number) {
  boss.finalePhase = phase;
  boss.age = 0;
  boss.phaseBeat = FINALE.phaseBeatSec;
  const [title, text, tone] = PHASE_BANNER[phase]!;
  game.queueBanner(title, text, tone);
  if (phase === 1) return;
  boss.aiTimer = FINALE.phaseBeatSec;
  boss.attackIndex = 0;
  game.impactFrames = 6;
  game.addTrauma(0.6);
  game.audio.play("alarm");
  game.addFloater(boss.x, boss.y - 170, `PHASE ${phase}`, "#ffc23d");
  game.pushFeed(`The Attacker escalated to phase ${phase}`);
  for (const e of game.enemies) {
    if (!e.decoy || e.dead) continue;
    e.dead = true;
    game.burstParticles(e.x, e.y, COLOR, 8);
  }
  game.shockwaves.push({ x: boss.x, y: boss.y, radius: 360, life: 0.7, maxLife: 0.7, color: COLOR });
  if (phase === 2) spawnDrainers(game, boss, 2);
}

function spawnDrainers(game: Game, boss: Enemy, count: number) {
  let alive = 0;
  for (const e of game.enemies) if (e.kind === "bridge-drainer" && !e.dead) alive++;
  for (let i = 0; i < count && alive < FINALE.maxDrainers; i++, alive++) {
    const a = game.rand() * Math.PI * 2;
    const d = game.spawnEnemyAt("bridge-drainer", boss.x + Math.cos(a) * 220, boss.y + Math.sin(a) * 220, true);
    d.hp = d.maxHp = d.maxHp * 1.6;
  }
  game.addFloater(boss.x, boss.y - 150, "SIPHON NODES", "#ffc23d");
}

function phaseOne(game: Game, boss: Enemy, step: number) {
  const p = game.player;
  boss.aiTimer = 4.4;
  if (step % 3 === 2 && decoysAlive(game) < 2) {
    spawnDecoys(game, boss);
    return;
  }
  if (step % 3 === 1) {
    for (let i = 0; i < 3; i++) hit(game, boss, p.x + (i - 1) * 120 + game.rand() * 40 - 20, p.y + game.rand() * 120 - 60, 88, 1.1 + i * 0.25, 1, "SPAM");
    game.audio.play("rugPull");
    return;
  }
  beam(game, boss, angleBetween(boss.x, boss.y, p.x, p.y), 1.2, 0.5, 0.5);
  game.audio.play("alarm");
}

function phaseTwo(game: Game, boss: Enemy, step: number) {
  const p = game.player;
  boss.aiTimer = 4.8;
  const mod = step % 3;
  if (mod === 1) {
    const base = angleBetween(boss.x, boss.y, p.x, p.y);
    for (let i = 0; i < 3; i++) beam(game, boss, base + (i / 3) * Math.PI * 2, 1.2, 2.6, 0.2, 0.5, true);
    game.audio.play("alarm");
    return;
  }
  if (mod === 2) {
    for (const off of [-250, 0, 250]) {
      game.addHazard({ shape: "rect", x: p.x + off, y: p.y, w: 120, h: 1100, windup: 1.4, active: 0, damage: boss.damage * 0.55, color: COLOR, source: SOURCE, knock: 0, label: "LOCKDOWN" });
    }
    game.addFloater(boss.x, boss.y - 170, "LOCKDOWN", COLOR);
    game.audio.play("gasSpike");
    return;
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + step;
    hit(game, boss, p.x + Math.cos(a) * 175, p.y + Math.sin(a) * 175, 80, 1.3, 1, "DRAIN");
  }
  spawnDrainers(game, boss, 1);
  game.audio.play("rugPull");
}

function phaseThree(game: Game, boss: Enemy, step: number) {
  const p = game.player;
  boss.aiTimer = 3.8;
  const mod = step % 3;
  if (mod === 1) {
    game.addHazard({
      shape: "circle",
      ring: true,
      x: boss.x,
      y: boss.y,
      r: FINALE.ringStart,
      grow: FINALE.ringGrow,
      windup: FINALE.ringWindup,
      active: FINALE.ringActive,
      damage: boss.damage * 0.55,
      color: "#d05cff",
      source: SOURCE,
      knock: 260,
      label: "REORG",
    });
    game.addFloater(boss.x, boss.y - 170, "REORG · DASH THROUGH", "#d05cff");
    game.audio.play("alarm");
    return;
  }
  if (mod === 2) {
    const base = angleBetween(boss.x, boss.y, p.x, p.y);
    for (let i = -2; i <= 2; i++) beam(game, boss, base + i * 0.5, 1.3, 0.5, 0.45);
    game.audio.play("alarm");
    return;
  }
  for (let i = 0; i < 5; i++) hit(game, boss, p.x + game.rand() * 340 - 170, p.y + game.rand() * 260 - 130, 84, 1.2 + i * 0.15, 1.1, "REWRITE");
  game.audio.play("rugPull");
}

export function updateAttacker(game: Game, boss: Enemy, dt: number, speed: number) {
  const p = game.player;
  const phase = attackerPhase(boss);
  if (phase !== boss.finalePhase) enterPhase(game, boss, phase);
  if ((boss.phaseBeat ?? 0) > 0) boss.phaseBeat = Math.max(0, (boss.phaseBeat ?? 0) - dt);
  boss.age = (boss.age ?? 0) + dt;
  if (phase === 2) {
    game.siphonFunds(FINALE.drainPerSec * dt, FINALE.drainFloor);
    if (boss.age >= FINALE.drainerEverySec) {
      boss.age = 0;
      spawnDrainers(game, boss, 1);
    }
  }
  if (dist(boss.x, boss.y, p.x, p.y) > boss.radius * 1.25) {
    const a = angleBetween(boss.x, boss.y, p.x, p.y);
    const pace = speed * (phase === 3 ? 1.3 : phase === 2 ? 0.95 : 0.8);
    boss.x += Math.cos(a) * pace * dt;
    boss.y += Math.sin(a) * pace * dt;
  }
  if ((boss.aiTimer ?? FINALE.openingDelaySec) > 0) return;
  const step = (boss.attackIndex = (boss.attackIndex ?? 0) + 1);
  if (phase === 1) phaseOne(game, boss, step);
  else if (phase === 2) phaseTwo(game, boss, step);
  else phaseThree(game, boss, step);
}
