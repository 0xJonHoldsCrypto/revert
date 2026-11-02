export const VIEW = {
  fovDeg: 20,
  pitchDeg: 50,
  baseHeight: 520,
  minWidth: 620,
};

const pitch = (VIEW.pitchDeg * Math.PI) / 180;

export function perpendicularViewHeight(aspect: number): number {
  return Math.max(VIEW.baseHeight, VIEW.minWidth / aspect);
}

export function cameraDistance(aspect: number): number {
  const half = (VIEW.fovDeg * Math.PI) / 360;
  return perpendicularViewHeight(aspect) / (2 * Math.tan(half));
}

export function groundHalfExtents(aspect: number): { halfW: number; halfH: number } {
  const height = perpendicularViewHeight(aspect);
  return { halfW: (height * aspect) / 2, halfH: height / (2 * Math.sin(pitch)) };
}

export const cameraBasis = {
  upY: Math.cos(pitch),
  upZ: -Math.sin(pitch),
  backY: Math.sin(pitch),
  backZ: Math.cos(pitch),
};
