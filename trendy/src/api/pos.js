import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import {
  buildVariantDisplayLabel,
  extractAttributeValues,
  buildVariantFullLabel,
  isWeakVariantAttrsLabel,
  isWeakVariantFullLabel,
  extractVariantAttributePairs,
} from '../utils/variantLabel';
import { fetchAllOrders, isOrderFullyReturned } from './orders';
import { fetchStorePublicProducts, fetchProductVariants } from './products';
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

const WALLET_STATUS_AR = {
  active: 'نشطة',
  suspended: 'معلّقة',
  inactive: 'غير نشطة',
  frozen: 'مجمّدة',
};

function mapAttributeValues(attrs) {
  return extractAttributeValues(attrs);
}

function readVariantStockFromPayload(variant) {
  for (const field of [
    'total_quantity',
    'total_stock',
    'total_current_stock',
    'quantity',
    'stock',
    'current_stock',
    'available_stock',
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

function resolveProductImage(raw) {
  if (raw?.image && !String(raw.image).startsWith('data:image/svg+xml')) return raw.image;
  if (raw?.image_url) return raw.image_url;
  if (raw?.thumbnail) return raw.thumbnail;
  const first = raw?.images?.[0];
  if (typeof first === 'string') return first;
  if (first?.url) return first.url;
  if (first?.path) return first.path;
  return raw?.image ?? '';
}

function mapPosVariant(variant, productRaw) {
  const attrs = mapAttributeValues(variant.attribute_values ?? variant.attributes);
  const pairs = extractVariantAttributePairs(variant.attribute_values ?? variant.attributes);
  const colorPair = pairs.find(p => p.name && (p.name.includes('لون') || p.name.toLowerCase().includes('color') || p.name.includes('الوان') || p.name.includes('الألوان')));
  const sizePair = pairs.find(p => p.name && (p.name.includes('مقاس') || p.name.toLowerCase().includes('size') || p.name.includes('المقاس')));

  const color = variant.color ?? colorPair?.value ?? attrs[0] ?? '—';
  const size = variant.size ?? sizePair?.value ?? attrs[1] ?? (attrs.length === 1 ? 'واحد' : '—');
  const variantId = Number(variant.id);
  const productName = productRaw?.name ?? productRaw?.product_name ?? '';
  const fromProduct = readVariantStockFromPayload(variant);
  const stock = fromProduct;
  const stockUnknown = stock == null;
  const labelOptions = {
    sku: variant.sku,
    variantId,
    existingLabel: variant.label,
    variant: { ...variant, color, size },
  };

  return {
    id: variantId,
    sku: variant.sku ?? '',
    label: buildVariantDisplayLabel(productName, variant.attribute_values ?? variant.attributes, labelOptions),
    fullLabel: buildVariantFullLabel(productName, variant.attribute_values ?? variant.attributes, labelOptions),
    color,
    size,
    stock: stockUnknown ? 0 : Number(stock),
    stockUnknown,
    price: Number(variant.price ?? variant.unit_price ?? productRaw?.base_price ?? 0),
  };
}

function shouldUseDirectSelection(colors, sizes, variants) {
  if (!variants.length) return false;
  const meaningfulColors = colors.filter((c) => c && c !== '—');
  const meaningfulSizes = sizes.filter((s) => s && s !== '—' && s !== 'واحد');
  return meaningfulColors.length <= 1 && meaningfulSizes.length <= 1;
}

/**
 * تحويل منتج من استجابة GET /pos/catalog أو /pos/init إلى شكل واجهة المبيعات
 */
export function mapPosCatalogProduct(raw, inventoryStock = null) {
  const variantsRaw = raw.variants ?? raw.product_variants ?? [];
  const variants = (Array.isArray(variantsRaw) ? variantsRaw : []).map((variant) => {
    const mapped = mapPosVariant(variant, raw);
    if (inventoryStock) {
      const fromInventory = inventoryStock.get(mapped.id);
      if (fromInventory != null) {
        mapped.stock = Number(fromInventory);
        mapped.stockUnknown = false;
      }
    }
    return mapped;
  });

  if (!variants.length) return null;

  const colors = [...new Set(variants.map((v) => v.color))];
  const sizes = [...new Set(variants.map((v) => v.size))];
  const stockMap = {};
  const variantByKey = {};

  variants.forEach((v) => {
    const key = variantKey(v.color, v.size, v.id);
    stockMap[key] = v.stockUnknown ? null : v.stock;
    variantByKey[key] = v;
  });

  const useDirectSelection = shouldUseDirectSelection(colors, sizes, variants);

  return {
    id: Number(raw.id),
    name: raw.name ?? raw.product_name ?? '—',
    price: Math.min(...variants.map((v) => v.price)),
    image: resolveProductImage(raw),
    colors,
    sizes,
    variants,
    stockMap,
    variantByKey,
    useDirectSelection,
    variantOptions: variants.map((v) => ({
      id: v.id,
      label: v.fullLabel ?? v.label,
      attrLabel: v.label,
      stock: v.stockUnknown ? null : v.stock,
      stockUnknown: v.stockUnknown,
    })),
  };
}

export function mapPosCatalogProducts(products, inventoryStock = null) {
  return (products ?? [])
    .map((raw) => mapPosCatalogProduct(raw, inventoryStock))
    .filter(Boolean);
}

function extractCatalogProducts(payload) {
  const root = payload?.catalog ?? payload;
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.products)) return root.products;
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(payload?.products)) return payload.products;
  return [];
}

export function mapCartItem(item) {
  const attrs = mapAttributeValues(item.attribute_values ?? item.attributes);
  const color = item.color ?? attrs[0] ?? '—';
  const size = item.size ?? attrs[1] ?? (attrs.length === 1 ? 'واحد' : '—');
  const variantLabel =
    buildVariantFullLabel(
      item.product_name ?? item.name,
      item.attribute_values ?? item.attributes,
      {
        sku: item.sku,
        existingLabel: item.variant_label ?? item.variant_name,
        variant: { ...item, color, size },
      },
    ) || ([color, size].filter((v) => v && v !== '—' && v !== 'واحد').join(' / ') || item.sku || '—');

  return {
    id: item.id,
    cartItemId: item.id,
    key: String(item.id),
    name: item.product_name ?? item.name ?? '—',
    sku: item.sku ?? '',
    color,
    size,
    variantLabel,
    variantId: item.variant_id ?? item.variantId ?? null,
    price: Number(item.unit_price ?? item.price ?? 0),
    quantity: Number(item.quantity ?? 1),
  };
}

export function mapCartResponse(cartRaw) {
  if (!cartRaw) return { items: [], subtotal: 0, total: 0 };
  const items = (cartRaw.items ?? []).map(mapCartItem);
  const summary = cartRaw.summary ?? cartRaw;
  return {
    items,
    subtotal: Number(summary.subtotal ?? 0),
    total: Number(summary.total ?? summary.subtotal ?? 0),
  };
}

export function mapWalletFromInit(walletRaw) {
  if (!walletRaw) return { balance: 0, status: 'نشطة', statusRaw: 'active' };
  const statusRaw = String(walletRaw.status ?? walletRaw.wallet_status ?? 'active').toLowerCase();
  return {
    balance: Number(walletRaw.balance ?? walletRaw.available_balance ?? 0),
    status: WALLET_STATUS_AR[statusRaw] ?? walletRaw.status ?? 'نشطة',
    statusRaw,
  };
}

function hasVariantsData(raw) {
  const variants = raw?.variants ?? raw?.product_variants ?? [];
  return Array.isArray(variants) && variants.length > 0;
}

function variantNeedsAttributeEnrichment(variant, productName) {
  const attrs = variant?.attribute_values ?? variant?.attributes ?? [];
  if (Array.isArray(attrs) && extractAttributeValues(attrs).length > 0) return false;
  const label = buildVariantDisplayLabel(productName, attrs, {
    variant,
    variantId: variant?.id,
    sku: variant?.sku,
    existingLabel: variant?.label,
  });
  return isWeakVariantAttrsLabel(label);
}

function productVariantsNeedEnrichment(raw) {
  const productName = raw?.name ?? raw?.product_name ?? '';
  const variants = raw?.variants ?? raw?.product_variants ?? [];
  if (!variants.length) return true;
  return variants.some((variant) => variantNeedsAttributeEnrichment(variant, productName));
}

async function enrichProductWithVariants(productRaw) {
  const productName = productRaw?.name ?? productRaw?.product_name ?? '';
  const productId = productRaw?.id;

  if (!productId) return productRaw;
  if (!productVariantsNeedEnrichment(productRaw) && hasVariantsData(productRaw)) {
    return productRaw;
  }

  try {
    const [detailsRes, variantRows] = await Promise.all([
      apiRequest(API_ENDPOINTS.product(productId)).catch(() => null),
      fetchProductVariants(productId, { productName }).catch(() => []),
    ]);

    const details = detailsRes?.data ?? detailsRes ?? {};
    const enrichedById = new Map((variantRows ?? []).map((row) => [String(row.id), row]));
    const baseVariants =
      productRaw.variants
      ?? productRaw.product_variants
      ?? details.variants
      ?? details.product_variants
      ?? variantRows
      ?? [];

    const mergedVariants = (Array.isArray(baseVariants) ? baseVariants : []).map((variant) => {
      const enriched = enrichedById.get(String(variant.id));
      if (!enriched) return variant;
      return {
        ...variant,
        attribute_values: enriched.attributeValues ?? variant.attribute_values,
        attributes: enriched.attributeValues ?? variant.attributes,
      };
    });

    const variants = mergedVariants.length
      ? mergedVariants
      : (variantRows ?? []).map((row) => ({
          id: row.id,
          sku: row.sku,
          attribute_values: row.attributeValues,
          attributes: row.attributeValues,
          price: row.price,
          total_quantity: row.quantity,
        }));

    return {
      ...productRaw,
      ...details,
      variants: variants.length
        ? variants
        : (details.variants ?? details.product_variants ?? []),
    };
  } catch {
    return productRaw;
  }
}

/**
 * GET /stores/{storeId}/products — منتجات المتجر للمبيعات المباشرة
 * يجلب القائمة ثم يُكمل التنوعات من تفاصيل المنتج عند الحاجة
 */
export async function fetchPosStoreCatalog({ storeId, name, categoryId, perPage = 100 } = {}) {
  if (!storeId) return [];

  const [list, inventoryResult] = await Promise.all([
    fetchStorePublicProducts({ storeId, name, categoryId, perPage }),
    fetchInventory({ storeId, perPage: 200 }).catch(() => ({ items: [] })),
  ]);

  const inventoryStock = buildInventoryStockMap(inventoryResult.items);
  const enriched = await Promise.all(list.map((item) => enrichProductWithVariants(item)));

  return mapPosCatalogProducts(enriched, inventoryStock);
}

/**
 * GET /pos/init — الكتالوج + السلة + المحفظة في استجابة واحدة
 * منتجات المتجر تُجلب دائماً من GET /stores/{storeId}/products
 */
export async function fetchPosInit({ storeId } = {}) {
  const catalogPromise = fetchPosStoreCatalog({ storeId });

  try {
    const res = await apiRequest(API_ENDPOINTS.posInit);
    const payload = res?.data ?? res;
    const catalog = await catalogPromise;

    return {
      catalog,
      cart: mapCartResponse(payload.cart),
      wallet: mapWalletFromInit(payload.wallet),
    };
  } catch {
    const [catalog, cart] = await Promise.all([catalogPromise, fetchPosCart()]);
    return {
      catalog,
      cart,
      wallet: { balance: 0, status: 'نشطة', statusRaw: 'active' },
    };
  }
}

/**
 * GET /pos/catalog أو GET /stores/{storeId}/products
 */
export async function fetchPosCatalog({ storeId, ...filters } = {}) {
  try {
    const res = await apiRequest(API_ENDPOINTS.posCatalog);
    const payload = res?.data ?? res;
    const products = extractCatalogProducts(payload);
    if (products.length) {
      const inventoryResult = await fetchInventory({ storeId, perPage: 200 }).catch(() => ({ items: [] }));
      const inventoryStock = buildInventoryStockMap(inventoryResult.items);
      return mapPosCatalogProducts(products, inventoryStock);
    }
  } catch {
    // استخدام مسار منتجات المتجر العام
  }

  return fetchPosStoreCatalog({ storeId, ...filters });
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

/**
 * GET /api/inventory/variants/{variantId} — مخزون وسعر التنوع للمبيعات المباشرة
 */
export async function fetchVariantStockPrice(variantId, { fallbackStock } = {}) {
  try {
    const row = await fetchInventoryVariant(variantId);
    const stock = row.totalStock ?? fallbackStock ?? null;
    const price = row.displayPrice || row.cachedPrice || 0;
    return { stock, price };
  } catch {
    return { stock: fallbackStock ?? null, price: 0 };
  }
}

export function resolveVariant(product, color, size) {
  if (!product?.variants?.length) return null;
  const match = product.variants.find((v) => v.color === color && v.size === size);
  if (match) return match;
  if (product.variants.length === 1) return product.variants[0];
  return null;
}

export function mapOrderViewToInvoice(order) {
  const items = (order.products ?? []).map((item) => ({
    lineId: item.lineId ?? item.variantId ?? `${order.orderId}-${item.sku}`,
    orderId: order.orderId,
    variantId: item.variantId,
    name: item.name,
    color: item.sku ?? item.variantLabel ?? '—',
    size: '—',
    sku: item.sku ?? '',
    quantity: Number(item.quantity ?? 1),
    price: Number(item.price ?? 0),
    variantLabel: item.variantLabel ?? null,
  }));

  const customer = order.isPos
    ? (order.staffName && order.staffName !== '—' ? order.staffName : order.buyerName)
    : order.buyerName;

  return {
    id: order.id,
    orderId: order.orderId,
    date: order.date,
    customer: customer ?? '—',
    status: order.status,
    statusRaw: order.statusRaw,
    isPos: Boolean(order.isPos),
    typeLabel: order.isPos ? 'مبيعات مباشرة' : 'طلب أونلاين',
    itemsCount: order.productsCount ?? items.length,
    total: Number(order.total ?? 0),
    phone: order.phone ?? '—',
    address: order.address ?? '—',
    items,
    order,
  };
}

function mapInvoiceLineToOrderProduct(item) {
  return {
    lineId: item.lineId ?? item.id ?? null,
    variantId: item.variantId ?? item.variant_id ?? null,
    name: item.name ?? item.product_name ?? '—',
    quantity: Number(item.quantity ?? 1),
    price: Number(item.price ?? item.unit_price ?? 0),
    sku: item.sku ?? '',
    variantLabel: item.variantLabel ?? item.color ?? null,
  };
}

/** دمج تفاصيل الطلب مع بنود الفاتورة عند غياب items في GET /orders/{id} */
export function resolveOrderForPosAction(invoice, detailOrder) {
  const invoiceItems = Array.isArray(invoice?.items) ? invoice.items : [];
  const invoiceOrder = invoice?.order;
  const productsFromDetail = detailOrder?.products ?? [];
  const productsFromList = invoiceOrder?.products ?? [];
  const productsFromInvoice = invoiceItems.map(mapInvoiceLineToOrderProduct);

  const products =
    productsFromDetail.length
      ? productsFromDetail
      : productsFromList.length
        ? productsFromList
        : productsFromInvoice;

  const base = detailOrder ?? invoiceOrder ?? {};

  return {
    ...base,
    id: base.id ?? invoice?.id,
    orderId: base.orderId ?? invoice?.orderId,
    customerName: base.customerName ?? invoice?.customer ?? '—',
    buyerName: base.buyerName ?? invoice?.customer ?? '—',
    isPos: base.isPos ?? invoice?.isPos,
    products,
    productsCount: base.productsCount ?? invoice?.itemsCount ?? products.length,
    total:
      Number(base.total) > 0
        ? Number(base.total)
        : Number(invoiceOrder?.total ?? invoice?.total ?? 0),
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

  const isPos = String(order.order_number ?? '').includes('POS')
    || String(order.order_type ?? order.type ?? '').toLowerCase() === 'pos'
    || String(order.sales_channel ?? '').toLowerCase() === 'pos';

  return {
    id: order.order_number ?? `ORD-${order.id}`,
    orderId: order.id,
    date: order.created_at ? String(order.created_at).slice(0, 10) : '—',
    customer: order.customer_name ?? order.staff_name ?? '—',
    status: STATUS_AR[order.status] ?? order.status ?? '—',
    statusRaw: order.status,
    isPos,
    typeLabel: isPos ? 'مبيعات مباشرة' : 'طلب أونلاين',
    itemsCount: items.reduce((sum, item) => sum + item.quantity, 0) || items.length,
    total: Number(order.total ?? order.total_amount ?? order.grand_total ?? 0),
    phone: order.customer_phone ?? order.phone ?? '—',
    address: order.shipping_address?.address_line_1 ?? order.address ?? '—',
    items,
  };
}

/**
 * GET /pos/cart
 */
export async function fetchPosCart() {
  const res = await apiRequest(API_ENDPOINTS.posCart);
  const payload = res?.data ?? res;
  return mapCartResponse(payload);
}

/**
 * POST /pos/cart
 */
export async function addToPosCart({ variantId, quantity = 1 }) {
  const res = await apiRequest(API_ENDPOINTS.posCart, {
    method: 'POST',
    body: { variant_id: Number(variantId), quantity: Number(quantity) },
  });
  const payload = res?.data ?? res;
  if (payload?.items || payload?.summary) {
    return { raw: payload, cart: mapCartResponse(payload) };
  }
  if (payload?.cart) {
    return { raw: payload, cart: mapCartResponse(payload.cart) };
  }
  return { raw: payload };
}

/**
 * DELETE /pos/cart/{itemId}
 */
export async function removeFromPosCart(itemId) {
  const res = await apiRequest(API_ENDPOINTS.posCartItem(itemId), { method: 'DELETE' });
  const payload = res?.data ?? res;
  if (payload?.items || payload?.summary) {
    return { raw: payload, cart: mapCartResponse(payload) };
  }
  if (payload?.cart) {
    return { raw: payload, cart: mapCartResponse(payload.cart) };
  }
  return { raw: payload };
}

/**
 * POST /pos/checkout
 * المبيعات المباشرة: الموظف يُحدَّد من الجلسة (auth) — customer_id اختياري لزبون مسجّل
 */
export async function checkoutPosCart({ customerId } = {}) {
  const body = {};
  const id = Number(customerId);
  if (Number.isFinite(id) && id > 0) {
    body.customer_id = id;
  }

  const res = await apiRequest(API_ENDPOINTS.posCheckout, {
    method: 'POST',
    body,
  });
  const order = res?.data ?? res;
  return mapOrderToInvoice(order);
}

/**
 * استرجاع قطعة — POS: POST /pos/refund | أونلاين: POST /orders/{id}/refund
 */
export async function refundOrderItem({ orderId, variantId, quantity, isPos = true }) {
  const body = {
    variant_id: Number(variantId),
    quantity: Number(quantity),
  };

  const path = isPos
    ? API_ENDPOINTS.posRefund
    : API_ENDPOINTS.orderRefund(orderId);

  const payload = isPos
    ? { ...body, order_id: Number(orderId) }
    : body;

  const res = await apiRequest(path, {
    method: 'POST',
    body: payload,
  });
  return res?.data ?? res;
}

/**
 * استبدال قطع — POS: POST /pos/exchange | أونلاين: POST /orders/{id}/exchange
 * @param {{ variantId: number, quantity: number }[]} oldItems
 * @param {{ variantId: number, quantity: number }[]} newItems
 */
export async function exchangeOrderItems({
  orderId,
  oldItems,
  newItems,
  isPos = true,
}) {
  const mapItems = (items) =>
    items.map((item) => ({
      variant_id: Number(item.variantId ?? item.variant_id ?? item.id),
      quantity: Number(item.quantity),
    }));

  const body = {
    old_items: mapItems(oldItems),
    new_items: mapItems(newItems),
  };

  const path = isPos
    ? API_ENDPOINTS.posExchange
    : API_ENDPOINTS.orderExchange(orderId);

  const payload = isPos
    ? { ...body, order_id: Number(orderId) }
    : body;

  const res = await apiRequest(path, {
    method: 'POST',
    body: payload,
  });
  return res?.data ?? res;
}

/**
 * POST /pos/refund
 */
export async function refundPosItem({ orderId, variantId, quantity, isPos = true }) {
  return refundOrderItem({ orderId, variantId, quantity, isPos });
}

/**
 * POST /pos/exchange — استبدال 1:1 (للتوافق مع الاستدعاءات القديمة)
 */
export async function exchangePosItem({
  oldOrderId,
  oldVariantId,
  oldQuantity,
  newVariantId,
  newQuantity,
  isPos = true,
}) {
  return exchangeOrderItems({
    orderId: oldOrderId,
    isPos,
    oldItems: [{ variantId: oldVariantId, quantity: oldQuantity }],
    newItems: [{ variantId: newVariantId, quantity: newQuantity }],
  });
}

/**
 * GET /orders — كل طلبات المتجر (أونلاين + مبيعات مباشرة) مع البحث من الخادم
 */
export async function fetchPosInvoices({ storeId, search, perPage = 100 } = {}) {
  let orders = await fetchAllOrders({
    storeId,
    search,
    perPage,
  });

  if (!orders.length && storeId) {
    orders = await fetchAllOrders({ search, perPage });
  }

  const sorted = [...orders].sort((a, b) => {
    const left = new Date(a.date || 0).getTime();
    const right = new Date(b.date || 0).getTime();
    return right - left;
  });

  const invoices = sorted.map((order) => mapOrderViewToInvoice(order));
  const posCount = invoices.filter((invoice) => invoice.isPos).length;

  return {
    invoices,
    stats: {
      total: invoices.length,
      pos: posCount,
      online: invoices.length - posCount,
    },
  };
}

export function findCatalogProductByVariantId(products, variantId) {
  if (!variantId || !Array.isArray(products)) return null;
  return (
    products.find((product) =>
      product.variants?.some((variant) => String(variant.id) === String(variantId)),
    ) ?? null
  );
}

export function getCatalogVariantDisplay(products, variantId, productName) {
  if (!variantId) return null;
  const product = Array.isArray(products)
    ? findCatalogProductByVariantId(products, variantId)
    : products;
  if (!product) return null;

  const variant = product.variants?.find((entry) => String(entry.id) === String(variantId));
  if (!variant) return null;

  const name = product.name ?? productName ?? '';
  if (variant.fullLabel && !isWeakVariantFullLabel(variant.fullLabel, name)) {
    return variant.fullLabel;
  }

  const attrsLabel = variant.label ?? buildVariantDisplayLabel(name, variant, { variant });
  if (!isWeakVariantAttrsLabel(attrsLabel)) {
    return buildVariantFullLabel(name, attrsLabel);
  }

  return null;
}

/**
 * جلب تنوعات منتج مع قيم الخصائص الكاملة لواجهة الاستبدال
 */
export async function fetchPosProductVariantsEnriched(productId, { productName, catalogProduct } = {}) {
  if (!productId) return [];

  const variantRows = await fetchProductVariants(productId, { productName: productName ?? catalogProduct?.name });
  const baseProduct = catalogProduct ?? { id: productId, name: productName ?? '—' };

  return variantRows.map((row) => {
    const catalogVariant = catalogProduct?.variants?.find(
      (variant) => String(variant.id) === String(row.id),
    );
    return mapPosVariant(
      {
        id: row.id,
        sku: row.sku,
        attribute_values: row.attributeValues,
        attributes: row.attributeValues,
        price: catalogVariant?.price ?? row.price,
        total_quantity: catalogVariant?.stock,
        stock: catalogVariant?.stock,
      },
      baseProduct,
    );
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

/**
 * جلب سجل عمليات الاسترجاع والاستبدال
 * @param {{ page?: number, perPage?: number, actionType?: 'refund'|'replacement' }} params
 */
export async function fetchReturnRequests({ page = 1, perPage = 20, actionType } = {}) {
  const query = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (actionType) query.set('action_type', actionType);
  const res = await apiRequest(`${API_ENDPOINTS.returnRequests}?${query}`);
  return res;
}

/** سجل الاسترجاع/الاستبدال لطلب محدد */
export async function fetchReturnRequestsForOrder(orderId, { perPage = 50 } = {}) {
  const numericId = Number(orderId);
  if (!Number.isFinite(numericId) || numericId <= 0) return [];

  const matches = [];
  let page = 1;
  let lastPage = 1;

  do {
    const res = await fetchReturnRequests({ page, perPage });
    const rows = res?.data ?? [];
    matches.push(...rows.filter((row) => Number(row.order_id) === numericId));
    lastPage = Number(res?.last_page ?? 1);
    page += 1;
  } while (page <= lastPage && page <= 5);

  return matches;
}

export function describeEmptyOrderReason(order, invoice) {
  const raw = order?.raw ?? invoice?.order?.raw ?? {};
  if (isOrderFullyReturned(raw, order?.products ?? [])) {
    return 'تم استرجاع أو استبدال جميع منتجات هذا الطلب — لا توجد قطع نشطة للاختيار.';
  }
  if (Number(order?.total ?? invoice?.total ?? 0) === 0) {
    return 'هذا الطلب فارغ (إجمالي ٠) — لا توجد منتجات مسجّلة فيه.';
  }
  return 'لا توجد قطع مرتبطة بهذا الطلب.';
}
