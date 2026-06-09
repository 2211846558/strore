import React from 'react';
import { CreditCard } from 'lucide-react';
import './PlanCard.css';

const PlanCard = ({ title, price, featuresText, isPopular, isActive, onSubscribe }) => {
  return (
    <div className={`plan-card ${isPopular ? 'popular' : ''} ${isActive ? 'active' : ''}`} tabIndex={0}>
      <div className="plan-header">
        <div className="title-row">
          <h3 className="plan-title">{title}</h3>
          {isActive && <span className="active-badge">نشط</span>}
        </div>
        {isPopular && <span className="popular-badge">الأكثر شعبية</span>}
      </div>

      <div className="plan-price">
        <span className="amount">{price}</span>
        <span className="currency">د.ل / شهرياً</span>
      </div>

      <div className="plan-features">
        <p>{featuresText}</p>
      </div>

      <button className="subscribe-btn" onClick={onSubscribe} disabled={isActive}>
        <CreditCard size={18} />
        {isActive ? 'مشترك حالياً' : 'اشتراك في الخطة'}
      </button>
    </div>
  );
};

export default PlanCard;
