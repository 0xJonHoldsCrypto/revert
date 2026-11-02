import type { Game } from "../game/Game";
import { COLORS, WORLD } from "../constants";
import { ENEMIES } from "../data/enemies";
import { getCharacter } from "../data/characters";
import { readViewport } from "./viewport";

export type GameRenderer = {
  draw(game: Game): void;
  dispose?(): void;
};

export async function createThreeRenderer(canvas: HTMLCanvasElement): Promise<GameRenderer> {
  const THREE = await import("three");
  const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
  const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
  const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  scene.fog = new THREE.Fog(COLORS.bg, 900, 2200);

  const vp = readViewport(canvas);
  const camera = new THREE.OrthographicCamera(-vp.width / 2, vp.width / 2, vp.height / 2, -vp.height / 2, 0.1, 5000);
  camera.position.set(0, 400, 400);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  const dir = new THREE.DirectionalLight(0xf0b429, 0.85);
  dir.position.set(200, 400, 150);
  scene.add(ambient, dir);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.width, WORLD.height),
    new THREE.MeshStandardMaterial({ color: COLORS.grid, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(WORLD.width / 2, 0, WORLD.height / 2);
  scene.add(ground);

  const playerMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(14, 24, 6, 12),
    new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: 0x332200 })
  );
  playerMesh.rotation.x = Math.PI / 2;
  scene.add(playerMesh);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(22, 26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);

  const maxInstances = 512;
  const enemyGeo = new THREE.BoxGeometry(1, 1, 1);
  const enemyMat = new THREE.MeshStandardMaterial({ color: 0xff7b72, roughness: 0.6 });
  const enemiesMesh = new THREE.InstancedMesh(enemyGeo, enemyMat, maxInstances);
  enemiesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(enemiesMesh);

  const dummy = new THREE.Object3D();
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(vp.width, vp.height), 0.35, 0.4, 0.2));

  return {
    draw(game: Game) {
      const v = readViewport(canvas);
      renderer.setSize(v.width, v.height, false);
      camera.left = -v.width / 2;
      camera.right = v.width / 2;
      camera.top = v.height / 2;
      camera.bottom = -v.height / 2;
      camera.updateProjectionMatrix();
      composer.setSize(v.width * v.dpr, v.height * v.dpr);

      if (game.phase === "menu" || !game.player) {
        renderer.setClearColor(COLORS.bg);
        renderer.render(scene, camera);
        return;
      }

      const p = game.player;
      const cx = p.x - v.width / 2;
      const keel = p.y - v.height / 2;
      camera.position.set(cx + v.width / 2, 420, keel + v.height / 2);
      camera.lookAt(cx + v.width / 2, 0, keel + v.height / 2);

      const ch = getCharacter(p.characterId);
      (playerMesh.material as import("three").MeshStandardMaterial).color.set(ch.color);
      playerMesh.position.set(p.x, 18, p.y);
      ring.position.set(p.x, 1, p.y);

      let count = 0;
      for (const e of game.enemies) {
        if (count >= maxInstances) break;
        const def = ENEMIES[e.kind];
        const s = def.radius * 0.12;
        dummy.position.set(e.x, def.isBoss ? 28 : 14, e.y);
        dummy.scale.set(s * 2, def.isBoss ? 3.2 : 2, s * 2);
        dummy.updateMatrix();
        enemiesMesh.setMatrixAt(count, dummy.matrix);
        count++;
      }
      enemiesMesh.count = count;
      enemiesMesh.instanceMatrix.needsUpdate = true;

      composer.render();
    },
    dispose() {
      renderer.dispose();
    },
  };
}
