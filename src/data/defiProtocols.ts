import type { UpgradeDef } from "../types";

export const DEFI_PROTOCOL_UPGRADES: UpgradeDef[] = [
  {
    id: "power-uniswap",
    title: "Uniswap V3 LP",
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
    id: "power-aave",
    title: "Aave Yield Vault",
    description: "Stake yield: passive XP/sec scales with your level.",
    rarity: "epic",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("yield", 0.35);
      return true;
    },
  },
  {
    id: "power-binance",
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
    id: "power-bitfi",
    title: "BitFi Bridge Guard",
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
    id: "power-curve",
    title: "Curve Pool",
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
    id: "power-lido",
    title: "Lido Restake",
    description: "Stake the run. Passive yield and +6% move speed.",
    rarity: "rare",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("yield", 0.25);
      ctx.boostStat("speed", 0.06);
      return true;
    },
  },
  {
    id: "power-chainlink",
    title: "Chainlink Feed",
    description: "A cleaner price. Weapon damage +14%.",
    rarity: "rare",
    maxTimes: 1,
    apply(ctx) {
      ctx.boostStat("damage", 0.14);
      return true;
    },
  },
  {
    id: "power-eigen",
    title: "EigenLayer",
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
    id: "power-flashbots",
    title: "Flashbots Protect",
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
    title: "Retroactive Grant",
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
