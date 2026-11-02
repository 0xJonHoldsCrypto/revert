export type TimedBuffKind = "gas-surge" | "audit-shield" | "yield-rush" | "magnet-node" | "priority-fee" | "rebase" | "slashing-ward" | "staked-frenzy";

export type TimedBuffDef = {
  kind: TimedBuffKind;
  name: string;
  emoji: string;
  duration: number;
  stat: "damage" | "speed" | "pickup" | "armor" | "dash" | "rebase" | "thorns" | "cooldown";
  line: string;
  mult: number;
  color: string;
};

export const TIMED_BUFFS: Record<TimedBuffKind, TimedBuffDef> = {
  "staked-frenzy": { kind: "staked-frenzy", name: "Staked Frenzy", emoji: "⚡", duration: 20, stat: "cooldown", mult: 0.65, color: "#ffc23d", line: "Tools fire 35% faster." },
  "gas-surge": {
    kind: "gas-surge",
    line: "Move 35% faster.",
    name: "Gas Surge",
    emoji: "⛽",
    duration: 10,
    stat: "speed",
    mult: 1.35,
    color: "#ffa657",
  },
  "audit-shield": {
    kind: "audit-shield",
    line: "+22% armor.",
    name: "Audit Shield",
    emoji: "🛡",
    duration: 8,
    stat: "armor",
    mult: 1,
    color: "#58a6ff",
  },
  "yield-rush": {
    kind: "yield-rush",
    line: "+40% damage.",
    name: "Yield Rush",
    emoji: "📈",
    duration: 12,
    stat: "damage",
    mult: 1.4,
    color: "#7ee787",
  },
  "magnet-node": {
    kind: "magnet-node",
    line: "Pickup radius x2.2.",
    name: "Magnet Node",
    emoji: "🧲",
    duration: 9,
    stat: "pickup",
    mult: 2.2,
    color: "#d2a8ff",
  },
  "priority-fee": {
    kind: "priority-fee",
    line: "Dash recharges twice as fast.",
    name: "Priority Fee",
    emoji: "⏩",
    duration: 8,
    stat: "dash",
    mult: 1.28,
    color: "#f0c14d",
  },
  rebase: {
    kind: "rebase",
    line: "Damage rises as your HP falls, up to +60%.",
    name: "Rebase",
    emoji: "🔁",
    duration: 10,
    stat: "rebase",
    mult: 1.25,
    color: "#2ee6c7",
  },
  "slashing-ward": {
    kind: "slashing-ward",
    line: "Attackers that touch you take heavy damage.",
    name: "Slashing Ward",
    emoji: "🛡️",
    duration: 8,
    stat: "thorns",
    mult: 1,
    color: "#9b8cff",
  },
};

export const TIMED_BUFF_ORDER: TimedBuffKind[] = [
  "gas-surge",
  "audit-shield",
  "yield-rush",
  "magnet-node",
  "priority-fee",
  "rebase",
  "slashing-ward",
];
