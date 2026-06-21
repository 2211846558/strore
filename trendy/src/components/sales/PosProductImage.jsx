import React from 'react';
import { productPlaceholderImage } from '../../api/media';
import { resolvePosImageSrc } from '../../api/posImages';

/**
 * نفس منطق صفحة المنتجات: img مباشر بـ product.image من قائمة المتجر
 */
const PosProductImage = ({
  item,
  storeProducts = [],
  className,
  wrapperClassName,
  alt,
  loading = 'lazy',
}) => {
  const src = resolvePosImageSrc(item, storeProducts) || productPlaceholderImage();

  const image = (
    <img
      className={className}
      src={src}
      alt={alt ?? item?.name ?? ''}
      loading={loading}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = productPlaceholderImage();
      }}
    />
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{image}</div>;
  }

  return image;
};

export default PosProductImage;
