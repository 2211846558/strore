import React from 'react';
import './PlanCard.css';

const PlanCard = ({
  title,
  price,
  image,
  featuresText,
  isPopular,
  status = 'available',
  onSubscribe,
}) => {
  const isRecommended = isPopular;

  return (
    <div className={`plan-card ${isRecommended ? 'popular recommended' : ''} ${status === 'active' ? 'active' : ''} ${status === 'scheduled' ? 'scheduled' : ''}`} tabIndex={0}>
      {image && (
        <div className="plan-image-wrap">
          <img src={image} alt={title} className="plan-image" />
        </div>
      )}
      <div className="plan-header">
        <div className="title-row">
          <h3 className="plan-title">{title}</h3>
          {status === 'active' && <span className="active-badge">نشط</span>}
          {status === 'scheduled' && <span className="scheduled-badge">مجدول</span>}
        </div>
        {isRecommended && <span className="popular-badge recommended-badge">الخطة الموصى بها</span>}
      </div>

      <div className="plan-price">
        <span className="amount">{price}</span>
        <span className="currency">د.ل</span>
      </div>

      <div className="plan-features">
        <p>{featuresText}</p>
      </div>

      <button className={`subscribe-btn ${status}`} onClick={onSubscribe}>
        اشترك في الخطة
      </button>
    </div>
  );
};

export default React.memo(PlanCard);
