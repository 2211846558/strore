import React, { useState } from 'react';
import { X, Wallet, Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import SadadRechargeModal from './SadadRechargeModal';
import { useWallet } from '../../context/WalletContext';
import { getApiErrorMessage } from '../../api/stores';
import './WalletModal.css';

const WalletModal = ({ isOpen, onClose, onToast }) => {
  const { balance, status, transactions, rechargeViaSadad } = useWallet();
  const [sadadOpen, setSadadOpen] = useState(false);

  if (!isOpen) return null;

  const handleSadadConfirm = async (data) => {
    try {
      const amount = await rechargeViaSadad(data);
      onToast?.(`تم شحن المحفظة بمبلغ ${amount.toLocaleString()} د.ل بنجاح`);
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
            <button type="button" className="wallet-recharge-btn" onClick={() => setSadadOpen(true)}>
              <Plus size={18} />
              شحن الرصيد
            </button>
          </div>

          <div className="wallet-transactions">
            <h3>آخر المعاملات</h3>
            {transactions.length === 0 ? (
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
                يمكنك شحن المحفظة عبر سداد واستخدام الرصيد للاشتراك في الخطط ودفع رسوم المنصة.
              </p>
            </div>
          </div>
        </div>
      </div>

      <SadadRechargeModal
        isOpen={sadadOpen}
        onClose={() => setSadadOpen(false)}
        onConfirm={handleSadadConfirm}
      />
    </>
  );
};

export default WalletModal;
