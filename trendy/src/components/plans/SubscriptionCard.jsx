import React from 'react';
import './SubscriptionCard.css';

const SubscriptionCard = ({
  title,
  price,
  pricePaid,
  image,
  status,
  durationDays,
  remainingDays,
  featuresText,
  dateRange,
  statusText,
  isExpired,
  isScheduled,
  onRenew,
}) => {
  const cardClass = isExpired ? 'expired' : isScheduled ? 'scheduled' : 'active';
  const badgeClass = isExpired
    ? 'expired-badge'
    : isScheduled
      ? 'scheduled-badge'
      : 'active-badge';

  return (
    <div className={`subscription-card ${cardClass}`}>
      {image && (
        <div className="sub-image-wrap">
          <img src={image} alt={title} className="sub-image" />
        </div>
      )}
      <div className="sub-header">
        <div className="sub-title-group">
          <h3 className="sub-title">{title}</h3>
          <span className={`status-badge ${badgeClass}`}>{status}</span>
        </div>
        <div className="sub-date">
          {durationDays != null && durationDays > 0 && (
            <span>مدة الخطة: {durationDays} يوم</span>
          )}
          {!isExpired && remainingDays != null && (
            <span className="sub-remaining">
              {isScheduled ? `يبدأ خلال ${remainingDays} يوم` : `متبقي ${remainingDays} يوم`}
            </span>
          )}
        </div>
      </div>

      {dateRange && (
        <div className="sub-period">
          <div className="sub-period-item">
            <span className="sub-period-label">تاريخ البداية</span>
            <span className="sub-period-value">{dateRange.start}</span>
          </div>
          <div className="sub-period-item">
            <span className="sub-period-label">تاريخ الانتهاء</span>
            <span className="sub-period-value">{dateRange.end}</span>
          </div>
        </div>
      )}

      <div className="sub-price">
        {price ? (
          <>
            <span className="amount">{price}</span>
            <span className="currency">د.ل</span>
          </>
        ) : (
          <span className="amount">—</span>
        )}
        {pricePaid && pricePaid !== price && (
          <span className="sub-price-paid">المبلغ المدفوع: {pricePaid} د.ل</span>
        )}
      </div>

      {featuresText && (
        <div className="sub-features">
          <p>{featuresText}</p>
        </div>
      )}

      <div className="sub-footer">
        {isExpired ? (
          <button className="renew-btn" type="button" onClick={onRenew}>
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

export default React.memo(SubscriptionCard);
