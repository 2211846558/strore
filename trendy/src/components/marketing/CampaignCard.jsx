import React, { useEffect, useState } from 'react';
import { Calendar, Package, Layers } from 'lucide-react';
import {
  campaignPlaceholderImage,
  getCampaignBannerCandidates,
} from '../../api/media';
import './CampaignCard.css';

const CampaignCard = ({
  title,
  type,
  description,
  duration,
  productsCount,
  price,
  bannerImage,
  status = 'active',
  onSubscribe,
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
  const statusLabel = status === 'active' ? 'نشط' : status;

  useEffect(() => {
    setCandidateIndex(0);
  }, [bannerImage]);

  let typeClass = 'platinum';
  let typeLabel = '';
  if (type === 'search') {
    typeClass = 'golden';
    typeLabel = 'حملة البحث الذهبية';
  } else if (type === 'social') {
    typeClass = 'silver';
    typeLabel = 'حملة التواصل الفضية';
  } else if (type === 'default' || !type) {
    const priceNum = Number(price);
    if (priceNum >= 150) {
      typeClass = 'platinum';
      typeLabel = '';
    } else if (priceNum >= 80) {
      typeClass = 'golden';
      typeLabel = 'حملة البحث الذهبية';
    } else {
      typeClass = 'silver';
      typeLabel = 'حملة التواصل الفضية';
    }
  }

  const handleImageError = () => {
    if (candidateIndex < allCandidates.length - 1) {
      setCandidateIndex((i) => i + 1);
      return;
    }
    setCandidateIndex(allCandidates.length);
  };

  return (
    <div className={`campaign-card ${typeClass}`}>
      <div className="campaign-banner">
        <img
          src={imgSrc}
          alt={title}
          className="campaign-banner-img"
          onError={handleImageError}
        />
        <div className="campaign-badges">
          {status === 'active' && (
            <span className="campaign-status-badge">{statusLabel}</span>
          )}
          {typeLabel && (
            <span className={`campaign-tier-badge ${typeClass}`}>
              <Layers size={12} />
              {typeLabel}
            </span>
          )}
        </div>
        <div className="campaign-banner-overlay" />
      </div>

      <div className="campaign-info">
        <h3 className="campaign-title">{title}</h3>
        <p className="campaign-desc">{description}</p>
      </div>

      <div className="campaign-body">
        <div className="campaign-stats-grid">
          <div className="campaign-stat-item">
            <Calendar size={16} className="stat-icon" />
            <div className="stat-details">
              <span className="stat-label">مدة الحملة</span>
              <span className="stat-value">{duration} أيام</span>
            </div>
          </div>
          <div className="campaign-stat-item">
            <Package size={16} className="stat-icon" />
            <div className="stat-details">
              <span className="stat-label">المنتجات المتاحة</span>
              <span className="stat-value">{productsCount || '10'} منتجات</span>
            </div>
          </div>
        </div>
      </div>

      <div className="campaign-footer">
        <div className="campaign-price-wrapper">
          <span className="price-label">تكلفة الاشتراك</span>
          <div className="campaign-price">
            <span className="amount">{price}</span>
            <span className="currency">د.ل</span>
          </div>
        </div>

        <button className="campaign-subscribe-btn" onClick={onSubscribe} type="button">
          الاشتراك والدفع
        </button>
      </div>
    </div>
  );
};

export default CampaignCard;

