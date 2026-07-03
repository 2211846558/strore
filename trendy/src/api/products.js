import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { buildVariantDisplayLabel, buildVariantFullLabel } from '../utils/variantLabel';
import {
  getProductImageCandidates,
  productPlaceholderImage,
} from './media';

function mapImageEntry(img, productId) {
  const raw =
    typeof img === 'string'
      ? img
      : img?.url ?? img?.path ?? img?.image_url ?? img?.full_url ?? img?.src ?? null;
  const candidates = getProductImageCandidates(raw, productId);
  return {
    id: typeof img === 'object' ? img?.id ?? null : null,
    url: candidates[0] || productPlaceholderImage(),
    candidates: candidates.length ? candidates : [productPlaceholderImage()],
  };
}

function collectRawProductImages(item) {
  if (Array.isArray(item.images) && item.images.length) return item.images;
  if (item.thumbnail) return [item.thumbnail];
  if (item.image_url) return [item.image_url];
  if (item.image) return [item.image];
  if (item.primary_image) return [item.primary_image];
  return [];
}

function productImageFields(item) {
  const rawList = collectRawProductImages(item);
  const images = rawList.map((img) => mapImageEntry(img, item.id));
  const primary = images[0];

  return {
    image: primary?.url || productPlaceholderImage(),
    imageCandidates: primary?.candidates || [],
    images,
  };
}

export function mapProductFromList(item) {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku || '',
    description: '',
    price: String(item.base_price ?? ''),
    category: item.category?.name ?? '',
    categoryId: item.category?.id ?? null,
    colors: [],
    sizes: [],
    stock: item.total_quantity != null ? String(item.total_quantity) : '',
    status: item.status === 'archived' ? 'مؤرشف' : 'نشط',
    ...productImageFields(item),
  };
}

export function mapProductFromDetails(item) {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku || '',
    description: item.description || '',
    price: String(item.base_price ?? ''),
    category: item.category?.name ?? '',
    categoryId: item.category?.id ?? null,
    colors: [],
    sizes: [],
    stock: item.total_quantity != null ? String(item.total_quantity) : '',
    status: item.status === 'archived' ? 'مؤرشف' : 'نشط',
    ...productImageFields(item),
  };
}

function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function mapAttributeValues(attr) {
  const raw = attr.values ?? attr.attribute_values ?? attr.attributeValues ?? [];
  return (Array.isArray(raw) ? raw : []).map((v) => ({
    id: v.id,
    value: v.value ?? v.name ?? v.label ?? String(v.id),
  }));
}

/**
 * GET /api/catalog/categories
 */
export async function fetchCategories() {
  const res = await apiRequest(API_ENDPOINTS.catalogCategories, { auth: false });
  return extractList(res).map((c) => ({ id: c.id, name: c.name }));
}

/**
 * GET /api/catalog/attributes — الخصائص وقيمها (لون، مقاس، ...)
 */
export async function fetchAttributes({ perPage = 50 } = {}) {
  const query = new URLSearchParams({ per_page: String(perPage) });
  const res = await apiRequest(`${API_ENDPOINTS.catalogAttributes}?${query}`, { auth: false });
  return extractList(res).map((attr) => ({
    id: attr.id,
    name: attr.name,
    values: mapAttributeValues(attr),
  }));
}

const DEFAULT_COLOR_DOTS = {
  أزرق: '#3b82f6',
  أبيض: '#e5e7eb',
  أحمر: '#ef4444',
  وردي: '#ec4899',
  أسود: '#1f2937',
  رمادي: '#9ca3af',
  'أزرق داكن': '#1e40af',
  أخضر: '#22c55e',
  أصفر: '#eab308',
  بني: '#92400e',
  بنفسجي: '#8b5cf6',
  برتقالي: '#f97316',
};

function hashColorLabel(label) {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

/**
 * بناء خريطة ألوان من GET /catalog/attributes (خاصية اللون)
 */
export function buildColorDotsFromAttributes(attributes = []) {
  const dots = { ...DEFAULT_COLOR_DOTS };
  const colorAttr = attributes.find((attr) => /لون|color/i.test(String(attr.name ?? '')));

  if (!colorAttr?.values?.length) return dots;

  colorAttr.values.forEach((entry) => {
    const label = String(entry.value ?? '').trim();
    if (!label) return;
    if (/^#[0-9a-f]{3,8}$/i.test(label)) {
      dots[label] = label;
      return;
    }
    if (entry.hex || entry.color_code) {
      dots[label] = entry.hex || entry.color_code;
      return;
    }
    if (!dots[label]) dots[label] = hashColorLabel(label);
  });

  return dots;
}

/**
 * POST /api/my-store/products/{productId}/variants
 * body: { attribute_value_ids: number[] }
 */
export async function createProductVariant(productId, { storeId, attributeValueIds }) {
  const body = {
    attribute_value_ids: attributeValueIds,
  };
  if (storeId) body.store_id = storeId;

  const res = await apiRequest(API_ENDPOINTS.myStoreProductVariants(productId), {
    method: 'POST',
    body,
  });
  return res?.data ?? res;
}

/**
 * قائمة المنتجات تُرجع thumbnail فقط — نُكمل الصور من تفاصيل كل منتج.
 */
async function enrichProductsWithImages(products) {
  if (!products.length) return products;

  return Promise.all(
    products.map(async (product) => {
      if (product.status === 'مؤرشف') return product;
      try {
        const details = await fetchProductDetails(product.id);
        return {
          ...product,
          images: details.images,
          image: details.image,
          imageCandidates: details.imageCandidates,
        };
      } catch {
        return product;
      }
    }),
  );
}

function extractOrdersCount(item) {
  const raw =
    item.orders_count ??
    item.order_count ??
    item.total_orders ??
    item.ordered_count ??
    item.total_ordered ??
    item.quantity_ordered ??
    item.total_quantity_ordered;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function mapMostOrderedProduct(item) {
  const product = item?.product ?? item;
  return {
    ...mapProductFromList(product),
    ordersCount: extractOrdersCount(item),
  };
}

/**
 * GET /api/my-store/products/most-ordered — الأكثر طلباً (مدير المتجر وموظفيه)
 * params: { storeId, limit }
 */
export async function fetchMostOrderedProducts({ storeId, limit = 10 } = {}) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (storeId) query.set('store_id', String(storeId));

  const res = await apiRequest(`${API_ENDPOINTS.myStoreProductsMostOrdered}?${query}`);
  return extractList(res).map(mapMostOrderedProduct);
}

/**
 * GET /api/stores/{storeId}/products — منتجات المتجر النشطة (عرض عام)
 * filters: { name, categoryId, minPrice, maxPrice, perPage }
 */
export async function fetchStorePublicProducts({
  storeId,
  name,
  categoryId,
  minPrice,
  maxPrice,
  perPage = 100,
} = {}) {
  if (!storeId) {
    throw new Error('معرّف المتجر مطلوب لجلب المنتجات');
  }

  const query = new URLSearchParams({ per_page: String(perPage) });
  if (name?.trim()) query.set('name', name.trim());
  if (categoryId && categoryId !== 'all') query.set('category_id', String(categoryId));
  if (minPrice != null && minPrice !== '') query.set('min_price', String(minPrice));
  if (maxPrice != null && maxPrice !== '') query.set('max_price', String(maxPrice));

  const res = await apiRequest(`${API_ENDPOINTS.storePublicProducts(storeId)}?${query}`);
  return extractList(res);
}

/**
 * GET /api/my-store/products — بحث وفلترة من الخادم
 * filters: { name, category_id, status, storeId, perPage }
 */
export async function fetchStoreProducts({
  name,
  categoryId,
  status,
  storeId,
  perPage = 50,
} = {}) {
  const query = new URLSearchParams({ per_page: String(perPage) });
  if (storeId) query.set('store_id', String(storeId));
  if (name?.trim()) query.set('name', name.trim());
  if (categoryId && categoryId !== 'all') query.set('category_id', String(categoryId));
  if (status && status !== 'all') query.set('status', status);

  const res = await apiRequest(`${API_ENDPOINTS.myStoreProducts}?${query}`);
  const list = extractList(res).map(mapProductFromList);
  return enrichProductsWithImages(list);
}

/**
 * GET /api/products/{id} — تفاصيل المنتج للتعديل
 */
export async function fetchProductDetails(id) {
  const res = await apiRequest(API_ENDPOINTS.product(id));
  const item = res?.data ?? res;
  return mapProductFromDetails(item);
}

/**
 * تفاصيل المنتج — GET /api/products/{id}
 * ملاحظة: مسار my-store/products/{id} يدعم PUT فقط (تحديث) وليس GET.
 */
export async function fetchManagedProductDetails(id) {
  return fetchProductDetails(id);
}

function buildProductFormData({ storeId, name, sku, description, price, categoryId, stock, imageFiles }) {
  const fd = new FormData();
  if (storeId) fd.append('store_id', String(storeId));
  fd.append('name', name);
  if (sku) fd.append('sku', sku);
  if (description) fd.append('description', description);
  fd.append('base_price', String(price));
  fd.append('category_id', String(categoryId));
  if (stock !== '' && stock != null) fd.append('total_quantity', String(stock));
  if (imageFiles?.length) {
    imageFiles.forEach((file, index) => fd.append(`images[${index}]`, file));
  }
  return fd;
}

/**
 * POST /api/my-store/products
 */
export async function createProduct(payload) {
  const fd = buildProductFormData(payload);
  const res = await apiRequest(API_ENDPOINTS.myStoreProducts, {
    method: 'POST',
    body: fd,
  });
  const item = res?.data ?? res;
  return mapProductFromDetails(item);
}

/**
 * PUT /api/my-store/products/{id}
 * Laravel/PHP لا يقرأ الملفات في طلب PUT — نستخدم POST مع _method=PUT
 */
export async function updateProduct(id, payload) {
  const fd = buildProductFormData(payload);
  fd.append('_method', 'PUT');
  const res = await apiRequest(API_ENDPOINTS.myStoreProduct(id), {
    method: 'POST',
    body: fd,
  });
  const item = res?.data ?? res;
  return mapProductFromDetails(item);
}

/**
 * POST /api/my-store/products/{id}/archive
 */
export async function archiveProduct(id) {
  const res = await apiRequest(API_ENDPOINTS.myStoreProductArchive(id), { method: 'POST' });
  const item = res?.data ?? res;
  return mapProductFromDetails(item);
}

/**
 * POST /api/my-store/products/{id}/restore
 */
export async function restoreProduct(id) {
  const res = await apiRequest(API_ENDPOINTS.myStoreProductRestore(id), { method: 'POST' });
  const item = res?.data ?? res;
  return mapProductFromDetails(item);
}

/**
 * GET /api/products/{productId} — استخراج التنوعات المحفوظة من تفاصيل المنتج
 * يُعيد مصفوفة من التنوعات مع قيم الخصائص والسعر والكمية
 */
export async function fetchProductVariants(productId, { productName } = {}) {
  const res = await apiRequest(`${API_ENDPOINTS.product(productId)}/variants`);
  const item = res?.data ?? res;
  const rawVariants = Array.isArray(item)
    ? item
    : Array.isArray(item?.variants)
      ? item.variants
      : Array.isArray(item?.data)
        ? item.data
        : [];

  return rawVariants.map((v) => {
    const attrValues = Array.isArray(v.attribute_values)
      ? v.attribute_values
      : Array.isArray(v.attributes)
        ? v.attributes
        : Array.isArray(v.attributeValues)
          ? v.attributeValues
          : Array.isArray(v.values)
            ? v.values
            : [];
    const label = buildVariantDisplayLabel(productName, attrValues, {
      variantId: v.id,
      existingLabel: v.label,
      sku: v.sku,
      variant: v,
    });
    const fullLabel = buildVariantFullLabel(productName, attrValues, {
      variantId: v.id,
      existingLabel: v.label,
      sku: v.sku,
      variant: v,
    });
    // قد يُعيد الـ API inventory_summary أو current_shipment
    const inventory = v.inventory_summary ?? v.current_inventory ?? {};
    const currentShipmentObj = v.current_shipment ?? inventory.current_shipment ?? null;
    const currentShipmentId =
      v.current_shipment_id
      ?? inventory.current_shipment_id
      ?? currentShipmentObj?.id
      ?? '';
    const currentShipmentCode =
      currentShipmentObj?.shipment_number
      ?? currentShipmentObj?.code
      ?? currentShipmentObj?.batch_number
      ?? inventory.current_shipment_code
      ?? inventory.shipment_number
      ?? '';
    let currentShipmentRemaining = null;
    for (const source of [v, inventory, currentShipmentObj]) {
      if (!source) continue;
      for (const field of [
        'current_shipment_remaining',
        'current_shipment_remaining_quantity',
        'remaining_quantity',
        'remaining_qty',
        'remaining_in_current_shipment',
        'shipment_remaining_quantity',
      ]) {
        if (source[field] != null && source[field] !== '') {
          currentShipmentRemaining = Number(source[field]);
          break;
        }
      }
      if (currentShipmentRemaining != null) break;
    }
    const selections = {};
    attrValues.forEach((av) => {
      const attrId = av.attribute_id ?? av.attribute?.id ?? av.pivot?.attribute_id;
      if (attrId) {
        selections[attrId] = av.id;
      }
    });

    return {
      id: v.id,
      label,
      fullLabel,
      attributeValueIds: attrValues.map((av) => av.id),
      attributeValues: attrValues,
      selections,
      // خريطة attributeId → valueId للتحقق من التكرار
      selectionKey: attrValues
        .map((av) => `${av.attribute_id ?? av.attribute?.id ?? av.pivot?.attribute_id ?? '?'}:${av.id}`)
        .sort()
        .join('|'),
      price: v.selling_price ?? v.price ?? inventory.selling_price ?? '',
      quantity: v.total_quantity ?? v.quantity ?? inventory.total_quantity ?? '',
      currentShipment: currentShipmentId,
      currentShipmentCode,
      currentShipmentRemaining,
      shipmentBreakdown: [],
    };
  });
}

/**
 * DELETE /api/my-store/products/{productId}/variants/{variantId}
 */
export async function deleteProductVariant(productId, variantId) {
  const url = `${API_ENDPOINTS.myStoreProductVariants(productId)}/${variantId}`;
  await apiRequest(url, { method: 'DELETE' });
}

/**
 * GET /api/v1/admin/attributes — قائمة الخصائص للإدارة
 */
export async function fetchAdminAttributes() {
  const res = await apiRequest('/admin/attributes');
  return extractList(res).map((attr) => ({
    id: attr.id,
    name: attr.name,
    values: mapAttributeValues(attr),
  }));
}

/**
 * POST /api/v1/admin/attributes — إضافة خاصية جديدة مع قيمها
 */
export async function createAdminAttribute(data) {
  const res = await apiRequest('/admin/attributes', {
    method: 'POST',
    body: data,
  });
  return res?.data ?? res;
}

/**
 * PUT /api/v1/admin/attributes/{id} — تعديل خاصية
 */
export async function updateAdminAttribute(id, data) {
  const res = await apiRequest(`/admin/attributes/${id}`, {
    method: 'PUT',
    body: data,
  });
  return res?.data ?? res;
}

/**
 * DELETE /api/v1/admin/attributes/{id} — حذف خاصية
 */
export async function deleteAdminAttribute(id) {
  await apiRequest(`/admin/attributes/${id}`, {
    method: 'DELETE',
  });
}

