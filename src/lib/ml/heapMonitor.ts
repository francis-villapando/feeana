// Tracks the peak WASM linear memory used by this worker. onnxruntime-web
// allocates its heap as a WebAssembly.Memory instance, grown as weights load
// and inference runs; buffer.byteLength is the resident footprint. This metric
// is available in workers, unlike performance.memory, which is a main-thread
// JS-heap counter that excludes WASM pages.

type MemoryConstructor = new (descriptor: WebAssembly.MemoryDescriptor) => WebAssembly.Memory;

const MONITOR_FLAG = "__feeanaHeapMonitored";

let peakBytes = 0;
const trackedInstances = new Set<WebAssembly.Memory>();

function residentBytes(): number {
  let total = 0;
  for (const memory of trackedInstances) {
    total += memory.buffer.byteLength;
  }
  return total;
}

function updatePeak(): void {
  const total = residentBytes();
  if (total > peakBytes) peakBytes = total;
}

function track(memory: WebAssembly.Memory): void {
  trackedInstances.add(memory);
  updatePeak();
  // Override grow() on the instance so each growth updates the peak; the
  // prototype method is left untouched.
  const grow = memory.grow.bind(memory);
  (memory as unknown as { grow: (delta: number) => number }).grow = (delta: number) => {
    const result = grow(delta);
    updatePeak();
    return result;
  };
}

/** Wrap the global WebAssembly.Memory constructor. Idempotent. */
export function installHeapMonitor(): void {
  const wasm = globalThis as typeof globalThis & { WebAssembly?: { Memory: MemoryConstructor } };
  const ctor = wasm.WebAssembly?.Memory;
  if (!ctor) return;
  if ((ctor as unknown as Record<string, unknown>)[MONITOR_FLAG]) return;

  const OriginalMemory = ctor;
  function MonitoredMemory(
    this: unknown,
    descriptor: WebAssembly.MemoryDescriptor,
  ): WebAssembly.Memory {
    const memory = new OriginalMemory(descriptor);
    track(memory);
    return memory;
  }
  (MonitoredMemory as unknown as Record<string, unknown>)[MONITOR_FLAG] = true;
  wasm.WebAssembly!.Memory = MonitoredMemory as unknown as MemoryConstructor;
}

/**
 * Rebase the tracked peak onto the current resident footprint so a window that
 * starts after memory exists (e.g. the warm run) still reports the resident size.
 */
export function resetHeapMonitor(): void {
  peakBytes = residentBytes();
}

/** Peak WASM linear memory (bytes) observed since the last reset. */
export function getPeakWasmHeapBytes(): number {
  return peakBytes;
}

// Install at module load so all subsequent WASM allocations are tracked.
installHeapMonitor();
