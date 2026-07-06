import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { productPlaceholderImage } from '../../api/media';
import { buildCandidates } from '../../utils/salesImageHelper';

/**
 * يعرض صورة المنتج بنفس روابط صفحة «المنتجات» مع تجربة بدائل عند فشل التحميل
 */
const SalesProductThumb = ({
  item,
  storeProducts = [],
  className,
  wrapperClassName,
  alt,
  loading = 'lazy',
  onClick,
  enableNavigation = false,
  currentIndex,
  onIndexChange,
  children,
}) => {
  const candidates = useMemo(
    () => buildCandidates(item, storeProducts),
    [item, storeProducts],
  );

  const [localIndex, setLocalIndex] = useState(0);

  const index = currentIndex !== undefined ? currentIndex : localIndex;
  const setIndex = onIndexChange !== undefined ? onIndexChange : setLocalIndex;

  useEffect(() => {
    if (currentIndex === undefined) {
      setIndex(0);
    }
  }, [item?.id, item?.name, item?.sku, candidates, currentIndex, setIndex]);

  const src =
    index < candidates.length ? candidates[index] : productPlaceholderImage();

  const handlePrev = (e) => {
    e.stopPropagation();
    setIndex(index === 0 ? candidates.length - 1 : index - 1);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setIndex(index === candidates.length - 1 ? 0 : index + 1);
  };

  const image = (
    <img
      className={className}
      src={src}
      alt={alt ?? item?.name ?? ''}
      loading={loading}
      onError={() => {
        if (index < candidates.length - 1) {
          setIndex(index + 1);
        }
      }}
      onClick={wrapperClassName ? undefined : onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    />
  );

  if (wrapperClassName) {
    return (
      <div
        className={`${wrapperClassName} ${onClick ? 'clickable-thumb' : ''}`}
        onClick={onClick}
        style={onClick ? { cursor: 'pointer' } : undefined}
      >
        {image}

        {enableNavigation && candidates.length > 1 && (
          <>
            <button
              type="button"
              className="image-nav-btn prev"
              onClick={handlePrev}
              aria-label="الصورة السابقة"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="image-nav-btn next"
              onClick={handleNext}
              aria-label="الصورة التالية"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="image-count-label">
              {index + 1}/{candidates.length}
            </span>
          </>
        )}
        {children}
      </div>
    );
  }

  return image;
};

export default SalesProductThumb;
