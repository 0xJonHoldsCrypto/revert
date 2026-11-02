import { defineConfig } from "vite";
import { embedBudgetPlugin } from "./scripts/embed-budget-plugin";

export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1", port: 5179, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        embed: "embed.html",
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
        },
      },
    },
  },
  plugins: [embedBudgetPlugin()],
});
