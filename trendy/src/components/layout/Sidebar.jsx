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
} from 'lucide-react';
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
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

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
          </Link>
        </li>
      );
    });

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="brand-title">Trendy</h2>
        <span className="brand-subtitle">لوحة تحكم المتجر</span>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">{renderNavItems(navMenuItems)}</ul>
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
