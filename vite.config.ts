import { defineConfig } from "vite";
import { firstLoadBudgetPlugin } from "./scripts/first-load-budget-plugin";
import { xCardPlugin } from "./scripts/x-card-plugin";

export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1", port: 5179, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
        },
      },
    },
  },
  plugins: [xCardPlugin(), firstLoadBudgetPlugin()],
});
