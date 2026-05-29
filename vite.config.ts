// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
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
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = new URL(req.url || "", "http://localhost");
        const filename = path.basename(url.pathname);
        if (filename.startsWith("ort") && filename.endsWith(".mjs")) {
          const filePath = path.join(__dirname, "public", filename);
          if (fs.existsSync(filePath)) {
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
      });
    },
  };
}

export default defineConfig({
  cloudflare: false,
  plugins: [nitro(), onnxWasmDevPlugin()],
});
