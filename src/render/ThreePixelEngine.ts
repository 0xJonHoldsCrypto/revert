import type * as THREE from "three";
import type { Game } from "../game/Game";
import { WORLD } from "../constants";
import { difficultyFromClick, type DifficultyId } from "../data/difficulty";
import { ENV_OBSTACLES, CHESTS } from "../data/environment";
import { biomeAt } from "../data/environment";
import { ENEMIES } from "../data/enemies";
import { RARITY_COLORS } from "../data/rarity";
import { readViewport } from "./viewport";
import { BODY_FRAMES } from "../pixel/bodies";
import { getPropCanvas, makeFieldCanvas, type PropKind } from "../pixel/worldDress";
import {
  makeCoinTexture,
  makeEnemyTexture,
  makeSidekickTexture,
  makeTitleGrassTexture,
  makeWalkTexture,
  canvasToPixelTexture,
} from "./pixelTexture";

export type PixelEngine = {
  render(game: Game, dt: number): void;
  hitTitle(mx: number, my: number, w: number, h: number): "start" | DifficultyId | null;
  worldToScreen(x: number, y: number, w: number, h: number): { x: number; y: number } | null;
  dispose(): void;
};

export async function createThreePixelEngine(canvas: HTMLCanvasElement): Promise<PixelEngine> {
  const THREE = await import("three");
  const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
  const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
  const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
  const { ShaderPass } = await import("three/examples/jsm/postprocessing/ShaderPass.js");
  const { VignetteShader } = await import("three/examples/jsm/shaders/VignetteShader.js");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const titleScene = new THREE.Scene();
  titleScene.background = new THREE.Color(0x0a1a12);
  const titleCam = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  titleCam.position.set(0, 6.2, 9.5);
  titleCam.lookAt(0, 0.5, 0);

  const worldScene = new THREE.Scene();
  worldScene.background = new THREE.Color(0x0d1810);
  worldScene.fog = new THREE.Fog(0x0d1810, 500, 2200);

  const titleGroundTex = makeTitleGrassTexture(THREE);
  titleGroundTex.repeat.set(8, 8);
  const titleGround = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ map: titleGroundTex, roughness: 1, metalness: 0 })
  );
  titleGround.rotation.x = -Math.PI / 2;
  titleGround.receiveShadow = true;
  titleScene.add(titleGround);

  const titleSpot = new THREE.SpotLight(0xffe8b0, 32, 30, 0.42, 0.55, 1);
  titleSpot.position.set(0, 12, 4);
  titleSpot.castShadow = true;
  titleSpot.target.position.set(0, 0, 0);
  titleScene.add(titleSpot, titleSpot.target);
  titleScene.add(new THREE.AmbientLight(0x3a5a48, 0.4));

  const heroSprite = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 2.15),
    new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.08, depthWrite: false })
  );
  heroSprite.position.set(0, 1.35, 0);
  titleScene.add(heroSprite);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.55, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85 })
  );
  pedestal.position.y = 0.18;
  pedestal.receiveShadow = true;
  titleScene.add(pedestal);

  for (let i = 0; i < 16; i++) {
    const prop = new THREE.Mesh(
      new THREE.BoxGeometry(0.35 + Math.random() * 0.5, 0.12 + Math.random() * 0.35, 0.35 + Math.random() * 0.5),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.28, 0.35, 0.22 + Math.random() * 0.12),
        roughness: 1,
      })
    );
    prop.position.set((Math.random() - 0.5) * 14, prop.scale.y * 0.5, (Math.random() - 0.5) * 10 + 2);
    prop.castShadow = true;
    titleScene.add(prop);
  }

  const fieldGroup = new THREE.Group();
  worldScene.add(fieldGroup);
  const quadrants: { biome: string; x: number; z: number }[] = [
    { biome: "wasteland", x: 1200, z: 1200 },
    { biome: "cex", x: 3600, z: 1600 },
    { biome: "defi", x: 1600, z: 3600 },
    { biome: "apt", x: 2400, z: 2400 },
  ];
  for (const q of quadrants) {
    const tex = canvasToPixelTexture(THREE, makeFieldCanvas(q.biome), { repeat: true });
    tex.repeat.set(6, 6);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 2600),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(q.x, 0, q.z);
    mesh.receiveShadow = true;
    fieldGroup.add(mesh);
  }

  const propGroup = new THREE.Group();
  worldScene.add(propGroup);
  const propKinds: PropKind[] = ["tree", "bush", "bush", "barrel", "fire"];
  const propTex = new Map<PropKind, THREE.Texture>();
  for (const kind of ["tree", "bush", "barrel", "fire"] as PropKind[]) {
    const canvas = getPropCanvas(kind);
    const tex = canvasToPixelTexture(THREE, canvas);
    propTex.set(kind, tex);
  }
  let seed = 20261102;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let i = 0; i < 160; i++) {
    const kind = propKinds[Math.floor(rnd() * propKinds.length)]!;
    const tex = propTex.get(kind)!;
    const h = kind === "tree" ? 54 : kind === "bush" ? 28 : 32;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(h * 0.8, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.2, depthWrite: false })
    );
    mesh.position.set(180 + rnd() * (WORLD.width - 360), h / 2, 180 + rnd() * (WORLD.height - 360));
    mesh.userData.prop = true;
    propGroup.add(mesh);
  }

  const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x1a3020, 0.55);
  const sun = new THREE.DirectionalLight(0xffe0a8, 1.4);
  sun.position.set(400, 900, 200);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -900;
  sun.shadow.camera.right = 900;
  sun.shadow.camera.top = 900;
  sun.shadow.camera.bottom = -900;
  worldScene.add(hemi, sun);

  const worldCam = new THREE.PerspectiveCamera(46, 1, 10, 6000);

  const playerGroup = new THREE.Group();
  worldScene.add(playerGroup);

  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(18, 22),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.06;
  playerGroup.add(shadowBlob);

  const playerPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 62),
    new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.15, depthWrite: false })
  );
  playerPlane.position.y = 31;
  playerGroup.add(playerPlane);

  const enemyGeo = new THREE.PlaneGeometry(44, 44);
  const enemyPool: THREE.Mesh[] = [];
  for (let i = 0; i < 512; i++) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.08 });
    const m = new THREE.Mesh(enemyGeo, mat);
    m.visible = false;
    worldScene.add(m);
    enemyPool.push(m);
  }

  const enemyTexCache = new Map<string, THREE.Texture>();
  function enemyTexture(kind: import("../types").EnemyKind) {
    const hit = enemyTexCache.get(kind);
    if (hit) return hit;
    const tex = makeEnemyTexture(THREE, kind);
    enemyTexCache.set(kind, tex);
    return tex;
  }

  const coinTex = makeCoinTexture(THREE);

  const pickupGeo = new THREE.PlaneGeometry(16, 16);
  const pickupPool: THREE.Mesh[] = [];
  for (let i = 0; i < 120; i++) {
    const m = new THREE.Mesh(
      pickupGeo,
      new THREE.MeshBasicMaterial({ color: 0xa371f7, transparent: true, opacity: 0.95, depthWrite: false })
    );
    m.visible = false;
    worldScene.add(m);
    pickupPool.push(m);
  }

  const projGeo = new THREE.PlaneGeometry(10, 10);
  const projPool: THREE.Mesh[] = [];
  for (let i = 0; i < 200; i++) {
    const m = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 }));
    m.visible = false;
    worldScene.add(m);
    projPool.push(m);
  }

  const orbGeo = new THREE.PlaneGeometry(14, 14);
  const orbPool: THREE.Mesh[] = [];
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 }));
    m.visible = false;
    worldScene.add(m);
    orbPool.push(m);
  }

  const partGeo = new THREE.PlaneGeometry(6, 6);
  const partPool: THREE.Mesh[] = [];
  for (let i = 0; i < 180; i++) {
    const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    m.visible = false;
    worldScene.add(m);
    partPool.push(m);
  }

  const obstacleGroup = new THREE.Group();
  const chestGroup = new THREE.Group();
  const wellGroup = new THREE.Group();
  worldScene.add(obstacleGroup, chestGroup, wellGroup);
  let obstacleSeed = -1;
  let propsSeed = -1;

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(WORLD.width, 8, WORLD.height)),
    new THREE.LineBasicMaterial({ color: 0xffd56a, transparent: true, opacity: 0.25 })
  );
  border.position.set(WORLD.width / 2, 4, WORLD.height / 2);
  worldScene.add(border);

  const sidekickPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 36),
    new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.08 })
  );
  sidekickPlane.visible = false;
  worldScene.add(sidekickPlane);

  let activeScene: THREE.Scene = titleScene;
  let activeCam: THREE.Camera = titleCam;

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(titleScene, titleCam);
  composer.addPass(renderPass);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.24, 0.38, 0.12));
  composer.addPass(new ShaderPass(VignetteShader));

  let titleTime = 0;
  let camX = WORLD.width / 2;
  let camZ = WORLD.height / 2;
  const ndc = new THREE.Vector3();
  let walkTime = 0;
  let currentWalkId: string | null = null;
  const walkFrames = BODY_FRAMES;
  let lastW = 0;
  let lastH = 0;
  let lastDpr = 1;

  function resizeIfNeeded(w: number, h: number, dpr: number) {
    if (w === lastW && h === lastH && dpr === lastDpr) return;
    lastW = w;
    lastH = h;
    lastDpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    titleCam.aspect = w / h;
    titleCam.updateProjectionMatrix();
    worldCam.aspect = w / h;
    worldCam.updateProjectionMatrix();
    composer.setSize(w * dpr, h * dpr);
  }

  function setActiveScene(scene: THREE.Scene, cam: THREE.Camera) {
    if (activeScene === scene && activeCam === cam) return;
    activeScene = scene;
    activeCam = cam;
    renderPass.scene = scene;
    renderPass.camera = cam;
  }

  function setPlayerWalkTexture(id: string) {
    if (currentWalkId === id) return;
    currentWalkId = id;
    const tex = makeWalkTexture(THREE, id as import("../types").CharacterId);
    tex.repeat.set(1 / walkFrames, 1);
    (playerPlane.material as THREE.MeshBasicMaterial).map = tex;
    (playerPlane.material as THREE.MeshBasicMaterial).needsUpdate = true;
  }

  function syncChestsAndWells(game: Game) {
    if (propsSeed === game.worldSeed) return;
    propsSeed = game.worldSeed;
    while (chestGroup.children.length) chestGroup.remove(chestGroup.children[0]!);
    while (wellGroup.children.length) wellGroup.remove(wellGroup.children[0]!);
    for (const c of game.chests) {
      const def = CHESTS[c.kind];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(28, 18, 22),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.9, metalness: 0.1 })
      );
      mesh.position.set(c.x, 9, c.y);
      mesh.castShadow = true;
      mesh.userData.chestId = c.id;
      chestGroup.add(mesh);
    }
    for (const w of game.wells) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(22, 26, 8, 16),
        new THREE.MeshStandardMaterial({ color: w.used ? 0x30363d : 0x1f6feb, roughness: 0.85 })
      );
      mesh.position.set(w.x, 4, w.y);
      wellGroup.add(mesh);
    }
  }

  function syncObstacles(game: Game) {
    if (game.obstacles.length === 0) {
      if (obstacleGroup.children.length) {
        while (obstacleGroup.children.length) obstacleGroup.remove(obstacleGroup.children[0]!);
      }
      obstacleSeed = -1;
      return;
    }
    if (obstacleSeed === game.worldSeed) return;
    obstacleSeed = game.worldSeed;
    while (obstacleGroup.children.length) obstacleGroup.remove(obstacleGroup.children[0]!);
    for (const o of game.obstacles) {
      const def = ENV_OBSTACLES[o.kind];
      const h = Math.max(14, o.height * 0.4);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(o.width, h, o.height),
        new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.95, metalness: 0.05 })
      );
      mesh.position.set(o.x + o.width / 2, h / 2, o.y + o.height / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      obstacleGroup.add(mesh);
    }
  }

  function faceCameraYaw(mesh: THREE.Object3D, x: number, z: number) {
    const dx = worldCam.position.x - x;
    const dz = worldCam.position.z - z;
    mesh.rotation.set(0, Math.atan2(dx, dz), 0);
  }

  function renderTitle(_game: Game, dt: number) {
    titleTime += dt;
    heroSprite.visible = false;
    pedestal.visible = false;
    titleCam.position.x = Math.sin(titleTime * 0.15) * 0.15;
    titleCam.lookAt(0, 0.2, 0);
  }

  function renderWorld(game: Game, dt: number) {
    if (!game.player) return;
    const p = game.player;
    setPlayerWalkTexture(p.characterId);
    syncObstacles(game);
    syncChestsAndWells(game);
    for (const child of propGroup.children) faceCameraYaw(child, child.position.x, child.position.z);

    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 20) walkTime += dt * (0.85 + speed / 350);
    const frame = Math.floor(walkTime * walkFrames) % walkFrames;
    const map = (playerPlane.material as THREE.MeshBasicMaterial).map;
    if (map) map.offset.x = frame / walkFrames;

    playerGroup.position.set(p.x, 0, p.y);
    faceCameraYaw(playerPlane, p.x, p.y);
    const mirror = Math.cos(p.facing) < 0 ? -1 : 1;
    playerPlane.scale.x = mirror;

    const dist = 168;
    const shake = game.shake;
    const targetX = p.x + (shake > 0 ? (Math.random() - 0.5) * 18 * shake : 0);
    const targetZ = p.y + dist + (shake > 0 ? (Math.random() - 0.5) * 18 * shake : 0);
    camX += (targetX - camX) * Math.min(1, dt * 7);
    camZ += (targetZ - camZ) * Math.min(1, dt * 7);
    worldCam.position.set(camX, 196, camZ);
    worldCam.lookAt(p.x, 8, p.y);

    sun.position.set(p.x + 420, 920, p.y + 180);
    sun.target.position.set(p.x, 0, p.y);
    sun.target.updateMatrixWorld();

    let ei = 0;
    for (const e of game.enemies) {
      if (ei >= enemyPool.length) break;
      const mesh = enemyPool[ei]!;
      const def = ENEMIES[e.kind];
      mesh.visible = true;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.map = enemyTexture(e.kind);
      mat.needsUpdate = true;
      mesh.position.set(e.x, def.isBoss ? 40 : 26, e.y);
      mesh.scale.setScalar(def.isBoss ? 1.65 : 1);
      mat.color.setHex(e.flash > 0 ? 0xfff4d0 : 0xffffff);
      faceCameraYaw(mesh, e.x, e.y);
      ei++;
    }
    for (; ei < enemyPool.length; ei++) enemyPool[ei]!.visible = false;

    let pi = 0;
    for (const pk of game.pickups) {
      if (pi >= pickupPool.length) break;
      const mesh = pickupPool[pi]!;
      mesh.visible = true;
      mesh.position.set(pk.x, 12, pk.y);
      mesh.rotation.x = -Math.PI / 2;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (pk.kind === "coin") {
        mat.map = coinTex;
        mat.color.setHex(0xffffff);
      } else if (pk.kind === "buff") {
        mat.map = null;
        mat.color.setHex(0xd2a8ff);
      } else {
        mat.map = null;
        mat.color.setHex(pk.kind === "xp" ? 0xa371f7 : 0x7ee787);
      }
      pi++;
    }
    for (; pi < pickupPool.length; pi++) pickupPool[pi]!.visible = false;

    let pri = 0;
    for (const pr of game.projectiles) {
      if (pri >= projPool.length) break;
      const mesh = projPool[pri]!;
      mesh.visible = true;
      mesh.position.set(pr.x, 18, pr.y);
      mesh.lookAt(worldCam.position);
      (mesh.material as THREE.MeshBasicMaterial).color.setStyle(pr.color);
      pri++;
    }
    for (; pri < projPool.length; pri++) projPool[pri]!.visible = false;

    let oi = 0;
    for (const o of game.orbiters) {
      if (oi >= orbPool.length) break;
      const mesh = orbPool[oi]!;
      mesh.visible = true;
      mesh.position.set(o.x, 22, o.y);
      mesh.lookAt(worldCam.position);
      const w = game.weapons.find((x) => x.kind === o.weaponKind);
      (mesh.material as THREE.MeshBasicMaterial).color.setStyle(w ? RARITY_COLORS[w.rarity] : "#f0b429");
      oi++;
    }
    for (; oi < orbPool.length; oi++) orbPool[oi]!.visible = false;

    let pt = 0;
    for (const part of game.particles) {
      if (pt >= partPool.length) break;
      const mesh = partPool[pt]!;
      mesh.visible = true;
      mesh.position.set(part.x, 14, part.y);
      mesh.lookAt(worldCam.position);
      const m = mesh.material as THREE.MeshBasicMaterial;
      m.color.setStyle(part.color);
      m.opacity = part.life / part.maxLife;
      pt++;
    }
    for (; pt < partPool.length; pt++) partPool[pt]!.visible = false;

    const biome = biomeAt(p.x, p.y);
    if (biome === "defi") worldScene.fog!.color.setHex(0x0c4050);
    else if (biome === "cex") worldScene.fog!.color.setHex(0x24243a);
    else if (biome === "apt") worldScene.fog!.color.setHex(0x2a1434);
    else worldScene.fog!.color.setHex(0x14301c);
    for (const child of chestGroup.children) {
      const id = child.userData.chestId as number | undefined;
      const chest = game.chests.find((c) => c.id === id);
      child.visible = !!chest && !chest.opened;
    }

    const sk = game.sidekickEntity;
    if (sk) {
      sidekickPlane.visible = true;
      const skMat = sidekickPlane.material as THREE.MeshBasicMaterial;
      skMat.map = makeSidekickTexture(THREE, sk.kind);
      sidekickPlane.position.set(sk.x, 24, sk.y);
      faceCameraYaw(sidekickPlane, sk.x, sk.y);
    } else {
      sidekickPlane.visible = false;
    }
  }

  return {
    render(game: Game, dt: number) {
      const vp = readViewport(canvas);
      resizeIfNeeded(vp.width, vp.height, vp.dpr);

      if (game.phase === "menu") {
        renderTitle(game, dt);
        setActiveScene(titleScene, titleCam);
      } else if (game.phase === "cutscene") {
        renderTitle(game, dt * 0.35);
        setActiveScene(titleScene, titleCam);
      } else if (game.player) {
        renderWorld(game, dt);
        setActiveScene(worldScene, worldCam);
      } else {
        setActiveScene(titleScene, titleCam);
      }

      composer.render();
    },

    hitTitle(mx: number, my: number, w: number, h: number) {
      const lapW = Math.min(520, w * 0.72);
      const lapH = lapW * 0.78;
      const keyW = Math.min(220, lapW * 0.46);
      const keyH = 36;
      const keyX = w / 2 - keyW / 2;
      const keyY = h * 0.18 + lapH - 58;
      if (mx >= keyX && mx <= keyX + keyW && my >= keyY && my <= keyY + keyH) return "start" as const;
      const diff = difficultyFromClick(mx, my, w, h);
      if (diff) return diff;
      return null;
    },

    worldToScreen(x: number, y: number, w: number, h: number) {
      ndc.set(x, 18, y);
      ndc.project(worldCam);
      if (ndc.z > 1) return null;
      return { x: (ndc.x * 0.5 + 0.5) * w, y: (-ndc.y * 0.5 + 0.5) * h };
    },

    dispose() {
      renderer.dispose();
      composer.dispose();
    },
  };
}
