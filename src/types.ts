export type SidekickKind = "asic-miner" | "dev-laptop" | "codebase-guardian" | "block-builder";

export type TimedBuffKind = import("./data/timedBuffs").TimedBuffKind;

export type WellStatId = import("./data/wells").WellStatId;

export type GamePhase = "menu" | "cutscene" | "cinematic" | "playing" | "levelup" | "paused" | "lost";

export type CharacterId = "keel" | "nyx" | "diff" | "trace";

export type EnemyKind =
  | "script-kiddie"
  | "phishing-bot"
  | "shadow-op"
  | "bridge-drainer"
  | "rug-dev"
  | "mev-searcher"
  | "oracle-manipulator"
  | "sim-swapper"
  | "insider"
  | "airdrop-farmer"
  | "sybil"
  | "sybil-mini"
  | "liquidator"
  | "gas-guzzler"
  | "flash-bot"
  | "pump-bot"
  | "wash-trader"
  | "honeypot-mimic"
  | "jpeg-flipper"
  | "bot-farm"
  | "depegged-stable"
  | "slasher"
  | "tg-scammer"
  | "leverage-degen"
  | "boss-shill"
  | "boss-rug-baron"
  | "boss-gas-golem"
  | "boss-unit-414"
  | "boss-phish-king"
  | "boss-nightdesk"
  | "boss-grandmaster"
  | "boss-mev-king"
  | "boss-oracle";

export type WeaponKind =
  | "audit-dart"
  | "reorg-whip"
  | "finality-beam"
  | "stable-shield"
  | "patch-burst"
  | "rug-coin"
  | "memo-pulse"
  | "flash-loan"
  | "validator-seal"
  | "bridge-bolt"
  | "nonce-shard"
  | "pager-ping"
  | "honeypot-trap"
  | "oracle-strike"
  | "merkle-proof"
  | "slashing-field"
  | "whale-alert";

export interface CharacterDef {
  id: CharacterId;
  name: string;
  emoji: string;
  role: string;
  blurb: string;
  color: string;
  accent: string;
  maxHp: number;
  moveSpeed: number;
  damageMult: number;
  xpMult: number;
  dashCooldown: number;
  startWeapon: WeaponKind;
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  emoji: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  color: string;
  isBoss?: boolean;
  contactCooldown?: number;
}

import type { WeaponRarity } from "./data/rarity";
import type { GearId, GearSlot } from "./data/gear";
import type { AbilityId } from "./data/abilities";
import type { CameoId } from "./data/cameos";

export type { WeaponRarity };

export interface WeaponDef {
  kind: WeaponKind;
  name: string;
  description: string;
  damage: number;
  cooldown: number;
  range: number;
  rarity: WeaponRarity;
  projectileSpeed?: number;
  orbit?: boolean;
  pierce?: number;
  aoe?: number;
  maxLevel: number;
}

export interface UpgradeDef {
  id: string;
  title: string;
  description: string;
  rarity?: WeaponRarity;
  apply: (ctx: UpgradeContext) => boolean;
  maxTimes?: number;
}

export type PerkId = "pierce" | "multishot" | "area" | "crit" | "regen" | "thorns" | "dashBlast" | "dashCooldown" | "xp" | "coin" | "killBlast" | "abilityCooldown" | "revive" | "rerolls";

export interface UpgradeContext {
  addWeapon: (kind: WeaponKind, rarity?: WeaponRarity) => void;
  upgradeWeapon: (kind: WeaponKind) => void;
  heal: (amount: number) => void;
  boostStat: (stat: "damage" | "speed" | "pickup" | "armor" | "cooldown" | "yield", amount: number) => void;
  special: (id: "leverage" | "flash-loan" | "multisig") => void;
  perk: (id: PerkId, amount: number) => void;
  hasWeapon: (kind: WeaponKind) => boolean;
  weaponCount: () => number;
  weaponLevel: (kind: WeaponKind) => number;
  weaponEvolved: (kind: WeaponKind) => boolean;
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  px?: number;
  py?: number;
  lift?: number;
  vx: number;
  vy: number;
  radius: number;
  dead: boolean;
}

export interface PlayerState extends Entity {
  characterId: CharacterId;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  invuln: number;
  dashCooldown: number;
  dashTimer: number;
  facing: number;
  damageMult: number;
  xpMult: number;
  moveSpeed: number;
  pickupRadius: number;
  armor: number;
  cooldownMult: number;
  yieldPerSec: number;
  coins: number;
  sidekick: SidekickKind | null;
  activeBuffs: { kind: TimedBuffKind; until: number }[];
  wellBonusArmor: number;
  gear: Partial<Record<GearSlot, GearId>>;
  ability: AbilityId | null;
  abilityReadyAt: number;
  shieldUntil: number;
  neverSellUntil: number;
}

export interface Hazard {
  shape: "circle" | "rect" | "beam";
  x: number;
  y: number;
  r?: number;
  w?: number;
  h?: number;
  angle?: number;
  spin?: number;
  length?: number;
  t: number;
  windup: number;
  active: number;
  damage: number;
  color: string;
  source: EnemyKind;
  knock: number;
  label?: string;
  follow?: number;
  fired?: boolean;
  dead?: boolean;
  bars?: { w: number; h: number; vertical: boolean };
}

export interface Enemy extends Entity {
  kx?: number;
  ky?: number;
  aiTimer?: number;
  age?: number;
  revealed?: boolean;
  target?: Pickup;
  stolen?: number;
  stolenXp?: number;
  tether?: number;
  carried?: number;
  phaseTwo?: boolean;
  attackIndex?: number;
  charge?: { t: number; dash: number; angle: number };
  feedNode?: boolean;
  implant?: boolean;
  elite?: boolean;
  bounty?: boolean;
  scale?: number;
  frozenUntil?: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  contactCd: number;
  flash: number;
  wobble: number;
}

export interface Projectile extends Entity {
  returnAt?: number;
  weaponKind?: WeaponKind;
  hitIds?: number[];
  source?: EnemyKind;
  damage: number;
  life: number;
  pierce: number;
  fromPlayer: boolean;
  color: string;
  homing?: boolean;
  targetId?: number;
}

export interface Orbiter extends Entity {
  angle: number;
  dist: number;
  damage: number;
  weaponKind: WeaponKind;
  offUntil?: number;
}

export interface Pickup extends Entity {
  kind: "xp" | "health" | "magnet" | "coin" | "buff";
  value: number;
  magnetized: boolean;
  buffKind?: TimedBuffKind;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Floater {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  enemyId?: number;
  amount?: number;
  hits?: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  arc?: number;
}

export interface Corpse {
  x: number;
  y: number;
  kind: EnemyKind;
  life: number;
  maxLife: number;
  flip: boolean;
}

export type ChestKind = "cold-wallet" | "defi-lootbox" | "validator-crate" | "airdrop-pod" | "grant-safe";

export type EnvObstacleKind =
  | "rug-pool"
  | "gas-gate"
  | "kyc-wall"
  | "liquidation-spike"
  | "sandwich-bot"
  | "honeypot"
  | "mempool-fog";

export interface WorldChest {
  id: number;
  kind: ChestKind;
  x: number;
  y: number;
  radius: number;
  openProgress: number;
  opened: boolean;
  coinCost: number;
}

export interface WorldWell {
  id: number;
  x: number;
  y: number;
  radius: number;
  stat: WellStatId;
  used: boolean;
  channelProgress: number;
}

export type InteractableKind = "faucet" | "lp-pool" | "bridge-gate" | "exploit-charge" | "bounty-board" | "airdrop" | "cameo";

export interface Interactable {
  id: number;
  kind: InteractableKind;
  x: number;
  y: number;
  radius: number;
  progress: number;
  used: boolean;
  readyAt: number;
  charge?: number;
  destX?: number;
  destY?: number;
  until?: number;
  lift?: number;
  cameo?: CameoId;
}

export interface WorldLandmark {
  key: string;
  x: number;
  y: number;
}

export interface SidekickState {
  kind: SidekickKind;
  x: number;
  y: number;
  angle: number;
  attackTimer: number;
}

export interface WorldObstacle {
  id: number;
  kind: EnvObstacleKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WeaponInstance {
  kind: WeaponKind;
  level: number;
  timer: number;
  rarity: WeaponRarity;
  evolved?: boolean;
  jammed?: boolean;
}

export interface RunStats {
  kills: number;
  damageDealt: number;
  timeSurvived: number;
  bossesDefeated: number;
}
