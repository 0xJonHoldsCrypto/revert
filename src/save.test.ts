import { describe, expect, it } from "vitest";
import {
  clampSettings,
  CODEX_LIMIT,
  createStore,
  DEFAULT_SETTINGS,
  HISTORY_LIMIT,
  HUD_SCALE_MAX,
  HUD_SCALE_MIN,
  LEGACY_AUDIO_KEY,
  LEGACY_PREFS_KEY,
  migrate,
  parseSave,
  recordCodex,
  unlockAchievement,
  recordRun,
  SAVE_KEY,
  SAVE_VERSION,
  sanitize,
  type RunSummary,
  type StorageLike,
} from "./save";

function memory(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const run = (score: number, hero = "keel", difficulty = "normal"): RunSummary => ({ date: 1, time: 100, score, hero, difficulty, tools: ["Audit Dart"], rootCause: "None", won: false, winTime: 0 });

describe("save migration", () => {
  it("migrates legacy prefs and audio values", () => {
    const save = parseSave(
      null,
      JSON.stringify({ hero: "nyx", difficulty: "hard", tutorial: "done", best: "4200" }),
      JSON.stringify({ muted: true, music: 0.4, sfx: 0.25 })
    );
    expect(save.hero).toBe("nyx");
    expect(save.difficulty).toBe("hard");
    expect(save.best).toBe(4200);
    expect(save.tutorial).toEqual({ done: true, levelHint: true });
    expect(save.settings).toMatchObject({ muted: true, music: 0.4, sfx: 0.25 });
  });

  it("prefers the versioned save over legacy keys", () => {
    const current = JSON.stringify({ v: 1, best: 9, hero: "keel" });
    const save = parseSave(current, JSON.stringify({ hero: "nyx", best: "5" }), null);
    expect(save.hero).toBe("keel");
    expect(save.best).toBe(9);
  });

  it("falls back to defaults for garbage and null", () => {
    for (const raw of [null, "", "{", "[]", "null", "42", '"x"', '{"v":"1"}', '{"v":0}']) {
      const save = parseSave(raw, "not json", "[1,2]");
      expect(save.settings).toEqual(DEFAULT_SETTINGS);
      expect(save.history).toEqual([]);
      expect(save.best).toBe(0);
    }
  });

  it("drops malformed fields without losing valid ones", () => {
    const save = sanitize({
      v: 1,
      best: "lots",
      hero: 7,
      stats: { runs: -5, kills: "x", bosses: 3 },
      history: [null, 5, { score: "x" }, run(10)],
      bests: { "keel:normal": { score: 5, time: 2 }, bad: 3 },
    });
    expect(save.best).toBe(0);
    expect(save.hero).toBeNull();
    expect(save.stats).toEqual({ runs: 0, kills: 0, bosses: 3, timeSec: 0, bestTime: 0, wins: 0, fastestWin: 0 });
    expect(save.history).toHaveLength(1);
    expect(Object.keys(save.bests)).toEqual(["keel:normal"]);
  });

  it("accepts a newer version without discarding data", () => {
    expect(parseSave(JSON.stringify({ v: 99, best: 12 }), null, null).best).toBe(12);
  });
});

describe("settings clamping", () => {
  it("clamps ranges and rejects bad enums", () => {
    const s = clampSettings({ music: 5, sfx: -2, shake: "0.5", colorblind: "rainbow", hudScale: 99, haptics: "yes", reducedMotion: "no" });
    expect(s.music).toBe(1);
    expect(s.sfx).toBe(0);
    expect(s.shake).toBe(0.5);
    expect(s.colorblind).toBe("off");
    expect(s.hudScale).toBe(HUD_SCALE_MAX);
    expect(s.haptics).toBe(true);
    expect(s.reducedMotion).toBeNull();
    expect(clampSettings({ hudScale: 0 }).hudScale).toBe(HUD_SCALE_MIN);
    expect(clampSettings({ music: NaN, sfx: Infinity }).music).toBe(DEFAULT_SETTINGS.music);
  });

  it("keeps valid values", () => {
    expect(clampSettings({ colorblind: "trit", reducedMotion: true, largeText: true, haptics: false })).toMatchObject({
      colorblind: "trit",
      reducedMotion: true,
      largeText: true,
      haptics: false,
    });
  });
});

describe("store", () => {
  it("persists patches and reloads them", () => {
    const storage = memory({ [LEGACY_PREFS_KEY]: JSON.stringify({ hero: "nyx" }), [LEGACY_AUDIO_KEY]: JSON.stringify({ music: 0.3 }) });
    const store = createStore(() => storage);
    expect(store.get().hero).toBe("nyx");
    expect(store.patch((d) => void (d.settings.shake = 0.2))).toBe(true);
    const fresh = createStore(() => storage);
    expect(fresh.get().settings.shake).toBe(0.2);
    expect(fresh.get().settings.music).toBe(0.3);
    expect(JSON.parse(storage.data[SAVE_KEY]!).v).toBe(SAVE_VERSION);
  });

  it("clamps out-of-range patches", () => {
    const store = createStore(() => memory());
    store.patch((d) => void (d.settings.music = 9));
    expect(store.get().settings.music).toBe(1);
  });

  it("survives missing or throwing storage", () => {
    const missing = createStore(() => null);
    expect(missing.patch((d) => void (d.best = 3))).toBe(false);
    expect(missing.get().best).toBe(3);
    const throwing = createStore(() => ({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    }));
    expect(throwing.get().settings).toEqual(DEFAULT_SETTINGS);
    expect(throwing.patch((d) => void (d.settings.sfx = 0.5))).toBe(false);
    expect(throwing.get().settings.sfx).toBe(0.5);
  });

  it("notifies subscribers", () => {
    const store = createStore(() => memory());
    let seen = 0;
    const off = store.subscribe(() => seen++);
    store.patch((d) => void (d.best = 1));
    off();
    store.patch((d) => void (d.best = 2));
    expect(seen).toBe(1);
  });
});

describe("run history", () => {
  it("caps history and tracks per hero and difficulty bests", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const storage = memory();
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
    try {
      for (let i = 0; i < HISTORY_LIMIT + 5; i++) recordRun(run(i), 10, 1);
      const result = recordRun(run(5, "nyx", "hard"), 4, 0);
      expect(result.comboBest.score).toBe(5);
      const saved = JSON.parse(storage.data[SAVE_KEY]!);
      expect(saved.history).toHaveLength(HISTORY_LIMIT);
      expect(saved.history[0].hero).toBe("nyx");
      expect(saved.bests["keel:normal"].score).toBe(HISTORY_LIMIT + 4);
      expect(saved.bests["nyx:hard"].score).toBe(5);
      expect(saved.stats.runs).toBe(HISTORY_LIMIT + 6);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

describe("v1 to v2 migration", () => {
  const v1 = {
    v: 1,
    best: 700,
    hero: "nyx",
    stats: { runs: 3, kills: 90, bosses: 2, timeSec: 400 },
    history: [run(10), { ...run(20), time: 333 }, { ...run(30), time: 150 }],
    bests: { "keel:normal": { score: 30, time: 150 } },
  };

  it("keeps old data and adds empty achievements and codex", () => {
    const out = migrate(v1)!;
    expect(out.v).toBe(SAVE_VERSION);
    expect(out.best).toBe(700);
    expect(out.hero).toBe("nyx");
    expect(out.stats).toMatchObject({ runs: 3, kills: 90, bosses: 2, timeSec: 400 });
    expect(out.achievements).toEqual({});
    expect(out.codex).toEqual({ seen: {}, killed: {} });
  });

  it("derives best time from history", () => {
    expect(migrate(v1)!.stats.bestTime).toBe(333);
  });

  it("migrates a v3 save and marks old runs as not won", () => {
    const old = {
      v: 3,
      best: 900,
      stats: { runs: 4, kills: 10, bosses: 1, timeSec: 800, bestTime: 300 },
      history: [{ date: 5, time: 300, score: 900, hero: "keel", difficulty: "normal", tools: ["Audit Dart"], rootCause: "None" }],
    };
    const out = migrate(old)!;
    expect(out.v).toBe(SAVE_VERSION);
    expect(out.stats).toMatchObject({ runs: 4, wins: 0, fastestWin: 0 });
    expect(out.history[0]).toMatchObject({ score: 900, won: false, winTime: 0 });
  });

  it("keeps won and win time on summaries and drops bogus ones", () => {
    const out = sanitize({ history: [{ ...run(5), won: true, winTime: 845 }, { ...run(6), won: "yes", winTime: 99 }, { ...run(7), won: false, winTime: 50 }] });
    expect(out.history.map((h) => [h.won, h.winTime])).toEqual([[true, 845], [false, 0], [false, 0]]);
  });

  it("records wins and the fastest win in lifetime stats", () => {
    const storage = memory();
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
    try {
      recordRun({ ...run(100), won: true, winTime: 900 }, 1, 1);
      recordRun({ ...run(200), won: true, winTime: 800 }, 1, 1);
      recordRun({ ...run(50) }, 1, 1);
      const saved = JSON.parse(storage.data[SAVE_KEY]!);
      expect(saved.stats).toMatchObject({ wins: 2, fastestWin: 800 });
      expect(saved.history[2]).toMatchObject({ won: true, winTime: 900 });
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it("cleans malformed achievement and codex data", () => {
    const out = sanitize({ v: 2, achievements: { a: 5, b: "x", c: -3 }, codex: { seen: { "e:x": 1, bad: null }, killed: { "e:x": "9", "e:y": 4 } } });
    expect(out.achievements).toEqual({ a: 5, c: 0 });
    expect(out.codex.seen).toEqual({ "e:x": 1 });
    expect(out.codex.killed).toEqual({ "e:y": 4 });
  });

  it("caps the number of codex keys", () => {
    const seen = Object.fromEntries(Array.from({ length: CODEX_LIMIT + 50 }, (_, i) => [`k${i}`, 1]));
    expect(Object.keys(sanitize({ codex: { seen } }).codex.seen)).toHaveLength(CODEX_LIMIT);
  });
});

describe("achievement and codex persistence", () => {
  it("unlocks once and accumulates codex counters", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const storage = memory();
    Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
    try {
      expect(unlockAchievement("first-boss", 1234)).toBe(true);
      expect(unlockAchievement("first-boss", 9999)).toBe(false);
      recordCodex(["t:audit-dart"], new Map([["e:sybil", 3]]));
      recordCodex([], new Map([["e:sybil", 2]]));
      const saved = JSON.parse(storage.data[SAVE_KEY]!);
      expect(saved.achievements).toEqual({ "first-boss": 1234 });
      expect(saved.codex.killed["e:sybil"]).toBe(5);
      expect(saved.codex.seen["e:sybil"]).toBe(1);
      expect(saved.codex.seen["t:audit-dart"]).toBe(1);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

describe("save store across tabs", () => {
  it("keeps writes from another tab when patching", () => {
    const storage = memory();
    const tabA = createStore(() => storage);
    const tabB = createStore(() => storage);
    expect(tabA.get().best).toBe(0);
    tabB.patch((d) => {
      d.achievements["first-boss"] = 5;
    });
    tabA.patch((d) => {
      d.best = 77;
    });
    const stored = JSON.parse(storage.data[SAVE_KEY]!);
    expect(stored.best).toBe(77);
    expect(stored.achievements["first-boss"]).toBe(5);
    expect(tabA.get().achievements["first-boss"]).toBe(5);
  });

  it("refresh picks up another tab's write and notifies listeners", () => {
    const storage = memory();
    const tabA = createStore(() => storage);
    const tabB = createStore(() => storage);
    tabA.get();
    const seen: number[] = [];
    tabA.subscribe((d) => seen.push(d.best));
    tabB.patch((d) => {
      d.best = 12;
    });
    expect(tabA.get().best).toBe(0);
    tabA.refresh();
    expect(tabA.get().best).toBe(12);
    expect(seen).toEqual([12]);
  });
});
