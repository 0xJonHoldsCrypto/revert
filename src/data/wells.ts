export type WellStatId = "damage" | "speed" | "maxHp" | "pickup" | "armor" | "yield" | "cooldown";

export type WellStatDef = {
  id: WellStatId;
  title: string;
  description: string;
  applyAmount: number;
};

export const WELL_STATS: Record<WellStatId, WellStatDef> = {
  damage: { id: "damage", title: "Sharp Audits", description: "+8% damage for this run.", applyAmount: 0.08 },
  speed: { id: "speed", title: "Low Latency", description: "+7% move speed for this run.", applyAmount: 0.07 },
  maxHp: { id: "maxHp", title: "Cold Storage", description: "+18 max HP for this run.", applyAmount: 18 },
  pickup: { id: "pickup", title: "MEV Magnet", description: "+12% pickup radius for this run.", applyAmount: 0.12 },
  armor: { id: "armor", title: "Multisig Skin", description: "+6% damage reduction for this run.", applyAmount: 0.06 },
  yield: { id: "yield", title: "Staking Yield", description: "+0.4 passive HP/sec for this run.", applyAmount: 0.4 },
  cooldown: { id: "cooldown", title: "Priority Lane", description: "Weapon cooldowns -8% for this run.", applyAmount: 0.08 },
};

export const WELL_STAT_ORDER: WellStatId[] = ["damage", "speed", "maxHp", "pickup", "armor", "yield", "cooldown"];
