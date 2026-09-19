import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative asset URLs so GitHub Pages works from repo root or /docs.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "docs",
    emptyOutDir: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./app.html", import.meta.url)),
    },
  },
});
