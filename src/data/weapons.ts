import type { WeaponDef, WeaponKind } from "../types";

export const WEAPONS: Record<WeaponKind, WeaponDef> = {
  "audit-dart": {
    kind: "audit-dart",
    name: "Audit Dart",
    description: "Homing shots. Every third hit on the same target crits for triple.",
    damage: 13,
    cooldown: 0.5,
    range: 420,
    rarity: "common",
    projectileSpeed: 520,
    pierce: 1,
    maxLevel: 8,
  },
  "reorg-whip": {
    kind: "reorg-whip",
    name: "Reorg Whip",
    description: "A 120-degree slash at the nearest attacker. Your back stays open. Keel doubles every third swing.",
    damage: 26,
    cooldown: 0.85,
    range: 170,
    rarity: "rare",
    aoe: 165,
    maxLevel: 8,
  },
  "finality-beam": {
    kind: "finality-beam",
    name: "Finality Beam",
    description: "Instant line at the nearest attacker. +15% per second without taking a hit, up to six.",
    damage: 26,
    cooldown: 0.8,
    range: 420,
    rarity: "uncommon",
    projectileSpeed: 680,
    pierce: 4,
    maxLevel: 8,
  },
  "stable-shield": {
    kind: "stable-shield",
    name: "Stablecoin Shield",
    description: "Orbiting coins catch enemy bullets and fire them back at the nearest attacker for heavy damage. A coin rests 1 second after a catch.",
    damage: 16,
    cooldown: 0.35,
    range: 150,
    rarity: "uncommon",
    orbit: true,
    maxLevel: 8,
  },
  "patch-burst": {
    kind: "patch-burst",
    name: "Hotfix Burst",
    description: "A full ring of patches. Also fires at +50% when you get hit or finish a dash.",
    damage: 18,
    cooldown: 1.1,
    range: 380,
    rarity: "epic",
    projectileSpeed: 440,
    pierce: 0,
    maxLevel: 8,
  },
  "rug-coin": {
    kind: "rug-coin",
    name: "Rug Pull Coin",
    description: "Damage climbs for 8 seconds, then the coin rugs: a blast where it is, then 6 seconds offline.",
    damage: 36,
    cooldown: 0.4,
    range: 130,
    rarity: "common",
    orbit: true,
    maxLevel: 8,
  },
  "memo-pulse": {
    kind: "memo-pulse",
    name: "Mempool Pulse",
    description: "Waits for a crowd. The more attackers close in, the harder it hits.",
    damage: 13,
    cooldown: 0.35,
    range: 230,
    rarity: "legendary",
    aoe: 230,
    maxLevel: 6,
  },
  "flash-loan": {
    kind: "flash-loan",
    name: "Flash Loan",
    description: "Drops a marker. Touch it within 2.6s for a triple blast and instant reload. Miss it and you lose 5% HP.",
    damage: 40,
    cooldown: 1.6,
    range: 190,
    rarity: "rare",
    aoe: 185,
    maxLevel: 8,
  },
  "validator-seal": {
    kind: "validator-seal",
    name: "Validator Seal",
    description: "Drops a seal at your feet. Lines between seals damage anything that crosses them.",
    damage: 16,
    cooldown: 3.6,
    range: 145,
    rarity: "epic",
    maxLevel: 8,
  },
  "bridge-bolt": {
    kind: "bridge-bolt",
    name: "Bridge Bolt",
    description: "A live line from you to where you were 1.5 seconds ago. Run around a crowd to cut it.",
    damage: 32,
    cooldown: 0.5,
    range: 520,
    rarity: "rare",
    projectileSpeed: 740,
    pierce: 5,
    maxLevel: 8,
  },
  "nonce-shard": {
    kind: "nonce-shard",
    name: "Nonce Shard",
    description: "A 50-degree fan of shards aimed at the nearest attacker.",
    damage: 14,
    cooldown: 0.95,
    range: 360,
    rarity: "uncommon",
    projectileSpeed: 480,
    pierce: 0,
    maxLevel: 8,
  },
  "pager-ping": { kind: "pager-ping", name: "Incident Pager", description: "A page that jumps from attacker to attacker.", damage: 16, cooldown: 0.9, range: 340, rarity: "uncommon", maxLevel: 8 },
  "honeypot-trap": { kind: "honeypot-trap", name: "Honeypot Trap", description: "Drops a charge that pulls nearby attackers in, then blows.", damage: 34, cooldown: 2, range: 130, rarity: "uncommon", aoe: 130, maxLevel: 8 },
  "oracle-strike": { kind: "oracle-strike", name: "Oracle Strike", description: "Calls a blast on the densest crowd in range. Doubles while prices are being faked.", damage: 22, cooldown: 1.25, range: 480, rarity: "rare", aoe: 95, maxLevel: 8 },
  "merkle-proof": { kind: "merkle-proof", name: "Merkle Proof", description: "Flies out and back. Anything hit on both legs takes double on the return.", damage: 18, cooldown: 1.15, range: 330, rarity: "rare", projectileSpeed: 420, maxLevel: 8 },
  "slashing-field": { kind: "slashing-field", name: "Slashing Field", description: "An aura that makes attackers take 25% more from everything. Grows while you stand still.", damage: 11, cooldown: 0.45, range: 115, rarity: "uncommon", aoe: 115, maxLevel: 8 },
  "whale-alert": { kind: "whale-alert", name: "Whale Alert", description: "A fast, heavy shot at the toughest attacker in range. Double damage to bosses and whales.", damage: 62, cooldown: 2.1, range: 620, rarity: "epic", projectileSpeed: 980, pierce: 2, maxLevel: 8 },
  "keeper-bot": { kind: "keeper-bot", name: "Keeper Bot", description: "Closes out attackers in range that drop under 15% HP, outright. Nobody that low? It nicks the weakest one.", damage: 30, cooldown: 0.6, range: 320, rarity: "rare", maxLevel: 8 },
  "air-gap-vault": { kind: "air-gap-vault", name: "Air-Gap Vault", description: "A vault circles you and shoves off any attacker it touches. Every 8 shoves it bursts and freezes everything nearby.", damage: 16, cooldown: 0.2, range: 120, rarity: "uncommon", aoe: 180, maxLevel: 8 },
  "infinite-approval": { kind: "infinite-approval", name: "Infinite Approval", description: "Tags attackers with a drain that ticks for 4 seconds. When a drained attacker dies, the drain jumps to the two nearest.", damage: 6, cooldown: 1.2, range: 360, rarity: "epic", maxLevel: 8 },
};

export const EVOLUTIONS: Record<WeaponKind, { name: string; blurb: string; needs: string }> = {
  "audit-dart": { name: "Formal Verification", blurb: "Fires twin homing darts.", needs: "perk-crit" },
  "reorg-whip": { name: "Chain Split", blurb: "Slashes in front and behind at once.", needs: "damage-up" },
  "finality-beam": { name: "Blob Tunnel", blurb: "Three beams.", needs: "perk-pierce" },
  "stable-shield": { name: "Peg Defense", blurb: "Two more coins, and they rest only half a second after a catch.", needs: "armor-up" },
  "patch-burst": { name: "Patch Storm", blurb: "Four more patches per ring.", needs: "perk-dash-blast" },
  "rug-coin": { name: "Liquidity Exit", blurb: "Two more coins.", needs: "power-launchpool" },
  "memo-pulse": { name: "Block Storm", blurb: "A second, wider pulse follows each one.", needs: "perk-area" },
  "flash-loan": { name: "Atomic Arb", blurb: "Defaults cost nothing, and repaying adds a second blast.", needs: "cooldown-up" },
  "validator-seal": { name: "Finality Ring", blurb: "One more seal in the ring.", needs: "perk-regen" },
  "bridge-bolt": { name: "Light Client", blurb: "The line extends along your last two seconds.", needs: "speed-up" },
  "nonce-shard": { name: "Replacement Flood", blurb: "Three more shards, and they home.", needs: "perk-multishot" },
  "pager-ping": { name: "All Hands", blurb: "The page reaches three more attackers.", needs: "perk-xp" },
  "honeypot-trap": { name: "Honeypot Field", blurb: "Three charges per drop.", needs: "perk-kill-blast" },
  "oracle-strike": { name: "Oracle Cascade", blurb: "Three strikes per call.", needs: "power-price-feed" },
  "merkle-proof": { name: "Merkle Forest", blurb: "Three proofs in a wide spread.", needs: "pickup-up" },
  "slashing-field": { name: "Mass Slashing", blurb: "The aura grows by a third.", needs: "perk-thorns" },
  "whale-alert": { name: "Whale Hunt", blurb: "Two extra shots at the next toughest targets.", needs: "bug-bounty" },
  "keeper-bot": { name: "Keeper Network", blurb: "Closes out under 25% more HP, and every close-out blasts the attackers around it.", needs: "perk-coin" },
  "air-gap-vault": { name: "Deep Freeze", blurb: "Bursts every 5 shoves, and the burst hits frozen attackers for triple.", needs: "hp-up" },
  "infinite-approval": { name: "Unlimited Allowance", blurb: "The drain jumps to four and ticks twice as fast.", needs: "private-flow" },
};

export const EVOLVED_DAMAGE_MULT = 1.3;
export const EVOLVED_COOLDOWN_MULT = 0.92;
export const KEEPER_EVOLVED_BONUS = 0.1;
export const VAULT_SHOVES = 8;
export const VAULT_EVOLVED_SHOVES = 5;
export const VAULT_FREEZE_SEC = 1.4;
export const APPROVAL_SPREAD = 2;
export const APPROVAL_EVOLVED_SPREAD = 4;

export function keeperThreshold(level: number, evolved = false): number {
  return 0.15 + (Math.max(1, level) - 1) * 0.01 + (evolved ? KEEPER_EVOLVED_BONUS : 0);
}

export function keeperCloses(level: number): number {
  return 1 + Math.floor(Math.max(1, level) / 3);
}

export function approvalTags(level: number): number {
  return 1 + Math.floor(Math.max(1, level) / 3);
}

export function toolTrait(kind: WeaponKind, level: number): string | null {
  if (kind === "keeper-bot") return `Closes out under ${Math.round(keeperThreshold(level) * 100)}% HP, ${keeperCloses(level)} per tick`;
  if (kind === "air-gap-vault") return `Bursts every ${VAULT_SHOVES} shoves, freezes ${VAULT_FREEZE_SEC}s`;
  if (kind === "infinite-approval") return `Tags ${approvalTags(level)} per cast, jumps to ${APPROVAL_SPREAD}`;
  return null;
}

export function toolTraitLine(kind: WeaponKind, level: number): string | null {
  if (kind === "keeper-bot") return `Close-out ${Math.round(keeperThreshold(level) * 100)}% → ${Math.round(keeperThreshold(level + 1) * 100)}% HP, ${keeperCloses(level)} → ${keeperCloses(level + 1)} per tick`;
  if (kind === "infinite-approval") return `Tags ${approvalTags(level)} → ${approvalTags(level + 1)} per cast`;
  return toolTrait(kind, level);
}

export function weaponAtLevel(kind: WeaponKind, level: number): WeaponDef {
  const base = WEAPONS[kind];
  const lv = Math.max(1, level);
  return {
    ...base,
    damage: base.damage * (1 + (lv - 1) * 0.18),
    cooldown: base.cooldown * Math.max(0.45, 1 - (lv - 1) * 0.06),
    pierce: base.pierce !== undefined ? base.pierce + Math.floor((lv - 1) / 2) : undefined,
    range: base.range * (1 + (lv - 1) * 0.05),
    aoe: base.aoe ? base.aoe * (1 + (lv - 1) * 0.08) : undefined,
  };
}
