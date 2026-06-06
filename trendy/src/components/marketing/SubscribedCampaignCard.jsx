import React from 'react';
import { Package } from 'lucide-react';
import './SubscribedCampaignCard.css';

const SubscribedCampaignCard = ({
  title,
  description,
  price,
  duration,
  productsCount,
  dateRange,
  status,
  selectedProducts = [],
}) => {
  return (
    <div className="subscribed-campaign-card">
      <div className="sub-campaign-header">
        <div className="sub-campaign-title-group">
          <h3 className="sub-campaign-title">{title}</h3>
          <span className={`sub-campaign-status ${status === 'نشطة' ? 'active' : 'expired'}`}>
            {status}
          </span>
        </div>
        <div className="sub-campaign-date">
          من {dateRange.start} إلى {dateRange.end}
        </div>
      </div>

      <p className="sub-campaign-desc">{description}</p>

      {selectedProducts.length > 0 && (
        <div className="sub-campaign-products">
          <div className="sub-campaign-products-header">
            <Package size={18} />
            <span>المنتجات المختارة للحملة</span>
            <span className="sub-campaign-products-count">
              ({selectedProducts.length} / {productsCount})
            </span>
          </div>
          <div className="sub-campaign-products-list">
            {selectedProducts.map((product) => (
              <span key={product.id} className="sub-campaign-product-tag">
                {product.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="sub-campaign-footer">
        <div className="sub-campaign-price">
          <span className="amount">{price}</span>
          <span className="currency">د.ل</span>
        </div>
        <div className="sub-campaign-stats">
          <span>{duration} أيام</span>
          <span>{selectedProducts.length || productsCount} منتج</span>
        </div>
      </div>
    </div>
  );
};

export default SubscribedCampaignCard;
