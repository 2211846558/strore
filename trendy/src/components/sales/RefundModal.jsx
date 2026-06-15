import { useState } from 'react';
import { X } from 'lucide-react';
import './SalesModals.css';

const RefundModal = ({ isOpen, onClose, item, onConfirm, isSaving = false }) => {
  const [refundQty, setRefundQty] = useState(1);
  const [prevItem, setPrevItem] = useState(null);

  if (item !== prevItem) {
    setPrevItem(item);
    setRefundQty(item ? (item.quantity || 1) : 1);
  }

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
                  onClick={() => setRefundQty((prev) => Math.max(1, prev - 1))}
                  disabled={refundQty <= 1 || isSaving}
                >
                  -
                </button>
                <input
                  id="refund-qty"
                  type="number"
                  className="sales-form-input"
                  style={{ textAlign: 'center', width: '80px', padding: '6px 12px', cursor: 'default' }}
                  min="1"
                  max={item.quantity}
                  value={refundQty}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(item.quantity, Number(e.target.value) || 1));
                    setRefundQty(val);
                  }}
                  disabled={isSaving}
                />
                <button
                  type="button"
                  className="sales-btn-secondary"
                  style={{ padding: '6px 12px', minWidth: '40px', cursor: 'pointer' }}
                  onClick={() => setRefundQty((prev) => Math.min(item.quantity, prev + 1))}
                  disabled={refundQty >= item.quantity || isSaving}
                >
                  +
                </button>
              </div>
            </div>
          )}
          <p className="sales-refund-amount" style={{ marginTop: '12px' }}>- {item.price * refundQty} د.ل</p>
        </div>
        <div className="sales-modal-footer">
          <button
            type="button"
            className="sales-btn-primary"
            onClick={() => onConfirm(refundQty)}
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
