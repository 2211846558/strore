import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { buildVariantDisplayLabel, extractVariantAttributePairs } from '../utils/variantLabel';

function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function extractPaginationMeta(res) {
  const meta = res?.meta ?? res?.data?.meta ?? res?.pagination ?? {};
  const lastPage = Number(
    meta.last_page ?? meta.lastPage ?? res?.last_page ?? res?.data?.last_page ?? 1,
  );
  const total = Number(meta.total ?? res?.total ?? res?.data?.total ?? 0);
  return {
    last_page: Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1,
    total: Number.isFinite(total) ? total : 0,
  };
}

/** حالات الطلب في الـ API → عربي */
export const ORDER_STATUS_TO_AR = {
  pending: 'جديد',
  new: 'جديد',
  processing: 'قيد المعالجة',
  preparing: 'قيد المعالجة',
  prepared: 'قيد المعالجة',
  shipped: 'تم الشحن',
  out_for_delivery: 'قيد التوصيل',
  delivering: 'قيد التوصيل',
  delivered: 'مكتمل',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  canceled: 'ملغي',
};

/** عربي → حالة الـ API */
export const ORDER_STATUS_TO_API = {
  جديد: 'pending',
  'قيد المعالجة': 'processing',
  'تم الشحن': 'shipped',
  'قيد التوصيل': 'out_for_delivery',
  مكتمل: 'delivered',
  ملغي: 'cancelled',
};

function formatDate(value) {
  if (!value) return '—';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = new Date(raw.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return raw;
  return date.toISOString().slice(0, 10);
}

function mapStatusToArabic(status) {
  const key = String(status ?? '').toLowerCase();
  return ORDER_STATUS_TO_AR[key] ?? status ?? '—';
}

export function mapStatusToApi(status) {
  if (!status || status === 'all') return '';
  if (ORDER_STATUS_TO_API[status]) return ORDER_STATUS_TO_API[status];
  const key = String(status).toLowerCase();
  if (ORDER_STATUS_TO_AR[key]) return key;
  return status;
}

function extractOrderItems(row) {
  const itemsRaw =
    row.items ??
    row.order_items ??
    row.products ??
    row.line_items ??
    [];
  return Array.isArray(itemsRaw) ? itemsRaw : [];
}

function mapOrderItem(item) {
  const variant = item.variant ?? item.product_variant ?? {};
  const productName = item.product_name ?? item.name ?? item.product?.name ?? item.title ?? '—';
  const attrs = variant.attribute_values ?? variant.attributes ?? item.attribute_values ?? [];
  const variantContext = { ...variant, color: item.color, size: item.size };
  const variantAttributes = extractVariantAttributePairs(attrs, { variant: variantContext });
  return {
    lineId: item.id ?? item.line_id ?? null,
    variantId: item.variant_id ?? item.product_variant_id ?? variant.id ?? null,
    name: productName,
    quantity: Number(item.quantity ?? 1),
    price: Number(item.unit_price ?? item.price ?? item.total ?? 0),
    variantLabel: buildVariantDisplayLabel(
      productName,
      attrs,
      {
        sku: item.sku ?? variant.sku,
        variantId: variant.id,
        existingLabel: item.variant_label ?? variant.label,
        variant: variantContext,
      },
    ) || null,
    variantAttributes,
    sku: item.sku ?? variant.sku ?? '',
  };
}

function formatAddress(addr) {
  if (!addr) return '—';
  if (typeof addr === 'string') return addr;
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    addr.address_line,
    addr.street,
    addr.area,
    addr.city,
    addr.zone_name ?? addr.zone?.name,
    addr.details,
    addr.label,
  ].filter(Boolean);
  return parts.join('، ') || addr.full_address || '—';
}

function computeProductsCount(row, products) {
  const quantity = Number(row.items_quantity ?? 0);
  if (quantity > 0) return quantity;

  const lineCount = Number(row.items_count ?? 0);
  if (lineCount > 0) return lineCount;

  const fromItems = products.reduce((sum, product) => sum + (product.quantity || 0), 0);
  return fromItems || products.length;
}

export function isPosOrder(row) {
  if (!row) return false;
  if (row.is_pos === true || row.isPos === true) return true;
  if (row.is_pos === false || row.isPos === false) return false;

  const number = String(row.order_number ?? row.code ?? '').toUpperCase();
  const type = String(row.order_type ?? row.type ?? '').toLowerCase();
  const channel = String(
    row.sales_channel ?? row.channel ?? row.source ?? row.order_source ?? '',
  ).toLowerCase();

  return (
    number.includes('POS')
    || type === 'pos'
    || channel === 'pos'
    || channel === 'point_of_sale'
    || channel === 'in_store'
  );
}

function resolveStaffName(row) {
  return row.staff_name ?? row.cashier_name ?? row.seller?.name ?? row.seller_name ?? null;
}

function resolveBuyerName(row) {
  return row.customer_name ?? row.customer?.name ?? row.user?.name ?? row.buyer_name ?? '—';
}

function extractOrderRow(res) {
  return res?.data?.data ?? res?.data ?? res;
}

export function mapOrder(row) {
  const products = extractOrderItems(row).map(mapOrderItem);
  const statusRaw = String(row.status ?? 'pending').toLowerCase();
  const status = mapStatusToArabic(statusRaw);
  const isPos = isPosOrder(row);
  const staffName = resolveStaffName(row);
  const buyerName = resolveBuyerName(row);
  const hasStaff = Boolean(staffName);

  return {
    id: row.order_number ?? row.code ?? `ORD-${row.id}`,
    orderId: row.id,
    date: formatDate(row.created_at ?? row.date ?? row.ordered_at),
    staffName: staffName ?? '—',
    buyerName,
    customerName: hasStaff ? staffName : buyerName,
    hasStaff,
    phone:
      row.customer_phone ??
      row.shipping_address?.phone ??
      row.phone ??
      row.customer?.phone ??
      row.user?.phone ??
      '—',
    address: formatAddress(
      row.shipping_address ?? row.delivery_address ?? row.address ?? row.shipping_address_text,
    ),
    products,
    productsCount: computeProductsCount(row, products),
    total: Number(row.total ?? row.total_amount ?? row.grand_total ?? 0),
    status,
    statusRaw,
    paymentMethod: row.payment_method ?? row.payment_method_name ?? null,
    notes: row.notes ?? row.cancellation_reason ?? null,
    driverName: row.driver_name ?? row.driver?.user?.name ?? row.driver?.name ?? null,
    hasDriver: Boolean(row.driver_name ?? row.driver?.user?.name ?? row.driver?.name ?? row.driver_id),
    zoneId: row.zone_id ?? row.shipping_address?.zone_id ?? row.store?.zone_id ?? null,
    zoneName:
      row.zone_name ??
      row.shipping_address?.zone_name ??
      row.shipping_address?.zone?.name ??
      row.store?.zone_name ??
      row.store?.zone?.name ??
      null,
    isPos,
    raw: row,
  };
}

export function canCancelOrderStatus(status) {
  const ar = typeof status === 'string' && ORDER_STATUS_TO_API[status]
    ? status
    : mapStatusToArabic(status);
  return ar !== 'ملغي' && ar !== 'مكتمل';
}

/**
 * GET /orders — قائمة الطلبات مع البحث والفلترة
 */
export async function fetchOrders({
  storeId,
  search,
  status,
  perPage = 50,
  page = 1,
} = {}) {
  const query = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
  });
  if (storeId) query.set('store_id', String(storeId));
  if (search?.trim()) query.set('search', search.trim());
  const apiStatus = mapStatusToApi(status);
  if (apiStatus) query.set('status', apiStatus);

  const res = await apiRequest(`${API_ENDPOINTS.orders}?${query}`);
  const rows = extractList(res).map(mapOrder);
  const meta = extractPaginationMeta(res);

  return {
    orders: rows,
    meta,
  };
}

export async function fetchAllOrders(filters = {}) {
  const perPage = filters.perPage ?? 100;
  const all = [];
  let page = 1;
  let lastPage = 1;

  do {
    const result = await fetchOrders({ ...filters, perPage, page });
    all.push(...result.orders);
    lastPage = result.meta?.last_page ?? 1;
    if (result.orders.length < perPage && page >= lastPage) break;
    page += 1;
  } while (page <= lastPage);

  return all;
}

export function mapOrderToSalesInvoice(order) {
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
    typeLabel: order.isPos ? 'مبيعات مباشرة' : 'عبر التطبيق',
    itemsCount: order.productsCount ?? items.length,
    total: Number(order.total ?? 0),
    phone: order.phone ?? '—',
    address: order.address ?? '—',
    items,
    order,
  };
}

function buildStoreSalesOrderStats(orders = []) {
  const pos = orders.filter((order) => order.isPos).length;
  return {
    total: orders.length,
    pos,
    app: orders.length - pos,
  };
}

/**
 * GET /orders — كل طلبات المتجر (POS + عبر التطبيق) للفواتير والمبيعات
 */
export async function fetchStoreSalesOrders({ storeId, search, perPage = 100 } = {}) {
  let orders = await fetchAllOrders({ storeId, search, perPage });

  if (!orders.length && storeId) {
    orders = await fetchAllOrders({ search, perPage });
  }

  const sorted = [...orders].sort((a, b) => {
    const left = new Date(a.date || 0).getTime();
    const right = new Date(b.date || 0).getTime();
    return right - left;
  });

  const invoices = sorted.map(mapOrderToSalesInvoice);

  return {
    orders: sorted,
    invoices,
    stats: buildStoreSalesOrderStats(sorted),
  };
}

/**
 * GET /orders/{id} — تفاصيل طلب
 */
export async function fetchOrder(id) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error('معرّف الطلب غير صالح');
  }

  const res = await apiRequest(API_ENDPOINTS.order(numericId));
  return mapOrder(extractOrderRow(res));
}

/**
 * PATCH /orders/{id}/status — تحديث حالة الطلب
 */
export async function updateOrderStatus(id, status) {
  const res = await apiRequest(API_ENDPOINTS.orderStatus(id), {
    method: 'PATCH',
    body: { status: mapStatusToApi(status) },
  });
  return mapOrder(extractOrderRow(res));
}

/**
 * POST /orders/{id}/cancel — إلغاء الطلب
 */
export async function cancelOrder(id, reason = 'إلغاء من لوحة المتجر') {
  const res = await apiRequest(API_ENDPOINTS.orderCancel(id), {
    method: 'POST',
    body: { reason: reason.trim() || 'إلغاء من لوحة المتجر' },
  });
  return mapOrder(extractOrderRow(res));
}

/**
 * POST /orders/{id}/prepare — تجهيز الطلب
 */
export async function prepareOrder(id) {
  const res = await apiRequest(API_ENDPOINTS.orderPrepare(id), { method: 'POST' });
  return mapOrder(extractOrderRow(res));
}

/**
 * POST /orders/{id}/confirm-delivery — تأكيد التسليم
 */
export async function confirmOrderDelivery(id) {
  const res = await apiRequest(API_ENDPOINTS.orderConfirmDelivery(id), { method: 'POST' });
  return mapOrder(extractOrderRow(res));
}

export function canPrepareOrder(order) {
  const raw = String(order?.statusRaw ?? order?.status ?? '').toLowerCase();
  return ['pending', 'new', 'processing'].includes(raw) || order?.status === 'جديد';
}

export function canConfirmDelivery(order) {
  const raw = String(order?.statusRaw ?? order?.status ?? '').toLowerCase();
  return ['shipped', 'out_for_delivery', 'delivering', 'prepared', 'preparing'].includes(raw)
    || ['تم الشحن', 'قيد التوصيل', 'قيد المعالجة'].includes(order?.status);
}
