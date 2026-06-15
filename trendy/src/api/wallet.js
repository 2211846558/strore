import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { extractListFromResponse } from './finance';
import { staleWhileRevalidate, TTL, clearCache } from './cache';
import {
  fetchCurrentUser,
  getStoredUser,
  persistAuthSession,
  getAuthToken,
  resolveManagedStoreId,
  userCanChargeStoreWallet,
} from './auth';

/**
 * GET /api/wallet/balance
 */
export async function getWalletBalance(forceRefresh = false) {
  return staleWhileRevalidate('wallet', async () => {
    const res = await apiRequest(API_ENDPOINTS.walletBalance);
    return res?.data ?? res;
  }, TTL.DYNAMIC, forceRefresh);
}

export async function getStoreWalletBalance({ storeId } = {}) {
  const res = await getWalletBalance().catch(() => ({}));
  const data = res?.data ?? res ?? {};
  const balance = Number(data.balance ?? data.store_balance ?? data.store_wallet_balance ?? 0);

  return {
    ...data,
    balance: Number.isNaN(balance) ? 0 : balance,
  };
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
 * يحدّث الجلسة ويُعيد store_id الصحيح لشحن محفظة المتجر
 */
export async function resolveWalletChargeContext(preferredStoreId = null) {
  let user = getStoredUser();
  try {
    const freshUser = await fetchCurrentUser();
    const token = getAuthToken();
    if (token && freshUser) {
      persistAuthSession({ token, user: freshUser });
      user = freshUser;
    }
  } catch {
    // نستخدم الجلسة المخزّنة عند فشل التحديث
  }

  const storeId = resolveManagedStoreId(user, preferredStoreId);
  if (!storeId) {
    const error = new Error('لم يتم تحديد المتجر. يرجى تسجيل الدخول مرة أخرى.');
    error.status = 422;
    throw error;
  }

  if (!userCanChargeStoreWallet(user)) {
    const error = new Error(
      'شحن المحفظة متاح لمدير المتجر فقط. سجّل الخروج ثم ادخل بحساب المدير (ليس حساب الموظف).'
    );
    error.status = 403;
    throw error;
  }

  return { storeId, user };
}

/**
 * POST /api/stores/wallet/charge — api.md
 * body: { store_id, amount, payment_method_id }
 * payment_method_id: معرّف Stripe (مثل pm_card_visa)
 */
export async function chargeStoreWallet({ storeId, amount, paymentMethodId }) {
  const { storeId: resolvedStoreId } = await resolveWalletChargeContext(storeId);

  return apiRequest(API_ENDPOINTS.storeWalletCharge, {
    method: 'POST',
    body: {
      store_id: Number(resolvedStoreId),
      amount: Number(amount),
      payment_method_id: paymentMethodId,
    },
  });
}

/**
 * POST /api/stores/wallet/withdraw — body: { store_id, amount, card_number }
 */
export async function withdrawStoreWallet({ storeId, amount, cardNumber }) {
  return apiRequest(API_ENDPOINTS.storeWalletWithdraw, {
    method: 'POST',
    body: {
      store_id: Number(storeId),
      amount: Number(amount),
      card_number: String(cardNumber).replace(/\s/g, ''),
    },
  });
}
