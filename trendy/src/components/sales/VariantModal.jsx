import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getStock } from '../../data/salesProducts';
import ExchangePriceDiff from './ExchangePriceDiff';
import './SalesModals.css';

const VariantModal = ({ isOpen, onClose, product, onAdd, exchangeFrom }) => {
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');

  useEffect(() => {
    if (isOpen && product) {
      setColor('');
      setSize('');
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const stock = getStock(product, color, size);
  const canAdd = color && size && stock > 0;
  const isExchange = Boolean(exchangeFrom);

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ product, color, size, price: product.price });
    onClose();
  };

  return (
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-header">
          <h2 className="sales-modal-title">
            {isExchange ? 'اختيار متغير المنتج الجديد' : 'اختيار متغير المنتج'}
          </h2>
          <button type="button" className="sales-modal-close" onClick={onClose} aria-label="إغلاق">
            <X size={24} />
          </button>
        </div>
        <div className="sales-modal-product-preview">
          <img src={product.image} alt={product.name} />
          <p className="sales-modal-product-name">{product.name}</p>
          <p className="sales-modal-product-price">{product.price} د.ل</p>
        </div>
        <div className="sales-form-group">
          <label htmlFor="variant-color">اللون</label>
          <select id="variant-color" className="sales-form-select" value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="">اختر اللون</option>
            {product.colors.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
        <div className="sales-form-group">
          <label htmlFor="variant-size">المقاس</label>
          <select id="variant-size" className="sales-form-select" value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="">اختر المقاس</option>
            {product.sizes.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        {color && size && (
          <div className="sales-stock-box">الكمية المتوفرة: {stock} قطعة</div>
        )}
        {isExchange && product && (
          <ExchangePriceDiff
            oldUnitPrice={exchangeFrom.oldPrice}
            quantity={exchangeFrom.quantity}
            newUnitPrice={product.price}
          />
        )}
        <div className="sales-modal-footer">
          <button type="button" className="sales-btn-primary" onClick={handleAdd} disabled={!canAdd}>
            {isExchange ? 'تأكيد التبديل' : 'إضافة للسلة'}
          </button>
          <button type="button" className="sales-btn-secondary" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
};

export default VariantModal;