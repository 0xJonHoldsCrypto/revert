import type { Game } from "../game/Game";
import { WORLD } from "../constants";
import { biomeAt, CHESTS, ENV_OBSTACLES } from "../data/environment";
import { ENEMIES } from "../data/enemies";
import { getChestSprite, getCryptoProp, getMonsterSprite, getRigSprite, getWellSprite, heroFacesLeft, type CryptoProp } from "../pixel/gbcArt";
import { fieldColors, getFieldTexture, getGroundPatch, getSideHero } from "../pixel/hdField";
import type { BiomeId } from "../data/environment";

export const GBC_ZOOM = 2.6;

const patchCache = new Map<BiomeId, CanvasPattern>();
const PROPS: CryptoProp[] = ["rack", "spool", "fan", "cone"];

export function gbcOrigin(game: Game, viewW: number, viewH: number) {
  const p = game.player;
  const shake = game.shake > 0 ? (Math.random() - 0.5) * 6 * game.shake : 0;
  return {
    x: clamp(p.x - viewW / 2 + shake, 0, Math.max(0, WORLD.width - viewW)),
    y: clamp(p.y - viewH / 2 - shake, 0, Math.max(0, WORLD.height - viewH)),
  };
}

export function drawGbcWorld(ctx: CanvasRenderingContext2D, game: Game, w: number, h: number) {
  if (!game.player) return;
  const viewW = w / GBC_ZOOM;
  const viewH = h / GBC_ZOOM;
  const cam = gbcOrigin(game, viewW, viewH);
  const heroH = (h * 0.11) / GBC_ZOOM;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#102010";
  ctx.fillRect(0, 0, w, h);
  ctx.scale(GBC_ZOOM, GBC_ZOOM);
  ctx.translate(-cam.x, -cam.y);

  const biome = biomeAt(game.player.x, game.player.y);
  const colors = fieldColors(biome);
  ctx.fillStyle = colors.base;
  ctx.fillRect(cam.x - 8, cam.y - 8, viewW + 16, viewH + 16);
  let pattern = patchCache.get(biome);
  if (!pattern) {
    pattern = ctx.createPattern(getFieldTexture(biome), "repeat")!;
    patchCache.set(biome, pattern);
  }
  ctx.fillStyle = pattern;
  ctx.fillRect(cam.x - 8, cam.y - 8, viewW + 16, viewH + 16);

  wash(ctx, cam.x, cam.y, viewW, viewH, "#ffffff", 0.07, -0.4);
  wash(ctx, cam.x, cam.y, viewW, viewH, "#000000", 0.06, 0.65);

  scatterPatches(ctx, cam.x, cam.y, viewW, viewH, biome);
  scatterProps(ctx, cam.x, cam.y, viewW, viewH, heroH);

  for (const o of game.obstacles) {
    const def = ENV_OBSTACLES[o.kind];
    ctx.save();
    ctx.strokeStyle = def.color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(def.blocks ? [] : [5, 4]);
    ctx.strokeRect(o.x - o.width / 2, o.y - o.height / 2, o.width, o.height);
    ctx.setLineDash([]);
    ctx.globalAlpha = def.blocks ? 0.18 : 0.1;
    ctx.fillStyle = def.color;
    ctx.fillRect(o.x - o.width / 2, o.y - o.height / 2, o.width, o.height);
    ctx.restore();
  }

  for (const c of game.chests) {
    if (c.opened) continue;
    const def = CHESTS[c.kind];
    drawStepRing(ctx, c.x, c.y, c.radius, c.openProgress / def.openTime, def.color, game.player.coins >= c.coinCost);
    const spr = getChestSprite();
    const dh = heroH * 0.42;
    const dw = dh * (spr.width / spr.height);
    castShadow(ctx, c.x, c.y + 4, dh * 0.85, dw * 0.22);
    ctx.drawImage(spr, c.x - dw / 2, c.y + 4 - dh, dw, dh);
  }
  for (const well of game.wells) {
    if (well.used) continue;
    drawStepRing(ctx, well.x, well.y, well.radius, well.channelProgress / 1.35, "#6cb6ff", true);
    const spr = getWellSprite();
    const dh = heroH * 0.5;
    const dw = dh * (spr.width / spr.height);
    castShadow(ctx, well.x, well.y + 4, dh * 0.7, dw * 0.24);
    ctx.drawImage(spr, well.x - dw / 2, well.y + 4 - dh, dw, dh);
  }

  for (const pk of game.pickups) {
    castShadow(ctx, pk.x, pk.y + 2, 7, 3);
    drawPickup(ctx, pk.kind, pk.x, pk.y);
  }

  for (const e of game.enemies) {
    const def = ENEMIES[e.kind];
    const spr = getMonsterSprite(e.kind);
    const eh = heroH * (def.isBoss ? 0.5 : 0.36);
    const ew = eh * (spr.width / spr.height);
    castShadow(ctx, e.x, e.y + 4, eh, ew * 0.2);
    if (e.flash > 0) ctx.globalAlpha = 0.55;
    ctx.drawImage(spr, e.x - ew / 2, e.y + 4 - eh, ew, eh);
    ctx.globalAlpha = 1;
  }

  const p = game.player;
  const step = Math.hypot(p.vx, p.vy) > 20 ? Math.floor(performance.now() / 160) : 0;
  const hero = getSideHero(p.characterId, step);
  const heroW = heroH * (hero.width / hero.height);
  const foot = Math.max(heroH * 0.1, heroH - 24);
  castShadow(ctx, p.x, p.y + foot, heroH, heroW * 0.18);
  ctx.strokeStyle = "rgba(240, 180, 60, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + foot, heroW * 0.34, heroH * 0.06, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(p.x, p.y);
  if (heroFacesLeft(p.facing)) ctx.scale(-1, 1);
  if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.drawImage(hero, -heroW / 2, foot - heroH, heroW, heroH);
  ctx.restore();
  ctx.globalAlpha = 1;

  if (game.sidekickEntity) {
    const sk = game.sidekickEntity;
    const spr = getRigSprite(sk.kind);
    const sh = heroH * 0.28;
    const sw = sh * (spr.width / spr.height);
    castShadow(ctx, sk.x, sk.y + 3, sh * 0.8, sw * 0.2);
    ctx.drawImage(spr, sk.x - sw / 2, sk.y + 3 - sh, sw, sh);
  }

  for (const pr of game.projectiles) {
    ctx.fillStyle = "#140c10";
    ctx.fillRect(pr.x - 3, pr.y - 3, 6, 6);
    ctx.fillStyle = pr.color;
    ctx.fillRect(pr.x - 2, pr.y - 2, 4, 4);
  }

  ctx.restore();

  if (game.phase === "paused") {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, w, h);
  }
}

export function gbcToScreen(game: Game, wx: number, wy: number, w: number, h: number) {
  const viewW = w / GBC_ZOOM;
  const viewH = h / GBC_ZOOM;
  const cam = gbcOrigin(game, viewW, viewH);
  return { x: (wx - cam.x) * GBC_ZOOM, y: (wy - cam.y) * GBC_ZOOM };
}

function wash(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number, hex: string, alpha: number, along: number) {
  const step = 460;
  const x0 = Math.floor((camX - 80) / step) * step;
  const y0 = Math.floor((camY - 80) / step) * step;
  const [r, g, b] = hexRgb(hex);
  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
  for (let x = x0; x < camX + viewW + step; x += step) {
    for (let y = y0; y < camY + viewH + step; y += step) {
      const jx = (hash(x + 4, y) - 0.5) * 180;
      const jy = (hash(x, y + 8) - 0.5) * 140;
      ctx.beginPath();
      ctx.ellipse(x + jx + along * 70, y + jy + along * 48, 170, 96, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function scatterPatches(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number, biome: BiomeId) {
  for (const step of [176, 268]) {
    const x0 = Math.floor((camX - 40) / step) * step;
    const y0 = Math.floor((camY - 40) / step) * step;
    for (let x = x0; x < camX + viewW + step; x += step) {
      for (let y = y0; y < camY + viewH + step; y += step) {
        const n = hash(x + step, y);
        if (n < 0.38) continue;
        const jx = (hash(x + 2, y + step) - 0.5) * step * 0.85;
        const jy = (hash(x, y + 6) - 0.5) * step * 0.7;
        const variant = Math.floor(hash(x + 9, y + 3) * 8);
        const spr = getGroundPatch(biome, variant);
        const sc = 0.75 + hash(x, y + 12) * 0.7;
        ctx.drawImage(spr, x + jx, y + jy, spr.width * sc * 0.55, spr.height * sc * 0.55);
      }
    }
  }
}

function scatterProps(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number, heroH: number) {
  const step = 240;
  const x0 = Math.floor((camX - 30) / step) * step;
  const y0 = Math.floor((camY - 30) / step) * step;
  for (let x = x0; x < camX + viewW + step; x += step) {
    for (let y = y0; y < camY + viewH + step; y += step) {
      if (hash(x, y) < 0.4) continue;
      const cx = x + (hash(x + 5, y) - 0.5) * 110;
      const cy = y + (hash(x, y + 7) - 0.5) * 80;
      const count = 2 + Math.floor(hash(x + 1, y + 2) * 3);
      for (let i = 0; i < count; i++) {
        const kind = PROPS[Math.floor(hash(x + i * 13, y + i) * PROPS.length)]!;
        const spr = getCryptoProp(kind);
        const tall = kind === "rack" ? 0.92 : kind === "fan" ? 0.48 : kind === "spool" ? 0.4 : 0.34;
        const dh = heroH * tall;
        const dw = dh * (spr.width / spr.height);
        const px = cx + (hash(x + 20 + i, y) - 0.5) * 46;
        const py = cy + (hash(x, y + 30 + i) - 0.5) * 28;
        const shadowLen = kind === "rack" ? dh * 1.35 : dh;
        castShadow(ctx, px, py, shadowLen, dw * 0.2);
        ctx.drawImage(spr, px - dw / 2, py - dh, dw, dh);
      }
    }
  }
}

function drawPickup(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number) {
  if (kind === "coin") {
    ctx.fillStyle = "#a87410";
    ctx.fillRect(x - 4, y - 3, 8, 7);
    ctx.fillStyle = "#f0b429";
    ctx.fillRect(x - 3, y - 4, 6, 6);
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(x - 2, y - 3, 2, 2);
    return;
  }
  if (kind === "health") {
    ctx.fillStyle = "#17321c";
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = "#7ee787";
    ctx.fillRect(x - 1, y - 3, 2, 6);
    ctx.fillRect(x - 3, y - 1, 6, 2);
    return;
  }
  if (kind === "buff") {
    ctx.fillStyle = "#3a2458";
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = "#d2a8ff";
    ctx.fillRect(x - 2, y - 3, 4, 6);
    return;
  }
  if (kind === "magnet") {
    ctx.fillStyle = "#16324a";
    ctx.fillRect(x - 4, y - 3, 8, 7);
    ctx.fillStyle = "#58a6ff";
    ctx.fillRect(x - 3, y - 3, 2, 5);
    ctx.fillRect(x + 1, y - 3, 2, 5);
    ctx.fillRect(x - 3, y + 1, 6, 2);
    return;
  }
  ctx.fillStyle = "#9be7ff";
  ctx.fillRect(x - 2, y - 2, 4, 4);
  ctx.fillStyle = "#f4feff";
  ctx.fillRect(x - 1, y - 2, 1, 1);
}

function drawStepRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  progress: number,
  color: string,
  live: boolean,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = live ? color : "rgba(232,238,248,0.35)";
  ctx.lineWidth = 1.6;
  ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (progress > 0.02) {
    ctx.beginPath();
    ctx.strokeStyle = "#f4fff8";
    ctx.lineWidth = 2.4;
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress));
    ctx.stroke();
  }
  ctx.restore();
}

function castShadow(ctx: CanvasRenderingContext2D, footX: number, footY: number, length: number, girth: number) {
  ctx.fillStyle = "rgba(18, 26, 14, 0.33)";
  ctx.beginPath();
  ctx.ellipse(footX + length * 0.34, footY + length * 0.26, Math.max(5, length * 0.48), Math.max(3, girth), 0.62, 0, Math.PI * 2);
  ctx.fill();
}

function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

function hash(x: number, y: number) {
  let n = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n >>> 0) / 4294967296;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
