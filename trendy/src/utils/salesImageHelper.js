import { findStoreProductForImage } from '../api/posImages';

function isPlaceholder(url) {
  return typeof url === 'string' && url.startsWith('data:image/svg+xml');
}

export function buildCandidates(item, storeProducts) {
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

  const matched = findStoreProductForImage(item, storeProducts);
  if (matched) {
    push(matched.image);
    (matched.imageCandidates ?? []).forEach(push);
    (matched.images ?? []).forEach((img) => {
      push(img?.url);
      (img?.candidates ?? []).forEach(push);
    });
  }

  return list;
}
