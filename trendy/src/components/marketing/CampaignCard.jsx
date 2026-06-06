import React from 'react';
import './CampaignCard.css';

const CampaignCard = ({ title, type, description, duration, productsCount, price, onSubscribe }) => {
  let typeClass = 'platinum';
  
  if (type === 'search') {
    typeClass = 'golden';
  } else if (type === 'social') {
    typeClass = 'silver';
  }

  return (
    <div className={`campaign-card ${typeClass}`}>
      <div className="campaign-body">
        <h3 className="campaign-title">{title}</h3>
        <p className="campaign-desc">{description}</p>
        
        <div className="campaign-stats">
          <div className="stat">
            <span className="stat-value">{duration} أيام</span>
          </div>
          <div className="stat">
            <span className="stat-value">{productsCount} منتجات</span>
          </div>
        </div>
      </div>

      <div className="campaign-footer">
        <div className="campaign-price">
          <span className="amount">{price}</span>
          <span className="currency">د.ل</span>
        </div>
        
        <button className="campaign-subscribe-btn" onClick={onSubscribe}>
          الاشتراك والدفع
        </button>
      </div>
    </div>
  );
};

export default CampaignCard;
