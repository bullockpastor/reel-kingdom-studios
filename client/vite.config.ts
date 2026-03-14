import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/studio/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/projects": "http://localhost:8010",
      "/shots": "http://localhost:8010",
      "/health": "http://localhost:8010",
      "/assets": "http://localhost:8010",
      "/queue": "http://localhost:8010",
      "/presenter": "http://localhost:8010",
      "/engines": "http://localhost:8010",
      "/costs": "http://localhost:8010",
      "/model-router": "http://localhost:8010",
      "/runpod": "http://localhost:8010",
    },
  },
});
