import React, { useState, useEffect, useMemo } from 'react';
import { Eye, CheckCheck, CheckCircle2, Package, Store, AlertCircle, Bell } from 'lucide-react';
import NotificationDetailModal from '../components/notifications/NotificationDetailModal';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '../api/hooks/useNotifications';
import './Notifications.css';

const ICONS = {
  order: Package,
  store: Store,
  stock: AlertCircle,
  system: Bell,
};

const mapNotificationFromBackend = (n) => {
  const event = n.data?.event || '';
  
  let type = 'system';
  let actionPath = null;
  let actionLabel = null;

  switch (event) {
    case 'new_order':
      type = 'order';
      actionPath = '/orders';
      actionLabel = 'عرض الطلب';
      break;
    case 'low_stock':
      type = 'stock';
      actionPath = '/inventory';
      actionLabel = 'عرض المخزون';
      break;
    case 'custody_settlement':
      type = 'store';
      actionPath = '/finance';
      actionLabel = 'عرض المالية';
      break;
    case 'plan_subscription':
    case 'plan_expiry_reminder':
      type = 'store';
      actionPath = '/plans';
      actionLabel = 'عرض الاشتراك';
      break;
    case 'campaign_created':
    case 'campaign_subscription':
      type = 'system';
      actionPath = '/marketing';
      actionLabel = 'عرض التسويق';
      break;
    default:
      if (n.type === 'warning' || n.type === 'critical') {
        type = 'stock';
      } else if (n.type === 'store') {
        type = 'store';
      } else {
        type = 'system';
      }
      break;
  }

  let datetime = n.created_at || '';
  if (datetime) {
    datetime = datetime.replace('T', ' ').substring(0, 16);
  }

  return {
    id: n.id,
    type,
    title: n.title,
    message: n.body || '',
    datetime,
    read: Boolean(n.read),
    actionLabel,
    actionPath,
    data: n.data,
  };
};

const Notifications = () => {
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  const { data: notifRes, isLoading: loading, error } = useNotifications({ perPage: 100 });
  const markReadMutation = useMarkAsRead();
  const markAllMutation = useMarkAllAsRead();

  const rawList = notifRes?.data ?? [];
  const notifications = rawList.map(mapNotificationFromBackend);

  const unreadCount = notifRes?.unread_count ?? notifications.filter((n) => !n.read).length;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('unread-notifications-changed', { detail: unreadCount }));
  }, [unreadCount]);

  const handleMarkAsRead = async (id) => {
    try {
      await markReadMutation.mutateAsync(id);
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await markAllMutation.mutateAsync();
      showToast('تم تحديد جميع الإشعارات كمقروءة');
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      showToast('حدث خطأ أثناء تحديد الإشعارات كمقروءة');
    }
  };

  const handleView = (notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    setSelectedNotification(notification);
  };

  const handleCloseModal = () => {
    setSelectedNotification(null);
  };

  const activeNotification = selectedNotification
    ? notifications.find((n) => n.id === selectedNotification.id)
    : null;

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <div className="notifications-header-text">
          <h1 className="page-title">الإشعارات</h1>
          <p className="page-subtitle">
            {loading
              ? 'جاري التحميل...'
              : unreadCount > 0
              ? `لديك ${unreadCount} إشعار غير مقروء`
              : 'جميع الإشعارات مقروءة'}
          </p>
        </div>

        <button
          type="button"
          className="mark-all-read-btn"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0 || loading}
        >
          <CheckCheck size={18} />
          تحديد الكل كمقروء
        </button>
      </header>

      {error && (
        <div className="notifications-error-box">
          <AlertCircle size={20} />
          <span>{error?.message || 'تعذر تحميل الإشعارات. يرجى التحقق من اتصالك بالإنترنت.'}</span>
        </div>
      )}

      {loading ? (
        <p className="notifications-empty">جاري تحميل الإشعارات...</p>
      ) : (
        <div className="notifications-list">
          {notifications.length > 0 ? (
            notifications.map((notification) => {
              const Icon = ICONS[notification.type] || Bell;
              return (
                <article
                  key={notification.id}
                  className={`notification-card${notification.read ? '' : ' unread'}`}
                >
                  <div className={`notification-icon-wrap ${notification.type}`}>
                    <Icon size={22} />
                  </div>

                  <div className="notification-content">
                    <h3>{notification.title}</h3>
                    <p>{notification.message}</p>
                    <span className="notification-time">{notification.datetime}</span>
                  </div>

                  <div className="notification-actions">
                    {!notification.read && (
                      <span className="notification-new-badge">جديد</span>
                    )}
                    <button
                      type="button"
                      className="notification-view-btn"
                      onClick={() => handleView(notification)}
                      title="عرض التفاصيل"
                      aria-label="عرض التفاصيل"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="notifications-empty">لا توجد إشعارات.</p>
          )}
        </div>
      )}

      <NotificationDetailModal
        isOpen={!!selectedNotification}
        onClose={handleCloseModal}
        notification={activeNotification}
        onOrderPrepared={loadNotifications}
      />

      {toast && (
        <div className="notifications-toast">
          <CheckCircle2 size={20} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default Notifications;
