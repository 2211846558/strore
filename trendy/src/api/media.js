/**
 * أصل خادم Laravel (بدون /api) — يُستخرج من VITE_API_BASE_URL
 * مثال: http://localhost:8000/api → http://localhost:8000
 */
export function getBackendOrigin() {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
  if (apiBase) {
    return apiBase.replace(/\/api\/?$/, '') || apiBase;
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/**
 * يصحّح روابط الصور القادمة من الباكند (storage/asset)
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  const origin = getBackendOrigin();

  if (trimmed.startsWith('/')) {
    return `${origin}${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    const apiOrigin = new URL(origin || window.location.origin);

    if (
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      !parsed.port &&
      apiOrigin.port
    ) {
      return `${apiOrigin.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function extractStorageFilename(url) {
  if (!url) return null;
  const match = String(url).match(/\/storage\/(?:products\/\d+\/)?([^/]+)$/);
  return match ? match[1] : null;
}

export function resolveProductImageUrl(url, productId) {
  const candidates = getProductImageCandidates(url, productId);
  return candidates[0] || null;
}

/**
 * قائمة روابط محتملة للصورة — المسار الصحيح أولاً.
 */
export function getProductImageCandidates(url, productId) {
  if (!url) return [];

  const origin = getBackendOrigin();
  const resolved = resolveMediaUrl(url);

  if (productId) {
    const filename = extractStorageFilename(resolved || url);
    if (filename) {
      const correctPath = `/storage/products/${productId}/${filename}`;
      const absolute = `${origin}${correctPath}`;
      const proxied = correctPath;
      return [...new Set([absolute, proxied, resolved, url].filter(Boolean))];
    }
  }

  if (resolved) return [resolved];
  return [url];
}

/**
 * الباكند يُرجع لوقو المتجر كمسار نسبي مثل logos/{storeId}/{filename}
 * أو default-store.jpg — نُحوّله إلى /storage/... مع أصل الخادم.
 */
export function getStoreLogoCandidates(logo, storeId) {
  if (!logo || typeof logo !== 'string') return [];
  const trimmed = logo.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return [trimmed];

  const origin = getBackendOrigin();
  const candidates = [];

  const pushPath = (path) => {
    if (!path) return;
    if (import.meta.env.DEV) candidates.push(path);
    candidates.push(path.startsWith('http') ? path : `${origin}${path}`);
  };

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    pushPath(resolveMediaUrl(trimmed));
    return [...new Set(candidates.filter(Boolean))];
  }

  if (trimmed.startsWith('/storage/')) {
    pushPath(trimmed);
    return [...new Set(candidates.filter(Boolean))];
  }

  if (trimmed.startsWith('/')) {
    pushPath(`/storage${trimmed}`);
    pushPath(trimmed);
    return [...new Set(candidates.filter(Boolean))];
  }

  if (trimmed.startsWith('logos/')) {
    pushPath(`/storage/${trimmed}`);
  } else if (storeId) {
    pushPath(`/storage/logos/${storeId}/${trimmed}`);
  }

  pushPath(`/storage/${trimmed}`);

  const resolved = resolveMediaUrl(trimmed);
  if (resolved && resolved !== trimmed) {
    candidates.push(resolved);
  }

  return [...new Set(candidates.filter(Boolean))];
}

export function resolveStoreLogoUrl(logo, storeId) {
  const candidates = getStoreLogoCandidates(logo, storeId);
  return candidates[0] || null;
}

/** صورة بديلة محلية */
export function productPlaceholderImage() {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">' +
    '<rect fill="#e2e8f0" width="400" height="400"/>' +
    '<path fill="#94a3b8" d="M120 280l50-65 45 55 35-45 70 55H120z"/>' +
    '<circle fill="#94a3b8" cx="155" cy="155" r="28"/>' +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
