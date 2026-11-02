export const WORLD = { width: 4800, height: 4800 };

export const WIN_TIME_SEC = 20 * 60;

export const TILE = 64;

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

export const BOSS_TIMES = [3 * 60, 6 * 60, 9 * 60, 12 * 60, 16 * 60, 19 * 60];

export const BOSS_KINDS = [
  "boss-mev-king",
  "boss-unit-414",
  "boss-phish-king",
  "boss-oracle",
  "boss-nightdesk",
  "boss-grandmaster",
] as const;
