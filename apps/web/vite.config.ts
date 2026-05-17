import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const isCloudflareBuild = process.env.CF_BUILD === "1";

export default defineConfig(async () => {
  const targetPlugin = isCloudflareBuild
    ? (await import("@cloudflare/vite-plugin")).cloudflare({ viteEnvironment: { name: "ssr" } })
    : nitro();

  return {
    envDir: "../..",
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      targetPlugin,
      tailwindcss(),
      tanstackStart({
        router: { routeFileIgnorePattern: "~components" },
      }),
      babel({
        include: /\.[jt]sx?$/,
        presets: [reactCompilerPreset({ target: "19" })],
      }),
      viteReact(),
    ],
    server: {
      port: Number(process.env.WEB_PORT ?? 5678),
      host: true,
      allowedHosts: [".lvh.me", "localhost"],
    },
  };
});
