import type { PerkId, UpgradeContext, UpgradeDef, WeaponKind, WeaponRarity } from "../types";
import { defiUpgradePool } from "./defiProtocols";
import { EVOLUTIONS, weaponAtLevel, WEAPONS } from "./weapons";

export const MAX_WEAPON_SLOTS = 6;

const WEAPON_POOL = Object.keys(WEAPONS) as WeaponKind[];

function newWeapon(kind: WeaponKind, ctx: UpgradeContext): UpgradeDef {
  const w = WEAPONS[kind];
  const recipe = upgradeTitle(EVOLUTIONS[kind].needs);
  return {
    id: `weapon-${kind}`,
    title: w.name,
    tag: "NEW",
    description: w.description,
    rarity: w.rarity,
    maxTimes: 1,
    compare: recipe ? [`Evolves with ${recipe}${ctx.hasUpgrade(EVOLUTIONS[kind].needs) ? " (owned)" : ""}`] : undefined,
    apply(c) {
      if (c.hasWeapon(kind)) return false;
      c.addWeapon(kind);
      return true;
    },
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function patchLines(kind: WeaponKind, level: number): string[] {
  const now = weaponAtLevel(kind, level);
  const next = weaponAtLevel(kind, level + 1);
  const lines = [`Damage ${round(now.damage)} → ${round(next.damage)}`];
  if (!WEAPONS[kind].orbit) lines.push(`Cooldown ${round(now.cooldown)}s → ${round(next.cooldown)}s`);
  if (now.aoe) lines.push(`Radius ${Math.round(now.aoe)} → ${Math.round(next.aoe ?? now.aoe)}`);
  return lines;
}

function upgradeWeapon(kind: WeaponKind, ctxNow: UpgradeContext): UpgradeDef {
  const w = WEAPONS[kind];
  const evo = EVOLUTIONS[kind];
  const lv = ctxNow.weaponLevel(kind);
  const evolving = lv >= w.maxLevel;
  const recipe = upgradeTitle(evo.needs);
  return {
    id: `upgrade-${kind}`,
    title: evolving ? `${w.name} → ${evo.name}` : w.name,
    tag: evolving ? "EVOLVE" : `LV ${lv} → ${lv + 1}`,
    description: evolving ? evo.blurb : `Level ${lv + 1} of ${w.maxLevel}.`,
    compare: evolving ? undefined : [...patchLines(kind, lv), ...(lv + 1 >= w.maxLevel && recipe ? [`Evolves with ${recipe}${ctxNow.hasUpgrade(evo.needs) ? " (owned)" : ""}`] : [])],
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
  perkUpgrade("perk-dash-cd", "Gas Tip", "Dash cooldown -15%.", "uncommon", 3, "dashCooldown", 0.15),
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
    rarity: "common",
    maxTimes: 4,
    apply(ctx) {
      ctx.maxHp(15);
      ctx.heal(20);
      return true;
    },
  },
  {
    id: "damage-up",
    title: "Leverage Long",
    description: "Damage +12%. Take a hit under 25% HP and one stack gets liquidated.",
    rarity: "uncommon",
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
    description: "Move speed +8%. Total speed is capped at +60%.",
    rarity: "common",
    maxTimes: 4,
    apply(ctx) {
      ctx.boostStat("speed", 0.08);
      return true;
    },
  },
  {
    id: "pickup-up",
    title: "Airdrop Magnet",
    description: "Pickup radius +35%.",
    rarity: "common",
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
    rarity: "epic",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("armor", 0.08);
      ctx.special("multisig");
      return true;
    },
  },
  {
    id: "cooldown-up",
    title: "Margin Call",
    description: "Double fire rate for 8s. Kill enough in time or cooldowns get 35% worse for 10s.",
    rarity: "uncommon",
    maxTimes: 2,
    apply(ctx) {
      ctx.special("flash-loan");
      return true;
    },
  },
  {
    id: "heal",
    title: "Insurance Fund",
    description: "Restore 35 HP.",
    rarity: "common",
    maxTimes: 6,
    apply(ctx) {
      ctx.heal(35);
      return true;
    },
  },
  {
    id: "private-flow",
    title: "Private Orderflow",
    description: "Hide the route. Cooldowns -8%.",
    rarity: "rare",
    maxTimes: 2,
    apply(ctx) {
      ctx.boostStat("cooldown", 0.08);
      return true;
    },
  },
  perkUpgrade("bug-bounty", "Bug Bounty", "+30% damage to bosses and whales.", "rare", 2, "bugBounty", 0.3),
];

const UPGRADE_TITLES = new Map<string, string>();

function upgradeTitle(id: string): string | undefined {
  if (!UPGRADE_TITLES.size) for (const u of [...STAT_UPGRADES, ...defiUpgradePool()]) UPGRADE_TITLES.set(u.id, u.title);
  return UPGRADE_TITLES.get(id);
}

function catalystTag(id: string, ctx: UpgradeContext): string | undefined {
  const tool = WEAPON_POOL.find((kind) => EVOLUTIONS[kind].needs === id && ctx.hasWeapon(kind));
  return tool ? `EVOLVES ${WEAPONS[tool].name.toUpperCase()}` : undefined;
}

export function buildUpgradePool(ctx: UpgradeContext): UpgradeDef[] {
  const pool: UpgradeDef[] = [...STAT_UPGRADES, ...defiUpgradePool()].map((u) => ({ ...u, tag: catalystTag(u.id, ctx) }));

  for (const kind of WEAPON_POOL) {
    if (!ctx.hasWeapon(kind)) {
      if (ctx.weaponCount() < MAX_WEAPON_SLOTS) pool.push(newWeapon(kind, ctx));
    } else if (ctx.weaponLevel(kind) < WEAPONS[kind].maxLevel) {
      pool.push(upgradeWeapon(kind, ctx));
    } else if (!ctx.weaponEvolved(kind) && ctx.hasUpgrade(EVOLUTIONS[kind].needs)) {
      pool.push(upgradeWeapon(kind, ctx));
    }
  }

  return pool;
}
