import React, { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, Star } from 'lucide-react';
import { productPlaceholderImage } from '../../api/media';
import './StoreCard.css';

const StoreCard = ({ store }) => {
  const candidates = store.imageCandidates?.length
    ? store.imageCandidates
    : store.image
      ? [store.image]
      : [];
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [usePlaceholder, setUsePlaceholder] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setUsePlaceholder(false);
  }, [store.image, store.imageCandidates]);

  const imgSrc = usePlaceholder
    ? productPlaceholderImage()
    : candidateIndex < candidates.length
      ? candidates[candidateIndex]
      : store.image || productPlaceholderImage();

  const handleImageError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex((prev) => prev + 1);
      return;
    }
    setUsePlaceholder(true);
  };

  return (
    <div className="store-card store-card-wide">
      <div className="store-image-wrap">
        <img
          src={imgSrc}
          alt={store.name}
          className="store-cover-image"
          onError={handleImageError}
        />
        {store.statusLabel && (
          <span className={`open-badge status-${store.statusRaw || 'inactive'}`}>
            {store.statusLabel}
          </span>
        )}
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
