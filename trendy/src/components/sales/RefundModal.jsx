import { useState } from 'react';
import { X } from 'lucide-react';
import {
  clampInteger,
  clampIntegerInput,
  isValidIntegerInput,
  parseIntegerInput,
  preventWheelChange,
} from '../../utils/numericInput';
import './SalesModals.css';

const RefundModal = ({ isOpen, onClose, item, onConfirm, isSaving = false }) => {
  const [refundQty, setRefundQty] = useState('1');
  const [prevItem, setPrevItem] = useState(null);

  if (item !== prevItem) {
    setPrevItem(item);
    setRefundQty(item ? String(item.quantity || 1) : '1');
  }

  if (!isOpen || !item) return null;

  const maxQty = item.quantity;
  const refundQtyNum = clampInteger(parseIntegerInput(refundQty, 1), 1, maxQty);

  return (
    <div className="sales-modal-overlay" onClick={() => !isSaving && onClose()}>
      <div className="sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-header">
          <h2 className="sales-modal-title">استرداد منتج</h2>
          <button type="button" className="sales-modal-close" onClick={onClose} disabled={isSaving}>
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
            SKU: {item.sku || item.color} | الكمية المشتراة: {item.quantity}
          </p>
          {item.quantity > 1 && (
            <div className="sales-form-group" style={{ marginTop: '12px' }}>
              <label htmlFor="refund-qty" style={{ fontSize: '13px', fontWeight: 'bold' }}>
                الكمية المراد استردادها:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="sales-btn-secondary"
                  style={{ padding: '6px 12px', minWidth: '40px', cursor: 'pointer' }}
                  onClick={() => setRefundQty(String(Math.max(1, refundQtyNum - 1)))}
                  disabled={refundQtyNum <= 1 || isSaving}
                >
                  -
                </button>
                <input
                  id="refund-qty"
                  type="text"
                  inputMode="numeric"
                  className="sales-form-input"
                  style={{ textAlign: 'center', width: '80px', padding: '6px 12px', cursor: 'default' }}
                  value={refundQty}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (isValidIntegerInput(raw)) setRefundQty(raw);
                  }}
                  onBlur={() => setRefundQty(clampIntegerInput(refundQty, 1, maxQty))}
                  onWheel={preventWheelChange}
                  disabled={isSaving}
                />
                <button
                  type="button"
                  className="sales-btn-secondary"
                  style={{ padding: '6px 12px', minWidth: '40px', cursor: 'pointer' }}
                  onClick={() => setRefundQty(String(Math.min(maxQty, refundQtyNum + 1)))}
                  disabled={refundQtyNum >= maxQty || isSaving}
                >
                  +
                </button>
              </div>
            </div>
          )}
          <p className="sales-refund-amount" style={{ marginTop: '12px' }}>- {item.price * refundQtyNum} د.ل</p>
        </div>
        <div className="sales-modal-footer">
          <button
            type="button"
            className="sales-btn-primary"
            onClick={() => onConfirm(refundQtyNum)}
            disabled={isSaving}
          >
            {isSaving ? 'جاري الاسترداد...' : 'تأكيد الاسترداد'}
          </button>
          <button type="button" className="sales-btn-secondary" onClick={onClose} disabled={isSaving}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundModal;
