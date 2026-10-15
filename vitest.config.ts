import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const pkg = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@tracefolio/core": pkg("core"),
      "@tracefolio/git-adapter": pkg("git-adapter"),
      "@tracefolio/generators": pkg("generators"),
      "@tracefolio/integrations": pkg("integrations"),
      "@tracefolio/activity": pkg("activity"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "packages/*/src/**/*.test.ts"],
    testTimeout: 20000,
  },
});
