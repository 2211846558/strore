import React, { useState } from 'react';
import { X } from 'lucide-react';
import './SalesModals.css';

const CreateInvoiceModal = ({ isOpen, onClose, cart, onConfirm }) => {
  const [customerName, setCustomerName] = useState('');

  if (!isOpen) return null;

  const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerName.trim()) return;
    onConfirm(customerName.trim());
    setCustomerName('');
    onClose();
  };

  return (
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-header">
          <h2 className="sales-modal-title">إنشاء فاتورة جديدة</h2>
          <button type="button" className="sales-modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="sales-form-group">
            <label htmlFor="customer-name">اسم العميل</label>
            <input id="customer-name" className="sales-form-input" placeholder="أدخل اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </div>
          <div className="sales-invoice-summary">
            <p style={{ fontWeight: 800, marginBottom: 12, textAlign: 'right' }}>ملخص الفاتورة:</p>
            <div className="sales-summary-row"><span>عدد المنتجات:</span><strong>{cart.length}</strong></div>
            <div className="sales-summary-row"><span>الكمية الإجمالية:</span><strong>{totalQty}</strong></div>
            <div className="sales-summary-row total"><span>المبلغ الإجمالي:</span><span className="total-value">{totalAmount} د.ل</span></div>
          </div>
          <div className="sales-modal-footer">
            <button type="submit" className="sales-btn-primary" disabled={!customerName.trim()}>إنشاء الفاتورة</button>
            <button type="button" className="sales-btn-secondary" onClick={onClose}>إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateInvoiceModal;