import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Check } from 'lucide-react';
import './ProductSelectionModal.css';

const ProductSelectionModal = ({ isOpen, onClose, campaign, onActivate }) => {
  const [selectedProducts, setSelectedProducts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedProducts([]);
    }
  }, [isOpen, campaign]);

  // Mock products list for selection
  const productsList = [
    { id: 1, name: 'قميص قطني أبيض' },
    { id: 2, name: 'قميص قطني أزرق' },
    { id: 3, name: 'فستان شتوي' },
    { id: 4, name: 'فستان صيفي' },
    { id: 5, name: 'بنطلون جينز' },
    { id: 6, name: 'شورت رياضي' },
    { id: 7, name: 'بنطلون كاجوال' },
  ];

  if (!isOpen || !campaign) return null;

  const maxAllowed = campaign.productsCount;

  const handleProductToggle = (product) => {
    const isSelected = selectedProducts.find(p => p.id === product.id);
    
    if (isSelected) {
      setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
    } else {
      if (selectedProducts.length < maxAllowed) {
        setSelectedProducts([...selectedProducts, product]);
      }
    }
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content product-selection-modal-content" onClick={handleModalClick}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">اختيار المنتجات للحملة الإعلانية</h2>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="selection-summary-card">
          <div className="selection-detail-row">
            <span className="selection-label">الحملة المختارة:</span>
            <span className="selection-value">{campaign.title}</span>
          </div>
          <div className="selection-detail-row">
            <span className="selection-label">عدد المنتجات المسموح:</span>
            <span className="selection-value">{maxAllowed} منتجات</span>
          </div>
          
          <div className="selection-counter-row">
            <span className="selection-label">المنتجات المختارة:</span>
            <span className={`selection-counter ${selectedProducts.length === maxAllowed ? 'max-reached' : ''}`}>
              {maxAllowed} / {selectedProducts.length}
            </span>
          </div>
        </div>

        <div className="products-grid">
          {productsList.map((product) => {
            const isSelected = selectedProducts.some(p => p.id === product.id);
            return (
              <div 
                key={product.id} 
                className={`product-selectable-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleProductToggle(product)}
              >
                <div className="product-checkbox">
                  {isSelected ? <CheckCircle2 size={20} className="check-icon" /> : <div className="empty-circle"></div>}
                </div>
                <span className="product-name">{product.name}</span>
              </div>
            );
          })}
        </div>

        <div className="selected-products-summary">
          <div className="summary-title">المنتجات المختارة للحملة:</div>
          <div className="selected-tags">
            {selectedProducts.length > 0 ? (
              selectedProducts.map(p => (
                <span key={p.id} className="selected-tag">
                  {p.name}
                </span>
              ))
            ) : (
              <span className="no-selection-text">لم يتم اختيار أي منتج بعد</span>
            )}
          </div>
        </div>

        <div className="modal-footer payment-footer">
          <button className="cancel-button" onClick={onClose}>
            إلغاء
          </button>
          <button 
            className="save-button payment-confirm-btn" 
            onClick={() => {
              onActivate(campaign, selectedProducts);
              onClose();
            }}
            disabled={selectedProducts.length === 0}
          >
            <CheckCircle2 size={18} />
            تأكيد وتفعيل الحملة
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductSelectionModal;
