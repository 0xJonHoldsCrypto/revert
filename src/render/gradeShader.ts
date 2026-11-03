import { Matrix3 } from "three";
import type { ColorblindMode } from "../save";

type Rows = [number, number, number, number, number, number, number, number, number];

const SIMULATE: Record<Exclude<ColorblindMode, "off">, Rows> = {
  prot: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deut: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  trit: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
};

const SHIFT: Record<Exclude<ColorblindMode, "off">, Rows> = {
  prot: [0, 0, 0, 0.7, 1, 0, 0.7, 0, 1],
  deut: [0, 0, 0, 0.7, 1, 0, 0.7, 0, 1],
  trit: [1, 0.7, 0, 0, 1, 0, 0, 0.7, 1],
};

function multiply(a: Rows, b: Rows): Rows {
  const out = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      for (let k = 0; k < 3; k++) out[r * 3 + c]! += a[r * 3 + k]! * b[k * 3 + c]!;
    }
  }
  return out as Rows;
}

export function colorblindRows(mode: ColorblindMode): Rows {
  const identity: Rows = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (mode === "off") return identity;
  const sim = SIMULATE[mode];
  const lost = identity.map((v, i) => v - sim[i]!) as Rows;
  const shifted = multiply(SHIFT[mode], lost);
  return identity.map((v, i) => v + shifted[i]!) as Rows;
}

export function setColorblind(matrix: Matrix3, mode: ColorblindMode) {
  const r = colorblindRows(mode);
  matrix.set(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]);
}

export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTexel: { value: [1 / 1024, 1 / 768] },
    uTime: { value: 0 },
    uTilt: { value: 1 },
    uImpact: { value: 0 },
    uHurt: { value: 0 },
    toneMappingExposure: { value: 1 },
    uCbOn: { value: 0 },
    uCb: { value: new Matrix3() },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uTime;
    uniform float uTilt;
    uniform float uImpact;
    uniform float uHurt;
    uniform float uCbOn;
    uniform mat3 uCb;
    varying vec2 vUv;

    #include <tonemapping_pars_fragment>

    vec3 display(vec3 c) {
      return sRGBTransferOETF(vec4(ACESFilmicToneMapping(c), 1.0)).rgb;
    }

    const vec2 TAPS[12] = vec2[12](
      vec2(1.0, 0.0), vec2(0.5, 0.87), vec2(-0.5, 0.87), vec2(-1.0, 0.0), vec2(-0.5, -0.87), vec2(0.5, -0.87),
      vec2(0.5, 0.0), vec2(0.25, 0.43), vec2(-0.25, 0.43), vec2(-0.5, 0.0), vec2(-0.25, -0.43), vec2(0.25, -0.43)
    );

    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      float offCenter = abs(vUv.y - 0.5);
      float blur = smoothstep(0.26, 0.5, offCenter) * uTilt;
      vec3 color = display(texture2D(tDiffuse, vUv).rgb);
      if (blur > 0.001) {
        vec3 sum = color;
        float radius = blur * 7.0;
        for (int i = 0; i < 12; i++) {
          sum += display(texture2D(tDiffuse, vUv + TAPS[i] * radius * uTexel).rgb);
        }
        color = sum / 13.0;
      }

      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(luma), color, 1.08);
      vec3 coolShadow = vec3(0.12, 0.2, 0.42);
      vec3 warmHighlight = vec3(1.0, 0.86, 0.62);
      color += coolShadow * (1.0 - smoothstep(0.0, 0.45, luma)) * 0.1;
      color = mix(color, color * warmHighlight, smoothstep(0.55, 1.0, luma) * 0.28);

      vec2 fromCenter = vUv - 0.5;
      float vignette = smoothstep(0.42, 1.05, length(fromCenter) * 1.4142);
      color *= 1.0 - vignette * 0.45;
      color = mix(color, vec3(0.95, 0.12, 0.16), smoothstep(0.25, 1.0, length(fromCenter) * 1.4142) * uHurt * 0.55);

      float grain = noise(vUv * 917.0 + fract(uTime) * 61.0) - 0.5;
      color += grain * 0.02;
      if (uImpact > 0.5) {
        float ink = step(0.32, dot(color, vec3(0.299, 0.587, 0.114)));
        color = mix(vec3(0.05, 0.04, 0.08), vec3(1.0, 0.97, 0.92), ink);
      }
      if (uCbOn > 0.5) color = clamp(uCb * color, 0.0, 1.0);
      gl_FragColor = vec4(color, 1.0);
    }`,
};
