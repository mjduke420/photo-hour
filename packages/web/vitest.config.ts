import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@photo-hour/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
    },
  },
  test: {
    name: "web",
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
  },
});
