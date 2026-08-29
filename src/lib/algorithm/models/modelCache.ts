export const MODEL_CACHE_KEYS = {
  distilxlmr: "feeana-distilxlmr-cache-v1",
  mbert: "feeana-mbert-cache-v1",
  svm: "feeana-svm-cache-v1",
  hf: "feeana-hf-cache-v1",
} as const;

// Cache names used before the descriptive naming scheme took effect.
export const LEGACY_CACHE_KEYS = [
  "feeana-model-cache-v1",
  "feeana-model-cache-mbert-v1",
  "feeana-model-cache-svm-v1",
  "transformers-cache",
] as const;

export async function getModelCache(cacheKey: string): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(cacheKey);
  } catch {
    return null;
  }
}

export async function cachedFetch(url: string, cacheKey: string): Promise<Response | null> {
  const cache = await getModelCache(cacheKey);
  if (!cache) return null;
  try {
    return (await cache.match(url)) ?? null;
  } catch {
    return null;
  }
}

export async function cachePut(
  url: string,
  data: ArrayBuffer | Uint8Array,
  cacheKey: string,
): Promise<void> {
  const cache = await getModelCache(cacheKey);
  if (!cache) return;
  try {
    const body: BodyInit = data instanceof ArrayBuffer ? data : new Uint8Array(data).buffer;
    await cache.put(url, new Response(body));
  } catch (e) {
    console.warn(`[model-cache] Unable to cache "${url}":`, e);
  }
}

// Deletes the pre-rename cache keys once per session. The model re-downloads
// once under its descriptive name. No-op when the legacy caches are absent.
export async function deleteLegacyModelCaches(): Promise<string[]> {
  if (typeof caches === "undefined") return [];
  const removed: string[] = [];
  for (const key of LEGACY_CACHE_KEYS) {
    try {
      if (await caches.delete(key)) removed.push(key);
    } catch {
      // Ignore.
    }
  }
  if (removed.length > 0) {
    console.info(`[model-cache] Removed legacy cache entries: ${removed.join(", ")}`);
  }
  return removed;
}
