import { apiRequest } from './client';
import { API_ENDPOINTS, STORE_AUTH_ENDPOINTS } from './config';

const LOCAL_SUBSCRIPTION_KEY_PREFIX = 'trendy_plan_sub_';

const TOKEN_KEY = 'trendy_auth_token';
const USER_KEY = 'trendy_auth_user';
const STORE_ID_KEY = 'trendy_store_id';

export const AUTH_UNAUTHORIZED_EVENT = 'trendy:unauthorized';

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const getStoredStoreId = () => {
  const id = localStorage.getItem(STORE_ID_KEY);
  return id ? Number(id) : null;
};

export const getActiveStore = (user) => {
  if (!user) return null;
  if (user.store) return user.store;
  const owned = user.owned_stores || user.ownedStores || [];
  if (owned.length > 0) return owned[0];
  if (user.store_id) {
    return {
      id: user.store_id,
      status: user.store_status ?? 'inactive',
      plan_id: user.plan_id ?? null,
    };
  }
  return null;
};

/** يُرجع بيانات المتجر المطابقة لـ storeId (ملكية/توظيف) وليس المتجر الافتراضي فقط */
export function resolveStoreForUser(user, storeId = null) {
  if (!user) return null;

  const targetId = storeId != null ? Number(storeId) : null;
  if (targetId && !Number.isNaN(targetId) && targetId > 0) {
    const owned = user.owned_stores || user.ownedStores || [];
    const employed = user.employed_stores || user.employedStores || [];
    const fromList = [...owned, ...employed].find((entry) => Number(entry?.id) === targetId);
    if (fromList) {
      if (user.store && Number(user.store.id) === targetId) {
        return { ...fromList, ...user.store };
      }
      return fromList;
    }
    if (user.store && Number(user.store.id) === targetId) {
      return user.store;
    }
    if (Number(user.store_id) === targetId) {
      return (
        user.store ?? {
          id: targetId,
          status: user.store_status ?? 'inactive',
          plan_id: user.plan_id ?? null,
        }
      );
    }
  }

  return getActiveStore(user);
}

export function getUserRoleNames(user) {
  if (!user) return [];
  const roles = user.roles;
  if (!Array.isArray(roles)) return [];
  return roles
    .map((role) => (typeof role === 'string' ? role : role?.name))
    .filter(Boolean);
}

export function userHasRole(user, roleName) {
  return getUserRoleNames(user).includes(roleName);
}

export function userCanChargeStoreWallet(user) {
  if (!user) return false;
  if (userHasRole(user, 'store_manager') || userHasRole(user, 'super_admin')) return true;

  const owned = user.owned_stores || user.ownedStores || [];
  if (owned.length > 0) return true;

  const roles = getUserRoleNames(user);
  if (roles.length === 0) return true;

  return !roles.includes('store_staff');
}

function collectAccessibleStoreIds(user) {
  const owned = user?.owned_stores || user?.ownedStores || [];
  const employed = user?.employed_stores || user?.employedStores || [];
  const ids = [...owned, ...employed]
    .map((store) => Number(store?.id))
    .filter((id) => !Number.isNaN(id) && id > 0);

  return [...new Set(ids)];
}

/**
 * معرف المتجر النشط — مطابق لمنطق الباكند resolveActiveStoreId (ملكية + توظيف)
 */
export function resolveManagedStoreId(user, explicitStoreId = null) {
  if (!user) return getStoredStoreId();

  const accessibleIds = collectAccessibleStoreIds(user);
  const owned = user.owned_stores || user.ownedStores || [];
  const ownedIds = owned.map((store) => Number(store?.id)).filter((id) => !Number.isNaN(id) && id > 0);

  if (explicitStoreId != null && explicitStoreId !== '') {
    const id = Number(explicitStoreId);
    if (!Number.isNaN(id) && id > 0) {
      if (accessibleIds.length === 0 || accessibleIds.includes(id)) return id;
    }
  }

  if (ownedIds.length === 1) return ownedIds[0];

  const sessionStoreId = Number(user.store_id ?? getStoredStoreId());
  if (!Number.isNaN(sessionStoreId) && sessionStoreId > 0) {
    if (accessibleIds.length === 0 || accessibleIds.includes(sessionStoreId)) return sessionStoreId;
  }

  if (accessibleIds.length === 1) return accessibleIds[0];
  if (ownedIds.length > 0) return ownedIds[0];

  const activeStoreId = Number(getActiveStore(user)?.id);
  return !Number.isNaN(activeStoreId) && activeStoreId > 0 ? activeStoreId : null;
}

function mergeUserSession(freshUser) {
  const stored = getStoredUser();
  if (!stored) return freshUser;

  const owned =
    freshUser?.owned_stores ??
    freshUser?.ownedStores ??
    stored?.owned_stores ??
    stored?.ownedStores ??
    [];
  const employed =
    freshUser?.employed_stores ??
    freshUser?.employedStores ??
    stored?.employed_stores ??
    stored?.employedStores ??
    [];

  return {
    ...stored,
    ...freshUser,
    store_id: freshUser?.store_id ?? stored?.store_id ?? null,
    store: freshUser?.store ?? stored?.store ?? null,
    roles: freshUser?.roles ?? stored?.roles ?? [],
    owned_stores: owned,
    ownedStores: owned,
    employed_stores: employed,
    employedStores: employed,
  };
}

function parseApiDate(value) {
  if (!value) return null;
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readLocalSubscriptionDates(storeId) {
  if (!storeId) return { startsAt: null, endsAt: null };
  try {
    const raw = localStorage.getItem(`${LOCAL_SUBSCRIPTION_KEY_PREFIX}${storeId}`);
    if (!raw) return { startsAt: null, endsAt: null };
    const item = JSON.parse(raw);
    const startsAt = parseApiDate(item.starts_at);
    const endsAt = parseApiDate(item.ends_at);
    if (endsAt && endsAt.getTime() <= Date.now()) {
      clearLocalSubscriptionDates(storeId);
      return { startsAt: null, endsAt: null };
    }
    return { startsAt, endsAt };
  } catch {
    return { startsAt: null, endsAt: null };
  }
}

export function clearLocalSubscriptionDates(storeId) {
  if (!storeId) return;
  localStorage.removeItem(`${LOCAL_SUBSCRIPTION_KEY_PREFIX}${storeId}`);
}

export function isSubscriptionAccessBlockedError(error) {
  const msg = String(error?.message ?? error?.data?.message ?? '');
  return (
    error?.status === 403 &&
    /store_inactive_subscription|store_plan_inactive|plan.*expired|subscription.*expired|inactive subscription|يجب الاشتراك|انتهى.*اشتراك|الاشتراك.*منته/i.test(
      msg,
    )
  );
}

/**
 * يتحقق من نشاط خطة المتجر عبر GET /my-store/products (محمي بـ store_plan_active).
 * عند انتهاء الاشتراك يُرجع الباكند 403 — لا حاجة لتعديل الباكند.
 */
export async function verifyStorePlanActive(storeId) {
  if (!storeId) return { active: false, reason: 'no_store' };

  const query = new URLSearchParams({ per_page: '1', store_id: String(storeId) });

  try {
    await apiRequest(`${API_ENDPOINTS.myStoreProducts}?${query}`);
    return { active: true };
  } catch (err) {
    if (isSubscriptionAccessBlockedError(err)) {
      return { active: false, reason: 'subscription_expired' };
    }
    if (err?.status === 403) {
      return { active: false, reason: 'forbidden' };
    }
    return { active: null, error: err };
  }
}

export function extractStoreSubscriptionDates(store, storeId = null) {
  const resolvedStoreId = storeId ?? store?.id ?? null;

  let startsAt = parseApiDate(
    store?.subscription_starts_at ??
      store?.plan_starts_at ??
      store?.subscription?.starts_at ??
      store?.subscription?.start_date,
  );
  let endsAt = parseApiDate(
    store?.subscription_ends_at ??
      store?.plan_expires_at ??
      store?.subscription?.ends_at ??
      store?.subscription?.end_date ??
      store?.expires_at,
  );

  const pivot = store?.plan?.pivot ?? store?.subscription?.pivot ?? null;
  if (pivot) {
    startsAt = startsAt ?? parseApiDate(pivot.starts_at ?? pivot.start_date);
    endsAt = endsAt ?? parseApiDate(pivot.ends_at ?? pivot.end_date);
  }

  const status = String(store?.status ?? '').toLowerCase();
  if (status === 'inactive' || status === 'expired') {
    clearLocalSubscriptionDates(resolvedStoreId);
  } else {
    const local = readLocalSubscriptionDates(resolvedStoreId);
    startsAt = startsAt ?? local.startsAt;
    endsAt = endsAt ?? local.endsAt;
  }

  return { startsAt, endsAt };
}

export function storeSubscriptionExpired(store, storeId = null) {
  if (!store) return false;

  const planId = store.plan_id ?? store.plan?.id ?? store.subscription?.plan_id;
  const { startsAt, endsAt } = extractStoreSubscriptionDates(store, storeId);
  const now = Date.now();

  if (endsAt) return endsAt.getTime() <= now;
  if (startsAt && startsAt.getTime() > now) return false;

  const status = String(store.status ?? '').toLowerCase();
  return Boolean(planId) && (status === 'inactive' || status === 'expired');
}

export function storeHasActivePlan(store, storeId = null) {
  if (!store) return false;

  const status = String(store.status ?? '').toLowerCase();
  if (status === 'deactivated' || status === 'inactive' || status === 'expired') return false;

  const planId = store.plan_id ?? store.plan?.id ?? store.subscription?.plan_id;
  const { startsAt, endsAt } = extractStoreSubscriptionDates(store, storeId);
  const now = Date.now();

  if (endsAt) {
    if (endsAt.getTime() <= now) return false;
    if (startsAt && startsAt.getTime() > now) return false;
    return true;
  }

  if (startsAt && startsAt.getTime() > now) return false;
  if (!planId) return false;
  if (status === 'inactive' || status === 'expired') return false;

  return status === 'active';
}

export const persistAuthSession = ({ token, user }) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  const storeId = user.store_id || getActiveStore(user)?.id;
  if (storeId) {
    localStorage.setItem(STORE_ID_KEY, String(storeId));
  }
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(STORE_ID_KEY);
};

export function notifyUnauthorized() {
  clearAuthSession();
  window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
}

/**
 * POST /api/v1/auth/store/login
 * تسجيل دخول مدير المتجر
 */
export async function storeLogin({ email, password, storeCode }) {
  const res = await apiRequest(API_ENDPOINTS.storeLogin, {
    method: 'POST',
    body: {
      email,
      password,
      store_code: storeCode,
    },
  });

  const payload = res?.data ?? res;
  if (payload?.token && payload?.user) {
    persistAuthSession({ token: payload.token, user: payload.user });
  }

  return payload;
}

/**
 * POST /api/v1/auth/store/verify-join
 * التحقق من إيميل المتجر بعد تقديم طلب الانضمام
 * body: { store_email: string, otp: string }
 */
export async function verifyStoreJoin({ storeEmail, otp }) {
  return apiRequest(API_ENDPOINTS.storeVerifyJoin, {
    method: 'POST',
    body: {
      store_email: storeEmail,
      otp: String(otp),
    },
    auth: false,
  });
}

/**
 * POST /api/v1/auth/logout
 */
/**
 * طلبات استعادة كلمة المرور تحتاج جلسة Laravel (Session + Cookies).
 * في التطوير نمرّر عبر بروكسي Vite (/api) مع credentials.
 */
function getPasswordResetApiBase() {
  if (import.meta.env.DEV) return '/api';
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';
}

async function passwordResetRequest(path, { method = 'POST', body } = {}) {
  const base = getPasswordResetApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => {
    const error = new Error(
      'تعذّر الاتصال بالخادم. تأكد من تشغيل الباكند وأن عنوان API صحيح في ملف .env',
    );
    error.isNetworkError = true;
    throw error;
  });

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text ? { message: text } : null;
  }

  if (!response.ok) {
    const error = new Error(data?.message || 'حدث خطأ أثناء معالجة الطلب');
    error.status = response.status;
    error.errors = data?.errors || null;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * POST /api/v1/auth/password/forgot
 */
export async function forgotPassword({ email }) {
  return passwordResetRequest(STORE_AUTH_ENDPOINTS.passwordForgot, {
    body: { email: email.trim() },
  });
}

/**
 * POST /api/v1/auth/password/verify-otp
 */
export async function verifyPasswordOtp({ email, otp }) {
  return passwordResetRequest(STORE_AUTH_ENDPOINTS.passwordVerifyOtp, {
    body: { email: email.trim(), otp: String(otp) },
  });
}

/**
 * POST /api/v1/auth/password/reset
 */
export async function resetPassword({ email, otp, password, passwordConfirmation }) {
  return passwordResetRequest(STORE_AUTH_ENDPOINTS.passwordReset, {
    body: {
      email: email.trim(),
      otp: String(otp),
      password,
      password_confirmation: passwordConfirmation ?? password,
    },
  });
}

/**
 * GET /api/user — بيانات المستخدم الحالي (للتحقق من التوكن وتحديث الجلسة)
 */
export async function fetchCurrentUser() {
  const res = await apiRequest(API_ENDPOINTS.currentUser);
  const freshUser = res?.data ?? res;
  return mergeUserSession(freshUser);
}

export async function storeLogout() {
  const token = getAuthToken();
  if (token) {
    try {
      await apiRequest(API_ENDPOINTS.logout, { method: 'POST' });
    } catch {
      // تجاهل — سيتم مسح الجلسة محلياً
    }
  }
  clearAuthSession();
}
