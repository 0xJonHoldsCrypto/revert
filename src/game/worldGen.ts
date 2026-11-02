import { biomeAt, CHESTS, ENV_OBSTACLES } from "../data/environment";
import { chestKindForBiome, rollWellStat } from "../data/loot";
import type { ChestKind, EnvObstacleKind, WorldChest, WorldObstacle, WorldWell } from "../types";
import { WORLD } from "../constants";
import type { WeaponKind, WeaponRarity } from "../types";
import { pick } from "../utils/math";
import { rollRarity } from "../data/rarity";
import { WEAPONS } from "../data/weapons";
import { CHEST_WEAPON_POOL } from "../data/environment";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function generateWorld(seed: number): {
  chests: WorldChest[];
  obstacles: WorldObstacle[];
  wells: WorldWell[];
} {
  const rnd = seeded(seed);
  const obstacles: WorldObstacle[] = [];
  const chests: WorldChest[] = [];
  const wells: WorldWell[] = [];
  let id = 1;

  for (let i = 0; i < 72; i++) {
    const x = 200 + rnd() * (WORLD.width - 400);
    const y = 200 + rnd() * (WORLD.height - 400);
    const biome = biomeAt(x, y);
    const kinds = (Object.keys(ENV_OBSTACLES) as EnvObstacleKind[]).filter((k) =>
      ENV_OBSTACLES[k].biome.includes(biome)
    );
    if (!kinds.length) continue;
    const kind = kinds[Math.floor(rnd() * kinds.length)]!;
    const def = ENV_OBSTACLES[kind];
    obstacles.push({
      id: id++,
      kind,
      x,
      y,
      width: def.width,
      height: def.height,
    });
  }

  for (let i = 0; i < 32; i++) {
    const x = 280 + rnd() * (WORLD.width - 560);
    const y = 280 + rnd() * (WORLD.height - 560);
    const biome = biomeAt(x, y);
    const kind = chestKindForBiome(biome, rnd);
    const def = CHESTS[kind];
    chests.push({
      id: id++,
      kind,
      x,
      y,
      radius: def.radius,
      openProgress: 0,
      opened: false,
      coinCost: def.coinCost,
    });
  }

  for (let i = 0; i < 10; i++) {
    const x = 360 + rnd() * (WORLD.width - 720);
    const y = 360 + rnd() * (WORLD.height - 720);
    wells.push({
      id: id++,
      x,
      y,
      radius: 62,
      stat: rollWellStat(i + seed),
      used: false,
      channelProgress: 0,
    });
  }

  return { chests, obstacles, wells };
}

export function rollChestLootLegacy(minRarity: WeaponRarity): { kind: WeaponKind; rarity: WeaponRarity } {
  const kind = pick(CHEST_WEAPON_POOL);
  let rarity = rollRarity(0.15);
  const order = ["common", "uncommon", "rare", "epic", "legendary"];
  if (order.indexOf(rarity) < order.indexOf(minRarity)) {
    rarity = minRarity;
  }
  const base = WEAPONS[kind].rarity;
  if (order.indexOf(rarity) < order.indexOf(base)) rarity = base;
  return { kind, rarity };
}

export function chestHint(kind: ChestKind): string {
  return CHESTS[kind].name;
}
