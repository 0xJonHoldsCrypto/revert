import { ENEMIES } from "../data/enemies";
import { ASCENSION, OVERCLOCK, SURGE_TUNING } from "../data/spikes";
import { SURGE_CHOICES, SURGE_ORDER, SURGES, type SurgeId } from "../data/surges";
import { EVOLUTIONS, EVOLVED_COOLDOWN_MULT, EVOLVED_DAMAGE_MULT, WEAPONS } from "../data/weapons";
import { COLORS } from "../constants";
import type { Enemy, UpgradeDef, WeaponDef, WeaponInstance } from "../types";
import { lootRandom, normalize } from "../utils/math";
import { compact } from "./compact";
import { MAX_RIG_TIER, type Game } from "./Game";
import { isHiddenFromWeapons } from "./threats";
import { fireTool } from "./tools";

export type Blade = { angle: number; until: number; x: number; y: number };
export type TrailNode = { x: number; y: number; until: number };

export type SpikeState = {
  surges: SurgeId[];
  blades: Blade[];
  trail: TrailNode[];
  trailNextAt: number;
  trailTickAt: number;
  pickupBlastAt: number;
  stasisAt: number;
  barrier: number;
  barrierKills: number;
  rigShots: number;
  charge: number;
  bucket: number;
  bucketAt: number;
  readyAnnounced: boolean;
  overclockUntil: number;
  overclockLen: number;
  overclockKills: number;
  overclockUses: number;
  bestCrowd: number;
  ascensions: number;
  slowLeft: number;
  slowScale: number;
  flashSerial: number;
  flashStrength: number;
  flashColor: string;
  damage: Map<string, number>;
  source: string | null;
};

export function emptySpikes(): SpikeState {
  return {
    surges: [],
    blades: [],
    trail: [],
    trailNextAt: 0,
    trailTickAt: 0,
    pickupBlastAt: 0,
    stasisAt: 0,
    barrier: 0,
    barrierKills: 0,
    rigShots: 0,
    charge: 0,
    bucket: OVERCLOCK.burst,
    bucketAt: 0,
    readyAnnounced: false,
    overclockUntil: 0,
    overclockLen: OVERCLOCK.duration,
    overclockKills: 0,
    overclockUses: 0,
    bestCrowd: 0,
    ascensions: 0,
    slowLeft: 0,
    slowScale: 1,
    flashSerial: 0,
    flashStrength: 0,
    flashColor: "#ffffff",
    damage: new Map(),
    source: null,
  };
}

export function hasSurge(g: Game, id: SurgeId): boolean {
  return g.spikes.surges.includes(id);
}

export function overclocking(g: Game): boolean {
  return g.elapsed < g.spikes.overclockUntil;
}

export function overclockReady(g: Game): boolean {
  return !overclocking(g) && g.spikes.charge >= OVERCLOCK.need;
}

export function overclockLength(g: Game): number {
  return OVERCLOCK.duration + (hasSurge(g, "overcharge") ? OVERCLOCK.overchargeSec : 0);
}

export function spikeHit(g: Game, e: Enemy, damage: number, fromX: number, fromY: number, source: string) {
  g.spikes.source = source;
  g.damageEnemy(e, damage, e.x - fromX, e.y - fromY);
  g.spikes.source = null;
}

export function noteSpikeDamage(g: Game, dealt: number) {
  const s = g.spikes;
  if (s.source) s.damage.set(s.source, (s.damage.get(s.source) ?? 0) + dealt);
}

function blast(g: Game, x: number, y: number, radius: number, damage: number, source: string) {
  for (const e of g.enemies) {
    if (e.dead || isHiddenFromWeapons(e)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const reach = radius + e.radius;
    if (dx * dx + dy * dy > reach * reach) continue;
    spikeHit(g, e, damage, x, y, source);
  }
}

function flash(g: Game, color: string, strength: number) {
  const s = g.spikes;
  s.flashSerial++;
  s.flashStrength = strength;
  s.flashColor = color;
}

function slowmo(g: Game, seconds: number, scale: number) {
  const calm = g.cosmetics.calm;
  g.spikes.slowLeft = calm ? Math.min(seconds, ASCENSION.calmSec) : seconds;
  g.spikes.slowScale = calm ? Math.max(scale, ASCENSION.calmScale) : scale;
}

export function timeScale(g: Game, realDt: number): number {
  const s = g.spikes;
  if (s.slowLeft <= 0 || g.phase !== "playing") return 1;
  s.slowLeft = Math.max(0, s.slowLeft - realDt);
  return s.slowScale;
}

export function evolveTool(g: Game, w: WeaponInstance) {
  w.evolved = true;
  g.noteCodex(`v:${w.kind}`);
  g.emit("evolve");
  ascend(g, w);
}

export function ascend(g: Game, w: WeaponInstance) {
  const p = g.player;
  const evo = EVOLUTIONS[w.kind];
  const s = g.spikes;
  s.ascensions++;
  g.noteCodex("x:ascend");
  const radius = ASCENSION.radius * (1 + g.perks.area * 0.5);
  const damage = g.strikeDamage() * ASCENSION.damageMult;
  for (const e of g.enemies) {
    if (e.dead || isHiddenFromWeapons(e)) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > radius + e.radius) continue;
    spikeHit(g, e, damage * (1 - 0.4 * Math.min(1, d / radius)) * (ENEMIES[e.kind].isBoss ? ASCENSION.bossShare : 1), p.x, p.y, "ascension");
    if (!e.dead && !ENEMIES[e.kind].isBoss) {
      const n = normalize(dx, dy);
      e.kx = n.x * ASCENSION.knock;
      e.ky = n.y * ASCENSION.knock;
    }
  }
  const color = COLORS.gold;
  g.shockwaves.push({ x: p.x, y: p.y, radius, life: 0.6, maxLife: 0.6, color });
  g.shockwaves.push({ x: p.x, y: p.y, radius: radius * 0.6, life: 0.4, maxLife: 0.4, color: "#ffffff" });
  g.burstParticles(p.x, p.y, color, 40);
  g.burstParticles(p.x, p.y, "#ffffff", 16);
  g.addFloater(p.x, p.y - 80, "ASCENDED", color);
  g.showBannerNow(`ASCENSION · ${evo.name.toUpperCase()}`, `${WEAPONS[w.kind].name} evolves. ${evo.blurb} Damage x${EVOLVED_DAMAGE_MULT}, cooldown -${Math.round((1 - EVOLVED_COOLDOWN_MULT) * 100)}%.`, color);
  g.hitstop = Math.max(g.hitstop, ASCENSION.hitstop);
  g.impactFrames = Math.max(g.impactFrames, 2);
  g.addTrauma(0.75);
  slowmo(g, ASCENSION.slowSec, ASCENSION.slowScale);
  flash(g, "#fff3c4", 0.85);
  g.audio.play("ascend");
  g.onHaptic?.("ascend");
}

export function activateOverclock(g: Game) {
  const s = g.spikes;
  if (!overclockReady(g) || g.dying > 0) return false;
  const p = g.player;
  s.charge = 0;
  s.readyAnnounced = false;
  s.overclockLen = overclockLength(g);
  s.overclockUntil = g.elapsed + s.overclockLen;
  s.overclockKills = 0;
  s.overclockUses++;
  g.noteCodex("x:overclock");
  blast(g, p.x, p.y, OVERCLOCK.ring, g.strikeDamage() * OVERCLOCK.ringDamage, "overclock");
  for (const e of g.enemies) {
    if (e.dead || ENEMIES[e.kind].isBoss) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > OVERCLOCK.ring * OVERCLOCK.ring) continue;
    const n = normalize(dx, dy);
    e.kx = n.x * 420;
    e.ky = n.y * 420;
  }
  if (p.characterId === "ledger") g.ledgerShield = Math.min(g.ledgerShieldMax(), g.ledgerShield + g.ledgerShieldMax() * OVERCLOCK.ledgerRefill);
  g.shockwaves.push({ x: p.x, y: p.y, radius: OVERCLOCK.ring, life: 0.5, maxLife: 0.5, color: "#ff6b3d" });
  g.shockwaves.push({ x: p.x, y: p.y, radius: OVERCLOCK.ring * 0.55, life: 0.35, maxLife: 0.35, color: "#ffe08a" });
  g.burstParticles(p.x, p.y, "#ff6b3d", 30);
  g.addFloater(p.x, p.y - 80, "OVERCLOCK", "#ff6b3d");
  g.showBannerNow("OVERCLOCK", "Cooldowns halved. Damage x1.6. Bigger shots and blasts.", "#ff6b3d");
  g.addTrauma(0.5);
  flash(g, "#ffb27a", 0.45);
  g.hitstop = Math.max(g.hitstop, 0.05);
  g.audio.setIntensity(true);
  g.audio.play("overclock");
  g.onHaptic?.("overclock");
  return true;
}

function endOverclock(g: Game) {
  const s = g.spikes;
  s.overclockUntil = 0;
  s.bestCrowd = Math.max(s.bestCrowd, s.overclockKills);
  g.emit("overclock", { kills: s.overclockKills });
  g.audio.setIntensity(false);
  g.audio.play("overclockEnd");
  g.addToast(`Overclock done · ${s.overclockKills} reverted`, "#ff6b3d");
}

export function chargeOverclock(g: Game, amount: number) {
  const s = g.spikes;
  if (overclocking(g) || s.charge >= OVERCLOCK.need) return;
  s.bucket = Math.min(OVERCLOCK.burst, s.bucket + Math.max(0, g.elapsed - s.bucketAt) * OVERCLOCK.maxRate);
  s.bucketAt = g.elapsed;
  const take = Math.min(amount, s.bucket);
  s.bucket -= take;
  s.charge = Math.min(OVERCLOCK.need, s.charge + take * (hasSurge(g, "overcharge") ? OVERCLOCK.overchargeRate : 1));
  if (s.charge >= OVERCLOCK.need && !s.readyAnnounced) {
    s.readyAnnounced = true;
    g.addToast("OVERCLOCK READY · press F", "#ff6b3d");
    g.audio.play("txConfirmed");
    g.onHaptic?.("ready");
  }
}

export function fillOverclock(g: Game) {
  g.spikes.charge = OVERCLOCK.need;
  g.spikes.readyAnnounced = true;
}

export function killCharge(e: Enemy): number {
  const def = ENEMIES[e.kind];
  if (def.isBoss) return OVERCLOCK.bossValue;
  if (e.elite) return OVERCLOCK.eliteValue;
  return Math.min(OVERCLOCK.killMax, Math.max(OVERCLOCK.killMin, def.xp / OVERCLOCK.killXpDivisor));
}

export function chargeFromDamage(g: Game, e: Enemy, dealt: number) {
  if (!ENEMIES[e.kind].isBoss) return;
  chargeOverclock(g, (dealt / Math.max(1, e.maxHp)) * OVERCLOCK.bossShare);
}

export function onSpikeKill(g: Game, e: Enemy) {
  const s = g.spikes;
  if (overclocking(g)) s.overclockKills++;
  if (e.kind !== "boss-attacker") chargeOverclock(g, killCharge(e));
  if (hasSurge(g, "blade-storm")) {
    s.blades.push({ angle: s.blades.length * 0.9, until: g.elapsed + SURGE_TUNING.bladeLife, x: e.x, y: e.y });
    if (s.blades.length > SURGE_TUNING.bladeMax) s.blades.shift();
  }
  if (hasSurge(g, "kill-barrier") && g.effects.healMult > 0 && ++s.barrierKills >= SURGE_TUNING.barrierEvery) {
    s.barrierKills = 0;
    const cap = barrierCap(g);
    if (s.barrier < cap) {
      s.barrier = Math.min(cap, s.barrier + g.player.maxHp * SURGE_TUNING.barrierShare);
      g.addFloater(g.player.x, g.player.y - 70, "BARRIER", SURGES["kill-barrier"].color);
      g.audio.play("txConfirmed");
    }
  }
}

export function barrierCap(g: Game): number {
  return g.player.maxHp * SURGE_TUNING.barrierShare * SURGE_TUNING.barrierMax;
}

export function absorbBarrier(g: Game, damage: number): number {
  const s = g.spikes;
  if (s.barrier <= 0) return damage;
  const blocked = Math.min(s.barrier, damage);
  s.barrier -= blocked;
  g.burstParticles(g.player.x, g.player.y, SURGES["kill-barrier"].color, 6);
  return damage - blocked;
}

export function onPickupCollected(g: Game) {
  if (!hasSurge(g, "volatile-pickups") || g.elapsed < g.spikes.pickupBlastAt) return;
  g.spikes.pickupBlastAt = g.elapsed + SURGE_TUNING.pickupBlastGap;
  const p = g.player;
  blast(g, p.x, p.y, SURGE_TUNING.pickupBlastRadius, g.strikeDamage() * SURGE_TUNING.pickupBlastDamage, "volatile-pickups");
  g.shockwaves.push({ x: p.x, y: p.y, radius: SURGE_TUNING.pickupBlastRadius, life: 0.22, maxLife: 0.22, color: SURGES["volatile-pickups"].color });
}

export function echoVolley(g: Game, w: WeaponInstance, def: WeaponDef, cooldown: number) {
  if (!hasSurge(g, "echo-volley") || def.orbit) return;
  w.echo = (w.echo ?? 0) + 1;
  if (w.echo % SURGE_TUNING.echoEvery !== 0) return;
  fireTool(g, w, def, cooldown);
  g.burstParticles(g.player.x, g.player.y, SURGES["echo-volley"].color, 4);
}

export function updateSpikes(g: Game, dt: number) {
  const s = g.spikes;
  const p = g.player;

  if (s.overclockUntil > 0 && g.elapsed >= s.overclockUntil) endOverclock(g);

  if (s.blades.length > 0) {
    compact(s.blades, (b) => b.until > g.elapsed);
    for (const b of s.blades) {
      b.angle += dt * SURGE_TUNING.bladeSpin;
      b.x = p.x + Math.cos(b.angle) * SURGE_TUNING.bladeReach;
      b.y = p.y + Math.sin(b.angle) * SURGE_TUNING.bladeReach;
      for (const e of g.enemies) {
        if (e.dead || isHiddenFromWeapons(e) || g.elapsed < (e.bladeAt ?? 0)) continue;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const reach = SURGE_TUNING.bladeRadius + e.radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        e.bladeAt = g.elapsed + SURGE_TUNING.bladeHitGap;
        spikeHit(g, e, g.strikeDamage() * SURGE_TUNING.bladeDamage, p.x, p.y, "blade-storm");
      }
    }
  }

  if (hasSurge(g, "wake-trail")) {
    if (p.dashTimer > 0 && g.elapsed >= s.trailNextAt) {
      s.trailNextAt = g.elapsed + SURGE_TUNING.trailGap;
      s.trail.push({ x: p.x, y: p.y, until: g.elapsed + SURGE_TUNING.trailLife });
      if (s.trail.length > SURGE_TUNING.trailMax) s.trail.shift();
    }
    if (s.trail.length > 0) {
      compact(s.trail, (n) => n.until > g.elapsed);
      if (g.elapsed >= s.trailTickAt) {
        s.trailTickAt = g.elapsed + SURGE_TUNING.trailHitGap;
        const damage = g.strikeDamage() * SURGE_TUNING.trailDamage;
        for (const e of g.enemies) {
          if (e.dead || isHiddenFromWeapons(e)) continue;
          const reach = SURGE_TUNING.trailRadius + e.radius;
          for (const n of s.trail) {
            const dx = e.x - n.x;
            const dy = e.y - n.y;
            if (dx * dx + dy * dy > reach * reach) continue;
            spikeHit(g, e, damage, n.x, n.y, "wake-trail");
            break;
          }
        }
      }
    }
  }

  if (hasSurge(g, "stasis-pulse") && g.elapsed >= s.stasisAt) {
    s.stasisAt = g.elapsed + SURGE_TUNING.stasisEvery;
    const until = g.elapsed + SURGE_TUNING.stasisSec;
    for (const e of g.enemies) {
      if (e.dead || isHiddenFromWeapons(e)) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > SURGE_TUNING.stasisRadius * SURGE_TUNING.stasisRadius) continue;
      if (!ENEMIES[e.kind].isBoss) e.frozenUntil = Math.max(e.frozenUntil ?? 0, until);
      e.slashedUntil = Math.max(e.slashedUntil ?? 0, until);
    }
    g.shockwaves.push({ x: p.x, y: p.y, radius: SURGE_TUNING.stasisRadius, life: 0.45, maxLife: 0.45, color: SURGES["stasis-pulse"].color });
    g.audio.play("pulse");
  }
}

function strongestUnevolved(g: Game): WeaponInstance | undefined {
  let best: WeaponInstance | undefined;
  let bestDps = -1;
  for (const w of g.weapons) {
    if (w.evolved) continue;
    const dps = g.toolDps(w.kind, w.level, w.rarity);
    if (dps > bestDps) {
      bestDps = dps;
      best = w;
    }
  }
  return best;
}

function freeAscensionTarget(g: Game): WeaponInstance | undefined {
  let best: WeaponInstance | undefined;
  let bestDps = -1;
  for (const w of g.weapons) {
    if (w.evolved || g.ownsUpgrade(EVOLUTIONS[w.kind].needs)) continue;
    const dps = g.toolDps(w.kind, w.level, w.rarity);
    if (dps > bestDps) {
      bestDps = dps;
      best = w;
    }
  }
  return best ?? undefined;
}

export function surgeAvailable(g: Game, id: SurgeId): boolean {
  if (hasSurge(g, id)) return false;
  if (id === "kill-barrier") return g.effects.healMult > 0;
  if (id === "free-ascension") return !!freeAscensionTarget(g);
  if (id === "overdrive") return g.weapons.some((w) => w.level < WEAPONS[w.kind].maxLevel) || g.rigs.some((r) => r.tier < MAX_RIG_TIER);
  if (id === "echo-volley") return g.weapons.some((w) => !WEAPONS[w.kind].orbit) || g.rigs.some((r) => r.kind === "dev-laptop");
  return true;
}

function overdriveTargets(g: Game): WeaponInstance[] {
  return g.weapons
    .filter((w) => w.level < WEAPONS[w.kind].maxLevel)
    .sort((a, b) => g.toolDps(b.kind, b.level, b.rarity, b.evolved) - g.toolDps(a.kind, a.level, a.rarity, a.evolved))
    .slice(0, SURGE_TUNING.overdriveTools);
}

export function surgeValue(g: Game, id: SurgeId): number {
  const total = g.totalDps();
  if (id === "free-ascension") {
    const w = freeAscensionTarget(g);
    if (!w) return 0;
    const level = Math.min(WEAPONS[w.kind].maxLevel, w.level + SURGE_TUNING.freeAscensionLevels);
    return g.toolDps(w.kind, level, w.rarity, true) - g.toolDps(w.kind, w.level, w.rarity) + total * 0.08;
  }
  if (id === "overdrive") {
    let gain = 0;
    for (const w of overdriveTargets(g)) gain += g.toolDps(w.kind, w.level + 1, w.rarity, w.evolved) - g.toolDps(w.kind, w.level, w.rarity, w.evolved);
    return gain * 1.1 + total * 0.04 + total * 0.03 * g.rigs.length;
  }
  if (id === "echo-volley") {
    let fired = 0;
    for (const w of g.weapons) if (!WEAPONS[w.kind].orbit) fired += g.toolDps(w.kind, w.level, w.rarity, w.evolved);
    return fired * SURGES["echo-volley"].value + total * 0.03 * g.rigs.length;
  }
  return total * SURGES[id].value;
}

export function applySurge(g: Game, id: SurgeId) {
  const s = g.spikes;
  if (s.surges.includes(id)) return;
  s.surges.push(id);
  const def = SURGES[id];
  const p = g.player;
  if (id === "overdrive") {
    for (const w of overdriveTargets(g)) w.level += SURGE_TUNING.overdriveLevels;
    for (const r of g.rigs) r.tier = Math.min(MAX_RIG_TIER, r.tier + 1);
    g.syncOrbiters();
  } else if (id === "overcharge") {
    if (!overclocking(g)) s.charge = Math.max(s.charge, OVERCLOCK.need * OVERCLOCK.overchargeStart);
  } else if (id === "kill-barrier") {
    s.barrierKills = 0;
  } else if (id === "stasis-pulse") {
    s.stasisAt = g.elapsed + SURGE_TUNING.stasisEvery;
  }
  g.noteCodex(`s:${id}`);
  g.emit("surge");
  g.shockwaves.push({ x: p.x, y: p.y, radius: 220, life: 0.5, maxLife: 0.5, color: def.color });
  g.burstParticles(p.x, p.y, def.color, 28);
  g.addFloater(p.x, p.y - 80, def.name.toUpperCase(), def.color);
  g.showBannerNow(`SURGE · ${def.name.toUpperCase()}`, def.line, def.color);
  flash(g, def.color, 0.4);
  g.audio.play("surge");
  g.onHaptic?.("surge");
  if (id === "free-ascension") {
    const w = freeAscensionTarget(g) ?? strongestUnevolved(g);
    if (w) {
      w.level = Math.min(WEAPONS[w.kind].maxLevel, w.level + SURGE_TUNING.freeAscensionLevels);
      evolveTool(g, w);
      g.syncOrbiters();
    }
  }
}

export function surgeCards(g: Game): UpgradeDef[] {
  const pool = SURGE_ORDER.filter((id) => surgeAvailable(g, id));
  const cards: UpgradeDef[] = [];
  while (cards.length < SURGE_CHOICES && pool.length) {
    const id = pool.splice(Math.floor(lootRandom() * pool.length), 1)[0]!;
    const def = SURGES[id];
    g.noteCodex(`s:${id}`);
    cards.push({
      id: `surge-${id}`,
      title: def.name,
      tag: "SURGE",
      description: def.line,
      rarity: "legendary",
      maxTimes: 1,
      surge: true,
      compare: def.detail,
      apply(ctx) {
        ctx.surge(id);
        return true;
      },
    });
  }
  return cards;
}
