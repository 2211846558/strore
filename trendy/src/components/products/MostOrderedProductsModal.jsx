import React, { useState, useEffect } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { fetchMostOrderedProducts } from '../../api/products';
import { getApiErrorMessage } from '../../api/stores';
import './MostOrderedProductsModal.css';

const MostOrderedProductsModal = ({ isOpen, onClose, storeId, limit = 10 }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    setLoading(true);
    setError('');
    setProducts([]);

    fetchMostOrderedProducts({ storeId, limit })
      .then((list) => {
        if (!cancelled) setProducts(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getApiErrorMessage(err, 'تعذّر تحميل المنتجات الأكثر طلباً'));
          setProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, storeId, limit]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content most-ordered-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="mo-title-wrap">
            <TrendingUp size={22} className="mo-icon" />
            <div>
              <h2 className="modal-title">الأكثر طلباً</h2>
              <p className="mo-subtitle">منتجات متجرك مرتبة حسب عدد الطلبات</p>
            </div>
          </div>
          <button className="close-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        <div className="most-ordered-body">
          {error && <p className="form-error">{error}</p>}

          {loading ? (
            <p className="mo-loading">جاري تحميل القائمة...</p>
          ) : products.length === 0 ? (
            <p className="mo-empty">لا توجد بيانات طلبات لهذه المنتجات بعد.</p>
          ) : (
            <ol className="most-ordered-list">
              {products.map((product, index) => (
                <li key={product.id} className="most-ordered-item">
                  <span className={`mo-rank ${index < 3 ? 'mo-rank-top' : ''}`}>
                    {index + 1}
                  </span>
                  <img
                    className="mo-thumb"
                    src={product.image}
                    alt={product.name}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="mo-info">
                    <span className="mo-name">{product.name}</span>
                    {product.category && (
                      <span className="mo-category">{product.category}</span>
                    )}
                  </div>
                  <div className="mo-stats">
                    <span className="mo-orders">{product.ordersCount} طلب</span>
                    {product.price && (
                      <span className="mo-price">{product.price} د.ل</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} type="button">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default MostOrderedProductsModal;
