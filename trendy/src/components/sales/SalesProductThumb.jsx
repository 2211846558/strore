import React, { useEffect, useMemo, useState } from 'react';
import { productPlaceholderImage } from '../../api/media';
import { findStoreProductForImage } from '../../api/posImages';

function isPlaceholder(url) {
  return typeof url === 'string' && url.startsWith('data:image/svg+xml');
}

function buildCandidates(item, storeProducts) {
  const list = [];

  const push = (url) => {
    if (url && !isPlaceholder(url) && !list.includes(url)) list.push(url);
  };

  // صور مدمجة مباشرة من قائمة المنتجات (الأولوية)
  push(item?.image);
  (item?.imageCandidates ?? []).forEach(push);
  (item?.images ?? []).forEach((img) => {
    push(img?.url);
    (img?.candidates ?? []).forEach(push);
  });

  const itemId = Number(item?.id);
  const matched = findStoreProductForImage(item, storeProducts);
  if (matched && Number(matched.id) !== itemId) {
    push(matched.image);
    (matched.imageCandidates ?? []).forEach(push);
    (matched.images ?? []).forEach((img) => {
      push(img?.url);
      (img?.candidates ?? []).forEach(push);
    });
  }

  return list;
}

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
}) => {
  const candidates = useMemo(
    () => buildCandidates(item, storeProducts),
    [item, storeProducts],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [item?.id, item?.name, item?.sku, candidates]);

  const src =
    index < candidates.length ? candidates[index] : productPlaceholderImage();

  const image = (
    <img
      className={className}
      src={src}
      alt={alt ?? item?.name ?? ''}
      loading={loading}
      onError={() => setIndex((prev) => prev + 1)}
    />
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{image}</div>;
  }

  return image;
};

export default SalesProductThumb;
