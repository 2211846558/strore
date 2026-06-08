import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import PlanCard from '../components/plans/PlanCard';
import SubscriptionCard from '../components/plans/SubscriptionCard';
import PlanSubscribeWalletModal from '../components/plans/PlanSubscribeWalletModal';
import { fetchPlans } from '../api/plans';
import { getApiErrorMessage } from '../api/stores';
import { useAuth } from '../context/AuthContext';
import './Plans.css';

const mapPlanFromApi = (plan) => ({
  id: plan.id,
  title: plan.name,
  price: String(plan.price),
  durationDays: plan.duration_days ?? 30,
  featuresText: `عمولة المنصة: ${plan.commission_rate ?? 0}% — مدة ${plan.duration_days ?? 30} يوم`,
  isPopular: false,
});

const Plans = ({ onboarding = false }) => {
  const navigate = useNavigate();
  const { storeId, updateStoreInSession } = useAuth();
  const [activeTab, setActiveTab] = useState('available');
  const [searchQuery, setSearchQuery] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [toast, setToast] = useState(null);

  const [mySubscriptions, setMySubscriptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPlans(true);
      setPlansError('');
      try {
        const plans = await fetchPlans();
        if (!cancelled) {
          setAvailablePlans(plans.map(mapPlanFromApi));
        }
      } catch (err) {
        if (!cancelled) {
          setPlansError(getApiErrorMessage(err, 'تعذّر تحميل الخطط'));
        }
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSubscribeClick = (plan) => {
    setSelectedPlan(plan);
    setIsWalletModalOpen(true);
  };

  const isPlanActive = (planTitle) =>
    mySubscriptions.some((sub) => sub.title === planTitle && !sub.isExpired);

  const handleConfirmSubscription = (plan) => {
    setMySubscriptions((prev) => {
      const existingIndex = prev.findIndex((sub) => sub.title === plan.title);

      const pad = (n) => n.toString().padStart(2, '0');
      const formatDate = (date) => `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;

      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + (plan.durationDays || 30));

      if (existingIndex !== -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const currentEndParts = existing.dateRange.end.split('-');
        const currentEndDate = new Date(`${currentEndParts[2]}-${currentEndParts[1]}-${currentEndParts[0]}`);
        const newEndDate = existing.isExpired ? endDate : new Date(currentEndDate);
        if (!existing.isExpired) newEndDate.setDate(currentEndDate.getDate() + (plan.durationDays || 30));

        updated[existingIndex] = {
          ...existing,
          status: 'نشط',
          isExpired: false,
          statusText: 'الاشتراك نشط حالياً',
          dateRange: {
            start: existing.isExpired ? formatDate(today) : existing.dateRange.start,
            end: formatDate(newEndDate),
          },
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: Date.now(),
          title: plan.title,
          price: plan.price,
          status: 'نشط',
          dateRange: { start: formatDate(today), end: formatDate(endDate) },
          statusText: 'الاشتراك نشط حالياً',
          isExpired: false,
        },
      ];
    });

    showToast(`تم الاشتراك في ${plan.title} بنجاح`);
    setIsWalletModalOpen(false);

    if (onboarding && storeId) {
      updateStoreInSession({ id: storeId, status: 'active' });
      navigate('/');
    }
  };

  const filteredAvailablePlans = availablePlans.filter((plan) =>
    plan.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubscriptions = mySubscriptions.filter((sub) =>
    sub.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="plans-page">
      <header className="page-header plans-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">إدارة الخطط</h1>
          <p className="page-subtitle">
            {onboarding
              ? 'اختر خطة اشتراك للبدء في استخدام لوحة تحكم المتجر'
              : 'عرض وإدارة خطط الاشتراك المتاحة للمتجر'}
          </p>
        </div>
      </header>

      <div className="plans-controls">
        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="البحث عن خطة..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === 'available' ? 'active' : ''}`}
            onClick={() => setActiveTab('available')}
          >
            الخطط المتاحة
          </button>
          <button
            className={`tab-btn ${activeTab === 'my-subscriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-subscriptions')}
          >
            اشتراكاتي
          </button>
        </div>
      </div>

      <div className="plans-content">
        {activeTab === 'available' && (
          <div className="plans-grid available-plans">
            {loadingPlans && <p className="no-results">جاري تحميل الخطط...</p>}
            {!loadingPlans && plansError && <p className="no-results">{plansError}</p>}
            {!loadingPlans && !plansError && filteredAvailablePlans.length > 0 ? (
              filteredAvailablePlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  title={plan.title}
                  price={plan.price}
                  featuresText={plan.featuresText}
                  isPopular={plan.isPopular}
                  isActive={isPlanActive(plan.title)}
                  onSubscribe={() => handleSubscribeClick(plan)}
                />
              ))
            ) : (
              !loadingPlans && !plansError && <p className="no-results">لا توجد خطط تطابق بحثك.</p>
            )}
          </div>
        )}

        {activeTab === 'my-subscriptions' && (
          <div className="plans-grid my-subscriptions">
            {filteredSubscriptions.length > 0 ? (
              filteredSubscriptions.map((sub) => (
                <SubscriptionCard
                  key={sub.id}
                  title={sub.title}
                  price={sub.price}
                  status={sub.status}
                  dateRange={sub.dateRange}
                  statusText={sub.statusText}
                  isExpired={sub.isExpired}
                  onRenew={() => handleSubscribeClick(sub)}
                />
              ))
            ) : (
              <p className="no-results">لا توجد اشتراكات تطابق بحثك.</p>
            )}
          </div>
        )}
      </div>

      <PlanSubscribeWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        plan={selectedPlan}
        onConfirm={handleConfirmSubscription}
        onToast={showToast}
      />

      {toast && (
        <div className="toast-notification">
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default Plans;
