import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  envDir: "../..",
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    nitro(),
    tailwindcss(),
    tanstackStart({
      router: { routeFileIgnorePattern: "~components" },
    }),
    viteReact({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "19" }]],
      },
    }),
  ],
  server: {
    port: Number(process.env.WEB_PORT ?? 5678),
    host: true,
    allowedHosts: [".lvh.me", "localhost"],
  },
});
