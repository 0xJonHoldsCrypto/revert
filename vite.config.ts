import { defineConfig } from "vite";
import { embedBudgetPlugin } from "./scripts/embed-budget-plugin";

export default defineConfig({
  base: "./",
  server: { port: 5173, open: true },
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
