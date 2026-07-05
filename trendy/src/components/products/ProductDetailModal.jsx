import React, { useState, useEffect } from 'react';
import { X, Box, Layers, BarChart2, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchManagedProductDetails, fetchProductVariants } from '../../api/products';
import { fetchShipments } from '../../api/inventory';
import { getApiErrorMessage } from '../../api/stores';
import './ProductDetailModal.css';

const ProductDetailModal = ({ isOpen, onClose, product, storeId, onEdit }) => {
  const [details, setDetails] = useState(null);
  const [variants, setVariants] = useState([]);
  const [shipmentsLog, setShipmentsLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedShipments, setExpandedShipments] = useState({});

  const toggleShipmentExpanded = (code) => {
    setExpandedShipments((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  useEffect(() => {
    if (!isOpen || !product?.id) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setDetails(null);
    setVariants([]);
    setShipmentsLog([]);
    setExpandedShipments({});

    fetchManagedProductDetails(product.id)
      .then((data) => {
        if (cancelled) return;
        setDetails(data);

        return fetchProductVariants(product.id, { productName: product.name }).then((variantData) => {
          if (cancelled) return;
          setVariants(variantData);

          return fetchShipments({ storeId }).then((result) => {
            if (cancelled) return;
            const shipmentsList = result?.shipments || [];
            const productShipments = [];
            shipmentsList.forEach((shipment) => {
              const matchingItems = shipment.items?.filter((item) =>
                variantData.some((v) => String(v.id) === String(item.variantId)),
              ) || [];

              if (matchingItems.length > 0) {
                const totalQuantity = matchingItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                const totalRemaining = matchingItems.reduce((sum, item) => sum + Number(item.remainingQuantity ?? Math.max(0, item.quantity - 10)), 0);
                const prices = matchingItems.map(item => Number(item.sellingPrice || data.price));
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const priceDisplay = minPrice === maxPrice ? String(minPrice) : `${minPrice} - ${maxPrice}`;

                productShipments.push({
                  code: shipment.code,
                  quantity: totalQuantity,
                  remaining: totalRemaining,
                  price: priceDisplay,
                  status:
                    shipment.statusRaw === 'received'
                      ? '✅ منتهية'
                      : shipment.statusRaw === 'pending' || shipment.statusRaw === 'draft'
                        ? '🟢 حالية'
                        : '🔒 في الانتظار',
                  matchingItems: matchingItems.map(item => ({
                    ...item,
                    variantLabel: item.variantLabel || item.name,
                    price: item.sellingPrice || data.price,
                  })),
                });
              }
            });

            setShipmentsLog(productShipments);
          });
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getApiErrorMessage(err, 'تعذّر تحميل تفاصيل المنتج.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, product?.id, storeId]);

  if (!isOpen || !product) return null;

  const display = details || product;
  const isArchived = display.status === 'مؤرشف';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content product-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="pd-title-wrap">
            <Box size={24} className="pd-icon" />
            <div>
              <h2 className="modal-title">تفاصيل المنتج</h2>
              <p className="pd-subtitle">{display.name}</p>
            </div>
          </div>
          <button className="close-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        <div className="product-detail-body">
          {error && <p className="form-error">{error}</p>}

          {loading && !details ? (
            <p className="loading-text">جاري تحميل التفاصيل...</p>
          ) : (
            <>
              {display.images?.length > 0 && (
                <div className="pd-images-section">
                  <span className="pd-images-label">صور المنتج</span>
                  <div className="pd-images-gallery">
                    {display.images.map((img, index) => (
                      <div key={img.id ?? `img-${index}`} className="pd-gallery-item">
                        <img src={img.url} alt={`${display.name} — ${index + 1}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {display.description && (
                <div className="pd-description-section">
                  <span className="pd-section-label">الوصف</span>
                  <p className="pd-description-text">{display.description}</p>
                </div>
              )}

              <div className="detail-cards-grid">
                <div className="detail-card">
                  <span className="card-label">التصنيف</span>
                  <span className="card-value">{display.category || '—'}</span>
                </div>
                <div className="detail-card">
                  <span className="card-label">SKU الأساسي</span>
                  <span className="card-value">{display.sku || '—'}</span>
                </div>
                <div className="detail-card">
                  <span className="card-label">السعر الافتراضي</span>
                  <span className="card-value">{display.price ? `${display.price} د.ل` : '—'}</span>
                </div>
                <div className="detail-card">
                  <span className="card-label">إجمالي المخزون</span>
                  <span className="card-value">
                    {display.stock === '0' || !display.stock ? (
                      <span className="out-of-stock-label">نفد من المخزون</span>
                    ) : (
                      `${display.stock} قطعة`
                    )}
                  </span>
                </div>
              </div>

              <div className="detail-section">
                <h3 className="section-title">
                  <Layers size={18} />
                  التنوعات الحالية ومخزونها
                </h3>
                {loading ? (
                  <p className="loading-text">جاري التحميل...</p>
                ) : variants.length === 0 ? (
                  <p className="empty-text">لا توجد تنوعات مضافة لهذا المنتج.</p>
                ) : (
                  <div className="variants-chips-list">
                    {variants.map((v) => (
                      <div key={v.id} className="variant-detail-chip">
                        <span className="vd-label">{v.label}</span>
                        <span className="vd-qty">{v.quantity || 0} قطعة</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3 className="section-title">
                  <BarChart2 size={18} />
                  سجل الشحنات (Shipment History)
                </h3>
                <div className="shipments-log-table-wrapper">
                  <table className="shipments-log-table">
                    <thead>
                      <tr>
                        <th>رقم الشحنة</th>
                        <th>الكمية في الشحنة</th>
                        <th>الكمية المتبقية</th>
                        <th>سعر البيع</th>
                        <th>الحالة</th>
                        <th>التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="6" className="no-results-cell">جاري تحميل سجل الشحنات...</td>
                        </tr>
                      ) : shipmentsLog.length > 0 ? (
                        shipmentsLog.map((sh, idx) => (
                          <React.Fragment key={sh.code || idx}>
                            <tr>
                              <td className="sh-code">{sh.code}</td>
                              <td>{sh.quantity} قطعة</td>
                              <td>{sh.remaining} قطعة</td>
                              <td>{sh.price} د.ل</td>
                              <td>
                                <span className={`status-badge-indicator ${
                                  sh.status.includes('منتهية') ? 'finished' : sh.status.includes('حالية') ? 'current' : 'waiting'
                                }`}>
                                  {sh.status}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="toggle-details-btn"
                                  onClick={() => toggleShipmentExpanded(sh.code)}
                                  title="عرض التنوعات"
                                >
                                  {expandedShipments[sh.code] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              </td>
                            </tr>
                            {expandedShipments[sh.code] && (
                              <tr className="expanded-details-row">
                                <td colSpan="6">
                                  <div className="expanded-details-container">
                                    <div className="details-header-title">التنوعات التي تحملها الشحنة:</div>
                                    <div className="details-variants-list">
                                      {sh.matchingItems.map((item, itemIdx) => (
                                        <div key={itemIdx} className="details-variant-item">
                                          <span className="variant-label-name">{item.variantLabel || item.name}</span>
                                          <span className="variant-qty-info">
                                            الكمية: {item.quantity} قطعة | المتبقي: {item.remainingQuantity ?? Math.max(0, item.quantity - 10)} قطعة | السعر: {item.price} د.ل
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="no-results-cell">لا توجد شحنات مسجلة لهذا المنتج.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} type="button">
            إغلاق
          </button>
          {onEdit && details && !isArchived && (
            <button
              className="save-button pd-edit-btn"
              onClick={() => onEdit(details)}
              type="button"
            >
              <Pencil size={16} />
              تعديل المنتج
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
