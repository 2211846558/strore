import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
  getWalletBalance,
  getWalletLogs,
  chargeStoreWallet,
} from '../api/wallet';
import { getApiErrorMessage } from '../api/stores';

const WalletContext = createContext(null);

const mapLogToTransaction = (log) => {
  const amount = Math.abs(Number(log.net_amount ?? log.amount ?? 0));
  const isCredit = ['deposit', 'credit', 'top_up', 'top-up'].includes(
    String(log.transaction_type || log.type || '').toLowerCase()
  ) || Number(log.net_amount ?? log.amount) > 0;

  const dateObj = log.date ? new Date(log.date) : new Date();
  return {
    id: log.transaction_id ?? log.id ?? Date.now(),
    type: isCredit ? 'credit' : 'debit',
    amount,
    description: log.description || 'معاملة مالية',
    date: dateObj.toISOString().slice(0, 10),
    time: dateObj.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }),
    ref: log.reference_details?.order_number
      ? `#${log.reference_details.order_number}`
      : log.reference_id
        ? `#${log.reference_id}`
        : null,
  };
};

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
      const [balanceRes, logsRes] = await Promise.all([
        getWalletBalance(),
        getWalletLogs(),
      ]);
      setBalance(Number(balanceRes?.balance ?? 0));
      const logs = Array.isArray(logsRes) ? logsRes : logsRes?.data ?? [];
      setTransactions(logs.map(mapLogToTransaction));
    } catch {
      // يبقى الرصيد الحالي عند فشل التحميل
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet, storeId]);

  const rechargeViaSadad = useCallback(async ({ phone, birthYear, amount }) => {
    const value = Number(amount);
    if (!phone || !birthYear || !value || value <= 0) {
      throw new Error('يرجى تعبئة جميع بيانات الشحن');
    }
    if (!storeId) {
      throw new Error('لم يتم تحديد المتجر. يرجى تسجيل الدخول مرة أخرى.');
    }

    const paymentMethodId = `sadad:${phone}:${birthYear}`;
    const res = await chargeStoreWallet({
      storeId,
      amount: value,
      paymentMethodId,
    });

    const newBalance = Number(res?.balance ?? balance + value);
    setBalance(newBalance);

    setTransactions((prev) => [
      {
        id: Date.now(),
        type: 'credit',
        amount: value,
        description: `شحن المحفظة عبر sadad - هاتف: ${phone}`,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }),
        ref: `سداد-${birthYear}`,
      },
      ...prev,
    ]);

    return value;
  }, [storeId, balance]);

  const value = useMemo(
    () => ({
      balance,
      status,
      transactions,
      loading,
      rechargeViaSadad,
      refreshWallet,
    }),
    [balance, status, transactions, loading, rechargeViaSadad, refreshWallet]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
};
