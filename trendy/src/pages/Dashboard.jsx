import React, { useState, useEffect } from 'react';
import StatCard from '../components/dashboard/StatCard';
import StoreCard from '../components/dashboard/StoreCard';
import EditStoreModal from '../components/dashboard/EditStoreModal';
import ChartsSection from '../components/dashboard/ChartsSection';
import { Edit, Package, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import ChatBadge from '../components/chat/ChatBadge';
import SupportBadge from '../components/chat/SupportBadge';
import { useAuth } from '../context/AuthContext';
import { updateStore, buildStoreUpdatePayload, getApiErrorMessage } from '../api/stores';
import './Dashboard.css';

const mapStoreToForm = (store) => ({
  id: store?.id,
  name: store?.name || '',
  description: store?.description || '',
  phone: store?.phone || '',
  email: store?.store_email || store?.email || '',
  location: store?.google_map_url || '',
  rating: 4.7,
  image: store?.logo || '',
});

const Dashboard = () => {
  const { store, storeId, updateStoreInSession } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [storeData, setStoreData] = useState(() => mapStoreToForm(store));
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) setStoreData(mapStoreToForm(store));
  }, [store]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSaveStoreData = async (formData) => {
    if (!storeId) {
      showToast('لم يتم تحديد المتجر');
      return;
    }

    setSaving(true);
    try {
      const payload = await buildStoreUpdatePayload(formData);
      const res = await updateStore(storeId, payload);
      const updated = res?.data ?? { ...store, ...payload };
      const next = mapStoreToForm(updated);
      setStoreData(next);
      updateStoreInSession(updated);
      showToast('تم تحديث بيانات المتجر بنجاح');
      return true;
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر حفظ التعديلات'));
      return false;
    } finally {
      setSaving(false);
    }
  };

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

      <ChartsSection />

      <div className="dashboard-grid bottom-grid">
        <StatCard
          title="الطلبات الجديدة"
          value="342"
          subtitle="عدد الطلبات المنجزة"
          icon={ShoppingCart}
          colorClass="orders"
          trend={{ value: '+18% عن الشهر الماضي', isPositive: true }}
        />
        <StatCard
          title="إجمالي الإيرادات"
          value="328,000"
          highlightValue="د.ل"
          subtitle="الأرباح الصافية"
          icon={DollarSign}
          colorClass="revenue"
          trend={{ value: '+23% عن الشهر الماضي', isPositive: true }}
        />
        <StatCard
          title="المنتجات النشطة"
          value="2,845"
          subtitle="إجمالي المنتجات المتاحة"
          icon={Package}
          colorClass="products"
          trend={{ value: '+8% عن الشهر الماضي', isPositive: true }}
        />
        <StatCard
          title="نمو المبيعات"
          value="23%+"
          subtitle="معدل الزيادة"
          icon={TrendingUp}
          colorClass="growth"
          trend={{ value: '+5% عن الشهر الماضي', isPositive: true }}
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
