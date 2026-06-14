import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, X, CheckCircle2 } from 'lucide-react';
import OrderDropdown from '../components/orders/OrderDropdown';
import OrderDetailModal from '../components/orders/OrderDetailModal';
import {
  fetchAllOrders,
  fetchOrder,
  updateOrderStatus,
  cancelOrder,
  dispatchOrderForDelivery,
  buildDispatchToast,
  canCancelOrderStatus,
  canPrepareOrder,
  canDispatchOrder,
  shouldDispatchToDriver,
} from '../api/orders';
import { getApiErrorMessage } from '../api/stores';
import { useAuth } from '../context/AuthContext';
import {
  STATUS_FILTER_OPTIONS,
  ORDER_STATUSES,
  getStatusBadgeClass,
} from '../data/ordersData';
import './Orders.css';

function formatOrderProductsLabel(products = []) {
  const list = Array.isArray(products) ? products.filter((p) => p?.name && p.name !== '—') : [];
  if (!list.length) return 'لا توجد منتجات';

  const names = list.map((p) => {
    const qty = Number(p.quantity ?? 1);
    return qty > 1 ? `${p.name} ×${qty}` : p.name;
  });

  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join('، ');
  return `${names.slice(0, 2).join('، ')} +${names.length - 2} أخرى`;
}

const Orders = () => {
  const { storeId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [detailModal, setDetailModal] = useState({ open: false, order: null, loading: false });
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      let list = await fetchAllOrders({
        storeId,
        search: debouncedSearch,
        status: statusFilter,
        excludePos: false,
      });
      if (statusFilter === 'جديد') {
        list = list.filter((order) => !order.isPos);
      }
      setOrders(list);
    } catch (err) {
      if (!quiet) {
        setError(getApiErrorMessage(err, 'تعذّر تحميل الطلبات'));
        setOrders([]);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [storeId, debouncedSearch, statusFilter]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => {
      loadOrders(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleStatusChange = async (order, newStatus) => {
    if (!order || order.status === newStatus) return;

    setUpdatingId(order.orderId);
    try {
      if (shouldDispatchToDriver(newStatus)) {
        const updated = await dispatchOrderForDelivery(order);
        showToast(buildDispatchToast(updated));
      } else {
        await updateOrderStatus(order.orderId, newStatus);
        showToast(`تم تحديث حالة الطلب ${order.id} إلى «${newStatus}»`);
      }
      await loadOrders();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تحديث حالة الطلب'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancel = async (order) => {
    if (!order || !canCancelOrderStatus(order.status)) return;

    const confirmed = window.confirm(`هل تريد إلغاء الطلب ${order.id}؟`);
    if (!confirmed) return;

    const reason = window.prompt('سبب الإلغاء:', 'إلغاء من المتجر');
    if (reason === null) return;

    setCancellingId(order.orderId);
    try {
      await cancelOrder(order.orderId, reason);
      showToast(`تم إلغاء الطلب ${order.id} بنجاح`);
      await loadOrders();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر إلغاء الطلب'));
    } finally {
      setCancellingId(null);
    }
  };

  const handleDispatch = async (order) => {
    if (!order || !canDispatchOrder(order)) return;
    setActionId(order.orderId);
    try {
      const updated = await dispatchOrderForDelivery(order);
      showToast(buildDispatchToast(updated));
      await loadOrders();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر إرسال الطلب للتوصيل'));
    } finally {
      setActionId(null);
    }
  };

  const openDetails = async (order) => {
    setDetailModal({ open: true, order: null, loading: true });
    try {
      const details = await fetchOrder(order.orderId);
      setDetailModal({ open: true, order: details, loading: false });
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تحميل تفاصيل الطلب'));
      setDetailModal({ open: false, order: null, loading: false });
    }
  };

  return (
    <div className="orders-page">
      <header className="page-header orders-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">إدارة الطلبات</h1>
          <p className="page-subtitle">متابعة ومعالجة طلبات العملاء</p>
        </div>
      </header>

      <div className="orders-controls">
        <div className="orders-search">
          <Search size={20} color="#9ca3af" />
          <input
            type="text"
            placeholder="البحث برقم الطلب أو اسم الموظف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <OrderDropdown
          value={statusFilter}
          options={STATUS_FILTER_OPTIONS}
          onChange={setStatusFilter}
        />
      </div>

      {error && <div className="orders-error">{error}</div>}

      <div className="orders-list">
        {loading ? (
          <p className="orders-empty">جاري تحميل الطلبات...</p>
        ) : orders.length > 0 ? (
          orders.map((order) => (
            <article key={order.orderId} className="order-card">
              <div className="order-card-top">
                <span className={`order-status-badge ${getStatusBadgeClass(order.status)}`}>
                  {order.status}
                </span>
                <div className="order-card-title">
                  <h3>طلب رقم: {order.id}</h3>
                  <p>{order.date}</p>
                </div>
              </div>

              <div className="order-card-details">
                <div className="order-detail-item">
                  <span className="label">الموظف</span>
                  <span className="value">{order.staffName}</span>
                </div>
                <div className="order-detail-item">
                  <span className="label">المنتج</span>
                  <span className="value">{formatOrderProductsLabel(order.products)}</span>
                </div>
                <div className="order-detail-item">
                  <span className="label">الإجمالي</span>
                  <span className="value total">{order.total} د.ل</span>
                </div>
                {!order.isPos && (
                  <div className="order-detail-item">
                    <span className="label">السائق</span>
                    <span className="value">
                      {order.hasDriver
                        ? order.driverName
                        : ['تم الشحن', 'قيد التوصيل'].includes(order.status)
                          ? 'في انتظار سائق'
                          : '—'}
                    </span>
                  </div>
                )}
              </div>

              <div className="order-card-actions">
                <button
                  type="button"
                  className="order-btn-view"
                  onClick={() => openDetails(order)}
                >
                  <Eye size={16} />
                  عرض التفاصيل
                </button>

                {canPrepareOrder(order) ? (
                  <OrderDropdown
                    className="compact"
                    value={order.status}
                    options={ORDER_STATUSES}
                    onChange={(status) => handleStatusChange(order, status)}
                  />
                ) : (
                  <span
                    className={`order-status-badge ${getStatusBadgeClass(order.status)}`}
                    style={{ padding: '10px 16px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center' }}
                  >
                    حالة الطلب: {order.status}
                  </span>
                )}

                {canPrepareOrder(order) && (
                  <button
                    type="button"
                    className="order-btn-view"
                    onClick={() => handleDispatch(order)}
                    disabled={actionId === order.orderId}
                  >
                    إرسال للتوصيل
                  </button>
                )}

                {canDispatchOrder(order) && !canPrepareOrder(order) && (
                  <button
                    type="button"
                    className="order-btn-view"
                    onClick={() => handleDispatch(order)}
                    disabled={actionId === order.orderId}
                  >
                    تعيين سائق
                  </button>
                )}

                <button
                  type="button"
                  className="order-btn-cancel"
                  onClick={() => handleCancel(order)}
                  disabled={
                    !canCancelOrderStatus(order.status) || cancellingId === order.orderId
                  }
                >
                  <X size={16} />
                  إلغاء الطلب
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="orders-empty">لا توجد طلبات تطابق بحثك.</p>
        )}
      </div>

      <OrderDetailModal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, order: null, loading: false })}
        order={detailModal.order}
        loading={detailModal.loading}
      />

      {toast && (
        <div className="orders-toast">
          <CheckCircle2 size={20} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default Orders;
