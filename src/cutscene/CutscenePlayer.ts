import * as THREE from "three";
import { FONT_MONO } from "../ui/theme";
import { compileChannels, sampleChannel, type CompiledSpan } from "./CutsceneEngine";
import {
  PANEL_H,
  PANEL_W,
  paintExplorer,
  paintFace,
  paintMultisig,
  paintPager,
  paintSigners,
  paintSoc,
  paintTear,
  paintVaultSafe,
  paintWallet,
  type Layers,
} from "./panelArt";
import type { PanelId, Score } from "./scores";

const PANEL_ART: Record<PanelId, () => Layers> = {
  soc: paintSoc,
  pager: paintPager,
  explorer: paintExplorer,
  face: paintFace,
  multisig: paintMultisig,
  wallet: paintWallet,
  tear: paintTear,
  vaultSafe: paintVaultSafe,
  signers: paintSigners,
};

const WORLD_H = 1;
const WORLD_W = WORLD_H * (PANEL_W / PANEL_H);
const BORDER = 0.022;
const LIVE_W = 960;
const LIVE_H = 720;

const panelVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const panelFragment = `
  uniform sampler2D uMap;
  uniform float uLight;
  uniform float uDim;
  uniform float uZoom;
  uniform vec2 uShift;
  uniform float uAdd;
  uniform float uStretch;
  varying vec2 vUv;
  void main() {
    vec2 centered = vUv - 0.5;
    centered.x /= uStretch;
    vec2 uv = centered / uZoom + 0.5 + uShift;
    vec4 tex = texture2D(uMap, uv);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) tex.a = 0.0;
    float d = distance(vUv, vec2(0.5, 0.56));
    float pool = 1.0 - smoothstep(0.25, 0.85, d) * 0.45;
    vec3 color = tex.rgb * uLight * uDim * pool;
    if (uAdd > 0.5) {
      gl_FragColor = vec4(color * tex.a, tex.a);
    } else {
      if (tex.a < 0.5) discard;
      gl_FragColor = vec4(color, 1.0);
    }
  }`;

type LayerName = "bg" | "mid" | "fx" | "live";

type PanelObject = {
  id: PanelId;
  group: THREE.Group;
  uniforms: Record<LayerName, Record<string, THREE.IUniform>>;
  live: CanvasRenderingContext2D;
  liveTexture: THREE.CanvasTexture;
  liveKey: string;
  fxMesh: THREE.Mesh;
};

const artCache = new Map<PanelId, Layers>();

function pixelTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const LAYER_DEPTH: Record<LayerName, number> = { bg: -0.5, mid: 0.2, fx: 0.7, live: 0.35 };

export class CutscenePlayer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  private panels = new Map<PanelId, PanelObject>();
  private channels = new Map<string, CompiledSpan[]>();
  private flash: THREE.Mesh;
  private currentScoreId = "";
  impact = 0;
  private time = 0;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor() {
    this.scene.background = new THREE.Color(0x03040a);
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3), transparent: true, opacity: 0, depthTest: false })
    );
    this.flash.renderOrder = 100;
    this.flash.position.z = 1;
    this.camera.add(this.flash);
    this.flash.position.set(0, 0, -1);
    this.scene.add(this.camera);
  }

  private channel(name: string, step: number, fallback: number) {
    return sampleChannel(this.channels.get(name), step, fallback);
  }

  private buildPanel(id: PanelId): PanelObject {
    let art = artCache.get(id);
    if (!art) {
      art = PANEL_ART[id]();
      artCache.set(id, art);
    }
    const group = new THREE.Group();
    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_W + BORDER * 2, WORLD_H + BORDER * 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.86, 0.82, 0.72) })
    );
    border.position.z = -0.002;
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_W + 0.09, WORLD_H + 0.09),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })
    );
    shadow.position.set(0.018, -0.022, -0.004);
    group.add(shadow, border);

    const liveCanvas = document.createElement("canvas");
    liveCanvas.width = LIVE_W;
    liveCanvas.height = LIVE_H;
    const live = liveCanvas.getContext("2d")!;
    const liveTexture = new THREE.CanvasTexture(liveCanvas);
    liveTexture.colorSpace = THREE.SRGBColorSpace;
    liveTexture.magFilter = THREE.LinearFilter;
    liveTexture.minFilter = THREE.LinearFilter;
    liveTexture.generateMipmaps = false;

    const uniforms = {} as PanelObject["uniforms"];
    const textures: Record<LayerName, THREE.Texture> = {
      bg: pixelTexture(art.bg),
      mid: pixelTexture(art.mid),
      fx: pixelTexture(art.fx),
      live: liveTexture,
    };
    let fxMesh: THREE.Mesh | null = null;
    (["bg", "mid", "live", "fx"] as LayerName[]).forEach((name, i) => {
      const additive = name === "live" || name === "fx";
      const u: Record<string, THREE.IUniform> = {
        uMap: { value: textures[name] },
        uLight: { value: 1 },
        uDim: { value: 1 },
        uZoom: { value: 1 },
        uShift: { value: new THREE.Vector2() },
        uAdd: { value: additive ? 1 : 0 },
        uStretch: { value: 1 },
      };
      uniforms[name] = u;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD_W, WORLD_H),
        new THREE.ShaderMaterial({
          uniforms: u,
          vertexShader: panelVertex,
          fragmentShader: panelFragment,
          transparent: additive,
          depthWrite: !additive,
          blending: additive ? THREE.CustomBlending : THREE.NormalBlending,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneMinusSrcAlphaFactor,
        })
      );
      mesh.position.z = i * 0.001;
      if (id === "signers" && name === "live") mesh.renderOrder = 1;
      group.add(mesh);
      if (name === "fx") fxMesh = mesh;
    });
    const panel: PanelObject = { id, group, uniforms, live, liveTexture, liveKey: "", fxMesh: fxMesh! };
    this.scene.add(group);
    this.panels.set(id, panel);
    return panel;
  }

  private loadScore(score: Score) {
    if (this.currentScoreId === score.id) return;
    this.currentScoreId = score.id;
    this.channels = compileChannels(score);
    for (const p of this.panels.values()) p.group.visible = false;
    for (const id of score.panels) {
      if (!this.panels.has(id)) this.buildPanel(id);
    }
  }

  reset() {
    this.currentScoreId = "";
  }

  update(score: Score, step: number, aspect: number) {
    this.loadScore(score);
    this.time = step;
    const light = this.channel("cam.light", step, 1);
    const shake = this.reducedMotion ? 0 : this.channel("cam.shake", step, 0);
    const roll = this.channel("cam.roll", step, 0);
    const fitHeight = Math.max(WORLD_H + 0.1, (WORLD_W + 0.1) / aspect);
    const dist = fitHeight / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const sx = shake * Math.sin(step * 19.1);
    const sy = shake * Math.sin(step * 23.7 + 1.1);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(sx, sy, dist);
    this.camera.rotation.set(0, 0, roll);
    this.impact = this.channel("cam.impact", step, 0);
    const flash = this.channel("cam.flash", step, 0);
    (this.flash.material as THREE.MeshBasicMaterial).opacity = flash;

    let order = 0;
    for (const id of score.panels) {
      const p = this.panels.get(id)!;
      const visible = this.channel(`${id}.visible`, step, 0) > 0.5;
      p.group.visible = visible;
      if (!visible) continue;
      order++;
      p.group.position.set(this.channel(`${id}.x`, step, 0), -this.channel(`${id}.y`, step, 0), order * 0.03);
      p.group.rotation.z = this.channel(`${id}.rot`, step, 0);
      const scale = this.channel(`${id}.scale`, step, 1);
      p.group.scale.setScalar(scale);
      const dim = this.channel(`${id}.dim`, step, 1);
      const zoom = this.channel(`${id}.zoom`, step, 1);
      for (const name of ["bg", "mid", "fx", "live"] as LayerName[]) {
        const u = p.uniforms[name];
        u.uLight!.value = name === "live" ? Math.max(1, light * 0.85) : Math.min(light, 1.45);
        u.uDim!.value = dim;
        u.uZoom!.value = zoom * (1 + LAYER_DEPTH[name] * 0.04) * (name === "bg" ? 1.06 : 1);
        (u.uShift!.value as THREE.Vector2).set(sx * LAYER_DEPTH[name] * 0.4, sy * LAYER_DEPTH[name] * 0.4);
      }
      this.applyPanelSpecific(p, step);
      this.drawLive(p, step);
    }
  }

  private applyPanelSpecific(p: PanelObject, step: number) {
    if (p.id === "wallet") {
      const thumb = this.channel("wallet.thumb", step, 0);
      (p.uniforms.fx.uShift!.value as THREE.Vector2).y = 0.4 * (1 - thumb);
    }
    if (p.id === "tear") {
      const rift = this.channel("tear.rift", step, 0);
      const pull = this.channel("tear.pull", step, 0);
      p.uniforms.fx.uStretch!.value = Math.max(0.001, rift * 5.2);
      p.uniforms.fx.uLight!.value = 2.2;
      p.uniforms.mid.uZoom!.value = 1 + pull * 0.2;
      (p.uniforms.mid.uShift!.value as THREE.Vector2).x = -pull * 0.34 + Math.sin(step * 8.1) * pull * 0.02;
      p.uniforms.mid.uDim!.value = 1 - pull * 0.35;
    }
    if (p.id === "signers") {
      const awake = this.channel("signers.awake", step, 0);
      p.fxMesh.visible = awake > 0.5;
    }
    if (p.id === "explorer" || p.id === "vaultSafe") {
      p.fxMesh.visible = p.id === "explorer";
    }
  }

  private drawLive(p: PanelObject, step: number) {
    const key = this.liveKey(p, step);
    if (key === p.liveKey) return;
    p.liveKey = key;
    const c = p.live;
    c.clearRect(0, 0, LIVE_W, LIVE_H);
    if (p.id === "pager") this.drawPagerText(c, step);
    else if (p.id === "explorer") this.drawExplorerText(c, step, false);
    else if (p.id === "vaultSafe") this.drawExplorerText(c, step, true);
    else if (p.id === "multisig") this.drawMultisigText(c, false);
    else if (p.id === "signers") this.drawMultisigText(c, this.channel("signers.awake", step, 0) > 0.5, this.channel("signers.line", step, 0) > 0.5);
    else if (p.id === "wallet") this.drawWalletText(c);
    else if (p.id === "tear") this.drawGasText(c, step);
    else if (p.id === "soc") this.drawCaption(c, "03:12 · EXCHANGE SOC · NIGHT SHIFT", "#ffc23d");
    p.liveTexture.needsUpdate = true;
  }

  private liveKey(p: PanelObject, step: number): string {
    if (p.id === "explorer" || p.id === "vaultSafe") return `${Math.floor(step * 2)}`;
    if (p.id === "tear") return `${this.channel("tear.gas", step, 0)}:${Math.floor(step)}`;
    if (p.id === "pager") return `${Math.floor(step / 2) % 2}`;
    if (p.id === "signers") return `${this.channel("signers.awake", step, 0)}:${this.channel("signers.line", step, 0)}`;
    return "static";
  }

  private drawCaption(c: CanvasRenderingContext2D, text: string, color: string) {
    c.font = `600 30px ${FONT_MONO}`;
    const w = c.measureText(text).width + 36;
    c.fillStyle = "rgba(4,6,12,0.86)";
    c.fillRect(26, LIVE_H - 74, w, 48);
    c.fillStyle = color;
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText(text, 44, LIVE_H - 50);
  }

  private drawPagerText(c: CanvasRenderingContext2D, step: number) {
    const on = Math.floor(step / 2) % 2 === 0;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = on ? "#ff7a5c" : "#c8402c";
    c.font = `700 54px ${FONT_MONO}`;
    c.fillText("HOT WALLET", LIVE_W / 2, 270);
    c.font = `700 72px ${FONT_MONO}`;
    c.fillText("OUTFLOW", LIVE_W / 2, 350);
  }

  private drawExplorerText(c: CanvasRenderingContext2D, step: number, recover: boolean) {
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.font = `600 22px ${FONT_MONO}`;
    c.fillStyle = "#6de8d4";
    c.fillText("explorer.chain  /  hot-wallet-7  /  outgoing", 120, 25);

    const value = this.channel(recover ? "vaultSafe.counter" : "explorer.counter", step, 1.2);
    c.font = `700 112px ${FONT_MONO}`;
    c.fillStyle = recover && value < 0.01 ? "#2ee6c7" : "#ff5c48";
    c.fillText(`$${value.toFixed(2)}B`, 56, 138);
    c.font = `600 26px ${FONT_MONO}`;
    c.fillStyle = "#ffc23d";
    c.fillText(recover ? (value < 0.01 ? "OUTFLOW: REVERSED" : "ROLLING BACK…") : "DRAINING · status: EXPLOIT LIVE", 60, 204);

    const scroll = Math.floor(step * 0.75);
    c.font = `500 22px ${FONT_MONO}`;
    for (let i = 0; i < 7; i++) {
      const n = (scroll + i) * 2654435761;
      const hash = (n >>> 0).toString(16).padStart(8, "0");
      const amount = (((n >>> 4) % 900) + 40).toFixed(0);
      c.fillStyle = i === 6 ? "#7ee7d6" : `rgba(126,231,214,${0.28 + i * 0.1})`;
      c.fillText(`0x${hash}…   ->  mixer_${(n >>> 7) % 9}   -$${amount}M`, 60, 256 + i * 30);
    }

    if (recover) {
      if (this.channel("vaultSafe.safe", step, 0) > 0.5) {
        c.font = `700 88px ${FONT_MONO}`;
        c.fillStyle = "#2ee6c7";
        c.textAlign = "center";
        c.fillText("FUNDS SAFE", LIVE_W / 2, 590);
      }
      return;
    }

    const gm = this.channel("explorer.gm", step, 0) > 0.5;
    if (!gm) return;
    const thx = this.channel("explorer.thx", step, 0) > 0.5;
    c.fillStyle = "rgba(12,6,10,0.94)";
    c.fillRect(44, 470, LIVE_W - 88, 214);
    c.strokeStyle = "#ff5c48";
    c.lineWidth = 4;
    c.strokeRect(44, 470, LIVE_W - 88, 214);
    c.font = `600 24px ${FONT_MONO}`;
    c.fillStyle = "#ff9d8c";
    c.fillText("inbound tx message from 0xdead…c0de", 70, 502);
    c.font = `700 64px ${FONT_MONO}`;
    c.fillStyle = "#ffffff";
    c.fillText("gm", 70, 566);
    if (thx) {
      c.font = `700 46px ${FONT_MONO}`;
      c.fillText("thx for the liquidity", 70, 636);
    }
  }

  private drawMultisigText(c: CanvasRenderingContext2D, allAwake: boolean, line = false) {
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `700 40px ${FONT_MONO}`;
    c.fillStyle = allAwake ? "#2ee6c7" : "#ffc23d";
    c.fillText(allAwake ? "SIGNERS 3/3" : "SIGNERS 1/3", LIVE_W / 2, 90);
    c.font = `700 34px ${FONT_MONO}`;
    c.fillStyle = "#6de8d4";
    c.fillText("ONLINE", 192, 170);
    if (!allAwake) {
      c.fillStyle = "#9aa6c4";
      c.fillText("zzz", 480, 170);
      c.fillText("zzz", 768, 170);
    } else {
      c.fillText("ONLINE", 480, 170);
      c.fillText("ONLINE", 768, 170);
    }
    if (line) {
      c.fillStyle = "rgba(4,6,12,0.92)";
      c.fillRect(80, 570, LIVE_W - 160, 96);
      c.fillStyle = "#ffffff";
      c.font = `700 42px ${FONT_MONO}`;
      c.fillText("gm. what'd we miss?", LIVE_W / 2, 618);
    }
  }

  private drawWalletText(c: CanvasRenderingContext2D) {
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#6df0d0";
    c.font = `700 44px ${FONT_MONO}`;
    c.fillText("SIGN: PAUSE", LIVE_W / 2, 262);
    c.fillStyle = "#fff";
    c.font = `700 32px ${FONT_MONO}`;
    c.fillText("SIGN", LIVE_W / 2, 429);
  }

  private drawGasText(c: CanvasRenderingContext2D, step: number) {
    if (this.channel("tear.gas", step, 0) < 0.5) return;
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.font = `700 40px ${FONT_MONO}`;
    c.fillStyle = "#ffc23d";
    const dots = ".".repeat(Math.floor(step / 2) % 4);
    c.fillText(`tx pending${dots}`, 40, 60);
    c.fillStyle = "#ff5c48";
    c.fillText("gas: 9,999 gwei", 40, 112);
  }

  get currentStep() {
    return this.time;
  }
}
