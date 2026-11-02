import type { UpgradeContext, UpgradeDef, WeaponKind } from "../types";
import { defiUpgradePool } from "./defiProtocols";
import { EVOLUTIONS, WEAPONS } from "./weapons";

export const MAX_WEAPON_SLOTS = 6;

const WEAPON_POOL: WeaponKind[] = [
  "audit-dart",
  "rug-coin",
  "memo-pulse",
  "finality-beam",
  "reorg-whip",
  "stable-shield",
  "patch-burst",
  "flash-loan",
  "validator-seal",
  "bridge-bolt",
  "nonce-shard",
];

function newWeapon(kind: WeaponKind): UpgradeDef {
  const w = WEAPONS[kind];
  return {
    id: `weapon-${kind}`,
    title: w.name,
    description: w.description,
    rarity: w.rarity,
    maxTimes: 1,
    apply(ctx) {
      if (ctx.hasWeapon(kind)) return false;
      ctx.addWeapon(kind);
      return true;
    },
  };
}

function upgradeWeapon(kind: WeaponKind, ctxNow: UpgradeContext): UpgradeDef {
  const w = WEAPONS[kind];
  const evo = EVOLUTIONS[kind];
  const lv = ctxNow.weaponLevel(kind);
  const evolving = lv >= w.maxLevel;
  const tier = lv < 3 ? "Patch I" : lv < w.maxLevel - 1 ? "Patch II" : "Patch III";
  return {
    id: `upgrade-${kind}`,
    title: evolving ? evo.name : `${w.name} · ${tier}`,
    description: evolving
      ? evo.blurb
      : `${tier} of ${w.maxLevel}. Damage, cooldown, and reach all step up. Evolve at the cap.`,
    rarity: evolving ? "legendary" : w.rarity,
    apply(ctx) {
      if (!ctx.hasWeapon(kind)) return false;
      if (ctx.weaponLevel(kind) >= w.maxLevel && ctx.weaponEvolved(kind)) return false;
      ctx.upgradeWeapon(kind);
      return true;
    },
  };
}

export const STAT_UPGRADES: UpgradeDef[] = [
  {
    id: "hp-up",
    title: "Cold Storage",
    description: "Max HP +15 and heal 20.",
    maxTimes: 4,
    apply(ctx) {
      ctx.boostStat("speed", 0);
      ctx.heal(20);
      return true;
    },
  },
  {
    id: "damage-up",
    title: "Leverage Long",
    description: "Damage +12%. Take a hit under 25% HP and one stack gets liquidated.",
    maxTimes: 5,
    apply(ctx) {
      ctx.boostStat("damage", 0.12);
      ctx.special("leverage");
      return true;
    },
  },
  {
    id: "speed-up",
    title: "Gas Optimizer",
    description: "Move speed +8%.",
    maxTimes: 4,
    apply(ctx) {
      ctx.boostStat("speed", 0.08);
      return true;
    },
  },
  {
    id: "pickup-up",
    title: "Airdrop Magnet",
    description: "XP pickup radius +35%.",
    maxTimes: 3,
    apply(ctx) {
      ctx.boostStat("pickup", 0.35);
      return true;
    },
  },
  {
    id: "armor-up",
    title: "Multisig Wallet",
    description: "3 signers. A fatal hit is blocked while 2+ are online. Armor +8%.",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("armor", 0.08);
      ctx.special("multisig");
      return true;
    },
  },
  {
    id: "cooldown-up",
    title: "Flash Loan",
    description: "Double fire rate for 8s. Repay with 15 kills or default: cooldowns +35% for 10s.",
    maxTimes: 6,
    apply(ctx) {
      ctx.special("flash-loan");
      return true;
    },
  },
  {
    id: "heal",
    title: "Insurance Fund",
    description: "Restore 35 HP.",
    maxTimes: 6,
    apply(ctx) {
      ctx.heal(35);
      return true;
    },
  },
  {
    id: "private-flow",
    title: "Private Orderflow",
    description: "Hide the route. Cooldowns -8% and damage +6%.",
    rarity: "rare",
    maxTimes: 2,
    apply(ctx) {
      ctx.boostStat("cooldown", 0.08);
      ctx.boostStat("damage", 0.06);
      return true;
    },
  },
  {
    id: "blob-discount",
    title: "Blob Discount",
    description: "Cheaper data. Move speed +6% and pickup +15%.",
    rarity: "uncommon",
    maxTimes: 3,
    apply(ctx) {
      ctx.boostStat("speed", 0.06);
      ctx.boostStat("pickup", 0.15);
      return true;
    },
  },
  {
    id: "bug-bounty",
    title: "Bug Bounty",
    description: "Paid findings. Weapon damage +10%.",
    rarity: "rare",
    maxTimes: 3,
    apply(ctx) {
      ctx.boostStat("damage", 0.1);
      return true;
    },
  },
  {
    id: "slashing-cover",
    title: "Slashing Cover",
    description: "Insurance against a bad attestation. Armor +6% and heal 12.",
    rarity: "epic",
    maxTimes: 2,
    apply(ctx) {
      ctx.boostStat("armor", 0.06);
      ctx.heal(12);
      return true;
    },
  },
];

export function buildUpgradePool(ctx: UpgradeContext): UpgradeDef[] {
  const pool: UpgradeDef[] = [...STAT_UPGRADES, ...defiUpgradePool()];

  for (const kind of WEAPON_POOL) {
    if (!ctx.hasWeapon(kind)) {
      if (ctx.weaponCount() < MAX_WEAPON_SLOTS) pool.push(newWeapon(kind));
    } else if (ctx.weaponLevel(kind) < WEAPONS[kind].maxLevel || !ctx.weaponEvolved(kind)) {
      pool.push(upgradeWeapon(kind, ctx));
    }
  }

  return pool;
}
