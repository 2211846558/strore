import React, { useState, useEffect } from 'react';
import { X, Wallet, Plus, ArrowDownLeft, ArrowUpRight, Minus } from 'lucide-react';
import SadadRechargeModal from './SadadRechargeModal';
import { useWalletBalance, useChargeWallet, useWithdrawWallet } from '../../api/hooks/useWallet';
import { resolveWalletChargeContext } from '../../api/wallet';
import { useStore } from '../../context/AuthContext';
import { getApiErrorMessage } from '../../api/stores';
import { isValidDecimalInput, preventWheelChange } from '../../utils/numericInput';
import './WalletModal.css';

const WalletModal = ({ isOpen, onClose, onToast }) => {
  const { storeId } = useStore();
  const { data: walletData, isLoading, refetch: refreshWallet } = useWalletBalance();
  const chargeMutation = useChargeWallet();
  const withdrawMutation = useWithdrawWallet();
  const balance = walletData?.balance ?? 0;
  const status = walletData?.status === 'active' ? 'نشطة' : walletData?.status === 'suspended' ? 'معلّقة' : walletData?.status === 'inactive' ? 'غير نشطة' : walletData?.status === 'frozen' ? 'مجمّدة' : 'نشطة';
  const transactions = [];
  const loading = isLoading;
  const rechargeViaStripe = async ({ paymentMethodId, amount, cardLast4 }) => {
    const charged = await chargeMutation.mutateAsync({ storeId, amount: Number(amount), paymentMethodId });
    await refreshWallet();
    return charged?.balance ?? Number(amount);
  };
  const withdrawFromWallet = async ({ amount, cardNumber }) => {
    const value = Number(amount);
    if (!value || value <= 0) throw new Error('يرجى إدخال مبلغ صالح');
    if (!cardNumber?.trim()) throw new Error('يرجى إدخال رقم البطاقة');
    const chargeContext = await resolveWalletChargeContext(storeId);
    const targetStoreId = chargeContext.storeId;
    await withdrawMutation.mutateAsync({ storeId: targetStoreId, amount: value, cardNumber: cardNumber.trim() });
    await refreshWallet();
    return value;
  };
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (isOpen) refreshWallet();
  }, [isOpen, refreshWallet]);

  if (!isOpen) return null;

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      const amount = await withdrawFromWallet({
        amount: withdrawAmount,
        cardNumber,
      });
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setCardNumber('');
      onToast?.(`تم سحب ${amount.toLocaleString()} د.ل بنجاح`);
    } catch (err) {
      onToast?.(getApiErrorMessage(err, 'تعذّر إتمام عملية السحب'));
    } finally {
      setWithdrawing(false);
    }
  };

  const handleRechargeConfirm = async ({ paymentMethodId, amount, cardLast4 }) => {
    try {
      const charged = await rechargeViaStripe({ paymentMethodId, amount, cardLast4 });
      await refreshWallet();
      onToast?.(`تم شحن المحفظة بمبلغ ${charged.toLocaleString()} د.ل بنجاح`);
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'تعذّر إتمام عملية الشحن'));
    }
  };

  return (
    <>
      <div className="wallet-overlay" onClick={onClose}>
        <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
          <div className="wallet-modal-header">
            <h2>محفظتي</h2>
            <button type="button" className="wallet-close" onClick={onClose} aria-label="إغلاق">
              <X size={24} />
            </button>
          </div>

          <div className="wallet-balance-card">
            <div className="wallet-balance-top">
              <span className="wallet-balance-label">الرصيد الحالي</span>
              <span className="wallet-status-badge">{status}</span>
            </div>
            <p className="wallet-balance-amount">{balance.toFixed(2)} د.ل</p>
            <div className="wallet-balance-actions">
              <button type="button" className="wallet-recharge-btn" onClick={() => setRechargeOpen(true)}>
                <Plus size={18} />
                شحن الرصيد
              </button>
              <button
                type="button"
                className="wallet-withdraw-btn"
                onClick={() => setWithdrawOpen((v) => !v)}
              >
                <Minus size={18} />
                سحب الرصيد
              </button>
            </div>
          </div>

          {withdrawOpen && (
            <div className="wallet-withdraw-form">
              <input
                type="text"
                inputMode="decimal"
                placeholder="المبلغ (د.ل)"
                value={withdrawAmount}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (isValidDecimalInput(raw)) setWithdrawAmount(raw);
                }}
                onWheel={preventWheelChange}
                dir="ltr"
              />
              <input
                type="text"
                placeholder="رقم البطاقة"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                dir="ltr"
              />
              <button
                type="button"
                className="wallet-recharge-btn"
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAmount || !cardNumber}
              >
                {withdrawing ? 'جاري السحب...' : 'تأكيد السحب'}
              </button>
            </div>
          )}

          <div className="wallet-transactions">
            <h3>آخر المعاملات</h3>
            {loading ? (
              <p className="wallet-empty">جاري تحميل المعاملات...</p>
            ) : transactions.length === 0 ? (
              <p className="wallet-empty">لا توجد معاملات بعد</p>
            ) : (
              <ul className="wallet-tx-list">
                {transactions.map((tx) => (
                  <li key={tx.id} className={`wallet-tx-item ${tx.type}`}>
                    <div className={`wallet-tx-icon ${tx.type}`}>
                      {tx.type === 'credit' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                    </div>
                    <div className="wallet-tx-info">
                      <p className="wallet-tx-desc">
                        {tx.description}
                        {tx.ref && <span className="wallet-tx-ref"> {tx.ref}</span>}
                      </p>
                      <span className="wallet-tx-date">{tx.date} · {tx.time}</span>
                    </div>
                    <span className={`wallet-tx-amount ${tx.type}`}>
                      {tx.type === 'credit' ? '+' : '-'}
                      {tx.amount.toFixed(2)} د.ل
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="wallet-info-box">
            <Wallet size={18} />
            <div>
              <p className="wallet-info-title">معلومات المحفظة</p>
              <p className="wallet-info-text">
                يمكنك شحن المحفظة ببطاقة بنكية (Stripe) واستخدام الرصيد للاشتراك في الخطط ودفع رسوم المنصة.
              </p>
            </div>
          </div>
        </div>
      </div>

      <SadadRechargeModal
        isOpen={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        onConfirm={handleRechargeConfirm}
      />
    </>
  );
};

export default WalletModal;
