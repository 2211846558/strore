import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, X, CheckCircle2 } from 'lucide-react';
import OrderDropdown from '../components/orders/OrderDropdown';
import OrderDetailModal from '../components/orders/OrderDetailModal';
import OrderCancelModal from '../components/orders/OrderCancelModal';
import {
  fetchAllOrders,
  fetchOrder,
  cancelOrder,
  prepareOrder,
  canCancelOrderStatus,
  canPrepareOrder,
} from '../api/orders';
import { getApiErrorMessage } from '../api/stores';
import { useAuth } from '../context/AuthContext';
import {
  STATUS_FILTER_OPTIONS,
  getStatusBadgeClass,
} from '../data/ordersData';
import './Orders.css';

const Orders = () => {
  const { storeId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [detailModal, setDetailModal] = useState({ open: false, order: null, loading: false });
  const [cancelTarget, setCancelTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchAllOrders({
        storeId,
        search: debouncedSearch,
        status: statusFilter,
      });
      setOrders(list);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل الطلبات'));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, debouncedSearch, statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleCancelRequest = (order) => {
    if (!order || !canCancelOrderStatus(order.status)) return;
    setCancelTarget(order);
  };
  const handleConfirmCancel = async (reason) => {
    if (!cancelTarget) return;

    setCancellingId(cancelTarget.orderId);
    try {
      await cancelOrder(cancelTarget.orderId, reason);
      showToast(`تم إلغاء الطلب ${cancelTarget.id} بنجاح`);
      setCancelTarget(null);
      await loadOrders();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر إلغاء الطلب'));
    } finally {
      setCancellingId(null);
    }
  };

  const handlePrepare = async (order) => {
    if (!order || !canPrepareOrder(order)) return;
    setActionId(order.orderId);
    try {
      await prepareOrder(order.orderId);
      showToast(`تم تجهيز الطلب ${order.id} بنجاح`);
      await loadOrders();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تجهيز الطلب'));
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
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="البحث برقم الطلب أو اسم العميل..."
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
                  <span className="value">{order.customerName}</span>
                  <span
                    className="value"
                    style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}
                  >
                    {order.phone}
                  </span>
                </div>
                <div className="order-detail-item">
                  <span className="label">المنتجات</span>
                  <span className="value">
                    {order.productsCount ?? order.products.length} منتج
                  </span>
                </div>
                <div className="order-detail-item">
                  <span className="label">الإجمالي</span>
                  <span className="value total">{order.total} د.ل</span>
                </div>
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

                {canPrepareOrder(order) && (
                  <button
                    type="button"
                    className="order-btn-view"
                    onClick={() => handlePrepare(order)}
                    disabled={actionId === order.orderId}
                  >
                    تجهيز الطلب
                  </button>
                )}

                <button
                  type="button"
                  className="order-btn-cancel"
                  onClick={() => handleCancelRequest(order)}
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

      <OrderCancelModal
        isOpen={!!cancelTarget}
        onClose={() => !cancellingId && setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        order={cancelTarget}
        isSaving={Boolean(cancellingId)}
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
