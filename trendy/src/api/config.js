/**
 * عنوان الـ API الأساسي — يُعرَّف في .env كـ VITE_API_BASE_URL
 * مثال: http://localhost:8000/api
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';

/** مسارات تطبيق المتاجر — Route::prefix('v1/auth') */
export const STORE_AUTH_ENDPOINTS = {
  login: '/v1/auth/store/login',
  verifyJoin: '/v1/auth/store/verify-join',
  logout: '/v1/auth/logout',
};

export const API_ENDPOINTS = {
  // POST /api/stores/join — تقديم طلب انضمام وإرسال رمز OTP لإيميل المتجر
  storesJoin: '/stores/join',
  // GET /api/zones — قائمة المناطق
  zones: '/zones',
  storeLogin: STORE_AUTH_ENDPOINTS.login,
  storeVerifyJoin: STORE_AUTH_ENDPOINTS.verifyJoin,
  logout: STORE_AUTH_ENDPOINTS.logout,
  plans: '/plans',
  storeSubscribe: '/stores/subscribe',
  storeWalletCharge: '/stores/wallet/charge',
  storeWalletWithdraw: '/stores/wallet/withdraw',
  walletBalance: '/wallet/balance',
  walletLogs: '/wallet/logs',
  custodySummary: '/stores/custody/summary',
  custodyLogs: '/stores/custody/logs',
  updateStore: (storeId) => `/admin/stores/${storeId}`,
};
