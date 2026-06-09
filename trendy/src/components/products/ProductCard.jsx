import React, { useState, useEffect, useMemo } from 'react';
import { Palette, Archive, ArchiveRestore, Edit2, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { productPlaceholderImage } from '../../api/media';
import './ProductCard.css';

const ProductCard = ({ product, onEdit, onArchive, onAddVariant }) => {
  const isArchived = product.status === 'مؤرشف';

  const imageSlides = useMemo(() => {
    if (product.images?.length) {
      return product.images.map((img) => ({
        url: img.url,
        candidates: img.candidates?.length ? img.candidates : [img.url],
      }));
    }
    if (product.imageCandidates?.length) {
      return [{ url: product.image, candidates: product.imageCandidates }];
    }
    if (product.image) {
      return [{ url: product.image, candidates: [product.image] }];
    }
    return [{ url: productPlaceholderImage(), candidates: [] }];
  }, [product.image, product.imageCandidates, product.images]);

  const [slideIndex, setSlideIndex] = useState(0);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setSlideIndex(0);
    setCandidateIndex(0);
  }, [product.id, imageSlides]);

  const currentSlide = imageSlides[slideIndex] || imageSlides[0];
  const candidates = currentSlide?.candidates || [];

  const imgSrc =
    candidateIndex < candidates.length
      ? candidates[candidateIndex]
      : currentSlide?.url || productPlaceholderImage();

  const handleImageError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex((prev) => prev + 1);
    }
  };

  const goToPrev = (e) => {
    e.stopPropagation();
    setSlideIndex((prev) => (prev === 0 ? imageSlides.length - 1 : prev - 1));
    setCandidateIndex(0);
  };

  const goToNext = (e) => {
    e.stopPropagation();
    setSlideIndex((prev) => (prev === imageSlides.length - 1 ? 0 : prev + 1));
    setCandidateIndex(0);
  };

  const hasMultipleImages = imageSlides.length > 1;

  return (
    <div className={`product-card ${isArchived ? 'archived' : ''}`}>
      {isArchived && <span className="archive-badge">مؤرشف</span>}

      <div className="product-image">
        <img
          src={imgSrc}
          alt={product.name}
          loading="lazy"
          onError={handleImageError}
        />
        {hasMultipleImages && (
          <>
            <button
              type="button"
              className="image-nav-btn prev"
              onClick={goToPrev}
              aria-label="الصورة السابقة"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="image-nav-btn next"
              onClick={goToNext}
              aria-label="الصورة التالية"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="image-count-label">
              {slideIndex + 1}/{imageSlides.length}
            </span>
          </>
        )}
      </div>

      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <span className="product-category">{product.category}</span>
      </div>

      <p className="product-description">{product.description}</p>

      {product.colors?.length > 0 && (
        <div className="product-colors">
          {product.colors.map((color) => (
            <span key={color} className="color-tag">
              <Palette size={12} className="tag-icon" aria-hidden="true" />
              {color}
            </span>
          ))}
        </div>
      )}

      {product.sizes?.length > 0 && (
        <div className="product-sizes">
          {product.sizes.map((size) => (
            <span key={size} className="size-tag">
              {size}
            </span>
          ))}
        </div>
      )}

      <div className="product-footer">
        <div className="product-price">
          <span className="amount">{product.price}</span>
          <span className="currency">د.ل</span>
        </div>
        {product.stock != null && product.stock !== '' && (
          <span className="product-stock">{product.stock} متوفر</span>
        )}
      </div>

      <div
        className={`product-actions ${
          !isArchived && onAddVariant ? 'cols-3' : 'cols-2'
        }`}
      >
        {!isArchived && onAddVariant && (
          <button
            type="button"
            className="product-btn variant-btn"
            onClick={() => onAddVariant(product)}
            title="إضافة تنوع"
            aria-label="إضافة تنوع المنتج"
          >
            <Layers size={18} />
            <span>تنوع</span>
          </button>
        )}
        <button
          type="button"
          className={`product-btn archive-action-btn ${isArchived ? 'restore' : 'archive'}`}
          onClick={() => onArchive(product)}
          title={isArchived ? 'إلغاء الأرشفة' : 'أرشفة المنتج'}
          aria-label={isArchived ? 'إلغاء أرشفة المنتج' : 'أرشفة المنتج'}
        >
          {isArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
          <span>{isArchived ? 'استعادة' : 'أرشفة'}</span>
        </button>
        <button
          type="button"
          className="product-btn edit-btn"
          onClick={() => onEdit(product)}
          title="تعديل"
          aria-label="تعديل المنتج"
        >
          <Edit2 size={18} />
          <span>تعديل</span>
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
