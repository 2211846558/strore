import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchStoreProducts } from './products';
import { getStoredUser, resolveManagedStoreId } from './auth';

function resolveInventoryStoreId(storeId) {
  return resolveManagedStoreId(getStoredUser(), storeId);
}

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
  finished: 'منتهية',
};

export const SHIPMENT_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'جميع الشحنات' },
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'received', label: 'مستلمة' },
  { value: 'cancelled', label: 'ملغاة' },
];

/** خيارات تعديل الحالة — نفس فلتر الشحنات بدون «الكل» */
export const SHIPMENT_STATUS_EDIT_OPTIONS = SHIPMENT_STATUS_FILTER_OPTIONS.filter(
  (option) => option.value !== 'all',
);

export function resolveShipmentSelectStatus(statusRaw) {
  const key = String(statusRaw ?? '').toLowerCase();
  if (key === 'finished' || key === 'archived') return 'cancelled';
  if (key === 'pending' || key === 'received' || key === 'cancelled') return key;
  return 'pending';
}

function mapStatusToArabic(status) {
  const key = String(status ?? 'pending').toLowerCase();
  return STATUS_TO_AR[key] ?? status;
}

function resolveShipmentStatusRaw(row) {
  const batchStatus = String(row?.status ?? '').toLowerCase();
  const dynamicStatus = row?.dynamic_status;

  if (batchStatus === 'cancelled' || dynamicStatus === 'ملغاة') return 'cancelled';
  if (batchStatus === 'archived' || dynamicStatus === 'منتهية') return 'finished';
  if (dynamicStatus === 'في الانتظار') return 'pending';
  if (dynamicStatus === 'حالية') return 'received';
  if (batchStatus === 'received') return 'received';
  return 'pending';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function mapShipmentItem(item, batchPrices = {}) {
  const variant = item.variant ?? item.product_variant ?? {};
  const product = variant.product ?? item.product ?? {};
  const attrs = variant.attribute_values ?? variant.attributes ?? item.attribute_values ?? [];
  const attrValues = attrs.map((a) => a.value ?? a.name).filter(Boolean);

  return {
    id: item.id ?? null,
    variantId: item.variant_id ?? item.product_variant_id ?? variant.id ?? null,
    name: product.name ?? item.product_name ?? item.name ?? '—',
    category: product.category?.name ?? item.category ?? item.category_name ?? '—',
    color: item.color ?? attrValues[0] ?? '—',
    size: item.size ?? attrValues[1] ?? '—',
    variantLabel: item.variant_label ?? (attrValues.join(' / ') || variant.sku || '—'),
    quantity: Number(item.quantity ?? item.original_quantity ?? item.qty ?? 0),
    unitCost:
      item.unit_cost ??
      item.cost_price ??
      batchPrices.costPrice ??
      item.unit_price ??
      item.purchase_price ??
      null,
    sellingPrice:
      item.selling_price ??
      item.sale_price ??
      batchPrices.sellingPrice ??
      item.retail_price ??
      null,
    variantStatus: item.status ?? null,
  };
}

export function mapShipment(row) {
  const itemsRaw = row.items ?? row.lines ?? row.shipment_items ?? row.variant_shipments ?? [];
  const batchPrices = {
    costPrice: row.cost_price,
    sellingPrice: row.selling_price,
  };
  const items = (Array.isArray(itemsRaw) ? itemsRaw : []).map((item) =>
    mapShipmentItem(item, batchPrices),
  );
  const statusRaw = resolveShipmentStatusRaw(row);

  return {
    id: row.id,
    code:
      row.shipment_number ??
      row.code ??
      row.reference ??
      row.batch_number ??
      `SH-${String(row.id).padStart(3, '0')}`,
    batchNumber: row.batch_number ?? row.batchNumber ?? '',
    productId: row.product_id ?? row.product?.id ?? null,
    costPrice: row.cost_price ?? '',
    sellingPrice: row.selling_price ?? '',
    supplierName: row.supplier_name ?? '',
    date: formatDate(row.received_at ?? row.created_at ?? row.date),
    productsCount:
      row.products_count ??
      row.items_count ??
      (new Set(items.map((i) => i.variantId)).size || items.length),
    totalQuantity:
      row.total_quantity ??
      items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    status: mapStatusToArabic(resolveShipmentSelectStatus(statusRaw)),
    statusRaw,
    dynamicStatus: row.dynamic_status ?? null,
    batchStatus: row.status ?? null,
    items,
  };
}

function buildShipmentItemsPayload(items) {
  return items.map((item) => {
    const payloadItem = {
      variant_id: Number(item.variantId),
      quantity: Number(item.quantity),
    };
    if (item.id && /^\d+$/.test(String(item.id))) {
      payloadItem.id = Number(item.id);
    }
    return payloadItem;
  });
}

function buildShipmentBody({
  storeId,
  productId,
  items,
  batchNumber,
  supplierName,
  costPrice,
  sellingPrice,
}) {
  const resolvedStoreId = resolveInventoryStoreId(storeId);
  if (!resolvedStoreId) {
    throw new Error('لم يتم تحديد المتجر. يرجى تسجيل الدخول مرة أخرى.');
  }

  const body = {
    store_id: resolvedStoreId,
    items: buildShipmentItemsPayload(items),
  };

  if (productId) body.product_id = Number(productId);
  if (batchNumber?.trim()) body.batch_number = batchNumber.trim();
  if (supplierName?.trim()) body.supplier_name = supplierName.trim();
  if (costPrice !== undefined && costPrice !== '') body.cost_price = Number(costPrice);
  if (sellingPrice !== undefined && sellingPrice !== '') body.selling_price = Number(sellingPrice);

  return body;
}

function normalizeShipmentStats(apiStats, fallbackShipments = []) {
  const stats = apiStats || {};
  return {
    total: Number(stats.total ?? fallbackShipments.length ?? 0),
    pending: Number(stats.pending ?? 0),
    received: Number(stats.received ?? 0),
    totalQty: Number(stats.total_qty ?? stats.totalQty ?? 0),
  };
}

function matchesShipmentStatusFilter(shipment, status) {
  if (!status || status === 'all') return true;

  const uiStatus = resolveShipmentSelectStatus(shipment.statusRaw);
  const batchStatus = String(shipment.batchStatus ?? '').toLowerCase();

  if (status === 'cancelled') {
    return (
      uiStatus === 'cancelled' ||
      shipment.statusRaw === 'finished' ||
      batchStatus === 'archived' ||
      batchStatus === 'cancelled'
    );
  }

  if (status === 'pending' || status === 'received') {
    return shipment.statusRaw === status;
  }

  return shipment.statusRaw === status || uiStatus === status;
}

function filterShipmentsByStatus(shipments, status) {
  if (!status || status === 'all') return shipments;
  return shipments.filter((shipment) => matchesShipmentStatusFilter(shipment, status));
}

/** تحويل فلتر الواجهة إلى query param لـ GET /inventory/shipments */
function mapShipmentStatusFilterToApi(status) {
  if (!status || status === 'all') return null;
  if (status === 'cancelled') return 'archived';
  return status;
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
  if (stockFilter && stockFilter !== 'all') query.set('status', stockFilter);

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
 * GET /api/inventory/shipments — قائمة الشحنات مع البحث والفلترة
 * query: store_id, search, status (cancelled|archived), per_page, page
 */
export async function fetchShipments({
  storeId,
  status = 'all',
  search,
  perPage = 50,
  page = 1,
} = {}) {
  const resolvedStoreId = resolveInventoryStoreId(storeId);
  const query = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
  });
  if (resolvedStoreId) query.set('store_id', String(resolvedStoreId));
  if (search?.trim()) query.set('search', search.trim());

  const apiStatus = mapShipmentStatusFilterToApi(status);
  if (apiStatus) query.set('status', apiStatus);

  const res = await apiRequest(`${API_ENDPOINTS.inventoryShipments}?${query}`);
  const shipmentsRaw = extractList(res);
  const allShipments = shipmentsRaw.map(mapShipment);
  const shipments = filterShipmentsByStatus(allShipments, status);

  return {
    shipments,
    stats: normalizeShipmentStats(res?.stats, allShipments),
    meta: res?.meta ?? null,
  };
}

/**
 * POST /api/inventory/shipments
 */
export async function createShipment({
  storeId,
  productId,
  items,
  batchNumber,
  supplierName,
  costPrice,
  sellingPrice,
}) {
  const res = await apiRequest(API_ENDPOINTS.inventoryShipments, {
    method: 'POST',
    body: buildShipmentBody({
      storeId,
      productId,
      items,
      batchNumber,
      supplierName,
      costPrice,
      sellingPrice,
    }),
  });
  const row = res?.data ?? res;
  return mapShipment(row);
}

/**
 * PUT /api/inventory/shipments/{id}
 */
export async function updateShipment(
  id,
  { storeId, productId, items, batchNumber, supplierName, costPrice, sellingPrice },
) {
  const res = await apiRequest(API_ENDPOINTS.inventoryShipment(id), {
    method: 'PUT',
    body: buildShipmentBody({
      storeId,
      productId,
      items,
      batchNumber,
      supplierName,
      costPrice,
      sellingPrice,
    }),
  });
  const row = res?.data ?? res;
  return mapShipment(row);
}

async function refreshShipmentRow(shipment, { storeId } = {}) {
  const resolvedStoreId = resolveInventoryStoreId(storeId);
  const result = await fetchShipments({ storeId: resolvedStoreId, perPage: 100 });
  return result.shipments.find((row) => row.id === shipment.id) ?? shipment;
}

/**
 * استعادة شحنة مؤرشفة — POST /api/inventory/adjust (تبديل حالة الأصناف)
 */
export async function restoreShipment(shipment, { storeId } = {}) {
  const resolvedStoreId = resolveInventoryStoreId(storeId);
  const items = (shipment?.items || []).filter(
    (item) => item.id && /^\d+$/.test(String(item.id)) && item.variantStatus === 'archived',
  );

  if (!items.length) {
    throw new Error('لا توجد أصناف مؤرشفة لاستعادتها في هذه الشحنة.');
  }

  for (const item of items) {
    await adjustInventory({
      variantShipmentId: item.id,
      reason: `استعادة شحنة ${shipment.code || shipment.batchNumber || shipment.id}`,
      storeId: resolvedStoreId,
    });
  }

  return refreshShipmentRow(shipment, { storeId: resolvedStoreId });
}

/**
 * جعل الشحنة «مستلمة / حالية» — أرشفة الشحنة النشطة الأقدم لنفس المنتج عبر adjust
 */
async function promoteShipmentToActive(shipment, { storeId } = {}) {
  const resolvedStoreId = resolveInventoryStoreId(storeId);
  const productId = shipment.productId;

  if (!productId) {
    throw new Error('تعذّر تحديد المنتج المرتبط بالشحنة.');
  }

  if (shipment.statusRaw === 'finished') {
    await restoreShipment(shipment, { storeId: resolvedStoreId });
  }

  const result = await fetchShipments({ storeId: resolvedStoreId, perPage: 100 });
  const currentActive = result.shipments.find(
    (row) => row.productId === productId && row.statusRaw === 'received' && row.id !== shipment.id,
  );

  if (currentActive) {
    await archiveShipment(currentActive, { storeId: resolvedStoreId });
  }

  return refreshShipmentRow(shipment, { storeId: resolvedStoreId });
}

/**
 * تعديل حالة الشحنة — يعتمد على POST /api/inventory/adjust وإدارة ترتيب FIFO
 */
export async function updateShipmentStatus(shipment, targetStatus, { storeId } = {}) {
  if (!shipment?.id) {
    throw new Error('الشحنة غير صالحة.');
  }

  const target = resolveShipmentSelectStatus(targetStatus);
  const current = resolveShipmentSelectStatus(shipment.statusRaw);

  if (current === target) {
    return shipment;
  }

  if (target === 'cancelled') {
    await archiveShipment(shipment, { storeId });
    return refreshShipmentRow(shipment, { storeId });
  }

  if (target === 'received') {
    let working = shipment;
    const raw = String(shipment.statusRaw ?? '').toLowerCase();
    if (raw === 'finished' || raw === 'cancelled') {
      working = await restoreShipment(shipment, { storeId });
    }
    return promoteShipmentToActive(working, { storeId });
  }

  if (target === 'pending') {
    const raw = String(shipment.statusRaw ?? '').toLowerCase();
    if (raw === 'finished' || raw === 'cancelled') {
      return restoreShipment(shipment, { storeId });
    }
    if (raw === 'received') {
      await archiveShipment(shipment, { storeId });
      return refreshShipmentRow(shipment, { storeId });
    }
    return shipment;
  }

  throw new Error('حالة الشحنة غير مدعومة.');
}

/** @deprecated استخدم SHIPMENT_STATUS_EDIT_OPTIONS */
export function getShipmentStatusChangeOptions() {
  return SHIPMENT_STATUS_EDIT_OPTIONS;
}

/**
 * أرشفة شحنة عبر POST /api/inventory/adjust لكل تنوع داخلها
 */
export async function archiveShipment(shipment, { storeId } = {}) {
  const resolvedStoreId = resolveInventoryStoreId(storeId);
  const items = (shipment?.items || []).filter(
    (item) => item.id && /^\d+$/.test(String(item.id)) && item.variantStatus !== 'archived',
  );

  if (!items.length) {
    throw new Error('لا توجد أصناف نشطة في هذه الشحنة لأرشفتها.');
  }

  for (const item of items) {
    await adjustInventory({
      variantShipmentId: item.id,
      reason: `أرشفة شحنة ${shipment.code || shipment.batchNumber || shipment.id}`,
      storeId: resolvedStoreId,
    });
  }

  return refreshShipmentRow(shipment, { storeId: resolvedStoreId });
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
 * POST /inventory/adjust — أرشفة/استعادة صنف داخل شحنة
 */
export async function adjustInventory({ variantShipmentId, reason, storeId }) {
  const resolvedStoreId = resolveInventoryStoreId(storeId);
  const body = {
    variant_shipment_id: Number(variantShipmentId),
    reason: reason?.trim() || 'تعديل يدوي من لوحة المتجر',
  };
  if (resolvedStoreId) body.store_id = resolvedStoreId;

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
