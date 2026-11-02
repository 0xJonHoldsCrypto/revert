import * as THREE from "three";
import { ENEMIES } from "../data/enemies";
import { SIDEKICKS } from "../data/sidekicks";
import { getChestSprite, getCryptoProp, getMonsterSprite, getRigSprite, getWellSprite, type CryptoProp } from "../pixel/gbcArt";
import { getSideHero } from "../pixel/hdField";
import type { CharacterId, EnemyKind, SidekickKind } from "../types";

export type AtlasFrame = { u0: number; v0: number; u1: number; v1: number; aspect: number };

const ATLAS_SIZE = 2048;
const PADDING = 2;
const HEROES: CharacterId[] = ["keel", "nyx", "diff", "trace"];
export const PROP_KINDS: CryptoProp[] = ["rack", "spool", "fan", "cone"];

function opaqueBounds(source: HTMLCanvasElement) {
  const ctx = source.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, source.width, source.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! < 128) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function pixelCanvas(size: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  paint(c.getContext("2d")!);
  return c;
}

const PICKUPS: Record<string, HTMLCanvasElement> = {
  xp: pixelCanvas(12, (c) => {
    c.fillStyle = "#5fe9ff";
    c.fillRect(4, 1, 4, 10);
    c.fillRect(2, 3, 8, 6);
    c.fillStyle = "#e8fdff";
    c.fillRect(5, 2, 2, 4);
  }),
  coin: pixelCanvas(12, (c) => {
    c.fillStyle = "#a8690f";
    c.fillRect(3, 1, 6, 10);
    c.fillRect(1, 3, 10, 6);
    c.fillStyle = "#ffc23d";
    c.fillRect(3, 2, 6, 7);
    c.fillRect(2, 3, 8, 5);
    c.fillStyle = "#fff0b0";
    c.fillRect(4, 3, 2, 2);
  }),
  health: pixelCanvas(12, (c) => {
    c.fillStyle = "#123a1f";
    c.fillRect(1, 1, 10, 10);
    c.fillStyle = "#7ee787";
    c.fillRect(5, 2, 2, 8);
    c.fillRect(2, 5, 8, 2);
  }),
  buff: pixelCanvas(12, (c) => {
    c.fillStyle = "#3a2458";
    c.fillRect(1, 1, 10, 10);
    c.fillStyle = "#d2a8ff";
    c.fillRect(3, 3, 6, 6);
    c.fillStyle = "#fff";
    c.fillRect(4, 4, 2, 2);
  }),
  magnet: pixelCanvas(12, (c) => {
    c.fillStyle = "#58a6ff";
    c.fillRect(2, 2, 3, 8);
    c.fillRect(7, 2, 3, 8);
    c.fillRect(2, 8, 8, 2);
    c.fillStyle = "#f4feff";
    c.fillRect(2, 2, 3, 2);
    c.fillRect(7, 2, 3, 2);
  }),
};

export class SpriteAtlas {
  readonly texture: THREE.CanvasTexture;
  private frames = new Map<string, AtlasFrame>();
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private cursorX = PADDING;
  private cursorY = PADDING;
  private rowHeight = 0;

  constructor() {
    this.canvas.width = ATLAS_SIZE;
    this.canvas.height = ATLAS_SIZE;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    for (const id of HEROES) {
      this.add(`hero:${id}:0`, getSideHero(id, 0));
      this.add(`hero:${id}:1`, getSideHero(id, 1));
    }
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) this.add(`enemy:${kind}`, getMonsterSprite(kind));
    for (const kind of Object.keys(SIDEKICKS) as SidekickKind[]) this.add(`rig:${kind}`, getRigSprite(kind));
    for (const kind of PROP_KINDS) this.add(`prop:${kind}`, getCryptoProp(kind));
    this.add("chest", getChestSprite());
    this.add("well", getWellSprite());
    for (const [kind, sprite] of Object.entries(PICKUPS)) this.add(`pickup:${kind}`, sprite);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  frame(key: string): AtlasFrame {
    return this.frames.get(key) ?? this.frames.get("pickup:xp")!;
  }

  private add(key: string, source: HTMLCanvasElement) {
    const b = opaqueBounds(source);
    if (this.cursorX + b.w + PADDING > ATLAS_SIZE) {
      this.cursorX = PADDING;
      this.cursorY += this.rowHeight + PADDING;
      this.rowHeight = 0;
    }
    this.ctx.drawImage(source, b.x, b.y, b.w, b.h, this.cursorX, this.cursorY, b.w, b.h);
    this.frames.set(key, {
      u0: this.cursorX / ATLAS_SIZE,
      v0: 1 - (this.cursorY + b.h) / ATLAS_SIZE,
      u1: (this.cursorX + b.w) / ATLAS_SIZE,
      v1: 1 - this.cursorY / ATLAS_SIZE,
      aspect: b.w / b.h,
    });
    this.cursorX += b.w + PADDING;
    this.rowHeight = Math.max(this.rowHeight, b.h);
  }
}
