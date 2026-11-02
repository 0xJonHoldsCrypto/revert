export type MusicTrackId = "title" | "intro" | "mempool" | "vault" | "bridge" | "forest" | "boss" | "win" | "gameOver";

export type TrackDef = {
  bpm: number;
  lead: string;
  arp: string;
  bass: string;
  drums: string;
  loop: boolean;
};

const r = (text: string, times: number) => Array(times).fill(text).join(" ");

const FOUR_ON_FLOOR = "k . h . s . h . k . h k s . h .";
const HALF_TIME = "k . . h . . h . s . . h . . h .";
const DRIVE = "k h h k s h k h k h h k s h s s";
const SPARSE = "k . . . . . . . s . . . . . . .";

export const TRACKS: Record<MusicTrackId, TrackDef> = {
  title: {
    bpm: 84,
    lead: `${r(".", 16)} E5 . . . D5 . . . B4 . . . . . . .`,
    arp: "A3 . E4 . A4 . E4 . F3 . C4 . F4 . C4 . G3 . D4 . G4 . D4 . E3 . B3 . E4 . B3 .",
    bass: "A1 . . . . . . . F1 . . . . . . . G1 . . . . . . . E1 . . . . . . .",
    drums: `${r(SPARSE, 2)}`,
    loop: true,
  },
  intro: {
    bpm: 124,
    lead: `${r(".", 32)} A4 . C5 . E5 . A5 . G5 . E5 . C5 . D5 . E5 E5 . E5 G5 . A5 . C6 . A5 G5 E5 . D5 .`,
    arp: `${r("A3 C4 E4 C4", 4)} ${r("F3 A3 C4 A3", 2)} ${r("G3 B3 D4 B3", 2)} ${r("A3 C4 E4 C4", 4)} ${r("F3 A3 C4 A3", 2)} ${r("G3 B3 D4 B3", 2)}`,
    bass: `${r("A1 . A1 . A1 . A2 .", 2)} F1 . F1 . F2 . F1 . G1 . G1 . G2 . G1 . ${r("A1 . A1 A2 A1 . A2 A1", 2)} F1 . F1 F2 F1 . F2 F1 G1 . G1 G2 G1 . G2 B1`,
    drums: `${r(HALF_TIME, 2)} ${r(FOUR_ON_FLOOR, 2)}`,
    loop: true,
  },
  mempool: {
    bpm: 128,
    lead: "E5 . . G5 . . A5 . . . G5 . E5 . D5 . E5 . . . . . . . B4 . D5 . E5 . . . C5 . . E5 . . G5 . . . A5 . G5 . E5 . D5 . . C5 . D5 . E5 . . . . . . . . .",
    arp: `${r("E4 G4 B4 G4", 4)} ${r("C4 E4 G4 E4", 4)} ${r("D4 F#4 A4 F#4", 4)} ${r("E4 G4 B4 G4", 4)}`,
    bass: `${r("E2 . E2 E3", 4)} ${r("C2 . C2 C3", 4)} ${r("D2 . D2 D3", 4)} ${r("E2 . E2 E3", 4)}`,
    drums: r(FOUR_ON_FLOOR, 4),
    loop: true,
  },
  vault: {
    bpm: 134,
    lead: "A4 . A4 C5 . A4 . G4 . A4 . . . . E5 . D5 . C5 . A4 . G4 . A4 . . . . . . . A4 . A4 C5 . A4 . G4 . F4 . . . . G4 . A4 . C5 . E5 . D#5 . E5 . . . . . . .",
    arp: `${r("A3 A4 E4 A4", 4)} ${r("F3 F4 C4 F4", 4)} ${r("A3 A4 E4 A4", 4)} ${r("G3 G4 D4 G4", 4)}`,
    bass: `${r("A1 A1 . A1 A2 . A1 .", 2)} ${r("F1 F1 . F1 F2 . F1 .", 2)} ${r("A1 A1 . A1 A2 . A1 .", 2)} ${r("G1 G1 . G1 G2 . G1 .", 2)}`,
    drums: r(DRIVE, 4),
    loop: true,
  },
  bridge: {
    bpm: 118,
    lead: "D5 . . F5 . A5 . . G5 . F5 . E5 . . . C5 . . E5 . G5 . . A5 . . . . . . . D5 . . F5 . A5 . . C6 . A5 . G5 . . . A#5 . A5 . G5 . F5 . E5 . . . . . . .",
    arp: `${r("D4 F4 A4 D5", 4)} ${r("C4 E4 G4 C5", 4)} ${r("A#3 D4 F4 A#4", 4)} ${r("A3 C#4 E4 A4", 4)}`,
    bass: `${r("D2 . . D2 . . D3 .", 2)} ${r("C2 . . C2 . . C3 .", 2)} ${r("A#1 . . A#1 . . A#2 .", 2)} ${r("A1 . . A1 . . A2 .", 2)}`,
    drums: r(HALF_TIME, 4),
    loop: true,
  },
  forest: {
    bpm: 96,
    lead: `F#4 . . . . . A4 . G#4 . . . . . . . ${r(".", 16)} C#5 . . . . . B4 . A4 . . . G#4 . . . ${r(".", 16)}`,
    arp: `${r("F#3 . C#4 .", 8)} ${r("D3 . A3 .", 4)} ${r("C#3 . G#3 .", 4)}`,
    bass: `${r("F#1 . . . . . . .", 4)} ${r("D1 . . . . . . .", 2)} ${r("C#1 . . . . . . .", 2)}`,
    drums: r(SPARSE, 4),
    loop: true,
  },
  boss: {
    bpm: 150,
    lead: "A5 G#5 A5 E5 . C5 D5 E5 A5 G#5 A5 C6 . B5 A5 G#5 F5 E5 F5 C5 . A4 B4 C5 E5 D#5 E5 B5 . G#5 F#5 E5",
    arp: `${r("A3 C4 E4 A4", 2)} ${r("F3 A3 C4 F4", 1)} ${r("E3 G#3 B3 E4", 1)}`,
    bass: "A1 A2 A1 A1 A2 A1 A1 A2 A1 A2 A1 A1 A2 A1 A2 A2 F1 F2 F1 F1 F2 F1 F1 F2 E1 E2 E1 E1 E2 G#1 B1 E2",
    drums: r("k h s h k k s h k h s h k s s s", 2),
    loop: true,
  },
  win: {
    bpm: 112,
    lead: "C5 . E5 . G5 . C6 . B5 . G5 . A5 . . . F5 . A5 . C6 . E6 . D6 . C6 . G5 . . . C6 . . . . . . . . . . . . . . .",
    arp: `${r("C4 E4 G4 E4", 2)} ${r("F4 A4 C5 A4", 2)} ${r("C4 G4 C5 G4", 3)} C4 . . .`,
    bass: "C2 . C2 . G2 . C2 . F2 . F2 . C2 . F2 . C2 . C2 . G2 . C2 . E2 . G2 . C2 . . . . . . . . .",
    drums: r(FOUR_ON_FLOOR, 2) + " " + r(".", 8),
    loop: true,
  },
  gameOver: {
    bpm: 72,
    lead: "A4 . . . G4 . . . F4 . . . E4 . . . D4 . . . C4 . . . B3 . . . A3 . . .",
    arp: `${r(".", 32)}`,
    bass: "A1 . . . . . . . F1 . . . . . . . D1 . . . . . . . E1 . . . . . . .",
    drums: r(".", 32),
    loop: false,
  },
};

const SEMITONE: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

export function noteFrequency(note: string): number {
  const name = note.slice(0, -1);
  const octave = Number(note.slice(-1));
  const midi = (octave + 1) * 12 + (SEMITONE[name] ?? 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function parsePattern(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
