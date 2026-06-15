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
    price: Number(item.unit_price ?? item.price ?? 0),
    variantLabel: item.variant_label ?? item.variantLabel ?? variant.label ?? null,
    variantId: item.variant_id ?? item.variantId ?? item.product_variant_id ?? item.productVariantId ?? null,
    lineId: item.id ?? item.lineId ?? null,
    sku: item.sku ?? variant.sku ?? '',
    productId: item.product_id ?? item.product?.id ?? variant.product_id ?? null,
    color: item.color ?? variant.color ?? null,
    size: item.size ?? variant.size ?? null,
  };
}

async function enrichOrdersWithItems(orders) {
  const missing = orders.filter((order) => !order.products?.length && order.orderId);
  if (!missing.length) return orders;

  const details = await Promise.all(
    missing.map(async (order) => {
      try {
        return await fetchOrder(order.orderId);
      } catch {
        return null;
      }
    }),
  );

  const byId = new Map(
    details.filter(Boolean).map((order) => [order.orderId, order]),
  );

  return orders.map((order) => byId.get(order.orderId) ?? order);
}

function isPosOrder(row) {
  const number = String(row.order_number ?? row.code ?? '');
  const type = String(row.order_type ?? row.type ?? '').toLowerCase();
  const channel = String(row.sales_channel ?? '').toLowerCase();
  return number.includes('POS') || type === 'pos' || type === 'past' || channel === 'pos';
}

export function mapOrder(row) {
  const products = extractOrderItems(row).map(mapOrderItem);
  const statusRaw = String(row.status ?? 'pending').toLowerCase();
  const status = mapStatusToArabic(statusRaw);
  const isPos = isPosOrder(row);

  return {
    id: row.order_number ?? row.code ?? `ORD-${row.id}`,
    orderId: row.id,
    date: formatDate(row.created_at ?? row.date ?? row.ordered_at),
    customerName: isPos
      ? (row.cashier_name ?? row.seller?.name ?? 'الموظف')
      : (row.customer_name ?? row.customer?.name ?? row.user?.name ?? row.buyer_name ?? '—'),
    phone:
      row.customer_phone ??
      row.phone ??
      row.customer?.phone ??
      row.user?.phone ??
      '—',
    address:
      row.shipping_address && typeof row.shipping_address === 'object'
        ? [
            row.shipping_address.address_line_1,
            row.shipping_address.address_line_2,
            row.shipping_address.city,
            row.shipping_address.zone_name ?? row.shipping_address.zone?.name,
          ]
            .filter(Boolean)
            .join('، ') || '—'
        : (row.shipping_address ??
           row.delivery_address ??
           row.address ??
           row.shipping_address_text ??
           '—'),
    products,
    total: Number(row.total ?? row.total_amount ?? row.grand_total ?? 0),
    status,
    statusRaw,
    paymentMethod: row.payment_method ?? row.payment_method_name ?? null,
    notes: row.notes ?? row.cancellation_reason ?? null,
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
  rows = await enrichOrdersWithItems(rows);

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
  const res = await apiRequest(API_ENDPOINTS.order(id));
  return mapOrder(res?.data ?? res);
}

/**
 * PATCH /orders/{id}/status — تحديث حالة الطلب
 */
export async function updateOrderStatus(id, status) {
  const res = await apiRequest(API_ENDPOINTS.orderStatus(id), {
    method: 'PATCH',
    body: { status: mapStatusToApi(status) },
  });
  return mapOrder(res?.data ?? res);
}

/**
 * POST /orders/{id}/cancel — إلغاء الطلب
 */
export async function cancelOrder(id, reason = 'إلغاء من لوحة المتجر') {
  const res = await apiRequest(API_ENDPOINTS.orderCancel(id), {
    method: 'POST',
    body: { reason: reason.trim() || 'إلغاء من لوحة المتجر' },
  });
  return mapOrder(res?.data ?? res);
}

/**
 * POST /orders/{id}/prepare — تجهيز الطلب
 */
export async function prepareOrder(id) {
  const res = await apiRequest(API_ENDPOINTS.orderPrepare(id), { method: 'POST' });
  return mapOrder(res?.data ?? res);
}

/**
 * POST /orders/{id}/confirm-delivery — تأكيد التسليم
 */
export async function confirmOrderDelivery(id) {
  const res = await apiRequest(API_ENDPOINTS.orderConfirmDelivery(id), { method: 'POST' });
  return mapOrder(res?.data ?? res);
}

export function canPrepareOrder(order) {
  if (order?.isPos) return false;
  const raw = String(order?.statusRaw ?? order?.status ?? '').toLowerCase();
  return ['pending', 'new', 'processing'].includes(raw) || order?.status === 'جديد';
}

export function canConfirmDelivery(order) {
  const raw = String(order?.statusRaw ?? order?.status ?? '').toLowerCase();
  return ['shipped', 'out_for_delivery', 'delivering', 'prepared', 'preparing'].includes(raw)
    || ['تم الشحن', 'قيد التوصيل', 'قيد المعالجة'].includes(order?.status);
}
