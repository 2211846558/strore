import React, { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/dashboard/StatCard';
import StoreCard from '../components/dashboard/StoreCard';
import EditStoreModal from '../components/dashboard/EditStoreModal';
import ChartsSection from '../components/dashboard/ChartsSection';
import { Edit, Package, ShoppingCart, DollarSign, TrendingUp, Users } from 'lucide-react';
import ChatBadge from '../components/chat/ChatBadge';
import SupportBadge from '../components/chat/SupportBadge';
import { useAuth } from '../context/AuthContext';
import {
  updateStore,
  buildStoreUpdateFormData,
  getApiErrorMessage,
  fetchStore,
  fetchStoreRatings,
  mergeStoreProfile,
  resolveStoreEmail,
} from '../api/stores';
import { fetchDashboardStats, fetchStoreMonthlyRevenueChart } from '../api/dashboard';
import { getStoreLogoCandidates, resolveStoreLogoUrl } from '../api/media';
import './Dashboard.css';

const STORE_STATUS_LABELS = {
  active: 'نشط',
  inactive: 'غير نشط',
  pending: 'قيد المراجعة',
};

const mapStoreToForm = (store, ratingAverage = null, user = null) => {
  const rawLogo = store?.logo || '';
  const id = store?.id;
  const imageCandidates = getStoreLogoCandidates(rawLogo, id);
  const rating =
    ratingAverage != null && Number(ratingAverage) > 0
      ? Number(ratingAverage).toFixed(1)
      : '—';

  const statusRaw = String(store?.status ?? 'inactive').toLowerCase();

  return {
    id,
    name: store?.name || '',
    description: store?.description || '',
    phone: store?.phone || '',
    email: resolveStoreEmail(store, user),
    zoneId: String(store?.zone_id ?? store?.zone?.id ?? ''),
    location: store?.zone?.name ?? store?.zone_name ?? '',
    type: store?.type || 'local',
    googleMapUrl: store?.google_map_url || '',
    merchantData: {
      tax_number: store?.merchant_data?.tax_number || '',
      commercial_register: store?.merchant_data?.commercial_register || '',
    },
    rating,
    statusRaw,
    statusLabel: STORE_STATUS_LABELS[statusRaw] ?? store?.status ?? '—',
    image: resolveStoreLogoUrl(rawLogo, id) || '',
    imageCandidates,
  };
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('ar-LY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const Dashboard = () => {
  const { user, store, storeId, updateStoreInSession } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [storeData, setStoreData] = useState(() => mapStoreToForm(store, null, user));
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [stats, setStats] = useState(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);

  const loadStoreProfile = useCallback(async () => {
    if (!storeId) return;
    try {
      const [storeDetails, ratings] = await Promise.all([
        fetchStore(storeId),
        fetchStoreRatings(storeId),
      ]);
      const merged = mergeStoreProfile(storeDetails, store, user);
      setStoreData(mapStoreToForm(merged, ratings.average, user));
    } catch {
      if (store) setStoreData(mapStoreToForm(store, null, user));
    }
  }, [storeId, store, user]);

  useEffect(() => {
    loadStoreProfile();
  }, [loadStoreProfile]);

  const loadDashboardData = useCallback(async (quiet = false) => {
    if (!quiet) setStatsLoading(true);
    setStatsError('');
    try {
      const [dashboardStats, chart] = await Promise.all([
        fetchDashboardStats({ storeId }),
        fetchStoreMonthlyRevenueChart(5),
      ]);
      setStats(dashboardStats);
      setMonthlyRevenue(chart);
    } catch (err) {
      if (err?.status === 401 || err?.isUnauthorized) {
        setStatsError('');
        setStats(null);
        setMonthlyRevenue([]);
        return;
      }
      if (!quiet) {
        setStatsError(getApiErrorMessage(err, 'تعذّر تحميل إحصائيات لوحة التحكم'));
        setStats(null);
        setMonthlyRevenue([]);
      }
    } finally {
      if (!quiet) setStatsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSaveStoreData = async (formData, logoFile) => {
    if (!storeId) {
      showToast('لم يتم تحديد المتجر');
      return;
    }

    setSaving(true);
    try {
      const payload = buildStoreUpdateFormData(formData, logoFile);
      const res = await updateStore(storeId, payload);
      const isLocal = formData.type === 'local' || formData.type === 'محلي';
      const updated = res?.data ?? {
        ...store,
        name: formData.name,
        description: formData.description,
        phone: formData.phone,
        type: formData.type,
        merchant_data: formData.merchantData,
        zone_id: isLocal && formData.zoneId ? Number(formData.zoneId) : null,
        google_map_url: isLocal && formData.googleMapUrl ? formData.googleMapUrl : null,
        ...(logoFile ? { logo: formData.image } : {}),
      };
      updateStoreInSession({
        ...mergeStoreProfile(updated, store, user),
        type: updated.type,
        merchant_data: updated.merchant_data,
        zone_id: updated.zone_id,
        google_map_url: updated.google_map_url,
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

  const growthValue =
    stats?.salesGrowth != null ? `${stats.salesGrowth}%` : statsLoading ? '...' : '—';

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div className="header-actions">
          <button className="edit-store-btn" onClick={() => setIsEditModalOpen(true)}>
            <Edit size={16} />
            تعديل بيانات المتجر
          </button>
          <ChatBadge />
          <SupportBadge />
        </div>
        <div className="header-title-wrapper">
          <h1 className="page-title">لوحة التحكم الرئيسية</h1>
          <p className="page-subtitle">نظرة عامة على أداء المتجر</p>
        </div>
      </header>

      <div className="dashboard-grid store-section">
        <StoreCard store={storeData} />
      </div>

      {statsError && <div className="dashboard-error">{statsError}</div>}

      <ChartsSection data={monthlyRevenue} loading={statsLoading} />

      <div className="dashboard-grid bottom-grid">
        <StatCard
          title="الطلبات الجديدة"
          value={statsLoading ? '...' : formatMoney(stats?.newOrders ?? 0)}
          subtitle="عدد الطلبات الجديدة"
          icon={ShoppingCart}
          colorClass="orders"
          trend={stats?.trends?.newOrders}
        />
        <StatCard
          title="إجمالي الإيرادات"
          value={statsLoading ? '...' : formatMoney(stats?.totalRevenue ?? 0)}
          highlightValue="د.ل"
          subtitle="إجمالي الإيرادات"
          icon={DollarSign}
          colorClass="revenue"
          trend={stats?.trends?.revenue}
        />
        <StatCard
          title="المنتجات النشطة"
          value={statsLoading ? '...' : formatMoney(stats?.activeProducts ?? 0)}
          subtitle="إجمالي المنتجات المتاحة"
          icon={Package}
          colorClass="products"
          trend={stats?.trends?.products}
        />
        <StatCard
          title="عدد الموظفين"
          value={statsLoading ? '...' : formatMoney(stats?.totalEmployees ?? 0)}
          subtitle="إجمالي موظفي المتجر"
          icon={Users}
          colorClass="growth"
        />
        <StatCard
          title="نمو المبيعات"
          value={growthValue}
          subtitle="معدل الزيادة"
          icon={TrendingUp}
          colorClass="growth"
          trend={stats?.trends?.growth}
        />
      </div>

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
    </div>
  );
};

export default Dashboard;
