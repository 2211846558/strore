export const SALES_PRODUCTS = [
  {
    id: 1,
    name: 'قميص قطني',
    price: 85,
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
    colors: ['أزرق', 'أبيض'],
    sizes: ['L', 'M', 'XL'],
    stockMap: { 'أزرق-L': 45, 'أزرق-M': 38, 'أزرق-XL': 52, 'أبيض-L': 40, 'أبيض-M': 35, 'أبيض-XL': 48 },
  },
  {
    id: 2,
    name: 'فستان صيفي',
    price: 150,
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80',
    colors: ['أحمر', 'وردي'],
    sizes: ['L', 'M', 'S'],
    stockMap: { 'أحمر-L': 23, 'أحمر-M': 18, 'أحمر-S': 15, 'وردي-L': 20, 'وردي-M': 16, 'وردي-S': 12 },
  },
  {
    id: 3,
    name: 'شورت رياضي',
    price: 60,
    image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=400&q=80',
    colors: ['أسود', 'رمادي'],
    sizes: ['XL', 'L'],
    stockMap: { 'أسود-XL': 25, 'أسود-L': 30, 'رمادي-XL': 22, 'رمادي-L': 28 },
  },
  {
    id: 4,
    name: 'بنطلون جينز',
    price: 120,
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=400&q=80',
    colors: ['أزرق داكن'],
    sizes: ['L', 'M'],
    stockMap: { 'أزرق داكن-L': 15, 'أزرق داكن-M': 12 },
  },
];

export const COLOR_DOTS = {
  'أزرق': '#3b82f6',
  'أبيض': '#e5e7eb',
  'أحمر': '#ef4444',
  'وردي': '#ec4899',
  'أسود': '#1f2937',
  'رمادي': '#9ca3af',
  'أزرق داكن': '#1e40af',
};

export const getVariantKey = (color, size) => `${color}-${size}`;

export const getStock = (product, color, size) => {
  if (!product || !color || !size) return 0;
  return product.stockMap[getVariantKey(color, size)] ?? 0;
};

export const getTotalStock = (product) =>
  Object.values(product.stockMap || {}).reduce((sum, n) => sum + n, 0);

export const createProductsWithStock = () =>
  SALES_PRODUCTS.map((p) => ({
    ...p,
    stockMap: { ...p.stockMap },
  }));

export const adjustProductStock = (products, productId, color, size, delta) => {
  const key = getVariantKey(color, size);
  return products.map((p) => {
    if (p.id !== productId) return p;
    const current = p.stockMap[key] ?? 0;
    return {
      ...p,
      stockMap: { ...p.stockMap, [key]: Math.max(0, current + delta) },
    };
  });
};

export const applyStockDeductions = (products, items) => {
  let next = products;
  items.forEach((line) => {
    next = adjustProductStock(
      next,
      line.productId,
      line.color,
      line.size,
      -(line.quantity || 1)
    );
  });
  return next;
};

/** فرق السعر عند التبديل: موجب = على العميل دفع إضافي، سالب = على المتجر إرجاع */
export const getExchangePriceDiff = (oldUnitPrice, quantity, newUnitPrice) => {
  const qty = quantity || 1;
  const oldTotal = oldUnitPrice * qty;
  const newTotal = newUnitPrice * qty;
  const diff = newTotal - oldTotal;
  return {
    oldTotal,
    newTotal,
    diff,
    amount: Math.abs(diff),
    type: diff > 0 ? 'pay' : diff < 0 ? 'refund' : 'equal',
  };
};
