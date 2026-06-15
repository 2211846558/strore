import React, { useState, useEffect } from 'react';
import { Eye, CheckCheck, CheckCircle2, Package, Store, AlertCircle, Bell, Loader } from 'lucide-react';
import NotificationDetailModal from '../components/notifications/NotificationDetailModal';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../api/notifications';
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
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  const loadNotifications = async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const res = await fetchNotifications({ perPage: 100 });
      const rawList = res?.data || [];
      const mapped = rawList.map(mapNotificationFromBackend);
      setNotifications(mapped);
      
      const count = res?.unread_count ?? mapped.filter((n) => !n.read).length;
      setUnreadCount(count);
      
      // Dispatch event to update sidebar
      window.dispatchEvent(new CustomEvent('unread-notifications-changed', { detail: count }));
      
      setError(null);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      if (!quiet) setError('تعذر تحميل الإشعارات. يرجى التحقق من اتصالك بالإنترنت.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => {
      loadNotifications(true);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      
      setUnreadCount((prev) => {
        const next = Math.max(0, prev - 1);
        window.dispatchEvent(new CustomEvent('unread-notifications-changed', { detail: next }));
        return next;
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('unread-notifications-changed', { detail: 0 }));
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
          <span>{error}</span>
          <button type="button" onClick={loadNotifications} className="retry-btn">
            إعادة المحاولة
          </button>
        </div>
      )}

      {loading ? (
        <div className="notifications-loading-container">
          <Loader size={32} />
          <p>جاري تحميل الإشعارات...</p>
        </div>
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
