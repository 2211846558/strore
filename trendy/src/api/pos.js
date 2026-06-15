import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchOrder as fetchOrderById } from './orders';
import {
  fetchStoreProducts,
  fetchAttributes,
  unwrapApiEntity,
  parseVariantColorSize,
  parseAttributesString,
  buildVariantFallbackLabel,
  extractProductVariants,
} from './products';
import { fetchInventory, fetchInventoryVariant } from './inventory';

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

function buildPosProductEntry(raw, product, inventoryStock, inventoryRows = [], catalogAttributes = []) {
  const inventoryMeta = buildInventoryMetaMap(inventoryRows);
  const variants = extractProductVariants(raw).map((variant) =>
    mapPosVariant(variant, raw, product, inventoryStock, inventoryMeta, catalogAttributes),
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
    image: product.image,
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
  const productStub = { id: productId, name: raw.name, price: raw.base_price, image: null };
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

/**
 * جلب منتجات المتجر مع تنوعاتها للمبيعات المباشرة
 */
export async function fetchPosCatalog({ storeId } = {}) {
  const [products, inventoryResult, catalogAttributes] = await Promise.all([
    fetchStoreProducts({ storeId, status: 'active', perPage: 100 }),
    fetchInventory({ storeId, perPage: 200 }).catch(() => ({ items: [] })),
    fetchAttributes().catch(() => []),
  ]);

  const inventoryItems = inventoryResult.items ?? [];
  const inventoryStock = buildInventoryStockMap(inventoryItems);

  const results = await Promise.allSettled(
    products.map(async (product) => {
      const res = await apiRequest(API_ENDPOINTS.product(product.id));
      const raw = unwrapApiEntity(res);
      return buildPosProductEntry(raw, product, inventoryStock, inventoryItems, catalogAttributes);
    }),
  );

  const catalog = results
    .filter((r) => r.status === 'fulfilled' && r.value != null)
    .map((r) => r.value);

  return catalog;
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
  });
  if (search?.trim()) query.set('search', search.trim());

  const res = await apiRequest(`${API_ENDPOINTS.orders}?${query}`);
  const rows = extractList(res).filter((order) =>
    String(order.order_number ?? '').includes('POS'),
  );

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
