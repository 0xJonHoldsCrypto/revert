import type { HtmlTagDescriptor, Plugin } from "vite";

type ChunkInfo = { fileName: string; type: string; isEntry?: boolean; isDynamicEntry?: boolean; imports?: string[] };

export function lateChunkPreloadPlugin(): Plugin {
  return {
    name: "late-chunk-preload",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const bundle = ctx.bundle as Record<string, ChunkInfo> | undefined;
        if (!bundle) return [];
        const chunks = Object.values(bundle).filter((item) => item.type === "chunk");
        const early = new Set<string>();
        const entry = chunks.find((chunk) => chunk.isEntry);
        const walkEarly = (name: string) => {
          if (early.has(name)) return;
          early.add(name);
          for (const dep of bundle[name]?.imports ?? []) walkEarly(dep);
        };
        if (entry) walkEarly(entry.fileName);
        const late = new Set<string>();
        const walkLate = (name: string) => {
          if (early.has(name) || late.has(name)) return;
          late.add(name);
          for (const dep of bundle[name]?.imports ?? []) walkLate(dep);
        };
        for (const chunk of chunks) if (chunk.isDynamicEntry) walkLate(chunk.fileName);
        const tags: HtmlTagDescriptor[] = [];
        for (const name of [...late].reverse()) {
          tags.push({ tag: "link", attrs: { rel: "modulepreload", crossorigin: "", href: `./${name}`, "data-deferred": "" }, injectTo: "head" });
        }
        return tags;
      },
    },
  };
}
