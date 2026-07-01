import { useState, useEffect, useCallback } from 'react';
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
import { userHasRole, userCanAccessFinance } from '../../api/auth';
import EditStoreModal from '../dashboard/EditStoreModal';
import StoreDetailsModal from '../dashboard/StoreDetailsModal';
import {
  updateStore,
  buildStoreUpdateFormData,
  getApiErrorMessage,
  fetchStore,
  fetchStoreRatings,
  mergeStoreProfile,
  resolveStoreEmail,
  fetchZones,
  resolveStoreLocation,
} from '../../api/stores';
import { getStoreLogoCandidates, resolveStoreLogoUrl } from '../../api/media';
import './Sidebar.css';

const STORE_STATUS_LABELS = {
  active: 'نشط',
  inactive: 'غير نشط',
  pending: 'قيد المراجعة',
};

const ENTITY_TYPE_LABELS = {
  company: 'شركة',
  individual: 'فرد',
};

const STORE_TYPE_LABELS = {
  local: 'محلي',
  international: 'دولي',
  محلي: 'محلي',
  دولي: 'دولي',
};

const mapStoreToForm = (store, ratingAverage = null, user = null, zones = []) => {
  const rawLogo = store?.logo || '';
  const id = store?.id;
  const imageCandidates = getStoreLogoCandidates(rawLogo, id);
  const rating =
    ratingAverage != null && Number(ratingAverage) > 0
      ? Number(ratingAverage).toFixed(1)
      : '—';

  const statusRaw = String(store?.status ?? 'inactive').toLowerCase();
  const entityType = store?.entity_type ?? '';
  const storeType = store?.type ?? '';

  return {
    id,
    name: store?.name || '',
    description: store?.description || '',
    phone: store?.phone || '',
    email: resolveStoreEmail(store, user),
    zoneId: String(store?.zone_id ?? store?.zone?.id ?? ''),
    location: resolveStoreLocation(store, zones),
    googleMapUrl: store?.google_map_url ?? '',
    storeCode: store?.store_code ?? '',
    typeLabel: STORE_TYPE_LABELS[storeType] ?? storeType,
    entityTypeLabel: ENTITY_TYPE_LABELS[entityType] ?? entityType,
    commercialRegisterNumber: store?.commercial_register_number ?? '',
    merchantData: store?.merchant_data ?? null,
    notes: store?.notes ?? '',
    rating,
    statusRaw,
    statusLabel: STORE_STATUS_LABELS[statusRaw] ?? store?.status ?? '—',
    image: resolveStoreLogoUrl(rawLogo, id) || '',
    imageCandidates,
  };
};

const navMenuItems = [
  { title: 'نظرة عامة', icon: LayoutDashboard, path: '/' },
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
  const { user, store, storeId, updateStoreInSession } = useAuth();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Store details and modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [storeData, setStoreData] = useState(() => mapStoreToForm(store, null, user));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const loadStoreProfile = useCallback(async () => {
    if (!storeId) return;
    try {
      const [storeDetails, ratings, zones] = await Promise.all([
        fetchStore(storeId),
        fetchStoreRatings(storeId),
        fetchZones().catch(() => []),
      ]);
      const merged = mergeStoreProfile(storeDetails, store, user);
      setStoreData(mapStoreToForm(merged, ratings.average, user, zones));
    } catch {
      if (store) {
        const zones = await fetchZones().catch(() => []);
        setStoreData(mapStoreToForm(store, null, user, zones));
      }
    }
  }, [storeId, store, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStoreProfile();
  }, [loadStoreProfile]);

  const handleSaveStoreData = async (formData, logoFile) => {
    if (!storeId) {
      showToast('لم يتم تحديد المتجر');
      return;
    }

    setSaving(true);
    try {
      const payload = buildStoreUpdateFormData(formData, logoFile);
      const res = await updateStore(storeId, payload);
      const updated = res?.data ?? {
        ...store,
        name: formData.name,
        description: formData.description,
        phone: formData.phone,
        zone_id: formData.zoneId ? Number(formData.zoneId) : undefined,
        store_email: formData.email,
        ...(logoFile ? { logo: formData.image } : {}),
      };
      updateStoreInSession({
        ...mergeStoreProfile(updated, store, user),
        store_email: formData.email || resolveStoreEmail(updated, user),
        zone_id: formData.zoneId ? Number(formData.zoneId) : undefined,
      });
      await loadStoreProfile();
      showToast('تم تحديث بيانات المتجر بنجاح');
      return true;
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر حفظ التعديلات'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const activeMenuItems = [
    ...navMenuItems.filter(
      (item) => item.path !== '/finance' || userCanAccessFinance(user),
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

      {/* Store Profile Card */}
      <div className="store-profile-section" onClick={() => setIsDetailsModalOpen(true)}>
        <div className="store-profile-card">
          <div className="store-profile-avatar-wrapper">
            {storeData?.image ? (
              <img src={storeData.image} alt={storeData.name} className="store-profile-avatar" />
            ) : (
              <div className="store-profile-avatar-fallback">
                {storeData?.name ? storeData.name.charAt(0) : 'M'}
              </div>
            )}
          </div>
          <div className="store-profile-info">
            <span className="store-profile-name">{storeData?.name || 'اسم المتجر'}</span>
            <span className="store-profile-desc" title={storeData?.description}>
              {storeData?.description || 'لا يوجد وصف للمتجر'}
            </span>
          </div>
        </div>
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

      {/* Modals */}
      <StoreDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        store={storeData}
        onEdit={() => {
          setIsDetailsModalOpen(false);
          setIsEditModalOpen(true);
        }}
      />

      <EditStoreModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        store={storeData}
        onSave={handleSaveStoreData}
        saving={saving}
      />

      {toast && (
        <div className="toast-notification">
          <span>{toast}</span>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;

