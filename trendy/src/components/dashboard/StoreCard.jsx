import React from 'react';
import { Phone, Mail, MapPin, Star } from 'lucide-react';
import './StoreCard.css';

const StoreCard = ({ store }) => {
  return (
    <div className="store-card store-card-wide">
      <div className="store-image-wrap">
        <img src={store.image} alt={store.name} className="store-cover-image" />
        <span className="open-badge">24 H</span>
      </div>

      <div className="store-details">
        <div className="store-details-top">
          <h2 className="store-name">{store.name}</h2>
          <p className="store-description">{store.description}</p>
        </div>

        <div className="store-card-body">
          <div className="info-row">
            <span className="info-text">{store.phone}</span>
            <Phone size={18} className="info-icon" />
          </div>
          <div className="info-row">
            <span className="info-text">{store.email}</span>
            <Mail size={18} className="info-icon" />
          </div>
          <div className="info-row location-row">
            <span className="info-text">{store.location}</span>
            <MapPin size={18} className="info-icon" />
          </div>
        </div>

        <div className="store-card-footer">
          <div className="rating">
            <span className="rating-value">{store.rating}</span>
            <span className="rating-text">التقييم العام</span>
            <Star size={20} className="star-icon filled" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreCard;
