import { biomeAt, CHESTS, ENV_OBSTACLES } from "../data/environment";
import { chestKindForBiome, rollWellStat } from "../data/loot";
import type { SidekickKind, EnvObstacleKind, Interactable, InteractableKind, WorldChest, WorldLandmark, WorldObstacle, WorldWell } from "../types";
import { LANDMARKS } from "../pixel/threatArt";

const SECTOR = 1400;
const STREAM_RADIUS = 1;
const EVICT_RADIUS = STREAM_RADIUS + 2;
const SPAWN_CLEAR = 300;
const BRIDGE_JUMP = 2600;
const INTERACT_RADIUS: Record<Exclude<InteractableKind, "airdrop" | "cameo">, number> = {
  "staking-pad": 70,
  "merge-contract": 66,
  "hardware-rack": 62,
  faucet: 56,
  "lp-pool": 92,
  "bridge-gate": 58,
  "exploit-charge": 42,
  "bounty-board": 60,
};
const SCATTERED: Exclude<InteractableKind, "airdrop" | "cameo">[] = ["faucet", "lp-pool", "bridge-gate", "exploit-charge", "bounty-board", "staking-pad", "staking-pad", "merge-contract", "hardware-rack"];
const RIGS: SidekickKind[] = ["asic-miner", "dev-laptop", "codebase-guardian", "block-builder"];

type Sector = {
  chests: WorldChest[];
  obstacles: WorldObstacle[];
  wells: WorldWell[];
  interactables: Interactable[];
  landmarks: WorldLandmark[];
};

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export class WorldStream {
  chests: WorldChest[] = [];
  obstacles: WorldObstacle[] = [];
  wells: WorldWell[] = [];
  interactables: Interactable[] = [];
  landmarks: WorldLandmark[] = [];
  version = 0;
  private sectors = new Map<string, Sector>();
  private idBase = new Map<string, number>();
  private centerX = NaN;
  private centerY = NaN;
  private nextId = 1;

  constructor(private seed: number) {}

  update(x: number, y: number): boolean {
    const sx = Math.floor(x / SECTOR);
    const sy = Math.floor(y / SECTOR);
    if (sx === this.centerX && sy === this.centerY) return false;
    this.centerX = sx;
    this.centerY = sy;
    const active: Sector[] = [];
    for (let ox = -STREAM_RADIUS; ox <= STREAM_RADIUS; ox++) {
      for (let oy = -STREAM_RADIUS; oy <= STREAM_RADIUS; oy++) active.push(this.sector(sx + ox, sy + oy));
    }
    this.chests = active.flatMap((s) => s.chests);
    this.obstacles = active.flatMap((s) => s.obstacles);
    this.wells = active.flatMap((s) => s.wells);
    this.interactables = [...active.flatMap((s) => s.interactables), ...this.interactables.filter((i) => (i.kind === "airdrop" || i.kind === "cameo") && !i.used)];
    this.landmarks = active.flatMap((s) => s.landmarks);
    this.version++;
    this.evictFar(sx, sy);
    return true;
  }

  private evictFar(cx: number, cy: number) {
    for (const [key, sector] of this.sectors) {
      const comma = key.indexOf(",");
      const sx = Number(key.slice(0, comma));
      const sy = Number(key.slice(comma + 1));
      if (Math.abs(sx - cx) <= EVICT_RADIUS && Math.abs(sy - cy) <= EVICT_RADIUS) continue;
      const fresh = this.generate(sx, sy, this.idBase.get(key)!);
      if (JSON.stringify(fresh) === JSON.stringify(sector)) this.sectors.delete(key);
    }
  }

  addDynamic(item: Omit<Interactable, "id" | "progress" | "used" | "readyAt">) {
    this.interactables.push({ ...item, id: this.nextId++, progress: 0, used: false, readyAt: 0 });
  }

  private sector(sx: number, sy: number): Sector {
    const key = `${sx},${sy}`;
    const hit = this.sectors.get(key);
    if (hit) return hit;
    const known = this.idBase.get(key);
    const base = known ?? this.nextId;
    const made = this.generate(sx, sy, base);
    if (known === undefined) {
      this.idBase.set(key, base);
      this.nextId = base + this.countIds(made);
    }
    this.sectors.set(key, made);
    return made;
  }

  private countIds(sector: Sector): number {
    return sector.obstacles.length + sector.chests.length + sector.wells.length + sector.interactables.length;
  }

  private generate(sx: number, sy: number, base: number): Sector {
    let nextId = base;
    const rnd = seeded(Math.imul(sx, 73856093) ^ Math.imul(sy, 19349663) ^ this.seed);
    const place = (pad: number) => {
      for (;;) {
        const x = (sx + pad + rnd() * (1 - pad * 2)) * SECTOR;
        const y = (sy + pad + rnd() * (1 - pad * 2)) * SECTOR;
        if (Math.hypot(x, y) > SPAWN_CLEAR) return { x, y };
      }
    };
    const out: Sector = { chests: [], obstacles: [], wells: [], interactables: [], landmarks: [] };

    for (let i = 0; i < 5; i++) {
      const { x, y } = place(0.03);
      const biome = biomeAt(x, y);
      const kinds = (Object.keys(ENV_OBSTACLES) as EnvObstacleKind[]).filter((k) => ENV_OBSTACLES[k].biome.includes(biome));
      if (!kinds.length) continue;
      const kind = kinds[Math.floor(rnd() * kinds.length)]!;
      const def = ENV_OBSTACLES[kind];
      out.obstacles.push({ id: nextId++, kind, x, y, width: def.width, height: def.height });
    }

    const chestCount = 1 + (rnd() < 0.5 ? 1 : 0);
    for (let i = 0; i < chestCount; i++) {
      const { x, y } = place(0.06);
      const kind = chestKindForBiome(biomeAt(x, y), rnd);
      const def = CHESTS[kind];
      out.chests.push({ id: nextId++, kind, x, y, radius: def.radius, openProgress: 0, opened: false, coinCost: def.coinCost });
    }

    if (rnd() < 0.3) {
      const { x, y } = place(0.08);
      out.wells.push({ id: nextId++, x, y, radius: 62, stat: rollWellStat(Math.floor(rnd() * 1000)), used: false, channelProgress: 0 });
    }

    const scatterCount = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < scatterCount; i++) {
      const { x, y } = place(0.07);
      const kind = SCATTERED[Math.floor(rnd() * SCATTERED.length)]!;
      const angle = rnd() * Math.PI * 2;
      out.interactables.push({
        id: nextId++,
        kind,
        x,
        y,
        radius: INTERACT_RADIUS[kind],
        progress: 0,
        used: false,
        readyAt: 0,
        charge: kind === "lp-pool" ? 70 : undefined,
        rig: kind === "hardware-rack" ? RIGS[Math.floor(rnd() * RIGS.length)] : undefined,
        destX: kind === "bridge-gate" ? x + Math.cos(angle) * BRIDGE_JUMP : undefined,
        destY: kind === "bridge-gate" ? y + Math.sin(angle) * BRIDGE_JUMP : undefined,
      });
    }

    if (rnd() < 0.45) {
      const { x, y } = place(0.2);
      const fits = LANDMARKS.filter((m) => m.biome === biomeAt(x, y));
      const mark = fits[Math.floor(rnd() * fits.length)];
      if (mark) out.landmarks.push({ key: mark.key, x, y });
    }
    return out;
  }
}
