export type AbilityId = "emergency-pause" | "flash-crash" | "revoke-all" | "sandwich" | "liquidity-lock";

export const ABILITIES: Record<AbilityId, { name: string; short: string; cooldown: number; line: string; color: string }> = {
  "emergency-pause": { name: "Emergency Pause", short: "PAUSE", cooldown: 38, line: "Freezes every attacker for 4 seconds.", color: "#8fd6ff" },
  "flash-crash": { name: "Flash Crash", short: "CRASH", cooldown: 32, line: "Huge blast around you.", color: "#ff5c48" },
  "revoke-all": { name: "Revoke All", short: "REVOKE", cooldown: 24, line: "Deletes bullets and hazards. Resets your dash.", color: "#2ee6c7" },
  sandwich: { name: "Sandwich Attack", short: "SANDWICH", cooldown: 28, line: "Two rings of strikes close in on you.", color: "#ffe08a" },
  "liquidity-lock": { name: "Liquidity Lock", short: "LOCK", cooldown: 42, line: "Take no damage for 5 seconds.", color: "#b58cff" },
};

export const ABILITY_ORDER = Object.keys(ABILITIES) as AbilityId[];
