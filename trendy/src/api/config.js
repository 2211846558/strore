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
  campaigns: '/campaigns',
  catalogCategories: '/catalog/categories',
  catalogAttributes: '/catalog/attributes',
  myStoreProducts: '/my-store/products',
  myStoreProduct: (id) => `/my-store/products/${id}`,
  myStoreProductVariants: (productId) => `/my-store/products/${productId}/variants`,
  myStoreProductArchive: (id) => `/my-store/products/${id}/archive`,
  myStoreProductRestore: (id) => `/my-store/products/${id}/restore`,
  product: (id) => `/products/${id}`,
  storeSubscribe: '/stores/subscribe',
  storePlanRenew: (storeId) => `/stores/${storeId}/renew`,
  storePlanChange: (storeId, planId) => `/stores/${storeId}/change-plan/${planId}`,
  storeShow: (storeId) => `/stores/${storeId}`,
  storeCampaignSubscribe: (storeId) => `/stores/${storeId}/campaigns/subscribe`,
  storeWalletCharge: '/stores/wallet/charge',
  storeWalletWithdraw: '/stores/wallet/withdraw',
  walletBalance: '/wallet/balance',
  walletLogs: '/wallet/logs',
  custodySummary: '/stores/custody/summary',
  custodyLogs: '/stores/custody/logs',
  updateStore: (storeId) => `/admin/stores/${storeId}`,
};
