import React, { useEffect } from 'react';
import { X, CheckCircle2, Clock, XCircle } from 'lucide-react';
import './TransactionDetailModal.css';

const getTypeClass = (type) => {
  if (type === 'مبيعات') return 'sales';
  if (type === 'اشتراك') return 'sub';
  return 'refund';
};

const getStatusClass = (status) => {
  if (status === 'ناجح') return 'success';
  if (status === 'معلق') return 'pending';
  return 'failed';
};

const formatAmount = (value) => {
  const num = Number(value);
  return Number.isInteger(num) ? num : parseFloat(num.toFixed(2));
};

const getCommission = (transaction) => {
  if (transaction.fee != null && transaction.fee > 0) {
    return formatAmount(transaction.fee);
  }
  if (transaction.type === 'مبيعات') return formatAmount(transaction.amount * 0.05);
  return 0;
};

const getStatusBanner = (status) => {
  if (status === 'ناجح') return { className: 'success', icon: CheckCircle2, text: 'تمت المعاملة بنجاح وتم تحديث رصيد المتجر' };
  if (status === 'معلق') return { className: 'pending', icon: Clock, text: 'المعاملة قيد الانتظار ولم يتم تحديث الرصيد بعد' };
  return { className: 'failed', icon: XCircle, text: 'فشلت المعاملة ولم يتم تحديث رصيد المتجر' };
};

const TransactionDetailModal = ({ isOpen, onClose, transaction }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !transaction) return null;

  const commission = getCommission(transaction);
  const hasCommission = commission > 0;
  const netSign = transaction.sign === '+' ? '+' : '-';
  const banner = getStatusBanner(transaction.status);
  const BannerIcon = banner.icon;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="txn-detail-title">
      <div className="modal-content txn-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="txn-detail-title" className="modal-title">تفاصيل المعاملة المالية</h2>
          <button type="button" className="close-button" onClick={onClose} aria-label="إغلاق">
            <X size={24} />
          </button>
        </div>

        <div className="txn-detail-body">
          <div className="txn-info-grid">
            <div className="detail-field">
              <span className="detail-label">رقم المعاملة</span>
              <span className="detail-value txn-code-value">{transaction.code}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">التاريخ والوقت</span>
              <span className="detail-value">{transaction.date} - {transaction.time}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">نوع العملية</span>
              <span className={`type-badge ${getTypeClass(transaction.type)}`}>{transaction.type}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">الحالة</span>
              <span className={`status-badge ${getStatusClass(transaction.status)}`}>{transaction.status}</span>
            </div>
            <div className="detail-field full-width">
              <span className="detail-label">العميل / الطرف</span>
              <span className="detail-value client-value">{transaction.client}</span>
            </div>
          </div>

          <div className="financial-section">
            <h3 className="financial-title">التفاصيل المالية</h3>
            <div className="financial-rows">
              <div className="financial-row">
                <span className="financial-label">المبلغ الأصلي</span>
                <span className="financial-value">{transaction.amount} د.ل</span>
              </div>
              {hasCommission && (
                <div className="financial-row">
                  <span className="financial-label">عمولة المنصة</span>
                  <span className="financial-value commission">- {commission} د.ل</span>
                </div>
              )}
              <div className="financial-divider" />
              <div className="financial-row net-row">
                <span className="financial-label">صافي المبلغ للمتجر</span>
                <span className={`financial-value net ${transaction.sign === '-' ? 'negative' : ''}`}>
                  {netSign}{formatAmount(transaction.net)} د.ل
                </span>
              </div>
            </div>
          </div>

          <div className={`status-banner ${banner.className}`}>
            <BannerIcon size={20} />
            <span>{banner.text}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailModal;