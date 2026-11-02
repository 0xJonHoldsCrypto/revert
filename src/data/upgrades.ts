import type { PerkId, UpgradeContext, UpgradeDef, WeaponKind, WeaponRarity } from "../types";
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
  "pager-ping",
  "honeypot-trap",
  "oracle-strike",
  "merkle-proof",
  "slashing-field",
  "whale-alert",
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

function perkUpgrade(id: string, title: string, description: string, rarity: WeaponRarity, maxTimes: number, perk: PerkId, amount: number): UpgradeDef {
  return {
    id,
    title,
    description,
    rarity,
    maxTimes,
    apply(ctx) {
      ctx.perk(perk, amount);
      return true;
    },
  };
}

export const STAT_UPGRADES: UpgradeDef[] = [
  perkUpgrade("perk-pierce", "Reentrancy Guard", "Shots pass through one more attacker.", "rare", 3, "pierce", 1),
  perkUpgrade("perk-multishot", "Batch Transaction", "Aimed tools fire one extra shot.", "epic", 2, "multishot", 1),
  perkUpgrade("perk-area", "Wider Mempool", "Blasts and auras are 15% larger.", "rare", 3, "area", 0.15),
  perkUpgrade("perk-crit", "Critical Bug", "12% chance for a hit to deal double damage.", "rare", 3, "crit", 0.12),
  perkUpgrade("perk-regen", "Proof of Reserve", "Regenerate 0.6 HP every second.", "uncommon", 3, "regen", 0.6),
  perkUpgrade("perk-thorns", "Slippage Tolerance", "Attackers that touch you take 40 damage.", "uncommon", 3, "thorns", 40),
  perkUpgrade("perk-dash-blast", "Dash Arbitrage", "Dashing blasts everything around where you started.", "epic", 2, "dashBlast", 1),
  perkUpgrade("perk-dash-cd", "Priority Fee", "Dash cooldown -15%.", "uncommon", 3, "dashCooldown", 0.15),
  perkUpgrade("perk-xp", "Insider Info", "XP +15%.", "uncommon", 3, "xp", 0.15),
  perkUpgrade("perk-coin", "Treasury Diversification", "$SAFU +30%.", "uncommon", 3, "coin", 0.3),
  perkUpgrade("perk-kill-blast", "Liquidation Bounty", "8% chance that a kill sets off a small blast.", "rare", 3, "killBlast", 0.08),
  perkUpgrade("perk-ability", "Timelock Bypass", "Active ability cooldown -20%.", "rare", 2, "abilityCooldown", 0.2),
  perkUpgrade("perk-revive", "Hard Fork Insurance", "The first fatal hit forks you back at half HP.", "legendary", 1, "revive", 1),
  perkUpgrade("perk-rerolls", "Governance Vote", "Gain 2 more reorgs for these cards.", "common", 2, "rerolls", 2),
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
