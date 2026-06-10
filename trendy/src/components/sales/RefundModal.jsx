import React from 'react';
import { X } from 'lucide-react';
import './SalesModals.css';

const RefundModal = ({ isOpen, onClose, item, onConfirm, isSaving = false }) => {
  if (!isOpen || !item) return null;

  return (
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-header">
          <h2 className="sales-modal-title">استرداد منتج</h2>
          <button type="button" className="sales-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="sales-policy-box">
          <span className="sales-policy-icon">!</span>
          <div>
            <p className="sales-policy-title">سياسة الاسترداد</p>
            <p className="sales-policy-text">يمكن استرداد المنتجات خلال 14 يوماً من تاريخ الشراء</p>
          </div>
        </div>
        <div className="sales-refund-details">
          <p className="sales-refund-label">تفاصيل المنتج المسترد</p>
          <p className="sales-refund-name">{item.name}</p>
          <p className="sales-refund-meta">
            SKU: {item.sku || item.color} | الكمية: {item.quantity}
          </p>
          <p className="sales-refund-amount">- {item.price * item.quantity} د.ل</p>
        </div>
        <div className="sales-modal-footer">
          <button
            type="button"
            className="sales-btn-primary"
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving ? 'جاري الاسترداد...' : 'تأكيد الاسترداد'}
          </button>
          <button type="button" className="sales-btn-secondary" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundModal;
