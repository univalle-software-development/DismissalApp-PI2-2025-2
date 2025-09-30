
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    exclude: ["node_modules", ".next", "e2e", "tests-e2e"],
    server: { deps: { inline: ["convex-test"] } }
  },
});
