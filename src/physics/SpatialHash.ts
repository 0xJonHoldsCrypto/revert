export type HashItem = { id: number; x: number; y: number; radius: number };

export class SpatialHash {
  private buckets = new Map<string, HashItem[]>();
  readonly cellSize: number;

  constructor(cellSize = 96) {
    this.cellSize = cellSize;
  }

  clear() {
    this.buckets.clear();
  }

  private key(cx: number, cy: number) {
    return `${cx},${cy}`;
  }

  insert(item: HashItem) {
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
    const k = this.key(cx, cy);
    let bucket = this.buckets.get(k);
    if (!bucket) {
      bucket = [];
      this.buckets.set(k, bucket);
    }
    bucket.push(item);
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
        for (const item of bucket) out.push(item);
      }
    }
    return out;
  }
}
