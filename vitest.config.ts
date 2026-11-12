import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for the pure logic in lib/. Runs in Node; no browser or Supabase.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
