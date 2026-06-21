import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Megaphone,
  Package,
  Box,
  DollarSign,
  CreditCard,
  Tags,
  ShoppingBag,
  Users,
  ShoppingCart,
  Bell,
  Moon,
  Sun,
  LogOut,
  Sliders,
} from 'lucide-react';
import TrendyBrandLogo from '../brand/TrendyBrandLogo';
import { useAuth } from '../../context/AuthContext';
import { userHasRole, userCanManageEmployees } from '../../api/auth';
import { fetchNotifications } from '../../api/notifications';
import './Sidebar.css';

const navMenuItems = [
  { title: 'لوحة التحكم', icon: LayoutDashboard, path: '/' },
  { title: 'خطط الاشتراك', icon: CreditCard, path: '/plans' },
  { title: 'التسويق والمحتوى', icon: Megaphone, path: '/marketing' },
  { title: 'المنتجات', icon: Package, path: '/products' },
  { title: 'المخزون', icon: Box, path: '/inventory' },
  { title: 'المالية', icon: DollarSign, path: '/finance' },
  { title: 'العروض والخصومات', icon: Tags, path: '/offers' },
  { title: 'المبيعات المباشرة', icon: ShoppingBag, path: '/sales' },
  { title: 'الموظفين', icon: Users, path: '/staff' },
  { title: 'الطلبات', icon: ShoppingCart, path: '/orders' },
  { title: 'الإشعارات', icon: Bell, path: '/notifications' },
];

const Sidebar = ({ onLogout }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (!user) return;

    const loadUnreadCount = async () => {
      try {
        const res = await fetchNotifications({ perPage: 1 });
        const count = res?.unread_count ?? 0;
        setUnreadCount(count);
      } catch (err) {
        console.error('Failed to load initial unread notifications count:', err);
      }
    };

    loadUnreadCount();

    const interval = setInterval(loadUnreadCount, 15000);

    const handleCountChange = (e) => {
      setUnreadCount(Number(e.detail) || 0);
    };

    window.addEventListener('unread-notifications-changed', handleCountChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('unread-notifications-changed', handleCountChange);
    };
  }, [user]);

  const activeMenuItems = [
    ...navMenuItems.filter(
      (item) => item.path !== '/staff' || userCanManageEmployees(user)
    ),
    ...(user && userHasRole(user, 'super_admin')
      ? [{ title: 'إدارة الخصائص', icon: Sliders, path: '/attributes' }]
      : []),
  ];

  const isLinkActive = (path) =>
    location.pathname === path ||
    (path !== '/' && location.pathname.startsWith(`${path}/`));

  const renderNavItems = (items) =>
    items.map((item) => {
      const isActive = isLinkActive(item.path);
      const Icon = item.icon;

      return (
        <li key={item.path} className="nav-item">
          <Link to={item.path} className={`nav-link ${isActive ? 'active' : ''}`}>
            <Icon size={20} className="nav-icon" />
            <span className="nav-text">{item.title}</span>
            {item.path === '/notifications' && unreadCount > 0 && (
              <span className="sidebar-badge">{unreadCount}</span>
            )}
          </Link>
        </li>
      );
    });

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <TrendyBrandLogo />
        <span className="brand-subtitle">لوحة تحكم المتجر</span>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">{renderNavItems(activeMenuItems)}</ul>
      </nav>


      <div className="sidebar-footer">
        <button className="nav-link logout-btn" onClick={onLogout} type="button">
          <LogOut size={20} className="nav-icon" />
          <span className="nav-text">تسجيل الخروج</span>
        </button>

        <div className="theme-toggle-container">
          {isDarkMode ? (
            <Moon size={20} className="theme-icon" />
          ) : (
            <Sun size={20} className="theme-icon" />
          )}
          <label className="theme-switch">
            <input
              type="checkbox"
              checked={isDarkMode}
              onChange={() => setIsDarkMode(!isDarkMode)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
