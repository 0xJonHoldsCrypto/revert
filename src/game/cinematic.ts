import type { EnemyKind } from "../types";

export type Cinematic = {
  kind: "landing" | "boss";
  t: number;
  flash: number;
  step: number;
  bossId?: number;
  bossKind?: EnemyKind;
};

export const LANDING_TIMELINE = { flashFade: 0.55, drop: 0.85, skitter: 1.35, speedLines: 0.8, end: 1.8 };

export const BOSS_TIMELINE = {
  barsIn: 0.25,
  drop: 1.15,
  impact: 1.32,
  taunt: 1.7,
  tauntHold: 2.4,
  barsOut: 0.35,
  typeCps: 40,
};

export type BossGimmick = "rewind" | "salute" | "modal" | "prices" | "pdf" | "halt";

export const BOSS_ENTRANCES: Partial<Record<EnemyKind, { title: string; line: string; gimmick: BossGimmick }>> = {
  "boss-mev-king": { title: "The Block Builder", line: "I saw that coming. Literally. I am one slot ahead of you.", gimmick: "rewind" },
  "boss-lazarus-414": { title: "Withdrawal Division", line: "We mapped your withdrawal flow in March. Nobody read the ticket.", gimmick: "salute" },
  "boss-phish-king": { title: "Trusted Popup", line: "Relax. It only needs unlimited approval. Everybody signs.", gimmick: "modal" },
  "boss-oracle": { title: "Price Is A Suggestion", line: "Your collateral is worth whatever I say it is. Today: nothing.", gimmick: "prices" },
  "boss-apt38": { title: "Senior Recruiter", line: "Loved your GitHub. Please open the attached offer letter.", gimmick: "pdf" },
  "boss-grandmaster": { title: "The Final Patch", line: "Blocks stop when I say so. Say goodbye to finality.", gimmick: "halt" },
};
