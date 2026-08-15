import { existsSync, copyFileSync } from "fs";
import { join } from "path";

const DIST_DIR = join(process.cwd(), "node_modules", "onnxruntime-web", "dist");
const PUBLIC_DIR = join(process.cwd(), "public", "onnxruntime");

const WASM_FILES = [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jspi.mjs",
  "ort-wasm-simd-threaded.jspi.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];

let copied = 0;
let missing = 0;

for (const file of WASM_FILES) {
  const src = join(DIST_DIR, file);
  if (!existsSync(src)) {
    console.warn(`  skip (not in dist): ${file}`);
    missing++;
    continue;
  }
  copyFileSync(src, join(PUBLIC_DIR, file));
  copied++;
}

console.log(`ORT wasm sync complete: ${copied} copied, ${missing} missing from dist.`);
