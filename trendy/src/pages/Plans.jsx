import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import PlanCard from '../components/plans/PlanCard';
import SubscriptionCard from '../components/plans/SubscriptionCard';
import PlanSubscribeWalletModal from '../components/plans/PlanSubscribeWalletModal';
import {
  fetchPlans,
  mapPlanFromApi,
  mapStoreSubscription,
  extractStoreFromSubscriptionResponse,
  fetchStoreSubscriptions,
  mapSubscriptionFromApi,
  mapStoreSubscriptionsForDisplay,
  pickActiveStoreSubscription,
  pickLatestStoreSubscription,
} from '../api/plans';
import { storeHasActivePlan } from '../api/auth';
import { getApiErrorMessage } from '../api/stores';
import { useAuth } from '../context/AuthContext';
import './Plans.css';

const Plans = ({ onboarding = false }) => {
  const navigate = useNavigate();
  const { store, storeId, updateStoreInSession, refreshSession } = useAuth();
  const [activeTab, setActiveTab] = useState('available');
  const [searchQuery, setSearchQuery] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [subscribeAction, setSubscribeAction] = useState('subscribe');
  const [availablePlans, setAvailablePlans] = useState([]);
  const [subscriptionHistory, setSubscriptionHistory] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPlans(true);
      setPlansError('');
      try {
        const [plans, subscriptions] = await Promise.all([
          fetchPlans(),
          storeId ? fetchStoreSubscriptions(storeId).catch(() => []) : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setAvailablePlans(plans.map(mapPlanFromApi));
          setSubscriptionHistory(subscriptions);
        }
      } catch (err) {
        if (!cancelled) {
          setPlansError(getApiErrorMessage(err, 'تعذّر تحميل الخطط'));
        }
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const currentSubscription = useMemo(() => {
    const activeApiSub = pickActiveStoreSubscription(subscriptionHistory, store);
    const latestApiSub = pickLatestStoreSubscription(subscriptionHistory);
    const apiSub = activeApiSub ?? latestApiSub;

    if (apiSub) {
      return mapSubscriptionFromApi(apiSub, availablePlans);
    }

    return mapStoreSubscription(store, availablePlans);
  }, [store, availablePlans, subscriptionHistory]);

  const mySubscriptions = useMemo(
    () => mapStoreSubscriptionsForDisplay(subscriptionHistory, availablePlans, store),
    [subscriptionHistory, availablePlans, store],
  );
  const hasLivePlan = storeHasActivePlan(store);

  useEffect(() => {
    if (onboarding || !hasLivePlan) {
      setActiveTab('available');
      return;
    }
    if (!onboarding && hasLivePlan) {
      setActiveTab('my-subscriptions');
    }
  }, [onboarding, hasLivePlan]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const resolveSubscribeAction = (plan) => {
    if (!currentSubscription) return 'subscribe';
    if (currentSubscription.isExpired && currentSubscription.planId === plan.id) return 'renew';
    if (!currentSubscription.isExpired && currentSubscription.planId === plan.id) return null;
    if (currentSubscription.planId) return 'change';
    return 'subscribe';
  };

  const handleSubscribeClick = (plan, forcedAction) => {
    const action = forcedAction ?? resolveSubscribeAction(plan);
    if (!action) {
      showToast('أنت مشترك في هذه الخطة حالياً');
      return;
    }
    setSelectedPlan(plan);
    setSubscribeAction(action);
    setIsWalletModalOpen(true);
  };

  const isPlanActive = (planId) =>
    Boolean(
      currentSubscription &&
        !currentSubscription.isExpired &&
        currentSubscription.planId === planId,
    );

  const handleConfirmSubscription = async (plan, apiResponse) => {
    const updatedStore = extractStoreFromSubscriptionResponse(apiResponse, plan);

    if (storeId) {
      updateStoreInSession({
        id: storeId,
        ...updatedStore,
        status: 'active',
        plan_id: updatedStore.plan_id ?? plan.id,
      });
    }

    try {
      await refreshSession();
      if (storeId) {
        const subscriptions = await fetchStoreSubscriptions(storeId).catch(() => []);
        setSubscriptionHistory(subscriptions);
        updateStoreInSession({
          id: storeId,
          status: 'active',
          plan_id: plan.id,
          ...updatedStore,
        });
      }
    } catch {
      // الاشتراك نجح — نُبقي التحديث المحلي
    }

    const messages = {
      renew: `تم تجديد اشتراك ${plan.title} بنجاح`,
      change: `تم جدولة الاشتراك في ${plan.title} — سيبدأ تلقائياً بعد انتهاء خطتك الحالية`,
      subscribe: `تم الاشتراك في ${plan.title} بنجاح`,
    };
    showToast(messages[subscribeAction] || messages.subscribe);
    setIsWalletModalOpen(false);

    if (subscribeAction === 'change' || subscribeAction === 'subscribe') {
      setActiveTab('my-subscriptions');
    }

    if (onboarding) {
      navigate('/', { replace: true });
    }
  };

  const filteredAvailablePlans = availablePlans.filter((plan) =>
    plan.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredSubscriptions = mySubscriptions.filter((sub) =>
    sub.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="plans-page">
      <header className="page-header plans-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">إدارة الخطط</h1>
          <p className="page-subtitle">
            {onboarding
              ? 'اختر خطة اشتراك للبدء في استخدام لوحة تحكم المتجر'
              : 'عرض الخطط المتاحة، الاشتراك، وتجديد الاشتراك من المحفظة'}
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
            type="button"
          >
            الخطط المتاحة
          </button>
          <button
            className={`tab-btn ${activeTab === 'my-subscriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-subscriptions')}
            type="button"
          >
            اشتراكي
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
                  image={plan.image}
                  featuresText={plan.featuresText}
                  isPopular={plan.isPopular}
                  status={isPlanActive(plan.id) ? 'active' : 'available'}
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
                  pricePaid={sub.pricePaid}
                  image={sub.image}
                  status={sub.status}
                  durationDays={sub.durationDays}
                  remainingDays={sub.remainingDays}
                  featuresText={sub.featuresText}
                  dateRange={sub.dateRange}
                  statusText={sub.statusText}
                  isExpired={sub.isExpired}
                  isScheduled={sub.isScheduled}
                  onRenew={() => {
                    const plan =
                      availablePlans.find((p) => p.id === sub.planId) ?? {
                        id: sub.planId,
                        title: sub.title,
                        price: sub.price,
                        durationDays: sub.durationDays ?? 30,
                      };
                    handleSubscribeClick(plan, 'renew');
                  }}
                />
              ))
            ) : (
              <p className="no-results">
                لا توجد اشتراكات مسجّلة. انتقل إلى «الخطط المتاحة» للاشتراك في خطة.
              </p>
            )}
          </div>
        )}
      </div>

      <PlanSubscribeWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        plan={selectedPlan}
        action={subscribeAction}
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
