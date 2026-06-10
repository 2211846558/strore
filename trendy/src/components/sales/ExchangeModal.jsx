import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ExchangePriceDiff from './ExchangePriceDiff';
import './SalesModals.css';

const ExchangeModal = ({ isOpen, onClose, item, products = [], onConfirm }) => {
  const [newProductId, setNewProductId] = useState('');

  useEffect(() => {
    if (!isOpen) setNewProductId('');
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const quantity = item.quantity || 1;
  const newProduct = products.find((p) => String(p.id) === newProductId);

  const handleConfirm = () => {
    if (!newProduct) return;
    onConfirm(newProduct);
    setNewProductId('');
    onClose();
  };

  return (
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-header">
          <h2 className="sales-modal-title">تبديل منتج</h2>
          <button type="button" className="sales-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        <div className="sales-old-product-box">
          <p className="sales-refund-label">المنتج القديم</p>
          <p className="sales-refund-name">{item.name}</p>
          <p className="sales-refund-meta">
            SKU: {item.sku || item.color} | الكمية: {quantity}
          </p>
          <p className="sales-refund-amount">{item.price * quantity} د.ل</p>
        </div>
        <div className="sales-form-group">
          <label htmlFor="new-product">المنتج الجديد</label>
          <select
            id="new-product"
            className="sales-form-select"
            value={newProductId}
            onChange={(e) => setNewProductId(e.target.value)}
          >
            <option value="">اختر المنتج</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.price} د.ل
              </option>
            ))}
          </select>
        </div>
        {newProduct && (
          <ExchangePriceDiff
            oldUnitPrice={item.price}
            quantity={quantity}
            newUnitPrice={newProduct.price}
          />
        )}
        <div className="sales-modal-footer">
          <button type="button" className="sales-btn-primary" onClick={handleConfirm} disabled={!newProductId}>
            تأكيد التبديل
          </button>
          <button type="button" className="sales-btn-secondary" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExchangeModal;
