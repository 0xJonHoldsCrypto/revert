import * as THREE from "three";
import { cameraBasis } from "./view";
import type { AtlasFrame } from "./SpriteAtlas";

const QUAD_POSITIONS = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]);
const CENTER_QUAD_POSITIONS = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
const QUAD_INDEX = [0, 1, 2, 0, 2, 3];

export const MAX_POINT_LIGHTS = 4;

function makeInstancedGeometry(positions: Float32Array, capacity: number, layout: Record<string, number>) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(QUAD_INDEX);
  geometry.instanceCount = 0;
  const arrays: Record<string, THREE.InstancedBufferAttribute> = {};
  for (const [name, size] of Object.entries(layout)) {
    const attribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attribute);
    arrays[name] = attribute;
  }
  return { geometry, arrays };
}

const SPRITE_VERTEX_BODY = `
  attribute vec3 iPos;
  attribute vec2 iSize;
  attribute vec4 iUv;
  attribute vec2 iFx;
  uniform vec3 uUp;
  varying vec2 vUv;
  varying vec2 vFx;
  varying vec3 vWorld;
  vec3 spriteWorld() {
    vUv = vec2(mix(iUv.x, iUv.z, position.x + 0.5), mix(iUv.y, iUv.w, position.y));
    vFx = iFx;
    return iPos + vec3(position.x * iSize.x, 0.0, 0.0) + uUp * position.y * iSize.y;
  }
`;

export type SpriteLights = {
  ambient: THREE.Color;
  key: THREE.Color;
  pointPos: THREE.Vector3[];
  pointColor: THREE.Color[];
};

export class SpriteBatch {
  readonly mesh: THREE.Mesh;
  private geometry: THREE.InstancedBufferGeometry;
  private pos: Float32Array;
  private size: Float32Array;
  private uv: Float32Array;
  private fx: Float32Array;
  private attrs: Record<string, THREE.InstancedBufferAttribute>;
  private count = 0;

  constructor(private capacity: number, map: THREE.Texture, lights: SpriteLights) {
    const { geometry, arrays } = makeInstancedGeometry(QUAD_POSITIONS, capacity, { iPos: 3, iSize: 2, iUv: 4, iFx: 2 });
    this.geometry = geometry;
    this.attrs = arrays;
    this.pos = arrays.iPos!.array as Float32Array;
    this.size = arrays.iSize!.array as Float32Array;
    this.uv = arrays.iUv!.array as Float32Array;
    this.fx = arrays.iFx!.array as Float32Array;
    const up = new THREE.Vector3(0, cameraBasis.upY, cameraBasis.upZ);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uUp: { value: up },
        uAmbient: { value: lights.ambient },
        uKey: { value: lights.key },
        uPointPos: { value: lights.pointPos },
        uPointColor: { value: lights.pointColor },
      },
      side: THREE.DoubleSide,
      vertexShader: `${SPRITE_VERTEX_BODY}
        void main() {
          vec3 world = spriteWorld();
          vWorld = world;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uAmbient;
        uniform vec3 uKey;
        uniform vec3 uPointPos[${MAX_POINT_LIGHTS}];
        uniform vec3 uPointColor[${MAX_POINT_LIGHTS}];
        varying vec2 vUv;
        varying vec2 vFx;
        varying vec3 vWorld;
        void main() {
          vec4 tex = texture2D(uMap, vUv);
          if (tex.a < 0.5) discard;
          vec3 light = uAmbient + uKey;
          for (int i = 0; i < ${MAX_POINT_LIGHTS}; i++) {
            float d = distance(vWorld, uPointPos[i]);
            float falloff = clamp(1.0 - d / 340.0, 0.0, 1.0);
            light += uPointColor[i] * falloff * falloff;
          }
          vec3 color = tex.rgb * light + tex.rgb * vFx.y;
          color = mix(color, vec3(2.4), vFx.x);
          gl_FragColor = vec4(color, 1.0);
        }`,
    });

    const depthMaterial = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uUp: { value: up } },
      side: THREE.DoubleSide,
      vertexShader: `${SPRITE_VERTEX_BODY}
        void main() {
          gl_Position = projectionMatrix * viewMatrix * vec4(spriteWorld(), 1.0);
        }`,
      fragmentShader: `
        #include <packing>
        uniform sampler2D uMap;
        varying vec2 vUv;
        void main() {
          if (texture2D(uMap, vUv).a < 0.5) discard;
          gl_FragColor = packDepthToRGBA(gl_FragCoord.z);
        }`,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.customDepthMaterial = depthMaterial;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
  }

  begin() {
    this.count = 0;
  }

  push(frame: AtlasFrame, x: number, y: number, lift: number, height: number, flip: boolean, flash = 0, emissive = 0, widthScale = 1) {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = lift;
    this.pos[i * 3 + 2] = y;
    const width = height * frame.aspect * widthScale;
    this.size[i * 2] = flip ? -width : width;
    this.size[i * 2 + 1] = height;
    this.uv[i * 4] = frame.u0;
    this.uv[i * 4 + 1] = frame.v0;
    this.uv[i * 4 + 2] = frame.u1;
    this.uv[i * 4 + 3] = frame.v1;
    this.fx[i * 2] = flash;
    this.fx[i * 2 + 1] = emissive;
  }

  commit() {
    this.geometry.instanceCount = this.count;
    for (const attribute of Object.values(this.attrs)) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, this.count * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }
}

export class FxBatch {
  readonly mesh: THREE.Mesh;
  private geometry: THREE.InstancedBufferGeometry;
  private attrs: Record<string, THREE.InstancedBufferAttribute>;
  private pos: Float32Array;
  private shape: Float32Array;
  private color: Float32Array;
  private count = 0;

  constructor(private capacity: number) {
    const { geometry, arrays } = makeInstancedGeometry(CENTER_QUAD_POSITIONS, capacity, { iPos: 3, iShape: 3, iColor: 4 });
    this.geometry = geometry;
    this.attrs = arrays;
    this.pos = arrays.iPos!.array as Float32Array;
    this.shape = arrays.iShape!.array as Float32Array;
    this.color = arrays.iColor!.array as Float32Array;
    const material = new THREE.ShaderMaterial({
      uniforms: { uUp: { value: new THREE.Vector3(0, cameraBasis.upY, cameraBasis.upZ) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 iPos;
        attribute vec3 iShape;
        attribute vec4 iColor;
        uniform vec3 uUp;
        varying vec2 vLocal;
        varying vec4 vColor;
        void main() {
          vLocal = position.xy * 2.0;
          vColor = iColor;
          float c = cos(iShape.z);
          float s = sin(iShape.z);
          vec2 p = vec2(position.x * iShape.x, position.y * iShape.y);
          vec2 r = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
          vec3 world = iPos + vec3(r.x, 0.0, 0.0) + uUp * r.y;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }`,
      fragmentShader: `
        varying vec2 vLocal;
        varying vec4 vColor;
        void main() {
          float d = length(vLocal);
          float glow = smoothstep(1.0, 0.0, d);
          float core = smoothstep(0.45, 0.1, d);
          gl_FragColor = vec4(vColor.rgb * (glow * glow + core) * vColor.a, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  begin() {
    this.count = 0;
  }

  push(x: number, y: number, height: number, width: number, length: number, angle: number, color: THREE.Color, intensity: number, alpha = 1) {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = height;
    this.pos[i * 3 + 2] = y;
    this.shape[i * 3] = length;
    this.shape[i * 3 + 1] = width;
    this.shape[i * 3 + 2] = angle;
    this.color[i * 4] = color.r * intensity;
    this.color[i * 4 + 1] = color.g * intensity;
    this.color[i * 4 + 2] = color.b * intensity;
    this.color[i * 4 + 3] = alpha;
  }

  commit() {
    this.geometry.instanceCount = this.count;
    for (const attribute of Object.values(this.attrs)) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, this.count * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }
}

export const DECAL_BLOB = 0;
export const DECAL_RING = 1;
export const DECAL_DISC = 2;
export const DECAL_ARC = 3;
export const DECAL_RECT = 4;

export class DecalBatch {
  readonly mesh: THREE.Mesh;
  private geometry: THREE.InstancedBufferGeometry;
  private attrs: Record<string, THREE.InstancedBufferAttribute>;
  private pos: Float32Array;
  private params: Float32Array;
  private color: Float32Array;
  private count = 0;

  constructor(private capacity: number) {
    const { geometry, arrays } = makeInstancedGeometry(CENTER_QUAD_POSITIONS, capacity, { iPos: 3, iParams: 4, iColor: 4 });
    this.geometry = geometry;
    this.attrs = arrays;
    this.pos = arrays.iPos!.array as Float32Array;
    this.params = arrays.iParams!.array as Float32Array;
    this.color = arrays.iColor!.array as Float32Array;
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute vec3 iPos;
        attribute vec4 iParams;
        attribute vec4 iColor;
        varying vec2 vLocal;
        varying vec4 vParams;
        varying vec4 vColor;
        void main() {
          vLocal = position.xy * 2.0;
          vParams = iParams;
          vColor = iColor;
          vec3 world = iPos + vec3(position.x * iParams.x * 2.0, 0.0, position.y * iParams.y * 2.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }`,
      fragmentShader: `
        varying vec2 vLocal;
        varying vec4 vParams;
        varying vec4 vColor;
        const float TAU = 6.2831853;
        void main() {
          float d = length(vLocal);
          float a;
          vec3 color = vColor.rgb;
          if (vParams.z < 0.5) {
            a = smoothstep(1.0, 0.25, d);
          } else if (vParams.z < 1.5) {
            float band = smoothstep(0.06, 0.03, abs(d - 0.94));
            float angle = atan(vLocal.x, vLocal.y) / TAU + 0.5;
            float dashes = step(0.45, fract(angle * 28.0));
            float filled = step(angle, vParams.w);
            a = band * max(dashes * 0.55, filled);
            color = mix(color, color * 2.2, filled);
          } else if (vParams.z < 2.5) {
            a = smoothstep(1.0, 0.92, d) * (0.2 + 0.8 * smoothstep(0.55, 0.95, d));
          } else if (vParams.z > 3.5) {
            vec2 edge = abs(vLocal);
            float rim = smoothstep(0.86, 0.92, max(edge.x, edge.y));
            a = max(rim, 0.22) * step(max(edge.x, edge.y), 1.0);
          } else {
            float delta = abs(mod(atan(vLocal.y, vLocal.x) - vParams.w + 3.14159265, TAU) - 3.14159265);
            a = smoothstep(1.0, 0.92, d) * smoothstep(0.35, 1.0, d) * smoothstep(1.25, 0.9, delta);
          }
          if (a < 0.01) discard;
          gl_FragColor = vec4(color, a * vColor.a);
        }`,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  begin() {
    this.count = 0;
  }

  push(x: number, y: number, radiusX: number, radiusY: number, kind: number, progress: number, color: THREE.Color, alpha: number) {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = 0.8;
    this.pos[i * 3 + 2] = y;
    this.params[i * 4] = radiusX;
    this.params[i * 4 + 1] = radiusY;
    this.params[i * 4 + 2] = kind;
    this.params[i * 4 + 3] = progress;
    this.color[i * 4] = color.r;
    this.color[i * 4 + 1] = color.g;
    this.color[i * 4 + 2] = color.b;
    this.color[i * 4 + 3] = alpha;
  }

  commit() {
    this.geometry.instanceCount = this.count;
    for (const attribute of Object.values(this.attrs)) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, this.count * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }
}
