import React, { useState, useMemo } from 'react';
import { Search, Eye, X, CheckCircle2 } from 'lucide-react';
import OrderDropdown from '../components/orders/OrderDropdown';
import OrderDetailModal from '../components/orders/OrderDetailModal';
import {
  initialOrders,
  STATUS_FILTER_OPTIONS,
  ORDER_STATUSES,
  getStatusBadgeClass,
  canCancelOrder,
} from '../data/ordersData';
import './Orders.css';

const Orders = () => {
  const [orders, setOrders] = useState(initialOrders);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailOrder, setDetailOrder] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const matchSearch =
        !q ||
        order.id.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.phone.includes(searchQuery.trim());
      const matchStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const handleStatusChange = (orderId, newStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === newStatus) return;

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    showToast(`تم تحديث حالة الطلب ${orderId} إلى «${newStatus}»`);
  };

  const handleCancel = (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || !canCancelOrder(order.status)) return;

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'ملغي' } : o))
    );
    showToast(`تم إلغاء الطلب ${orderId} بنجاح`);
  };

  const openDetails = (order) => {
    setDetailOrder(order);
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

      <div className="orders-list">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <article key={order.id} className="order-card">
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
                  <span className="label">العميل</span>
                  <span className="value">{order.customerName}</span>
                  <span className="value" style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {order.phone}
                  </span>
                </div>
                <div className="order-detail-item">
                  <span className="label">المنتجات</span>
                  <span className="value">{order.products.length} منتج</span>
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

                <OrderDropdown
                  className="compact"
                  value={order.status}
                  options={ORDER_STATUSES}
                  onChange={(status) => handleStatusChange(order.id, status)}
                />

                <button
                  type="button"
                  className="order-btn-cancel"
                  onClick={() => handleCancel(order.id)}
                  disabled={!canCancelOrder(order.status)}
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
        isOpen={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        order={detailOrder ? orders.find((o) => o.id === detailOrder.id) : null}
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
