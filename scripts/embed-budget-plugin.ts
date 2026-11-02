import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import type { Plugin } from "vite";

const LIMIT_BYTES = 124 * 1024;
const EMBED_PATTERN = /embed.*\.js$/;

export function embedBudgetPlugin(): Plugin {
  return {
    name: "embed-budget-gzip",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve("dist");
      const files = fs.readdirSync(outDir, { recursive: true }) as string[];
      for (const file of files) {
        if (!EMBED_PATTERN.test(file)) continue;
        const full = path.join(outDir, file);
        if (!fs.statSync(full).isFile()) continue;
        const gz = gzipSync(fs.readFileSync(full)).length;
        if (gz > LIMIT_BYTES) {
          throw new Error(`Embed bundle ${file} is ${gz} bytes gzip (limit ${LIMIT_BYTES}). Split lazy chunks or trim embed entry.`);
        }
      }
    },
  };
}
