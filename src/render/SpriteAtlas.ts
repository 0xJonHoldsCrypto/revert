import * as THREE from "three";
import { ENEMIES } from "../data/enemies";
import { SIDEKICKS } from "../data/sidekicks";
import { chestSprite, enemyFrame, hasHandEnemy, heroFrame, PICKUP_ART, pickupSprite, rigSprite, wellSprite } from "../pixel/handArt";
import { getThreatSprite, LANDMARKS, ZONE_PROPS } from "../pixel/threatArt";
import { CAMEO_KINDS, cameoSprite, interactableSprite, ITEM_KINDS } from "../pixel/worldArt";
import { CHESTS } from "../data/environment";
import type { CharacterId, ChestKind, EnemyKind, SidekickKind } from "../types";

export type AtlasFrame = { u0: number; v0: number; u1: number; v1: number; aspect: number; px: number };

const ATLAS_SIZE = 2048;
const PADDING = 2;
const HEROES: CharacterId[] = ["keel", "nyx", "diff", "trace"];

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
      this.add(`hero:${id}:0`, heroFrame(id, 0));
      this.add(`hero:${id}:1`, heroFrame(id, 1));
    }
    for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
      this.add(`enemy:${kind}:0`, hasHandEnemy(kind) ? enemyFrame(kind, 0) : getThreatSprite(kind));
      this.add(`enemy:${kind}:1`, hasHandEnemy(kind) ? enemyFrame(kind, 1) : getThreatSprite(kind));
    }
    for (const kind of Object.keys(SIDEKICKS) as SidekickKind[]) this.add(`rig:${kind}`, rigSprite(kind));
    for (const props of Object.values(ZONE_PROPS)) {
      for (const prop of props) this.add(`prop:${prop.key}`, prop.art());
    }
    for (const mark of LANDMARKS) this.add(`landmark:${mark.key}`, mark.art());
    for (const kind of Object.keys(CHESTS) as ChestKind[]) this.add(`chest:${kind}`, chestSprite(kind));
    this.add("well", wellSprite());
    for (const kind of ITEM_KINDS) this.add(`item:${kind}`, interactableSprite(kind));
    for (const id of CAMEO_KINDS) this.add(`cameo:${id}`, cameoSprite(id));
    for (const kind of Object.keys(PICKUP_ART)) this.add(`pickup:${kind}`, pickupSprite(kind));

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
      px: b.h,
    });
    this.cursorX += b.w + PADDING;
    this.rowHeight = Math.max(this.rowHeight, b.h);
  }
}
