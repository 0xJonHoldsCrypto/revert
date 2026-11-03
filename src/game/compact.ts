export function compact<T>(items: T[], keep: (item: T) => boolean) {
  let w = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (!keep(item)) continue;
    if (w !== i) items[w] = item;
    w++;
  }
  items.length = w;
}

const notDead = (item: { dead?: boolean }) => !item.dead;
const alive = (item: { life: number }) => item.life > 0;

export function compactDead(items: { dead?: boolean }[]) {
  compact(items, notDead);
}

export function compactLife(items: { life: number }[]) {
  compact(items, alive);
}
