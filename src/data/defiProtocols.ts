import type { UpgradeDef } from "../types";

export const DEFI_PROTOCOL_UPGRADES: UpgradeDef[] = [
  {
    id: "power-lp",
    title: "Uniswap Concentrated LP",
    description: "Swap stats: +10% damage and +5% move speed.",
    rarity: "rare",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("damage", 0.1);
      ctx.boostStat("speed", 0.05);
      return true;
    },
  },
  {
    id: "power-lending",
    title: "Aave Lending Vault",
    description: "Passive XP while staked. Any hit slashes it for 6 seconds.",
    rarity: "epic",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("yield", 0.35);
      return true;
    },
  },
  {
    id: "power-launchpool",
    title: "Binance Launchpool",
    description: "Exchange liquidity: +18% weapon damage.",
    rarity: "rare",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("damage", 0.18);
      return true;
    },
  },
  {
    id: "power-bridge-guard",
    title: "Wormhole Bridge Guard",
    description: "Bridge insurance: +12% armor and heal 15.",
    rarity: "legendary",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("armor", 0.12);
      ctx.heal(15);
      return true;
    },
  },
  {
    id: "power-stable-pool",
    title: "Curve Stable Pool",
    description: "Stable depth. +8% armor and +8% pickup.",
    rarity: "uncommon",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("armor", 0.08);
      ctx.boostStat("pickup", 0.08);
      return true;
    },
  },
  {
    id: "power-restake",
    title: "Lido Liquid Stake",
    description: "Passive XP (slashed for 6s by any hit) and +6% move speed.",
    rarity: "rare",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("yield", 0.25);
      ctx.boostStat("speed", 0.06);
      return true;
    },
  },
  {
    id: "power-price-feed",
    title: "Chainlink Clean Feed",
    description: "A cleaner price. Weapon damage +14%.",
    rarity: "rare",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("damage", 0.14);
      return true;
    },
  },
  {
    id: "power-restaking",
    title: "EigenLayer Restake",
    description: "Restake the same stake. +10% damage and +8% armor.",
    rarity: "epic",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("damage", 0.1);
      ctx.boostStat("armor", 0.08);
      return true;
    },
  },
  {
    id: "power-private-relay",
    title: "Flashbots Private Relay",
    description: "Skip the public mempool. Cooldowns -12%.",
    rarity: "epic",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("cooldown", 0.12);
      return true;
    },
  },
  {
    id: "power-op-grant",
    title: "Optimism Retro Grant",
    description: "The foundation pays you back. Heal 28 and +10% XP radius.",
    rarity: "rare",
    maxTimes: 1,
    apply(ctx) {
      ctx.heal(28);
      ctx.boostStat("pickup", 0.1);
      return true;
    },
  },
];

export function defiUpgradePool(): UpgradeDef[] {
  return DEFI_PROTOCOL_UPGRADES;
}
