import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getWalletBalance, chargeStoreWallet, withdrawStoreWallet } from '../api/wallet';
import { fetchAllTransactions, mapToWalletLog } from '../api/finance';

const WalletContext = createContext(null);

export const WalletProvider = ({ children }) => {
  const { isAuthenticated, storeId } = useAuth();
  const [balance, setBalance] = useState(0);
  const [status, setStatus] = useState('نشطة');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshWallet = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [balanceRes, txResult] = await Promise.all([
        getWalletBalance(),
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
  }, [isAuthenticated]);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet, storeId]);

  const withdrawFromWallet = useCallback(async ({ amount, cardNumber }) => {
    const value = Number(amount);
    if (!value || value <= 0) {
      throw new Error('يرجى إدخال مبلغ صالح');
    }
    if (!cardNumber?.trim()) {
      throw new Error('يرجى إدخال رقم البطاقة');
    }
    if (!storeId) {
      throw new Error('لم يتم تحديد المتجر. يرجى تسجيل الدخول مرة أخرى.');
    }

    await withdrawStoreWallet({ storeId, amount: value, cardNumber: cardNumber.trim() });
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
    if (!storeId) {
      throw new Error('لم يتم تحديد المتجر. يرجى تسجيل الدخول مرة أخرى.');
    }

    const res = await chargeStoreWallet({
      storeId,
      amount: value,
      paymentMethodId,
    });

    const newBalance = Number(res?.balance ?? balance + value);
    setBalance(newBalance);

    await refreshWallet();
    return value;
  }, [storeId, balance, refreshWallet]);

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
