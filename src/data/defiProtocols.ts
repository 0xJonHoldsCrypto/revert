import type { PerkId, UpgradeDef, WeaponRarity } from "../types";

function protocol(id: string, title: string, description: string, rarity: WeaponRarity, perk: PerkId): UpgradeDef {
  return {
    id,
    title,
    description,
    rarity,
    maxTimes: 1,
    apply(ctx) {
      ctx.perk(perk, 1);
      return true;
    },
  };
}

export const DEFI_PROTOCOL_UPGRADES: UpgradeDef[] = [
  protocol("power-lp", "Uniswap Concentrated LP", "+30% damage, but only while HP is in range: 40% to 80%.", "rare", "lpRange"),
  protocol("power-launchpool", "Binance Launchpool", "+1% damage per 5 $SAFU you hold, up to +30%. Spending costs you damage.", "rare", "launchpool"),
  protocol("power-price-feed", "Chainlink Clean Feed", "You see true prices near oracles, and delayed strikes land sooner.", "uncommon", "cleanFeed"),
  protocol("power-restaking", "EigenLayer Restake", "Your armor also counts as bonus damage.", "epic", "eigen"),
  protocol("power-lending", "Aave Lending Vault", "Earn 2% of the next level every 10s. Any hit pauses it for 6s.", "epic", "aave"),
  protocol("power-restake", "Lido Liquid Stake", "Standing still earns XP. Moving earns nothing.", "uncommon", "lido"),
  protocol("power-private-relay", "Flashbots Private Relay", "Dashing also deletes nearby enemy bullets.", "epic", "flashbots"),
  protocol("power-bridge-guard", "Wormhole Bridge Guard", "Bridge gates recharge twice as fast and heal 25 HP.", "rare", "wormhole"),
  protocol("power-op-grant", "Optimism Retro Grant", "Each boss kill refunds 25% of the $SAFU spent since the last boss.", "rare", "opGrant"),
  protocol("power-stable-pool", "Curve Stable Pool", "Collecting $SAFU heals 1 HP per coin.", "uncommon", "curve"),
];

export function defiUpgradePool(): UpgradeDef[] {
  return DEFI_PROTOCOL_UPGRADES;
}
