import type { HtmlTagDescriptor, Plugin } from "vite";

const TITLE = "REVERT";
const DESCRIPTION = "A crypto-exploit survivors game. Drop into the chain and revert the hack before the funds are gone. Tap to play right here.";
const IMAGE_ALT = "The REVERT logo over a responder fighting a horde of pixel-art crypto attackers.";
const PLAYER_SIZE = "480";

function meta(attribute: "name" | "property", key: string, content: string): HtmlTagDescriptor {
  return { tag: "meta", attrs: { [attribute]: key, content }, injectTo: "head" };
}

export function xCardPlugin(): Plugin {
  const publicUrl = process.env.PUBLIC_URL?.replace(/\/+$/, "");
  return {
    name: "x-card",
    apply: "build",
    transformIndexHtml(_html, context) {
      if (!context.path.endsWith("/index.html")) return [];
      if (!publicUrl) {
        console.warn("PUBLIC_URL is not set: building without X player card tags.");
        return [];
      }
      if (!publicUrl.startsWith("https://")) throw new Error("PUBLIC_URL must be https: X only embeds https players.");
      const image = `${publicUrl}/card.jpg`;
      return [
        meta("name", "twitter:card", "player"),
        meta("name", "twitter:title", TITLE),
        meta("name", "twitter:description", DESCRIPTION),
        meta("name", "twitter:player", `${publicUrl}/`),
        meta("name", "twitter:player:width", PLAYER_SIZE),
        meta("name", "twitter:player:height", PLAYER_SIZE),
        meta("name", "twitter:image", image),
        meta("name", "twitter:image:alt", IMAGE_ALT),
        meta("property", "og:title", TITLE),
        meta("property", "og:description", DESCRIPTION),
        meta("property", "og:type", "website"),
        meta("property", "og:url", `${publicUrl}/`),
        meta("property", "og:image", image),
        { tag: "link", attrs: { rel: "canonical", href: `${publicUrl}/` }, injectTo: "head" },
      ];
    },
  };
}
