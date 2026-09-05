import { describe, it, expect } from "vitest";
import {
  installHeapMonitor,
  resetHeapMonitor,
  getPeakWasmHeapBytes,
} from "../../lib/ml/heapMonitor";

const KIB = 1024;
const PAGE = 64 * KIB;

describe("heapMonitor", () => {
  it("tracks the initial allocation of a WASM memory", () => {
    installHeapMonitor();
    const before = getPeakWasmHeapBytes();
    new WebAssembly.Memory({ initial: 1 });
    expect(getPeakWasmHeapBytes()).toBe(before + PAGE);
  });

  it("tracks the peak across grow() calls", () => {
    installHeapMonitor();
    const before = getPeakWasmHeapBytes();
    const memory = new WebAssembly.Memory({ initial: 1 });
    memory.grow(1);
    expect(getPeakWasmHeapBytes()).toBe(before + 2 * PAGE);
    memory.grow(2);
    expect(getPeakWasmHeapBytes()).toBe(before + 4 * PAGE);
  });

  it("rebases onto the resident footprint so pre-existing allocations survive a reset", () => {
    installHeapMonitor();
    const before = getPeakWasmHeapBytes();
    const memory = new WebAssembly.Memory({ initial: 2 });
    const resident = getPeakWasmHeapBytes();
    resetHeapMonitor();
    // Regression: a window that starts after memory exists (warm run) must
    // still report the already-allocated footprint instead of zero.
    expect(getPeakWasmHeapBytes()).toBe(resident);
    memory.grow(1);
    expect(getPeakWasmHeapBytes()).toBe(resident + PAGE);
  });

  it("is idempotent across repeated installs", () => {
    installHeapMonitor();
    installHeapMonitor();
    const before = getPeakWasmHeapBytes();
    const memory = new WebAssembly.Memory({ initial: 1 });
    memory.grow(1);
    expect(getPeakWasmHeapBytes()).toBe(before + 2 * PAGE);
  });
});
