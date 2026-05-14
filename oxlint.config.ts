import { defineConfig } from "oxlint"

export default defineConfig({
  plugins: ["typescript", "react", "react-hooks", "unicorn"],
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  settings: {
    react: {
      version: "19.2.4",
    },
  },
  ignorePatterns: ["dist", "node_modules"],
})
