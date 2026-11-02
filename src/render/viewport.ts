export type ViewportSize = { width: number; height: number; dpr: number };

export function readViewport(canvas: HTMLCanvasElement): ViewportSize {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, canvas.clientWidth || window.innerWidth);
  const height = Math.max(1, canvas.clientHeight || window.innerHeight);
  return { width, height, dpr };
}

export function applyCanvasSize(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): ViewportSize {
  const vp = readViewport(canvas);
  canvas.width = Math.floor(vp.width * vp.dpr);
  canvas.height = Math.floor(vp.height * vp.dpr);
  ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
  return vp;
}

export function applyCanvasBackingStore(canvas: HTMLCanvasElement): ViewportSize {
  const vp = readViewport(canvas);
  canvas.width = Math.floor(vp.width * vp.dpr);
  canvas.height = Math.floor(vp.height * vp.dpr);
  return vp;
}
