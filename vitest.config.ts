import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // A test runs bin.ts as a process, where coverage does not follow.
      exclude: ["src/**/*.test.ts", "src/generated/**", "src/bin.ts"],
      reporter: ["text", "html", "lcov"],
      thresholds: { 100: true },
    },
  },
});
