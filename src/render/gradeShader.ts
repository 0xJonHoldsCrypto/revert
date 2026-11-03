export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTexel: { value: [1 / 1024, 1 / 768] },
    uTime: { value: 0 },
    uTilt: { value: 1 },
    uImpact: { value: 0 },
    uHurt: { value: 0 },
    toneMappingExposure: { value: 1 },
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
      gl_FragColor = vec4(color, 1.0);
    }`,
};
