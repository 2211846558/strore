import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getWalletBalance, chargeStoreWallet } from '../api/wallet';
import { fetchAllTransactions, mapToWalletLog } from '../api/finance';

const WalletContext = createContext(null);

export const WalletProvider = ({ children }) => {
  const { isAuthenticated, storeId } = useAuth();
  const [balance, setBalance] = useState(0);
  const [status] = useState('active');
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
      refreshWallet,
    }),
    [balance, status, transactions, loading, rechargeViaStripe, refreshWallet]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
};
