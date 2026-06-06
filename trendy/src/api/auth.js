import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';

const TOKEN_KEY = 'trendy_auth_token';
const USER_KEY = 'trendy_auth_user';
const STORE_ID_KEY = 'trendy_store_id';

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
  const owned = user.owned_stores || user.ownedStores || [];
  if (owned.length > 0) return owned[0];
  return user.store || null;
};

export const persistAuthSession = ({ token, user }) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  const store = getActiveStore(user);
  if (store?.id) {
    localStorage.setItem(STORE_ID_KEY, String(store.id));
  }
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(STORE_ID_KEY);
};

/**
 * POST /api/v1/auth/store/login
 */
export async function storeLogin({ email, password }) {
  const res = await apiRequest(API_ENDPOINTS.storeLogin, {
    method: 'POST',
    body: { email, password },
  });

  const payload = res?.data ?? res;
  if (payload?.token && payload?.user) {
    persistAuthSession({ token: payload.token, user: payload.user });
  }

  return payload;
}

/**
 * POST /api/v1/auth/logout
 */
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
