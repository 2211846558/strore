import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import {
  campaignPlaceholderImage,
  getCampaignBannerCandidates,
} from '../../api/media';
import './SubscribedCampaignCard.css';

const SubscribedCampaignCard = ({
  title,
  description,
  price,
  duration,
  productsCount,
  dateRange,
  status,
  bannerImage,
  selectedProducts = [],
}) => {
  const [candidateIndex, setCandidateIndex] = useState(0);

  const candidates = bannerImage
    ? getCampaignBannerCandidates(bannerImage)
    : [];
  const allCandidates =
    candidates.length > 0 ? candidates : [campaignPlaceholderImage()];

  const imgSrc =
    candidateIndex >= allCandidates.length
      ? campaignPlaceholderImage()
      : allCandidates[candidateIndex] ?? campaignPlaceholderImage();
  const isActive = status === 'نشطة';

  useEffect(() => {
    setCandidateIndex(0);
  }, [bannerImage]);

  const handleImageError = () => {
    if (candidateIndex < allCandidates.length - 1) {
      setCandidateIndex((i) => i + 1);
      return;
    }
    setCandidateIndex(allCandidates.length);
  };

  return (
    <div className="subscribed-campaign-card">
      <div className="sub-campaign-banner">
        <img
          src={imgSrc}
          alt={title}
          className="sub-campaign-banner-img"
          onError={handleImageError}
        />
        <span className={`sub-campaign-status ${isActive ? 'active' : 'expired'}`}>
          {status}
        </span>
      </div>

      <div className="sub-campaign-info">
        <h3 className="sub-campaign-title">{title}</h3>
        <p className="sub-campaign-desc">{description}</p>
      </div>

      <div className="sub-campaign-header">
        <div className="sub-campaign-date">
          من {dateRange.start} إلى {dateRange.end}
        </div>
      </div>

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
