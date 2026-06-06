export const initialNotifications = [
  {
    id: 1,
    type: 'order',
    title: 'طلب جديد',
    message: 'تم استلام طلب جديد رقم ORD001 من محمد أحمد',
    datetime: '2026-05-03 10:30',
    read: false,
    actionLabel: 'عرض الطلب',
    actionPath: '/orders',
  },
  {
    id: 2,
    type: 'store',
    title: 'طلب تسجيل متجر',
    message: "طلب تسجيل متجر جديد 'متجر الإكسسوارات' في انتظار الموافقة",
    datetime: '2026-05-03 09:15',
    read: false,
    actionLabel: 'مراجعة الطلب',
    actionPath: '/',
  },
  {
    id: 3,
    type: 'stock',
    title: 'انخفاض المخزون',
    message: "تنبيه: الكمية المتوفرة من 'حذاء رياضي' أقل من الحد الأدنى",
    datetime: '2026-05-02 16:45',
    read: false,
    actionLabel: 'عرض المخزون',
    actionPath: '/inventory',
  },
  {
    id: 4,
    type: 'system',
    title: 'تحديث النظام',
    message: 'تم تحديث النظام بنجاح إلى الإصدار 2.5.0',
    datetime: '2026-05-01 11:00',
    read: true,
    actionLabel: null,
    actionPath: null,
  },
];

export const NOTIFICATION_ICONS = {
  order: { className: 'icon-order' },
  store: { className: 'icon-store' },
  stock: { className: 'icon-stock' },
  system: { className: 'icon-system' },
};
