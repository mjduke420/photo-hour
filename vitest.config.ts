import { defineConfig } from "vitest/config";

/**
 * Files that only a real browser can exercise. Each is covered by the Playwright
 * suite in e2e/ instead, which drives the built app against a live GPU.
 */
const BROWSER_ONLY = [
  // Mounts the DOM.
  "packages/web/src/main.tsx",
  // Composition root: wiring, no logic of its own worth isolating.
  "packages/web/src/App.tsx",
  // Imperative MapLibre wrapper; needs a real map instance.
  "packages/web/src/map/MapView.tsx",
  // WebGL programs, framebuffers and draw calls; needs a real GL context.
  "packages/web/src/map/TerrainShadowLayer.ts",
  // Starts the process and binds the port.
  "packages/server/src/index.ts",
];

export default defineConfig({
  test: {
    projects: ["packages/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["packages/*/src/**/*.ts", "packages/*/src/**/*.tsx"],
      exclude: [
        "packages/*/src/**/*.d.ts",
        // Re-export barrel with no behaviour.
        "packages/shared/src/index.ts",
        ...BROWSER_ONLY,
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
