import React, { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/dashboard/StatCard';
import StoreCard from '../components/dashboard/StoreCard';
import EditStoreModal from '../components/dashboard/EditStoreModal';
import ChartsSection from '../components/dashboard/ChartsSection';
import { Edit, Package, ShoppingCart, DollarSign, TrendingUp, Users } from 'lucide-react';
import ChatBadge from '../components/chat/ChatBadge';
import SupportBadge from '../components/chat/SupportBadge';
import { useAuth, useStore, useAuthActions } from '../context/AuthContext';
import {
  updateStore,
  buildStoreUpdateFormData,
  getApiErrorMessage,
  fetchStoreProfile,
  fetchStoreRatings,
  mergeStoreProfile,
  resolveStoreEmail,
  resolveStoreStatus,
  getStoreStatusLabel,
} from '../api/stores';
import { useDashboard } from '../api/hooks/useDashboard';
import { getStoreLogoCandidates, resolveStoreLogoUrl } from '../api/media';
import './Dashboard.css';

const mapStoreToForm = (store, ratingAverage = null, user = null) => {
  const rawLogo = store?.logo || '';
  const id = store?.id;
  const imageCandidates = getStoreLogoCandidates(rawLogo, id);
  const rating =
    ratingAverage != null && Number(ratingAverage) > 0
      ? Number(ratingAverage).toFixed(1)
      : '—';

  const statusRaw = resolveStoreStatus(store, user, id);

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
    statusLabel: getStoreStatusLabel(statusRaw),
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
  const { user } = useAuth();
  const { store, storeId } = useStore();
  const { updateStoreInSession } = useAuthActions();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [storeData, setStoreData] = useState(() => mapStoreToForm(store, null, user));
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  const {
    data: dashData,
    isLoading: statsLoading,
    error: statsError,
  } = useDashboard(storeId);
  const stats = dashData?.stats ?? null;
  const monthlyRevenue = dashData?.monthlyRevenue ?? [];

  const loadStoreProfile = useCallback(async (cancelled) => {
    if (!storeId) return;
    try {
      const storeDetails = await fetchStoreProfile(storeId, store, user);

      let ratingAverage = null;
      try {
        const ratings = await fetchStoreRatings(storeId);
        ratingAverage = ratings.average;
      } catch {
        // المتجر المعطّل لا يُرجع من مسار التقييمات العام
      }

      if (cancelled?.current) return;
      setStoreData(mapStoreToForm(storeDetails, ratingAverage, user));
      updateStoreInSession(storeDetails);
    } catch {
      if (cancelled?.current) return;
      if (store) setStoreData(mapStoreToForm(store, null, user));
    }
  }, [storeId, store, user, updateStoreInSession]);

  useEffect(() => {
    const cancelled = { current: false };
    loadStoreProfile(cancelled);
    return () => { cancelled.current = true; };
  }, [loadStoreProfile]);

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
      const updated = res?.data ?? {
        ...store,
        name: formData.name,
        description: formData.description,
        phone: formData.phone,
        type: formData.type,
        merchant_data: formData.merchantData,
        zone_id: formData.zoneId ? Number(formData.zoneId) : null,
        google_map_url: formData.googleMapUrl ? formData.googleMapUrl : null,
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

      {statsError && <div className="dashboard-error">{statsError.message || 'تعذّر تحميل الإحصائيات'}</div>}

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
