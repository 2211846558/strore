import React, { useEffect, useState } from 'react';
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
  if (type === 'search') {
    typeClass = 'golden';
  } else if (type === 'social') {
    typeClass = 'silver';
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
        {status === 'active' && (
          <span className="campaign-status-badge">{statusLabel}</span>
        )}
      </div>

      <div className="campaign-info">
        <h3 className="campaign-title">{title}</h3>
        <p className="campaign-desc">{description}</p>
      </div>

      <div className="campaign-body">
        <div className="campaign-stats">
          <div className="stat">
            <span className="stat-value">{duration} أيام</span>
          </div>
        </div>
      </div>

      <div className="campaign-footer">
        <div className="campaign-price">
          <span className="amount">{price}</span>
          <span className="currency">د.ل</span>
        </div>

        <button className="campaign-subscribe-btn" onClick={onSubscribe} type="button">
          الاشتراك والدفع
        </button>
      </div>
    </div>
  );
};

export default CampaignCard;
