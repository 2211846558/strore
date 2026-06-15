import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Package, Store, AlertCircle, Bell, Loader } from 'lucide-react';
import { fetchOrder, prepareOrder, canPrepareOrder } from '../../api/orders';
import { getStatusBadgeClass } from '../../data/ordersData';
import './NotificationDetailModal.css';

const ICONS = {
  order: Package,
  store: Store,
  stock: AlertCircle,
  system: Bell,
};

const NotificationDetailModal = ({ isOpen, onClose, notification, onOrderPrepared }) => {
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [orderError, setOrderError] = useState(null);

  useEffect(() => {
    if (isOpen && notification && notification.type === 'order') {
      const orderId = notification.data?.order_id;
      if (orderId) {
        const loadOrder = async () => {
          setLoadingOrder(true);
          setOrderError(null);
          try {
            const details = await fetchOrder(orderId);
            setOrder(details);
          } catch (err) {
            console.error('Error fetching order details:', err);
            setOrderError('تعذر تحميل تفاصيل الطلب.');
          } finally {
            setLoadingOrder(false);
          }
        };
        loadOrder();
      } else {
        setOrder(null);
      }
    } else {
      setOrder(null);
      setOrderError(null);
    }
  }, [isOpen, notification]);

  if (!isOpen || !notification) return null;

  const Icon = ICONS[notification.type] || Bell;
  const iconClass = `notification-detail-icon ${notification.type}`;

  const handleAction = () => {
    if (notification.actionPath) {
      navigate(notification.actionPath);
      onClose();
    }
  };

  const handlePrepareOrder = async () => {
    if (!order || !canPrepareOrder(order)) return;
    setActionLoading(true);
    try {
      await prepareOrder(order.orderId);
      const updatedOrder = await fetchOrder(order.orderId);
      setOrder(updatedOrder);
      if (onOrderPrepared) {
        onOrderPrepared(true);
      }
    } catch (err) {
      console.error('Error preparing order:', err);
      alert('تعذر تجهيز الطلب. يرجى المحاولة لاحقاً.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="notification-modal-overlay" onClick={onClose}>
      <div className="notification-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notification-detail-header">
          <h2>تفاصيل الإشعار</h2>
          <button type="button" className="notification-detail-close" onClick={onClose} aria-label="إغلاق">
            <X size={24} />
          </button>
        </div>

        <div className="notification-detail-summary">
          <div className={iconClass}>
            <Icon size={28} />
          </div>
          <div>
            <p className="notification-detail-title">{notification.title}</p>
            <p className="notification-detail-time">{notification.datetime}</p>
          </div>
        </div>

        <div className="notification-detail-message">{notification.message}</div>

        {notification.type === 'order' && (
          <div className="notification-order-section">
            {loadingOrder ? (
              <div className="notification-order-loading">
                <Loader size={20} className="notification-spin" />
                <span>جاري تحميل تفاصيل الطلب...</span>
              </div>
            ) : orderError ? (
              <div className="notification-order-error">{orderError}</div>
            ) : order ? (
              <div className="notification-order-details">
                <h3 className="notification-order-title">تفاصيل الطلب (رقم: {order.id})</h3>
                
                <div className="notification-order-info">
                  <div className="notification-order-field">
                    <span className="label">{order.isPos ? 'بواسطة الموظف' : 'العميل'}</span>
                    <span className="value">{order.customerName}</span>
                  </div>
                  {!order.isPos && (
                    <div className="notification-order-field">
                      <span className="label">رقم الهاتف</span>
                      <span className="value">{order.phone}</span>
                    </div>
                  )}
                  <div className="notification-order-field">
                    <span className="label">العنوان</span>
                    <span className="value">{order.address}</span>
                  </div>
                  <div className="notification-order-field">
                    <span className="label">حالة الطلب</span>
                    <span className={`order-status-badge ${getStatusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="notification-order-products">
                  {order.products?.map((p, idx) => (
                    <div key={idx} className="notification-order-product-item">
                      <span>{p.name}</span>
                      <span>{p.quantity} × {p.price} د.ل</span>
                    </div>
                  ))}
                </div>

                <div className="notification-order-total">
                  <span>الإجمالي:</span>
                  <strong>{order.total} د.ل</strong>
                </div>

                {canPrepareOrder(order) && (
                  <button
                    type="button"
                    className="notification-order-btn-prepare"
                    onClick={handlePrepareOrder}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <>
                        <Loader size={16} className="notification-spin" />
                        <span>جاري التجهيز...</span>
                      </>
                    ) : (
                      'تجهيز الطلب'
                    )}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}

        {notification.actionLabel && notification.actionPath && !order && (
          <button type="button" className="notification-detail-action" onClick={handleAction}>
            {notification.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationDetailModal;

