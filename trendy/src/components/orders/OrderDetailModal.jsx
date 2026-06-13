import React from 'react';
import { X } from 'lucide-react';
import './OrderDetailModal.css';

const OrderDetailModal = ({ isOpen, onClose, order, loading = false }) => {
  if (!isOpen) return null;

  return (
    <div className="order-modal-overlay" onClick={onClose}>
      <div className="order-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="order-detail-header">
          <h2>تفاصيل الطلب {order?.id ?? ''}</h2>
          <button type="button" className="order-detail-close" onClick={onClose} aria-label="إغلاق">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="order-detail-loading">جاري تحميل التفاصيل...</div>
        ) : order ? (
          <div className="order-detail-body">
            <div className="order-detail-row two-cols">
              <div className="order-detail-field">
                <span className="order-detail-label">الموظف</span>
                <strong>{order.staffName}</strong>
              </div>
              {!order.isPos && order.buyerName && order.buyerName !== '—' && (
                <div className="order-detail-field">
                  <span className="order-detail-label">الزبون</span>
                  <strong>{order.buyerName}</strong>
                </div>
              )}
            </div>

            {!order.isPos && order.phone && order.phone !== '—' && (
              <div className="order-detail-field">
                <span className="order-detail-label">رقم هاتف الزبون</span>
                <strong>{order.phone}</strong>
              </div>
            )}

            <div className="order-detail-field">
              <span className="order-detail-label">عنوان التوصيل</span>
              <strong>{order.address}</strong>
            </div>

            <div className="order-detail-field">
              <span className="order-detail-label">الحالة</span>
              <strong>{order.status}</strong>
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

            <div className="order-detail-field">
              <span className="order-detail-label">المنتجات</span>
              <div className="order-products-list">
                {order.products?.length ? (
                  order.products.map((p, idx) => (
                    <div key={idx} className="order-product-item">
                      <span>{p.name}</span>
                      <span>
                        {p.quantity > 1 ? `× ${p.quantity}` : ''}
                        {p.price > 0 ? ` — ${p.price} د.ل` : ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="order-product-item muted">لا توجد منتجات في هذا الطلب.</div>
                )}
              </div>
            </div>

            <div className="order-detail-total">
              <span>الإجمالي:</span>
              <strong>{order.total} د.ل</strong>
            </div>
          </div>
        ) : (
          <div className="order-detail-loading">تعذّر تحميل بيانات الطلب.</div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailModal;
