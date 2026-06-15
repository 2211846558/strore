const CACHE_PREFIX = 'trendy_api_cache_';

export const TTL = {
  STATIC:   3600000, // 1 hour
  SEMI:     300000,  // 5 min
  DYNAMIC:  30000,   // 30 sec
  FAST:     15000,   // 15 sec
};

export function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts, ttl } = JSON.parse(raw);
    if (Date.now() - ts > ttl) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function writeCache(key, data, ttl) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now(), ttl }));
  } catch {
    // quota exceeded
  }
}

export function clearCache(pattern) {
  try {
    const prefix = CACHE_PREFIX + pattern;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function clearAllCache() {
  try {
    const now = Date.now();
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

function __background(key, fetcher, ttl) {
  fetcher()
    .then((data) => writeCache(key, data, ttl))
    .catch(() => {});
}

export function clearCacheByPrefix(...prefixes) {
  prefixes.forEach(clearCache);
}

export async function staleWhileRevalidate(key, fetcher, ttl, forceRefresh = false) {
  if (forceRefresh) {
    const data = await fetcher();
    writeCache(key, data, ttl);
    return data;
  }

  const cached = readCache(key);
  if (cached !== null && cached !== undefined) {
    __background(key, fetcher, ttl);
    return cached;
  }

  const data = await fetcher();
  writeCache(key, data, ttl);
  return data;
}
