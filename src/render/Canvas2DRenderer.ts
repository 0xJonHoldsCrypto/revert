import type { Game } from "../game/Game";
import { TILE, WORLD } from "../constants";
import { biomeAt } from "../data/environment";
import { CHESTS, ENV_OBSTACLES } from "../data/environment";
import { ENEMIES } from "../data/enemies";
import { RARITY_COLORS, BOF } from "../data/rarity";
import { readViewport } from "./viewport";
import { drawBiomeTile, drawChest, drawObstacleProp, drawWell } from "../pixel/bofArt";
import { drawEnemySprite, drawSidekickSprite } from "../pixel/enemySprites";
import { getBodyFrame } from "../pixel/bodies";

export class Canvas2DRenderer {
  constructor(private canvas: HTMLCanvasElement, private ctx: CanvasRenderingContext2D) {}

  draw(game: Game) {
    const vp = readViewport(this.canvas);
    const ctx = this.ctx;
    ctx.fillStyle = BOF.skyDark;
    ctx.fillRect(0, 0, vp.width, vp.height);

    if (game.phase === "menu" || !game.player) {
      this.drawMenuBackdrop(ctx, vp.width, vp.height);
      return;
    }

    ctx.save();
    ctx.translate(-game.camera.x, -game.camera.y);
    this.drawWorld(ctx, game, vp);
    this.drawObstacles(ctx, game);
    this.drawChests(ctx, game);
    this.drawWells(ctx, game);
    this.drawPickups(ctx, game);
    this.drawEnemies(ctx, game);
    this.drawOrbiters(ctx, game);
    this.drawProjectiles(ctx, game);
    this.drawPlayer(ctx, game);
    if (game.sidekickEntity) this.drawSidekick(ctx, game);
    this.drawParticles(ctx, game);
    ctx.restore();

    this.drawVignette(ctx, vp.width, vp.height);

    if (game.phase === "paused") {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, vp.width, vp.height);
    }
  }

  private drawMenuBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = BOF.sky;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }

  private drawWorld(ctx: CanvasRenderingContext2D, game: Game, vp: { width: number; height: number }) {
    const cam = game.camera;
    const startX = Math.floor(cam.x / TILE) * TILE;
    const startY = Math.floor(cam.y / TILE) * TILE;
    const endX = cam.x + vp.width + TILE;
    const endY = cam.y + vp.height + TILE;

    for (let x = startX; x < endX; x += TILE) {
      for (let y = startY; y < endY; y += TILE) {
        const biome = biomeAt(x + TILE / 2, y + TILE / 2);
        const checker = (x / TILE + y / TILE) % 2 === 0;
        drawBiomeTile(ctx, x, y, TILE, biome, checker);
      }
    }

    ctx.strokeStyle = "rgba(255,213,106,0.2)";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, WORLD.width - 4, WORLD.height - 4);
  }

  private drawObstacles(ctx: CanvasRenderingContext2D, game: Game) {
    for (const o of game.obstacles) {
      const def = ENV_OBSTACLES[o.kind];
      drawObstacleProp(ctx, o.x, o.y, o.width, o.height, o.kind, def.color);
    }
  }

  private drawChests(ctx: CanvasRenderingContext2D, game: Game) {
    for (const c of game.chests) {
      if (c.opened) continue;
      const def = CHESTS[c.kind];
      const open = c.openProgress / def.openTime;
      drawChest(ctx, c.x, c.y, c.kind, Math.min(1, open));
      ctx.fillStyle = BOF.gold;
      ctx.font = "500 12px \"IBM Plex Sans\", system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`🪙${c.coinCost}`, c.x, c.y - 22);
      if (c.openProgress > 0 && c.openProgress < def.openTime) {
        ctx.fillRect(c.x - 18, c.y - 28, 36 * (c.openProgress / def.openTime), 4);
      }
    }
  }

  private drawWells(ctx: CanvasRenderingContext2D, game: Game) {
    for (const w of game.wells) {
      drawWell(ctx, w.x, w.y, w.channelProgress, w.used);
    }
  }

  private drawSidekick(ctx: CanvasRenderingContext2D, game: Game) {
    const sk = game.sidekickEntity!;
    drawSidekickSprite(ctx, sk.kind, sk.x, sk.y, 40);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, game: Game) {
    const p = game.player;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 14, p.radius * 0.9, p.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    const moving = Math.hypot(p.vx, p.vy) > 20;
    const frame = moving ? Math.floor(performance.now() / 140) % 4 : 1;
    const body = getBodyFrame(p.characterId, frame);
    ctx.imageSmoothingEnabled = false;
    const flip = Math.cos(p.facing) < 0;
    ctx.save();
    ctx.translate(p.x, p.y - 22);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(body, -16, -20, 32, 42);
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#21262d";
    ctx.fillRect(p.x - 22, p.y - p.radius - 14, 44, 5);
    ctx.fillStyle = BOF.grassLight;
    ctx.fillRect(p.x - 22, p.y - p.radius - 14, 44 * (p.hp / p.maxHp), 5);
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, game: Game) {
    for (const e of game.enemies) {
      const def = ENEMIES[e.kind];
      drawEnemySprite(ctx, e.kind, e.x, e.y, def.isBoss ? 56 : 40, e.flash > 0);

      if (def.isBoss) {
        const barW = e.radius * 2;
        ctx.fillStyle = "#21262d";
        ctx.fillRect(e.x - barW / 2, e.y - e.radius - 18, barW, 6);
        ctx.fillStyle = BOF.hackerGlow;
        ctx.fillRect(e.x - barW / 2, e.y - e.radius - 18, barW * (e.hp / e.maxHp), 6);
      }
    }
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D, game: Game) {
    for (const pr of game.projectiles) {
      ctx.fillStyle = pr.color;
      ctx.fillRect(pr.x - pr.radius, pr.y - pr.radius, pr.radius * 2, pr.radius * 2);
    }
  }

  private drawOrbiters(ctx: CanvasRenderingContext2D, game: Game) {
    for (const o of game.orbiters) {
      const w = game.weapons.find((x) => x.kind === o.weaponKind);
      ctx.fillStyle = w ? RARITY_COLORS[w.rarity] : BOF.gold;
      ctx.fillRect(o.x - o.radius, o.y - o.radius, o.radius * 2, o.radius * 2);
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D, game: Game) {
    for (const pk of game.pickups) {
      if (pk.kind === "coin") {
        ctx.fillStyle = BOF.gold;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, pk.radius, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (pk.kind === "buff" && pk.buffKind) {
        ctx.fillStyle = "#d2a8ff";
        ctx.fillRect(pk.x - pk.radius, pk.y - pk.radius, pk.radius * 2, pk.radius * 2);
        continue;
      }
      ctx.fillStyle = pk.kind === "xp" ? BOF.epic : BOF.grassLight;
      ctx.fillRect(pk.x - pk.radius, pk.y - pk.radius, pk.radius * 2, pk.radius * 2);
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, game: Game) {
    for (const pt of game.particles) {
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
