import React, { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import './OrderCancelModal.css';

const DEFAULT_REASON = 'إلغاء من المتجر';

const OrderCancelModal = ({
  isOpen,
  onClose,
  onConfirm,
  order,
  isSaving = false,
}) => {
  const [reason, setReason] = useState(DEFAULT_REASON);

  useEffect(() => {
    if (isOpen) setReason(DEFAULT_REASON);
  }, [isOpen, order?.orderId]);

  if (!isOpen || !order) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed || isSaving) return;
    onConfirm(trimmed);
  };

  return (
    <div className="order-cancel-overlay" onClick={onClose}>
      <div
        className="order-cancel-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-cancel-title"
      >
        <div className="order-cancel-header">
          <h2 id="order-cancel-title" className="order-cancel-title">
            تأكيد إلغاء الطلب
          </h2>
          <button
            type="button"
            className="order-cancel-close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="إغلاق"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="order-cancel-body">
            <div className="order-cancel-icon">
              <AlertTriangle size={36} />
            </div>
            <p className="order-cancel-message">
              هل تريد إلغاء الطلب <strong>{order.id}</strong>؟
            </p>
            <p className="order-cancel-hint">
              لن يمكن التراجع عن هذا الإجراء بعد التأكيد.
            </p>

            <label className="order-cancel-label" htmlFor="order-cancel-reason">
              سبب الإلغاء
            </label>
            <textarea
              id="order-cancel-reason"
              className="order-cancel-textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب سبب الإلغاء..."
              rows={3}
              disabled={isSaving}
              dir="rtl"
            />
          </div>

          <div className="order-cancel-footer">
            <button
              type="button"
              className="order-cancel-btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              تراجع
            </button>
            <button
              type="submit"
              className="order-cancel-btn-danger"
              disabled={isSaving || !reason.trim()}
            >
              {isSaving ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderCancelModal;
