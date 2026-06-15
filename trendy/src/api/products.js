import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { getStoredUser, resolveManagedStoreId } from './auth';
import {
  getProductImageCandidates,
  productPlaceholderImage,
} from './media';
import { staleWhileRevalidate, TTL, clearCache } from './cache';

function resolveProductStoreId(storeId) {
  return resolveManagedStoreId(getStoredUser(), storeId);
}

function normalizeProductPrice(price) {
  const num = Number(price);
  if (Number.isNaN(num) || num < 0) return 0;
  return num;
}

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
export async function fetchCategories(forceRefresh = false) {
  return staleWhileRevalidate('categories', async () => {
    const res = await apiRequest(API_ENDPOINTS.catalogCategories, { auth: false });
    return extractList(res).map((c) => ({ id: c.id, name: c.name }));
  }, TTL.STATIC, forceRefresh);
}

/**
 * GET /api/catalog/attributes — الخصائص وقيمها (لون، مقاس، ...)
 */
export async function fetchAttributes({ perPage = 50 } = {}, forceRefresh = false) {
  return staleWhileRevalidate('attributes', async () => {
    const query = new URLSearchParams({ per_page: String(perPage) });
    const res = await apiRequest(`${API_ENDPOINTS.catalogAttributes}?${query}`, { auth: false });
    return extractList(res).map((attr) => ({
      id: attr.id,
      name: attr.name,
      values: mapAttributeValues(attr),
    }));
  }, TTL.STATIC, forceRefresh);
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
export async function createProductVariant(
  productId,
  { storeId, attributeValueIds, catalogAttributes = [], selections = null },
) {
  const body = {
    attribute_value_ids: attributeValueIds,
  };
  const resolvedStoreId = resolveProductStoreId(storeId);
  if (resolvedStoreId) body.store_id = resolvedStoreId;

  const res = await apiRequest(API_ENDPOINTS.myStoreProductVariants(productId), {
    method: 'POST',
    body,
  });
  const created = res?.data ?? res;

  const mapped = mapProductVariant(
    { ...created, attribute_value_ids: attributeValueIds },
    catalogAttributes,
    { selections: selections ?? undefined },
  );

  if (created?.id && selections) {
    persistVariantSelections(productId, created.id, {
      selections,
      attributeValueIds,
      label: mapped.label,
      catalogAttributes,
    });
  }

  return mapped;
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
} = {}, forceRefresh = false) {
  const cacheKey = `products_${status || 'all'}_${categoryId || 'all'}`;
  return staleWhileRevalidate(cacheKey, async () => {
    const query = new URLSearchParams({ per_page: String(perPage) });
    const resolvedStoreId = resolveProductStoreId(storeId);
    if (resolvedStoreId) query.set('store_id', String(resolvedStoreId));
    if (name?.trim()) query.set('name', name.trim());
    if (categoryId && categoryId !== 'all') query.set('category_id', String(categoryId));
    if (status && status !== 'all') query.set('status', status);

    const res = await apiRequest(`${API_ENDPOINTS.myStoreProducts}?${query}`);
    const list = extractList(res).map(mapProductFromList);
    return list;
  }, TTL.SEMI, forceRefresh);
}

/**
 * GET /api/products/{id} — تفاصيل المنتج للتعديل
 */
export async function fetchProductDetails(id) {
  const res = await apiRequest(API_ENDPOINTS.product(id));
  return mapProductFromDetails(unwrapApiEntity(res));
}

export function unwrapApiEntity(res) {
  const payload = res?.data ?? res;
  if (payload?.id != null) return payload;
  if (payload?.data?.id != null) return payload.data;
  return payload;
}

const COLOR_ATTR_RE = /لون|color/i;
const SIZE_ATTR_RE = /مقاس|size/i;

function readAttrValue(av) {
  if (typeof av === 'string') return av;
  return av?.value ?? av?.name ?? av?.label ?? av?.attribute_value?.value ?? null;
}

function readAttrName(av) {
  return String(av?.attribute?.name ?? av?.attribute_name ?? '').trim();
}

/**
 * استخراج اللون والمقاس من قيم الخصائص — GET /products/{id} → variants[].attribute_values
 */
export function parseVariantColorSize(attrValues, catalogAttributes = []) {
  const list = Array.isArray(attrValues) ? attrValues : [];
  let color = null;
  let size = null;
  const extras = [];

  for (const av of list) {
    const value = String(readAttrValue(av) ?? '').trim();
    if (!value) continue;
    const attrName = readAttrName(av);

    if (COLOR_ATTR_RE.test(attrName)) color = value;
    else if (SIZE_ATTR_RE.test(attrName)) size = value;
    else extras.push(value);
  }

  if (!color && !size && list.length) {
    const values = list.map(readAttrValue).filter(Boolean);
    if (values.length === 1) {
      color = values[0];
      size = 'واحد';
    } else if (values.length >= 2) {
      [color, size] = values;
    }
  } else if (color && !size) {
    size = 'واحد';
  }

  const label =
    [color, size && size !== 'واحد' ? size : null].filter(Boolean).join(' / ') ||
    extras.join(' / ');

  return {
    color: color ?? '—',
    size: size ?? '—',
    label,
  };
}

/**
 * تحليل نص الخصائص من GET /inventory — مثال: "أحمر / M"
 */
export function parseAttributesString(attrStr, catalogAttributes = []) {
  const text = String(attrStr ?? '').trim();
  if (!text || text === '—') {
    return { color: '—', size: '—', label: '' };
  }

  const parts = text
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  let color = null;
  let size = null;

  for (const part of parts) {
    for (const attr of catalogAttributes) {
      const values = attr.values ?? [];
      if (!values.some((entry) => entry.value === part)) continue;
      if (COLOR_ATTR_RE.test(String(attr.name ?? ''))) color = part;
      else if (SIZE_ATTR_RE.test(String(attr.name ?? ''))) size = part;
    }
  }

  if (!color && !size) {
    if (parts.length === 1) {
      color = parts[0];
      size = 'واحد';
    } else if (parts.length >= 2) {
      [color, size] = parts;
    }
  } else if (color && !size) {
    size = 'واحد';
  }

  return {
    color: color ?? '—',
    size: size ?? '—',
    label: parts.join(' / '),
  };
}

export function buildVariantFallbackLabel(variant) {
  return `تنوع #${variant.id}`;
}

export function buildVariantLabelFromSelections(selections, catalogAttributes = []) {
  const attributeValues = [];
  for (const attr of catalogAttributes) {
    const valueId = selections?.[attr.id] ?? selections?.[String(attr.id)];
    if (!valueId) continue;
    const match = (attr.values ?? []).find((entry) => String(entry.id) === String(valueId));
    if (match) {
      attributeValues.push({
        id: match.id,
        value: match.value,
        attribute_id: attr.id,
        attribute: { id: attr.id, name: attr.name },
      });
    }
  }
  const { label } = parseVariantColorSize(attributeValues, catalogAttributes);
  return label || null;
}

export function getCachedVariantLabel(productId, variantId, catalogAttributes = []) {
  const productEntry = productId ? readVariantSelectionsCache(productId)[String(variantId)] : null;
  if (productEntry?.label) return productEntry.label;
  if (productEntry?.selections) {
    return buildVariantLabelFromSelections(productEntry.selections, catalogAttributes);
  }

  const globalEntry = readGlobalVariantLabels()[String(variantId)];
  if (globalEntry?.label) return globalEntry.label;
  if (globalEntry?.selections) {
    return buildVariantLabelFromSelections(globalEntry.selections, catalogAttributes);
  }

  const anyEntry = findSelectionsInAnyProductCache(variantId);
  if (anyEntry?.label) return anyEntry.label;
  if (anyEntry?.selections) {
    return buildVariantLabelFromSelections(anyEntry.selections, catalogAttributes);
  }

  return null;
}

export function extractProductVariants(raw) {
  const variantsRaw = raw?.variants ?? raw?.product_variants ?? [];
  return Array.isArray(variantsRaw) ? variantsRaw : [];
}

const GLOBAL_VARIANT_LABELS_KEY = 'trendy_variant_labels';

function variantSelectionsStorageKey(productId) {
  return `trendy_variant_sel_${productId}`;
}

function readVariantSelectionsCache(productId) {
  try {
    const raw = localStorage.getItem(variantSelectionsStorageKey(productId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readGlobalVariantLabels() {
  try {
    const raw = localStorage.getItem(GLOBAL_VARIANT_LABELS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeGlobalVariantLabel(variantId, { productId, selections, attributeValueIds, label }) {
  if (!variantId) return;
  const global = readGlobalVariantLabels();
  global[String(variantId)] = {
    productId: productId ?? global[String(variantId)]?.productId ?? null,
    selections: selections ?? global[String(variantId)]?.selections ?? null,
    attributeValueIds:
      attributeValueIds ?? global[String(variantId)]?.attributeValueIds ?? null,
    label: label ?? global[String(variantId)]?.label ?? null,
  };
  localStorage.setItem(GLOBAL_VARIANT_LABELS_KEY, JSON.stringify(global));
}

function findSelectionsInAnyProductCache(variantId) {
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith('trendy_variant_sel_')) continue;
    try {
      const cache = JSON.parse(localStorage.getItem(key) || '{}');
      const entry = cache[String(variantId)];
      if (entry?.selections) {
        return {
          productId: key.replace('trendy_variant_sel_', ''),
          ...entry,
        };
      }
    } catch {
      // تجاهل
    }
  }
  return null;
}

export function persistVariantSelections(
  productId,
  variantId,
  { selections, attributeValueIds, label, catalogAttributes = [] },
) {
  if (!productId || !variantId || !selections) return;
  const resolvedLabel =
    label ?? buildVariantLabelFromSelections(selections, catalogAttributes) ?? null;
  const cache = readVariantSelectionsCache(productId);
  cache[String(variantId)] = {
    selections,
    attributeValueIds: attributeValueIds ?? Object.values(selections).map(Number),
    label: resolvedLabel,
  };
  localStorage.setItem(variantSelectionsStorageKey(productId), JSON.stringify(cache));
  writeGlobalVariantLabel(variantId, {
    productId,
    selections,
    attributeValueIds,
    label: resolvedLabel,
  });
}

function removeVariantSelectionsCache(productId, variantId) {
  const cache = readVariantSelectionsCache(productId);
  delete cache[String(variantId)];
  localStorage.setItem(variantSelectionsStorageKey(productId), JSON.stringify(cache));
}

function collectVariantAttributeValueIds(variant) {
  const direct =
    variant.attribute_value_ids ??
    variant.attributeValueIds ??
    (Array.isArray(variant.attribute_values)
      ? variant.attribute_values.map((av) => av.id)
      : null);

  if (Array.isArray(direct) && direct.length) return direct;

  const pivotIds = [];
  if (variant.pivot?.attribute_value_id) pivotIds.push(variant.pivot.attribute_value_id);
  if (Array.isArray(variant.pivot?.attribute_value_ids)) {
    pivotIds.push(...variant.pivot.attribute_value_ids);
  }
  return pivotIds;
}

function resolveVariantAttributeValues(variant, catalogAttributes = []) {
  const nested =
    (Array.isArray(variant.attribute_values) && variant.attribute_values) ||
    (Array.isArray(variant.attributes) && variant.attributes) ||
    (Array.isArray(variant.attributeValues) && variant.attributeValues) ||
    (Array.isArray(variant.values) && variant.values) ||
    [];

  if (nested.length) return nested;

  const ids = collectVariantAttributeValueIds(variant);
  if (!ids.length || !catalogAttributes.length) return [];

  const values = [];
  for (const valueId of ids) {
    for (const attr of catalogAttributes) {
      const match = (attr.values ?? []).find((entry) => String(entry.id) === String(valueId));
      if (match) {
        values.push({
          id: match.id,
          value: match.value,
          attribute_id: attr.id,
          attribute: { id: attr.id, name: attr.name },
        });
        break;
      }
    }
  }
  return values;
}

function buildVariantSelections(attrValues, selectionOverride = null) {
  if (selectionOverride && Object.keys(selectionOverride).length) {
    return { ...selectionOverride };
  }

  const selections = {};
  attrValues.forEach((av) => {
    const attrId = av.attribute_id ?? av.attribute?.id ?? av.pivot?.attribute_id;
    if (attrId != null) selections[attrId] = av.id;
  });
  return selections;
}

function buildSelectionsFromAttributeText(attrText, catalogAttributes = []) {
  const parts = String(attrText ?? '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return { selections: {}, attributeValues: [] };

  const selections = {};
  const attributeValues = [];

  for (const part of parts) {
    for (const attr of catalogAttributes) {
      if (selections[attr.id] != null) continue;
      const match = (attr.values ?? []).find((entry) => entry.value === part);
      if (match) {
        selections[attr.id] = match.id;
        attributeValues.push({
          id: match.id,
          value: match.value,
          attribute_id: attr.id,
          attribute: { id: attr.id, name: attr.name },
        });
        break;
      }
    }
  }

  return { selections, attributeValues };
}

export function mapProductVariant(variant, catalogAttributes = [], options = {}) {
  let attrValues = resolveVariantAttributeValues(variant, catalogAttributes);
  let selections = buildVariantSelections(attrValues, options.selections);

  if (!Object.keys(selections).length && options.attributeText) {
    const parsed = buildSelectionsFromAttributeText(options.attributeText, catalogAttributes);
    selections = parsed.selections;
    attrValues = parsed.attributeValues;
  }

  if (!Object.keys(selections).length && options.cachedLabel) {
    const parsed = buildSelectionsFromAttributeText(options.cachedLabel, catalogAttributes);
    if (Object.keys(parsed.selections).length) {
      selections = parsed.selections;
      attrValues = parsed.attributeValues;
    }
  }

  let { label } = parseVariantColorSize(attrValues, catalogAttributes);

  if ((!label || label === '—') && options.cachedLabel) {
    label = options.cachedLabel;
  }

  if ((!label || label === '—') && options.attributeText) {
    label = parseAttributesString(options.attributeText, catalogAttributes).label || options.attributeText;
  }

  const inventory = variant.inventory_summary ?? variant.current_inventory ?? {};

  return {
    id: variant.id,
    label: label && label !== '—' ? label : buildVariantFallbackLabel(variant),
    attributeValueIds: attrValues.map((av) => av.id),
    attributeValues: attrValues,
    selections,
    selectionKey: Object.entries(selections)
      .map(([attrId, valueId]) => `${attrId}:${valueId}`)
      .sort()
      .join('|'),
    price: variant.selling_price ?? variant.price ?? inventory.selling_price ?? '',
    quantity: variant.total_quantity ?? variant.quantity ?? inventory.total_quantity ?? 0,
    currentShipment: variant.current_shipment_id ?? inventory.current_shipment_id ?? '',
  };
}

function buildProductFormData({ storeId, name, sku, description, price, categoryId, stock, imageFiles }) {
  const fd = new FormData();
  const resolvedStoreId = resolveProductStoreId(storeId);
  if (!resolvedStoreId) {
    throw new Error('لم يتم تحديد المتجر. يرجى تسجيل الدخول مرة أخرى.');
  }
  fd.append('store_id', String(resolvedStoreId));
  fd.append('name', String(name).trim());
  if (sku) fd.append('sku', String(sku).trim());
  if (description) fd.append('description', description);
  fd.append('base_price', String(normalizeProductPrice(price)));
  fd.append('category_id', String(categoryId));
  if (stock !== '' && stock != null) fd.append('total_quantity', String(stock));
  if (imageFiles?.length) {
    imageFiles.forEach((file, index) => fd.append(`images[${index}]`, file));
  }
  return fd;
}

function extractCreatedProduct(res) {
  const item = unwrapApiEntity(res);
  if (!item?.id) {
    throw new Error('تعذّر إنشاء المنتج: لم يُرجع الخادم معرف المنتج. تحقق من رسالة الخطأ أو أعد المحاولة.');
  }
  return mapProductFromDetails(item);
}

async function verifyCreatedProduct(productId) {
  try {
    const verified = await fetchProductDetails(productId);
    if (verified?.id) return verified;
  } catch {
    // fallback below
  }

  throw new Error(
    'تم إرسال الطلب لكن تعذّر التأكد من حفظ المنتج في الخادم. تحقق من قائمة المنتجات أو أعد المحاولة.',
  );
}

/**
 * POST /api/my-store/products
 */
export async function createProduct(payload) {
  clearCache('products_');
  const fd = buildProductFormData(payload);
  const res = await apiRequest(API_ENDPOINTS.myStoreProducts, {
    method: 'POST',
    body: fd,
  });
  const created = extractCreatedProduct(res);
  return verifyCreatedProduct(created.id);
}

/**
 * PUT /api/my-store/products/{id}
 * Laravel/PHP لا يقرأ الملفات في طلب PUT — نستخدم POST مع _method=PUT
 */
export async function updateProduct(id, payload) {
  clearCache('products_');
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
  clearCache('products_');
  const res = await apiRequest(API_ENDPOINTS.myStoreProductArchive(id), { method: 'POST' });
  const item = res?.data ?? res;
  return mapProductFromDetails(item);
}

/**
 * POST /api/my-store/products/{id}/restore
 */
export async function restoreProduct(id) {
  clearCache('products_');
  const res = await apiRequest(API_ENDPOINTS.myStoreProductRestore(id), { method: 'POST' });
  const item = res?.data ?? res;
  return mapProductFromDetails(item);
}

/**
 * GET /api/products/{productId} — استخراج التنوعات من تفاصيل المنتج [5.3]
 * GET قد يُرجع variants بدون attribute_values — نُكمل من الكتالوج والتخزين المحلي
 */
async function fetchMyStoreVariantMap(productId) {
  try {
    const res = await apiRequest(API_ENDPOINTS.myStoreProduct(productId));
    const item = unwrapApiEntity(res);
    const variants = extractProductVariants(item);
    return Object.fromEntries(variants.map((variant) => [String(variant.id), variant]));
  } catch {
    return {};
  }
}

function mergeVariantSources(publicVariant, storeVariant) {
  if (!storeVariant) return publicVariant;

  const hasPublicAttrs =
    (publicVariant.attribute_values?.length ?? 0) > 0 ||
    (publicVariant.attributes?.length ?? 0) > 0;
  const hasStoreAttrs =
    (storeVariant.attribute_values?.length ?? 0) > 0 ||
    (storeVariant.attributes?.length ?? 0) > 0;

  return {
    ...publicVariant,
    ...storeVariant,
    attribute_values: hasStoreAttrs
      ? storeVariant.attribute_values ?? storeVariant.attributes
      : publicVariant.attribute_values ?? publicVariant.attributes,
    attribute_value_ids:
      storeVariant.attribute_value_ids ??
      storeVariant.attributeValueIds ??
      publicVariant.attribute_value_ids ??
      publicVariant.attributeValueIds,
    total_quantity:
      publicVariant.total_quantity ??
      storeVariant.total_quantity ??
      storeVariant.quantity,
  };
}

export async function fetchProductVariants(
  productId,
  { catalogAttributes = [], inventoryByVariantId = {} } = {},
) {
  const [res, myStoreVariantMap] = await Promise.all([
    apiRequest(API_ENDPOINTS.product(productId)),
    fetchMyStoreVariantMap(productId),
  ]);
  const item = unwrapApiEntity(res);
  const rawVariants = extractProductVariants(item);
  const cache = readVariantSelectionsCache(productId);

  return rawVariants.map((v) => {
    const mergedVariant = mergeVariantSources(v, myStoreVariantMap[String(v.id)]);
    const cached = cache[String(v.id)] ?? findSelectionsInAnyProductCache(v.id);
    const globalLabel = readGlobalVariantLabels()[String(v.id)]?.label ?? null;
    const inventoryRow = inventoryByVariantId[String(v.id)];
    const inventoryAttrText =
      inventoryRow?.attributes && inventoryRow.attributes !== '—'
        ? inventoryRow.attributes
        : null;
    const inventoryAttrValues = inventoryRow?.attributeValues;
    const attributeText =
      inventoryAttrText ||
      (Array.isArray(inventoryAttrValues)
        ? inventoryAttrValues
            .map((entry) => entry?.value ?? entry?.name ?? entry)
            .filter(Boolean)
            .join(' / ')
        : typeof inventoryAttrValues === 'string'
          ? inventoryAttrValues
          : null);

    const cachedLabel =
      cached?.label ??
      globalLabel ??
      (productId && v.id ? getCachedVariantLabel(productId, v.id, catalogAttributes) : null);

    const mapped = mapProductVariant(mergedVariant, catalogAttributes, {
      selections: cached?.selections,
      attributeText,
      cachedLabel,
    });

    if (!cached?.selections && Object.keys(mapped.selections).length) {
      persistVariantSelections(productId, v.id, {
        selections: mapped.selections,
        attributeValueIds: mapped.attributeValueIds,
        label: mapped.label,
        catalogAttributes,
      });
    }

    return mapped;
  });
}

/**
 * DELETE /api/my-store/products/{productId}/variants/{variantId}
 */
export async function deleteProductVariant(productId, variantId) {
  const url = `${API_ENDPOINTS.myStoreProductVariants(productId)}/${variantId}`;
  await apiRequest(url, { method: 'DELETE' });
  removeVariantSelectionsCache(productId, variantId);
}

/**
 * GET /api/v1/admin/attributes — قائمة الخصائص للإدارة
 */
export async function fetchAdminAttributes(forceRefresh = false) {
  return staleWhileRevalidate('admin_attributes', async () => {
    const res = await apiRequest('/admin/attributes');
    return extractList(res).map((attr) => ({
      id: attr.id,
      name: attr.name,
      values: mapAttributeValues(attr),
    }));
  }, TTL.STATIC, forceRefresh);
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

