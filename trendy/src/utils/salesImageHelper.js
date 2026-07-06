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

  // صور المتغيرات التابعة للمنتج
  (item?.variants ?? []).forEach((v) => {
    push(v?.image);
    (v?.imageCandidates ?? []).forEach(push);
    (v?.images ?? []).forEach((img) => {
      push(img?.url);
      (img?.candidates ?? []).forEach(push);
    });
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

    // صور المتغيرات التابعة للمنتج المطابق
    (matched.variants ?? []).forEach((v) => {
      push(v?.image);
      (v?.imageCandidates ?? []).forEach(push);
      (v?.images ?? []).forEach((img) => {
        push(img?.url);
        (img?.candidates ?? []).forEach(push);
      });
    });
  }

  return list;
}
