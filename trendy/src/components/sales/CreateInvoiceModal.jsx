import React, { useState } from 'react';
import { X } from 'lucide-react';
import { getApiErrorMessage } from '../../api/stores';
import './SalesModals.css';

const CreateInvoiceModal = ({ isOpen, onClose, cart, onConfirm, isSaving = false }) => {
  const [customerId, setCustomerId] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const id = Number(customerId);
    if (!id || id <= 0) {
      setError('أدخل رقم ملف العميل (customer_id) صحيحاً');
      return;
    }
    try {
      await onConfirm(id);
      setCustomerId('');
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
            <label htmlFor="customer-id">رقم ملف العميل (customer_id)</label>
            <input
              id="customer-id"
              className="sales-form-input"
              placeholder="مثال: 1"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value.replace(/[^0-9]/g, ''))}
              dir="ltr"
              required
            />
            <p className="sales-form-hint">
              مطلوب من API — رقم العميل المسجّل في النظام (customer_profiles)
            </p>
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
            <button type="submit" className="sales-btn-primary" disabled={!customerId || isSaving}>
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
