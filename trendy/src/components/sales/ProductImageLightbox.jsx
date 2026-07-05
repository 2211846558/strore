import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { productPlaceholderImage } from '../../api/media';

const ProductImageLightbox = ({ isOpen, onClose, images = [], productName = '', initialIndex = 0, onIndexChange }) => {
  const [index, setIndex] = useState(initialIndex);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || !images.length) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.stopPropagation();
        // In Arabic/RTL, right arrow goes to previous image (index - 1)
        const nextIdx = index === 0 ? images.length - 1 : index - 1;
        setIndex(nextIdx);
        if (onIndexChange) onIndexChange(nextIdx);
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        // In Arabic/RTL, left arrow goes to next image (index + 1)
        const nextIdx = index === images.length - 1 ? 0 : index + 1;
        setIndex(nextIdx);
        if (onIndexChange) onIndexChange(nextIdx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images, onClose, index, onIndexChange]);

  if (!isOpen) return null;

  const currentSrc = images[index] || productPlaceholderImage();
  const hasMultiple = images.length > 1;

  const handlePrev = (e) => {
    e.stopPropagation();
    const nextIdx = index === 0 ? images.length - 1 : index - 1;
    setIndex(nextIdx);
    if (onIndexChange) onIndexChange(nextIdx);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    const nextIdx = index === images.length - 1 ? 0 : index + 1;
    setIndex(nextIdx);
    if (onIndexChange) onIndexChange(nextIdx);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div className="sales-lightbox-overlay" onClick={handleClose}>
      {/* Close button top corner */}
      <button 
        type="button" 
        className="sales-lightbox-close" 
        onClick={handleClose} 
        aria-label="إغلاق المعاينة"
      >
        <X size={28} />
      </button>

      <div className="sales-lightbox-container" onClick={(e) => e.stopPropagation()}>
        {/* Main image wrapper */}
        <div className="sales-lightbox-main-view">
          {hasMultiple && (
            <button 
              type="button" 
              className="sales-lightbox-arrow right" 
              onClick={handlePrev}
              aria-label="الصورة السابقة"
            >
              <ChevronRight size={32} />
            </button>
          )}

          <div className="sales-lightbox-image-wrapper">
            <img 
              src={currentSrc} 
              alt={`${productName} — ${index + 1}`} 
              className="sales-lightbox-img"
            />
          </div>

          {hasMultiple && (
            <button 
              type="button" 
              className="sales-lightbox-arrow left" 
              onClick={handleNext}
              aria-label="الصورة التالية"
            >
              <ChevronLeft size={32} />
            </button>
          )}
        </div>

        {/* Info & pagination */}
        <div className="sales-lightbox-footer-info">
          {productName && <h3 className="sales-lightbox-title">{productName}</h3>}
          {hasMultiple && (
            <div className="sales-lightbox-counter">
              <span>{index + 1}</span> / <span>{images.length}</span>
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {hasMultiple && (
          <div className="sales-lightbox-thumbnails">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                className={`sales-lightbox-thumb-btn ${idx === index ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(idx);
                  if (onIndexChange) onIndexChange(idx);
                }}
              >
                <img src={img} alt="" className="sales-lightbox-thumb-img" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductImageLightbox;
