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
  batch_number: 'رقم الدفعة',
  selling_price: 'سعر البيع',
  unit_cost: 'سعر التكلفة',
  role_id: 'الدور الوظيفي',
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
  if (formData.email?.trim()) fd.append('store_email', formData.email.trim());
  if (formData.zoneId) fd.append('zone_id', String(Number(formData.zoneId)));
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

/**
 * دمج بيانات المتجر من API مع الجلسة دون فقدان الحقول الناقصة في الاستجابة
 */
export function mergeStoreProfile(apiStore, sessionStore, user = null) {
  const base = { ...sessionStore, ...apiStore };
  return {
    ...base,
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

<<<<<<< HEAD
=======
function isTechnicalErrorMessage(message) {
  if (!message || typeof message !== 'string') return false;
  return /SQLSTATE|(?:^|\s)SQL:|Connection:\s*mysql|Host:\s*127\.0\.0\.1|Database:|PDOException|QueryException|Illuminate\\Database|vendor[/\\]laravel|App\\(?:Http|Models)|actively refused|ECONNREFUSED|could not (?:find driver|connect)|Access denied for user|Unknown column|Table .* doesn't exist|must be of type|Call to undefined|Undefined array key|stack trace/i.test(
    message,
  );
}

function getFriendlyDatabaseError(message, fallback) {
  if (
    /SQLSTATE\[HY000\]\s*\[2002\]|actively refused|Connection refused|ECONNREFUSED|No connection could be made/i.test(
      message,
    )
  ) {
    return 'تعذّر الاتصال بقاعدة البيانات. تأكد من تشغيل خادم MySQL ثم أعد المحاولة.';
  }
  if (/SQLSTATE|Connection:\s*mysql|Illuminate\\Database|QueryException|PDOException/i.test(message)) {
    return fallback || 'تعذّر تنفيذ الطلب حالياً بسبب مشكلة في قاعدة البيانات. حاول مرة أخرى لاحقاً.';
  }
  return null;
}

const LOGIN_CREDENTIALS_ERROR =
  'تحقق من رقم كود المتجر او البريد الالكتروني او كلمة المرور واعد المحاولة مجددا';

const LOGIN_CREDENTIAL_PATTERNS = [
  /selected store code is invalid/i,
  /credentials do not match/i,
  /invalid credentials/i,
  /these credentials/i,
  /wrong password/i,
  /incorrect password/i,
  /authentication failed/i,
];

function isLoginCredentialFailure(error) {
  const message = String(error?.message ?? '');
  if (LOGIN_CREDENTIAL_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }

  if (error?.status === 401 && !/bearer token/i.test(message)) {
    return true;
  }

  if (!error?.errors || typeof error.errors !== 'object') {
    return false;
  }

  const loginFields = ['store_code', 'email', 'password'];
  return Object.entries(error.errors).some(([field, messages]) => {
    if (!loginFields.includes(field)) return false;
    const msg = Array.isArray(messages) ? messages.join(' ') : String(messages);
    if (/required/i.test(msg)) return false;
    return (
      LOGIN_CREDENTIAL_PATTERNS.some((pattern) => pattern.test(msg))
      || (field === 'store_code' && /invalid|exists|selected/i.test(msg))
      || ((field === 'email' || field === 'password') && /invalid|incorrect|match|failed/i.test(msg))
    );
  });
}

export function getLoginErrorMessage(error) {
  if (error?.isNetworkError) {
    return getApiErrorMessage(error);
  }
  if (isLoginCredentialFailure(error)) {
    return LOGIN_CREDENTIALS_ERROR;
  }
  return getApiErrorMessage(error, LOGIN_CREDENTIALS_ERROR);
}

>>>>>>> fc1b287ebcd02fd7687499fcd16b6b5e92013e88
export function getApiErrorMessage(error, fallback = 'تعذّر إرسال الطلب، حاول مرة أخرى') {
  if (error?.isNetworkError) {
    return 'تعذّر الاتصال بالخادم. شغّل الباكند (php artisan serve) وتأكد أن VITE_API_BASE_URL=http://localhost:8000/api في ملف .env';
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
    if (error?.status === 403 || /insufficient permissions/i.test(msg)) {
      return 'شحن المحفظة متاح لمدير المتجر فقط. سجّل الخروج ثم ادخل بحساب المدير (ليس حساب الموظف).';
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
    if (/undefined method/i.test(msg) || /App\\Models/i.test(msg)) {
      return 'تعذّر تحميل المحادثات بسبب خطأ في الخادم. حاول مرة أخرى لاحقاً.';
    }
    if (/App\\Http\\Controllers/i.test(msg) || /vendor\\laravel/i.test(msg)) {
      return 'حدث خطأ في الخادم. حاول مرة أخرى لاحقاً.';
    }
    return msg;
  }
  return fallback;
}
