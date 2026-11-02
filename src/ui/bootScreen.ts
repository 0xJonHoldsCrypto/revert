import { enemyFrame, heroFrame, paintLogo } from "../pixel/handArt";

const LINES: { text: string; at: number; tone?: string }[] = [
  { text: "revert-node v1.0 starting", at: 0 },
  { text: "dialing peers ... 8/8 connected", at: 0.14 },
  { text: "syncing headers to #20,999,999", at: 0.3 },
  { text: "verifying state root ... ok", at: 0.5 },
  { text: "baking sprites, compiling shaders", at: 0.68 },
  { text: "ALERT hot-wallet-7 outflow detected", at: 0.86, tone: "alert" },
];
const TIPS = [
  "Bridge Drainers carry stolen funds. Kill them and the money comes back.",
  "That XP shard is flickering red. It is not XP.",
  "Green badge. Friendly face. Do not let the Insider get close.",
  "Multisig only saves you while two signers are online.",
  "Flash loans must be repaid. With kills.",
];
const MIN_MS = 1700;
const BLOCKS = 28;

let root: HTMLElement | null = null;
let shown = 0;
let target = 0.1;
let started = 0;
let ready = false;
let onDone: (() => void) | null = null;

export function bootProgress(value: number) {
  target = Math.max(target, value);
}

export function finishBoot(done: () => void) {
  target = 1;
  ready = true;
  onDone = done;
}

function pixelImage(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  c.getContext("2d")!.drawImage(source, 0, 0);
  c.style.width = `${source.width * scale}px`;
  c.style.height = `${source.height * scale}px`;
  c.style.imageRendering = "pixelated";
  return c;
}

export function mountBootScreen() {
  started = performance.now();
  root = document.createElement("div");
  root.id = "boot";
  const logo = paintLogo(10);
  logo.className = "boot-logo";
  root.appendChild(logo);
  const tag = document.createElement("p");
  tag.className = "boot-tag";
  tag.textContent = "execution reverted: not on my watch";
  root.appendChild(tag);

  const track = document.createElement("div");
  track.className = "boot-track";
  const chain = document.createElement("div");
  chain.className = "boot-chain";
  const cells: HTMLElement[] = [];
  for (let i = 0; i < BLOCKS; i++) {
    const cell = document.createElement("i");
    chain.appendChild(cell);
    cells.push(cell);
  }
  const heroes = [0, 1].map((f) => pixelImage(heroFrame("trace", f), 2));
  const chasers = [0, 1].map((f) => pixelImage(enemyFrame("script-kiddie", f), 2));
  const runner = document.createElement("div");
  runner.className = "boot-runner";
  heroes.forEach((h) => runner.appendChild(h));
  const chaser = document.createElement("div");
  chaser.className = "boot-runner";
  chasers.forEach((h) => chaser.appendChild(h));
  track.append(chaser, runner, chain);
  root.appendChild(track);

  const log = document.createElement("div");
  log.className = "boot-log";
  root.appendChild(log);
  const tip = document.createElement("p");
  tip.className = "boot-tip";
  tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]!;
  root.appendChild(tip);
  document.body.appendChild(root);

  let lineIndex = 0;
  const tick = (now: number) => {
    if (!root) return;
    const timeShare = Math.min(1, (now - started) / MIN_MS);
    const goal = Math.min(target, ready ? timeShare : Math.min(0.92, timeShare + 0.1));
    shown += (goal - shown) * 0.12;
    if (ready && timeShare >= 1 && shown > 0.985) shown = 1;
    cells.forEach((cell, i) => cell.classList.toggle("on", i / BLOCKS < shown));
    while (lineIndex < LINES.length && LINES[lineIndex]!.at <= shown) {
      const line = LINES[lineIndex++]!;
      const el = document.createElement("div");
      el.textContent = `> ${line.text}`;
      if (line.tone) el.className = line.tone;
      log.appendChild(el);
    }
    const step = Math.floor(now / 130) % 2;
    heroes.forEach((h, f) => (h.style.display = f === step ? "block" : "none"));
    chasers.forEach((h, f) => (h.style.display = f === step ? "block" : "none"));
    runner.style.left = `calc(${shown * 100}% - 18px)`;
    chaser.style.left = `calc(${Math.max(0, shown * 100 - 9)}% - 18px)`;
    if (shown >= 1) {
      root.classList.add("out");
      const el = root;
      window.setTimeout(() => el.remove(), 380);
      root = null;
      onDone?.();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
