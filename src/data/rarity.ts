import { simRandom } from "../utils/math";
export const BOF = {
  sky: "#4a6fc5",
  skyDark: "#2a3d7a",
  grass: "#3d8c40",
  grassLight: "#5cb85c",
  dirt: "#8b5a2b",
  stone: "#6b6b7a",
  outline: "#1a1028",
  skin: "#f4c49a",
  hair: "#2b1b0e",
  coat: "#3d5a80",
  hacker: "#4a1a5c",
  hackerGlow: "#ff3366",
  gold: "#ffd56a",
  terminal: "#0a140a",
  terminalGreen: "#33ff66",
  terminalRed: "#ff4444",
  dialogBg: "#f8f0d8",
  dialogBorder: "#2a1808",
  chest: "#c4890a",
  rare: "#58a6ff",
  epic: "#a371f7",
  legendary: "#f0b429",
  common: "#8b949e",
};

export type WeaponRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_ORDER: WeaponRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_COLORS: Record<WeaponRarity, string> = {
  common: BOF.common,
  uncommon: "#7ee787",
  rare: BOF.rare,
  epic: BOF.epic,
  legendary: BOF.legendary,
};

export const RARITY_LABEL: Record<WeaponRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export function rollRarity(bonus = 0): WeaponRarity {
  const r = simRandom() + bonus;
  if (r > 0.97) return "legendary";
  if (r > 0.88) return "epic";
  if (r > 0.72) return "rare";
  if (r > 0.45) return "uncommon";
  return "common";
}

export function rarityDamageMult(r: WeaponRarity): number {
  const m: Record<WeaponRarity, number> = {
    common: 1,
    uncommon: 1.08,
    rare: 1.18,
    epic: 1.32,
    legendary: 1.55,
  };
  return m[r];
}
