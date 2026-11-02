export type PixelSprite = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  size: number;
};

export function createPixelSprite(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): PixelSprite {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  draw(ctx, size);
  return { canvas, ctx, size };
}

export function refreshAntiAlias(sprite: PixelSprite, draw: (ctx: CanvasRenderingContext2D, size: number) => void, scale: number) {
  const logical = sprite.size;
  const physical = Math.max(logical, Math.floor(logical * scale));
  if (sprite.canvas.width !== physical) {
    sprite.canvas.width = physical;
    sprite.canvas.height = physical;
  }
  sprite.ctx.setTransform(physical / logical, 0, 0, physical / logical, 0, 0);
  sprite.ctx.imageSmoothingEnabled = true;
  sprite.ctx.clearRect(0, 0, logical, logical);
  draw(sprite.ctx, logical);
}

export function drawCharacterSprite(ctx: CanvasRenderingContext2D, size: number, body: string, accent: string) {
  const u = size / 32;
  ctx.fillStyle = body;
  ctx.fillRect(8 * u, 6 * u, 16 * u, 18 * u);
  ctx.fillStyle = accent;
  ctx.fillRect(10 * u, 8 * u, 12 * u, 6 * u);
  ctx.fillStyle = "#fff";
  ctx.fillRect(11 * u, 18 * u, 4 * u, 4 * u);
  ctx.fillRect(17 * u, 18 * u, 4 * u, 4 * u);
  ctx.fillStyle = body;
  ctx.fillRect(6 * u, 24 * u, 6 * u, 6 * u);
  ctx.fillRect(20 * u, 24 * u, 6 * u, 6 * u);
}

export function drawEnemySprite(ctx: CanvasRenderingContext2D, size: number, body: string) {
  const u = size / 24;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(12 * u, 12 * u, 10 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(8 * u, 9 * u, 3 * u, 3 * u);
  ctx.fillRect(13 * u, 9 * u, 3 * u, 3 * u);
}
