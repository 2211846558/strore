import React from 'react';
import {
  X, Truck, Calendar, Package,
  CheckCircle2, Clock, XCircle, Tag, Hash, Layers
} from 'lucide-react';
import './ShipmentDetailModal.css';

const STATUS_MAP = {
  received: { Icon: CheckCircle2, cls: 'received', label: 'مستلمة' },
  pending:  { Icon: Clock,         cls: 'pending',  label: 'قيد الانتظار' },
  cancelled:{ Icon: XCircle,       cls: 'cancelled',label: 'ملغاة' },
};

/* تجميع العناصر حسب المنتج */
function groupByProduct(items = []) {
  const map = {};
  items.forEach((item) => {
    const key = item.name || '—';
    if (!map[key]) map[key] = { name: key, category: item.category || '—', variants: [] };
    map[key].variants.push(item);
  });
  return Object.values(map);
}

const ShipmentDetailModal = ({ isOpen, onClose, shipment }) => {
  if (!isOpen || !shipment) return null;

  const statusInfo = STATUS_MAP[shipment.statusRaw] ?? STATUS_MAP.pending;
  const { Icon: StatusIcon } = statusInfo;

  const productGroups = groupByProduct(shipment.items);
  const totalQty = (shipment.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0);

  /* سعر البيع من أول عنصر */
  const sampleItem = shipment.items?.[0];
  const sellingPrice = sampleItem?.sellingPrice ?? null;
  const unitCost    = sampleItem?.unitCost ?? null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content shipment-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="modal-header sdm-header">
          <div className="sdm-title-wrap">
            <Truck size={22} className="sdm-icon" />
            <div>
              <h2 className="modal-title">تفاصيل الشحنة</h2>
              <p className="sdm-code">{shipment.code}</p>
            </div>
          </div>
          <button className="close-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        {/* ── Meta cards ── */}
        <div className="sdm-body">
          <div className="sdm-meta-grid">
            <div className="sdm-meta-card">
              <span className="sdm-meta-icon"><Calendar size={15} /></span>
              <div>
                <span className="sdm-meta-label">تاريخ الشحنة</span>
                <span className="sdm-meta-value">{shipment.date || '—'}</span>
              </div>
            </div>
            <div className="sdm-meta-card">
              <span className="sdm-meta-icon"><Hash size={15} /></span>
              <div>
                <span className="sdm-meta-label">رقم الدفعة</span>
                <span className="sdm-meta-value">{shipment.batchNumber || shipment.code}</span>
              </div>
            </div>
            <div className="sdm-meta-card">
              <span className="sdm-meta-icon"><Package size={15} /></span>
              <div>
                <span className="sdm-meta-label">إجمالي القطع</span>
                <span className="sdm-meta-value">{totalQty} قطعة</span>
              </div>
            </div>
            <div className="sdm-meta-card">
              <span className="sdm-meta-icon"><StatusIcon size={15} className={statusInfo.cls} /></span>
              <div>
                <span className="sdm-meta-label">الحالة</span>
                <span className={`sdm-meta-value sdm-status ${statusInfo.cls}`}>
                  {statusInfo.label}
                </span>
              </div>
            </div>
            {sellingPrice != null && (
              <div className="sdm-meta-card">
                <span className="sdm-meta-icon"><Tag size={15} /></span>
                <div>
                  <span className="sdm-meta-label">سعر البيع</span>
                  <span className="sdm-meta-value">{sellingPrice} د.ل</span>
                </div>
              </div>
            )}
            {unitCost != null && (
              <div className="sdm-meta-card">
                <span className="sdm-meta-icon"><Tag size={15} /></span>
                <div>
                  <span className="sdm-meta-label">سعر الشراء</span>
                  <span className="sdm-meta-value">{unitCost} د.ل</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Products & Variants ── */}
          <div className="sdm-products-section">
            <h3 className="sdm-section-title">
              <Layers size={17} />
              التنوعات داخل الشحنة
            </h3>

            {productGroups.length === 0 ? (
              <p className="sdm-empty">لا توجد تنوعات مسجلة في هذه الشحنة.</p>
            ) : (
              productGroups.map((group) => (
                <div key={group.name} className="sdm-product-group">
                  {/* Product header */}
                  <div className="sdm-product-header">
                    <span className="sdm-product-name">{group.name}</span>
                    {group.category && group.category !== '—' && (
                      <span className="sdm-product-category">{group.category}</span>
                    )}
                  </div>

                  {/* Variants table */}
                  <div className="sdm-variants-table-wrap">
                    <table className="sdm-variants-table">
                      <thead>
                        <tr>
                          <th>التنوع</th>
                          <th>الكمية في الشحنة</th>
                          <th>سعر الشراء</th>
                          <th>سعر البيع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.variants.map((variant, idx) => (
                          <tr key={variant.variantId || idx}>
                            <td className="sdm-variant-label">
                              {variant.variantLabel || `${variant.color} / ${variant.size}` || '—'}
                            </td>
                            <td>
                              <span className="sdm-qty-badge">{variant.quantity} قطعة</span>
                            </td>
                            <td className="sdm-price">
                              {variant.unitCost != null ? `${variant.unitCost} د.ل` : '—'}
                            </td>
                            <td className="sdm-price">
                              {variant.sellingPrice != null ? `${variant.sellingPrice} د.ل` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Total row ── */}
          <div className="sdm-total-row">
            <span className="sdm-total-label">إجمالي الكميات في الشحنة</span>
            <span className="sdm-total-value">{totalQty} قطعة</span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} type="button">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShipmentDetailModal;
