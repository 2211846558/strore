import React from 'react';
import { X } from 'lucide-react';
import './ShipmentDetailModal.css';

const ShipmentDetailModal = ({ isOpen, onClose, shipment }) => {
  if (!isOpen || !shipment) return null;

  const totalQuantity = shipment.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content shipment-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">تفاصيل الشحنة {shipment.code}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="shipment-detail-body">
          <div className="detail-info-row">
            <div className="detail-info-item">
              <span className="detail-label">التاريخ</span>
              <span className="detail-value">{shipment.date}</span>
            </div>
            <div className="detail-info-item">
              <span className="detail-label">الحالة</span>
              <span
                className={`status-badge ${
                  shipment.status === 'مستلمة' ? 'received' : 'pending'
                }`}
              >
                {shipment.status}
              </span>
            </div>
          </div>

          <h3 className="section-title">المنتجات في الشحنة</h3>
          <div className="detail-items-list">
            {shipment.items.map((item, index) => (
              <div key={item.id || index} className="detail-item-row">
                <div className="detail-item-info">
                  <span className="detail-item-name">{item.name}</span>
                  <span className="detail-item-meta">
                    التصنيف: {item.category} | اللون: {item.color} | المقاس: {item.size}
                  </span>
                </div>
                <div className="detail-item-qty">
                  <span className="qty-number">{item.quantity}</span>
                  <span className="qty-label">قطعة</span>
                </div>
              </div>
            ))}
          </div>

          <div className="detail-total">
            <span className="total-label">الإجمالي</span>
            <span className="total-value">{totalQuantity} قطعة</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="save-button" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShipmentDetailModal;
