import { defineConfig, mergeConfig } from "vite";
import path from "path";
import baseConfig from "./vite.config";

// Test-only Vite config used by Playwright e2e runs. It reuses the production
// Vite config and only swaps the `@clerk/react` import for a local stub so the
// gated routes render without requiring real Clerk authentication. No
// production code is changed.
export default defineConfig(async (env) => {
  const resolved = typeof baseConfig === "function" ? await baseConfig(env) : baseConfig;
  return mergeConfig(resolved, {
    resolve: {
      alias: {
        "@clerk/react": path.resolve(import.meta.dirname, "tests/clerk-stub.tsx"),
      },
    },
  });
});
