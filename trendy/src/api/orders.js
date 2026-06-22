import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';

function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
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
  return {
    name: item.product_name ?? item.name ?? item.product?.name ?? item.title ?? '—',
    quantity: Number(item.quantity ?? 1),
    price: Number(item.unit_price ?? item.price ?? item.total ?? 0),
    variantLabel: item.sku ?? item.variant_label ?? variant.label ?? null,
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

function isPosOrder(row) {
  const number = String(row.order_number ?? row.code ?? '');
  const type = String(row.order_type ?? row.type ?? '').toLowerCase();
  const channel = String(row.sales_channel ?? '').toLowerCase();
  return number.includes('POS') || type === 'pos' || type === 'past' || channel === 'pos';
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
  excludePos = true,
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
  let rows = extractList(res).map(mapOrder);
  if (excludePos) {
    rows = rows.filter((order) => !isPosOrder(order.raw));
  }

  return {
    orders: rows,
    meta: res?.meta ?? null,
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
    lastPage = Number(result.meta?.last_page ?? 1);
    page += 1;
  } while (page <= lastPage);

  return all;
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
