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
  const str = String(url);
  const nested = str.match(/\/storage\/products\/\d+\/([^/?#]+)/);
  if (nested) return nested[1];
  const plain = str.match(/\/products\/\d+\/([^/?#]+)/);
  if (plain) return plain[1];
  const legacy = str.match(/\/storage\/(?:products\/\d+\/)?([^/?#]+)$/);
  return legacy ? legacy[1] : null;
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

  const trimmed = String(url).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return [trimmed];

  const origin = getBackendOrigin();
  const candidates = [];

  const pushPath = (path) => {
    if (!path) return;
    if (import.meta.env.DEV && path.startsWith('/')) {
      candidates.push(path);
    }
    candidates.push(path.startsWith('http') ? path : `${origin}${path}`);
  };

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    pushPath(resolveMediaUrl(trimmed));
    const filename = extractStorageFilename(trimmed);
    if (productId && filename) {
      pushPath(`/storage/products/${productId}/${filename}`);
    }
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

  if (productId) {
    const filename = extractStorageFilename(trimmed) || trimmed.split('/').pop();
    if (filename) {
      pushPath(`/storage/products/${productId}/${filename}`);
    }
    if (trimmed.startsWith('products/')) {
      pushPath(`/storage/${trimmed}`);
    }
  }

  pushPath(`/storage/${trimmed.replace(/^\/+/, '')}`);

  const resolved = resolveMediaUrl(trimmed);
  if (resolved) candidates.push(resolved);
  candidates.push(trimmed);

  return [...new Set(candidates.filter(Boolean))];
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

/**
 * صورة بانر الحملة — GET /api/campaigns يُرجع banner_image
 * (مسار storage/campaigns/... أو رابط asset كامل من Laravel)
 */
export function getCampaignBannerCandidates(url) {
  if (!url || typeof url !== 'string') return [];
  const trimmed = url.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return [trimmed];

  const origin = getBackendOrigin();
  const candidates = [];

  const pushPath = (path) => {
    if (!path) return;
    const absolute = path.startsWith('http') ? path : `${origin}${path}`;
    candidates.push(absolute);
    if (import.meta.env.DEV && path.startsWith('/')) {
      candidates.push(path);
    }
  };

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    pushPath(resolveMediaUrl(trimmed));
    return [...new Set(candidates.filter(Boolean))];
  }

  if (trimmed.startsWith('/storage/')) {
    pushPath(trimmed);
    return [...new Set(candidates.filter(Boolean))];
  }

  if (trimmed.startsWith('campaigns/')) {
    pushPath(`/storage/${trimmed}`);
  }

  pushPath(`/storage/${trimmed.replace(/^\/+/, '')}`);

  const resolved = resolveMediaUrl(trimmed);
  if (resolved) candidates.push(resolved);

  return [...new Set(candidates.filter(Boolean))];
}

export function resolveCampaignBannerUrl(url) {
  const candidates = getCampaignBannerCandidates(url);
  return candidates[0] || null;
}

/** صورة بديلة للحملة */
export function campaignPlaceholderImage() {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#8b5cf6"/>' +
    '</linearGradient></defs>' +
    '<rect fill="url(#g)" width="640" height="360"/>' +
    '<path fill="rgba(255,255,255,0.25)" d="M280 180l60-35v70z"/>' +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
