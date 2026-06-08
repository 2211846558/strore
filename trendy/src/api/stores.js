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
  entity_type: 'نوع الكيان',
  type: 'نوع المتجر',
  zone_id: 'المنطقة',
  google_map_url: 'رابط خريطة Google',
  commercial_register_number: 'رقم السجل التجاري',
  logo: 'لوقو المتجر',
  notes: 'ملاحظات',
  description: 'وصف المتجر',
  store_code: 'رقم المتجر',
  merchant_data: 'بيانات التاجر',
  otp: 'رمز التحقق',
};

const isLocalStoreType = (type) => type === 'محلي' || type === 'local';

/**
 * تحويل بيانات النموذج إلى FormData مطابق لـ StoreJoinRequest في Laravel
 */
export function buildStoreJoinFormData(form, logoFile) {
  const fd = new FormData();

  fd.append('user_name', form.managerName.trim());
  fd.append('email', form.managerEmail.trim());
  fd.append('user_phone', form.managerPhone.trim());
  fd.append('name', form.storeName.trim());
  fd.append('store_email', form.storeEmail.trim());
  fd.append('password', form.password);
  fd.append('phone', form.storePhone.trim());
  fd.append('entity_type', form.entityType);
  fd.append('type', form.storeType);

  if (form.entityType === 'company' && form.commercialReg?.trim()) {
    fd.append('commercial_register_number', form.commercialReg.trim());
  }

  if (form.description?.trim()) {
    fd.append('description', form.description.trim());
  }

  if (form.notes?.trim()) {
    fd.append('notes', form.notes.trim());
  }

  if (isLocalStoreType(form.storeType)) {
    fd.append('zone_id', String(Number(form.zoneId)));
    fd.append('google_map_url', form.googleMapUrl.trim());
  }

  if (logoFile) {
    fd.append('logo', logoFile);
  }

  return fd;
}

/**
 * POST /api/stores/join
 * إرسال طلب انضمام — يُرسل رمز التحقق (OTP) إلى إيميل المتجر
 */
export async function submitStoreJoinRequest(form, logoFile) {
  const body = buildStoreJoinFormData(form, logoFile);
  return apiRequest(API_ENDPOINTS.storesJoin, {
    method: 'POST',
    body,
    auth: false,
  });
}

/**
 * GET /api/zones — قائمة المناطق (للمتاجر المحلية)
 */
export async function fetchZones() {
  const res = await apiRequest(API_ENDPOINTS.zones, { auth: false });
  return res?.data ?? res ?? [];
}

const translateValidationMessage = (message, field) => {
  const label = FIELD_LABELS[field] || field;
  if (/required/i.test(message)) return `${label} مطلوب`;
  if (/required_if/i.test(message)) return `${label} مطلوب`;
  if (/email/i.test(message)) return `${label} غير صالح`;
  if (/min/i.test(message) && field === 'password') return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  if (/max/i.test(message) && field === 'notes') return 'الملاحظات يجب ألا تتجاوز 2000 حرف';
  if (/unique/i.test(message)) return `${label} مستخدم مسبقاً`;
  if (/size/i.test(message) && field === 'otp') return 'رمز التحقق يجب أن يكون 6 أرقام';
  if (/exists/i.test(message) && field === 'store_email') return 'لا يوجد طلب انضمام بهذا الإيميل';
  if (/in:/i.test(message) && field === 'type') return 'نوع المتجر غير صالح';
  if (/in:/i.test(message) && field === 'entity_type') return 'نوع الكيان غير صالح';
  if (/mimes/i.test(message) && field === 'logo') return 'صيغة اللوقو غير مدعومة (JPEG, PNG, WEBP فقط)';
  if (/max/i.test(message) && field === 'logo') return 'حجم اللوقo يجب ألا يتجاوز 2 ميغابايت';
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
    const msg = error.message.replace(/^\./, '').trim();
    if (/no api key provided/i.test(msg) || /Stripe::setApiKey/i.test(msg)) {
      return 'بوابة الدفع غير مهيّأة على الخادم. يرجى التواصل مع الدعم الفني.';
    }
    return msg;
  }
  return fallback;
}
