import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import {
  getProductImageCandidates,
  productPlaceholderImage,
} from './media';

function mapImageEntry(img, productId) {
  const raw = typeof img === 'string' ? img : img?.url;
  const candidates = getProductImageCandidates(raw, productId);
  return {
    id: typeof img === 'object' ? img?.id ?? null : null,
    url: candidates[0] || productPlaceholderImage(),
    candidates,
  };
}

function productImageFields(item) {
  const rawList =
    Array.isArray(item.images) && item.images.length
      ? item.images
      : item.thumbnail
        ? [{ url: item.thumbnail }]
        : [];

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
    description: '',
    price: String(item.base_price ?? ''),
    category: item.category?.name ?? '',
    categoryId: item.category?.id ?? null,
    colors: [],
    sizes: [],
    stock: null,
    status: item.status === 'archived' ? 'مؤرشف' : 'نشط',
    ...productImageFields(item),
  };
}

export function mapProductFromDetails(item) {
  return {
    id: item.id,
    name: item.name,
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
 * body: { sku, attribute_value_ids: number[] }
 */
export async function createProductVariant(productId, { storeId, sku, attributeValueIds }) {
  const body = {
    sku,
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

function buildProductFormData({ storeId, name, description, price, categoryId, stock, imageFiles }) {
  const fd = new FormData();
  if (storeId) fd.append('store_id', String(storeId));
  fd.append('name', name);
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
