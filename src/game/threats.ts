import { ENEMIES } from "../data/enemies";
import type { Enemy, EnemyKind, Hazard } from "../types";
import { angleBetween, dist, randRange } from "../utils/math";
import { compactDead } from "./compact";
import type { Game } from "./Game";

export const THREAT_INTEL: Partial<Record<EnemyKind, string>> = {
  "script-kiddie": "Copied the exploit from a forum. Keeps running it.",
  "phishing-bot": "Disguises itself as XP. Watch for the red flicker.",
  "mev-searcher": "Front-runs you to loot. Kill it to get the loot back.",
  "bridge-drainer": "Siphons funds off the map until killed. Priority target.",
  "rug-dev": "Marks the floor, then yanks it. Get out of the rug.",
  "oracle-manipulator": "Prices and numbers lie near it. Fires bad data.",
  "sim-swapper": "One hit swaps your controls for a moment.",
  insider: "Green badge, friendly face. Turns on you up close.",
  "shadow-op": "Keeps its distance and shoots. Flanks in groups.",
  "airdrop-farmer": "Weak, fast and never alone. Here for the points.",
  sybil: "One wallet, many wallets. Splits when it dies.",
  liquidator: "Slow until you are hurt. The lower your HP, the faster it comes.",
  "gas-guzzler": "Leaves toxic gas where it walks. Bursts when it dies.",
  "flash-bot": "Draws a line, then blinks down it. Sidestep the line.",
  "pump-bot": "Grows until it dumps on you. Kill it while it is small.",
  "wash-trader": "Heals everything near it. Priority target.",
  "honeypot-mimic": "That shiny coin is a trap. It bites when you get close.",
  "jpeg-flipper": "Keeps its distance and throws overpriced JPEGs in threes.",
  "bot-farm": "Barely moves and keeps printing farmers. Kill it first.",
  "depegged-stable": "Looks stable. Hurt it and it loses the peg and bolts at you.",
  slasher: "Winds up a blast around itself. Step out of the ring.",
  "tg-scammer": "Touches you, steals $SAFU, vanishes. Kill it before it arrives.",
  "leverage-degen": "Runs at you and blows up. Keep your distance.",
  frontrunner: "Reads where you are heading and blinks there first. Change direction.",
  censor: "Fences you in with a burning ring. Stay inside until it drops.",
  "dust-spammer": "Sprays dust that sticks and slows you. Dash to shake it off.",
  griefer: "Leaves timelocked mines behind. They arm, then wait for you.",
};

export const FRONTRUN_LEAD_SEC = 0.85;
export const FRONTRUN_WINDUP_SEC = 0.55;
const FRONTRUN_EVERY_SEC = 4.2;
const FRONTRUN_MIN_GAP = 95;
const FRONTRUN_MAX_REACH = 280;
const CENSOR_RING_RADIUS = 150;
const CENSOR_EVERY_SEC = 7.5;
const DUST_EVERY_SEC = 2.8;
const DUST_SPEED = 165;
const MINE_EVERY_SEC = 3.4;
const MINE_RADIUS = 36;
const MINE_ARM_SEC = 1.2;
const MINE_LIFE_SEC = 14;
const MAX_MINES = 18;

const DRAIN_PER_SEC = 900_000;
const DRAIN_CAP = 70_000_000;
const MAX_HAZARDS = 48;
const AI_START_DELAY_SEC = 1.2;
const MAX_FARM_POPULATION = 420;
const SLASHER_RECOVERY_SEC = 3;
const RING_WIDTH = 16;

function steer(e: Enemy, tx: number, ty: number, speed: number, dt: number) {
  const a = angleBetween(e.x, e.y, tx, ty);
  e.x += Math.cos(a) * speed * dt;
  e.y += Math.sin(a) * speed * dt;
}

export function isHiddenFromWeapons(e: Enemy): boolean {
  return (e.kind === "phishing-bot" || e.kind === "insider" || e.kind === "honeypot-mimic") && !e.revealed;
}

export function fireEnemyBullet(game: Game, x: number, y: number, angle: number, speed: number, damage: number, color: string, source: EnemyKind) {
  game.projectiles.push({
    id: game.nextEntityId(),
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 7,
    dead: false,
    damage,
    life: 4,
    pierce: 0,
    fromPlayer: false,
    color,
    homing: false,
    source,
  });
}

export function updateEnemyBehavior(game: Game, e: Enemy, dt: number) {
  const p = game.player;
  const speed = e.speed * game.gasEnemySpeedMult();
  const d = dist(e.x, e.y, p.x, p.y);
  e.aiTimer = (e.aiTimer ?? AI_START_DELAY_SEC) - dt;

  switch (e.kind) {
    case "phishing-bot": {
      if (!e.revealed) {
        e.age = (e.age ?? 0) + dt;
        if (d < 72 || e.age > 14) {
          e.revealed = true;
          e.aiTimer = 0.7;
          game.audio.play("sting");
          game.addFloater(e.x, e.y - 40, "PHISHED", "#ff5c48");
        }
        return;
      }
      steer(e, p.x, p.y, (e.aiTimer ?? 0) > 0 ? speed * 3.2 : speed, dt);
      return;
    }
    case "mev-searcher": {
      if (!e.target || e.target.dead) {
        e.target = game.pickups.find((pk) => !pk.dead && pk.kind === "xp" && !pk.magnetized && dist(pk.x, pk.y, e.x, e.y) < 340) ?? undefined;
      }
      if (e.target && !e.target.dead) {
        steer(e, e.target.x, e.target.y, speed * 1.5, dt);
        if (dist(e.x, e.y, e.target.x, e.target.y) < 18) {
          e.target.dead = true;
          e.stolen = (e.stolen ?? 0) + 1;
          e.stolenXp = (e.stolenXp ?? 0) + e.target.value;
          game.addFloater(e.x, e.y - 30, "FRONT-RUN", "#ffe08a");
          game.audio.play("nearMiss");
          e.target = undefined;
        }
        return;
      }
      steer(e, p.x, p.y, speed, dt);
      return;
    }
    case "bridge-drainer": {
      if (e.tether === undefined) e.tether = randRange(0, Math.PI * 2);
      if (d > 300) steer(e, p.x, p.y, speed, dt);
      else if (d < 230) steer(e, e.x + (e.x - p.x), e.y + (e.y - p.y), speed, dt);
      else steer(e, e.x + (p.y - e.y), e.y - (p.x - e.x), speed * 0.4, dt);
      const take = DRAIN_PER_SEC * dt;
      e.carried = (e.carried ?? 0) + take;
      game.fundsLost += take;
      if (e.carried >= DRAIN_CAP) {
        e.dead = true;
        game.pushFeed(`${game.fakeHash()} bridged out · -$${(DRAIN_CAP / 1e6).toFixed(0)}M lost`);
        game.addFloater(e.x, e.y - 30, "ESCAPED", "#ff5c48");
        game.audio.play("liquidation");
      }
      return;
    }
    case "rug-dev": {
      if (d > 170) steer(e, p.x, p.y, speed, dt);
      if ((e.aiTimer ?? 0) <= 0 && d < 280) {
        e.aiTimer = 6;
        game.addHazard({ shape: "circle", x: p.x, y: p.y, r: 96, windup: 1.05, active: 0, damage: e.damage, color: "#f778ba", source: e.kind, knock: 340, label: "RUG" });
        game.audio.play("rugPull");
      }
      return;
    }
    case "oracle-manipulator": {
      if (d > 240) steer(e, p.x, p.y, speed, dt);
      if (d < 280 && game.perks.cleanFeed <= 0) game.priceLieTimer = Math.max(game.priceLieTimer, 0.4);
      if ((e.aiTimer ?? 0) <= 0 && d < 420) {
        e.aiTimer = 2.8;
        fireEnemyBullet(game, e.x, e.y, angleBetween(e.x, e.y, p.x, p.y), 210, e.damage * 0.6, "#79c0ff", e.kind);
        game.audio.play("enemyShot");
      }
      return;
    }
    case "insider": {
      if (!e.revealed) {
        steer(e, p.x, p.y, speed * 0.55, dt);
        if (d < 95) {
          e.revealed = true;
          game.addFloater(e.x, e.y - 40, "INSIDER", "#ff5c48");
          game.audio.play("sting");
        }
        return;
      }
      steer(e, p.x, p.y, speed * 2, dt);
      return;
    }
    case "shadow-op": {
      const flank = ((e.id % 5) - 2) * 0.55;
      const a = angleBetween(p.x, p.y, e.x, e.y) + flank * dt;
      const tx = p.x + Math.cos(a) * 265;
      const ty = p.y + Math.sin(a) * 265;
      steer(e, tx, ty, speed, dt);
      if ((e.aiTimer ?? 0) <= 0 && d < 430) {
        e.aiTimer = 2.3 + (e.id % 4) * 0.2;
        fireEnemyBullet(game, e.x, e.y, angleBetween(e.x, e.y, p.x, p.y), 250, e.damage * 0.55, "#ff5c48", e.kind);
        game.audio.play("enemyShot");
      }
      return;
    }
    case "jpeg-flipper": {
      if (d > 300) steer(e, p.x, p.y, speed, dt);
      else if (d < 210) steer(e, e.x + (e.x - p.x), e.y + (e.y - p.y), speed, dt);
      if ((e.aiTimer ?? 0) <= 0 && d < 430) {
        e.aiTimer = 3.1;
        const aim = angleBetween(e.x, e.y, p.x, p.y);
        for (const spread of [-0.24, 0, 0.24]) fireEnemyBullet(game, e.x, e.y, aim + spread, 200, e.damage * 0.6, "#ff9f43", e.kind);
        game.audio.play("enemyShot");
      }
      return;
    }
    case "bot-farm": {
      steer(e, p.x, p.y, speed, dt);
      if ((e.aiTimer ?? 2) <= 0 && game.enemies.length < MAX_FARM_POPULATION) {
        e.aiTimer = 4.5;
        spawnMinions(game, e, "airdrop-farmer", 3, 42);
      }
      return;
    }
    case "depegged-stable": {
      const broken = e.hp < e.maxHp * 0.7;
      if (broken && !e.phaseTwo) {
        e.phaseTwo = true;
        game.addFloater(e.x, e.y - 34, "DEPEGGED", "#ff5c48");
      }
      steer(e, p.x, p.y, broken ? speed * 2.3 : speed, dt);
      return;
    }
    case "slasher": {
      if ((e.aiTimer ?? 1) > SLASHER_RECOVERY_SEC) return;
      steer(e, p.x, p.y, speed, dt);
      if ((e.aiTimer ?? 1) <= 0 && d < 170) {
        e.aiTimer = SLASHER_RECOVERY_SEC + 0.85;
        game.addHazard({ shape: "circle", x: e.x, y: e.y, r: 125, windup: 0.85, active: 0, damage: e.damage, color: "#c9a0ff", source: e.kind, knock: 200, label: "SLASH" });
      }
      return;
    }
    case "leverage-degen": {
      if (e.charge) {
        e.charge.t -= dt;
        if (e.charge.t <= 0) e.dead = true;
        return;
      }
      steer(e, p.x, p.y, speed, dt);
      if (d < 85) {
        e.charge = { t: 0.55, dash: 0, angle: 0 };
        game.addHazard({ shape: "circle", x: e.x, y: e.y, r: 105, windup: 0.55, active: 0, damage: e.damage, color: "#ff5c48", source: e.kind, knock: 240, label: "LIQUIDATED" });
      }
      return;
    }
    case "frontrunner": {
      if (e.blink) {
        e.blink.t -= dt;
        if (e.blink.t > 0) return;
        e.x = e.px = e.blink.x;
        e.y = e.py = e.blink.y;
        e.blink = undefined;
        game.burstParticles(e.x, e.y, "#e6f03c", 8);
        game.audio.play("nearMiss");
        return;
      }
      steer(e, p.x, p.y, speed, dt);
      const moving = Math.hypot(p.vx, p.vy);
      if ((e.aiTimer ?? 0) <= 0 && d < 560 && moving > 40) {
        e.aiTimer = FRONTRUN_EVERY_SEC;
        const reach = Math.min(FRONTRUN_MAX_REACH, Math.max(FRONTRUN_MIN_GAP, moving * FRONTRUN_LEAD_SEC));
        e.blink = { x: p.x + (p.vx / moving) * reach, y: p.y + (p.vy / moving) * reach, t: FRONTRUN_WINDUP_SEC };
        game.addFloater(e.x, e.y - 34, "FRONT-RUNNING", "#e6f03c");
      }
      return;
    }
    case "censor": {
      if (d > 280) steer(e, p.x, p.y, speed, dt);
      else if (d < 200) steer(e, e.x + (e.x - p.x), e.y + (e.y - p.y), speed, dt);
      if ((e.aiTimer ?? 0) <= 0 && d < 440 && game.hazards.length < MAX_HAZARDS) {
        e.aiTimer = CENSOR_EVERY_SEC;
        game.addHazard({ shape: "circle", ring: true, once: true, x: p.x, y: p.y, r: CENSOR_RING_RADIUS, windup: 1.2, active: 3.2, damage: e.damage * 0.6, color: "#ff4f9a", source: e.kind, knock: 0, label: "CENSORED" });
        game.audio.play("alarm");
      }
      return;
    }
    case "dust-spammer": {
      if (d > 320) steer(e, p.x, p.y, speed, dt);
      else if (d < 230) steer(e, e.x + (e.x - p.x), e.y + (e.y - p.y), speed, dt);
      if ((e.aiTimer ?? 0) <= 0 && d < 460) {
        e.aiTimer = DUST_EVERY_SEC;
        const aim = angleBetween(e.x, e.y, p.x, p.y);
        for (const spread of [-0.35, 0, 0.35]) fireEnemyBullet(game, e.x, e.y, aim + spread, DUST_SPEED, e.damage * 0.5, "#c8b48a", e.kind);
        game.audio.play("enemyShot");
      }
      return;
    }
    case "griefer": {
      if (d > 190) steer(e, p.x, p.y, speed, dt);
      else steer(e, e.x + (p.y - e.y), e.y - (p.x - e.x), speed * 0.8, dt);
      if ((e.aiTimer ?? 0) <= 0) {
        e.aiTimer = MINE_EVERY_SEC;
        let mines = 0;
        for (const h of game.hazards) if (h.label === "MINE") mines++;
        if (mines < MAX_MINES && game.hazards.length < MAX_HAZARDS) {
          game.addHazard({ shape: "circle", once: true, x: e.x, y: e.y, r: MINE_RADIUS, windup: MINE_ARM_SEC, active: MINE_LIFE_SEC, damage: e.damage, color: "#ff7a1a", source: e.kind, knock: 260, label: "MINE" });
        }
      }
      return;
    }
    case "liquidator": {
      steer(e, p.x, p.y, speed * (1 + 2.4 * (1 - p.hp / p.maxHp)), dt);
      return;
    }
    case "gas-guzzler": {
      steer(e, p.x, p.y, speed, dt);
      if ((e.aiTimer ?? 0) <= 0) {
        e.aiTimer = 2.4;
        gasCloud(game, e.x, e.y, 58, e.damage * 0.5, e.kind);
      }
      return;
    }
    case "flash-bot": {
      if (e.charge) {
        e.charge.t -= dt;
        if (e.charge.t <= 0) e.charge = undefined;
        else if (e.charge.t < e.charge.dash) {
          e.x += Math.cos(e.charge.angle) * 1100 * dt;
          e.y += Math.sin(e.charge.angle) * 1100 * dt;
        }
        return;
      }
      steer(e, p.x, p.y, speed, dt);
      if ((e.aiTimer ?? 2) <= 0 && d < 520) {
        const angle = angleBetween(e.x, e.y, p.x, p.y);
        e.aiTimer = 3.6;
        e.charge = { t: 0.95, dash: 0.3, angle };
        game.addHazard({ shape: "beam", x: e.x, y: e.y, angle, length: 330, windup: 0.65, active: 0.01, damage: e.damage, color: "#6ff7ff", source: e.kind, knock: 0 });
      }
      return;
    }
    case "pump-bot": {
      steer(e, p.x, p.y, speed, dt);
      e.age = (e.age ?? 0) + dt;
      e.scale = 1 + Math.min(1, e.age / 9) * 0.9;
      if (e.age >= 9) {
        e.dead = true;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          fireEnemyBullet(game, e.x, e.y, a, 220, e.damage * 0.7, "#ff5c48", e.kind);
        }
        game.addFloater(e.x, e.y - 40, "DUMPED", "#ff5c48");
        game.audio.play("liquidation");
      }
      return;
    }
    case "wash-trader": {
      if (d > 240) steer(e, p.x, p.y, speed, dt);
      else if (d < 190) steer(e, e.x + (e.x - p.x), e.y + (e.y - p.y), speed, dt);
      if ((e.aiTimer ?? 0) <= 0) {
        e.aiTimer = 3;
        for (const other of game.enemies) {
          if (other === e || other.dead || ENEMIES[other.kind].isBoss) continue;
          if (dist(e.x, e.y, other.x, other.y) < 210) other.hp = Math.min(other.maxHp, other.hp + other.maxHp * 0.2);
        }
        game.shockwaves.push({ x: e.x, y: e.y, radius: 210, life: 0.4, maxLife: 0.4, color: "#8fd6ff" });
      }
      return;
    }
    case "honeypot-mimic": {
      if (!e.revealed) {
        if (d < 120) {
          e.revealed = true;
          e.aiTimer = 0.75;
          game.addHazard({ shape: "circle", x: e.x, y: e.y, r: 120, windup: 0.75, active: 0, damage: e.damage, color: "#ffc23d", source: e.kind, knock: 260, label: "HONEYPOT" });
          game.addFloater(e.x, e.y - 40, "IT'S A TRAP", "#ffc23d");
          game.audio.play("sting");
        }
        return;
      }
      if ((e.aiTimer ?? 0) <= 0) steer(e, p.x, p.y, 140, dt);
      return;
    }
    default: {
      if (ENEMIES[e.kind].isBoss) {
        updateBoss(game, e, dt, speed);
        return;
      }
      steer(e, p.x, p.y, speed, dt);
    }
  }
}

export function gasCloud(game: Game, x: number, y: number, r: number, damage: number, source: EnemyKind) {
  if (game.hazards.length >= MAX_HAZARDS) return;
  game.addHazard({ shape: "circle", x, y, r, windup: 0.5, active: 3, damage, color: "#b7e04b", source, knock: 0, label: "GAS" });
}

function telegraphCircle(game: Game, boss: Enemy, x: number, y: number, r: number, windup: number, scale = 1, label?: string) {
  game.addHazard({ shape: "circle", x, y, r, windup, active: 0, damage: boss.damage * 0.55 * scale, color: ENEMIES[boss.kind].color, source: boss.kind, knock: 220, label });
}

function radialBullets(game: Game, boss: Enemy, count: number, offset: number, speed: number, color: string) {
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * Math.PI * 2;
    const rim = boss.radius * 1.6;
    fireEnemyBullet(game, boss.x + Math.cos(a) * rim, boss.y + Math.sin(a) * rim, a, speed, boss.damage * 0.3, color, boss.kind);
  }
  game.audio.play("enemyShot");
}

function spawnMinions(game: Game, boss: Enemy, kind: EnemyKind, count: number, radius: number, setup?: (e: Enemy) => void) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const minion = game.spawnEnemyAt(kind, boss.x + Math.cos(a) * radius, boss.y + Math.sin(a) * radius);
    setup?.(minion);
  }
}

function updateBoss(game: Game, boss: Enemy, dt: number, speed: number) {
  const p = game.player;
  const phaseTwo = boss.hp < boss.maxHp * 0.5;
  if (phaseTwo && !boss.phaseTwo) {
    boss.phaseTwo = true;
    boss.aiTimer = 1.1;
    game.impactFrames = 5;
    game.addTrauma(0.6);
    game.audio.play("alarm");
    game.addFloater(boss.x, boss.y - 170, "PHASE 2", "#ffc23d");
    game.pushFeed(`${ENEMIES[boss.kind].name} escalated privileges`);
  }
  if (boss.charge) {
    boss.charge.t -= dt;
    if (boss.charge.t <= 0) {
      boss.charge = undefined;
    } else if (boss.charge.t < boss.charge.dash) {
      boss.x += Math.cos(boss.charge.angle) * 640 * dt;
      boss.y += Math.sin(boss.charge.angle) * 640 * dt;
    }
    return;
  }
  if (dist(boss.x, boss.y, p.x, p.y) > boss.radius * 1.25) steer(boss, p.x, p.y, speed * (phaseTwo ? 1.1 : 0.85), dt);
  if ((boss.aiTimer ?? 2) > 0) return;
  const cadence = phaseTwo ? 0.72 : 1;
  const step = boss.attackIndex = (boss.attackIndex ?? 0) + 1;
  switch (boss.kind) {
    case "boss-shill": {
      boss.aiTimer = 4.4 * cadence;
      if (step % 2 === 1) {
        radialBullets(game, boss, phaseTwo ? 12 : 8, step * 0.35, 150, "#ff8bd1");
        game.pushFeed("The Shill posted a 40-tweet thread");
      } else {
        spawnMinions(game, boss, "airdrop-farmer", phaseTwo ? 8 : 5, 120);
      }
      break;
    }
    case "boss-rug-baron": {
      boss.aiTimer = 4.2 * cadence;
      if (step % 2 === 1) {
        for (let i = 0; i < (phaseTwo ? 4 : 3); i++) {
          telegraphCircle(game, boss, p.x + randRange(-110, 110), p.y + randRange(-80, 80), 92, 0.85 + i * 0.25, 1, "RUG");
        }
        game.audio.play("rugPull");
      } else {
        const angle = angleBetween(boss.x, boss.y, p.x, p.y);
        boss.charge = { t: 1.2, dash: 0.42, angle };
        game.addHazard({ shape: "beam", x: boss.x, y: boss.y, angle, length: 300, windup: 0.78, active: 0.01, damage: boss.damage * 0.5, color: "#f778ba", source: boss.kind, knock: 240 });
      }
      break;
    }
    case "boss-gas-golem": {
      boss.aiTimer = 4.8 * cadence;
      if (step % 3 === 1) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + step;
          gasCloud(game, p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 130, 84, boss.damage * 0.3, boss.kind);
        }
      } else if (step % 3 === 2) {
        radialBullets(game, boss, phaseTwo ? 18 : 12, step * 0.3, 185, "#b7e04b");
      } else {
        game.gasUntil = game.elapsed + 6;
        spawnMinions(game, boss, "gas-guzzler", phaseTwo ? 4 : 2, 190);
        game.audio.play("gasSpike");
      }
      break;
    }
    case "boss-mev-king": {
      boss.aiTimer = 4 * cadence;
      if (step % 2 === 1) {
        const px = p.x + p.vx * 0.9;
        const py = p.y + p.vy * 0.9;
        const vertical = Math.abs(p.vx) >= Math.abs(p.vy);
        const w = vertical ? 58 : 420;
        const h = vertical ? 420 : 58;
        game.addHazard({ shape: "rect", x: px, y: py, w: vertical ? 150 : 420, h: vertical ? 420 : 150, windup: 0.95, active: 0, damage: boss.damage * 0.65, color: "#ffe08a", source: boss.kind, knock: 0, label: "SANDWICH", bars: { w, h, vertical } });
        game.audio.play("gasSpike");
      } else {
        const angle = angleBetween(boss.x, boss.y, p.x, p.y);
        boss.charge = { t: 1.2, dash: 0.42, angle };
        game.addHazard({ shape: "beam", x: boss.x, y: boss.y, angle, length: 310, windup: 0.78, active: 0.01, damage: boss.damage * 0.5, color: "#ffe08a", source: boss.kind, knock: 280 });
      }
      break;
    }
    case "boss-unit-414": {
      boss.aiTimer = 5.2 * cadence;
      if (step % 2 === 1) {
        spawnMinions(game, boss, "shadow-op", phaseTwo ? 6 : 4, 130);
        game.pushFeed("Unit 414 opened a new session");
      } else {
        game.addHazard({ shape: "beam", x: boss.x, y: boss.y, angle: angleBetween(boss.x, boss.y, p.x, p.y) - 1.1, spin: phaseTwo ? 1.2 : 0.8, length: 560, windup: 0.85, active: 2.8, damage: boss.damage * 0.22, color: "#ff3a44", source: boss.kind, knock: 0, follow: boss.id, label: "MAPPING" });
        game.audio.play("alarm");
      }
      break;
    }
    case "boss-phish-king": {
      boss.aiTimer = 4.8 * cadence;
      if (step % 2 === 1) {
        spawnMinions(game, boss, "phishing-bot", phaseTwo ? 12 : 8, 260);
        game.pushFeed("Phish King airdropped 12 claim links");
      } else {
        radialBullets(game, boss, phaseTwo ? 20 : 14, step * 0.3, 200, "#7aa2ff");
      }
      break;
    }
    case "boss-oracle": {
      boss.aiTimer = 5.4 * cadence;
      if (step % 2 === 1) {
        if (game.perks.cleanFeed <= 0) game.priceLieTimer = 6;
        spawnMinions(game, boss, "oracle-manipulator", 3, 240, (m) => {
          m.feedNode = true;
          m.hp = m.maxHp = 90;
        });
        game.addFloater(boss.x, boss.y - 170, "FEED NODES SHIELD HIM", "#79c0ff");
        game.pushFeed("Oracle posted a new price. Kill the feeds.");
      } else {
        for (let i = 0; i < (phaseTwo ? 6 : 4); i++) {
          telegraphCircle(game, boss, p.x + randRange(-150, 150), p.y + randRange(-110, 110), 74, 0.8 + i * 0.16);
        }
      }
      break;
    }
    case "boss-nightdesk": {
      boss.aiTimer = 5.6 * cadence;
      if (step % 2 === 1) {
        const usable = game.weapons.filter((w) => !w.jammed);
        if (usable.length > 1) {
          const w = usable[Math.floor(game.rand() * usable.length)]!;
          w.jammed = true;
          game.addFloater(p.x, p.y - 70, "WEAPON HIJACKED", "#ff5c48");
          game.pushFeed("Implant loaded. Kill the implants to recover.");
          spawnMinions(game, boss, "insider", 3, 230, (m) => {
            m.revealed = true;
            m.implant = true;
            m.hp = m.maxHp = 110;
          });
          game.audio.play("glitch");
        }
      } else {
        const spokes = phaseTwo ? 4 : 3;
        for (let i = 0; i < spokes; i++) {
          game.addHazard({ shape: "beam", x: boss.x, y: boss.y, angle: step + (i / spokes) * Math.PI * 2, spin: 0.55, length: 460, windup: 0.8, active: 2.2, damage: boss.damage * 0.2, color: "#b58cff", source: boss.kind, knock: 0, follow: boss.id });
        }
      }
      break;
    }
    case "boss-grandmaster": {
      boss.aiTimer = 5.2 * cadence;
      const choice = step % 3;
      if (choice === 1) game.beginReorg();
      else if (choice === 2) radialBullets(game, boss, phaseTwo ? 26 : 18, step * 0.4, 230, "#d05cff");
      else {
        for (let i = 0; i < 5; i++) telegraphCircle(game, boss, p.x + randRange(-170, 170), p.y + randRange(-130, 130), 84, 0.8 + i * 0.14, 1.1);
        spawnMinions(game, boss, "shadow-op", 3, 150);
      }
      break;
    }
    default:
      boss.aiTimer = 4;
  }
}

function hazardHitsPlayer(h: Hazard, x: number, y: number): boolean {
  if (h.shape === "circle") return h.ring ? Math.abs(dist(h.x, h.y, x, y) - (h.r ?? 0)) < RING_WIDTH : dist(h.x, h.y, x, y) < (h.r ?? 0);
  if (h.shape === "rect") return Math.abs(x - h.x) < (h.w ?? 0) / 2 && Math.abs(y - h.y) < (h.h ?? 0) / 2;
  const a = h.angle ?? 0;
  const dx = x - h.x;
  const dy = y - h.y;
  const along = dx * Math.cos(a) + dy * Math.sin(a);
  const across = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
  return along > 0 && along < (h.length ?? 0) && across < 24;
}

export function updateHazards(game: Game, dt: number) {
  const p = game.player;
  for (const h of game.hazards) {
    h.t += dt;
    if (h.follow) {
      const owner = game.findEnemy(h.follow);
      if (!owner) {
        h.dead = true;
        continue;
      }
      h.x = owner.x;
      h.y = owner.y;
    }
    if (h.t < h.windup) continue;
    if (h.spin) h.angle = (h.angle ?? 0) + h.spin * dt;
    if (!h.fired && h.once) h.fired = true;
    if (!h.fired) {
      h.fired = true;
      game.addTrauma(0.3);
      game.audio.play("pulse");
      if (h.shape !== "beam" && !h.ring) game.shockwaves.push({ x: h.x, y: h.y, radius: h.r ?? Math.max(h.w ?? 0, h.h ?? 0) / 2, life: 0.3, maxLife: 0.3, color: h.color });
      if (h.active <= 0.02 && hazardHitsPlayer(h, p.x, p.y)) {
        game.hurtPlayer(h.damage, h.source);
        if (h.knock) game.knockPlayer(h.x, h.y, h.knock);
      }
    }
    if (h.active > 0.02 && hazardHitsPlayer(h, p.x, p.y)) {
      if (h.once) {
        h.dead = true;
        game.addTrauma(0.35);
        game.audio.play("pulse");
        game.shockwaves.push({ x: h.x, y: h.y, radius: (h.r ?? 0) * 2.4, life: 0.3, maxLife: 0.3, color: h.color });
        game.hurtPlayer(h.damage, h.source);
        if (h.knock) game.knockPlayer(h.x, h.y, h.knock);
        continue;
      }
      game.hurtPlayer(h.damage, h.source);
    }
    if (h.t >= h.windup + Math.max(h.active, 0.08)) h.dead = true;
  }
  compactDead(game.hazards);
}
