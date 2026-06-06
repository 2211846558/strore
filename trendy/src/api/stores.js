import { API_ENDPOINTS } from './config';
import { apiRequest } from './client';

const FIELD_LABELS = {
  user_name: 'اسم مدير المتجر',
  email: 'إيميل مدير المتجر',
  user_phone: 'رقم هاتف مدير المتجر',
  name: 'اسم المتجر',
  store_email: 'إيميل المتجر',
  password: 'كلمة المرور',
  phone: 'رقم هاتف المتجر',
  type: 'نوع المتجر',
  zone_id: 'المنطقة',
  google_map_url: 'رابط خريطة Google',
  commercial_register_number: 'رقم السجل التجاري',
  logo: 'لوقو المتجر',
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const isLocalStoreType = (type) => type === 'محلي' || type === 'local';

/**
 * تحويل بيانات النموذج إلى payload مطابق لـ StoreJoinRequest في Laravel
 */
export async function buildStoreJoinPayload(form, logoFile) {
  const payload = {
    user_name: form.managerName.trim(),
    email: form.managerEmail.trim(),
    user_phone: form.managerPhone.trim(),
    name: form.storeName.trim(),
    store_email: form.storeEmail.trim(),
    password: form.password,
    phone: form.storePhone.trim(),
    type: form.storeType,
  };

  if (form.commercialReg?.trim()) {
    payload.commercial_register_number = form.commercialReg.trim();
  }
  if (form.description?.trim()) {
    payload.description = form.description.trim();
  }
  if (form.notes?.trim()) {
    payload.notes = form.notes.trim();
  }
  if (logoFile) {
    payload.logo = await fileToBase64(logoFile);
  }

  if (isLocalStoreType(form.storeType)) {
    payload.zone_id = Number(form.zoneId);
    payload.google_map_url = form.googleMapUrl.trim();
  }

  return payload;
}

/**
 * POST /api/stores/join
 */
export async function submitStoreJoinRequest(form, logoFile) {
  const body = await buildStoreJoinPayload(form, logoFile);
  return apiRequest(API_ENDPOINTS.storesJoin, {
    method: 'POST',
    body,
  });
}

/**
 * GET /api/zones — قائمة المناطق (للمتاجر المحلية)
 */
export async function fetchZones() {
  const res = await apiRequest('/zones');
  return res?.data ?? res ?? [];
}

const translateValidationMessage = (message, field) => {
  const label = FIELD_LABELS[field] || field;
  if (/required/i.test(message)) return `${label} مطلوب`;
  if (/email/i.test(message)) return `${label} غير صالح`;
  if (/min/i.test(message) && field === 'password') return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  if (/unique/i.test(message)) return `${label} مستخدم مسبقاً`;
  if (/in:/i.test(message) && field === 'type') return 'نوع المتجر غير صالح';
  return message.replace(/^\./, '').trim();
};

/**
 * PUT /api/admin/stores/{store} — تعديل بيانات المتجر (مدير المتجر)
 */
export async function updateStore(storeId, payload) {
  return apiRequest(API_ENDPOINTS.updateStore(storeId), {
    method: 'PUT',
    body: payload,
  });
}

export async function buildStoreUpdatePayload(formData) {
  const payload = {};

  if (formData.name?.trim()) payload.name = formData.name.trim();
  if (formData.description !== undefined) payload.description = formData.description?.trim() || null;
  if (formData.phone?.trim()) payload.phone = formData.phone.trim();
  if (formData.location?.trim()) payload.google_map_url = formData.location.trim();
  if (formData.image && String(formData.image).startsWith('data:')) {
    payload.logo = formData.image;
  }

  return payload;
}

export function getApiErrorMessage(error, fallback = 'تعذّر إرسال الطلب، حاول مرة أخرى') {
  if (error?.errors && typeof error.errors === 'object') {
    const entries = Object.entries(error.errors);
    if (entries.length > 0) {
      const [field, messages] = entries[0];
      const msg = Array.isArray(messages) ? messages[0] : messages;
      return translateValidationMessage(String(msg), field);
    }
  }
  if (error?.message) {
    return error.message.replace(/^\./, '').trim();
  }
  return fallback;
}
