const GENERIC_VARIANT_LABEL = /^تنوع\s*#\d+$/i;
const PLACEHOLDER_VALUES = new Set(['—', 'واحد']);

function isMeaningfulValue(value) {
  if (value == null) return false;
  const text = String(value).trim();
  return text !== '' && !PLACEHOLDER_VALUES.has(text);
}

export function isWeakVariantAttrsLabel(label) {
  const text = String(label ?? '').trim();
  if (!text) return true;
  if (GENERIC_VARIANT_LABEL.test(text)) return true;
  if (/^\d+$/.test(text)) return true;
  return false;
}

export function isWeakVariantFullLabel(fullLabel, productName) {
  const name = String(productName ?? '').trim();
  const full = String(fullLabel ?? '').trim();
  if (!full) return true;
  if (GENERIC_VARIANT_LABEL.test(full)) return true;
  if (name && full.startsWith(`${name} — `)) {
    return isWeakVariantAttrsLabel(full.slice(name.length + 3).trim());
  }
  return isWeakVariantAttrsLabel(full);
}

export function extractAttributeValues(attrs) {
  if (!Array.isArray(attrs)) return [];
  return attrs
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (!entry || typeof entry !== 'object') return null;

      const candidates = [
        entry.value,
        entry.name,
        entry.label,
        entry.attribute_value?.value,
        entry.attribute_value?.name,
        entry.value?.value,
        entry.value?.name,
        entry.attribute?.value,
        entry.attribute?.name,
        entry.pivot?.value,
        entry.pivot?.name,
      ];

      return candidates.find(isMeaningfulValue) ?? null;
    })
    .filter(isMeaningfulValue);
}

export function extractVariantAttributeValues(source) {
  if (!source) return [];
  if (Array.isArray(source)) return extractAttributeValues(source);

  const fromArrays = extractAttributeValues(
    source.attribute_values
    ?? source.attributes
    ?? source.attributeValues
    ?? source.values
    ?? [],
  );
  if (fromArrays.length) return fromArrays;

  return [source.color, source.size].filter(isMeaningfulValue);
}

function extractSingleAttributeValue(entry) {
  if (typeof entry === 'string') return isMeaningfulValue(entry) ? entry : null;
  if (!entry || typeof entry !== 'object') return null;

  const candidates = [
    entry.value,
    entry.name,
    entry.label,
    entry.attribute_value?.value,
    entry.attribute_value?.name,
    entry.value?.value,
    entry.value?.name,
    entry.attribute?.value,
    entry.pivot?.value,
    entry.pivot?.name,
  ];

  return candidates.find(isMeaningfulValue) ?? null;
}

function extractSingleAttributeName(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const candidates = [
    entry.attribute_name,
    entry.attribute?.name,
    entry.attr_name,
    entry.attribute_label,
  ];

  return candidates.find(isMeaningfulValue) ?? null;
}

/**
 * يُعيد أزواج اسم الخاصية وقيمتها لعرض تفاصيل التنوع (مثل: اللون → أحمر).
 */
export function extractVariantAttributePairs(attrs, { variant } = {}) {
  const pairs = [];

  if (Array.isArray(attrs)) {
    attrs.forEach((entry) => {
      const value = extractSingleAttributeValue(entry);
      if (!isMeaningfulValue(value)) return;

      const name = extractSingleAttributeName(entry);
      pairs.push({
        name: name ? String(name).trim() : null,
        value: String(value).trim(),
      });
    });
  }

  if (!pairs.length && variant) {
    if (isMeaningfulValue(variant.color)) {
      pairs.push({ name: 'اللون', value: String(variant.color).trim() });
    }
    if (isMeaningfulValue(variant.size) && variant.size !== 'واحد') {
      pairs.push({ name: 'المقاس', value: String(variant.size).trim() });
    }
  }

  return pairs;
}

function normalizeExistingLabel(existingLabel, productName) {
  const label = String(existingLabel ?? '').trim();
  const name = String(productName ?? '').trim();

  if (!label || GENERIC_VARIANT_LABEL.test(label)) return '';
  if (name && label === name) return '';

  if (name && label.startsWith(`${name} — `)) {
    return label.slice(name.length + 3).trim();
  }

  return label;
}

/**
 * يُعيد وصف التنوع بقيم الخصائص فقط (لون، مقاس، ...) دون الاكتفاء باسم المنتج.
 */
export function buildVariantDisplayLabel(productName, attrs, { sku, variantId, existingLabel, variant } = {}) {
  const values = extractVariantAttributeValues(attrs ?? variant);
  const attrText = values.join(' / ');
  if (attrText) return attrText;

  const normalizedExisting = normalizeExistingLabel(existingLabel, productName);
  if (
    normalizedExisting
    && normalizedExisting !== String(productName ?? '').trim()
    && !isWeakVariantAttrsLabel(normalizedExisting)
  ) {
    return normalizedExisting;
  }

  if (sku && !isWeakVariantAttrsLabel(sku)) return String(sku);
  return '—';
}

/**
 * يُعيد اسم المنتج مع قيم خصائص التنوع لعرض أوضح في واجهة المبيعات.
 */
export function buildVariantFullLabel(productName, attrs, options = {}) {
  const name = String(productName ?? '').trim();
  const attrsLabel = typeof attrs === 'string'
    ? attrs.trim()
    : buildVariantDisplayLabel(name, attrs, options);

  if (name && attrsLabel && attrsLabel !== name) return `${name} — ${attrsLabel}`;
  if (attrsLabel) return attrsLabel;
  return name || '—';
}
