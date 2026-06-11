export const SHIPMENT_STATUS_CONFIRM = {
  received: {
    title: 'تأكيد تغيير الحالة إلى مستلمة',
    message:
      'سيتم تفعيل هذه الشحنة كشحنة حالية (مستلمة) وأرشفة الشحنة النشطة السابقة لنفس المنتج إن وُجدت.',
    confirmText: 'مستلمة',
  },
  pending: {
    title: 'تأكيد تغيير الحالة إلى قيد الانتظار',
    message: 'سيتم أرشفة الشحنة الحالية أو استعادتها ضمن قائمة الانتظار حسب حالتها الحالية.',
    confirmText: 'قيد الانتظار',
  },
  cancelled: {
    title: 'تأكيد تغيير الحالة إلى ملغاة',
    message: 'سيتم أرشفة الشحنة وإخراج مخزونها من التداول.',
    confirmText: 'ملغاة',
  },
};

export const ARCHIVE_SHIPMENT_CONFIRM = SHIPMENT_STATUS_CONFIRM.cancelled;
