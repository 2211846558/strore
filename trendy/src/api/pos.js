import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchOrder as fetchOrderById } from './orders';
import {
  unwrapApiEntity,
  parseVariantColorSize,
  parseAttributesString,
  buildVariantFallbackLabel,
  extractProductVariants,
  fetchAttributes,
  fetchStoreProducts,
  productImageFields,
} from './products';
import { fetchInventory, fetchInventoryVariant } from './inventory';
import { getStoreWalletBalance } from './wallet';
import { buildPosDisplayProducts } from './posImages';

function extractPosImageRaw(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.image) return item.image;
  if (item.thumbnail) return item.thumbnail;
  if (Array.isArray(item.images) && item.images.length) {
    const first = item.images[0];
    return typeof first === 'string' ? first : first?.url ?? null;
  }
  return null;
}

function mapPosCatalogProduct(item) {
  if (!item || typeof item !== 'object') return item;
  const imageFields = productImageFields({
    id: item.id,
    image: extractPosImageRaw(item),
    thumbnail: extractPosImageRaw(item),
    images: item.images,
  });
  return {
    ...item,
    ...imageFields,
  };
}

function mapPosCatalog(catalog) {
  return (Array.isArray(catalog) ? catalog : []).map(mapPosCatalogProduct);
}

function isPlaceholderImage(url) {
  return typeof url === 'string' && url.startsWith('data:image/svg+xml');
}

function pickImageFields(product) {
  if (!product?.image || isPlaceholderImage(product.image)) return null;
  return {
    image: product.image,
    imageCandidates: product.imageCandidates,
    images: product.images,
  };
}

function collectItemSkus(item) {
  const skus = new Set();
  if (item?.sku) skus.add(String(item.sku));
  (item?.variants ?? []).forEach((variant) => {
    if (variant?.sku) skus.add(String(variant.sku));
  });
  return skus;
}

export function findStoreProductMatch(item, storeProducts = []) {
  if (!item || !storeProducts.length) return null;

  const name = String(item.name ?? item.product_name ?? '').trim();
  if (name) {
    const exactName = storeProducts.find((product) => product.name === name);
    if (exactName) return exactName;
  }

  const skus = collectItemSkus(item);
  if (skus.size) {
    for (const product of storeProducts) {
      if (product.sku && skus.has(String(product.sku))) return product;
    }
  }

  const itemId = Number(item.id);
  if (itemId) {
    const byId = storeProducts.find((product) => Number(product.id) === itemId);
    if (byId) return byId;
  }

  if (name) {
    return (
      storeProducts.find(
        (product) =>
          product.name &&
          (name.includes(product.name) || product.name.includes(name)),
      ) ?? null
    );
  }

  return null;
}

async function enrichPosCatalogImages(catalog, storeId) {
  if (!Array.isArray(catalog) || !catalog.length) return catalog;

  try {
    const storeProducts = await fetchStoreProducts({
      storeId,
      perPage: 50,
      status: 'all',
    });

    return buildPosDisplayProducts(catalog, storeProducts);
  } catch {
    return catalog;
  }
}

export function mergePosCatalogWithStoreImages(catalog = [], storeProducts = []) {
  if (!catalog.length || !storeProducts.length) return catalog;

  return catalog.map((item) => {
    const fromStore = findStoreProductMatch(item, storeProducts);
    const images = fromStore ? pickImageFields(fromStore) : null;
    if (!images) return item;

    return {
      ...item,
      ...images,
    };
  });
}

export function findPosProductForCartItem(item, catalog = [], storeProducts = []) {
  const fromStore = findStoreProductMatch(item, storeProducts);
  const storeImages = fromStore ? pickImageFields(fromStore) : null;

  if (!item || !catalog.length) {
    return storeImages ? { ...fromStore, ...storeImages } : fromStore;
  }

  const byName = catalog.find((product) => product.name === item.name);
  if (byName) {
    return storeImages ? { ...byName, ...storeImages } : byName;
  }

  if (item.sku) {
    const byProductSku = catalog.find((product) => product.sku === item.sku);
    if (byProductSku) {
      return storeImages ? { ...byProductSku, ...storeImages } : byProductSku;
    }

    const byVariantSku = catalog.find((product) =>
      product.variants?.some((variant) => variant.sku === item.sku),
    );
    if (byVariantSku) {
      return storeImages ? { ...byVariantSku, ...storeImages } : byVariantSku;
    }
  }

  const cartName = String(item.name ?? '').trim();
  if (!cartName) {
    return storeImages ? { ...fromStore, ...storeImages } : fromStore;
  }

  const fromCatalog =
    catalog.find(
      (product) =>
        product.name &&
        (cartName.includes(product.name) || product.name.includes(cartName)),
    ) ?? null;

  if (fromCatalog) {
    return storeImages ? { ...fromCatalog, ...storeImages } : fromCatalog;
  }

  return storeImages ? { ...fromStore, ...storeImages } : fromStore;
}

export function getPosItemImageSources(item, storeProducts = []) {
  const sources = [];
  const push = (url) => {
    if (url && !isPlaceholderImage(url) && !sources.includes(url)) {
      sources.push(url);
    }
  };

  const matched = findStoreProductMatch(item, storeProducts);
  if (matched) {
    push(matched.image);
    (matched.imageCandidates ?? []).forEach(push);
    (matched.images ?? []).forEach((img) => {
      push(img?.url);
      (img?.candidates ?? []).forEach(push);
    });
  }

  push(item?.image);
  (item?.imageCandidates ?? []).forEach(push);
  (item?.images ?? []).forEach((img) => {
    push(typeof img === 'string' ? img : img?.url);
    (img?.candidates ?? []).forEach(push);
  });

  return sources;
}

export function resolvePosItemImage(item, storeProducts = []) {
  return getPosItemImageSources(item, storeProducts)[0] ?? null;
}

export function resolvePosProductImage(image, productId) {
  return productImageFields({ id: productId, thumbnail: image }).image;
}

function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

const STATUS_AR = {
  completed: 'مكتملة',
  pending: 'قيد الانتظار',
  cancelled: 'ملغاة',
  delivered: 'مستلمة',
};

function readVariantStockFromPayload(variant) {
  for (const field of [
    'total_quantity',
    'total_stock',
    'total_current_stock',
    'quantity',
    'stock',
    'current_stock',
  ]) {
    if (variant[field] != null && variant[field] !== '') {
      return Number(variant[field]);
    }
  }
  return null;
}

function buildInventoryStockMap(items) {
  const map = new Map();
  (items ?? []).forEach((row) => {
    const id = Number(row.variantId ?? row.variant_id);
    if (!id) return;
    map.set(id, Number(row.totalStock ?? row.total_stock ?? row.total_current_stock ?? 0));
  });
  return map;
}

function resolvePosVariantStock(variantId, variant, inventoryStock) {
  const productQty = readVariantStockFromPayload(variant);
  const hasInv = inventoryStock.has(variantId);
  const invQty = hasInv ? Number(inventoryStock.get(variantId) ?? 0) : null;

  if (productQty != null && productQty > 0) {
    return { stock: Number(productQty), stockUnknown: false };
  }
  if (invQty != null) {
    return { stock: invQty, stockUnknown: false };
  }
  if (productQty != null) {
    return { stock: Number(productQty), stockUnknown: false };
  }
  return { stock: 0, stockUnknown: true };
}

function variantKey(color, size, variantId) {
  if (color && size && color !== '—' && size !== '—') return `${color}-${size}`;
  return `variant-${variantId}`;
}

function readVariantAttrValues(variant) {
  return (
    variant.attribute_values ??
    variant.attributes ??
    variant.attributeValues ??
    variant.values ??
    []
  );
}

function readInventorySellingPrice(invRow) {
  if (!invRow) return null;

  const candidates = [
    invRow.displayPrice,
    invRow.display_price,
    invRow.fifo_display_price,
    invRow.cachedPrice,
    invRow.cached_price,
    invRow.price,
    invRow.selling_price,
    invRow.sellingPrice,
  ];

  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }

  return null;
}

function readVariantPrice(variant, raw, product, invRow) {
  const inventoryPrice = readInventorySellingPrice(invRow);
  if (inventoryPrice != null) return inventoryPrice;

  const variantPrice = Number(
    variant.selling_price ??
      variant.price ??
      variant.discounted_price ??
      variant.original_price ??
      variant.display_price ??
      0,
  );
  if (variantPrice > 0) return variantPrice;

  const basePrice = Number(raw.base_price ?? product.price ?? 0);
  return Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : 0;
}

function buildInventoryMetaMap(inventoryRows = []) {
  const map = new Map();
  (inventoryRows ?? []).forEach((row) => {
    const id = Number(row.variantId ?? row.variant_id);
    if (!id) return;
    map.set(id, row);
  });
  return map;
}

function mapPosVariant(variant, raw, product, inventoryStock, inventoryMeta, catalogAttributes) {
  const attrValues = readVariantAttrValues(variant);
  let { color, size, label } = parseVariantColorSize(attrValues, catalogAttributes);
  const variantId = Number(variant.id);
  const invRow = inventoryMeta.get(variantId);
  const invAttributes = invRow?.attributes ?? invRow?.attribute_values;

  if ((color === '—' || size === '—') && invAttributes) {
    const parsed = Array.isArray(invAttributes)
      ? parseVariantColorSize(invAttributes, catalogAttributes)
      : parseAttributesString(invAttributes, catalogAttributes);
    if (parsed.label) label = parsed.label;
    if (color === '—' && parsed.color !== '—') color = parsed.color;
    if (size === '—' && parsed.size !== '—') size = parsed.size;
  }

  const { stock, stockUnknown } = resolvePosVariantStock(variantId, variant, inventoryStock);
  const resolvedLabel =
    label && label !== '—'
      ? label
      : variant.sku || buildVariantFallbackLabel(variant);

  return {
    id: variantId,
    sku: variant.sku ?? '',
    label: resolvedLabel,
    color,
    size,
    stock: Number(stock) || 0,
    stockUnknown,
    price: readVariantPrice(variant, raw, product, invRow),
  };
}

function buildPosProductEntry(
  raw,
  product,
  inventoryStock,
  inventoryRows = [],
  catalogAttributes = [],
  prebuiltVariants = null,
) {
  const inventoryMeta = buildInventoryMetaMap(inventoryRows);
  const variants = (
    prebuiltVariants ??
    extractProductVariants(raw).map((variant) =>
      mapPosVariant(variant, raw, product, inventoryStock, inventoryMeta, catalogAttributes),
    )
  );

  if (!variants.length) return null;

  const colors = [...new Set(variants.map((v) => v.color).filter((c) => c && c !== '—'))];
  const sizes = [...new Set(variants.map((v) => v.size).filter((s) => s && s !== '—' && s !== 'واحد'))];
  const hasColorSizeSelectors = colors.length > 0 && sizes.length > 0;
  const useDirectSelection = !hasColorSizeSelectors;
  const stockMap = {};
  const variantByKey = {};

  variants.forEach((v) => {
    const key = variantKey(v.color, v.size, v.id);
    stockMap[key] = v.stockUnknown ? null : v.stock;
    variantByKey[key] = v;
  });

  return {
    id: product.id,
    name: raw.name ?? product.name,
    price: (() => {
      const prices = variants.map((v) => Number(v.price)).filter((p) => p > 0);
      if (prices.length) return Math.min(...prices);
      return Number(variants[0]?.price ?? 0);
    })(),
    image: resolvePosProductImage(product.image ?? raw.thumbnail, product.id ?? raw.id),
    colors,
    sizes,
    variants,
    stockMap,
    variantByKey,
    useDirectSelection,
    variantOptions: useDirectSelection
      ? variants.map((v) => ({
          id: v.id,
          label: v.label,
          stock: v.stock,
          stockUnknown: v.stockUnknown,
          price: v.price,
        }))
      : [],
  };
}

/**
 * GET /products/{id} + GET /inventory — تنوعات منتج واحد للمبيعات المباشرة
 */
export async function fetchSalesProductVariants(productId, { storeId } = {}) {
  const [res, inventoryResult, catalogAttributes] = await Promise.all([
    apiRequest(API_ENDPOINTS.product(productId)),
    fetchInventory({ storeId, perPage: 200 }).catch(() => ({ items: [] })),
    fetchAttributes().catch(() => []),
  ]);
  const raw = unwrapApiEntity(res);
  const inventoryItems = inventoryResult.items ?? [];
  const inventoryStock = buildInventoryStockMap(inventoryItems);
  const productStub = {
    id: productId,
    name: raw.name,
    price: raw.base_price,
    image: raw.images?.[0]?.url ?? raw.thumbnail ?? null,
  };
  const entry = buildPosProductEntry(
    raw,
    productStub,
    inventoryStock,
    inventoryItems,
    catalogAttributes,
  );
  if (!entry) throw new Error('لا توجد تنوعات لهذا المنتج');
  return entry;
}

/**
 * GET /inventory/variants/{variantId} — كمية وسعر FIFO للتنوع المحدد
 */
export async function fetchVariantStockPrice(variantId, { fallbackStock } = {}) {
  try {
    const inv = await fetchInventoryVariant(variantId);
    const invStock = Number(inv.totalStock ?? 0);
    const price = readInventorySellingPrice(inv);
    const fallback = Number(fallbackStock ?? 0);
    return {
      stock: invStock > 0 ? invStock : fallback > 0 ? fallback : invStock,
      price: price ?? null,
    };
  } catch {
    const fallback = Number(fallbackStock ?? 0);
    return { stock: fallback > 0 ? fallback : null, price: null };
  }
}

function groupInventoryByProductName(inventoryItems = []) {
  const map = new Map();
  inventoryItems.forEach((row) => {
    const name = String(row.productName ?? '').trim();
    if (!name || name === '—') return;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(row);
  });
  return map;
}

function buildPosEntryFromInventoryRows(product, invRows, inventoryStock, catalogAttributes) {
  const variants = invRows
    .map((row) => {
      const variantId = Number(row.variantId);
      if (!variantId) return null;

      const parsed = parseAttributesString(row.attributes, catalogAttributes);
      const { stock, stockUnknown } = resolvePosVariantStock(variantId, {}, inventoryStock);
      const price = readInventorySellingPrice(row) ?? (Number(product.price) || 0);

      return {
        id: variantId,
        sku: row.sku && row.sku !== '—' ? row.sku : '',
        label: parsed.label || row.attributes || `تنوع #${variantId}`,
        color: parsed.color,
        size: parsed.size,
        stock,
        stockUnknown,
        price,
      };
    })
    .filter(Boolean);

  if (!variants.length) return null;

  const raw = { name: product.name, base_price: product.price };
  const entry = buildPosProductEntry(
    raw,
    product,
    inventoryStock,
    invRows,
    catalogAttributes,
    variants,
  );

  if (!entry) return null;

  return {
    ...entry,
    image: product.image,
    imageCandidates: product.imageCandidates,
    images: product.images,
    sku: product.sku ?? '',
  };
}

function buildPosCatalogFromStore(storeProducts = [], inventoryItems = [], catalogAttributes = []) {
  const inventoryStock = buildInventoryStockMap(inventoryItems);
  const inventoryByName = groupInventoryByProductName(inventoryItems);
  const activeProducts = (storeProducts ?? []).filter((product) => product.status !== 'مؤرشف');

  return activeProducts.map((product) => {
    const invRows = inventoryByName.get(product.name) ?? [];
    const fromInventory = invRows.length
      ? buildPosEntryFromInventoryRows(product, invRows, inventoryStock, catalogAttributes)
      : null;

    if (fromInventory) return fromInventory;

    const listStock =
      product.stock != null && product.stock !== '' ? Number(product.stock) : null;

    return {
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image: product.image,
      imageCandidates: product.imageCandidates,
      images: product.images,
      sku: product.sku ?? '',
      colors: [],
      sizes: [],
      variants: [],
      stockMap: {},
      variantByKey: {},
      useDirectSelection: true,
      variantOptions: [],
      listStock,
    };
  });
}

/**
 * كatalog المبيعات المباشرة — GET /my-store/products + GET /inventory (api.md)
 */
export async function fetchPosCatalog({ storeId } = {}) {
  const [storeProducts, inventoryResult, catalogAttributes] = await Promise.all([
    fetchStoreProducts({ storeId, perPage: 50, status: 'all' }),
    fetchInventory({ storeId, perPage: 100 }).catch(() => ({ items: [] })),
    fetchAttributes().catch(() => []),
  ]);

  const catalog = buildPosCatalogFromStore(
    storeProducts,
    inventoryResult.items ?? [],
    catalogAttributes,
  );

  return buildPosDisplayProducts(catalog, storeProducts);
}

export function getProductStockInfo(product) {
  if (!product?.variants?.length) return { total: 0, unknown: false };
  let total = 0;
  let unknown = false;
  for (const v of product.variants) {
    if (v.stockUnknown) unknown = true;
    else total += Number(v.stock) || 0;
  }
  return { total, unknown };
}

export function getProductTotalStock(product) {
  const { total, unknown } = getProductStockInfo(product);
  if (unknown && total === 0) return -1;
  return total;
}

export function isProductAvailable(product) {
  if (!product?.variants?.length) return false;
  const { total, unknown } = getProductStockInfo(product);
  return unknown || total > 0;
}

export function getVariantStock(product, color, size) {
  const variant = resolveVariant(product, color, size);
  if (!variant) return 0;
  if (variant.stockUnknown) return 1;
  return Number(variant.stock) || 0;
}

function normalizeAttrValue(value) {
  return String(value ?? '')
    .trim()
    .replace(/[\u0623\u0625\u0622]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .toLowerCase();
}

export function resolveVariant(product, color, size) {
  if (!product?.variants?.length) return null;
  const nColor = normalizeAttrValue(color);
  const nSize = normalizeAttrValue(size);
  const match = product.variants.find(
    (v) => normalizeAttrValue(v.color) === nColor && normalizeAttrValue(v.size) === nSize,
  );
  if (match) return match;
  if (product.variants.length === 1) return product.variants[0];
  return null;
}

export function mapCartItem(item) {
  return {
    id: item.id,
    cartItemId: item.id,
    key: String(item.id),
    name: item.product_name ?? item.name ?? '—',
    sku: item.sku ?? '',
    color: item.sku ?? '—',
    size: '—',
    variantLabel: item.sku ?? '—',
    price: Number(item.unit_price ?? item.price ?? 0),
    quantity: Number(item.quantity ?? 1),
  };
}

export function mapOrderToInvoice(order) {
  const items = (order.items ?? []).map((item) => ({
    lineId: item.id,
    orderId: order.id,
    variantId: item.variant_id,
    name: item.product_name ?? '—',
    color: item.sku ?? '—',
    size: '—',
    sku: item.sku ?? '',
    quantity: Number(item.quantity ?? 1),
    price: Number(item.price ?? item.unit_price ?? 0),
  }));

  return {
    id: order.order_number ?? `ORD-${order.id}`,
    orderId: order.id,
    date: order.created_at ? String(order.created_at).slice(0, 10) : '—',
    staff: order.cashier_name ?? order.seller?.name ?? order.staff_name ?? '—',
    customer: order.cashier_name ?? order.seller?.name ?? order.customer_name ?? '—',
    status: STATUS_AR[order.status] ?? order.status ?? '—',
    statusRaw: order.status,
    items,
  };
}

/**
 * تهيئة المبيعات المباشرة عبر مسارات api.md (بدون /pos/init)
 * GET /my-store/products — المنتجات والصور
 * GET /inventory — تنوعات/مخزون
 * GET /pos/cart — السلة
 * GET /wallet/balance — المحفظة
 */
export async function fetchPosInit({ storeId } = {}) {
  const [storeProducts, inventoryResult, catalogAttributes, cartRaw, walletRaw] =
    await Promise.all([
      fetchStoreProducts({ storeId, perPage: 50, status: 'all' }).catch(() => []),
      fetchInventory({ storeId, perPage: 100 }).catch(() => ({ items: [] })),
      fetchAttributes().catch(() => []),
      fetchPosCart().catch(() => ({ items: [], subtotal: 0, total: 0 })),
      getStoreWalletBalance({ storeId }).catch(() => ({ balance: 0, status: 'active' })),
    ]);

  const catalog = buildPosCatalogFromStore(
    storeProducts,
    inventoryResult.items ?? [],
    catalogAttributes,
  );

  return {
    catalog: buildPosDisplayProducts(catalog, storeProducts),
    cart: cartRaw,
    wallet: {
      balance: Number(walletRaw.balance ?? 0),
      status: walletRaw.status ?? 'active',
    },
  };
}

/**
 * GET /pos/cart
 */
export async function fetchPosCart() {
  const res = await apiRequest(API_ENDPOINTS.posCart);
  const payload = res?.data ?? res;
  const items = (payload?.items ?? []).map(mapCartItem);
  const summary = payload?.summary ?? {};

  return {
    items,
    subtotal: Number(summary.subtotal ?? 0),
    total: Number(summary.total ?? summary.subtotal ?? 0),
  };
}

/**
 * POST /pos/cart
 */
export async function addToPosCart({ variantId, quantity = 1 }) {
  const res = await apiRequest(API_ENDPOINTS.posCart, {
    method: 'POST',
    body: { variant_id: Number(variantId), quantity: Number(quantity) },
  });
  return res?.data ?? res;
}

/**
 * DELETE /pos/cart/{itemId}
 */
export async function removeFromPosCart(itemId) {
  return apiRequest(API_ENDPOINTS.posCartItem(itemId), { method: 'DELETE' });
}

/**
 * POST /pos/checkout
 */
export async function checkoutPosCart({ customerId }) {
  const res = await apiRequest(API_ENDPOINTS.posCheckout, {
    method: 'POST',
    body: { customer_id: Number(customerId) },
  });
  const order = res?.data ?? res;
  return mapOrderToInvoice(order);
}

/**
 * POST /pos/refund
 */
export async function refundPosItem({ orderId, variantId, quantity }) {
  const res = await apiRequest(API_ENDPOINTS.posRefund, {
    method: 'POST',
    body: {
      order_id: Number(orderId),
      variant_id: Number(variantId),
      quantity: Number(quantity),
    },
  });
  return res?.data ?? res;
}

/**
 * POST /pos/exchange
 */
export async function exchangePosItem({
  oldOrderId,
  oldVariantId,
  oldQuantity,
  newVariantId,
  newQuantity,
}) {
  const res = await apiRequest(API_ENDPOINTS.posExchange, {
    method: 'POST',
    body: {
      old_order_id: Number(oldOrderId),
      old_variant_id: Number(oldVariantId),
      old_quantity: Number(oldQuantity),
      new_variant_id: Number(newVariantId),
      new_quantity: Number(newQuantity),
    },
  });
  return res?.data ?? res;
}

/**
 * GET /orders/{id}
 */
export async function fetchOrderDetails(id) {
  const order = await fetchOrderById(id);
  return order.raw ?? order;
}

/**
 * GET /orders — فواتير المبيعات المباشرة (POS)
 */
export async function fetchPosInvoices({ search, perPage = 50 } = {}) {
  const query = new URLSearchParams({
    per_page: String(perPage),
    order_type: 'past',
    sales_channel: 'pos',
  });
  if (search?.trim()) query.set('search', search.trim());

  const res = await apiRequest(`${API_ENDPOINTS.orders}?${query}`);
  const rows = extractList(res);

  return rows.map((row) => {
    const itemsRaw = row.items ?? row.order_items ?? row.products ?? row.line_items ?? [];
    return mapOrderToInvoice(Array.isArray(itemsRaw) ? { ...row, items: itemsRaw } : row);
  });
}

export function getExchangePriceDiff(oldUnitPrice, quantity, newUnitPrice) {
  const qty = Number(quantity) || 1;
  const oldTotal = Number(oldUnitPrice) * qty;
  const newTotal = Number(newUnitPrice) * qty;
  const diff = newTotal - oldTotal;
  return {
    oldTotal,
    newTotal,
    diff,
    amount: Math.abs(diff),
    type: diff > 0 ? 'pay' : diff < 0 ? 'refund' : 'equal',
  };
}
