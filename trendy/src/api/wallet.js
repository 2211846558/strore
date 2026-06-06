import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';

/**
 * GET /api/wallet/balance
 */
export async function getWalletBalance() {
  const res = await apiRequest(API_ENDPOINTS.walletBalance);
  return res?.data ?? res;
}

/**
 * GET /api/wallet/logs
 */
export async function getWalletLogs() {
  const res = await apiRequest(API_ENDPOINTS.walletLogs);
  return res?.data ?? res ?? [];
}

/**
 * POST /api/stores/wallet/charge — body: { store_id, amount, payment_method_id }
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
