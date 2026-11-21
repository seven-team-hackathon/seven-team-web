import { fileURLToPath } from "node:url"
import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 900_000,
  },
}))
