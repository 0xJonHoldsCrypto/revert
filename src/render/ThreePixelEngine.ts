import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { WORLD } from "../constants";
import { CHESTS, ENV_OBSTACLES, type BiomeId } from "../data/environment";
import { ENEMIES } from "../data/enemies";
import { RARITY_COLORS } from "../data/rarity";
import type { Game } from "../game/Game";
import { makeFloorCanvases } from "../pixel/floorTiles";
import type { Enemy } from "../types";
import { DECAL_BLOB, DECAL_RING, DecalBatch, FxBatch, MAX_POINT_LIGHTS, SpriteBatch, type SpriteLights } from "./batches";
import { GradeShader } from "./gradeShader";
import { DynamicResolution, pickQualityTier, QUALITY } from "./quality";
import { PROP_KINDS, SpriteAtlas } from "./SpriteAtlas";
import { cameraBasis, cameraDistance, groundHalfExtents, VIEW } from "./view";
import { readViewport } from "./viewport";

export type PixelEngine = {
  render(game: Game, dt: number, alpha: number): void;
  worldToScreen(x: number, y: number, w: number, h: number): { x: number; y: number } | null;
  stats(): { calls: number; triangles: number; scale: number; tier: string };
  dispose(): void;
};

const HERO_HEIGHT = 62;
const ENEMY_HEIGHT_PER_RADIUS = 3.1;
const BOSS_HEIGHT = 196;
const PROP_HEIGHT: Record<string, number> = { rack: 78, spool: 30, fan: 38, cone: 24 };
const SPRITE_CAPACITY = 2200;
const FX_CAPACITY = 900;
const DECAL_CAPACITY = 1400;
const TILE_WORLD_SIZE = 256;

const QUADRANTS: { biome: BiomeId; x: number; z: number }[] = [
  { biome: "wasteland", x: WORLD.width / 4, z: WORLD.height / 4 },
  { biome: "cex", x: (WORLD.width * 3) / 4, z: WORLD.height / 4 },
  { biome: "defi", x: WORLD.width / 4, z: (WORLD.height * 3) / 4 },
  { biome: "apt", x: (WORLD.width * 3) / 4, z: (WORLD.height * 3) / 4 },
];

const colorCache = new Map<string, THREE.Color>();
function cachedColor(style: string): THREE.Color {
  let c = colorCache.get(style);
  if (!c) {
    c = new THREE.Color(style);
    colorCache.set(style, c);
  }
  return c;
}

function hash(x: number, y: number) {
  let n = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n >>> 0) / 4294967296;
}

function lerpPos(prev: number | undefined, now: number, alpha: number) {
  return prev === undefined ? now : prev + (now - prev) * alpha;
}

function canvasTexture(canvas: HTMLCanvasElement, srgb: boolean, repeat: number) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return tex;
}

export async function createThreePixelEngine(canvas: HTMLCanvasElement): Promise<PixelEngine> {
  const tierName = pickQualityTier();
  const tier = QUALITY[tierName];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = tier.shadowSize > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.info.autoReset = false;
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);

  const ambient = new THREE.HemisphereLight(0x8f9cc8, 0x2a2430, 0.72);
  const moon = new THREE.DirectionalLight(0xc4e4ff, 3.4);
  moon.castShadow = tier.shadowSize > 0;
  if (tier.shadowSize > 0) {
    moon.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
    const cam = moon.shadow.camera;
    cam.left = -760;
    cam.right = 760;
    cam.top = 760;
    cam.bottom = -760;
    cam.near = 100;
    cam.far = 2600;
    moon.shadow.bias = -0.0006;
    moon.shadow.radius = 3;
  }
  scene.add(ambient, moon, moon.target);
  const moonOffset = new THREE.Vector3(-620, 880, 500);

  const pointLights: THREE.PointLight[] = [];
  for (let i = 0; i < tier.pointLights; i++) {
    const light = new THREE.PointLight(0xffffff, 0, 340, 1.1);
    scene.add(light);
    pointLights.push(light);
  }
  const spriteLights: SpriteLights = {
    ambient: new THREE.Color(0.62, 0.68, 0.92),
    key: new THREE.Color(0.55, 0.72, 0.9),
    pointPos: Array.from({ length: MAX_POINT_LIGHTS }, () => new THREE.Vector3(0, -9999, 0)),
    pointColor: Array.from({ length: MAX_POINT_LIGHTS }, () => new THREE.Color(0, 0, 0)),
  };

  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.width * 3, WORLD.height * 3),
    new THREE.MeshBasicMaterial({ color: 0x04060b })
  );
  under.rotation.x = -Math.PI / 2;
  under.position.set(WORLD.width / 2, -6, WORLD.height / 2);
  scene.add(under);

  QUADRANTS.forEach((q, i) => {
    const floor = makeFloorCanvases(q.biome, 4100 + i * 97);
    const repeat = WORLD.width / 2 / TILE_WORLD_SIZE;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.width / 2, WORLD.height / 2),
      new THREE.MeshStandardMaterial({
        map: canvasTexture(floor.albedo, true, repeat),
        emissiveMap: canvasTexture(floor.emissive, true, repeat),
        emissive: 0xffffff,
        emissiveIntensity: 1.5,
        roughness: 0.82,
        metalness: 0.1,
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(q.x, 0, q.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  const atlas = new SpriteAtlas();
  const sprites = new SpriteBatch(SPRITE_CAPACITY, atlas.texture, spriteLights);
  const fx = new FxBatch(FX_CAPACITY);
  const decals = new DecalBatch(DECAL_CAPACITY);
  scene.add(sprites.mesh, decals.mesh, fx.mesh);

  const obstacleGroup = new THREE.Group();
  scene.add(obstacleGroup);
  let obstacleSeed = -1;

  const camera = new THREE.PerspectiveCamera(VIEW.fovDeg, 1, 200, 5000);
  let camX = WORLD.width / 4;
  let camZ = WORLD.height / 4;
  let leadX = 0;
  let leadZ = 0;
  let shakeTime = 0;

  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 0 })
  );
  composer.addPass(new RenderPass(scene, camera));
  let bloom: UnrealBloomPass | null = null;
  if (tier.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.55, 1.0);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uTilt!.value = tier.tiltShift ? 1 : 0;
  composer.addPass(grade);

  const dynamicRes = new DynamicResolution();
  let lastW = 0;
  let lastH = 0;
  let lastPixelRatio = 0;
  let elapsed = 0;
  let aspect = 1;

  function resizeIfNeeded(w: number, h: number) {
    const pixelRatio = Math.min(readViewport(canvas).dpr, tier.maxDpr) * dynamicRes.scale;
    if (w === lastW && h === lastH && pixelRatio === lastPixelRatio) return;
    lastW = w;
    lastH = h;
    lastPixelRatio = pixelRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    grade.uniforms.uTexel!.value = [1 / (w * pixelRatio), 1 / (h * pixelRatio)];
  }

  function syncObstacles(game: Game) {
    if (obstacleSeed === game.worldSeed) return;
    obstacleSeed = game.worldSeed;
    for (const child of [...obstacleGroup.children]) {
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      obstacleGroup.remove(mesh);
    }
    for (const o of game.obstacles) {
      const def = ENV_OBSTACLES[o.kind];
      if (def.blocks) {
        const height = 44;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(o.width, height, o.height),
          new THREE.MeshStandardMaterial({
            color: 0x2a3142,
            roughness: 0.55,
            metalness: 0.5,
            emissive: new THREE.Color(def.color),
            emissiveIntensity: 0.32,
          })
        );
        mesh.position.set(o.x, height / 2, o.y);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        obstacleGroup.add(mesh);
      } else {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(o.width, o.height),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(def.color).multiplyScalar(1.5),
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
          })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(o.x, 0.5, o.y);
        mesh.renderOrder = 1;
        obstacleGroup.add(mesh);
      }
    }
  }

  function updateCamera(game: Game, x: number, y: number, dt: number) {
    const p = game.player;
    const targetLeadX = p.vx * 0.14;
    const targetLeadZ = p.vy * 0.14;
    const leadRate = Math.min(1, dt * 2.6);
    leadX += (targetLeadX - leadX) * leadRate;
    leadZ += (targetLeadZ - leadZ) * leadRate;
    const follow = Math.min(1, dt * 9);
    camX += (x + leadX - camX) * follow;
    camZ += (y + leadZ - camZ) * follow;

    shakeTime += dt;
    const trauma = Math.max(0, Math.min(1, game.shake * 2));
    const amount = trauma * trauma * 9;
    const sx = amount ? Math.sin(shakeTime * 71) * amount : 0;
    const sz = amount ? Math.sin(shakeTime * 89 + 1.3) * amount : 0;

    const d = cameraDistance(aspect);
    camera.position.set(camX + sx, cameraBasis.backY * d, camZ + sz + cameraBasis.backZ * d);
    camera.lookAt(camX + sx, 0, camZ + sz);

    if (tier.shadowSize > 0) {
      const texel = (moon.shadow.camera.right * 2) / tier.shadowSize;
      const anchorX = Math.round(x / (texel * 4)) * texel * 4;
      const anchorZ = Math.round(y / (texel * 4)) * texel * 4;
      moon.position.set(anchorX + moonOffset.x, moonOffset.y, anchorZ + moonOffset.z);
      moon.target.position.set(anchorX, 0, anchorZ);
    }
  }

  function emitProps(left: number, right: number, top: number, bottom: number) {
    const step = 240;
    const x0 = Math.floor(left / step) * step;
    const y0 = Math.floor(top / step) * step;
    for (let gx = x0; gx < right; gx += step) {
      for (let gy = y0; gy < bottom; gy += step) {
        if (hash(gx, gy) < 0.58) continue;
        const cx = gx + (hash(gx + 5, gy) - 0.5) * 120;
        const cy = gy + (hash(gx, gy + 7) - 0.5) * 120;
        const count = 1 + Math.floor(hash(gx + 1, gy + 2) * 3);
        for (let i = 0; i < count; i++) {
          const kind = PROP_KINDS[Math.floor(hash(gx + i * 13, gy + i) * PROP_KINDS.length)]!;
          const px = cx + (hash(gx + 20 + i, gy) - 0.5) * 58;
          const py = cy + (hash(gx, gy + 30 + i) - 0.5) * 44;
          if (px < 20 || py < 20 || px > WORLD.width - 20 || py > WORLD.height - 20) continue;
          const height = PROP_HEIGHT[kind]!;
          decals.push(px, py + 1, height * 0.42, height * 0.2, DECAL_BLOB, 0, BLACK, 0.5);
          sprites.push(atlas.frame(`prop:${kind}`), px, py, 0.5, height, hash(gx + i, gy + 40) > 0.5);
        }
      }
    }
  }

  const BLACK = new THREE.Color(0, 0, 0);
  const WHITE = new THREE.Color(1, 1, 1);
  const PLAYER_LIGHT = new THREE.Color(0.65, 0.95, 1);
  const CHEST_LIGHT = new THREE.Color(1, 0.72, 0.28);
  const BOSS_LIGHT = new THREE.Color(1, 0.16, 0.2);
  const XP_COLOR = new THREE.Color(0.25, 0.85, 1);
  const COIN_COLOR = new THREE.Color(1, 0.72, 0.16);
  const scratchLights: { x: number; y: number; h: number; color: THREE.Color; power: number }[] = [];

  function applyPointLights() {
    for (let i = 0; i < MAX_POINT_LIGHTS; i++) {
      const source = scratchLights[i];
      const three = pointLights[i];
      if (source && three) {
        three.position.set(source.x, source.h, source.y);
        three.color.copy(source.color);
        three.intensity = source.power * 180;
        spriteLights.pointPos[i]!.set(source.x, source.h, source.y);
        spriteLights.pointColor[i]!.copy(source.color).multiplyScalar(source.power * 0.9);
      } else {
        if (three) three.intensity = 0;
        spriteLights.pointColor[i]!.setRGB(0, 0, 0);
      }
    }
  }

  function enemyHeight(e: Enemy) {
    const def = ENEMIES[e.kind];
    return def.isBoss ? BOSS_HEIGHT : def.radius * ENEMY_HEIGHT_PER_RADIUS;
  }

  function renderWorld(game: Game, dt: number, alpha: number) {
    const p = game.player;
    const px = lerpPos(p.px, p.x, alpha);
    const py = lerpPos(p.py, p.y, alpha);
    syncObstacles(game);
    updateCamera(game, px, py, dt);

    const { halfW, halfH } = groundHalfExtents(aspect);
    const margin = 200;
    const left = camX - halfW * 1.3 - margin;
    const right = camX + halfW * 1.3 + margin;
    const top = camZ - halfH - margin;
    const bottom = camZ + halfH + margin;
    const inView = (x: number, y: number) => x > left && x < right && y > top && y < bottom;

    sprites.begin();
    fx.begin();
    decals.begin();
    scratchLights.length = 0;
    scratchLights.push({ x: px, y: py, h: 64, color: PLAYER_LIGHT, power: 1 });

    emitProps(left, right, top, bottom);

    const anim = elapsed;
    for (const c of game.chests) {
      if (c.opened || !inView(c.x, c.y)) continue;
      const def = CHESTS[c.kind];
      const live = p.coins >= c.coinCost;
      const ringColor = cachedColor(def.color);
      decals.push(c.x, c.y, c.radius, c.radius, DECAL_RING, c.openProgress / def.openTime, live ? ringColor : WHITE, live ? 0.95 : 0.35);
      decals.push(c.x, c.y + 1, 24, 12, DECAL_BLOB, 0, BLACK, 0.55);
      sprites.push(atlas.frame("chest"), c.x, c.y, 0.5, 34, false, 0, live ? 0.25 : 0);
      if (live && scratchLights.length < MAX_POINT_LIGHTS - 1) scratchLights.push({ x: c.x, y: c.y, h: 50, color: CHEST_LIGHT, power: 0.75 });
    }
    for (const w of game.wells) {
      if (w.used || !inView(w.x, w.y)) continue;
      decals.push(w.x, w.y, w.radius, w.radius, DECAL_RING, w.channelProgress / 1.35, cachedColor("#6cb6ff"), 0.9);
      decals.push(w.x, w.y + 1, 26, 12, DECAL_BLOB, 0, BLACK, 0.5);
      sprites.push(atlas.frame("well"), w.x, w.y, 0.5, 42, false, 0, 0.3);
    }

    for (const pk of game.pickups) {
      const x = lerpPos(pk.px, pk.x, alpha);
      const y = lerpPos(pk.py, pk.y, alpha);
      if (!inView(x, y)) continue;
      const hover = 6 + Math.sin(anim * 4 + pk.id) * 2;
      decals.push(x, y, 7, 4, DECAL_BLOB, 0, BLACK, 0.45);
      const isXp = pk.kind === "xp";
      sprites.push(atlas.frame(`pickup:${pk.kind}`), x, y, hover, isXp ? 13 : 15, false, 0, isXp ? 1.6 : 0.9);
      if (isXp || pk.kind === "coin") fx.push(x, y, hover + 6, 13, 13, 0, isXp ? XP_COLOR : COIN_COLOR, 0.45);
    }

    let bossLightSet = false;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const x = lerpPos(e.px, e.x, alpha);
      const y = lerpPos(e.py, e.y, alpha);
      if (!inView(x, y)) continue;
      const def = ENEMIES[e.kind];
      const height = enemyHeight(e);
      const hop = def.isBoss ? 0 : Math.abs(Math.sin(e.wobble * 2.4)) * 3;
      const squash = 1 + Math.sin(e.wobble * 4.8) * (def.isBoss ? 0.015 : 0.04);
      const frame = atlas.frame(`enemy:${e.kind}`);
      const width = height * frame.aspect;
      decals.push(x, y + 1, width * 0.5, width * 0.24, DECAL_BLOB, 0, BLACK, 0.55);
      sprites.push(frame, x, y, 0.5 + hop, height * squash, p.x < e.x, e.flash > 0 ? 1 : 0);
      if (def.isBoss && !bossLightSet) {
        bossLightSet = true;
        scratchLights.splice(1, 0, { x, y: y + 20, h: 130, color: BOSS_LIGHT, power: 1.4 });
      }
    }

    const moving = Math.hypot(p.vx, p.vy) > 20;
    const step = moving ? Math.floor(anim * 6.5) % 2 : 0;
    decals.push(px, py + 1, 19, 9, DECAL_BLOB, 0, BLACK, 0.65);
    const blink = p.invuln > 0 && p.dashTimer <= 0 && Math.floor(p.invuln * 20) % 2 === 0;
    if (!blink) {
      const bob = moving ? Math.abs(Math.sin(anim * 13)) * 2 : Math.sin(anim * 2.2) * 0.5;
      sprites.push(atlas.frame(`hero:${p.characterId}:${step}`), px, py, 0.5 + bob, HERO_HEIGHT, Math.cos(p.facing) < 0);
    }
    if (p.dashTimer > 0) {
      const color = PLAYER_LIGHT;
      fx.push(px, py, 26, 26, 60, Math.atan2(-p.vy * cameraBasis.backY, p.vx), color, 1.6, 0.8);
    }

    const sk = game.sidekickEntity;
    if (sk) {
      decals.push(sk.x, sk.y + 1, 11, 6, DECAL_BLOB, 0, BLACK, 0.45);
      sprites.push(atlas.frame(`rig:${sk.kind}`), sk.x, sk.y, 6, 26, false);
    }

    for (const pr of game.projectiles) {
      const x = lerpPos(pr.px, pr.x, alpha);
      const y = lerpPos(pr.py, pr.y, alpha);
      if (!inView(x, y)) continue;
      const color = cachedColor(pr.color);
      const angle = Math.atan2(-pr.vy * cameraBasis.backY, pr.vx);
      fx.push(x, y, 26, pr.radius * 3.4, pr.radius * 8, angle, color, 2.6);
    }

    for (const o of game.orbiters) {
      const w = game.weapons.find((v) => v.kind === o.weaponKind);
      const color = cachedColor(w ? RARITY_COLORS[w.rarity] : "#f0b429");
      fx.push(o.x, o.y, 26, o.radius * 3, o.radius * 3, 0, color, 2);
      decals.push(o.x, o.y, o.radius, o.radius * 0.6, DECAL_BLOB, 0, BLACK, 0.3);
    }

    for (const part of game.particles) {
      if (!inView(part.x, part.y)) continue;
      const life = part.life / part.maxLife;
      fx.push(part.x, part.y, 18, part.size * 2.6, part.size * 2.6, 0, cachedColor(part.color), 1.8, life);
    }

    applyPointLights();
    sprites.commit();
    fx.commit();
    decals.commit();
  }

  return {
    render(game: Game, dt: number, alpha: number) {
      elapsed += dt;
      const vp = readViewport(canvas);
      if (dynamicRes.update(dt * 1000)) lastPixelRatio = 0;
      resizeIfNeeded(vp.width, vp.height);
      if (!game.player) return;
      if (game.phase !== "paused" && game.phase !== "levelup") {
        renderWorld(game, dt, alpha);
      } else {
        renderWorld(game, 0, 1);
      }
      grade.uniforms.uTime!.value = elapsed;
      renderer.info.reset();
      composer.render(dt);
    },

    worldToScreen(x: number, y: number, w: number, h: number) {
      const v = scratchProject.set(x, 18, y).project(camera);
      if (v.z > 1) return null;
      return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
    },

    stats() {
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        scale: dynamicRes.scale,
        tier: tierName,
      };
    },

    dispose() {
      composer.dispose();
      renderer.dispose();
    },
  };
}

const scratchProject = new THREE.Vector3();
