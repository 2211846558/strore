import React from 'react';
import { CreditCard } from 'lucide-react';
import './SubscriptionCard.css';

const SubscriptionCard = ({
  title,
  price,
  status,
  durationDays,
  remainingDays,
  statusText,
  isExpired,
  onRenew,
}) => {
  return (
    <div className={`subscription-card ${isExpired ? 'expired' : 'active'}`}>
      <div className="sub-header">
        <div className="sub-title-group">
          <h3 className="sub-title">{title}</h3>
          <span className={`status-badge ${isExpired ? 'expired-badge' : 'active-badge'}`}>
            {status}
          </span>
        </div>
        <div className="sub-date">
          <span>مدة الخطة: {durationDays} يوم</span>
          {!isExpired && remainingDays != null && (
            <span className="sub-remaining">متبقي {remainingDays} يوم</span>
          )}
        </div>
      </div>

      <div className="sub-price">
        <span className="amount">{price}</span>
        <span className="currency">د.ل</span>
      </div>

      <div className="sub-footer">
        {isExpired ? (
          <button className="renew-btn" onClick={onRenew}>
            <CreditCard size={18} />
            تجديد الاشتراك
          </button>
        ) : (
          <div className="status-text-container">
            <span className="status-text">{statusText}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionCard;
