import {
  AFFIXES,
  HASTE_MULT,
  MENDER_RADIUS,
  MENDER_SHARE_PER_SEC,
  rollAffixes,
  SHIELD_REGEN_SEC,
  SHIELD_SHARE,
  SPLIT_COUNT,
  SPLIT_HP_SHARE,
  VAMPIRE_HEAL_SHARE,
  VOLATILE_FUSE_SEC,
  VOLATILE_RADIUS,
  type AffixId,
} from "../data/affixes";
import { ENEMIES } from "../data/enemies";
import type { Enemy } from "../types";
import { dist, spawnRandom } from "../utils/math";
import type { Game } from "./Game";

export function hasAffix(e: Enemy, id: AffixId): boolean {
  return !!e.affixes && e.affixes.includes(id);
}

export function grantAffixes(g: Game, e: Enemy) {
  const affixes = rollAffixes(g.elapsed, spawnRandom);
  e.affixes = affixes;
  for (const id of affixes) {
    g.noteCodex(`a:${id}`);
    if (id === "shielded") {
      e.shieldMax = e.maxHp * SHIELD_SHARE;
      e.shield = e.shieldMax;
      e.shieldAt = g.elapsed;
    } else if (id === "hasted") {
      e.speed *= HASTE_MULT;
    }
  }
}

export function affixLabel(e: Enemy): string {
  return e.affixes && e.affixes.length ? e.affixes.map((id) => AFFIXES[id].tag).join(" · ") : "";
}

export function absorbShield(g: Game, e: Enemy, dealt: number): number {
  const shield = e.shield ?? 0;
  if (shield <= 0) return dealt;
  e.shieldAt = g.elapsed;
  const soaked = Math.min(shield, dealt);
  e.shield = shield - soaked;
  if (e.shield <= 0) {
    g.addFloater(e.x, e.y - 40, "SHIELD DOWN", AFFIXES.shielded.color);
    g.audio.play("nearMiss");
  }
  return dealt - soaked;
}

export function updateAffixes(g: Game, e: Enemy, dt: number) {
  const affixes = e.affixes;
  if (!affixes) return;
  for (let i = 0; i < affixes.length; i++) {
    const id = affixes[i]!;
    if (id === "shielded") {
      const max = e.shieldMax ?? 0;
      if ((e.shield ?? 0) < max && g.elapsed - (e.shieldAt ?? 0) >= SHIELD_REGEN_SEC) {
        e.shield = max;
        g.addFloater(e.x, e.y - 40, "SHIELD UP", AFFIXES.shielded.color);
      }
    } else if (id === "mender") {
      for (const other of g.enemies) {
        if (other === e || other.dead || ENEMIES[other.kind].isBoss || other.hp >= other.maxHp) continue;
        if (dist(e.x, e.y, other.x, other.y) < MENDER_RADIUS) other.hp = Math.min(other.maxHp, other.hp + other.maxHp * MENDER_SHARE_PER_SEC * dt);
      }
    }
  }
}

export function affixOnHit(e: Enemy) {
  if (hasAffix(e, "vampiric")) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * VAMPIRE_HEAL_SHARE);
}

export function affixOnDeath(g: Game, e: Enemy) {
  if (!e.affixes) return;
  if (hasAffix(e, "splitting")) {
    for (let i = 0; i < SPLIT_COUNT; i++) {
      const a = (i / SPLIT_COUNT) * Math.PI * 2;
      const child = g.spawnEnemyAt(e.kind, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, true);
      child.hp = child.maxHp = e.maxHp * SPLIT_HP_SHARE;
      child.scale = 1.1;
    }
  }
  if (hasAffix(e, "volatile")) {
    g.addHazard({ shape: "circle", x: e.x, y: e.y, r: VOLATILE_RADIUS, windup: VOLATILE_FUSE_SEC, active: 0, damage: e.damage * 1.2, color: AFFIXES.volatile.color, source: e.kind, knock: 260, label: "VOLATILE" });
  }
}
