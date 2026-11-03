export const SAVE_KEY = "revert.save";
export const LEGACY_PREFS_KEY = "revert.prefs.v1";
export const LEGACY_AUDIO_KEY = "revert.audio.v1";
export const SAVE_VERSION = 1;
export const HISTORY_LIMIT = 20;

export type ColorblindMode = "off" | "deut" | "prot" | "trit";
export const COLORBLIND_MODES: ColorblindMode[] = ["off", "deut", "prot", "trit"];

export type Settings = {
  muted: boolean;
  music: number;
  sfx: number;
  shake: number;
  reducedMotion: boolean | null;
  colorblind: ColorblindMode;
  haptics: boolean;
  hudScale: number;
  largeText: boolean;
};

export type LifetimeStats = {
  runs: number;
  kills: number;
  bosses: number;
  timeSec: number;
};

export type RunSummary = {
  date: number;
  time: number;
  score: number;
  hero: string;
  difficulty: string;
  tools: string[];
  rootCause: string;
};

export type BestEntry = { score: number; time: number };

export type SaveData = {
  v: number;
  best: number;
  hero: string | null;
  difficulty: string | null;
  tutorial: { done: boolean; levelHint: boolean };
  settings: Settings;
  stats: LifetimeStats;
  history: RunSummary[];
  bests: Record<string, BestEntry>;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const HUD_SCALE_MIN = 0.8;
export const HUD_SCALE_MAX = 1.5;

export const DEFAULT_SETTINGS: Settings = {
  muted: false,
  music: 1,
  sfx: 1,
  shake: 1,
  reducedMotion: null,
  colorblind: "off",
  haptics: true,
  hudScale: 1,
  largeText: false,
};

export function bestKey(hero: string, difficulty: string): string {
  return `${hero}:${difficulty}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, 60) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function clampSettings(raw: unknown): Settings {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    muted: flag(r.muted, d.muted),
    music: num(r.music, d.music, 0, 1),
    sfx: num(r.sfx, d.sfx, 0, 1),
    shake: num(r.shake, d.shake, 0, 1),
    reducedMotion: typeof r.reducedMotion === "boolean" ? r.reducedMotion : null,
    colorblind: COLORBLIND_MODES.includes(r.colorblind as ColorblindMode) ? (r.colorblind as ColorblindMode) : d.colorblind,
    haptics: flag(r.haptics, d.haptics),
    hudScale: num(r.hudScale, d.hudScale, HUD_SCALE_MIN, HUD_SCALE_MAX),
    largeText: flag(r.largeText, d.largeText),
  };
}

function cleanSummary(raw: unknown): RunSummary | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.score !== "number" || !Number.isFinite(raw.score)) return null;
  return {
    date: num(raw.date, 0, 0, Number.MAX_SAFE_INTEGER),
    time: num(raw.time, 0, 0, 1e7),
    score: num(raw.score, 0, 0, 1e12),
    hero: text(raw.hero),
    difficulty: text(raw.difficulty),
    tools: Array.isArray(raw.tools) ? raw.tools.filter((t): t is string => typeof t === "string").slice(0, 3).map((t) => t.slice(0, 40)) : [],
    rootCause: text(raw.rootCause, "None"),
  };
}

function cleanBests(raw: unknown): Record<string, BestEntry> {
  const out: Record<string, BestEntry> = Object.create(null) as Record<string, BestEntry>;
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value) || typeof value.score !== "number") continue;
    out[key.slice(0, 60)] = { score: num(value.score, 0, 0, 1e12), time: num(value.time, 0, 0, 1e7) };
  }
  return out;
}

export function defaultSave(): SaveData {
  return {
    v: SAVE_VERSION,
    best: 0,
    hero: null,
    difficulty: null,
    tutorial: { done: false, levelHint: false },
    settings: { ...DEFAULT_SETTINGS },
    stats: { runs: 0, kills: 0, bosses: 0, timeSec: 0 },
    history: [],
    bests: Object.create(null) as Record<string, BestEntry>,
  };
}

export function sanitize(raw: unknown): SaveData {
  const r = isRecord(raw) ? raw : {};
  const stats = isRecord(r.stats) ? r.stats : {};
  const tutorial = isRecord(r.tutorial) ? r.tutorial : {};
  const history = Array.isArray(r.history) ? r.history.map(cleanSummary).filter((s): s is RunSummary => s !== null) : [];
  return {
    v: SAVE_VERSION,
    best: num(r.best, 0, 0, 1e12),
    hero: typeof r.hero === "string" ? r.hero.slice(0, 40) : null,
    difficulty: typeof r.difficulty === "string" ? r.difficulty.slice(0, 40) : null,
    tutorial: { done: flag(tutorial.done, false), levelHint: flag(tutorial.levelHint, false) },
    settings: clampSettings(r.settings),
    stats: {
      runs: num(stats.runs, 0, 0, 1e9),
      kills: num(stats.kills, 0, 0, 1e12),
      bosses: num(stats.bosses, 0, 0, 1e9),
      timeSec: num(stats.timeSec, 0, 0, 1e12),
    },
    history: history.slice(0, HISTORY_LIMIT),
    bests: cleanBests(r.bests),
  };
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function fromLegacy(prefsRaw: string | null, audioRaw: string | null): SaveData {
  const prefs = parseJson(prefsRaw);
  const audio = parseJson(audioRaw);
  const p = isRecord(prefs) ? prefs : {};
  const a = isRecord(audio) ? audio : {};
  const done = p.tutorial === "done";
  return sanitize({
    best: typeof p.best === "string" || typeof p.best === "number" ? Number(p.best) : 0,
    hero: p.hero,
    difficulty: p.difficulty,
    tutorial: { done, levelHint: done },
    settings: { muted: a.muted, music: a.music, sfx: a.sfx },
  });
}

const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrate(raw: unknown): SaveData | null {
  if (!isRecord(raw) || typeof raw.v !== "number" || !Number.isFinite(raw.v) || raw.v < 1) return null;
  let data: Record<string, unknown> = raw;
  let version = Math.floor(raw.v);
  if (version > SAVE_VERSION) return sanitize(data);
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return null;
    data = step(data);
    version++;
  }
  return sanitize(data);
}

export function parseSave(raw: string | null, legacyPrefs: string | null, legacyAudio: string | null): SaveData {
  const current = migrate(parseJson(raw));
  return current ?? fromLegacy(legacyPrefs, legacyAudio);
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function safeRead(storage: StorageLike | null, key: string): string | null {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

export type Store = {
  get(): SaveData;
  patch(fn: (draft: SaveData) => void): boolean;
  subscribe(fn: (data: SaveData) => void): () => void;
  reset(): void;
};

export function createStore(resolveStorage: () => StorageLike | null = browserStorage): Store {
  let data: SaveData | null = null;
  const listeners = new Set<(data: SaveData) => void>();

  function load(): SaveData {
    if (data) return data;
    const storage = resolveStorage();
    data = parseSave(safeRead(storage, SAVE_KEY), safeRead(storage, LEGACY_PREFS_KEY), safeRead(storage, LEGACY_AUDIO_KEY));
    return data;
  }

  return {
    get: load,
    patch(fn) {
      const draft = sanitize(JSON.parse(JSON.stringify(load())));
      fn(draft);
      data = sanitize(draft);
      let saved = true;
      try {
        const storage = resolveStorage();
        if (!storage) saved = false;
        else storage.setItem(SAVE_KEY, JSON.stringify(data));
      } catch {
        saved = false;
      }
      for (const listener of listeners) listener(data);
      return saved;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reset() {
      data = null;
    },
  };
}

const store = createStore();

export const get = store.get;
export const patch = store.patch;
export const subscribe = store.subscribe;

export function prefersReducedMotion(settings: Settings): boolean {
  if (settings.reducedMotion !== null) return settings.reducedMotion;
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function recordRun(summary: RunSummary, kills: number, bosses: number): { best: number; comboBest: BestEntry } {
  let result = { best: summary.score, comboBest: { score: summary.score, time: summary.time } };
  patch((d) => {
    d.history.unshift(summary);
    d.history.length = Math.min(d.history.length, HISTORY_LIMIT);
    d.stats.runs++;
    d.stats.kills += kills;
    d.stats.bosses += bosses;
    d.stats.timeSec += summary.time;
    d.best = Math.max(d.best, summary.score);
    const key = bestKey(summary.hero, summary.difficulty);
    const prior = d.bests[key];
    if (!prior || summary.score > prior.score) d.bests[key] = { score: summary.score, time: summary.time };
    result = { best: d.best, comboBest: d.bests[key]! };
  });
  return result;
}
