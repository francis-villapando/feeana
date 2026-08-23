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
