import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { biomeAt, biomeOfFloorCell, CHESTS, ENV_OBSTACLES, FLOOR_CELL, type BiomeId } from "../data/environment";
import { ENEMIES } from "../data/enemies";
import { CutscenePlayer } from "../cutscene/CutscenePlayer";
import type { Game } from "../game/Game";
import { makeFloorCanvases } from "../pixel/floorTiles";
import { LANDMARKS, ZONE_PROPS } from "../pixel/threatArt";
import { CAMEOS } from "../data/cameos";
import { CHANNEL_SEC } from "../game/interact";
import { ARC_LIFE_SEC } from "../game/Game";
import { FRONTRUN_WINDUP_SEC, isHiddenFromWeapons } from "../game/threats";
import { vaultFill } from "../game/tools";
import { AFFIXES } from "../data/affixes";
import type { CharacterId, EnemyKind, InteractableKind } from "../types";
import type { WeaponKind } from "../types";
import { DECAL_ARC, DECAL_BLOB, DECAL_DISC, DECAL_RECT, DECAL_RING, DecalBatch, FxBatch, MAX_POINT_LIGHTS, SpriteBatch, type SpriteLights } from "./batches";
import { GradeShader, setColorblind } from "./gradeShader";
import type { ColorblindMode } from "../save";
import { canPromoteToHigh, DynamicResolution, pickQualityTier, QUALITY, TierPromoter } from "./quality";
import { SpriteAtlas, type AtlasFrame } from "./SpriteAtlas";
import { cameraBasis, cameraDistance, groundHalfExtents, VIEW } from "./view";
import { readViewport } from "./viewport";

export type PixelEngine = {
  render(game: Game, dt: number, alpha: number): void;
  worldToScreen(x: number, y: number, w: number, h: number): { x: number; y: number } | null;
  stats(): { calls: number; triangles: number; scale: number; tier: string };
  dispose(): void;
};

const PIXEL_SIZE = 2.25;
const BOSS_HEIGHT = 196;
const SPRITE_CAPACITY = 2200;
const FX_CAPACITY = 900;
const DECAL_CAPACITY = 1400;
const TILE_WORLD_SIZE = 256;
const PROJECTILE_LOOK: Partial<Record<WeaponKind, { width: number; length: number; glow: number; trail: number }>> = {
  "audit-dart": { width: 7, length: 30, glow: 2.8, trail: 2 },
  "finality-beam": { width: 8, length: 74, glow: 3.6, trail: 1 },
  "patch-burst": { width: 15, length: 15, glow: 2.6, trail: 2 },
  "bridge-bolt": { width: 9, length: 52, glow: 3.4, trail: 3 },
  "nonce-shard": { width: 12, length: 24, glow: 2.6, trail: 2 },
  "merkle-proof": { width: 16, length: 16, glow: 3, trail: 2 },
  "whale-alert": { width: 13, length: 92, glow: 4, trail: 2 },
};
const ORBITER_COLOR: Partial<Record<WeaponKind, string>> = {
  "stable-shield": "#5de2b8",
  "rug-coin": "#ffc23d",
  "validator-seal": "#9b8cff",
};

const FLOOR_BIOMES: BiomeId[] = ["mempool", "vault", "bridge", "forest"];
const FLOOR_RADIUS_CELLS = 2;
const FLOOR_CELL_COUNT = (FLOOR_RADIUS_CELLS * 2 + 1) ** 2;
const MOTE_COUNT = 34;
const LP_POOL_CHARGE = 70;
const ITEM_RING: Record<InteractableKind, string> = {
  "staking-pad": "#ffc23d",
  "merge-contract": "#b58cff",
  "hardware-rack": "#79c0ff",
  faucet: "#6cb6ff",
  "lp-pool": "#2ee6c7",
  "bridge-gate": "#b58cff",
  "exploit-charge": "#ff5c48",
  "bounty-board": "#ffc23d",
  airdrop: "#f4f3ee",
  cameo: "#ffffff",
};
const BIOME_MOTE: Record<BiomeId, string> = { mempool: "#2ee6c7", vault: "#ffc23d", bridge: "#7ee0ff", forest: "#b58cff" };
const DEFAULT_LOOK = { width: 10, length: 20, glow: 2.6, trail: 2 };
const LANDMARK_HEIGHT = new Map(LANDMARKS.map((m) => [m.key, m.height]));

const colorCache = new Map<string, THREE.Color>();
let lastStyle = "";
let lastColor: THREE.Color | undefined;
function cachedColor(style: string): THREE.Color {
  if (style === lastStyle && lastColor) return lastColor;
  let c = colorCache.get(style);
  if (!c) {
    c = new THREE.Color(style);
    colorCache.set(style, c);
  }
  lastStyle = style;
  lastColor = c;
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
  let tierName = pickQualityTier();
  let tier = QUALITY[tierName];
  const promoter = new TierPromoter(tierName === "medium" && canPromoteToHigh());
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
    ambient: new THREE.Color(0.46, 0.5, 0.66),
    key: new THREE.Color(0.36, 0.44, 0.52),
    pointPos: Array.from({ length: MAX_POINT_LIGHTS }, () => new THREE.Vector3(0, -9999, 0)),
    pointColor: Array.from({ length: MAX_POINT_LIGHTS }, () => new THREE.Color(0, 0, 0)),
  };

  const floorGeometry = new THREE.PlaneGeometry(FLOOR_CELL, FLOOR_CELL);
  floorGeometry.rotateX(-Math.PI / 2);
  const floorRepeat = FLOOR_CELL / TILE_WORLD_SIZE;
  const floorMeshes = new Map<BiomeId, THREE.InstancedMesh>();
  FLOOR_BIOMES.forEach((biome, i) => {
    const floor = makeFloorCanvases(biome, 4100 + i * 97);
    const mesh = new THREE.InstancedMesh(
      floorGeometry,
      new THREE.MeshLambertMaterial({
        map: canvasTexture(floor.albedo, true, floorRepeat),
        emissiveMap: canvasTexture(floor.emissive, true, floorRepeat),
        emissive: 0xffffff,
        emissiveIntensity: 1.5,
      }),
      FLOOR_CELL_COUNT
    );
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    floorMeshes.set(biome, mesh);
  });
  let floorCellX = NaN;
  let floorCellY = NaN;
  let floorStream: unknown = null;
  const floorMatrix = new THREE.Matrix4();

  function syncFloor(game: Game) {
    const cx = Math.floor(camX / FLOOR_CELL);
    const cy = Math.floor(camZ / FLOOR_CELL);
    if (cx === floorCellX && cy === floorCellY && floorStream === game.stream) return;
    floorCellX = cx;
    floorCellY = cy;
    floorStream = game.stream;
    for (const mesh of floorMeshes.values()) mesh.count = 0;
    for (let ox = -FLOOR_RADIUS_CELLS; ox <= FLOOR_RADIUS_CELLS; ox++) {
      for (let oy = -FLOOR_RADIUS_CELLS; oy <= FLOOR_RADIUS_CELLS; oy++) {
        const mesh = floorMeshes.get(biomeOfFloorCell(cx + ox, cy + oy))!;
        floorMatrix.makeTranslation((cx + ox + 0.5) * FLOOR_CELL, 0, (cy + oy + 0.5) * FLOOR_CELL);
        mesh.setMatrixAt(mesh.count++, floorMatrix);
      }
    }
    for (const mesh of floorMeshes.values()) mesh.instanceMatrix.needsUpdate = true;
  }

  const atlas = new SpriteAtlas();
  const frameCache = new Map<string, Map<string, AtlasFrame>>();
  function frameOf(prefix: string, id: string): AtlasFrame {
    let group = frameCache.get(prefix);
    if (!group) {
      group = new Map();
      frameCache.set(prefix, group);
    }
    let frame = group.get(id);
    if (!frame) {
      frame = atlas.frame(`${prefix}:${id}`);
      group.set(id, frame);
    }
    return frame;
  }
  const enemyFrames = new Map<EnemyKind, [AtlasFrame, AtlasFrame]>();
  for (const kind of Object.keys(ENEMIES) as EnemyKind[]) enemyFrames.set(kind, [atlas.frame(`enemy:${kind}:0`), atlas.frame(`enemy:${kind}:1`)]);
  const heroFrames = new Map<CharacterId, [AtlasFrame, AtlasFrame]>();
  function heroFrameOf(id: CharacterId, step: number): AtlasFrame {
    let pair = heroFrames.get(id);
    if (!pair) {
      pair = [atlas.frame(`hero:${id}:0`), atlas.frame(`hero:${id}:1`)];
      heroFrames.set(id, pair);
    }
    return pair[step]!;
  }
  const sprites = new SpriteBatch(SPRITE_CAPACITY, atlas.texture, spriteLights);
  const fx = new FxBatch(FX_CAPACITY);
  const decals = new DecalBatch(DECAL_CAPACITY);
  scene.add(sprites.mesh, decals.mesh, fx.mesh);

  const obstacleGroup = new THREE.Group();
  scene.add(obstacleGroup);
  let obstacleStream: unknown = null;
  let obstacleVersion = -1;
  const obstacleBox = new THREE.BoxGeometry(1, 1, 1);
  const obstaclePlane = new THREE.PlaneGeometry(1, 1);
  const obstacleMaterials = new Map<string, THREE.Material>();
  function obstacleMaterial(color: string, blocks: boolean): THREE.Material {
    let material = obstacleMaterials.get(color);
    if (!material) {
      material = blocks
        ? new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.55, metalness: 0.5, emissive: new THREE.Color(color), emissiveIntensity: 0.32 })
        : new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, opacity: 0.3, depthWrite: false });
      obstacleMaterials.set(color, material);
    }
    return material;
  }
  const obstacleLayers = new Map<string, THREE.InstancedMesh>();
  const obstacleCounts = new Map<string, number>();
  const obstacleMatrix = new THREE.Matrix4();
  const obstacleQuat = new THREE.Quaternion();
  const obstacleFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const obstacleScale = new THREE.Vector3();
  const obstaclePos = new THREE.Vector3();

  function obstacleLayer(kind: string, needed: number): THREE.InstancedMesh {
    let mesh = obstacleLayers.get(kind);
    if (mesh && mesh.instanceMatrix.count >= needed) return mesh;
    const def = ENV_OBSTACLES[kind as keyof typeof ENV_OBSTACLES];
    if (mesh) {
      obstacleGroup.remove(mesh);
      mesh.dispose();
    }
    const capacity = Math.max(needed, mesh ? mesh.instanceMatrix.count * 2 : 32);
    mesh = new THREE.InstancedMesh(def.blocks ? obstacleBox : obstaclePlane, obstacleMaterial(def.color, def.blocks), capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    if (def.blocks) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    } else {
      mesh.renderOrder = 1;
    }
    obstacleGroup.add(mesh);
    obstacleLayers.set(kind, mesh);
    return mesh;
  }

  const camera = new THREE.PerspectiveCamera(VIEW.fovDeg, 1, 200, 5000);
  let camX = 0;
  let camZ = 0;
  let leadX = 0;
  let leadZ = 0;
  let shakeTime = 0;

  const cutscenePlayer = new CutscenePlayer();
  const dashTrail: { x: number; y: number; frame: AtlasFrame; flip: boolean }[] = [];
  let dashTrailTick = 0;

  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 0 })
  );
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  let bloom: UnrealBloomPass | null = null;
  function addBloom() {
    const pass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.5, 1.2);
    const fullSetSize = pass.setSize.bind(pass);
    pass.setSize = (w: number, h: number) => fullSetSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    bloom = pass;
    composer.insertPass(pass, 1);
  }
  if (tier.bloom) addBloom();
  const grade = new ShaderPass(GradeShader);
  grade.material.toneMapped = false;
  grade.uniforms.uTilt!.value = tier.tiltShift ? 1 : 0;
  grade.uniforms.toneMappingExposure!.value = renderer.toneMappingExposure;
  composer.addPass(grade);

  function applyShadowSize() {
    moon.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
    moon.shadow.map?.dispose();
    moon.shadow.map = null;
  }

  function setTier(next: "medium" | "high") {
    tierName = next;
    tier = QUALITY[next];
    applyShadowSize();
    while (pointLights.length < tier.pointLights) {
      const light = new THREE.PointLight(0xffffff, 0, 340, 1.1);
      scene.add(light);
      pointLights.push(light);
    }
    if (tier.bloom && !bloom) addBloom();
    if (bloom) bloom.enabled = tier.bloom;
  }

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
    if (obstacleStream === game.stream && obstacleVersion === game.stream.version) return;
    obstacleStream = game.stream;
    obstacleVersion = game.stream.version;
    obstacleCounts.clear();
    for (const o of game.obstacles) obstacleCounts.set(o.kind, (obstacleCounts.get(o.kind) ?? 0) + 1);
    for (const [kind, needed] of obstacleCounts) obstacleLayer(kind, needed);
    for (const mesh of obstacleLayers.values()) mesh.count = 0;
    for (const o of game.obstacles) {
      const def = ENV_OBSTACLES[o.kind];
      const mesh = obstacleLayers.get(o.kind)!;
      if (def.blocks) {
        obstacleScale.set(o.width, 44, o.height);
        obstaclePos.set(o.x, 22, o.y);
        obstacleMatrix.compose(obstaclePos, obstacleQuat, obstacleScale);
      } else {
        obstacleScale.set(o.width, o.height, 1);
        obstaclePos.set(o.x, 0.5, o.y);
        obstacleMatrix.compose(obstaclePos, obstacleFlat, obstacleScale);
      }
      mesh.setMatrixAt(mesh.count++, obstacleMatrix);
    }
    for (const mesh of obstacleLayers.values()) mesh.instanceMatrix.needsUpdate = true;
  }

  function updateCamera(game: Game, x: number, y: number, dt: number) {
    const p = game.player;
    const targetLeadX = p.vx * 0.14;
    const targetLeadZ = p.vy * 0.14;
    const leadRate = Math.min(1, dt * 2.6);
    leadX += (targetLeadX - leadX) * leadRate;
    leadZ += (targetLeadZ - leadZ) * leadRate;
    const follow = Math.min(1, dt * 9);
    const focus = game.cameraFocus;
    const goalX = focus ? x + (focus.x - x) * focus.weight : x + leadX;
    const goalZ = focus ? y + (focus.y - y) * focus.weight : y + leadZ;
    camX += (goalX - camX) * follow;
    camZ += (goalZ - camZ) * follow;

    shakeTime += dt;
    const trauma = Math.max(0, Math.min(1, game.shake));
    const amount = trauma * trauma * 13;
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

  function emitProps(left: number, right: number, top: number, bottom: number, occludeX: number, occludeY: number) {
    const step = 240;
    const x0 = Math.floor(left / step) * step;
    const y0 = Math.floor(top / step) * step;
    for (let gx = x0; gx < right; gx += step) {
      for (let gy = y0; gy < bottom; gy += step) {
        if (hash(gx, gy) < 0.46) continue;
        const cx = gx + (hash(gx + 5, gy) - 0.5) * 120;
        const cy = gy + (hash(gx, gy + 7) - 0.5) * 120;
        const count = 1 + Math.floor(hash(gx + 1, gy + 2) * 3);
        for (let i = 0; i < count; i++) {
          const px = cx + (hash(gx + 20 + i, gy) - 0.5) * 58;
          const py = cy + (hash(gx, gy + 30 + i) - 0.5) * 44;
          const props = ZONE_PROPS[biomeAt(px, py)];
          const prop = props[Math.floor(hash(gx + i * 13, gy + i) * props.length)]!;
          if (Math.abs(px - occludeX) < 70 && occludeY < py && py - occludeY < prop.height) continue;
          const frame = frameOf("prop", prop.key);
          decals.push(px, py + 1, prop.height * frame.aspect * 0.55, prop.height * 0.18, DECAL_BLOB, 0, BLACK, 0.5);
          sprites.push(frame, px, py, 0.5, prop.height, !prop.key.endsWith("-sign") && hash(gx + i, gy + 40) > 0.5);
        }
      }
    }
  }

  function emitBiomeSeams(left: number, right: number, top: number, bottom: number) {
    const x0 = Math.floor(left / FLOOR_CELL);
    const x1 = Math.floor(right / FLOOR_CELL);
    const y0 = Math.floor(top / FLOOR_CELL);
    const y1 = Math.floor(bottom / FLOOR_CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const here = biomeOfFloorCell(cx, cy);
        const wx = cx * FLOOR_CELL;
        const wy = cy * FLOOR_CELL;
        const glow = cachedColor(BIOME_MOTE[here]);
        if (biomeOfFloorCell(cx + 1, cy) !== here) {
          decals.push(wx + FLOOR_CELL, wy + FLOOR_CELL / 2, 20, FLOOR_CELL / 2, DECAL_RECT, 1, BLACK, 0.72);
          decals.push(wx + FLOOR_CELL, wy + FLOOR_CELL / 2, 2.5, FLOOR_CELL / 2, DECAL_RECT, 1, glow, 0.75);
        }
        if (biomeOfFloorCell(cx, cy + 1) !== here) {
          decals.push(wx + FLOOR_CELL / 2, wy + FLOOR_CELL, FLOOR_CELL / 2, 20, DECAL_RECT, 1, BLACK, 0.72);
          decals.push(wx + FLOOR_CELL / 2, wy + FLOOR_CELL, FLOOR_CELL / 2, 2.5, DECAL_RECT, 1, glow, 0.75);
        }
      }
    }
  }

  function emitMotes(left: number, right: number, top: number, bottom: number) {
    const spanX = right - left;
    const spanY = bottom - top;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const drift = elapsed * (6 + hash(i, 3) * 14);
      const wx = left + ((hash(i, 1) * 4000 + drift) % spanX);
      const wy = top + ((hash(i, 2) * 4000 - drift * 0.6 + 8000) % spanY);
      const color = cachedColor(BIOME_MOTE[biomeAt(wx, wy)]);
      fx.push(wx, wy, 26 + hash(i, 4) * 90, 5, 5, 0, color, 0.8 + Math.sin(elapsed * 2 + i) * 0.4, 0.55);
    }
  }

  const BLACK = new THREE.Color(0, 0, 0);
  const scratchColor = new THREE.Color();
  const WHITE = new THREE.Color(1, 1, 1);
  const PLAYER_LIGHT = new THREE.Color(0.65, 0.95, 1);
  const CHEST_LIGHT = new THREE.Color(1, 0.72, 0.28);
  const BOSS_LIGHT = new THREE.Color(1, 0.16, 0.2);
  const XP_COLOR = new THREE.Color(0.25, 0.85, 1);
  const PHISH_TELL = new THREE.Color(1, 0.12, 0.1);
  const TETHER_COLOR = new THREE.Color(0.6, 0.3, 1);
  const COIN_COLOR = new THREE.Color(1, 0.72, 0.16);
  const SHIELD_COLOR = new THREE.Color("#9fd2ff");
  const DRAIN_COLOR = new THREE.Color("#d05cff");
  const BLINK_COLOR = new THREE.Color("#e6f03c");
  const VAULT_COLOR = new THREE.Color("#9fe8ff");
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

  function enemyHeight(px: number, isBoss: boolean | undefined) {
    return isBoss ? BOSS_HEIGHT : px * PIXEL_SIZE;
  }

  function renderWorld(game: Game, dt: number, alpha: number) {
    const cueShapes = game.cosmetics.colorblind !== "off";
    const p = game.player;
    const px = lerpPos(p.px, p.x, alpha);
    const py = lerpPos(p.py, p.y, alpha);
    syncObstacles(game);
    updateCamera(game, px, py, dt);
    syncFloor(game);

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

    emitProps(left, right, top, bottom, px, py);
    emitBiomeSeams(left, right, top, bottom);
    emitMotes(left, right, top, bottom);
    for (const mark of game.landmarks) {
      if (!inView(mark.x, mark.y)) continue;
      const height = LANDMARK_HEIGHT.get(mark.key) ?? 280;
      const frame = frameOf("landmark", mark.key);
      decals.push(mark.x, mark.y + 2, height * frame.aspect * 0.6, height * 0.22, DECAL_BLOB, 0, BLACK, 0.6);
      sprites.push(frame, mark.x, mark.y, 0.5, height, false, 0, 0.15);
    }

    const anim = elapsed;
    for (const c of game.chests) {
      if (c.opened || !inView(c.x, c.y)) continue;
      const def = CHESTS[c.kind];
      const live = p.coins >= game.chestCost(c.coinCost);
      const ringColor = cachedColor(def.color);
      decals.push(c.x, c.y, c.radius, c.radius, DECAL_RING, c.openProgress / def.openTime, live ? ringColor : WHITE, live ? 0.95 : 0.35);
      decals.push(c.x, c.y + 1, 24, 12, DECAL_BLOB, 0, BLACK, 0.55);
      const chestFrame = frameOf("chest", c.kind);
      sprites.push(chestFrame, c.x, c.y, 0.5, chestFrame.px * PIXEL_SIZE, false, 0, live ? 0.25 : 0);
      if (live && scratchLights.length < MAX_POINT_LIGHTS - 1) scratchLights.push({ x: c.x, y: c.y, h: 50, color: CHEST_LIGHT, power: 0.75 });
    }
    for (const w of game.wells) {
      if (w.used || !inView(w.x, w.y)) continue;
      decals.push(w.x, w.y, w.radius, w.radius, DECAL_RING, w.channelProgress / 1.35, cachedColor("#6cb6ff"), 0.9);
      decals.push(w.x, w.y + 1, 26, 12, DECAL_BLOB, 0, BLACK, 0.5);
      const wellFrame = frameOf("well", "");
      sprites.push(wellFrame, w.x, w.y, 0.5, wellFrame.px * PIXEL_SIZE, false, 0, 0.3);
    }

    for (const item of game.interactables) {
      if (item.used || !inView(item.x, item.y)) continue;
      const ready = game.elapsed >= item.readyAt;
      const ringColor = item.cameo ? cachedColor(CAMEOS[item.cameo].color) : cachedColor(ITEM_RING[item.kind]);
      const filled = item.kind === "lp-pool" ? 1 - (item.charge ?? 0) / LP_POOL_CHARGE : item.progress / CHANNEL_SEC[item.kind];
      decals.push(item.x, item.y, item.radius, item.radius, DECAL_RING, filled, ready ? ringColor : WHITE, ready ? 0.95 : 0.25);
      decals.push(item.x, item.y + 1, 26, 12, DECAL_BLOB, 0, BLACK, 0.5);
      const itemFrame = item.cameo ? frameOf("cameo", item.cameo) : frameOf("item", item.kind);
      const bob = item.cameo ? Math.abs(Math.sin(elapsed * 3)) * 3 : 0;
      sprites.push(itemFrame, item.x, item.y, 0.5 + bob + (item.lift ?? 0), itemFrame.px * PIXEL_SIZE, false, 0, ready ? 0.3 : 0);
      if (item.cameo && scratchLights.length < MAX_POINT_LIGHTS - 1) scratchLights.push({ x: item.x, y: item.y, h: 60, color: ringColor, power: 1 });
    }

    for (const pk of game.pickups) {
      const x = lerpPos(pk.px, pk.x, alpha);
      const y = lerpPos(pk.py, pk.y, alpha);
      if (!inView(x, y)) continue;
      const hover = 6 + Math.sin(anim * 4 + pk.id) * 2;
      decals.push(x, y, 7, 4, DECAL_BLOB, 0, BLACK, 0.45);
      const isXp = pk.kind === "xp";
      const pickupFrame = frameOf("pickup", pk.kind);
      sprites.push(pickupFrame, x, y, hover, pickupFrame.px * 1.9, false, 0, isXp ? 1.6 : 0.9);
      if (isXp || pk.kind === "coin") fx.push(x, y, hover + 6, 13, 13, 0, isXp ? XP_COLOR : COIN_COLOR, 0.45);
    }

    let bossLightSet = false;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const x = lerpPos(e.px, e.x, alpha);
      const y = lerpPos(e.py, e.y, alpha);
      if (!inView(x, y)) continue;
      const def = ENEMIES[e.kind];
      const hop = def.isBoss ? 0 : Math.abs(Math.sin(e.wobble * 2.4)) * 3;
      const squash = 1 + Math.sin(e.wobble * 4.8) * (def.isBoss ? 0.015 : 0.04);
      if (e.kind === "phishing-bot" && !e.revealed) {
        const hover = 6 + Math.sin(anim * 4 + e.id) * 2;
        const flicker = Math.floor(anim * 3 + e.id) % 7 === 0;
        decals.push(x, y, 7, 4, DECAL_BLOB, 0, BLACK, 0.45);
        const shard = frameOf("pickup", "xp");
        sprites.push(shard, x, y, hover, shard.px * 1.9, false, flicker ? 0.25 : 0, 1.6);
        fx.push(x, y, hover + 6, 13, 13, 0, flicker ? PHISH_TELL : XP_COLOR, 0.45);
        continue;
      }
      if (p.characterId === "nyx" && isHiddenFromWeapons(e)) {
        decals.push(x, y, 26, 26, DECAL_RING, 1, PHISH_TELL, 0.9);
        if (cueShapes) decals.push(x, y, 17, 17, DECAL_RING, 1, WHITE, 0.9);
      }
      if (e.kind === "honeypot-mimic" && !e.revealed) {
        const coin = frameOf("pickup", "coin");
        decals.push(x, y, 7, 4, DECAL_BLOB, 0, BLACK, 0.45);
        sprites.push(coin, x, y, 6 + Math.sin(anim * 4 + e.id) * 2, coin.px * 1.9, false, 0, 0.9);
        fx.push(x, y, 12, 13, 13, 0, COIN_COLOR, 0.45);
        continue;
      }
      const frame = enemyFrames.get(e.kind)![Math.floor(e.wobble * 1.6) % 2]!;
      const height = enemyHeight(frame.px, def.isBoss) * (e.scale ?? 1);
      if (e.elite) decals.push(x, y, e.radius * 1.5, e.radius * 1.5, DECAL_RING, 1, COIN_COLOR, 0.9);
      if (e.affixes) {
        for (let i = 0; i < e.affixes.length; i++) {
          const ring = e.radius * (1.75 + i * 0.22);
          decals.push(x, y, ring, ring, DECAL_RING, 1, cachedColor(AFFIXES[e.affixes[i]!].color), 0.85);
        }
        if ((e.shield ?? 0) > 0) decals.push(x, y, e.radius * 2.3, e.radius * 2.3, DECAL_RING, (e.shield ?? 0) / Math.max(1, e.shieldMax ?? 1), SHIELD_COLOR, 0.95);
      }
      if ((e.drainUntil ?? 0) > game.elapsed) fx.push(x, y, 14, 20, 20, 0, DRAIN_COLOR, 1.1, 0.6);
      if (e.blink) {
        decals.push(e.blink.x, e.blink.y, 24, 24, DECAL_RING, 1 - e.blink.t / FRONTRUN_WINDUP_SEC, BLINK_COLOR, 0.95);
        fx.push(e.blink.x, e.blink.y, 10, 16, 16, 0, BLINK_COLOR, 1.4, 0.7);
      }
      const width = height * frame.aspect;
      if (e.kind === "bridge-drainer" && e.tether !== undefined) {
        const cos = Math.cos(e.tether);
        const sin = Math.sin(e.tether);
        for (let i = 0; i < 16; i++) {
          const travel = ((anim * 1.8 + i / 16) % 1) * 640;
          fx.push(x + cos * travel, y + sin * travel, 18, 11, 11, 0, i % 3 === 0 ? COIN_COLOR : TETHER_COLOR, 1.3, 0.9);
        }
      }
      const lift = e.lift ?? 0;
      decals.push(x, y + 1, width * 0.5 * (lift > 0 ? 0.6 : 1), width * 0.24 * (lift > 0 ? 0.6 : 1), DECAL_BLOB, 0, BLACK, lift > 0 ? 0.3 : 0.55);
      const frozen = game.elapsed < (e.frozenUntil ?? 0);
      sprites.push(frame, x, y, frozen ? 0.5 + lift : 0.5 + hop + lift, height * squash, p.x < e.x, e.flash > 0 ? 1 : frozen ? 0.45 : 0, e.elite ? 0.25 : 0, 1, def.isBoss);
      if (def.isBoss && !bossLightSet) {
        bossLightSet = true;
        scratchLights.splice(1, 0, { x, y: y + 20, h: 130, color: BOSS_LIGHT, power: 1.4 });
      }
    }

    for (const h of game.hazards) {
      if (!inView(h.x, h.y) && h.shape !== "beam") continue;
      const f = Math.min(1, h.t / h.windup);
      const live = h.t >= h.windup;
      const color = cachedColor(h.color);
      if (h.shape === "circle" && h.ring) {
        const r = h.r ?? 40;
        decals.push(h.x, h.y, r, r, DECAL_RING, live ? 1 : f, scratchColor.copy(color).multiplyScalar(live ? 2.6 : 1.4), live ? 1 : 0.6);
        decals.push(h.x, h.y, r + 10, r + 10, DECAL_RING, 1, color, live ? 0.7 : 0.25);
        if (cueShapes) decals.push(h.x, h.y, r - 10, r - 10, DECAL_RING, 1, WHITE, live ? 0.9 : 0.4);
      } else if (h.shape === "circle") {
        const r = h.r ?? 40;
        decals.push(h.x, h.y, r, r, DECAL_DISC, 0, scratchColor.copy(color).multiplyScalar(1.4), 0.25 + f * 0.25);
        decals.push(h.x, h.y, r * f, r * f, DECAL_DISC, 0, scratchColor.copy(color).multiplyScalar(2.2), 0.7);
        if (cueShapes) decals.push(h.x, h.y, r, r, DECAL_RING, 1, WHITE, live ? 1 : 0.6);
      } else if (h.shape === "rect") {
        const w = h.w ?? 100;
        const hh = h.h ?? 100;
        decals.push(h.x, h.y, w / 2, hh / 2, DECAL_RECT, f, scratchColor.copy(color).multiplyScalar(1.8), 0.55);
        if (h.bars) {
          const off = (1 - f) * (h.bars.vertical ? w : hh) * 0.5;
          const dx = h.bars.vertical ? off : 0;
          const dy = h.bars.vertical ? 0 : off;
          decals.push(h.x - dx, h.y - dy, h.bars.w / 2, h.bars.h / 2, DECAL_RECT, 1, scratchColor.copy(color).multiplyScalar(2.6), 0.9);
          decals.push(h.x + dx, h.y + dy, h.bars.w / 2, h.bars.h / 2, DECAL_RECT, 1, scratchColor.copy(color).multiplyScalar(2.6), 0.9);
        }
      } else {
        const a = h.angle ?? 0;
        const length = h.length ?? 300;
        const count = Math.ceil(length / 26);
        for (let i = 1; i <= count; i++) {
          const along = (i / count) * length;
          fx.push(h.x + Math.cos(a) * along, h.y + Math.sin(a) * along, 10, live ? 44 : 14, live ? 44 : 14, 0, color, live ? 2.2 : 1.1, live ? 0.9 : 0.35 + f * 0.4);
        }
      }
    }

    for (const c of game.corpses) {
      if (!inView(c.x, c.y)) continue;
      const def = ENEMIES[c.kind];
      const f = c.life / c.maxLife;
      const corpseFrame = enemyFrames.get(c.kind)![0];
      const height = enemyHeight(corpseFrame.px, def.isBoss) * f;
      sprites.push(corpseFrame, c.x, c.y, 0.5, height, c.flip, 1, 0, 1 + (1 - f) * 1.1);
    }

    for (const wave of game.shockwaves) {
      if (!inView(wave.x, wave.y)) continue;
      const f = 1 - wave.life / wave.maxLife;
      const eased = 1 - (1 - f) * (1 - f);
      const color = scratchColor.copy(cachedColor(wave.color)).multiplyScalar(2.2);
      const radius = wave.radius * (0.35 + 0.65 * eased);
      if (wave.arc !== undefined) {
        decals.push(wave.x, wave.y, radius, radius, DECAL_ARC, Math.atan2(Math.sin(wave.arc), Math.cos(wave.arc)), color, (1 - f * 0.8) * 0.5);
      } else {
        decals.push(wave.x, wave.y, radius, radius, DECAL_DISC, 0, color, (1 - f) * 0.9);
      }
    }

    for (const arc of game.arcs) {
      const dx = arc.x2 - arc.x1;
      const dy = arc.y2 - arc.y1;
      fx.push((arc.x1 + arc.x2) / 2, (arc.y1 + arc.y2) / 2, 26, 6, Math.hypot(dx, dy * cameraBasis.backY), Math.atan2(-dy * cameraBasis.backY, dx), cachedColor(arc.color), 3.2, arc.life / ARC_LIFE_SEC);
    }
    for (const s of game.strikes) {
      if (!inView(s.x, s.y)) continue;
      const left = Math.max(0, s.at - game.elapsed);
      decals.push(s.x, s.y, s.r, s.r, DECAL_RING, 1 - Math.min(1, left / 1), cachedColor(s.color), 0.7);
    }
    if (game.elapsed < p.shieldUntil) decals.push(px, py, 42, 42, DECAL_RING, 1, cachedColor("#b58cff"), 0.9);

    const moving = Math.hypot(p.vx, p.vy) > 20;
    const step = moving ? Math.floor(anim * 6.5) % 2 : 0;
    decals.push(px, py + 1, 19, 9, DECAL_BLOB, 0, BLACK, 0.65);
    const blink = !game.attract && p.invuln > 0 && p.dashTimer <= 0 && Math.floor(p.invuln * 20) % 2 === 0;
    if (!blink) {
      const bob = moving ? Math.abs(Math.sin(anim * 13)) * 2 : Math.sin(anim * 2.2) * 0.5;
      const dead = p.dead;
      const heroSprite = heroFrameOf(p.characterId, step);
      const heroHeight = heroSprite.px * PIXEL_SIZE;
      sprites.push(
        heroSprite,
        px,
        py,
        0.5 + bob + (p.lift ?? 0),
        dead ? heroHeight * 0.55 : heroHeight,
        Math.cos(p.facing) < 0,
        dead ? 0.35 : 0,
        0,
        dead ? 1.5 : 1,
        true
      );
    }
    if (p.dashTimer > 0 && ++dashTrailTick % 2 === 0) {
      dashTrail.push({ x: px, y: py, frame: heroFrameOf(p.characterId, step), flip: Math.cos(p.facing) < 0 });
      if (dashTrail.length > 6) dashTrail.shift();
    } else if (p.dashTimer <= 0 && dashTrail.length) {
      dashTrail.shift();
    }
    for (const ghost of dashTrail) {
      const ghostFrame = ghost.frame;
      sprites.push(ghostFrame, ghost.x, ghost.y, 0.5, ghostFrame.px * PIXEL_SIZE, ghost.flip, 0.75);
    }
    if (p.dashTimer > 0) {
      const color = PLAYER_LIGHT;
      fx.push(px, py, 26, 26, 60, Math.atan2(-p.vy * cameraBasis.backY, p.vx), color, 1.6, 0.8);
    }

    for (const sk of game.rigs) {
      decals.push(sk.x, sk.y + 1, 11, 6, DECAL_BLOB, 0, BLACK, 0.45);
      const rigFrame = frameOf("rig", sk.kind);
      sprites.push(rigFrame, sk.x, sk.y, 6, rigFrame.px * PIXEL_SIZE, false);
    }
    for (const loan of game.loans) {
      const left = Math.max(0, loan.until - game.elapsed) / loan.total;
      decals.push(loan.x, loan.y, 52, 52, DECAL_RING, left, COIN_COLOR, 1);
      fx.push(loan.x, loan.y, 20, 18, 18, 0, COIN_COLOR, 2.4);
    }
    const sealColor = cachedColor("#9b8cff");
    game.seals.forEach((seal, i) => {
      decals.push(seal.x, seal.y, 18, 18, DECAL_RING, 1, sealColor, 0.9);
      const next = game.seals[(i + 1) % game.seals.length]!;
      if (game.seals.length < 2 || (game.seals.length === 2 && i === 1)) return;
      const dx = next.x - seal.x;
      const dy = next.y - seal.y;
      fx.push((seal.x + next.x) / 2, (seal.y + next.y) / 2, 14, 5, Math.hypot(dx, dy * cameraBasis.backY), Math.atan2(-dy * cameraBasis.backY, dx), sealColor, 2.2, 0.8);
    });
    if (game.fieldRadius > 0) decals.push(px, py, game.fieldRadius, game.fieldRadius, DECAL_RING, 1, cachedColor("#c9a0ff"), 0.45);
    if (game.weapons.some((w) => w.kind === "air-gap-vault")) {
      const v = game.vault;
      decals.push(v.x, v.y + 1, 14, 7, DECAL_BLOB, 0, BLACK, 0.45);
      decals.push(v.x, v.y, 22, 22, DECAL_RING, vaultFill(game), VAULT_COLOR, 1);
      fx.push(v.x, v.y, 16, 22, 22, 0, VAULT_COLOR, 1.8, 0.85);
    }

    for (const pr of game.projectiles) {
      const x = lerpPos(pr.px, pr.x, alpha);
      const y = lerpPos(pr.py, pr.y, alpha);
      if (!inView(x, y)) continue;
      const color = cachedColor(pr.color);
      const angle = Math.atan2(-pr.vy * cameraBasis.backY, pr.vx);
      if (!pr.fromPlayer) {
        fx.push(x, y, 24, 24, 24, 0, color, 2.2);
        continue;
      }
      const look = (pr.weaponKind && PROJECTILE_LOOK[pr.weaponKind]) || DEFAULT_LOOK;
      fx.push(x, y, 26, look.width, look.length, angle, color, look.glow);
      const speed = Math.hypot(pr.vx, pr.vy) || 1;
      for (let i = 1; i <= look.trail; i++) {
        const back = i * look.length * 0.6;
        fx.push(x - (pr.vx / speed) * back, y - (pr.vy / speed) * back, 26, look.width * (1 - i * 0.2), look.length * 0.8, angle, color, look.glow * 0.5, 1 - i * 0.28);
      }
    }

    for (const o of game.orbiters) {
      if (game.elapsed < (o.offUntil ?? 0)) continue;
      const color = cachedColor(ORBITER_COLOR[o.weaponKind] ?? "#f0b429");
      decals.push(o.x, o.y, o.radius, o.radius * 0.6, DECAL_BLOB, 0, BLACK, 0.35);
      if (o.weaponKind === "rug-coin") {
        const spin = Math.abs(Math.cos(anim * 7 + o.id));
        sprites.push(frameOf("pickup", "coin"), o.x, o.y, 18, 20, false, 0, 0.9, Math.max(0.18, spin));
        fx.push(o.x, o.y, 28, 26, 26, 0, color, 0.8);
      } else {
        fx.push(o.x, o.y, 26, o.radius * 3.2, o.radius * 3.2, 0, color, 2.2);
        const tangent = o.angle + Math.PI / 2;
        fx.push(o.x - Math.cos(tangent) * 18, o.y - Math.sin(tangent) * 18, 26, o.radius * 1.6, o.radius * 3, -tangent, color, 0.9, 0.7);
      }
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

  let appliedColorblind: ColorblindMode = "off";

  return {
    render(game: Game, dt: number, alpha: number) {
      elapsed += dt;
      const vp = readViewport(canvas);
      if (dynamicRes.update(dt * 1000)) lastPixelRatio = 0;
      if (promoter.update(dt * 1000, dynamicRes.scale)) setTier("high");
      else if (tierName === "high" && dynamicRes.scale < 0.7) {
        setTier("medium");
        promoter.retire();
      }
      resizeIfNeeded(vp.width, vp.height);
      const calm = game.cosmetics.calm;
      cutscenePlayer.reducedMotion = calm;
      if (game.cosmetics.colorblind !== appliedColorblind) {
        appliedColorblind = game.cosmetics.colorblind;
        setColorblind(grade.uniforms.uCb!.value as THREE.Matrix3, appliedColorblind);
        grade.uniforms.uCbOn!.value = appliedColorblind === "off" ? 0 : 1;
      }
      const inPanels = game.phase === "cutscene" && game.cutscene.score;
      if (inPanels) {
        cutscenePlayer.update(game.cutscene.score!, game.cutscene.step, aspect);
        renderPass.scene = cutscenePlayer.scene;
        renderPass.camera = cutscenePlayer.camera;
        grade.uniforms.uImpact!.value = calm ? 0 : cutscenePlayer.impact;
        grade.uniforms.uHurt!.value = 0;
        grade.uniforms.uTilt!.value = 0;
      } else {
        if (!game.player) return;
        renderPass.scene = scene;
        renderPass.camera = camera;
        cutscenePlayer.reset();
        if (game.phase !== "paused" && game.phase !== "levelup") renderWorld(game, dt, alpha);
        else renderWorld(game, 0, 1);
        grade.uniforms.uImpact!.value = !calm && game.impactFrames > 0 ? 1 : 0;
        grade.uniforms.uHurt!.value = calm ? game.hurtPulse * 0.25 : game.hurtPulse;
        grade.uniforms.uTilt!.value = tier.tiltShift ? 1 : 0;
      }
      grade.uniforms.uTime!.value = elapsed;
      grade.uniforms.toneMappingExposure!.value = renderer.toneMappingExposure;
      renderer.info.reset();
      composer.render(dt);
    },

    worldToScreen(x: number, y: number, w: number, h: number) {
      const v = scratchProject.set(x, 18, y).project(camera);
      if (v.z > 1) return null;
      screenResult.x = (v.x * 0.5 + 0.5) * w;
      screenResult.y = (-v.y * 0.5 + 0.5) * h;
      return screenResult;
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
const screenResult = { x: 0, y: 0 };
