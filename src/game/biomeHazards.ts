import { BIOME_HAZARDS, HAZARD_OF_BIOME } from "../data/biomeHazards";
import { biomeAt } from "../data/environment";
import type { BiomeHazardId, Hazard } from "../types";
import type { Game } from "./Game";
import { MAX_HAZARDS } from "./threats";

export const BIOME_HAZARD_FIRST_SEC = 50;
const EVERY_SEC = 10;
const EVERY_SPREAD_SEC = 6;
const BASE_DAMAGE = 15;
const LANE_LENGTH = 1500;
const LANE_WIDTH = 88;
const LASER_REACH = 300;
const LASER_LENGTH = 600;
const LASER_SWEEP = 0.95;
const LASER_SPIN = 0.62;
const SPAN_SIZE = 124;
const SPAN_STEP = 130;
const SNIPER_RADIUS = 50;
const VENT_RADIUS = 72;
export const CHILL_SPEED_MULT = 0.6;
export const CHILL_SEC = 0.9;

type Spawn = Omit<Hazard, "t">;

export class BiomeHazards {
  nextAt = BIOME_HAZARD_FIRST_SEC;
  fired: BiomeHazardId[] = [];

  constructor(private g: Game) {}

  update() {
    const g = this.g;
    if (g.elapsed < this.nextAt || g.dying > 0) return;
    this.nextAt = g.elapsed + EVERY_SEC + g.rand() * EVERY_SPREAD_SEC;
    if (g.anyBossAlive()) return;
    const id = HAZARD_OF_BIOME[biomeAt(g.player.x, g.player.y)];
    const batch = this.plan(id);
    if (g.hazards.length + batch.length > MAX_HAZARDS) return;
    for (const h of batch) g.addHazard(h);
    this.fired.push(id);
    g.noteBiomeHazard(id);
  }

  damage(): number {
    return BASE_DAMAGE * (1 + (this.g.elapsed / 60) * 0.12);
  }

  plan(id: BiomeHazardId): Spawn[] {
    const g = this.g;
    const p = g.player;
    const def = BIOME_HAZARDS[id];
    const base = this.damage();
    const common = { color: def.color, source: id, label: def.label };
    switch (id) {
      case "gas-lane": {
        const horizontal = g.rand() < 0.5;
        return [{ ...common, shape: "rect", x: p.x, y: p.y, w: horizontal ? LANE_LENGTH : LANE_WIDTH, h: horizontal ? LANE_WIDTH : LANE_LENGTH, windup: 1.6, active: 1.4, damage: base * 0.6, knock: 0 }];
      }
      case "alarm-laser": {
        const around = g.rand() * Math.PI * 2;
        const dir = g.rand() < 0.5 ? 1 : -1;
        const x = p.x + Math.cos(around) * LASER_REACH;
        const y = p.y + Math.sin(around) * LASER_REACH;
        const aim = Math.atan2(p.y - y, p.x - x);
        return [{ ...common, shape: "beam", x, y, angle: aim - LASER_SWEEP * dir, spin: LASER_SPIN * dir, length: LASER_LENGTH, windup: 1.3, active: 3.1, damage: base * 0.7, knock: 0 }];
      }
      case "span-collapse": {
        const a = p.facing;
        const out: Spawn[] = [];
        for (let i = 0; i < 3; i++) {
          const along = 40 + i * SPAN_STEP;
          out.push({ ...common, shape: "rect", x: p.x + Math.cos(a) * along, y: p.y + Math.sin(a) * along, w: SPAN_SIZE, h: SPAN_SIZE, windup: 1.15 + i * 0.3, active: 0, damage: base * 1.2, knock: 0 });
        }
        return out;
      }
      case "sniper-glint": {
        const out: Spawn[] = [{ ...common, shape: "circle", x: p.x, y: p.y, r: SNIPER_RADIUS, track: 1.15, windup: 1.75, active: 0, damage: base * 1.5, knock: 160 }];
        if (g.elapsed >= 300) out.push({ ...common, shape: "circle", x: p.x, y: p.y, r: SNIPER_RADIUS, track: 1.65, windup: 2.25, active: 0, damage: base * 1.5, knock: 160 });
        return out;
      }
      case "frost-vent": {
        const out: Spawn[] = [];
        for (let i = 0; i < 3; i++) {
          const a = g.rand() * Math.PI * 2;
          const reach = i === 0 ? g.rand() * 60 : 150 + g.rand() * 50;
          out.push({ ...common, shape: "circle", x: p.x + Math.cos(a) * reach, y: p.y + Math.sin(a) * reach, r: VENT_RADIUS, windup: 1.4, active: 2.4, damage: base * 0.35, knock: 0, slow: CHILL_SPEED_MULT });
        }
        return out;
      }
    }
  }
}
