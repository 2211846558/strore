import { API_ENDPOINTS } from './config';
import { apiRequest } from './client';


const FIELD_LABELS = {
  user_name: 'اسم مدير المتجر',
  email: 'إيميل مدير المتجر',
  user_phone: 'رقم هاتف مدير المتجر',
  name: 'اسم المتجر',
  store_email: 'إيميل المتجر',
  password: 'كلمة المرور',
  phone: 'رقم الهاتف',
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
  batch_number: 'رقم الدفعة',
  selling_price: 'سعر البيع',
  unit_cost: 'سعر التكلفة',
  base_price: 'السعر',
  category_id: 'التصنيف',
  sku: 'رمز SKU',
  total_quantity: 'الكمية',
  start_at: 'تاريخ البداية',
  end_at: 'تاريخ النهاية',
  job_title: 'المسمى الوظيفي',
  status: 'حالة الطلب',
  reason: 'سبب الإلغاء',
  cancellation_reason: 'سبب الإلغاء',
  message: 'الرسالة',
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

  if (form.zoneId) {
    fd.append('zone_id', String(Number(form.zoneId)));
  }
  if (form.googleMapUrl) {
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
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

const translateValidationMessage = (message, field) => {
  const label = FIELD_LABELS[field] || field;
  if (/required/i.test(message)) return `${label} مطلوب`;
  if (/required_if/i.test(message)) return `${label} مطلوب`;
  if (/email/i.test(message)) return `${label} غير صالح`;
  if (/min/i.test(message) && field === 'password') return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  if (/max/i.test(message) && field === 'notes') return 'الملاحظات يجب ألا تتجاوز 2000 حرف';
  if (/unique/i.test(message)) return `${label} مستخدم مسبقاً`;
  if (/after_or_equal|after or equal.*now/i.test(message)) {
    return `${label} يجب أن يكون اليوم أو تاريخاً لاحقاً`;
  }
  if (/after.*start_at|after:start_at/i.test(message) && field === 'end_at') {
    return 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية';
  }
  if (/size/i.test(message) && field === 'otp') return 'رمز التحقق يجب أن يكون 6 أرقام';
  if (/exists/i.test(message) && field === 'store_email') return 'لا يوجد طلب انضمام بهذا الإيميل';
  if (/in:/i.test(message) && field === 'type') return 'نوع المتجر غير صالح';
  if (/in:/i.test(message) && field === 'entity_type') return 'نوع الكيان غير صالح';
  if (/mimes/i.test(message) && field === 'logo') return 'صيغة اللوقو غير مدعومة (JPEG, PNG, WEBP فقط)';
  if (/max/i.test(message) && field === 'logo') return 'حجم اللوقo يجب ألا يتجاوز 2 ميغابايت';
  if (/must be an image/i.test(message) && field === 'logo') {
    return 'يجب رفع صورة بصيغة مدعومة (JPEG, PNG, WEBP)';
  }
  return message.replace(/^\./, '').trim();
};

/**
 * PUT /api/admin/stores/{store} — تعديل بيانات المتجر (مدير المتجر)
 */
export async function updateStore(storeId, payload) {
  const isFormData = payload instanceof FormData;
  return apiRequest(API_ENDPOINTS.updateStore(storeId), {
    method: isFormData ? 'POST' : 'PUT',
    body: payload,
  });
}

/**
 * بناء FormData لتحديث المتجر — اللوقو يُرسل كملف صورة وليس base64
 */
export function buildStoreUpdateFormData(formData, logoFile) {
  const fd = new FormData();
  fd.append('_method', 'PUT');

  if (formData.name?.trim()) fd.append('name', formData.name.trim());
  if (formData.description !== undefined) {
    fd.append('description', formData.description?.trim() || '');
  }
  if (formData.phone?.trim()) fd.append('phone', formData.phone.trim());
  if (formData.type) fd.append('type', formData.type);

  if (formData.merchantData && typeof formData.merchantData === 'object') {
    if (formData.merchantData.tax_number !== undefined) {
      fd.append('merchant_data[tax_number]', formData.merchantData.tax_number?.trim() || '');
    }
    if (formData.merchantData.commercial_register !== undefined) {
      fd.append('merchant_data[commercial_register]', formData.merchantData.commercial_register?.trim() || '');
    }
  }

  if (formData.zoneId) {
    fd.append('zone_id', String(Number(formData.zoneId)));
  }
  if (formData.googleMapUrl !== undefined) {
    fd.append('google_map_url', formData.googleMapUrl?.trim() || '');
  }

  if (logoFile instanceof File) fd.append('logo', logoFile);

  return fd;
}

/**
 * استخراج إيميل المتجر — الـ API العام لا يُرجع store_email دائماً
 */
export function resolveStoreEmail(store, user = null) {
  const candidates = [
    store?.store_email,
    store?.email,
    store?.contact_email,
    user?.store_email,
    user?.store?.store_email,
    user?.store?.email,
    user?.email,
  ];

  for (const value of candidates) {
    if (value && String(value).trim()) return String(value).trim();
  }

  const owned = user?.owned_stores || user?.ownedStores || [];
  const match = owned.find((s) => s.id === store?.id);
  if (match?.store_email) return match.store_email;
  if (match?.email) return match.email;

  return '';
}

export const STORE_STATUS_LABELS = {
  active: 'نشط',
  inactive: 'معطل',
  deactivated: 'معطل',
  pending: 'قيد المراجعة',
};

export function isStoreActiveStatus(statusRaw) {
  return statusRaw === 'active';
}

/**
 * توحيد حالة المتجر (active | inactive | pending)
 */
export function normalizeStoreStatus(raw) {
  if (raw == null || raw === '') return 'inactive';
  if (typeof raw === 'boolean') return raw ? 'active' : 'inactive';
  if (typeof raw === 'number') return raw > 0 ? 'active' : 'inactive';

  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'active' || normalized === 'نشط') return 'active';
  if (
    normalized === 'inactive'
    || normalized === 'deactivated'
    || normalized === 'غير نشط'
    || normalized === 'معطل'
  ) {
    return 'inactive';
  }
  if (normalized === 'pending' || normalized === 'قيد المراجعة') return 'pending';

  return normalized;
}

/**
 * استخراج حالة المتجر من الجلسة أو owned_stores عند غيابها في استجابة الـ API
 */
export function resolveStoreStatus(store, user = null, storeId = null) {
  const id = storeId ?? store?.id;
  let status = store?.status ?? store?.store_status;

  if ((status == null || status === '') && user && id != null) {
    const owned = user.owned_stores || user.ownedStores || [];
    const match = owned.find((entry) => Number(entry?.id) === Number(id));
    if (match?.status != null && match.status !== '') status = match.status;
  }

  if ((status == null || status === '') && user?.store && Number(user.store.id) === Number(id)) {
    status = user.store.status;
  }

  if ((status == null || status === '') && user?.store_status) {
    status = user.store_status;
  }

  return normalizeStoreStatus(status);
}

export function getStoreStatusLabel(statusRaw) {
  return STORE_STATUS_LABELS[statusRaw] ?? statusRaw ?? '—';
}

/**
 * دمج بيانات المتجر من API مع الجلسة دون فقدان الحقول الناقصة في الاستجابة
 */
export function mergeStoreProfile(apiStore, sessionStore, user = null) {
  const id = apiStore?.id ?? sessionStore?.id;
  const apiStatus = apiStore?.status;
  const hasApiStatus = apiStatus != null && String(apiStatus).trim() !== '';
  const merged = {
    ...sessionStore,
    ...apiStore,
    status: hasApiStatus ? apiStatus : sessionStore?.status,
    plan_id: apiStore?.plan_id ?? sessionStore?.plan_id,
    subscription_starts_at:
      apiStore?.subscription_starts_at ??
      apiStore?.plan_starts_at ??
      sessionStore?.subscription_starts_at ??
      sessionStore?.plan_starts_at,
    subscription_ends_at:
      apiStore?.subscription_ends_at ??
      apiStore?.plan_expires_at ??
      sessionStore?.subscription_ends_at ??
      sessionStore?.plan_expires_at,
    plan: apiStore?.plan ?? sessionStore?.plan,
  };
  const status = resolveStoreStatus(merged, hasApiStatus ? null : user, id);

  return {
    ...merged,
    status,
    store_email: resolveStoreEmail(apiStore, user) || resolveStoreEmail(sessionStore, user),
    email: resolveStoreEmail(apiStore, user) || resolveStoreEmail(sessionStore, user),
  };
}

/**
 * GET /api/stores/{store}
 */
export async function fetchStore(storeId) {
  const res = await apiRequest(API_ENDPOINTS.storeShow(storeId));
  return res?.data ?? res;
}

/**
 * GET /api/my-store — ملف المتجر للمدير/الموظف (status الحقيقي حتى لو معطّل)
 */
export async function fetchManagedStoreProfile(storeId = null) {
  const query = storeId ? `?store_id=${encodeURIComponent(String(storeId))}` : '';
  const res = await apiRequest(`${API_ENDPOINTS.myStoreProfile}${query}`);
  return res?.data ?? res;
}

/**
 * جلب ملف المتجر — يفضّل /my-store ثم المسار العام للزبائن
 */
export async function fetchStoreProfile(storeId, sessionStore = null, user = null) {
  try {
    const apiStore = await fetchManagedStoreProfile(storeId);
    return mergeStoreProfile(apiStore, sessionStore, user);
  } catch (managedErr) {
    try {
      const apiStore = await fetchStore(storeId);
      return mergeStoreProfile(apiStore, sessionStore, user);
    } catch (publicErr) {
      if ((managedErr?.status === 404 || publicErr?.status === 404) && sessionStore) {
        return mergeStoreProfile(sessionStore, sessionStore, user);
      }
      throw managedErr;
    }
  }
}

/**
 * GET /api/stores/{storeId}/ratings
 */
export async function fetchStoreRatings(storeId) {
  const res = await apiRequest(API_ENDPOINTS.storeRatings(storeId), { auth: false });
  const data = res?.data ?? res;
  const average = Number(data?.average_rating ?? data?.average ?? 0);
  return {
    average: Number.isNaN(average) ? 0 : average,
    total: Number(data?.total_ratings ?? data?.total ?? 0),
  };
}

export function getApiErrorMessage(error, fallback = 'تعذّر إرسال الطلب، حاول مرة أخرى') {
  if (error?.isNetworkError) {
    return 'تعذّر الاتصال بالخادم. تأكد من تشغيل الباكند على المنفذ 8000 ثم حدّث الصفحة.';
  }
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
    if (error?.isUnauthorized || /unauthenticated/i.test(msg) || /bearer token/i.test(msg)) {
      return 'انتهت جلستك. يرجى تسجيل الدخول مرة أخرى.';
    }
    if (error?.status === 403 || /insufficient permissions|forbidden|does not have the right roles/i.test(msg)) {
      if (/wallet|charge|recharge|withdraw|محفظة|شحن|سحب/i.test(msg)) {
        return 'شحن المحفظة متاح لمدير المتجر فقط. سجّل الخروج ثم ادخل بحساب المدير (ليس حساب الموظف).';
      }
      if (/employee|موظف/i.test(msg)) {
        return 'إدارة الموظفين متاحة لمدير المتجر فقط. سجّل الدخول بحساب المدير.';
      }
      return 'ليس لديك صلاحية لتنفيذ هذا الإجراء. يتطلب حساب مدير المتجر.';
    }
    if (/store_inactive_subscription|يجب الاشتراك في خطة أولاً/i.test(msg)) {
      return 'يجب الاشتراك في خطة نشطة قبل إضافة المنتجات.';
    }
    if (/name.*unique|اسم المنتج موجود/i.test(msg)) {
      return 'اسم المنتج موجود مسبقاً في متجرك. اختر اسماً آخر.';
    }
    if (/no such paymentmethod/i.test(msg)) {
      return 'طريقة الدفع غير صالحة. استخدم بطاقة بنكية عبر Stripe (ليس سداد).';
    }
    if (/no api key provided/i.test(msg) || /Stripe::setApiKey/i.test(msg)) {
      return 'بوابة الدفع غير مهيّأة على الخادم. يرجى التواصل مع الدعم الفني.';
    }
    if (/Unknown column ['"]?sku['"]?/i.test(msg) || /column not found.*sku/i.test(msg)) {
      return 'تعذّر حفظ المنتج: قاعدة البيانات تحتاج تحديث. شغّل php artisan migrate على الباكند ثم أعد المحاولة.';
    }
    if (/sku.*unique|unique.*sku/i.test(msg) || /sku مستخدم/i.test(msg)) {
      return 'رمز SKU مستخدم مسبقاً. اختر رمزاً آخر.';
    }
    if (/OrderController::show/i.test(msg) || /must be of type int, string given/i.test(msg)) {
      return 'تعذّر تحميل المحادثات. حاول مرة أخرى.';
    }
    if (/undefined relationship.*Rating/i.test(msg) || /Call to undefined relationship \[user\] on model \[App\\Models\\Rating\]/i.test(msg)) {
      return 'تعذّر تحميل بيانات المنتج بسبب خطأ في الخادم. حاول مرة أخرى لاحقاً.';
    }
    if (/undefined method/i.test(msg) || /App\\Models/i.test(msg)) {
      return 'تعذّر تنفيذ الطلب حالياً بسبب مشكلة في الخادم. حاول مرة أخرى بعد قليل.';
    }
    if (/App\\Http\\Controllers/i.test(msg) || /vendor\\laravel/i.test(msg)) {
      return 'تعذّر تنفيذ الطلب حالياً بسبب مشكلة في الخادم. حاول مرة أخرى بعد قليل.';
    }
    return msg;
  }
  return fallback;
}
