import React from 'react';
import { X } from 'lucide-react';
import './OrderDetailModal.css';

const OrderDetailModal = ({ isOpen, onClose, order }) => {
  if (!isOpen || !order) return null;

  return (
    <div className="order-modal-overlay" onClick={onClose}>
      <div className="order-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="order-detail-header">
          <h2>تفاصيل الطلب {order.id}</h2>
          <button type="button" className="order-detail-close" onClick={onClose} aria-label="إغلاق">
            <X size={24} />
          </button>
        </div>

        <div className="order-detail-body">
          <div className="order-detail-row two-cols">
            <div className="order-detail-field">
              <span className="order-detail-label">اسم العميل</span>
              <strong>{order.customerName}</strong>
            </div>
            <div className="order-detail-field">
              <span className="order-detail-label">رقم الهاتف</span>
              <strong>{order.phone}</strong>
            </div>
          </div>

          <div className="order-detail-field">
            <span className="order-detail-label">عنوان التوصيل</span>
            <strong>{order.address}</strong>
          </div>

          <div className="order-detail-field">
            <span className="order-detail-label">المنتجات</span>
            <div className="order-products-list">
              {order.products.map((p, idx) => (
                <div key={idx} className="order-product-item">
                  {p.name}
                </div>
              ))}
            </div>
          </div>

          <div className="order-detail-total">
            <span>الإجمالي:</span>
            <strong>{order.total} د.ل</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailModal;
