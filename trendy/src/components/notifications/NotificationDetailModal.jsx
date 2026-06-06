import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Package, Store, AlertCircle, Bell } from 'lucide-react';
import './NotificationDetailModal.css';

const ICONS = {
  order: Package,
  store: Store,
  stock: AlertCircle,
  system: Bell,
};

const NotificationDetailModal = ({ isOpen, onClose, notification }) => {
  const navigate = useNavigate();

  if (!isOpen || !notification) return null;

  const Icon = ICONS[notification.type] || Bell;
  const iconClass = `notification-detail-icon ${notification.type}`;

  const handleAction = () => {
    if (notification.actionPath) {
      navigate(notification.actionPath);
      onClose();
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

        {notification.actionLabel && notification.actionPath && (
          <button type="button" className="notification-detail-action" onClick={handleAction}>
            {notification.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationDetailModal;
