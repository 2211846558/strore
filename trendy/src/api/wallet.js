import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { extractListFromResponse } from './finance';

/**
 * GET /api/wallet/balance
 */
export async function getWalletBalance() {
  const res = await apiRequest(API_ENDPOINTS.walletBalance);
  return res?.data ?? res;
}

/**
 * GET /api/wallet/logs — محفظة المستخدم (للعملاء/السائقين)
 * لمدير المتجر استخدم fetchAllTransactions من finance.js
 */
export async function getWalletLogs({ perPage = 50, page = 1 } = {}) {
  const query = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
  });
  const res = await apiRequest(`${API_ENDPOINTS.walletLogs}?${query}`);
  return extractListFromResponse(res);
}

/**
 * POST /api/stores/wallet/charge — api.md
 * body: { store_id, amount, payment_method_id }
 * payment_method_id: معرّف Stripe (مثل pm_card_visa)
 */
export async function chargeStoreWallet({ storeId, amount, paymentMethodId }) {
  return apiRequest(API_ENDPOINTS.storeWalletCharge, {
    method: 'POST',
    body: {
      store_id: storeId,
      amount: Number(amount),
      payment_method_id: paymentMethodId,
    },
  });
}

/**
 * POST /api/stores/wallet/withdraw — body: { amount, payment_method_id }
 */
export async function withdrawStoreWallet({ amount, paymentMethodId }) {
  return apiRequest(API_ENDPOINTS.storeWalletWithdraw, {
    method: 'POST',
    body: {
      amount: Number(amount),
      payment_method_id: paymentMethodId,
    },
  });
}
