export type HashItem = { id: number; x: number; y: number; radius: number };

const KEY_BIAS = 32768;
const KEY_STRIDE = 65536;

export class SpatialHash {
  private buckets = new Map<number, HashItem[]>();
  private used: HashItem[][] = [];
  private pool: HashItem[] = [];
  private poolCount = 0;
  readonly cellSize: number;

  constructor(cellSize = 96) {
    this.cellSize = cellSize;
  }

  clear() {
    for (const bucket of this.used) bucket.length = 0;
    this.used.length = 0;
    this.poolCount = 0;
  }

  private key(cx: number, cy: number) {
    return (cx + KEY_BIAS) * KEY_STRIDE + (cy + KEY_BIAS);
  }

  private place(item: HashItem) {
    const k = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    let bucket = this.buckets.get(k);
    if (!bucket) {
      bucket = [];
      this.buckets.set(k, bucket);
    }
    if (bucket.length === 0) this.used.push(bucket);
    bucket.push(item);
  }

  insert(item: HashItem) {
    this.place(item);
  }

  add(id: number, x: number, y: number, radius: number) {
    let item = this.pool[this.poolCount];
    if (!item) {
      item = { id, x, y, radius };
      this.pool.push(item);
    } else {
      item.id = id;
      item.x = x;
      item.y = y;
      item.radius = radius;
    }
    this.poolCount++;
    this.place(item);
  }

  query(x: number, y: number, radius: number, out: HashItem[] = []): HashItem[] {
    out.length = 0;
    const r = Math.ceil(radius / this.cellSize);
    const cx0 = Math.floor(x / this.cellSize);
    const cy0 = Math.floor(y / this.cellSize);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const bucket = this.buckets.get(this.key(cx0 + dx, cy0 + dy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) out.push(bucket[i]!);
      }
    }
    return out;
  }
}
