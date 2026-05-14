import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  envDir: "../..",
  plugins: [
    nitro(),
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      router: { routeFileIgnorePattern: "~components" },
    }),
    viteReact(),
  ],
  server: {
    port: Number(process.env.WEB_PORT ?? 5678),
    host: true,
    allowedHosts: [".lvh.me", "localhost"],
  },
});
