import React, { useMemo } from 'react';
import { X, Tag, Calendar, Percent } from 'lucide-react';
import { buildPromotionPricingRows, formatPromotionMoney } from '../../api/promotions';
import './OfferDetailModal.css';

const OfferDetailModal = ({
  isOpen,
  onClose,
  offer,
  catalogProducts = [],
  loading = false,
}) => {
  const pricingRows = useMemo(
    () => (offer ? buildPromotionPricingRows(offer, catalogProducts) : []),
    [offer, catalogProducts],
  );

  if (!isOpen) return null;

  const discountLabel =
    offer?.type === 'نسبة مئوية %'
      ? `${offer.value}%`
      : `${formatPromotionMoney(offer?.value)} د.ل`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content offer-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header offer-detail-header">
          <div className="offer-detail-title-wrap">
            <Tag size={20} className="offer-detail-icon" />
            <div>
              <h2 className="modal-title">تفاصيل العرض</h2>
              <p className="offer-detail-subtitle">{offer?.name ?? '—'}</p>
            </div>
          </div>
          <button className="close-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <p className="offer-detail-loading">جاري تحميل التفاصيل...</p>
        ) : offer ? (
          <div className="offer-detail-body">
            <div className="offer-detail-meta">
              <div className="offer-detail-meta-card">
                <span className="meta-label">الحالة</span>
                <strong>{offer.status}</strong>
              </div>
              <div className="offer-detail-meta-card">
                <span className="meta-label">نوع التخفيض</span>
                <strong>{offer.type}</strong>
              </div>
              <div className="offer-detail-meta-card highlight">
                <span className="meta-label">
                  <Percent size={14} />
                  قيمة التخفيض
                </span>
                <strong>{discountLabel}</strong>
              </div>
            </div>

            <div className="offer-detail-dates">
              <div className="offer-detail-date">
                <Calendar size={15} />
                <span>من {offer.startDate || '—'}</span>
              </div>
              <div className="offer-detail-date">
                <Calendar size={15} />
                <span>إلى {offer.endDate || '—'}</span>
              </div>
            </div>

            {offer.description ? (
              <p className="offer-detail-description">{offer.description}</p>
            ) : null}

            <div className="offer-detail-pricing">
              <h3>أسعار المنتجات المشمولة</h3>
              <div className="offer-pricing-table-wrap">
                <table className="offer-pricing-table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>قبل التخفيض</th>
                      <th>بعد التخفيض</th>
                      <th>التوفير</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingRows.length > 0 ? (
                      pricingRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td className="price-before">
                            {row.originalPrice != null
                              ? `${formatPromotionMoney(row.originalPrice)} د.ل`
                              : '—'}
                          </td>
                          <td className="price-after">
                            {row.discountedPrice != null
                              ? `${formatPromotionMoney(row.discountedPrice)} د.ل`
                              : '—'}
                          </td>
                          <td className="price-savings">
                            {row.savings != null && row.savings > 0
                              ? `${formatPromotionMoney(row.savings)} د.ل`
                              : '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="offer-pricing-empty">
                          لا توجد منتجات مشمولة في هذا العرض.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="offer-detail-loading">تعذّر تحميل تفاصيل العرض.</p>
        )}

        <div className="modal-footer offer-detail-footer">
          <button className="cancel-button" onClick={onClose} type="button">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfferDetailModal;
