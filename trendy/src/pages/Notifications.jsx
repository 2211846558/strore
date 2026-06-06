import React, { useState, useMemo } from 'react';
import { Eye, CheckCheck, CheckCircle2, Package, Store, AlertCircle, Bell } from 'lucide-react';
import NotificationDetailModal from '../components/notifications/NotificationDetailModal';
import { initialNotifications } from '../data/notificationsData';
import './Notifications.css';

const ICONS = {
  order: Package,
  store: Store,
  stock: AlertCircle,
  system: Bell,
};

const Notifications = () => {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast('تم تحديد جميع الإشعارات كمقروءة');
  };

  const handleView = (notification) => {
    markAsRead(notification.id);
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
            {unreadCount > 0
              ? `لديك ${unreadCount} إشعار غير مقروء`
              : 'جميع الإشعارات مقروءة'}
          </p>
        </div>

        <button
          type="button"
          className="mark-all-read-btn"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
        >
          <CheckCheck size={18} />
          تحديد الكل كمقروء
        </button>
      </header>

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

      <NotificationDetailModal
        isOpen={!!selectedNotification}
        onClose={handleCloseModal}
        notification={activeNotification}
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
