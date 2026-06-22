import React from 'react';
import { X } from 'lucide-react';
import { getStatusBadgeClass } from '../../data/ordersData';
import './OrderDetailModal.css';

const PAYMENT_LABELS = {
  wallet: 'محفظة',
  card: 'بطاقة',
  cash: 'نقدي',
  cash_on_delivery: 'الدفع عند الاستلام',
  cod: 'الدفع عند الاستلام',
};

function formatPayment(method) {
  if (!method) return '—';
  const key = String(method).toLowerCase();
  return PAYMENT_LABELS[key] ?? method;
}

const OrderDetailModal = ({ isOpen, onClose, order, loading = false }) => {
  if (!isOpen) return null;

  return (
    <div className="order-modal-overlay" onClick={onClose}>
      <div className="order-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="order-detail-header">
          <h2>تفاصيل الطلب {order?.id ?? ''}</h2>
          <button type="button" className="order-detail-close" onClick={onClose} aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="order-detail-loading">جاري تحميل التفاصيل...</div>
        ) : order ? (
          <>
            <div className="order-detail-scroll">
              <div className="order-detail-body">
                <div className="order-detail-row two-cols">
                  <div className="order-detail-field">
                    <span className="order-detail-label">
                      {order.isPos ? 'بواسطة الموظف' : 'اسم العميل'}
                    </span>
                    <strong>{order.customerName}</strong>
                  </div>
                  {!order.isPos && order.buyerName && order.buyerName !== '—' && order.hasStaff && (
                    <div className="order-detail-field">
                      <span className="order-detail-label">الزبون</span>
                      <strong>{order.buyerName}</strong>
                    </div>
                  )}
                </div>

                {!order.isPos && order.phone && order.phone !== '—' && (
                  <div className="order-detail-field">
                    <span className="order-detail-label">رقم الهاتف</span>
                    <strong>{order.phone}</strong>
                  </div>
                )}

                <div className="order-detail-field">
                  <span className="order-detail-label">عنوان التوصيل</span>
                  <strong>{order.address}</strong>
                </div>

                <div className="order-detail-row two-cols">
                  <div className="order-detail-field">
                    <span className="order-detail-label">الحالة</span>
                    <span className={`order-status-badge ${getStatusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="order-detail-field">
                    <span className="order-detail-label">التاريخ</span>
                    <strong>{order.date}</strong>
                  </div>
                </div>

                {!order.isPos && (
                  <div className="order-detail-field">
                    <span className="order-detail-label">السائق</span>
                    <strong>
                      {order.hasDriver
                        ? order.driverName
                        : ['تم الشحن', 'قيد التوصيل'].includes(order.status)
                          ? 'في انتظار سائق متاح'
                          : '—'}
                    </strong>
                  </div>
                )}

                {order.paymentMethod && (
                  <div className="order-detail-field">
                    <span className="order-detail-label">طريقة الدفع</span>
                    <strong>{formatPayment(order.paymentMethod)}</strong>
                  </div>
                )}

                <div className="order-detail-field">
                  <span className="order-detail-label">المنتجات</span>
                  <div className="order-products-list">
                    {order.products?.length ? (
                      order.products.map((p, idx) => (
                        <div key={idx} className="order-product-item">
                          <span className="order-product-name">
                            {p.name}
                            {p.variantLabel ? ` (${p.variantLabel})` : ''}
                          </span>
                          <span className="order-product-meta">
                            {p.quantity > 1 ? `× ${p.quantity}` : ''}
                            {p.price > 0 ? `${p.quantity > 1 ? ' — ' : ''}${p.price} د.ل` : ''}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="order-product-item muted">لا توجد منتجات في هذا الطلب.</div>
                    )}
                  </div>
                </div>

                {order.notes && (
                  <div className="order-detail-field">
                    <span className="order-detail-label">ملاحظات</span>
                    <strong>{order.notes}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="order-detail-footer">
              <div className="order-detail-total">
                <span>الإجمالي:</span>
                <strong>{order.total} د.ل</strong>
              </div>
            </div>
          </>
        ) : (
          <div className="order-detail-loading">تعذّر تحميل بيانات الطلب.</div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailModal;
