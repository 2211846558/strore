import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchOrder as fetchOrderById } from './orders';
import { fetchStoreProducts } from './products';
import { fetchInventory } from './inventory';

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

function mapAttributeValues(attrs) {
  if (!Array.isArray(attrs)) return [];
  return attrs
    .map((a) => {
      if (typeof a === 'string') return a;
      return a.value ?? a.name ?? a.label ?? a.attribute_value?.value ?? null;
    })
    .filter(Boolean);
}

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
    const id = Number(row.variantId ?? row.variant_id ?? row.id);
    if (!id) return;
    map.set(id, Number(row.totalStock ?? row.total_stock ?? row.total_current_stock ?? 0));
  });
  return map;
}

function variantKey(color, size, variantId) {
  if (color && size && color !== '—' && size !== '—') return `${color}-${size}`;
  return `variant-${variantId}`;
}

/**
 * جلب منتجات المتجر مع تنوعاتها للمبيعات المباشرة
 */
export async function fetchPosCatalog({ storeId } = {}) {
  const [products, inventoryResult] = await Promise.all([
    fetchStoreProducts({ storeId, status: 'active', perPage: 100 }),
    fetchInventory({ storeId, perPage: 200 }).catch(() => ({ items: [] })),
  ]);

  const inventoryStock = buildInventoryStockMap(inventoryResult.items);
  const catalog = [];

  for (const product of products) {
    try {
      const res = await apiRequest(API_ENDPOINTS.product(product.id));
      const raw = res?.data ?? res;
      const variantsRaw = raw.variants ?? raw.product_variants ?? [];

      const variants = (Array.isArray(variantsRaw) ? variantsRaw : []).map((variant) => {
        const attrs = mapAttributeValues(variant.attribute_values ?? variant.attributes);
        const color = attrs[0] ?? '—';
        const size = attrs[1] ?? (attrs.length === 1 ? 'واحد' : '—');
        const variantId = Number(variant.id);
        const fromInventory = inventoryStock.get(variantId);
        const fromProduct = readVariantStockFromPayload(variant);
        const stock = fromInventory ?? fromProduct;
        const stockUnknown = stock == null;

        return {
          id: variantId,
          sku: variant.sku ?? '',
          label: attrs.join(' / ') || variant.sku || `تنوع #${variantId}`,
          color,
          size,
          stock: stockUnknown ? 0 : Number(stock),
          stockUnknown,
          price: Number(variant.price ?? raw.base_price ?? product.price ?? 0),
        };
      });

      if (!variants.length) continue;

      const colors = [...new Set(variants.map((v) => v.color))];
      const sizes = [...new Set(variants.map((v) => v.size))];
      const stockMap = {};
      const variantByKey = {};

      variants.forEach((v) => {
        const key = variantKey(v.color, v.size, v.id);
        stockMap[key] = v.stockUnknown ? null : v.stock;
        variantByKey[key] = v;
      });

      catalog.push({
        id: product.id,
        name: raw.name ?? product.name,
        price: Math.min(...variants.map((v) => v.price)),
        image: product.image,
        colors,
        sizes,
        variants,
        stockMap,
        variantByKey,
      });
    } catch {
      // تجاهل المنتجات التي لا يمكن تحميل تنوعاتها
    }
  }

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

export function resolveVariant(product, color, size) {
  if (!product?.variants?.length) return null;
  const match = product.variants.find((v) => v.color === color && v.size === size);
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
    customer: order.customer_name ?? '—',
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

  const detailed = await Promise.all(
    rows.map(async (row) => {
      try {
        return await fetchOrderDetails(row.id);
      } catch {
        return row;
      }
    }),
  );

  return detailed.map(mapOrderToInvoice);
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
