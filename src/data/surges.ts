export type SurgeId =
  | "echo-volley"
  | "blade-storm"
  | "overdrive"
  | "volatile-pickups"
  | "wake-trail"
  | "free-ascension"
  | "overcharge"
  | "kill-barrier"
  | "stasis-pulse";

export type SurgeDef = {
  id: SurgeId;
  name: string;
  line: string;
  detail: string[];
  color: string;
  value: number;
};

export const SURGES: Record<SurgeId, SurgeDef> = {
  "echo-volley": {
    id: "echo-volley",
    name: "Echo Volley",
    line: "Every 6th shot from every tool fires twice.",
    detail: ["Counts per tool", "Relay laptops echo too"],
    color: "#79c0ff",
    value: 0.3,
  },
  "blade-storm": {
    id: "blade-storm",
    name: "Blade Storm",
    line: "Kills drop a blade that orbits you for 6 seconds.",
    detail: ["Up to 10 blades at once", "Each cuts anything it touches"],
    color: "#ff8552",
    value: 0.28,
  },
  overdrive: {
    id: "overdrive",
    name: "Overdrive",
    line: "Your three strongest tools gain a level. Rigs gain a tier.",
    detail: ["Maxed tools stay maxed", "No evolution on its own"],
    color: "#7ee787",
    value: 0.28,
  },
  "volatile-pickups": {
    id: "volatile-pickups",
    name: "Volatile Pickups",
    line: "Every pickup explodes when you collect it.",
    detail: ["One blast per 0.2 seconds", "Shards, coins, health and buffs"],
    color: "#ffc23d",
    value: 0.28,
  },
  "wake-trail": {
    id: "wake-trail",
    name: "Wake Trail",
    line: "Dashing leaves a trail that burns for 4 seconds.",
    detail: ["Cuts anything that crosses it", "Stacks with Dash Arbitrage"],
    color: "#2ee6c7",
    value: 0.27,
  },
  "free-ascension": {
    id: "free-ascension",
    name: "Free Ascension",
    line: "Your strongest tool gains a level and ascends now, no catalyst needed.",
    detail: ["Skips the missing catalyst", "Triggers the full ascension blast"],
    color: "#f0c14d",
    value: 0.3,
  },
  overcharge: {
    id: "overcharge",
    name: "Overcharge",
    line: "Overclock fills 40% faster and lasts 3 seconds longer.",
    detail: ["Starts the meter at 25%", "Same bonuses, longer window"],
    color: "#ff6b3d",
    value: 0.27,
  },
  "kill-barrier": {
    id: "kill-barrier",
    name: "Kill Barrier",
    line: "Every 60 kills raises a barrier worth 8% of your max HP.",
    detail: ["Holds up to two barriers", "Absorbs hits before your HP"],
    color: "#b58cff",
    value: 0.28,
  },
  "stasis-pulse": {
    id: "stasis-pulse",
    name: "Stasis Pulse",
    line: "Every 20 seconds a pulse freezes nearby attackers for 1 second.",
    detail: ["Bosses are not frozen", "Frozen attackers take extra damage"],
    color: "#9fe8ff",
    value: 0.27,
  },
};

export const SURGE_ORDER = Object.keys(SURGES) as SurgeId[];

export const SURGE_CHOICES = 3;

export function isSurgeLevel(level: number): boolean {
  return level >= 5 && (level <= 20 ? level % 5 === 0 : level % 10 === 0);
}
