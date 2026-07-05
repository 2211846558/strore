import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getStoreWalletBalance, chargeStoreWallet, withdrawStoreWallet, resolveWalletChargeContext } from '../api/wallet';
import { resolveManagedStoreId } from '../api/auth';
import { fetchAllTransactions, mapToWalletLog } from '../api/finance';

const WalletContext = createContext(null);

export const WalletProvider = ({ children }) => {
  const { isAuthenticated, storeId, user, refreshSession } = useAuth();
  const effectiveStoreId = resolveManagedStoreId(user, storeId) ?? storeId;
  const [balance, setBalance] = useState(0);
  const [status, setStatus] = useState('نشطة');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshWallet = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [balanceRes, txResult] = await Promise.all([
        getStoreWalletBalance({ storeId: effectiveStoreId }),
        fetchAllTransactions({ perPage: 50 }),
      ]);
      setBalance(Number(balanceRes?.balance ?? 0));
      const walletStatus = String(balanceRes?.status ?? balanceRes?.wallet_status ?? 'active').toLowerCase();
      const statusLabels = {
        active: 'نشطة',
        suspended: 'معلّقة',
        inactive: 'غير نشطة',
        frozen: 'مجمّدة',
      };
      setStatus(statusLabels[walletStatus] ?? balanceRes?.status ?? 'نشطة');
      setTransactions(txResult.transactions.map(mapToWalletLog));
    } catch {
      // يبقى الرصيد الحالي عند فشل التحميل
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, effectiveStoreId]);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet, storeId]);

  const withdrawFromWallet = useCallback(async ({ amount, paymentMethodId }) => {
    const value = Number(amount);
    if (!value || value <= 0) {
      throw new Error('يرجى إدخال مبلغ صالح');
    }
    if (!paymentMethodId) {
      throw new Error('تعذّر الحصول على معرّف الدفع من Stripe');
    }
    const chargeContext = await resolveWalletChargeContext(storeId);
    const targetStoreId = chargeContext.storeId;

    await withdrawStoreWallet({
      storeId: targetStoreId,
      amount: value,
      paymentMethodId,
    });
    await refreshWallet();
    return value;
  }, [storeId, refreshWallet]);

  const rechargeViaStripe = useCallback(async ({ paymentMethodId, amount, cardLast4 }) => {
    const value = Number(amount);
    if (!paymentMethodId) {
      throw new Error('تعذّر الحصول على معرّف الدفع من Stripe');
    }
    if (!value || value <= 0) {
      throw new Error('يرجى إدخال مبلغ صالح');
    }
    await refreshSession?.();
    const res = await chargeStoreWallet({
      storeId,
      amount: value,
      paymentMethodId,
    });

    const newBalance = Number(res?.balance ?? balance + value);
    setBalance(newBalance);

    await refreshWallet();
    return value;
  }, [storeId, balance, refreshWallet, refreshSession]);

  const value = useMemo(
    () => ({
      balance,
      status,
      transactions,
      loading,
      rechargeViaStripe,
      withdrawFromWallet,
      refreshWallet,
    }),
    [balance, status, transactions, loading, rechargeViaStripe, withdrawFromWallet, refreshWallet]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
};
