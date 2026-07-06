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

function formatVariantAttribute({ name, value }) {
  return name ? `${name}: ${value}` : value;
}

function getProductAttributes(product) {
  if (product.variantAttributes?.length) {
    return product.variantAttributes;
  }
  const attrs = [];
  const color = product.color ?? product.variant?.color ?? product.variant_color;
  const size = product.size ?? product.variant?.size ?? product.variant_size;

  if (color && color !== '—') {
    attrs.push({ name: 'اللون', value: color });
  }
  if (size && size !== '—' && size !== 'واحد') {
    attrs.push({ name: 'المقاس', value: size });
  }
  return attrs;
}

function getVariantLabel(product) {
  return product.variantLabel ?? product.variant?.label ?? product.variant_label ?? '';
}

function getDriverName(order) {
  if (!order) return null;
  const name = order.driverName ??
    order.driver?.name ??
    order.driver?.user?.name ??
    order.raw?.driver?.name ??
    order.raw?.driver?.user?.name ??
    order.raw?.driver_name;
  return name && name !== '—' ? name : null;
}

function hasVariantDetails(product) {
  return (
    getProductAttributes(product).length > 0
    || (getVariantLabel(product) && getVariantLabel(product) !== '—')
  );
}

const OrderDetailModal = ({
  isOpen,
  onClose,
  order,
  loading = false,
  showPosActions = false,
  onRefundLine,
  onExchangeLine,
  actionsDisabled = false,
}) => {
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
                    <span className="order-detail-label">النوع</span>
                    <strong>{order.isPos ? 'مبيعات مباشرة' : 'طلب أونلاين'}</strong>
                  </div>
                </div>

                <div className="order-detail-field">
                  <span className="order-detail-label">التاريخ</span>
                  <strong>{order.date}</strong>
                </div>

                {!order.isPos && (
                  <div className="order-detail-field">
                    <span className="order-detail-label">السائق</span>
                    <strong>
                      {getDriverName(order)
                        ? getDriverName(order)
                        : ['shipped', 'out_for_delivery', 'delivering'].includes(order.statusRaw?.toLowerCase()) || ['تم الشحن', 'قيد التوصيل'].includes(order.status)
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
                          <div className="order-product-item-main">
                            <div className="order-product-info">
                              <span className="order-product-name">{p.name}</span>
                              {getProductAttributes(p).length ? (
                                <div className="order-product-variant">
                                  {getProductAttributes(p).map((attr, aIdx) => (
                                    <span key={aIdx} className="order-product-variant-tag">
                                      {formatVariantAttribute(attr)}
                                    </span>
                                  ))}
                                </div>
                              ) : getVariantLabel(p) && getVariantLabel(p) !== '—' ? (
                                <div className="order-product-variant">
                                  <span className="order-product-variant-tag">
                                    {getVariantLabel(p)}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                            <span className="order-product-meta">
                              {p.quantity > 1 ? `× ${p.quantity}` : ''}
                              {p.price > 0 ? `${p.quantity > 1 ? ' — ' : ''}${p.price} د.ل` : ''}
                            </span>
                          </div>
                          {showPosActions && (onRefundLine || onExchangeLine) && (
                            <div className="order-product-pos-actions">
                              {onRefundLine && (
                                <button
                                  type="button"
                                  className="order-product-pos-btn refund"
                                  onClick={() => onRefundLine(p)}
                                  disabled={actionsDisabled}
                                >
                                  استرداد
                                </button>
                              )}
                              {onExchangeLine && (
                                <button
                                  type="button"
                                  className="order-product-pos-btn exchange"
                                  onClick={() => onExchangeLine(p)}
                                  disabled={actionsDisabled}
                                >
                                  استبدال
                                </button>
                              )}
                            </div>
                          )}
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
