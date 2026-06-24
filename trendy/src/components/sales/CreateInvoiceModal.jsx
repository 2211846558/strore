import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getApiErrorMessage } from '../../api/stores';
import './SalesModals.css';

const CreateInvoiceModal = ({ isOpen, onClose, cart, onConfirm, isSaving = false, user }) => {
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) setError('');
  }, [isOpen]);

  if (!isOpen) return null;

  const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const staffName = user?.name ?? '—';
  const staffId = user?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!staffId) {
      setError('تعذّر تحديد هوية الموظف — أعد تسجيل الدخول');
      return;
    }

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر إنشاء الفاتورة'));
    }
  };

  return (
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-header">
          <h2 className="sales-modal-title">إنشاء فاتورة جديدة</h2>
          <button type="button" className="sales-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="sales-form-group">
            <label htmlFor="staff-name">بواسطة الموظف</label>
            <input
              id="staff-name"
              className="sales-form-input sales-form-input-readonly"
              value={staffName}
              readOnly
              dir="rtl"
            />
          </div>
          <div className="sales-invoice-summary">
            <p style={{ fontWeight: 800, marginBottom: 12, textAlign: 'right' }}>ملخص الفاتورة:</p>
            <div className="sales-summary-row">
              <span>عدد المنتجات:</span>
              <strong>{cart.length}</strong>
            </div>
            <div className="sales-summary-row">
              <span>الكمية الإجمالية:</span>
              <strong>{totalQty}</strong>
            </div>
            <div className="sales-summary-row total">
              <span>المبلغ الإجمالي:</span>
              <span className="total-value">{totalAmount} د.ل</span>
            </div>
          </div>
          {error && <p className="sales-form-error">{error}</p>}
          <div className="sales-modal-footer">
            <button type="submit" className="sales-btn-primary" disabled={!staffId || isSaving}>
              {isSaving ? 'جاري الإنشاء...' : 'إنشاء الفاتورة'}
            </button>
            <button type="button" className="sales-btn-secondary" onClick={onClose} disabled={isSaving}>
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateInvoiceModal;
