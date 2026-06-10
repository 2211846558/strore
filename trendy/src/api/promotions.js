import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';

function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function resolvePromotionDisplayStatus(row) {
  const now = new Date();
  const start = row.start_at ? new Date(String(row.start_at).replace(' ', 'T')) : null;
  const end = row.end_at ? new Date(String(row.end_at).replace(' ', 'T')) : null;

  if (row.status === 'inactive') {
    return { status: 'معطل', active: false };
  }
  if (end && end < now) {
    return { status: 'منتهي', active: false };
  }
  if (start && start > now) {
    return { status: 'مجدول', active: true };
  }
  return { status: 'نشط', active: row.status === 'active' || Boolean(row.is_active) };
}

export function mapPromotion(row) {
  const type = row.type === 'fixed' ? 'قيمة ثابتة' : 'نسبة مئوية %';
  const { status, active } = resolvePromotionDisplayStatus(row);
  const affected = row.affected_products ?? row.products ?? [];
  const products = (Array.isArray(affected) ? affected : []).map((p) => ({
    id: p.product_id ?? p.id,
    name: p.name ?? '—',
  }));

  return {
    id: row.id,
    name: row.name ?? '',
    description: row.description ?? '',
    type,
    typeRaw: row.type ?? 'percentage',
    value: Number(row.value ?? 0),
    startDate: row.start_at ? String(row.start_at).slice(0, 10) : '',
    endDate: row.end_at ? String(row.end_at).slice(0, 10) : '',
    status,
    statusRaw: row.status ?? 'inactive',
    active,
    productIds: products.map((p) => p.id).filter(Boolean),
    products: products.map((p) => p.name),
  };
}

function mapTypeToApi(type) {
  return type === 'قيمة ثابتة' ? 'fixed' : 'percentage';
}

export function buildPromotionPayload(form, { storeId } = {}) {
  const body = {
    name: form.name.trim(),
    type: mapTypeToApi(form.type),
    value: Number(form.value),
    start_at: form.startDate,
    end_at: form.endDate,
    product_ids: form.productIds.map(Number),
  };

  if (storeId) body.store_id = storeId;
  if (form.description?.trim()) body.description = form.description.trim();
  if (form.statusRaw) {
    body.status = form.active ? 'active' : 'inactive';
  } else {
    body.status = form.active ? 'active' : 'inactive';
  }

  return body;
}

export function buildPromotionUpdatePayload(form, { storeId } = {}) {
  const body = buildPromotionPayload(form, { storeId });
  return body;
}

/**
 * GET /promotions — قائمة الحملات
 */
export async function fetchPromotions({
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
  if (status) query.set('status', status);

  const res = await apiRequest(`${API_ENDPOINTS.promotions}?${query}`);
  return {
    promotions: extractList(res).map(mapPromotion),
    meta: res?.meta ?? null,
  };
}

export async function fetchAllPromotions(filters = {}) {
  const perPage = filters.perPage ?? 100;
  const all = [];
  let page = 1;
  let lastPage = 1;

  do {
    const result = await fetchPromotions({ ...filters, perPage, page });
    all.push(...result.promotions);
    lastPage = Number(result.meta?.last_page ?? 1);
    page += 1;
  } while (page <= lastPage);

  return all;
}

/**
 * GET /promotions/{id}
 */
export async function fetchPromotion(id) {
  const res = await apiRequest(API_ENDPOINTS.promotion(id));
  return mapPromotion(res?.data ?? res);
}

/**
 * POST /promotions
 */
export async function createPromotion(payload) {
  const res = await apiRequest(API_ENDPOINTS.promotions, {
    method: 'POST',
    body: payload,
  });
  return mapPromotion(res?.data ?? res);
}

/**
 * PATCH /promotions/{id}
 */
export async function updatePromotion(id, payload) {
  const res = await apiRequest(API_ENDPOINTS.promotion(id), {
    method: 'PATCH',
    body: payload,
  });
  return mapPromotion(res?.data ?? res);
}

/**
 * DELETE /promotions/{id}
 */
export async function deletePromotion(id) {
  return apiRequest(API_ENDPOINTS.promotion(id), { method: 'DELETE' });
}

/**
 * POST /promotions/{id}/toggle — تفعيل / إلغاء تفعيل
 */
export async function togglePromotion(id) {
  return apiRequest(API_ENDPOINTS.promotionToggle(id), { method: 'POST' });
}
