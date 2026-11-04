import { ACHIEVEMENTS, type AchievementMetric } from "../data/achievements";
import { WIN } from "../data/trace";

export type AchEvent = "kill" | "chest" | "merge" | "pick" | "evolve" | "dash" | "rig" | "cameo" | "event" | "end" | "win" | "endless" | "surge" | "overclock";

export type AchPayload = {
  boss?: boolean;
  solo?: boolean;
  elite?: boolean;
  bounty?: boolean;
  affixes?: number;
  tier?: number;
  level?: number;
  weapons?: number;
  rigs?: number;
  cameo?: string;
  savedPct?: number;
  winTime?: number;
  nightmare?: boolean;
  endlessSec?: number;
  kills?: number;
};

export type Metrics = Record<AchievementMetric, number>;

export const NO_DASH_SEC = 600;
const NONE: string[] = [];

export function emptyMetrics(): Metrics {
  return {
    bosses: 0,
    soloBoss: 0,
    evolved: 0,
    noDash: 0,
    time: 0,
    hardTime: 0,
    rigs: 0,
    merges: 0,
    mergeTier: 0,
    cameoKinds: 0,
    chests: 0,
    kills: 0,
    weapons: 0,
    level: 0,
    whales: 0,
    bounties: 0,
    savedPct: 0,
    events: 0,
    affixWhale: 0,
    won: 0,
    winFast: 0,
    winNightmare: 0,
    endlessTime: 0,
    surges: 0,
    overclockKills: 0,
  };
}

export function evaluate(metrics: Metrics, owned: ReadonlySet<string>): string[] {
  let out = NONE;
  for (const a of ACHIEVEMENTS) {
    if (owned.has(a.id) || metrics[a.metric] < a.target) continue;
    if (out === NONE) out = [];
    out.push(a.id);
  }
  return out;
}

export class RunTracker {
  readonly metrics = emptyMetrics();
  private dashes = 0;
  private cameos = new Set<string>();

  constructor(private hard = false) {}

  apply(event: AchEvent, time: number, p: AchPayload): void {
    const m = this.metrics;
    m.time = Math.max(m.time, time);
    if (this.hard) m.hardTime = m.time;
    switch (event) {
      case "kill":
        m.kills++;
        if (p.boss) {
          m.bosses++;
          if (p.solo) m.soloBoss = 1;
        }
        if (p.elite && !p.boss) {
          if (p.bounty) m.bounties++;
          else m.whales++;
          m.affixWhale = Math.max(m.affixWhale, p.affixes ?? 0);
        }
        break;
      case "chest":
        m.chests++;
        break;
      case "merge":
        m.merges++;
        m.mergeTier = Math.max(m.mergeTier, p.tier ?? 0);
        break;
      case "pick":
        m.level = Math.max(m.level, p.level ?? 0);
        m.weapons = Math.max(m.weapons, p.weapons ?? 0);
        break;
      case "evolve":
        m.evolved++;
        break;
      case "dash":
        this.dashes++;
        break;
      case "rig":
        m.rigs = Math.max(m.rigs, p.rigs ?? 0);
        break;
      case "cameo":
        if (p.cameo && p.cameo !== "satoshi") this.cameos.add(p.cameo);
        m.cameoKinds = this.cameos.size;
        break;
      case "event":
        m.events++;
        break;
      case "end":
        m.savedPct = Math.max(m.savedPct, p.savedPct ?? 0);
        break;
      case "win":
        m.won = 1;
        if ((p.winTime ?? Infinity) < WIN.fastSec) m.winFast = 1;
        if (p.nightmare) m.winNightmare = 1;
        break;
      case "surge":
        m.surges++;
        break;
      case "overclock":
        m.overclockKills = Math.max(m.overclockKills, p.kills ?? 0);
        break;
      case "endless":
        m.endlessTime = Math.max(m.endlessTime, p.endlessSec ?? 0);
        break;
    }
    if (this.dashes === 0 && m.time >= NO_DASH_SEC) m.noDash = 1;
  }

  step(event: AchEvent, time: number, p: AchPayload, owned: ReadonlySet<string>): string[] {
    this.apply(event, time, p);
    return evaluate(this.metrics, owned);
  }
}
