import { ACHIEVEMENTS } from "../data/achievements";
import { BIOME_HAZARD_ORDER, BIOME_HAZARDS } from "../data/biomeHazards";
import { BIOME_LABEL } from "../data/biomeSpawns";
import { CHARACTERS } from "../data/characters";
import { heroAvailable, heroUnlockId, requirementText, UNLOCK_BY_ID } from "../data/unlocks";
import { heroPortrait } from "../pixel/handArt";
import { AFFIX_ORDER, AFFIXES } from "../data/affixes";
import { MINI_EVENT_ORDER, MINI_EVENTS } from "../game/events";
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
import { trapTab } from "./focusTrap";

type TabId = "crew" | "threats" | "intel" | "tools" | "gear" | "cameos" | "feats";

const TABS: [TabId, string][] = [
  ["crew", "CREW"],
  ["threats", "THREATS"],
  ["intel", "INTEL"],
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

function intelEntries(data: save.SaveData): Entry[] {
  const affixes = AFFIX_ORDER.map((id) => {
    const def = AFFIXES[id];
    return { key: `a:${id}`, name: `${def.name} whale`, body: def.desc, meta: "ELITE AFFIX", color: def.color, seen: !!data.codex.seen[`a:${id}`] };
  });
  const events = MINI_EVENT_ORDER.map((id) => {
    const def = MINI_EVENTS[id];
    return { key: `ev:${id}`, name: def.name, body: def.text, meta: "NETWORK EVENT", color: def.color, seen: !!data.codex.seen[`ev:${id}`] };
  });
  const hazards = BIOME_HAZARD_ORDER.map((id) => {
    const def = BIOME_HAZARDS[id];
    return { key: `hz:${id}`, name: def.name, body: def.text, meta: `HAZARD · ${BIOME_LABEL[def.biome].name.toUpperCase()}`, color: def.color, seen: !!data.codex.seen[`hz:${id}`] };
  });
  return [...affixes, ...events, ...hazards];
}

function crewEntries(data: save.SaveData): Entry[] {
  const unlocked = save.unlockedNow(data);
  return CHARACTERS.map((c) => {
    const lock = UNLOCK_BY_ID[heroUnlockId(c.id)];
    const open = heroAvailable(c.id, unlocked);
    return {
      key: `h:${c.id}`,
      name: c.name,
      body: `${c.role}. ${c.blurb}`,
      meta: open ? `Starts with ${WEAPONS[c.startWeapon].name}` : `LOCKED · ${lock ? requirementText(lock) : ""}`,
      color: c.color,
      art: heroPortrait(c.id),
      seen: true,
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

  const render = (focusTab = false) => {
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
      crew: crewEntries(data),
      threats: threatEntries(data),
      intel: intelEntries(data),
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
        render(true);
      });
      tabs.appendChild(b);
    }
    list.textContent = "";
    list.scrollTop = 0;
    const nodes = tab === "feats" ? featNodes(data) : sets[tab].map(entryNode);
    for (const n of nodes) list.appendChild(n);
    if (focusTab) tabs.querySelector<HTMLElement>("button.on")?.focus();
  };
  render();

  const onKey = (e: KeyboardEvent) => {
    e.stopImmediatePropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else trapTab(card, e);
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
