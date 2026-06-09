import React from 'react';
import { X, CheckCircle2, CreditCard, Wallet } from 'lucide-react';
import './CampaignPaymentModal.css';

const CampaignPaymentModal = ({
  isOpen,
  onClose,
  campaign,
  walletBalance = 0,
  subscriptionCost = 50,
  onConfirm,
}) => {
  if (!isOpen || !campaign) return null;

  const hasEnoughBalance = Number(walletBalance) >= Number(subscriptionCost);

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content payment-modal-content" onClick={handleModalClick}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">تأكيد الاشتراك والدفع</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="payment-details-card">
          <div className="payment-detail-row">
            <span className="payment-label">الحملة المختارة:</span>
            <span className="payment-value">{campaign.title}</span>
          </div>
          <div className="payment-detail-row">
            <span className="payment-label">مدة الحملة:</span>
            <span className="payment-value">{campaign.duration} أيام</span>
          </div>
          <div className="payment-detail-row">
            <span className="payment-label">رصيد المحفظة:</span>
            <span className="payment-value">{Number(walletBalance).toLocaleString()} د.ل</span>
          </div>

          <div className="payment-total-row">
            <span className="payment-total-label">رسوم الاشتراك:</span>
            <span className="payment-total-value">{subscriptionCost} د.ل</span>
          </div>
        </div>

        {hasEnoughBalance ? (
          <div className="info-alert">
            <CheckCircle2 size={20} className="info-icon-alert" />
            <p>سيتم خصم رسوم الاشتراك من محفظة المتجر بعد اختيار المنتجات وتأكيد الحملة.</p>
          </div>
        ) : (
          <div className="info-alert warning-alert">
            <Wallet size={20} className="info-icon-alert" />
            <p>
              رصيد المحفظة غير كافٍ. يرجى شحن المحفظة من قسم المالية أولاً
              {' '}
              (المطلوب {subscriptionCost} د.ل).
            </p>
          </div>
        )}

        <div className="modal-footer payment-footer">
          <button type="button" className="cancel-button" onClick={onClose}>
            إلغاء
          </button>
          <button
            type="button"
            className="save-button payment-confirm-btn"
            disabled={!hasEnoughBalance}
            onClick={() => {
              onConfirm(campaign);
              onClose();
            }}
          >
            <CreditCard size={18} />
            متابعة واختيار المنتجات
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignPaymentModal;
