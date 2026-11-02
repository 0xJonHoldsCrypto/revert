import type { WeaponRarity } from "./rarity";
import { pick } from "../utils/math";

export type GearSlot = "hardware" | "wearable" | "bag";

export type GearStats = {
  damage?: number;
  speed?: number;
  armor?: number;
  pickup?: number;
  cooldown?: number;
  maxHp?: number;
  xp?: number;
  coin?: number;
  dash?: number;
  yield?: number;
  healOnKill?: number;
  fundsOnKill?: number;
};

export type GearDef = { name: string; slot: GearSlot; rarity: WeaponRarity; line: string; stats: GearStats };

export const RARITY_ORDER: WeaponRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
export const SLOT_LABEL: Record<GearSlot, string> = { hardware: "HARDWARE", wearable: "WEARABLE", bag: "BAG" };

export const GEAR = {
  "paper-wallet": { name: "Paper Wallet", slot: "hardware", rarity: "common", line: "Do not get it wet.", stats: { armor: 0.04, maxHp: 10 } },
  "ledger-stick": { name: "Ledger Stick", slot: "hardware", rarity: "uncommon", line: "Verify on device. Please.", stats: { armor: 0.07, maxHp: 20 } },
  "trezor-brick": { name: "Trezor Brick", slot: "hardware", rarity: "rare", line: "Also stops small bullets.", stats: { armor: 0.11, maxHp: 25 } },
  "steel-seed": { name: "Steel Seed Plate", slot: "hardware", rarity: "epic", line: "Survives fire, flood, and ex-partners.", stats: { armor: 0.16, maxHp: 35 } },
  "deep-cold": { name: "Deep Cold Vault", slot: "hardware", rarity: "legendary", line: "Your grandchildren will find it.", stats: { armor: 0.22, maxHp: 60 } },
  "anon-hoodie": { name: "Anon Hoodie", slot: "wearable", rarity: "common", line: "Nobody knows. Everybody knows.", stats: { speed: 0.08 } },
  "wagmi-hat": { name: "WAGMI Hat", slot: "wearable", rarity: "uncommon", line: "Statistically, no.", stats: { xp: 0.18 } },
  "straw-hat": { name: "Yield Farmer's Straw Hat", slot: "wearable", rarity: "uncommon", line: "Harvest. Sell. Repeat.", stats: { coin: 0.35, yield: 0.15 } },
  "paper-hands": { name: "Paper Hands", slot: "wearable", rarity: "rare", line: "Out at the first red candle.", stats: { speed: 0.15, dash: 0.3 } },
  "laser-eyes": { name: "Laser Eyes", slot: "wearable", rarity: "rare", line: "Until 100k. Or later.", stats: { damage: 0.18 } },
  "diamond-hands": { name: "Diamond Hands", slot: "wearable", rarity: "epic", line: "Sir, the exit is on fire.", stats: { armor: 0.08, damage: 0.18 } },
  "exit-crown": { name: "Crown of Exit Liquidity", slot: "wearable", rarity: "legendary", line: "Someone had to be it.", stats: { damage: 0.32, speed: 0.1 } },
  "uni-receipt": { name: "Uniswap LP Receipt", slot: "bag", rarity: "common", line: "Impermanent, they said.", stats: { pickup: 0.45, coin: 0.12 } },
  "aave-stack": { name: "Aave aToken Stack", slot: "bag", rarity: "uncommon", line: "Earns while you panic.", stats: { yield: 0.4 } },
  "lido-pin": { name: "Lido stETH Pin", slot: "bag", rarity: "uncommon", line: "Liquid. Mostly.", stats: { cooldown: 0.09 } },
  "curve-vote": { name: "Curve Gauge Vote", slot: "bag", rarity: "rare", line: "Bribes accepted.", stats: { cooldown: 0.13, damage: 0.06 } },
  "safu-sticker": { name: "Binance SAFU Sticker", slot: "bag", rarity: "epic", line: "Funds are safu. Probably you too.", stats: { healOnKill: 0.35, armor: 0.04 } },
  "bfx-token": { name: "Bitfinex Recovery Token", slot: "bag", rarity: "legendary", line: "Eight years later, they found it.", stats: { fundsOnKill: 120_000, cooldown: 0.12, damage: 0.1 } },
} satisfies Record<string, GearDef>;

export type GearId = keyof typeof GEAR;

const ALL_GEAR = Object.keys(GEAR) as GearId[];

export function gearDef(id: GearId): GearDef {
  return GEAR[id];
}

export function rollGear(minRarity: WeaponRarity): GearId {
  const floor = RARITY_ORDER.indexOf(minRarity);
  const pool = ALL_GEAR.filter((id) => {
    const rank = RARITY_ORDER.indexOf(gearDef(id).rarity);
    return rank >= floor && rank <= floor + 1;
  });
  return pick(pool.length ? pool : ALL_GEAR);
}

const PERCENT: [keyof GearStats, string][] = [
  ["damage", "damage"],
  ["speed", "speed"],
  ["armor", "armor"],
  ["pickup", "pickup range"],
  ["cooldown", "cooldowns"],
  ["xp", "XP"],
  ["coin", "$SAFU"],
];

export function describeGear(id: GearId): string {
  const s: GearStats = gearDef(id).stats;
  const parts = PERCENT.filter(([key]) => s[key]).map(([key, label]) => `${key === "cooldown" ? "-" : "+"}${Math.round(s[key]! * 100)}% ${label}`);
  if (s.maxHp) parts.push(`+${s.maxHp} max HP`);
  if (s.dash) parts.push(`-${Math.round(s.dash * 100)}% dash cooldown`);
  if (s.yield) parts.push("passive XP");
  if (s.healOnKill) parts.push("kills heal you");
  if (s.fundsOnKill) parts.push("kills recover funds");
  return parts.join(", ");
}
