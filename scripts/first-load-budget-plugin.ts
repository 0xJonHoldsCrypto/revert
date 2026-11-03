import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import type { Plugin } from "vite";

const LIMIT_BYTES = 124 * 1024;
const HTML_ENTRIES = ["index.html"];
const HTML_ASSET = /<(?:script[^>]*\bsrc|link(?![^>]*\bdata-deferred)[^>]*\bhref)="\.?\/?(assets\/[^"]+\.(?:js|css))"/g;
const CSS_FONT = /url\(["']?(?:\.\/)?(?:assets\/)?([^"')]+\.woff2)["']?\)/g;
const STATIC_IMPORT = /(?:\bfrom\s*|\bimport\s*)["']\.\/([^"']+\.js)["']/g;

function gzippedSize(file: string): number {
  return gzipSync(fs.readFileSync(file)).length;
}

function staticClosure(outDir: string, html: string): Set<string> {
  const pending = [...html.matchAll(HTML_ASSET)].map((match) => match[1]!);
  const seen = new Set<string>();
  while (pending.length) {
    const asset = pending.pop()!;
    if (seen.has(asset)) continue;
    seen.add(asset);
    if (asset.endsWith(".woff2")) continue;
    if (asset.endsWith(".css")) {
      const css = fs.readFileSync(path.join(outDir, asset), "utf8");
      for (const match of css.matchAll(CSS_FONT)) pending.push(path.posix.join(path.posix.dirname(asset), match[1]!));
      continue;
    }
    const code = fs.readFileSync(path.join(outDir, asset), "utf8");
    for (const match of code.matchAll(STATIC_IMPORT)) pending.push(path.posix.join(path.posix.dirname(asset), match[1]!));
  }
  return seen;
}

export function firstLoadBudgetPlugin(): Plugin {
  return {
    name: "first-load-budget",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve("dist");
      for (const entry of HTML_ENTRIES) {
        const htmlPath = path.join(outDir, entry);
        const html = fs.readFileSync(htmlPath, "utf8");
        const assets = [...staticClosure(outDir, html)];
        const total = gzippedSize(htmlPath) + assets.reduce((sum, asset) => sum + gzippedSize(path.join(outDir, asset)), 0);
        const summary = `${entry} first load: ${(total / 1024).toFixed(1)} KB gzip of ${LIMIT_BYTES / 1024} KB (${assets.length} files)`;
        if (total > LIMIT_BYTES) throw new Error(`${summary}. Move code behind a dynamic import.`);
        console.log(summary);
      }
    },
  };
}
