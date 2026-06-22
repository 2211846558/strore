import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchStoreProducts } from './products';

function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export const INVENTORY_STOCK_FILTER_OPTIONS = [
  { value: 'all', label: 'جميع الحالات' },
  { value: 'available', label: 'متوفر' },
  { value: 'low_stock', label: 'مخزون منخفض' },
  { value: 'out_of_stock', label: 'نفد المخزون' },
];

/** @deprecated استخدم INVENTORY_STOCK_FILTER_OPTIONS */
export const SHIPMENT_STATUS_OPTIONS = INVENTORY_STOCK_FILTER_OPTIONS;

const STOCK_ALERT_AR = {
  available: 'متوفر',
  low_stock: 'مخزون منخفض',
  out_of_stock: 'نفد المخزون',
};

const STATUS_TO_AR = {
  pending: 'قيد الانتظار',
  received: 'مستلمة',
  cancelled: 'ملغاة',
  archived: 'مؤرشف',
};

function mapStatusToArabic(status) {
  const key = String(status ?? 'pending').toLowerCase();
  return STATUS_TO_AR[key] ?? status;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function mapShipmentItem(item) {
  const variant = item.variant ?? item.product_variant ?? {};
  const product = variant.product ?? item.product ?? {};
  const attrs = variant.attribute_values ?? variant.attributes ?? item.attribute_values ?? [];
  const attrValues = attrs.map((a) => a.value ?? a.name).filter(Boolean);

  return {
    id: item.id ?? `${variant.id}-${item.quantity}`,
    variantId: item.variant_id ?? item.product_variant_id ?? variant.id ?? null,
    name: product.name ?? item.product_name ?? item.name ?? '—',
    category: product.category?.name ?? item.category ?? item.category_name ?? '—',
    color: item.color ?? attrValues[0] ?? '—',
    size: item.size ?? attrValues[1] ?? '—',
    variantLabel: item.variant_label ?? (attrValues.join(' / ') || variant.sku || '—'),
    quantity: Number(item.quantity ?? item.original_quantity ?? item.qty ?? 0),
    unitCost:
      item.unit_cost ?? item.cost_price ?? item.unit_price ?? item.purchase_price ?? null,
    sellingPrice:
      item.selling_price ?? item.sale_price ?? item.retail_price ?? null,
  };
}

export function mapShipment(row) {
  const itemsRaw = row.items ?? row.lines ?? row.shipment_items ?? [];
  const items = (Array.isArray(itemsRaw) ? itemsRaw : []).map(mapShipmentItem);
  
  let statusRaw = String(row.status ?? 'pending').toLowerCase();
  if (row.dynamic_status === 'في الانتظار') {
    statusRaw = 'pending';
  } else if (row.dynamic_status === 'حالية') {
    statusRaw = 'received';
  } else if (row.dynamic_status === 'مؤرشف' || row.dynamic_status === 'مؤرشفة') {
    statusRaw = 'archived';
  }

  return {
    id: row.id,
    code: row.shipment_number ?? row.code ?? row.reference ?? row.batch_number ?? `SH-${String(row.id).padStart(3, '0')}`,
    batchNumber: row.batch_number ?? row.batchNumber ?? '',
    productId: row.product_id ?? (items[0]?.variantId ? items[0].variantId : null),
    costPrice: row.cost_price ?? '',
    sellingPrice: row.selling_price ?? '',
    supplierName: row.supplier_name ?? '',
    date: formatDate(row.created_at ?? row.date ?? row.received_at),
    productsCount:
      row.products_count ??
      row.items_count ??
      (new Set(items.map((i) => i.variantId)).size || items.length),
    totalQuantity:
      row.total_quantity ??
      items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    status: mapStatusToArabic(statusRaw),
    statusRaw,
    items,
  };
}

function buildShipmentItemsPayload(items) {
  return items.map((item) => {
    const payloadItem = {
      variant_id: Number(item.variantId),
      quantity: Number(item.quantity),
      cost_price: Number(item.unitCost),
      selling_price: Number(item.sellingPrice),
    };
    if (item.id && /^\d+$/.test(String(item.id))) {
      payloadItem.id = Number(item.id);
    }
    return payloadItem;
  });
}

function buildShipmentBody({ storeId, items, batchNumber, supplierName, costPrice, sellingPrice }) {
  const body = {
    items: buildShipmentItemsPayload(items),
  };
  if (storeId) body.store_id = storeId;
  if (batchNumber?.trim()) body.batch_number = batchNumber.trim();
  if (supplierName?.trim()) body.supplier_name = supplierName.trim();
  if (costPrice !== undefined) body.cost_price = Number(costPrice);
  if (sellingPrice !== undefined) body.selling_price = Number(sellingPrice);
  return body;
}

function mapAttributeValues(attrs) {
  return (Array.isArray(attrs) ? attrs : [])
    .map((a) => a.value ?? a.name)
    .filter(Boolean);
}

/**
 * GET /inventory — صف واحد = تنوع منتج + كمية المخزون (ليس شحنة)
 */
export function mapInventoryRow(row) {
  const attrValues = mapAttributeValues(row.attributes ?? row.attribute_values);
  const statusAlert = String(row.status_alert ?? 'available').toLowerCase();

  return {
    id: row.variant_id ?? row.id,
    variantId: row.variant_id ?? row.id,
    productName: row.product_name ?? row.name ?? '—',
    sku: row.sku ?? '—',
    attributes: attrValues.join(' / ') || '—',
    totalStock: Number(row.total_stock ?? row.total_current_stock ?? 0),
    displayPrice: Number(row.display_price ?? row.fifo_display_price ?? 0),
    cachedPrice: Number(row.cached_price ?? row.price ?? 0),
    statusAlert,
    status: STOCK_ALERT_AR[statusAlert] ?? statusAlert,
  };
}

export function suggestBatchNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = String(now.getTime()).slice(-4);
  return `BATCH-${date}-${suffix}`;
}

/**
 * GET /api/inventory — مخزون التنوعات (بحث بالمنتج/SKU)
 */
export async function fetchInventory({
  storeId,
  search,
  stockFilter = 'all',
  perPage = 50,
} = {}) {
  const query = new URLSearchParams({ per_page: String(perPage) });
  if (storeId) query.set('store_id', String(storeId));
  if (search?.trim()) query.set('search', search.trim());

  const res = await apiRequest(`${API_ENDPOINTS.inventory}?${query}`);
  const allRows = extractList(res).map(mapInventoryRow);
  const items =
    stockFilter && stockFilter !== 'all'
      ? allRows.filter((row) => row.statusAlert === stockFilter)
      : allRows;

  return {
    items,
    stats: computeInventoryStats(allRows),
  };
}

/**
 * GET /api/inventory/shipments
 */
export async function fetchShipments({ storeId, status = 'all', search } = {}) {
  const query = new URLSearchParams();
  if (storeId) query.set('store_id', String(storeId));
  if (status && status !== 'all') query.set('status', String(status));
  if (search?.trim()) query.set('search', search.trim());

  const res = await apiRequest(`${API_ENDPOINTS.inventoryShipments}?${query}`);
  const payload = res?.data ?? res;

  const shipmentsRaw = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);
  const shipments = shipmentsRaw.map(mapShipment);

  const stats = payload.stats || {
    total: shipments.length,
    pending: shipments.filter((s) => s.statusRaw === 'pending').length,
    received: shipments.filter((s) => s.statusRaw === 'received').length,
    totalQty: shipments.reduce((sum, s) => sum + Number(s.totalQuantity || 0), 0),
  };

  return { shipments, stats };
}

/**
 * POST /api/inventory/shipments
 */
export async function createShipment({ storeId, items, batchNumber, supplierName, costPrice, sellingPrice }) {
  const res = await apiRequest(API_ENDPOINTS.inventoryShipments, {
    method: 'POST',
    body: buildShipmentBody({ storeId, items, batchNumber, supplierName, costPrice, sellingPrice }),
  });
  const row = res?.data ?? res;
  return mapShipment(row);
}

/**
 * PUT /api/inventory/shipments/{id}
 */
export async function updateShipment(id, { storeId, items, batchNumber, supplierName, costPrice, sellingPrice }) {
  const res = await apiRequest(API_ENDPOINTS.inventoryShipment(id), {
    method: 'PUT',
    body: buildShipmentBody({ storeId, items, batchNumber, supplierName, costPrice, sellingPrice }),
  });
  const row = res?.data ?? res;
  return mapShipment(row);
}

/**
 * إلغاء شحنة — لا يوجد DELETE في api.md، نستخدم PUT مع status=cancelled
 */
export async function cancelShipment(id, { storeId } = {}) {
  const body = { status: 'cancelled' };
  if (storeId) body.store_id = storeId;

  const res = await apiRequest(API_ENDPOINTS.inventoryShipment(id), {
    method: 'PUT',
    body,
  });
  const row = res?.data ?? res;
  return mapShipment(row);
}

/**
 * POST /api/inventory/shipments/{id}/archive
 * - يُغيِّر حالة الشحنة من "received" إلى "archived"
 */
export async function archiveShipment(shipment, { storeId } = {}) {
  const id = typeof shipment === 'object' ? shipment?.id : shipment;
  if (!id) throw new Error('معرّف الشحنة مطلوب');

  const body = {};
  if (storeId) body.store_id = storeId;

  const res = await apiRequest(API_ENDPOINTS.inventoryShipmentArchive(id), {
    method: 'POST',
    body: Object.keys(body).length ? body : undefined,
  });
  const row = res?.data ?? res;
  return mapShipment(row);
}

/**
 * GET /api/inventory/variants/{variantId}
 */
export async function fetchInventoryVariant(variantId) {
  const res = await apiRequest(API_ENDPOINTS.inventoryVariant(variantId));
  const raw = res?.data ?? res;
  return mapInventoryRow(raw);
}

/**
 * GET /inventory/variants/{variantId}/movements
 */
export async function fetchVariantMovements(variantId, { perPage = 20 } = {}) {
  const query = new URLSearchParams({ per_page: String(perPage) });
  const res = await apiRequest(
    `${API_ENDPOINTS.inventoryVariantMovements(variantId)}?${query}`,
  );
  return extractList(res).map((row) => ({
    id: row.id,
    type: row.type ?? row.movement_type ?? '—',
    quantity: Number(row.quantity ?? 0),
    date: formatDate(row.created_at ?? row.date),
    note: row.note ?? row.reason ?? '',
    shipmentId: row.shipment_id ?? row.shipment?.id ?? null,
  }));
}

const RECENT_SHIPMENTS_KEY = (storeId) => `trendy_recent_shipments_${storeId}`;

export function loadRecentShipments(storeId) {
  if (!storeId) return [];
  try {
    const raw = localStorage.getItem(RECENT_SHIPMENTS_KEY(storeId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentShipment(storeId, shipment) {
  if (!storeId || !shipment?.id) return loadRecentShipments(storeId);
  const mapped = mapShipment(shipment);
  const current = loadRecentShipments(storeId).filter((s) => s.id !== mapped.id);
  const next = [mapped, ...current].slice(0, 20);
  localStorage.setItem(RECENT_SHIPMENTS_KEY(storeId), JSON.stringify(next));
  return next;
}

/**
 * POST /inventory/adjust — تعديل المخزون يدوياً
 */
export async function adjustInventory({ variantId, quantity, reason, storeId }) {
  const body = {
    variant_id: Number(variantId),
    quantity: Number(quantity),
    reason: reason?.trim() || 'تعديل يدوي من لوحة المتجر',
  };
  if (storeId) body.store_id = storeId;

  const res = await apiRequest(API_ENDPOINTS.inventoryAdjust, {
    method: 'POST',
    body,
  });
  return res?.data ?? res;
}

function resolveCategoryName(raw, product) {
  if (raw?.category?.name) return raw.category.name;
  if (raw?.category_name) return raw.category_name;
  if (typeof raw?.category === 'string') return raw.category;
  if (typeof product?.category === 'string' && product.category) return product.category;
  if (product?.category?.name) return product.category.name;
  return '—';
}

/**
 * جلب منتجات المتجر مع تنوعاتها لنموذج الشحنة
 */
export async function fetchShipmentCatalog({ storeId } = {}) {
  const products = await fetchStoreProducts({ storeId, status: 'active', perPage: 100 });
  const catalog = [];

  for (const product of products) {
    try {
      const res = await apiRequest(API_ENDPOINTS.product(product.id));
      const raw = res?.data ?? res;
      const variantsRaw = raw.variants ?? raw.product_variants ?? [];

      const variants = (Array.isArray(variantsRaw) ? variantsRaw : []).map((variant) => {
        const attrs = variant.attribute_values ?? variant.attributes ?? [];
        const label = attrs.map((a) => a.value ?? a.name).filter(Boolean).join(' / ');
        return {
          id: variant.id,
          sku: variant.sku ?? '',
          label: label || variant.sku || `تنوع #${variant.id}`,
        };
      });

      if (variants.length) {
        catalog.push({
          id: product.id,
          name: raw.name ?? product.name,
          category: resolveCategoryName(raw, product),
          price: String(raw.base_price ?? product.price ?? ''),
          variants,
        });
      }
    } catch {
      // تجاهل المنتجات التي لا يمكن تحميل تنوعاتها
    }
  }

  return catalog;
}

export function computeInventoryStats(rows) {
  return {
    total: rows.length,
    available: rows.filter((r) => r.statusAlert === 'available').length,
    lowStock: rows.filter((r) => r.statusAlert === 'low_stock').length,
    outOfStock: rows.filter((r) => r.statusAlert === 'out_of_stock').length,
  };
}

/** @deprecated استخدم computeInventoryStats */
export function computeShipmentStats(rows) {
  const stats = computeInventoryStats(rows);
  return {
    total: stats.total,
    received: stats.available,
    pending: stats.lowStock + stats.outOfStock,
  };
}
