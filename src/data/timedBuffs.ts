export type TimedBuffKind = "gas-surge" | "audit-shield" | "yield-rush" | "magnet-node" | "priority-fee" | "rebase" | "slashing-ward";

export type TimedBuffDef = {
  kind: TimedBuffKind;
  name: string;
  emoji: string;
  duration: number;
  stat: "damage" | "speed" | "pickup" | "armor";
  mult: number;
  color: string;
};

export const TIMED_BUFFS: Record<TimedBuffKind, TimedBuffDef> = {
  "gas-surge": {
    kind: "gas-surge",
    name: "Gas Surge",
    emoji: "⛽",
    duration: 10,
    stat: "speed",
    mult: 1.35,
    color: "#ffa657",
  },
  "audit-shield": {
    kind: "audit-shield",
    name: "Audit Shield",
    emoji: "🛡",
    duration: 8,
    stat: "armor",
    mult: 1,
    color: "#58a6ff",
  },
  "yield-rush": {
    kind: "yield-rush",
    name: "Yield Rush",
    emoji: "📈",
    duration: 12,
    stat: "damage",
    mult: 1.4,
    color: "#7ee787",
  },
  "magnet-node": {
    kind: "magnet-node",
    name: "Magnet Node",
    emoji: "🧲",
    duration: 9,
    stat: "pickup",
    mult: 2.2,
    color: "#d2a8ff",
  },
  "priority-fee": {
    kind: "priority-fee",
    name: "Priority Fee",
    emoji: "⏩",
    duration: 8,
    stat: "speed",
    mult: 1.28,
    color: "#f0c14d",
  },
  rebase: {
    kind: "rebase",
    name: "Rebase",
    emoji: "🔁",
    duration: 10,
    stat: "damage",
    mult: 1.25,
    color: "#2ee6c7",
  },
  "slashing-ward": {
    kind: "slashing-ward",
    name: "Slashing Ward",
    emoji: "🛡️",
    duration: 8,
    stat: "armor",
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
