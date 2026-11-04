import type { CharacterId, ChestKind, EnemyKind, SidekickKind } from "../types";

type Palette = Record<string, string>;

const BASE: Palette = {
  k: "#0b0a14",
  s: "#e6b08c",
  n: "#b67c5e",
  S: "#f8d2b0",
  w: "#f4f3ee",
  e: "#14121c",
};

const cache = new Map<string, HTMLCanvasElement>();

export function paintGrid(key: string, rows: string[], palette: Palette): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = rows.length;
  const c = canvas.getContext("2d", { willReadFrequently: true })!;
  const colors = { ...BASE, ...palette };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = colors[row[x]!];
      if (!color) continue;
      c.fillStyle = color;
      c.fillRect(x, y, 1, 1);
    }
  });
  cache.set(key, canvas);
  return canvas;
}

type Walker = { top: string[]; legs: [string[], string[]]; palette: Palette };

const LEGS_A = [
  "....kbbbkkbbbk....",
  "....kbbBkkbbBk....",
  "...kbbBk..kbbBk...",
  "...kbbk....kbbk...",
  "...kffk....kffk...",
  "..kfffk....kfffk..",
  "..kkkkk....kkkkk..",
];
const LEGS_B = [
  "....kbbbkkbbbk....",
  ".....kbbbbbBk.....",
  ".....kbbbbBk......",
  "......kbbbk.......",
  "......kbbk........",
  "......kfffk.......",
  "......kkkkk.......",
];

const HEROES: Record<CharacterId, Walker> = {
  keel: {
    palette: { t: "#22c4a8", T: "#7df2dc", d: "#10695e", g: "#1f7f73", G: "#35b3a0", h: "#123f3b", b: "#2c3550", B: "#465279", f: "#d8dce4", m: "#9aa2b4", M: "#d9dfea" },
    top: [
      ".....kkkkkkkk.....",
      "....kttTTTTttk....",
      "...kttttttttttk...",
      "...kddddddddddk...",
      "...kssssssssssk...",
      "...kssskeesskek...",
      "...kssskeesskek...",
      "...kSSSssssnssk...",
      "....ksssskkssk....",
      ".....kssssssk.....",
      "....kkhggggGkk....",
      "...kgghgggggGGk...",
      "..kgggkhhhhkgGGk.m",
      "..kggkgggggkkGGkMm",
      "..kggkggGggkkGGkm.",
      "..kggkgggggk.kSSkm",
      "..kSSkgggggk.kSSk.",
      "...kkkddddddk.kk..",
      "....kddddddddk....",
    ],
    legs: [LEGS_A, LEGS_B],
  },
  nyx: {
    palette: { c: "#27304d", C: "#46558a", d: "#161b30", v: "#6cb6ff", V: "#d8f0ff", h: "#dfe6f4", H: "#8a95b4", b: "#1a1e30", B: "#2c3350", f: "#3a4468", a: "#ff5c9c" },
    top: [
      "..............a...",
      ".............kHk..",
      ".....kkkkkkkk.kH..",
      "....khhhhhhhhk.H..",
      "...khhhhHHHhhhkH..",
      "...khkkkkkkkkkkk..",
      "...khkvvVVVvvvvk..",
      "...kHkkkkkkkkkkk..",
      "....ksssssnnssk...",
      ".....kssssssssk...",
      "....kkcCCCCCCkk...",
      "...kccCcccccCCCk..",
      "..kcccCcccccCCCCk.",
      "..kcckCcvvvcCkCCk.",
      "..kcckCcccccCkCCk.",
      "..kcckCcccccCkSSk.",
      "..kSSkCcccccCkkk..",
      "...kkkCdccccCk....",
      "...kccCdccccCCk...",
      "...kccCdcdccCCk...",
    ],
    legs: [
      ["...kddkbbkkbbkdk..", "....kkkbBk.kbBkk..", "....kbbBk...kbBk..", "....kbbk....kbbk..", "...kfffk....kfffk.", "...kkkkk....kkkkk."],
      ["...kddkbbbbbbkdk..", "....kkkbbbbBkk....", "......kbbbBk......", "......kbbbk.......", ".....kfffk........", ".....kkkkk........"],
    ],
  },
  diff: {
    palette: { h: "#f6f5ef", H: "#c8c8c0", y: "#26242c", r: "#d7322c", R: "#ff6a58", c: "#e6e8f0", C: "#a8aec0", b: "#30303c", B: "#4c4c5e", f: "#7a4a2a", p: "#c8a060", P: "#f2e4c0", q: "#5c4828" },
    top: [
      "......kkkkkk......",
      ".....khhhhhhk.....",
      ".....khhhhhhk.....",
      ".....krrrrrrk.....",
      "..kkkkhhhhhhkkkk..",
      "..kHHhhhhhhhhhhHk.",
      "...kkkkkkkkkkkkk..",
      "....kyysssssssk...",
      "....kysskesskek...",
      "....kysskesskek...",
      "....kSSsssssnsk...",
      ".....kssskkssk....",
      "......kssssk......",
      "....kkccrrcckk....",
      "...kcCccrRcccCk...",
      "..kccCccrrcccCCkkkk",
      "..kcckccrrccckCkPPk",
      "..kcckccRrccckSkqPk",
      "..kSSkcccccck.kPPPk",
      "...kkkcccccck.kkkkk",
      "....kbbbbbbbbk....",
    ],
    legs: [LEGS_A, LEGS_B],
  },
  trace: {
    palette: { o: "#f08a24", O: "#ffb85c", d: "#a85a12", y: "#f2e24a", g: "#26283a", G: "#3e4260", h: "#2a1c18", p: "#ff4638", P: "#ffd0c8", b: "#232636", B: "#3a3f58", f: "#111118", m: "#7a8092" },
    top: [
      ".....kkkkkkkk.....",
      "....khhhhhhhhk....",
      "...kkmmmmmmmmkk...",
      "..kmkhhhhhhhhkmk..",
      "..kmkssssssssskk..",
      "..kmkssskeesskek..",
      "..kpkssskeesskek..",
      "...kkSSssssnsssk..",
      "...mmkssskkkssk...",
      ".....kssssssssk...",
      "....kkoooggoookk..",
      "...kooyyoggoyyOOk.",
      "..koooyyoggoyyOOOk",
      "..kook.oooooo.kOOk",
      "..kookoyyyyyyokOOk",
      "..kookooggooo.kSSk",
      "..kSSkooggoookkkk.",
      "...kkkddggddk.kpPk",
      "....kggggggggkkppk",
    ],
    legs: [LEGS_A, LEGS_B],
  },
  ledger: {
    palette: { h: "#3a2a1a", y: "#f0c14d", g: "#f0c14d", G: "#a87b18", c: "#2a2d3c", C: "#444a62", P: "#f2e4c0", L: "#7a4a2a", b: "#232636", B: "#3a3f58", f: "#111118" },
    top: [
      ".....kkkkkkkk.....",
      "....khhhhhhhhk....",
      "...khhhhhhhhhhk...",
      "...khhssssssshk...",
      "...ksyyyssyyysk...",
      "...ksyeyssyeysk...",
      "...kSSssssssnssk..",
      "....ksssskkssk....",
      ".....kssssssk.....",
      "....kkcgggggckk...",
      "...kccCcgGgcCcck..",
      "..kcccCcgGgcCcPPPk",
      "..kcckCcgGgcCkLPPk",
      "..kcckCccgccCkLPPk",
      "..kcckCcccccCkLPPk",
      "..kSSkCcccccCkLLLk",
      "...kkkCcccccCk.kk.",
      "....kbbbbbbbbk....",
      "....kbbbbbbbbk....",
    ],
    legs: [LEGS_A, LEGS_B],
  },
  relay: {
    palette: { a: "#2ee6c7", M: "#9aa2b4", m: "#3a3f58", r: "#5a2f90", j: "#c43f8f", J: "#ff8bd1", v: "#2ee6c7", d: "#232636", b: "#2a2438", B: "#433a5c", f: "#111118" },
    top: [
      "........a.........",
      "........M.........",
      ".....kkkMkkkk.....",
      "....krrrrrrrrk....",
      "...krrrrrrrrrrk...",
      "..mkrrssssssrrkm..",
      "..mkssskeesskekm..",
      "..mkssskeesskekm..",
      "...kSSSssssnssk...",
      "....ksssskkssk....",
      ".....kssssssk.....",
      "....kkjJJJJjjkk...",
      "...kjjJjjjjjJJjk..",
      "..kjjjJjvvvjJJJjk.",
      "..kjjkJjjjjjJkjjk.",
      "..kjjkJjjjjjJkSSk.",
      "..kSSkJjjjjjJkkk..",
      "...kkkjddddjjk....",
      "....kddddddddk....",
    ],
    legs: [LEGS_A, LEGS_B],
  },
};

export function heroFrame(id: CharacterId, frame: number): HTMLCanvasElement {
  const hero = HEROES[id];
  const f = frame % 2;
  return paintGrid(`hero-${id}-${f}`, [...hero.top, ...hero.legs[f as 0 | 1]], hero.palette);
}

const PORTRAIT_ROWS = 16;

export function heroPortrait(id: CharacterId): HTMLCanvasElement {
  const hero = HEROES[id];
  return paintGrid(`portrait-${id}`, hero.top.slice(0, PORTRAIT_ROWS), hero.palette);
}

const E_LEGS_A = ["...kbbkkbbk...", "..kbbk..kbbk..", "..kffk..kffk..", "..kkkk..kkkk.."];
const E_LEGS_B = ["...kbbkkbbk...", "....kbbbbk....", "....kffffk....", "....kkkkkk...."];

const ENEMIES: Partial<Record<EnemyKind, Walker>> = {
  "script-kiddie": {
    palette: { h: "#4e8f3e", H: "#7cc264", d: "#2e5c26", l: "#23252e", g: "#7ef0a0", G: "#14401f", b: "#25283a", f: "#d8d8e0" },
    top: [
      "....kkkkkk....",
      "...khHHHHhk...",
      "..khhkkkkhhk..",
      "..khkssssshk..",
      "..khkekskekk..",
      "..khksssssk...",
      "...khkkkkhk...",
      "..khhhhhhhhk..",
      ".khhHhhhhdhhk.",
      "kkkkkkkkkkkkkk",
      "kggggggggggggk",
      "kgGGgGGGggGggk",
      "kggggggggggggk",
      "kllllllllllllk",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  "phishing-bot": {
    palette: { b: "#3b6cff", B: "#7c9cff", w: "#f2f4fa", g: "#2ec27e", G: "#8cf0c0", r: "#ff5c48", t: "#14161f", m: "#8c93a6", p: "#7a4de0", c: "#c8ccd8" },
    top: [
      "kkkkkkkkkkkkkkkkkk",
      "kbBBBBBBBBBBBkrrkk",
      "kbbbbbbbbbbbbkrrkk",
      "kkkkkkkkkkkkkkkkkk",
      "kwwwwwwwwwwwwwwwwk",
      "kwttttttttttttwwwk",
      "kwwwwwwwwwwwwwwwwk",
      "kwmmmmmmmmmmwwwwwk",
      "kwwwwwwwwwwwwwwwwk",
      "kwwwkkkkkkkkkkwwwk",
      "kwwwkGGGGGGGGkwwwk",
      "kwwwkggggggggkwwwk",
      "kwwwkkkkkkkkkkwwwk",
      "kkkkkkkkkkkkkkkkkk",
    ],
    legs: [
      ["...kpk......kpk...", "...kpk......kpk...", "..kppk......kppk..", "..kkkk......kkkk.."],
      ["..kpk........kpk..", "..kpk........kpk..", "..kppk......kppk..", "..kkkk......kkkk.."],
    ],
  },
  "mev-searcher": {
    palette: { y: "#e8bb33", Y: "#fff0a0", d: "#8a6510", g: "#3a3e50", G: "#6a7088", c: "#5de9ff", o: "#ffb020", O: "#fff0b0" },
    top: [
      "......kkkkkkkkkk....",
      "......kGGGGGGGGk....",
      ".........kgk........",
      "...kkkkkkkkkkkkkk...",
      "..kYYYYYYYYYYYYYYk..",
      "kkkyyyyyyyyykkkkkkk.",
      "kOokyyyyyyyykccCCcyk",
      "kOokyyyyyyyykcccccyk",
      "kkkyyyyyyyyykkkkkkk.",
      "..kddddddddddddddk..",
      "...kkkkkkkkkkkkkk...",
      "....kgk......kgk....",
      "....kkk......kkk....",
    ],
    legs: [[], []],
  },
  "bridge-drainer": {
    palette: { p: "#9a5cff", P: "#d8b8ff", d: "#5a34a8", b: "#2f3350", B: "#51568a", t: "#16182a", g: "#6a7088", G: "#9aa0b4", r: "#ff5c48", c: "#c8ccd8" },
    top: [
      "......kkkkkk..........",
      ".....kccccck..........",
      "....kkkkkkkkkk........",
      "....kPPpppppdk..kkkkkk",
      "....kPPpppppdk.kgGGGGk",
      "....kPPpppppdk.kgkkkkk",
      "....kPPpppppdk.kgk....",
      "....kPPpppppdk.kgk....",
      "...kkkkkkkkkkkkkgk....",
      "..kBBBBBBBBBBBBBBBk...",
      "..kbbbbbbbbbbbbbbbk...",
      "..kbbrrbbbbbbbbbbbk...",
      "..kbbrrbbbbbbbbbbbk...",
      ".kkkkkkkkkkkkkkkkkkk..",
      ".ktgtgtgtgtgtgtgtgtk..",
      ".kkkkkkkkkkkkkkkkkkk..",
    ],
    legs: [[], []],
  },
  "rug-dev": {
    palette: { c: "#2a2f47", C: "#454c70", h: "#1a1214", w: "#f4f4f4", r: "#c23c3c", u: "#b52c52", U: "#f0c14d", V: "#7a1f3a", y: "#e8d9b8", b: "#1b1e2c", f: "#0c0c10" },
    top: [
      "....kkkkkkkk.......",
      "...khhhhhhhhk......",
      "...khssssssskkkkkk.",
      "...kkkkkkkkkkyyyyk.",
      "...kskeekskekuUuVk.",
      "...kskkkkkkkkuUuVk.",
      "...kSsssnnssskVuUk.",
      "....kskkkkksk.kVuUk",
      "....ksssssssk.kuUuk",
      "...kkkcwrwckkkkUuVk",
      "..kcCCcwrwcCCcukVuk",
      "..kcCCcwrwcCCkkuUuk",
      "..kcCkcwwwckCk.kkkk",
      "..kSSkcccccckSk....",
      "...kkkccccccckk....",
    ],
    legs: [
      ["....kbbkkbbk....", "...kbbk..kbbk...", "...kbbk..kbbk...", "...kffk..kffk...", "..kfffk..kfffk..", "..kkkkk..kkkkk.."],
      ["....kbbkkbbk....", ".....kbbbbk.....", ".....kbbbbk.....", ".....kbbbk......", ".....kfffk......", ".....kkkkk......"],
    ],
  },
  "oracle-manipulator": {
    palette: { f: "#151827", F: "#2b3a66", d: "#08101e", g: "#2ee6c7", r: "#ff5c48", c: "#79c0ff", C: "#e8f4ff", p: "#3a3e58", P: "#5a6080" },
    top: [
      "kkkkkkkkkkkkkkkkkkkk",
      "kFFFFFFFFFFFFFFFFFFk",
      "kfkkkkkkkkkkkkkkkkfk",
      "kfkddddddcCCCcddddkfk",
      "kfkddddddcCeCcddddkfk",
      "kfkddddddcCCCcddddkfk",
      "kfkddddddddddddddrdkfk",
      "kfkddddddddrddddrrdkfk",
      "kfkddgddddrrdgddrrdkfk",
      "kfkdgggdrdrrgggdrrdkfk",
      "kfkdgggrrrrrgggdrrdkfk",
      "kfkkkkkkkkkkkkkkkkkfk",
      "kkkkkkkkkkkkkkkkkkkkk",
      ".........kPpk.........",
      ".........kPpk.........",
      ".........kPpk.........",
      "......kkkkPpkkkk......",
      ".....kPPPPppppppk.....",
      ".....kkkkkkkkkkkk.....",
    ],
    legs: [[], []],
  },
  "sim-swapper": {
    palette: { h: "#22303f", H: "#3a526a", g: "#5df0a0", d: "#0c1016", y: "#e8c24a", Y: "#fff0a0", q: "#8a6a18", p: "#1a1c28", c: "#7ef0ff", b: "#242638", f: "#14141c" },
    top: [
      "......kkkkkk......",
      ".....khHHHHhk.....",
      "....khhkkkkhhk....",
      "....khkdddddkk....",
      "....khkgkdgkdk....",
      "....khkdddddkk....",
      ".....khkkkkhk.....",
      "kkkkkkhhhhhhkkkkkk",
      "kyYqkhhHhhhhhkpppk",
      "kyYqkhhHhhhhhkpcck",
      "kkyYqkhHhhhhkkpcck",
      ".kyYqkhHhhhhkkpcck",
      ".kkkkkhhhhhhk.kkkk",
      "......khhhhhhk....",
    ],
    legs: [
      ["......kbbkkbbk....", ".....kbbk..kbbk...", ".....kffk..kffk...", ".....kkkk..kkkk..."],
      ["......kbbkkbbk....", "........kbbbk.....", "........kffk......", "........kkkk......"],
    ],
  },
  insider: {
    palette: { w: "#dfe4ee", W: "#a8b0c4", h: "#6a4228", g: "#2ec27e", G: "#e8fff4", b: "#3a3f58", f: "#1a1a22" },
    top: [
      "....kkkkkkkk....",
      "...khhhhhhhhk...",
      "...khssssssshk..",
      "...ksskesskesk..",
      "...kSsskesskesk.",
      "...ksssssnsssk..",
      "...kskkssskksk..",
      "....ksskkkssk...",
      "...kkwgwwwgwkk..",
      "..kwWwgwwwgwwWk.",
      "..kwWwwgwgwwwWk.",
      "..kwkwwkGGkwkwk.",
      "..kskwwkgGkwksk.",
      "...kkwwkkkkwkk..",
      "....kwwwwwwwk...",
    ],
    legs: [
      ["....kbbkkbbk....", "...kbbk..kbbk...", "...kbbk..kbbk...", "...kffk..kffk...", "...kkkk..kkkk..."],
      ["....kbbkkbbk....", ".....kbbbbk.....", ".....kbbbbk.....", ".....kfffk......", ".....kkkkk......"],
    ],
  },
  "shadow-op": {
    palette: { m: "#14141e", M: "#2a2d42", r: "#ff3a44", R: "#ffd0d0", v: "#3a0f14", g: "#3c3f50", b: "#14141e", f: "#08080c" },
    top: [
      "....kkkkkkkk.......",
      "...kmMMMMMmmk......",
      "...kmmmmmmmmk......",
      "...kmrrRrrrrk......",
      "...kmrrrrrrrk......",
      "...kmmmmmmmmk......",
      "....kmmmmmmk.......",
      "...kkMMMMMMkk......",
      "..kmmMMMMMMmmk.....",
      "..kmkMMMMMMkmkkkkkk",
      "..kmkMMMMMMkmkggggk",
      "..kmkvvvvvvkkkkmmgk",
      "..kmkmmmmmmk..kmmk.",
      "...kkmmmmmmk..kkkk.",
    ],
    legs: [
      ["....kbbkkbbk....", "...kbbk..kbbk...", "...kbbk..kbbk...", "...kffk..kffk...", "..kffk...kffk...", "..kkkk...kkkk..."],
      ["....kbbkkbbk....", ".....kbbbbk.....", ".....kbbbbk.....", ".....kffk.......", "....kfffk.......", "....kkkkk......."],
    ],
  },
  "airdrop-farmer": {
    palette: { h: "#c9b458", H: "#ece08a", b: "#4b5d2f", f: "#3a2f22", g: "#7fae3f", G: "#a8d65c" },
    top: [
      "..HHHHHHHHHH..",
      ".hhhhhhhhhhhh.",
      "...kssssssk...",
      "...ksekkesk...",
      "...kssssssk...",
      "..kggggggggk..",
      "..kgGGggGGgk..",
      "..kggggggggk..",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  sybil: {
    palette: { m: "#ff9de2", M: "#ffd1f1", d: "#a24c8c", b: "#3e2a46", f: "#20182a" },
    top: [
      ".kkkk..kkkk...",
      "kmMMmkkmMMmk..",
      "kmekmkkmekmk..",
      "kmmmmkkmmmmk..",
      ".kkkkkkkkkk...",
      "..kmMMMMmk....",
      "..kmekkemk....",
      "..kmmmmmmk....",
      "..kddddddk....",
      "..kmmmmmmk....",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  "sybil-mini": {
    palette: { m: "#ffc4ee", M: "#ffe6f8", b: "#3e2a46", f: "#20182a" },
    top: [
      "...kkkkkk...",
      "..kmMMMMmk..",
      "..kmekkemk..",
      "..kmmmmmmk..",
      "...kkkkkk...",
    ],
    legs: [["...kbbkkbbk.", "...kffkkffk."], ["...kbbbbbk..", "....kffffk.."]],
  },
  liquidator: {
    palette: { c: "#23252e", C: "#3e4250", r: "#ff5c48", R: "#ff8552", g: "#b9bcc8", G: "#e4e6ee", b: "#191a22", f: "#0f1016", t: "#6a4a2c" },
    top: [
      "..........GGGGk",
      "....kkkkkkGggGk",
      "...kCCCCCkGggGk",
      "...kcrrrrkkttk.",
      "...kcsssskkttk.",
      "...kseksekkttk.",
      "...kssssskkttk.",
      "..kccRRRcckttk.",
      ".kCccRRRcccttk.",
      ".kcccRRRccckkk.",
      ".kcccRRRccck...",
      ".kkkkkkkkkkk...",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  "gas-guzzler": {
    palette: { y: "#b7e04b", Y: "#e0ff87", d: "#6a8a20", t: "#14161f", r: "#ff5c48", b: "#3a3e50", f: "#1f2230" },
    top: [
      "..YY.....Y....",
      ".Y..YY.......",
      "...kkkkkkkk...",
      "..kyYYYYYYyk..",
      "..kyttttttyk..",
      "..kytrrrrtykk.",
      "..kyttttttykyk",
      "..kyyyyyyyykyk",
      "..kyddddddyk.k",
      "..kyyyyyyyyk..",
      "..kyyyyyyyyk..",
      "..kkkkkkkkkk..",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  "flash-bot": {
    palette: { c: "#6ff7ff", C: "#d8feff", d: "#1d8c98", b: "#1a3840", f: "#0e2026", y: "#ffe08a" },
    top: [
      "......kk......",
      ".....kCCk.....",
      "....kCCCCk....",
      "...kcyyyyck...",
      "...kcckkcck...",
      "ccc.kcccck.ccc",
      ".cc.kddddk.cc.",
      "..c.kcyyck.c..",
      "....kcccck....",
      ".....kkkk.....",
    ],
    legs: [["....kbk.kbk...", "....kfk.kfk..."], ["...kbk...kbk..", "...kfk...kfk.."]],
  },
  "pump-bot": {
    palette: { g: "#3cf07c", G: "#b2ffcf", d: "#14803f", r: "#ff5c48", t: "#10231a", b: "#1f3a2a", f: "#10231a" },
    top: [
      "..........kGk.",
      ".........kGGGk",
      "..kkkkkkkk.g..",
      ".kgGGGGGGgkg..",
      ".kgttttttgkg..",
      ".kgtGttGtgkg..",
      ".kgttttttgkk..",
      ".kgggggggg....",
      ".kgdgdgdgdk...",
      ".kggggggggk...",
      ".kkkkkkkkkk...",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  "wash-trader": {
    palette: { b: "#26324d", B: "#3b4c73", w: "#f2f6ff", c: "#8fd6ff", C: "#d2f0ff", f: "#111726", t: "#ff5c48" },
    top: [
      "..C...kkkk..C.",
      ".C.c.kssssk...",
      "..c..kseesk.c.",
      ".....ksssskC.C",
      "...kkkbwwbkk..",
      "..kBbbbwtbbbk.",
      "..kbbbbwtbbbk.",
      "..kbbbbwwbbbk.",
      "..kkkkkkkkkkk.",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  "honeypot-mimic": {
    palette: { h: "#ffc23d", H: "#ffe69a", d: "#a86a10", c: "#6d431c", r: "#ff3a2e", w: "#ffffff", b: "#3a2610", f: "#1e1408" },
    top: [
      "...kkkkkkkk...",
      "..kccccccck...",
      "...kkkkkkkk...",
      "..khHHHHHHhk..",
      ".khhrhhhhrhhk.",
      ".khhhhhhhhhhk.",
      ".khwkwkwkwkhk.",
      ".khkwkwkwkwhk.",
      ".khhhhhhhhdhk.",
      "..kddddddddk..",
      "...kkkkkkkk...",
    ],
    legs: [[".............."], [".............."]],
  },
  "jpeg-flipper": {
    palette: { o: "#ff9f43", O: "#ffd08a", d: "#a8601a", p: "#b58cff", c: "#2ee6c7", f: "#f4f3ee", b: "#30263a", m: "#3a3e50" },
    top: [
      "...kkkkkkkk...",
      "..koOOOOOOok..",
      "..kosseessok..",
      "..kosssssok...",
      "...kkkkkkkkkkk",
      "..koooooofpcfk",
      ".koOooooofccfk",
      ".kooooooofpcfk",
      ".kdddddddfffmk",
      ".kkkkkkkkkkkkk",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  "bot-farm": {
    palette: { m: "#6a6f80", M: "#a8adbc", d: "#34384a", g: "#3cf07c", r: "#ff5c48", y: "#ffc23d", s: "#c8ccd8" },
    top: [
      "....ss........ss....",
      "....ss..kkkk..ss....",
      "..kkkkkkkMMkkkkkkk..",
      ".kMMMMMMMMMMMMMMMMk.",
      ".kmdddmdddmdddmdddk.",
      ".kmdgdmdrdmdgdmdydk.",
      ".kmdddmdddmdddmdddk.",
      ".kmmmmmmmmmmmmmmmmk.",
      ".kmdddmdddmdddmdddk.",
      ".kmdydmdgdmdrdmdgdk.",
      ".kmdddmdddmdddmdddk.",
      ".kmmmmmmmmmmmmmmmmk.",
      "kkkkkkkkkkkkkkkkkkkk",
      "kddddddddddddddddddk",
      "kkkkkkkkkkkkkkkkkkkk",
    ],
    legs: [["...................."], ["...................."]],
  },
  "depegged-stable": {
    palette: { c: "#7ee0c8", C: "#c8fff0", d: "#2f8f78", t: "#123a30", b: "#1f3a33", f: "#0f201c", r: "#ff5c48" },
    top: [
      "....kkkkkk....",
      "..kkCCCCCCkk..",
      ".kcCccttcccck.",
      ".kcCctccccdck.",
      ".kcccttcccdck.",
      ".kcccccttcdck.",
      ".kcccctccrdck.",
      ".kcCcttcrcdck.",
      "..kkddddddkk..",
      "....kkkkkk....",
    ],
    legs: [["....kbk.kbk...", "....kfk.kfk..."], ["...kbk...kbk..", "...kfk...kfk.."]],
  },
  slasher: {
    palette: { c: "#3a2a5c", C: "#5f4790", v: "#c9a0ff", V: "#f0e0ff", a: "#c8ccd8", A: "#f4f6fa", t: "#6d431c", b: "#241a3a", f: "#120d1e" },
    top: [
      "AAAA..kkkkkk..",
      "AaaAkkCCCCCCk.",
      "AaaAtkcvvvvck.",
      ".AAttkccccccK.",
      "...ttkkkkkkkk.",
      "...ttkcCCCCcck",
      "....tkcvVVvcck",
      "....kkcvvvvcck",
      ".....kccccccck",
      ".....kkkkkkkkk",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  "tg-scammer": {
    palette: { b: "#2a6f9e", B: "#4ab3e8", w: "#f4f3ee", y: "#ffc23d", f: "#102838", d: "#1c4a6a" },
    top: [
      "...kkkkkkkk...",
      "..kBBBBBBBBk..",
      "..kBkkkkkkBk..",
      "..kBkyskykBk..",
      "..kBksssskBk..",
      "...kkwwwwkk...",
      "..kBBwBBwBBk..",
      ".kBBwBwwBwBBk.",
      ".kBBBwwwwBBBk.",
      ".kddddddddddk.",
      ".kkkkkkkkkkkk.",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  "leverage-degen": {
    palette: { r: "#e0303c", R: "#ff7a6e", y: "#ffc23d", w: "#f4f3ee", b: "#2c2030", f: "#14101a", g: "#3cf07c" },
    top: [
      "...kkkkkkkk...",
      "..kyyyyyyyyk..",
      "..krrrrrrrrk..",
      "..ksseksseks..",
      "..kssssssssk..",
      "..kskwwwwksk..",
      "...kkkkkkkk...",
      "..krRRRRRRrk..",
      ".krrwgwwgwrrk.",
      ".krrwgwgwwrrk.",
      ".krrrrrrrrrrk.",
      ".kkkkkkkkkkkk.",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  frontrunner: {
    palette: { y: "#c9d42a", Y: "#f7ff9a", d: "#7a8614", v: "#1a1c2c", c: "#5de9ff", b: "#25283a", f: "#d8d8e0" },
    top: [
      "....kkkkkk....",
      "...kyYYYYyk...",
      "..kyyyyyyyyk..",
      "..kvvvvvvvvk..",
      "..kvccvvccvk..",
      "..kssssssssk..",
      "...kkkkkkkk...",
      "..kyyYyyyyyk..",
      ".kyyykYkyyyyk.",
      ".kyykYYYkyyyk.",
      ".kyyyyYyyyyyk.",
      ".kddddddddddk.",
      ".kkkkkkkkkkkk.",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  censor: {
    palette: { m: "#a3155c", M: "#ff4f9a", d: "#5a0c33", r: "#ff3a44", w: "#f4f3ee", b: "#2c2030", f: "#14101a" },
    top: [
      ".....kkkk.....",
      "....kMMMMk....",
      "...kmmmmmmk...",
      "..kmmkkkkmmk..",
      "..kmkessekmk..",
      "..kmksssskmk..",
      "...kmkkkkmk...",
      "..kmmmwwmmmk..",
      ".kmmmwrrwmmmk.",
      ".kmmwrwwrwmmk.",
      ".kmmwwrrwwmmk.",
      ".kmmmwwwwmmmk.",
      ".kddddddddddk.",
      ".kkkkkkkkkkkk.",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  "dust-spammer": {
    palette: { t: "#b09a6c", T: "#efe2bf", d: "#6a5a3a", g: "#5a5f70", G: "#9aa0b4", p: "#d8cba4", b: "#3a3328", f: "#e0d6c0" },
    top: [
      "..........kkk.",
      ".........kGGk.",
      "....kkkkkkgk..",
      "...kTTTTTTk...",
      "..kTttttttTk..",
      "..kttekkettk..",
      "..kttttttttk..",
      ".kttptttptttk.",
      ".ktpttttttptk.",
      ".kttttttttttk.",
      ".kddddddddddk.",
      ".kkkkkkkkkkkk.",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
  "boss-attacker": {
    palette: { p: "#2a1a4d", H: "#4a3190", v: "#05030a", r: "#ff2e63", R: "#ffb3c6", c: "#2ee6c7", g: "#f0c14d", G: "#a87b18", b: "#120a22" },
    top: [
      "..........kkkkkkkk..........",
      "........kkHHHHHHHHkk........",
      ".......kHHppppppppHHk.......",
      "......kHppppppppppppHk......",
      ".....kHppkkkkkkkkkkppHk.....",
      ".....kppkvvvvvvvvvvkppk.....",
      ".....kppkvvvvvvvvvvkppk.....",
      ".....kppkvrRvvvvRrvkppk.....",
      ".....kppkvrrvvvvrrvkppk.....",
      ".....kppkvvvvvvvvvvkppk.....",
      ".....kppkvvvvccvvvvkppk.....",
      ".....kpppkvvvvvvvvkpppk.....",
      ".....kHpppkkvvvvkkpppHk.....",
      "....kkHppppkkkkkkppppHkk....",
      "...kkHHpppppRRRRpppppHHkk...",
      "kkkk.kHpppppRppRpppppHk.kkkk",
      "kggk.kpppkggggggggkpppk.kggk",
      "kgGk.kpppkgGGGGGGgkpppk.kGgk",
      "kcgk.kpppkgGccccGgkpppk.kgck",
      "kgGk.kpppkgGGGGGGgkpppk.kGgk",
      "kggk.kpppkggggggggkpppk.kggk",
      "kkkk.kpppkkkkkkkkkkpppk.kkkk",
      "...kppppppppppppppppppppk...",
      "..kHppppppppppppppppppppHk..",
      "..kppppppppppppppppppppppk..",
      ".kppppppppppRppRppppppppppk.",
      ".kHppppppppppppppppppppppHk.",
      "kkppppppppppppppppppppppppkk",
    ],
    legs: [
      [
        "...kppppppppppppppppppppk...",
        "...kpppkkkkkkkkkkkkkkpppk...",
        "...kbbbk............kbbbk...",
        "..kbbbbk............kbbbbk..",
        "..kkkkkk............kkkkkk..",
      ],
      [
        "...kppppppppppppppppppppk...",
        "....kppppkkkkkkkkkkppppk....",
        "....kbbbk..........kbbbk....",
        "...kbbbbk..........kbbbbk...",
        "...kkkkkk..........kkkkkk...",
      ],
    ],
  },
  griefer: {
    palette: { o: "#e8640e", O: "#ffb070", d: "#8a3a08", g: "#2a2c36", r: "#ff3a44", b: "#25283a", f: "#d8d8e0" },
    top: [
      "....kkkkkk....",
      "...koOOOOok...",
      "..kooooooook..",
      "..kokkkkkkok..",
      "..kokessekok..",
      "..koksssskok..",
      "...kokkkkok...",
      "..kooooooook..",
      ".kooookkkoook.",
      ".koookgrgkook.",
      ".kooookkkoook.",
      ".kddddddddddk.",
      ".kkkkkkkkkkkk.",
    ],
    legs: [E_LEGS_A, E_LEGS_B],
  },
};

export function hasHandEnemy(kind: EnemyKind): boolean {
  return !!ENEMIES[kind];
}

export function enemyFrame(kind: EnemyKind, frame: number): HTMLCanvasElement {
  const enemy = ENEMIES[kind]!;
  const f = frame % 2;
  return paintGrid(`enemy-${kind}-${f}`, [...enemy.top, ...enemy.legs[f as 0 | 1]], enemy.palette);
}

export function enemyRows(kind: EnemyKind): number {
  const enemy = ENEMIES[kind]!;
  return enemy.top.length + enemy.legs[0].length;
}

const WALLET_ROWS = [
  "..kkkkkkkkkkkkkkkkkk..",
  ".kLLLLLLLLLLLLLLLLLLk.",
  "kLaaaaaaaaaaaaaaaaaaDk",
  "kaakkkkkkkkkkkkkkkkaDk",
  "kaakeeeeeeeeeeeeeekaDk",
  "kaakeGGGGGGeeGGeeekaDk",
  "kaakeeeeeeeeeeeeeekaDk",
  "kaakkkkkkkkkkkkkkkkaDk",
  "kaaaaaaaaaaaaaaaaaaaDk",
  "kaaaakkkkaaaakkkkaaaDk",
  "kaaaakLLkaaaakLLkaaaDk",
  "kaaaakaakaaaakaakaaaDk",
  "kaaaakkkkaaaakkkkaaaDk",
  "kDDDDDDDDDDDDDDDDDDDDk",
  ".kkkkkkkkkkkkkkkkkkkk.",
];

const CHEST_COLORS: Record<ChestKind, [string, string, string]> = {
  "cold-wallet": ["#3f6fb8", "#8cb8ff", "#21406e"],
  "defi-lootbox": ["#7a4de0", "#c2a4ff", "#452690"],
  "validator-crate": ["#d09a22", "#ffe08a", "#7a5610"],
  "airdrop-pod": ["#1fa890", "#7df2dc", "#0d5c50"],
};

export function chestSprite(kind: ChestKind): HTMLCanvasElement {
  const [a, L, D] = CHEST_COLORS[kind];
  return paintGrid(`chest-${kind}`, WALLET_ROWS, { a, L, D, G: "#2ee6c7" });
}

export function wellSprite(): HTMLCanvasElement {
  return paintGrid(
    "well",
    [
      ".......kkkkkk.......",
      "......kbBBBBbk......",
      "......kbccccbk......",
      "......kbcCCcbk......",
      "......kbccccbk......",
      "......kkkkkkkk......",
      ".......kggggk.......",
      ".......kgGGgk.......",
      ".......kggggk.......",
      ".....kkkkkkkkkk.....",
      "....kgGGGGGGGGgk....",
      "...kkkkkkkkkkkkkk...",
      "..kggrgggbggggbggk..",
      "..kgggggggggggggGk..",
      ".kkkkkkkkkkkkkkkkkk.",
      "kGGGGGGGGGGGGGGGGGGk",
      "kggggggggggggggggggk",
      "kkkkkkkkkkkkkkkkkkkk",
    ],
    { b: "#2c6fb8", B: "#6cb6ff", c: "#a8e0ff", C: "#ffffff", g: "#3a4158", G: "#5c6684", r: "#ff5c48" }
  );
}

const RIGS: Record<SidekickKind, { rows: string[]; palette: Palette }> = {
  "asic-miner": {
    palette: { a: "#8a8f9e", A: "#c8ccd8", d: "#3a3e50", y: "#ffc23d", g: "#2ee6c7" },
    rows: [
      ".kkkkkkkkkkkk.",
      "kAAAAAAAAAAAAk",
      "kadddddddddyak",
      "kadAdAdAdAddak",
      "kaddddddddddak",
      "kadAdAdAdAddak",
      "kagddddddddgak",
      "kkkkkkkkkkkkkk",
      ".kdk......kdk.",
      ".kkk......kkk.",
    ],
  },
  "dev-laptop": {
    palette: { g: "#20242f", G: "#3a4058", c: "#0a2420", m: "#2ee6c7", y: "#ffc23d" },
    rows: [
      "..kkkkkkkkkkkk..",
      "..kGGGGGGGGGGk..",
      "..kGccccccccGk..",
      "..kGcmmmcccccGk.",
      "..kGcccmmmmccGk.",
      "..kGcyyccccccGk.",
      "..kGccccccccGk..",
      "..kkkkkkkkkkkk..",
      ".kGGGGGGGGGGGGk.",
      "kgggggggggggggGk",
      "kkkkkkkkkkkkkkkk",
    ],
  },
  "codebase-guardian": {
    palette: { g: "#7ee787", G: "#c8ffd0", d: "#2f6a3a", e: "#0c1c10" },
    rows: [
      "....kkkkkkkk....",
      "...kGGGGGGGGk...",
      "..kggggggggggk..",
      ".kkgekggggekgkk.",
      "kgkggggggggggkgk",
      "kgkggkkkkkkggkgk",
      ".kkggggggggggkk.",
      "...kdddddddddk..",
      "...kdk....kdk...",
      "...kkk....kkk...",
    ],
  },
  "block-builder": {
    palette: { y: "#f0c14d", Y: "#fff0a0", d: "#8a6510" },
    rows: [
      "..kkkkkkkkkk....",
      ".kYYYYYYYYYYk...",
      "kYyyyyyyyyyydk..",
      "kYyyykkyyyyydk..",
      "kYyyyyykyyyydk..",
      "kYyyykkyyyyydk..",
      "kYyyyyyyyyyydk..",
      "kYyyyyyyyyyydkkk",
      "kddddddddddddkdk",
      ".kkkkkkkkkkkkkkk",
    ],
  },
};

export function rigSprite(kind: SidekickKind): HTMLCanvasElement {
  const rig = RIGS[kind];
  return paintGrid(`rig-${kind}`, rig.rows, rig.palette);
}

export const PICKUP_ART: Record<string, { rows: string[]; palette: Palette }> = {
  xp: {
    palette: { c: "#3fd4f4", C: "#c8f8ff", d: "#1a7a9a" },
    rows: ["...kk...", "..kCck..", ".kCcCck.", "kCccccdk", "kccccddk", ".kccddk.", "..kcdk..", "...kk..."],
  },
  coin: {
    palette: { y: "#ffc23d", Y: "#fff0b0", d: "#a8690f" },
    rows: ["..kkkkk..", ".kYYyyyk.", "kYydddyyk", "kYydyyyyk", "kyyddddyk", "kyyyyydyk", "kyydddyyk", ".kyyyydk.", "..kkkkk.."],
  },
  health: {
    palette: { g: "#7ee787", G: "#d8ffe0", d: "#123a1f" },
    rows: ["kkkkkkkkk", "kdddgdddk", "kdddgdddk", "kdddGdddk", "kgGGGGGgk", "kdddGdddk", "kdddgdddk", "kdddgdddk", "kkkkkkkkk"],
  },
  buff: {
    palette: { p: "#b58cff", P: "#f0e4ff", d: "#3a2458" },
    rows: ["kkkkkkkkk", "kdddPdddk", "kddPPpddk", "kdPPpppdk", "kPPpppppk", "kdPpppddk", "kddpppddk", "kdddpdddk", "kkkkkkkkk"],
  },
  magnet: {
    palette: { b: "#58a6ff", w: "#f4feff" },
    rows: ["kkkk.kkkk", "kwwk.kwwk", "kbbk.kbbk", "kbbk.kbbk", "kbbk.kbbk", "kbbkkkbbk", ".kbbbbbk.", "..kkkkk.."],
  },
};

export function pickupSprite(kind: string): HTMLCanvasElement {
  const art = PICKUP_ART[kind] ?? PICKUP_ART.xp!;
  return paintGrid(`pickup-${kind}`, art.rows, art.palette);
}

const GLYPHS: Record<string, string[]> = {
  R: ["#####.", "##..##", "##..##", "#####.", "##.##.", "##..##", "##..##"],
  E: ["######", "##....", "##....", "#####.", "##....", "##....", "######"],
  V: ["##..##", "##..##", "##..##", "##..##", ".####.", ".####.", "..##.."],
  T: ["######", "..##..", "..##..", "..##..", "..##..", "..##..", "..##.."],
};

export function paintLogo(scale: number): HTMLCanvasElement {
  const word = "REVERT";
  const glyphW = 6;
  const glyphH = 7;
  const gap = 1;
  const w = (word.length * (glyphW + gap) - gap) * scale + scale * 2;
  const h = glyphH * scale + scale * 3;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d")!;
  [...word].forEach((ch, i) => {
    GLYPHS[ch]!.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== "#") continue;
        const px = (i * (glyphW + gap) + x) * scale + scale;
        const py = y * scale + scale;
        c.fillStyle = "#3a0a10";
        c.fillRect(px, py + scale, scale, scale);
        const band = y < 2 ? "#ffd166" : y < 4 ? "#ffb020" : y < 6 ? "#ff6a3c" : "#e0303c";
        c.fillStyle = band;
        c.fillRect(px, py, scale, scale);
        if (y === 0 || row[x - 1] !== "#") {
          c.fillStyle = "rgba(255,255,255,0.35)";
          c.fillRect(px, py, Math.max(1, scale / 4), Math.max(1, scale / 4));
        }
      }
    });
  });
  return canvas;
}
