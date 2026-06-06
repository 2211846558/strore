/**
 * عنوان الـ API الأساسي — يُعرَّف في .env كـ VITE_API_BASE_URL
 * مثال: http://localhost:8000/api
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';

export const API_ENDPOINTS = {
  storesJoin: '/stores/join',
  storeLogin: '/v1/auth/store/login',
  logout: '/v1/auth/logout',
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
