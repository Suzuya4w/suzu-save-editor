import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { internalIpV4 } from "internal-ip";
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig(async () => {
  // @ts-expect-error process is a nodejs global
  const host = process.env.TAURI_DEV_HOST || await internalIpV4();

  return {
    plugins: [
      solid(), 
      tailwindcss(),
      visualizer({
        open: true,
        filename: 'bundle-stats.html',
        gzipSize: true,
      }),
    ],

    clearScreen: false,
    build: {
      chunkSizeWarningLimit: 10000,
    },
    server: {
      port: 1422,
      strictPort: true,
      host: "0.0.0.0", // Listen on all network interfaces for USB tethering
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1423,
          }
        : undefined,
      watch: {
        // tell Vite to ignore watching `src-tauri` and large binary files
        ignored: ["**/src-tauri/**", "**/*.glb"],
      },
    },
  };
});