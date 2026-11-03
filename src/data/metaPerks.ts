export type MetaPerkId = "edge" | "vault" | "reorg" | "blocklist" | "seed" | "magnet" | "alpha";

export type MetaPerkEffect = {
  damage?: number;
  maxHp?: number;
  rerolls?: number;
  banishes?: number;
  coins?: number;
  pickup?: number;
  xp?: number;
};

export type MetaPerkDef = {
  id: MetaPerkId;
  name: string;
  desc: string;
  maxRank: number;
  baseCost: number;
  costStep: number;
  perRank: MetaPerkEffect;
};

export type MetaPerkRanks = Partial<Record<MetaPerkId, number>>;

export const MAX_TOTAL_RANKS = 12;

export const META_PERKS: MetaPerkDef[] = [
  { id: "edge", name: "Sharpened Keys", desc: "+3% damage per rank.", maxRank: 5, baseCost: 20, costStep: 20, perRank: { damage: 0.03 } },
  { id: "vault", name: "Cold Vault", desc: "+6 max HP per rank.", maxRank: 5, baseCost: 20, costStep: 20, perRank: { maxHp: 6 } },
  { id: "reorg", name: "Spare Reorg", desc: "+1 card reroll per rank.", maxRank: 2, baseCost: 35, costStep: 40, perRank: { rerolls: 1 } },
  { id: "blocklist", name: "Blocklist", desc: "+1 card banish per rank.", maxRank: 2, baseCost: 35, costStep: 40, perRank: { banishes: 1 } },
  { id: "seed", name: "Seed Round", desc: "Start with +15 $SAFU per rank.", maxRank: 3, baseCost: 15, costStep: 20, perRank: { coins: 15 } },
  { id: "magnet", name: "Wide Mempool", desc: "+10% pickup radius per rank.", maxRank: 3, baseCost: 15, costStep: 15, perRank: { pickup: 0.1 } },
  { id: "alpha", name: "Alpha Leak", desc: "+4% XP per rank.", maxRank: 4, baseCost: 20, costStep: 20, perRank: { xp: 0.04 } },
];

export const META_PERK_BY_ID = Object.fromEntries(META_PERKS.map((p) => [p.id, p])) as Record<MetaPerkId, MetaPerkDef>;

export function isMetaPerkId(id: string): id is MetaPerkId {
  return Object.prototype.hasOwnProperty.call(META_PERK_BY_ID, id);
}

export function totalRanks(ranks: MetaPerkRanks): number {
  let total = 0;
  for (const def of META_PERKS) total += ranks[def.id] ?? 0;
  return total;
}

export function clampPerks(raw: unknown): MetaPerkRanks {
  const out: MetaPerkRanks = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const source = raw as Record<string, unknown>;
  let budget = MAX_TOTAL_RANKS;
  for (const def of META_PERKS) {
    if (!Object.prototype.hasOwnProperty.call(source, def.id)) continue;
    const value = source[def.id];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const rank = Math.min(def.maxRank, budget, Math.max(0, Math.floor(value)));
    if (rank <= 0) continue;
    out[def.id] = rank;
    budget -= rank;
  }
  return out;
}

export function perksAreValid(raw: unknown): raw is MetaPerkRanks {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const entries = Object.entries(raw as Record<string, unknown>);
  for (const [id, value] of entries) {
    if (!isMetaPerkId(id) || typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > META_PERK_BY_ID[id].maxRank) return false;
  }
  return totalRanks(raw as MetaPerkRanks) <= MAX_TOTAL_RANKS;
}

export function perkCost(id: MetaPerkId, rank: number): number {
  const def = META_PERK_BY_ID[id];
  return def.baseCost + def.costStep * rank;
}

export function spentOn(ranks: MetaPerkRanks): number {
  let total = 0;
  for (const def of META_PERKS) for (let r = 0; r < (ranks[def.id] ?? 0); r++) total += perkCost(def.id, r);
  return total;
}

export type BuyCheck = { ok: true; cost: number } | { ok: false; reason: "max-rank" | "cap" | "shards"; cost: number };

export function canBuyPerk(ranks: MetaPerkRanks, shards: number, id: MetaPerkId): BuyCheck {
  const rank = ranks[id] ?? 0;
  const cost = perkCost(id, rank);
  if (rank >= META_PERK_BY_ID[id].maxRank) return { ok: false, reason: "max-rank", cost };
  if (totalRanks(ranks) >= MAX_TOTAL_RANKS) return { ok: false, reason: "cap", cost };
  if (shards < cost) return { ok: false, reason: "shards", cost };
  return { ok: true, cost };
}

export function perkTotals(ranks: MetaPerkRanks): Required<MetaPerkEffect> {
  const sum: Required<MetaPerkEffect> = { damage: 0, maxHp: 0, rerolls: 0, banishes: 0, coins: 0, pickup: 0, xp: 0 };
  const clean = clampPerks(ranks);
  for (const def of META_PERKS) {
    const rank = clean[def.id] ?? 0;
    for (const key of Object.keys(def.perRank) as (keyof MetaPerkEffect)[]) sum[key] += (def.perRank[key] ?? 0) * rank;
  }
  return sum;
}

export type ShardInput = { timeSec: number; baseScore: number; bosses: number; tainted: boolean; shardMult: number };

export const MAX_SHARDS_PER_RUN = 400;

export function shardsForRun(run: ShardInput): number {
  if (run.tainted) return 0;
  const raw = (Math.max(0, run.timeSec) / 60) * 2 + Math.max(0, run.baseScore) / 1500 + Math.max(0, run.bosses) * 4;
  return Math.min(MAX_SHARDS_PER_RUN, Math.floor(raw * Math.max(0, run.shardMult)));
}
