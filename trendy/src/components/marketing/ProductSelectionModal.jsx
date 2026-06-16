import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Check } from 'lucide-react';
import { fetchStoreProducts } from '../../api/campaigns';
import { getApiErrorMessage } from '../../api/stores';
import './ProductSelectionModal.css';

const ProductSelectionModal = ({
  isOpen,
  onClose,
  campaign,
  storeId,
  isSubmitting = false,
  onActivate,
}) => {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;

    setSelectedProducts([]);
    setError('');

    if (!storeId) {
      setProductsList([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoadingProducts(true);
      try {
        const products = await fetchStoreProducts({ storeId });
        if (!cancelled) setProductsList(products);
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, 'تعذّر تحميل منتجات المتجر'));
          setProductsList([]);
        }
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, campaign, storeId]);

  if (!isOpen || !campaign) return null;

  const handleProductToggle = (product) => {
    const isSelected = selectedProducts.find((p) => p.id === product.id);

    if (isSelected) {
      setSelectedProducts(selectedProducts.filter((p) => p.id !== product.id));
    } else {
      setSelectedProducts([...selectedProducts, product]);
    }
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  const handleActivate = () => {
    if (selectedProducts.length === 0) {
      setError('يرجى اختيار منتج واحد على الأقل');
      return;
    }
    onActivate(campaign, selectedProducts);
  };

  return (
    <div className="modal-overlay" onClick={isSubmitting ? undefined : onClose}>
      <div className="modal-content product-selection-modal-content" onClick={handleModalClick}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">اختيار المنتجات للحملة الإعلانية</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose} disabled={isSubmitting}>
            <X size={24} />
          </button>
        </div>

        <div className="selection-summary-card">
          <div className="selection-detail-row">
            <span className="selection-label">الحملة المختارة:</span>
            <span className="selection-value">{campaign.title}</span>
          </div>

          <div className="selection-counter-row">
            <span className="selection-label">المنتجات المختارة:</span>
            <span className="selection-counter">
              {selectedProducts.length}
            </span>
          </div>
        </div>

        {error && <p className="form-error-banner">{error}</p>}

        {loadingProducts ? (
          <p className="no-selection-text">جاري تحميل المنتجات...</p>
        ) : (
          <div className="products-grid">
            {productsList.map((product) => {
              const isSelected = selectedProducts.some((p) => p.id === product.id);
              return (
                <div
                  key={product.id}
                  className={`product-selectable-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleProductToggle(product)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleProductToggle(product)}
                >
                  <div className="product-checkbox">
                    {isSelected ? <CheckCircle2 size={20} className="check-icon" /> : <div className="empty-circle" />}
                  </div>
                  <span className="product-name">{product.name}</span>
                </div>
              );
            })}
            {!productsList.length && !loadingProducts && (
              <p className="no-selection-text">لا توجد منتجات في متجرك حالياً.</p>
            )}
          </div>
        )}

        <div className="selected-products-summary">
          <div className="summary-title">المنتجات المختارة للحملة:</div>
          <div className="selected-tags">
            {selectedProducts.length > 0 ? (
              selectedProducts.map((p) => (
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
          <button type="button" className="cancel-button" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </button>
          <button
            type="button"
            className="save-button payment-confirm-btn"
            onClick={handleActivate}
            disabled={isSubmitting || selectedProducts.length === 0 || loadingProducts}
          >
            {isSubmitting ? (
              <span className="loader" />
            ) : (
              <>
                <Check size={18} />
                تأكيد والاشتراك في الحملة
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductSelectionModal;
