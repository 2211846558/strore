import React, { useState } from 'react';
import { X } from 'lucide-react';
import './ShipmentDetailModal.css';

const ShipmentDetailModal = ({ isOpen, onClose, shipment, loading = false, onAdjust }) => {
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  if (!isOpen) return null;

  const totalQuantity = shipment?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  const handleAdjustSubmit = () => {
    if (!shipment?.variantId || !onAdjust) return;
    const qty = Number(adjustQty);
    if (Number.isNaN(qty) || qty === 0) return;
    onAdjust(shipment.variantId, qty, adjustReason);
    setAdjustQty('');
    setAdjustReason('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content shipment-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {loading ? 'جاري التحميل...' : `تفاصيل المخزون ${shipment?.code ?? ''}`}
          </h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="shipment-detail-body">
            <p>جاري تحميل التفاصيل...</p>
          </div>
        ) : shipment ? (
          <div className="shipment-detail-body">
            <div className="detail-info-row">
              <div className="detail-info-item">
                <span className="detail-label">SKU</span>
                <span className="detail-value">{shipment.batchNumber || shipment.code || '—'}</span>
              </div>
              <div className="detail-info-item">
                <span className="detail-label">التاريخ</span>
                <span className="detail-value">{shipment.date}</span>
              </div>
              <div className="detail-info-item">
                <span className="detail-label">الحالة</span>
                <span
                  className={`status-badge ${
                    shipment.statusRaw === 'received'
                      ? 'received'
                      : shipment.statusRaw === 'cancelled'
                        ? 'cancelled'
                        : 'pending'
                  }`}
                >
                  {shipment.status}
                </span>
              </div>
            </div>

            <h3 className="section-title">المنتجات في المخزون</h3>
            <div className="detail-items-list">
              {shipment.items.map((item, index) => (
                <div key={item.id || index} className="detail-item-row">
                  <div className="detail-item-info">
                    <span className="detail-item-name">{item.name}</span>
                    <span className="detail-item-meta">
                      التصنيف: {item.category} | التنوع:{' '}
                      {item.variantLabel || `${item.color} / ${item.size}`}
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

            {shipment.movements?.length > 0 && (
              <>
                <h3 className="section-title">سجل الحركات</h3>
                <div className="detail-items-list">
                  {shipment.movements.map((move) => (
                    <div key={move.id} className="detail-item-row">
                      <div className="detail-item-info">
                        <span className="detail-item-name">{move.type}</span>
                        <span className="detail-item-meta">{move.date}</span>
                      </div>
                      <div className="detail-item-qty">
                        <span className="qty-number">{move.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {shipment.variantId && onAdjust && (
              <div className="inventory-adjust-form">
                <h3 className="section-title">تعديل المخزون يدوياً</h3>
                <input
                  type="number"
                  placeholder="الكمية (+ أو -)"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  dir="ltr"
                />
                <input
                  type="text"
                  placeholder="سبب التعديل"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
                <button type="button" className="save-button" onClick={handleAdjustSubmit}>
                  تطبيق التعديل
                </button>
              </div>
            )}
          </div>
        ) : null}

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
