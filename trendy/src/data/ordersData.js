export const ORDER_STATUSES = [
  { value: 'جديد', label: 'جديد' },
  { value: 'قيد المعالجة', label: 'قيد المعالجة' },
  { value: 'تم الشحن', label: 'تم الشحن' },
  { value: 'قيد التوصيل', label: 'قيد التوصيل' },
  { value: 'مكتمل', label: 'مكتمل' },
  { value: 'ملغي', label: 'ملغي' },
];

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'جميع الحالات' },
  ...ORDER_STATUSES,
];

export const initialOrders = [
  {
    id: 'ORD001',
    date: '2026-05-03',
    customerName: 'محمد أحمد',
    phone: '0912345678',
    address: 'طرابلس، شارع الجمهورية',
    products: [{ name: 'قميص قطني أزرق' }, { name: 'بنطال جينز' }],
    total: 250,
    status: 'جديد',
  },
  {
    id: 'ORD002',
    date: '2026-05-03',
    customerName: 'فاطمة علي',
    phone: '0923456789',
    address: 'بنغازي، شارع دبي',
    products: [{ name: 'فستان صيفي' }],
    total: 150,
    status: 'قيد المعالجة',
  },
  {
    id: 'ORD003',
    date: '2026-05-02',
    customerName: 'عمر سالم',
    phone: '0934567890',
    address: 'مصراتة، شارع البحر',
    products: [{ name: 'شورت رياضي' }, { name: 'قميص قطني' }],
    total: 145,
    status: 'تم الشحن',
  },
  {
    id: 'ORD004',
    date: '2026-05-02',
    customerName: 'سارة محمود',
    phone: '0945678901',
    address: 'طرابلس، حي الأندلس',
    products: [{ name: 'بنطلون جينز' }],
    total: 120,
    status: 'قيد التوصيل',
  },
  {
    id: 'ORD005',
    date: '2026-05-01',
    customerName: 'خالد إبراهيم',
    phone: '0956789012',
    address: 'سبها، وسط المدينة',
    products: [{ name: 'فستان صيفي' }, { name: 'شورت رياضي' }],
    total: 210,
    status: 'مكتمل',
  },
];

export const getStatusBadgeClass = (status) => {
  const map = {
    'جديد': 'status-new',
    'قيد المعالجة': 'status-processing',
    'تم الشحن': 'status-shipped',
    'قيد التوصيل': 'status-delivery',
    'مكتمل': 'status-completed',
    'ملغي': 'status-cancelled',
  };
  return map[status] || 'status-new';
};

export const canCancelOrder = (status) =>
  status !== 'ملغي' && status !== 'مكتمل';
