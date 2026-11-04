export const COLORS = {
  bg: "#0d1117",
  grid: "#161b22",
  gridAccent: "#1c2128",
  text: "#e6edf3",
  gold: "#f0b429",
  danger: "#f85149",
  success: "#3fb950",
  purple: "#a371f7",
};

export const DASH = {
  duration: 0.22,
  speedMult: 3.2,
  iframes: 0.28,
};

export const PLAYER_RADIUS = 18;

export const MAX_ENEMIES = 500;

export const BOSS_TIMES = [120, 210, 300, 390, 480, 570, 660, 750, 840];
const ENDLESS_BOSS_GAP_SEC = 105;
export const BOSS_KINDS = [
  "boss-shill",
  "boss-rug-baron",
  "boss-mev-king",
  "boss-gas-golem",
  "boss-unit-414",
  "boss-phish-king",
  "boss-oracle",
  "boss-nightdesk",
  "boss-grandmaster",
] as const;

export function bossTimeAt(index: number): number {
  const last = BOSS_TIMES.length - 1;
  return index <= last ? BOSS_TIMES[index]! : BOSS_TIMES[last]! + (index - last) * ENDLESS_BOSS_GAP_SEC;
}

export function bossKindAt(index: number) {
  return BOSS_KINDS[index % BOSS_KINDS.length]!;
}

export function bossTierAt(index: number): number {
  return Math.floor(index / BOSS_KINDS.length);
}
