import { ACHIEVEMENTS } from "../data/achievements";
import { CAMEOS } from "../data/cameos";
import { ENEMIES } from "../data/enemies";
import { GEAR, SLOT_LABEL, type GearId } from "../data/gear";
import { RARITY_COLORS } from "../data/rarity";
import { EVOLUTIONS, WEAPONS } from "../data/weapons";
import type { Game } from "../game/Game";
import { THREAT_INTEL } from "../game/threats";
import { getThreatSprite } from "../pixel/threatArt";
import * as save from "../save";
import type { EnemyKind, WeaponKind } from "../types";
import { formatTime } from "../utils/math";

type TabId = "threats" | "tools" | "gear" | "cameos" | "feats";

const TABS: [TabId, string][] = [
  ["threats", "THREATS"],
  ["tools", "TOOLS"],
  ["gear", "GEAR"],
  ["cameos", "CAMEOS"],
  ["feats", "ACHIEVEMENTS"],
];

let open: { close(): void } | null = null;

type Entry = { key: string; name: string; body: string; meta: string; color: string; art?: HTMLCanvasElement; seen: boolean };

function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d")!.drawImage(source, 0, 0);
  return canvas;
}

function playTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function threatEntries(data: save.SaveData): Entry[] {
  return (Object.keys(ENEMIES) as EnemyKind[]).map((kind) => {
    const def = ENEMIES[kind];
    const key = `e:${kind}`;
    const killed = data.codex.killed[key] ?? 0;
    return {
      key,
      name: def.name,
      body: THREAT_INTEL[kind] ?? (def.isBoss ? "A boss-class attacker." : "No intel filed."),
      meta: `${def.isBoss ? "BOSS · " : ""}Reverted ${killed.toLocaleString("en-US")}`,
      color: def.color,
      art: getThreatSprite(kind),
      seen: !!data.codex.seen[key],
    };
  });
}

function toolEntries(data: save.SaveData): Entry[] {
  return (Object.keys(WEAPONS) as WeaponKind[]).map((kind) => {
    const def = WEAPONS[kind];
    const evo = EVOLUTIONS[kind];
    const evolved = !!data.codex.seen[`v:${kind}`];
    return {
      key: `t:${kind}`,
      name: def.name,
      body: def.description,
      meta: evolved ? `Evolves: ${evo.name}. ${evo.blurb}` : "Evolution: ???",
      color: RARITY_COLORS[def.rarity],
      seen: !!data.codex.seen[`t:${kind}`],
    };
  });
}

function gearEntries(data: save.SaveData): Entry[] {
  return (Object.keys(GEAR) as GearId[]).map((id) => {
    const def = GEAR[id];
    return {
      key: `g:${id}`,
      name: def.name,
      body: `"${def.line}"`,
      meta: SLOT_LABEL[def.slot],
      color: RARITY_COLORS[def.rarity],
      seen: !!data.codex.seen[`g:${id}`],
    };
  });
}

function cameoEntries(data: save.SaveData): Entry[] {
  return (Object.keys(CAMEOS) as (keyof typeof CAMEOS)[]).map((id) => {
    const def = CAMEOS[id];
    return { key: `c:${id}`, name: def.name, body: def.deal, meta: def.handle, color: def.color, seen: !!data.codex.seen[`c:${id}`] };
  });
}

function entryNode(e: Entry): HTMLElement {
  const el = document.createElement("article");
  el.className = `cx-entry${e.seen ? "" : " locked"}`;
  el.style.setProperty("--c", e.seen ? e.color : "#4a4f66");
  const art = document.createElement("div");
  art.className = "cx-art";
  if (e.art) art.appendChild(copyCanvas(e.art));
  else art.textContent = e.seen ? e.name[0]! : "?";
  const text = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = e.seen ? e.name : "???";
  const body = document.createElement("p");
  body.textContent = e.seen ? e.body : "Not encountered yet.";
  const meta = document.createElement("small");
  meta.textContent = e.seen ? e.meta : "";
  text.append(title, body, meta);
  el.append(art, text);
  return el;
}

function featNodes(data: save.SaveData): HTMLElement[] {
  return ACHIEVEMENTS.map((a) => {
    const at = data.achievements[a.id];
    const el = document.createElement("article");
    el.className = `cx-entry cx-feat${at ? " done" : " locked"}`;
    el.style.setProperty("--c", at ? "#ffc23d" : "#4a4f66");
    const art = document.createElement("div");
    art.className = "cx-art";
    art.textContent = at ? "✓" : "·";
    const text = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = a.name;
    const body = document.createElement("p");
    body.textContent = a.desc;
    const meta = document.createElement("small");
    meta.textContent = at ? `Unlocked ${new Date(at).toLocaleDateString()}` : "Locked";
    text.append(title, body, meta);
    el.append(art, text);
    return el;
  });
}

export function showCodex(game: Game, initial?: string) {
  if (open) return;
  let tab: TabId = TABS.some(([id]) => id === initial) ? (initial as TabId) : "threats";
  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  backdrop.innerHTML = `
    <div class="settings-card codex-card" role="dialog" aria-modal="true" aria-labelledby="codex-title">
      <h2 id="codex-title">CODEX</h2>
      <div class="cx-stats"></div>
      <div class="cx-tabs" role="tablist"></div>
      <div class="cx-list"></div>
      <div class="set-actions"><button type="button" class="btn btn-primary" id="cx-close">DONE <kbd>ESC</kbd></button></div>
    </div>
  `;
  document.body.appendChild(backdrop);
  const card = backdrop.querySelector<HTMLElement>(".codex-card")!;
  const list = card.querySelector<HTMLElement>(".cx-list")!;
  const tabs = card.querySelector<HTMLElement>(".cx-tabs")!;

  const render = () => {
    const data = save.get();
    const s = data.stats;
    card.querySelector(".cx-stats")!.innerHTML = [
      ["RUNS", s.runs.toLocaleString("en-US")],
      ["BEST TIME", s.bestTime > 0 ? formatTime(s.bestTime) : "-"],
      ["REVERTED", s.kills.toLocaleString("en-US")],
      ["BOSSES", s.bosses.toLocaleString("en-US")],
      ["PLAYED", playTime(s.timeSec)],
    ]
      .map(([k, v]) => `<div><label>${k}</label><strong>${v}</strong></div>`)
      .join("");
    const sets: Record<TabId, Entry[]> = {
      threats: threatEntries(data),
      tools: toolEntries(data),
      gear: gearEntries(data),
      cameos: cameoEntries(data),
      feats: [],
    };
    tabs.textContent = "";
    for (const [id, label] of TABS) {
      const found = id === "feats" ? Object.keys(data.achievements).length : sets[id].filter((e) => e.seen).length;
      const total = id === "feats" ? ACHIEVEMENTS.length : sets[id].length;
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === tab));
      b.className = id === tab ? "on" : "";
      b.textContent = `${label} ${found}/${total}`;
      b.addEventListener("click", () => {
        tab = id;
        render();
      });
      tabs.appendChild(b);
    }
    list.textContent = "";
    list.scrollTop = 0;
    const nodes = tab === "feats" ? featNodes(data) : sets[tab].map(entryNode);
    for (const n of nodes) list.appendChild(n);
  };
  render();

  const onKey = (e: KeyboardEvent) => {
    e.stopImmediatePropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };
  window.addEventListener("keydown", onKey, true);
  backdrop.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (e.target === backdrop) close();
  });

  function close() {
    window.removeEventListener("keydown", onKey, true);
    backdrop.remove();
    open = null;
    document.getElementById("game")?.focus();
    if (game.phase === "playing") game.autoPause();
  }

  open = { close };
  card.querySelector("#cx-close")!.addEventListener("click", close);
  tabs.querySelector<HTMLElement>("button.on")?.focus();
}
