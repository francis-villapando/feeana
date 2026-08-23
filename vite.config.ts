// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { ViteDevServer } from "vite";
import { nitro } from "nitro/vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple plugin to bypass Vite's module-transform warning for ORT WASM .mjs files in development.
// Vite dev-server intercepts all dynamic imports and appends ?import, failing if they are in /public.
// Intercept these requests before Vite does and serve them directly as plain JavaScript modules.
function onnxWasmDevPlugin() {
  return {
    name: "onnx-wasm-dev-server",
    apply: "serve" as const, // Only runs in development (dev server)
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
          const url = new URL(req.url || "", "http://localhost");
          const filename = path.basename(url.pathname);
          if (filename.startsWith("ort") && filename.endsWith(".mjs")) {
            const candidates = [
              path.join(__dirname, "public", "onnxruntime", filename),
              path.join(__dirname, "public", filename),
            ];
            const filePath = candidates.find((p) => fs.existsSync(p));
            if (filePath) {
              res.setHeader("Content-Type", "application/javascript");
              // Set security headers to allow WASM multi-threading
              res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
              res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(fs.readFileSync(filePath));
              return;
            }
          }
          next();
        },
      );
    },
  };
}

const isVitest = process.env.VITEST === "true";

export default defineConfig({
  nitro: false,
  plugins: [
    !isVitest
      ? nitro({
          routeRules: {
            "/**": {
              headers: {
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp",
              },
            },
          },
        })
      : null,
    onnxWasmDevPlugin(),
  ].filter(Boolean),
  vite: {
    assetsInclude: ["**/*.wasm"],
    worker: {
      format: "es",
    },
    optimizeDeps: {
      exclude: ["onnxruntime-node"],
    },
    build: {
      rollupOptions: {
        external: ["onnxruntime-node"],
      },
    },
    server: {
      hmr: {
        overlay: false,
      },
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },
  },
});
