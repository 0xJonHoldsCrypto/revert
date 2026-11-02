export type AbilityId = "emergency-pause" | "flash-crash" | "revoke-all" | "sandwich" | "liquidity-lock" | "mev-bundle" | "bridge-out" | "claim-all" | "validator-slash" | "insurance-claim";

export const ABILITIES: Record<AbilityId, { name: string; short: string; cooldown: number; line: string; color: string }> = {
  "emergency-pause": { name: "Emergency Pause", short: "PAUSE", cooldown: 38, line: "Freezes every attacker for 4 seconds.", color: "#8fd6ff" },
  "flash-crash": { name: "Flash Crash", short: "CRASH", cooldown: 32, line: "Huge blast around you.", color: "#ff5c48" },
  "revoke-all": { name: "Revoke All", short: "REVOKE", cooldown: 24, line: "Deletes bullets and hazards. Resets your dash.", color: "#2ee6c7" },
  sandwich: { name: "Sandwich Attack", short: "SANDWICH", cooldown: 28, line: "Two rings of strikes close in on you.", color: "#ffe08a" },
  "mev-bundle": { name: "MEV Bundle", short: "BUNDLE", cooldown: 40, line: "Double XP for 10 seconds.", color: "#ffe08a" },
  "bridge-out": { name: "Bridge Out", short: "BRIDGE", cooldown: 22, line: "Jump ahead and leave a blast behind you.", color: "#b58cff" },
  "claim-all": { name: "Claim All", short: "CLAIM", cooldown: 30, line: "Pulls in every XP shard, coin and pickup nearby.", color: "#2ee6c7" },
  "validator-slash": { name: "Validator Slash", short: "SLASH", cooldown: 26, line: "A cross of strikes runs out from you.", color: "#ff8552" },
  "insurance-claim": { name: "Insurance Claim", short: "CLAIM HP", cooldown: 48, line: "Restores 35% of your HP.", color: "#7ee787" },
  "liquidity-lock": { name: "Liquidity Lock", short: "LOCK", cooldown: 42, line: "Take no damage for 5 seconds.", color: "#b58cff" },
};

export const ABILITY_ORDER = Object.keys(ABILITIES) as AbilityId[];
