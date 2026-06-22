import { apiRequest } from './client';
import { API_ENDPOINTS, STORE_AUTH_ENDPOINTS } from './config';

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

/**
 * معرف المتجر الذي يملكه مدير المتجر — مطابق لمنطق الباكند resolveManagedStoreId
 */
export function resolveManagedStoreId(user, explicitStoreId = null) {
  if (!user) return getStoredStoreId();

  const owned = user.owned_stores || user.ownedStores || [];
  const ownedIds = owned.map((store) => Number(store?.id)).filter((id) => !Number.isNaN(id) && id > 0);

  if (explicitStoreId != null && explicitStoreId !== '') {
    const id = Number(explicitStoreId);
    if (!Number.isNaN(id) && id > 0) {
      if (ownedIds.length === 0 || ownedIds.includes(id)) return id;
    }
  }

  if (ownedIds.length === 1) return ownedIds[0];

  const sessionStoreId = Number(user.store_id ?? getStoredStoreId());
  if (!Number.isNaN(sessionStoreId) && sessionStoreId > 0) {
    if (ownedIds.length === 0 || ownedIds.includes(sessionStoreId)) return sessionStoreId;
  }

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

  return {
    ...stored,
    ...freshUser,
    store_id: freshUser?.store_id ?? stored?.store_id ?? null,
    store: freshUser?.store ?? stored?.store ?? null,
    roles: freshUser?.roles ?? stored?.roles ?? [],
    owned_stores: owned,
    ownedStores: owned,
  };
}

export function storeHasActivePlan(store) {
  if (!store) return false;
  if (store.status === 'active') return true;

  const planId = store.plan_id ?? store.plan?.id ?? store.subscription?.plan_id;
  if (!planId) return false;

  const endRaw =
    store.subscription_ends_at ??
    store.plan_expires_at ??
    store.subscription?.ends_at ??
    store.subscription?.end_date ??
    null;

  if (endRaw) return new Date(endRaw).getTime() > Date.now();

  return store.status !== 'inactive';
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
