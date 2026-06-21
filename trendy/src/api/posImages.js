/**
 * ربط صور المنتجات في المبيعات المباشرة بنفس مصدر صفحة المنتجات.
 * ملف منفصل لتجنب أي اعتماد دائري مع pos.js
 */

function isPlaceholder(url) {
  return typeof url === 'string' && url.startsWith('data:image/svg+xml');
}

export function buildStoreImageIndex(storeProducts = []) {
  const byId = new Map();
  const bySku = new Map();
  const byName = new Map();

  storeProducts.forEach((product) => {
    if (!product?.image || isPlaceholder(product.image)) return;

    byId.set(Number(product.id), product);
    if (product.sku) bySku.set(String(product.sku), product);
    if (product.name) byName.set(String(product.name).trim(), product);
  });

  return { byId, bySku, byName, list: storeProducts };
}

function collectSkus(item) {
  const skus = new Set();
  if (item?.sku) skus.add(String(item.sku));
  (item?.variants ?? []).forEach((variant) => {
    if (variant?.sku) skus.add(String(variant.sku));
  });
  return skus;
}

export function findStoreProductForImage(item, storeProducts = []) {
  if (!item || !storeProducts.length) return null;

  const name = String(item.name ?? item.product_name ?? '').trim();
  if (name) {
    const exact = storeProducts.find((product) => product.name === name);
    if (exact?.image && !isPlaceholder(exact.image)) return exact;
  }

  for (const sku of collectSkus(item)) {
    const bySku = storeProducts.find(
      (product) => product.sku && String(product.sku) === sku,
    );
    if (bySku?.image && !isPlaceholder(bySku.image)) return bySku;
  }

  const itemId = Number(item.id);
  if (itemId) {
    const byId = storeProducts.find((product) => Number(product.id) === itemId);
    if (byId?.image && !isPlaceholder(byId.image)) return byId;
  }

  if (name) {
    return (
      storeProducts.find(
        (product) =>
          product?.image &&
          !isPlaceholder(product.image) &&
          product.name &&
          (name.includes(product.name) || product.name.includes(name)),
      ) ?? null
    );
  }

  return null;
}

export function resolvePosImageSrc(item, storeProducts = []) {
  const matched = findStoreProductForImage(item, storeProducts);
  if (matched?.image) return matched.image;

  if (item?.image && !isPlaceholder(item.image)) return item.image;

  return null;
}

export function mergePosCatalogImages(catalog = [], storeProducts = []) {
  return buildPosDisplayProducts(catalog, storeProducts);
}

function storeImageFields(storeProduct) {
  return {
    image: storeProduct.image,
    imageCandidates: storeProduct.imageCandidates,
    images: storeProduct.images,
    name: storeProduct.name,
    sku: storeProduct.sku ?? '',
  };
}

/**
 * قائمة عرض المبيعات المباشرة = كل منتجات المتجر (نشطة) + بيانات POS (تنوعات/مخزون)
 */
export function buildPosDisplayProducts(catalog = [], storeProducts = []) {
  const catalogById = new Map(
    (catalog ?? []).map((item) => [Number(item.id), item]),
  );

  const activeStoreProducts = (storeProducts ?? []).filter(
    (product) => product.status !== 'مؤرشف',
  );

  if (activeStoreProducts.length) {
    return activeStoreProducts.map((storeProduct) => {
      const posItem = catalogById.get(Number(storeProduct.id));
      const images = storeImageFields(storeProduct);

      if (posItem) {
        return { ...posItem, ...images };
      }

      const listStock = storeProduct.stock != null && storeProduct.stock !== ''
        ? Number(storeProduct.stock)
        : null;

      return {
        id: storeProduct.id,
        name: storeProduct.name,
        price: Number(storeProduct.price) || 0,
        colors: [],
        sizes: [],
        variants: [],
        stockMap: {},
        variantByKey: {},
        useDirectSelection: true,
        variantOptions: [],
        listStock,
        ...images,
      };
    });
  }

  return catalog ?? [];
}
