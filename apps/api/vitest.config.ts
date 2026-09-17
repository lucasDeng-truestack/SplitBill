import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      RECEIPT_PARSER: "mock",
    },
    setupFiles: ["./tests/setup-env.ts"],
  },
});
