export type AffixId = "shielded" | "splitting" | "hasted" | "volatile" | "mender" | "vampiric";

export type AffixDef = {
  id: AffixId;
  name: string;
  tag: string;
  color: string;
  desc: string;
};

export const AFFIXES: Record<AffixId, AffixDef> = {
  shielded: { id: "shielded", name: "Shielded", tag: "SHIELD", color: "#79c0ff", desc: "A barrier soaks the first 30% of its HP and comes back after 5 seconds without a hit." },
  splitting: { id: "splitting", name: "Splitting", tag: "SPLIT", color: "#ff9de2", desc: "Dies into three smaller copies of itself." },
  hasted: { id: "hasted", name: "Hasted", tag: "HASTE", color: "#6ff7ff", desc: "Moves 45% faster." },
  volatile: { id: "volatile", name: "Volatile", tag: "VOLATILE", color: "#ff5c48", desc: "Blows up a second after it dies. Do not stand on the body." },
  mender: { id: "mender", name: "Mender", tag: "MENDER", color: "#7ee787", desc: "Heals every attacker near it, a little each second." },
  vampiric: { id: "vampiric", name: "Vampiric", tag: "VAMPIRIC", color: "#c43f8f", desc: "Heals itself whenever it hits you." },
};

export const AFFIX_ORDER: AffixId[] = ["shielded", "splitting", "hasted", "volatile", "mender", "vampiric"];

export const SHIELD_SHARE = 0.3;
export const SHIELD_REGEN_SEC = 5;
export const HASTE_MULT = 1.45;
export const SPLIT_COUNT = 3;
export const SPLIT_HP_SHARE = 0.12;
export const VOLATILE_RADIUS = 125;
export const VOLATILE_FUSE_SEC = 1;
export const MENDER_RADIUS = 190;
export const MENDER_SHARE_PER_SEC = 0.04;
export const VAMPIRE_HEAL_SHARE = 0.08;
export const DOUBLE_AFFIX_TIME_SEC = 480;

export function rollAffixes(elapsed: number, rnd: () => number): AffixId[] {
  const count = elapsed >= DOUBLE_AFFIX_TIME_SEC ? 2 : 1;
  const pool = [...AFFIX_ORDER];
  const out: AffixId[] = [];
  for (let i = 0; i < count && pool.length; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]!);
  return out;
}
