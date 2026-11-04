import { ENEMIES } from "../data/enemies";
import { APPROVAL_EVOLVED_SPREAD, APPROVAL_SPREAD, approvalTags, keeperCloses, keeperThreshold, VAULT_EVOLVED_SHOVES, VAULT_FREEZE_SEC, VAULT_SHOVES, weaponAtLevel } from "../data/weapons";
import { COLORS } from "../constants";
import { OVERCLOCK } from "../data/spikes";
import type { Enemy, WeaponDef, WeaponInstance, WeaponKind } from "../types";
import { angleBetween, dist, randRange } from "../utils/math";
import { compact } from "./compact";
import { ARC_LIFE_SEC, type Game } from "./Game";
import { isHiddenFromWeapons } from "./threats";

const PAGER_JUMP_RANGE = 190;
const WHIP_HALF_ANGLE = Math.PI / 3;
const LOAN_WINDOW_SEC = 2.6;
const LOAN_TOUCH_RADIUS = 52;
const LOAN_DEFAULT_HP_SHARE = 0.05;
const LOAN_STALL_SEC = 3;
const PULSE_IDLE_LIMIT_SEC = 6;
const PULSE_MIN_GAP_SEC = 2;
const PULSE_MAX_BONUS = 1.6;
const PULSE_CROWD_BONUS = 0.03;
const FIELD_STILL_SEC = 2;
const SLASH_DURATION_SEC = 2;
const MAX_CONFIRMATIONS = 6;
const BEAM_WIDTH = 30;
const BOLT_HISTORY_STEPS = 15;
const NONCE_FAN = (50 * Math.PI) / 180;
const SEAL_LIFE_SEC = 14;
const SEAL_TICK_SEC = 0.3;
const LURE_RADIUS = 260;
const TRAP_FUSE_SEC = 1.1;
const KEEPER_ELITE_SHARE = 0.5;
const KEEPER_BLAST_RADIUS = 80;
const VAULT_ORBIT_SHARE = 0.6;
const VAULT_SPIN = 1.7;
const VAULT_RADIUS = 30;
const VAULT_SHOVE = 560;
const VAULT_BURST_MULT = 6;
const VAULT_FROZEN_MULT = 3;
const DRAIN_SEC = 4;
const DRAIN_TICK_SEC = 0.5;
const DRAIN_JUMP_RANGE = 240;

export type Loan = { x: number; y: number; until: number; total: number; damage: number; radius: number; weapon: WeaponInstance };
export type Seal = { x: number; y: number; until: number };
export type Lure = { x: number; y: number; until: number };
export type Vault = { x: number; y: number; angle: number; charge: number };

export function emptyVault(): Vault {
  return { x: 0, y: 0, angle: 0, charge: 0 };
}

function hitsSegment(e: Enemy, x1: number, y1: number, x2: number, y2: number, width: number): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((e.x - x1) * dx + (e.y - y1) * dy) / lengthSq));
  return dist(e.x, e.y, x1 + dx * t, y1 + dy * t) < width + e.radius;
}

function segmentHit(g: Game, x1: number, y1: number, x2: number, y2: number, width: number, damage: number, kind: WeaponKind): number {
  let hits = 0;
  for (const e of g.enemies) {
    if (e.dead || isHiddenFromWeapons(e) || !hitsSegment(e, x1, y1, x2, y2, width)) continue;
    g.damageEnemy(e, damage, 0, 0, kind);
    hits++;
  }
  return hits;
}

function arc(g: Game, x1: number, y1: number, x2: number, y2: number, color: string) {
  g.arcs.push({ x1, y1, x2, y2, life: ARC_LIFE_SEC, color });
}

function areaBonus(g: Game): number {
  return 1 + g.perks.area + (g.overclocking ? OVERCLOCK.areaBonus : 0);
}

function fireWhip(g: Game, w: WeaponInstance, def: WeaponDef) {
  const p = g.player;
  w.swings = (w.swings ?? 0) + 1;
  const heroBonus = p.characterId === "keel" && w.swings % 3 === 0 ? 2 : 1;
  const damage = g.weaponDamageScale(w, def.damage) * heroBonus;
  const radius = (def.aoe ?? def.range) * areaBonus(g);
  const aim = g.nearestEnemy(p.x, p.y, radius + 60);
  const forward = aim ? angleBetween(p.x, p.y, aim.x, aim.y) : p.facing;
  const faces = w.evolved ? [forward, forward + Math.PI] : [forward];
  for (const facing of faces) {
    for (const e of g.enemies) {
      if (e.dead || isHiddenFromWeapons(e) || dist(p.x, p.y, e.x, e.y) > radius + e.radius) continue;
      const off = Math.abs(Math.atan2(Math.sin(angleBetween(p.x, p.y, e.x, e.y) - facing), Math.cos(angleBetween(p.x, p.y, e.x, e.y) - facing)));
      if (off <= WHIP_HALF_ANGLE) g.damageEnemy(e, damage, e.x - p.x, e.y - p.y, w.kind);
    }
    g.shockwaves.push({ x: p.x, y: p.y, radius, life: 0.28, maxLife: 0.28, color: heroBonus > 1 ? "#ffffff" : "#ffd166", arc: facing });
  }
  g.audio.play("pulse");
}

function fireLoan(g: Game, w: WeaponInstance, def: WeaponDef) {
  if (g.loans.some((l) => l.weapon === w)) return;
  const p = g.player;
  const radius = (def.aoe ?? 185) * areaBonus(g);
  const damage = g.weaponDamageScale(w, def.damage);
  g.aoeHit(p.x, p.y, radius * 0.55, damage * 0.35, w.kind);
  const a = p.facing + randRange(-0.7, 0.7);
  const reach = randRange(120, 180);
  g.loans.push({ x: p.x + Math.cos(a) * reach, y: p.y + Math.sin(a) * reach, until: g.elapsed + LOAN_WINDOW_SEC, total: LOAN_WINDOW_SEC, damage, radius, weapon: w });
  g.audio.play("gasSpike");
}

function firePulse(g: Game, w: WeaponInstance, def: WeaponDef, cooldown: number) {
  const p = g.player;
  w.charge = (w.charge ?? 0) + cooldown;
  if (w.charge < PULSE_MIN_GAP_SEC) return;
  const radius = (def.aoe ?? 230) * areaBonus(g);
  let crowd = 0;
  for (const e of g.enemies) if (!e.dead && dist(p.x, p.y, e.x, e.y) < radius) crowd++;
  const threshold = Math.max(2, 7 - Math.floor(w.level / 2));
  if (crowd < threshold && w.charge < PULSE_IDLE_LIMIT_SEC) return;
  w.charge = 0;
  const bonus = Math.min(PULSE_MAX_BONUS, 1 + crowd * PULSE_CROWD_BONUS);
  g.aoeHit(p.x, p.y, radius, g.weaponDamageScale(w, def.damage) * bonus, w.kind);
  g.shockwaves.push({ x: p.x, y: p.y, radius, life: 0.3, maxLife: 0.3, color: "#b58cff" });
  if (w.evolved) g.addStrike(p.x, p.y, radius * 1.25, g.weaponDamageScale(w, def.damage) * bonus * 0.5, "#b58cff", 0.25, w.kind);
  g.audio.play("pulse");
}

function fireField(g: Game, w: WeaponInstance, def: WeaponDef) {
  const p = g.player;
  const still = Math.min(1, g.stillTime / FIELD_STILL_SEC);
  const radius = (def.aoe ?? 115) * areaBonus(g) * (w.evolved ? 1.33 : 1) * (1 + still * 0.5);
  g.fieldRadius = radius;
  const damage = g.weaponDamageScale(w, def.damage);
  for (const e of g.enemies) {
    if (e.dead || isHiddenFromWeapons(e) || dist(p.x, p.y, e.x, e.y) > radius + e.radius) continue;
    e.slashedUntil = g.elapsed + SLASH_DURATION_SEC;
    g.damageEnemy(e, damage, 0, 0, w.kind);
  }
}

function fireBeam(g: Game, w: WeaponInstance, def: WeaponDef) {
  const p = g.player;
  const confirmations = Math.min(MAX_CONFIRMATIONS, Math.floor(g.elapsed - g.lastHurtAt));
  const damage = g.weaponDamageScale(w, def.damage) * (1 + confirmations * 0.15);
  const spreads = w.evolved ? [-0.16, 0, 0.16] : [0];
  const aim = g.nearestEnemy(p.x, p.y, def.range);
  if (!aim) return;
  const forward = angleBetween(p.x, p.y, aim.x, aim.y);
  for (const spread of spreads) {
    const a = forward + spread;
    const x2 = p.x + Math.cos(a) * def.range;
    const y2 = p.y + Math.sin(a) * def.range;
    segmentHit(g, p.x, p.y, x2, y2, BEAM_WIDTH, damage, w.kind);
    arc(g, p.x, p.y, x2, y2, confirmations >= MAX_CONFIRMATIONS ? "#ffffff" : "#627eea");
  }
  g.audio.play("enemyShot");
}

function fireBolt(g: Game, w: WeaponInstance, def: WeaponDef) {
  const p = g.player;
  const path = g.pathLog;
  const past = path[Math.max(0, path.length - BOLT_HISTORY_STEPS)];
  if (!past) return;
  const damage = g.weaponDamageScale(w, def.damage);
  const length = dist(p.x, p.y, past.x, past.y);
  const reach = length < 70 ? 140 : 0;
  const x1 = past.x - Math.cos(p.facing) * reach;
  const y1 = past.y - Math.sin(p.facing) * reach;
  segmentHit(g, p.x, p.y, x1, y1, 26, damage, w.kind);
  arc(g, p.x, p.y, x1, y1, "#2ee6c7");
  if (w.evolved && path[0]) {
    segmentHit(g, x1, y1, path[0].x, path[0].y, 26, damage, w.kind);
    arc(g, x1, y1, path[0].x, path[0].y, "#2ee6c7");
  }
}

export function fireHotfix(g: Game, w: WeaponInstance, multiplier: number) {
  const p = g.player;
  const def = weaponAtLevel(w.kind, w.level);
  const count = 4 + w.level + (w.evolved ? 4 : 0);
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + p.facing;
    g.spawnProjectile(p.x, p.y, Math.cos(a), Math.sin(a), { ...def, damage: def.damage * multiplier }, w);
  }
}

function fireNonce(g: Game, w: WeaponInstance, def: WeaponDef) {
  const p = g.player;
  const count = 3 + w.level + (w.evolved ? 3 : 0);
  const aim = g.nearestEnemy(p.x, p.y, def.range);
  const center = aim ? angleBetween(p.x, p.y, aim.x, aim.y) : p.facing;
  for (let i = 0; i < count; i++) {
    const a = center - NONCE_FAN / 2 + (NONCE_FAN * i) / Math.max(1, count - 1);
    const shot = g.spawnProjectile(p.x, p.y, Math.cos(a), Math.sin(a), def, w, aim?.id);
    shot.homing = !!w.evolved;
  }
}

function placeSeal(g: Game, w: WeaponInstance) {
  const limit = w.evolved ? 4 : 3;
  g.seals.push({ x: g.player.x, y: g.player.y, until: g.elapsed + SEAL_LIFE_SEC });
  while (g.seals.length > limit) g.seals.shift();
  g.audio.play("blip");
}

function fireTrap(g: Game, w: WeaponInstance, def: WeaponDef) {
  const p = g.player;
  const damage = g.weaponDamageScale(w, def.damage);
  const radius = (def.aoe ?? 130) * areaBonus(g);
  const drops = w.evolved ? 3 : 1;
  for (let i = 0; i < drops; i++) {
    const x = p.x + (drops > 1 ? randRange(-130, 130) : 0);
    const y = p.y + (drops > 1 ? randRange(-100, 100) : 0);
    g.addStrike(x, y, radius, damage, "#ffc23d", TRAP_FUSE_SEC, w.kind);
    g.lures.push({ x, y, until: g.elapsed + TRAP_FUSE_SEC });
  }
}

function fireOracle(g: Game, w: WeaponInstance, def: WeaponDef) {
  const p = g.player;
  const inRange = g.enemies.filter((e) => !e.dead && !isHiddenFromWeapons(e) && dist(p.x, p.y, e.x, e.y) < def.range);
  if (!inRange.length) return;
  const calls = w.evolved ? 3 : 1;
  const radius = (def.aoe ?? 95) * areaBonus(g);
  const lying = g.priceLieTimer > 0 ? 2 : 1;
  const delay = g.perks.cleanFeed > 0 ? 0.28 : 0.4;
  for (let i = 0; i < calls; i++) {
    let best = inRange[0]!;
    let crowd = -1;
    for (let sample = 0; sample < 6; sample++) {
      const e = inRange[Math.floor(g.rand() * inRange.length)]!;
      const near = inRange.reduce((n, o) => (dist(e.x, e.y, o.x, o.y) < radius ? n + 1 : n), 0);
      if (near > crowd) {
        crowd = near;
        best = e;
      }
    }
    g.addStrike(best.x, best.y, radius, g.weaponDamageScale(w, def.damage) * lying, "#79c0ff", delay + i * 0.12, w.kind);
  }
}

function firePager(g: Game, w: WeaponInstance, def: WeaponDef) {
  const hits = 3 + Math.floor(w.level / 2) + (w.evolved ? 3 : 0) + g.perks.pierce;
  const damage = g.weaponDamageScale(w, def.damage);
  const visited = new Set<number>();
  let fromX = g.player.x;
  let fromY = g.player.y;
  let reach = def.range;
  for (let i = 0; i < hits; i++) {
    let next: Enemy | undefined;
    let best = reach;
    for (const e of g.enemies) {
      if (e.dead || visited.has(e.id) || isHiddenFromWeapons(e)) continue;
      const d = dist(fromX, fromY, e.x, e.y);
      if (d < best) {
        best = d;
        next = e;
      }
    }
    if (!next) break;
    visited.add(next.id);
    arc(g, fromX, fromY, next.x, next.y, "#9b8cff");
    fromX = next.x;
    fromY = next.y;
    reach = PAGER_JUMP_RANGE;
    g.damageEnemy(next, damage, 0, 0, w.kind);
  }
  if (visited.size) g.audio.play("blip");
}

function fireWhale(g: Game, w: WeaponInstance, def: WeaponDef) {
  const p = g.player;
  const heavy = g.enemies
    .filter((e) => !e.dead && !isHiddenFromWeapons(e) && dist(p.x, p.y, e.x, e.y) < def.range)
    .sort((a, b) => b.hp - a.hp)
    .slice(0, (w.evolved ? 3 : 1) + g.perks.multishot);
  for (const e of heavy) {
    const a = angleBetween(p.x, p.y, e.x, e.y);
    g.spawnProjectile(p.x, p.y, Math.cos(a), Math.sin(a), def, w, e.id);
  }
  if (heavy.length) g.audio.play("enemyShot");
}

function fireAimed(g: Game, w: WeaponInstance, def: WeaponDef) {
  const p = g.player;
  const target = g.nearestEnemy(p.x, p.y, def.range);
  if (!target) return;
  const ang = angleBetween(p.x, p.y, target.x, target.y);
  const spreads = w.evolved ? (w.kind === "merkle-proof" ? [-0.45, 0, 0.45] : [-0.1, 0.1]) : [0];
  for (let extra = 1; extra <= g.perks.multishot; extra++) spreads.push(extra * (extra % 2 ? 0.2 : -0.2));
  for (const spread of spreads) {
    const shot = g.spawnProjectile(p.x, p.y, Math.cos(ang + spread), Math.sin(ang + spread), def, w, target.id);
    shot.homing = w.kind === "audit-dart";
  }
}

const keeperScratch: Enemy[] = [];

function hpShare(e: Enemy): number {
  return e.hp / Math.max(1, e.maxHp);
}

function fireKeeper(g: Game, w: WeaponInstance, def: WeaponDef) {
  const p = g.player;
  const threshold = keeperThreshold(w.level, w.evolved);
  keeperScratch.length = 0;
  for (const e of g.enemies) {
    if (!e.dead && !isHiddenFromWeapons(e) && dist(p.x, p.y, e.x, e.y) < def.range) keeperScratch.push(e);
  }
  if (!keeperScratch.length) return;
  keeperScratch.sort((a, b) => hpShare(a) - hpShare(b) || a.id - b.id);
  const damage = g.weaponDamageScale(w, def.damage);
  let closes = 0;
  for (const e of keeperScratch) {
    if (closes >= keeperCloses(w.level)) break;
    if (ENEMIES[e.kind].isBoss || hpShare(e) > threshold * (e.elite ? KEEPER_ELITE_SHARE : 1)) continue;
    closes++;
    const x = e.x;
    const y = e.y;
    arc(g, p.x, p.y, x, y, "#3cf07c");
    g.damageEnemy(e, Math.ceil(e.hp + (e.shield ?? 0)) + 1, 0, 0, w.kind);
    if (w.evolved) g.addStrike(x, y, KEEPER_BLAST_RADIUS * areaBonus(g), damage * 3, "#3cf07c", 0, w.kind);
  }
  if (closes) {
    g.audio.play("coin");
    return;
  }
  const weakest = keeperScratch[0]!;
  arc(g, p.x, p.y, weakest.x, weakest.y, "#3cf07c");
  g.damageEnemy(weakest, damage * (2 - hpShare(weakest)), 0, 0, w.kind);
}

function vaultShoves(w: WeaponInstance): number {
  return w.evolved ? VAULT_EVOLVED_SHOVES : VAULT_SHOVES;
}

function fireVault(g: Game, w: WeaponInstance, def: WeaponDef) {
  const v = g.vault;
  const damage = g.weaponDamageScale(w, def.damage);
  for (const e of g.enemies) {
    if (e.dead || isHiddenFromWeapons(e) || dist(v.x, v.y, e.x, e.y) > VAULT_RADIUS + e.radius) continue;
    if (!ENEMIES[e.kind].isBoss) {
      const a = angleBetween(g.player.x, g.player.y, e.x, e.y);
      e.kx = Math.cos(a) * VAULT_SHOVE;
      e.ky = Math.sin(a) * VAULT_SHOVE;
    }
    v.charge++;
    g.damageEnemy(e, damage, 0, 0, w.kind);
  }
  if (v.charge < vaultShoves(w)) return;
  v.charge = 0;
  const radius = (def.aoe ?? 170) * areaBonus(g);
  const until = g.elapsed + VAULT_FREEZE_SEC;
  for (const e of g.enemies) {
    if (e.dead || isHiddenFromWeapons(e) || dist(v.x, v.y, e.x, e.y) > radius + e.radius) continue;
    const frozen = g.elapsed < (e.frozenUntil ?? 0);
    if (!ENEMIES[e.kind].isBoss) e.frozenUntil = Math.max(e.frozenUntil ?? 0, until);
    g.damageEnemy(e, damage * VAULT_BURST_MULT * (w.evolved && frozen ? VAULT_FROZEN_MULT : 1), 0, 0, w.kind);
  }
  g.shockwaves.push({ x: v.x, y: v.y, radius, life: 0.35, maxLife: 0.35, color: "#9fe8ff" });
  g.addTrauma(0.2);
  g.audio.play("pulse");
}

function drainOf(w: WeaponInstance): number {
  return w.evolved ? DRAIN_TICK_SEC / 2 : DRAIN_TICK_SEC;
}

function tagDrain(g: Game, e: Enemy, damage: number, tick: number) {
  e.drainUntil = g.elapsed + DRAIN_SEC;
  e.drainTick = g.elapsed + tick;
  e.drainDamage = damage;
}

function fireApproval(g: Game, w: WeaponInstance, def: WeaponDef) {
  const p = g.player;
  const damage = g.weaponDamageScale(w, def.damage);
  const tick = drainOf(w);
  let tags = approvalTags(w.level);
  while (tags > 0) {
    let best: Enemy | undefined;
    let bestD = def.range;
    for (const e of g.enemies) {
      if (e.dead || isHiddenFromWeapons(e) || (e.drainUntil ?? 0) > g.elapsed) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) break;
    tagDrain(g, best, damage, tick);
    arc(g, p.x, p.y, best.x, best.y, "#d05cff");
    tags--;
  }
}

export function spreadDrain(g: Game, from: Enemy) {
  const tool = g.weapons.find((w) => w.kind === "infinite-approval");
  if (!tool) return;
  const damage = from.drainDamage ?? 0;
  let jumps = tool.evolved ? APPROVAL_EVOLVED_SPREAD : APPROVAL_SPREAD;
  while (jumps > 0) {
    let best: Enemy | undefined;
    let bestD = DRAIN_JUMP_RANGE;
    for (const e of g.enemies) {
      if (e.dead || e === from || isHiddenFromWeapons(e) || (e.drainUntil ?? 0) > g.elapsed) continue;
      const d = dist(from.x, from.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return;
    tagDrain(g, best, damage, drainOf(tool));
    arc(g, from.x, from.y, best.x, best.y, "#d05cff");
    jumps--;
  }
}

function tickDrains(g: Game, w: WeaponInstance) {
  const tick = drainOf(w);
  for (const e of g.enemies) {
    if (e.dead || (e.drainUntil ?? 0) <= 0) continue;
    if (g.elapsed > (e.drainUntil ?? 0)) {
      e.drainUntil = 0;
      continue;
    }
    if (g.elapsed < (e.drainTick ?? 0)) continue;
    e.drainTick = (e.drainTick ?? g.elapsed) + tick;
    g.damageEnemy(e, e.drainDamage ?? 0, 0, 0, w.kind);
  }
}

export function fireTool(g: Game, w: WeaponInstance, def: WeaponDef, cooldown: number) {
  switch (w.kind) {
    case "reorg-whip": return fireWhip(g, w, def);
    case "flash-loan": return fireLoan(g, w, def);
    case "memo-pulse": return firePulse(g, w, def, cooldown);
    case "slashing-field": return fireField(g, w, def);
    case "finality-beam": return fireBeam(g, w, def);
    case "bridge-bolt": return fireBolt(g, w, def);
    case "patch-burst": return fireHotfix(g, w, 1);
    case "nonce-shard": return fireNonce(g, w, def);
    case "validator-seal": return placeSeal(g, w);
    case "honeypot-trap": return fireTrap(g, w, def);
    case "oracle-strike": return fireOracle(g, w, def);
    case "pager-ping": return firePager(g, w, def);
    case "whale-alert": return fireWhale(g, w, def);
    case "keeper-bot": return fireKeeper(g, w, def);
    case "air-gap-vault": return fireVault(g, w, def);
    case "infinite-approval": return fireApproval(g, w, def);
    default: return fireAimed(g, w, def);
  }
}

export function updateToolState(g: Game, dt: number) {
  const p = g.player;
  g.stillTime = Math.hypot(p.vx, p.vy) < 10 ? g.stillTime + dt : 0;
  if (g.lures.length > 0) compact(g.lures, (l) => l.until > g.elapsed);

  for (const loan of g.loans) {
    if (dist(p.x, p.y, loan.x, loan.y) < LOAN_TOUCH_RADIUS) {
      loan.until = -1;
      loan.weapon.timer = 0;
      g.addStrike(p.x, p.y, loan.radius * 1.4, loan.damage * 3, "#ffb020", 0, loan.weapon.kind);
      g.addFloater(p.x, p.y - 70, "LOAN REPAID", "#2ee6c7");
      g.audio.play("txConfirmed");
      if (loan.weapon.evolved) g.addStrike(p.x, p.y, loan.radius * 0.8, loan.damage * 2, "#ffb020", 0.25, loan.weapon.kind);
    } else if (g.elapsed >= loan.until) {
      loan.until = -1;
      loan.weapon.timer = LOAN_STALL_SEC;
      if (!loan.weapon.evolved) {
        g.selfDamage(p.maxHp * LOAN_DEFAULT_HP_SHARE);
        g.addFloater(p.x, p.y - 70, "LOAN DEFAULT", "#ff5c48");
        g.audio.play("liquidation");
      }
    }
  }
  if (g.loans.length > 0) compact(g.loans, (l) => l.until > 0);

  const sealTool = g.weapons.find((w) => w.kind === "validator-seal");
  if (!sealTool) g.seals.length = 0;
  else if (g.seals.length > 0) compact(g.seals, (s) => s.until > g.elapsed);
  if (sealTool && g.seals.length > 1) {
    g.sealTick -= dt;
    if (g.sealTick <= 0) {
      g.sealTick = SEAL_TICK_SEC;
      const damage = g.weaponDamageScale(sealTool, weaponAtLevel(sealTool.kind, sealTool.level).damage);
      for (let i = 0; i < g.seals.length; i++) {
        const a = g.seals[i]!;
        const b = g.seals[(i + 1) % g.seals.length]!;
        if (g.seals.length === 2 && i === 1) break;
        segmentHit(g, a.x, a.y, b.x, b.y, 18, damage, sealTool.kind);
      }
    }
  }

  g.fieldRadius = g.weapons.some((w) => w.kind === "slashing-field") ? g.fieldRadius : 0;

  for (const w of g.weapons) {
    if (w.kind === "air-gap-vault") {
      const v = g.vault;
      v.angle += dt * VAULT_SPIN;
      const reach = weaponAtLevel(w.kind, w.level).range * VAULT_ORBIT_SHARE;
      v.x = p.x + Math.cos(v.angle) * reach;
      v.y = p.y + Math.sin(v.angle) * reach;
    } else if (w.kind === "infinite-approval" && !w.jammed) {
      tickDrains(g, w);
    }
  }
}

export function vaultFill(g: Game): number {
  const w = g.weapons.find((x) => x.kind === "air-gap-vault");
  return w ? g.vault.charge / vaultShoves(w) : 0;
}

export function applyLure(g: Game, e: Enemy, speed: number, dt: number): boolean {
  if (ENEMIES[e.kind].isBoss) return false;
  for (const lure of g.lures) {
    if (dist(e.x, e.y, lure.x, lure.y) > LURE_RADIUS) continue;
    const a = angleBetween(e.x, e.y, lure.x, lure.y);
    e.x += Math.cos(a) * speed * 1.4 * dt;
    e.y += Math.sin(a) * speed * 1.4 * dt;
    return true;
  }
  return false;
}

export const TOOL_COLORS: Partial<Record<WeaponKind, string>> = {
  "audit-dart": "#58a6ff",
  "patch-burst": "#79c0ff",
  "nonce-shard": "#f0c14d",
  "merkle-proof": "#7ee787",
  "whale-alert": "#ff9f43",
  "keeper-bot": "#3cf07c",
  "air-gap-vault": "#9fe8ff",
  "infinite-approval": "#d05cff",
};

export const DEFAULT_TOOL_COLOR = COLORS.gold;
