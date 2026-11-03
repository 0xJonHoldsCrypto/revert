import type { BiomeId } from "./environment";
import type { BiomeHazardId } from "../types";

export type BiomeHazardDef = { id: BiomeHazardId; name: string; biome: BiomeId; color: string; label: string; text: string };

export const BIOME_HAZARDS: Record<BiomeHazardId, BiomeHazardDef> = {
  "gas-lane": { id: "gas-lane", name: "Gas Lane", biome: "mempool", color: "#b7e04b", label: "GAS SURGE", text: "A priority lane lights up through you, then surges. Step off the strip." },
  "alarm-laser": { id: "alarm-laser", name: "Alarm Laser", biome: "vault", color: "#ff3a2e", label: "ALARM", text: "A wall emitter paints a line, then sweeps it. Get behind the emitter or past its reach." },
  "span-collapse": { id: "span-collapse", name: "Collapsing Span", biome: "bridge", color: "#ffa657", label: "SPAN", text: "The deck cracks in a row ahead of you and drops tile by tile. Turn aside." },
  "sniper-glint": { id: "sniper-glint", name: "Front-Run Sniper", biome: "forest", color: "#e6f03c", label: "GLINT", text: "A scope follows you, then locks. When the glint goes solid, move." },
  "frost-vent": { id: "frost-vent", name: "Frost Vent", biome: "cold", color: "#9fe8ff", label: "FROST", text: "Cryo vents frost over, then vent. Standing in one chills you and stings." },
};

export const BIOME_HAZARD_ORDER: BiomeHazardId[] = ["gas-lane", "alarm-laser", "span-collapse", "sniper-glint", "frost-vent"];

export const HAZARD_OF_BIOME: Record<BiomeId, BiomeHazardId> = {
  mempool: "gas-lane",
  vault: "alarm-laser",
  bridge: "span-collapse",
  forest: "sniper-glint",
  cold: "frost-vent",
};

export function isBiomeHazard(source: string): source is BiomeHazardId {
  return Object.prototype.hasOwnProperty.call(BIOME_HAZARDS, source);
}
