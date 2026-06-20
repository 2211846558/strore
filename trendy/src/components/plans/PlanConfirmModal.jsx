import React, { useState } from 'react';
import { X, Wallet } from 'lucide-react';
import { useWalletBalance } from '../../api/hooks/useWallet';
import { useStore } from '../../context/AuthContext';
import { subscribeToPlan } from '../../api/plans';
import { getApiErrorMessage } from '../../api/stores';
import './PlanConfirmModal.css';

const PlanConfirmModal = ({ isOpen, onClose, plan, onConfirm }) => {
  const { data: walletData, refetch: refreshWallet } = useWalletBalance();
  const balance = walletData?.balance ?? 0;
  const { storeId } = useStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !plan) return null;

  const planPrice = Number(plan.price);
  const hasEnoughBalance = balance >= planPrice;

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  const handleConfirm = async () => {
    setError('');
    if (!storeId) {
      setError('لم يتم تحديد المتجر. يرجى تسجيل الدخول مرة أخرى.');
      return;
    }

    setLoading(true);
    try {
      await subscribeToPlan({ planId: plan.id, storeId });
      await refreshWallet();
      onConfirm(plan);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر إتمام الاشتراك'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirm-modal-content" onClick={handleModalClick}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">تأكيد الاشتراك</h2>
            <p className="modal-subtitle">أنت على وشك الاشتراك في {plan.title}</p>
          </div>
          <button type="button" className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="confirm-details">
          <div className="detail-row">
            <span className="detail-label">الخطة:</span>
            <span className="detail-value">{plan.title}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">المبلغ:</span>
            <span className="detail-value amount-value">{plan.price} د.ل</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">المدة:</span>
            <span className="detail-value">{plan.durationDays || 30} يوم</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">طريقة الدفع:</span>
            <span className="detail-value payment-method">
              <Wallet size={18} />
              رصيد المحفظة
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">الرصيد المتاح:</span>
            <span className={`detail-value ${hasEnoughBalance ? 'balance-ok' : 'balance-low'}`}>
              {balance.toFixed(2)} د.ل
            </span>
          </div>
        </div>

        {!hasEnoughBalance && (
          <p className="confirm-warning">
            رصيد المحفظة غير كافٍ. يرجى شحن المحفظة عبر سداد من صفحة الإدارة المالية.
          </p>
        )}

        {error && <p className="confirm-error">{error}</p>}

        <div className="modal-footer confirm-footer">
          <button type="button" className="cancel-button" onClick={onClose} disabled={loading}>
            إلغاء
          </button>
          <button
            type="button"
            className="save-button confirm-btn"
            onClick={handleConfirm}
            disabled={!hasEnoughBalance || loading}
          >
            {loading ? 'جاري الاشتراك...' : 'تأكيد الاشتراك'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanConfirmModal;
