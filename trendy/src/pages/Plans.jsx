import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import PlanCard from '../components/plans/PlanCard';
import SubscriptionCard from '../components/plans/SubscriptionCard';
import PlanSubscribeWalletModal from '../components/plans/PlanSubscribeWalletModal';
import {
  fetchPlans,
  mapPlanFromApi,
  mapStoreSubscription,
  extractStoreFromSubscriptionResponse,
  resolveStoreSubscriptionDetails,
  resolveAllStoreSubscriptions,
  persistLocalSubscription,
  buildSubscriptionPeriod,
} from '../api/plans';
import { getApiErrorMessage } from '../api/stores';
import { useStore, useAuthActions } from '../context/AuthContext';
import './Plans.css';

const Plans = ({ onboarding = false }) => {
  const navigate = useNavigate();
  const { store, storeId } = useStore();
  const { updateStoreInSession, refreshSession } = useAuthActions();
  const [activeTab, setActiveTab] = useState('available');
  const [searchQuery, setSearchQuery] = useState('');
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [subscribeAction, setSubscribeAction] = useState('subscribe');
  const [availablePlans, setAvailablePlans] = useState([]);
  const [subscriptionDates, setSubscriptionDates] = useState(null);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [toast, setToast] = useState(null);

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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!store || !storeId) {
      setSubscriptionDates(null);
      setMySubscriptions([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingSubscriptions(true);

      let dates = null;
      try {
        dates = await resolveStoreSubscriptionDetails(store, storeId, availablePlans);
      } catch {
        // keep null
      }

      if (!cancelled) setSubscriptionDates(dates);

      try {
        const list = await resolveAllStoreSubscriptions(store, storeId, availablePlans, dates);
        if (!cancelled) setMySubscriptions(list);
      } catch {
        if (!cancelled) {
          const current = mapStoreSubscription(store, availablePlans, dates);
          setMySubscriptions(current ? [current] : []);
        }
      } finally {
        if (!cancelled) setLoadingSubscriptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [store, storeId, availablePlans]);

  const currentSubscription = useMemo(
    () =>
      mySubscriptions.find((sub) => !sub.isExpired) ??
      mapStoreSubscription(store, availablePlans, subscriptionDates),
    [mySubscriptions, store, availablePlans, subscriptionDates],
  );

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
    const payload = apiResponse?.data ?? apiResponse ?? {};
    const subscription = payload.subscription ?? payload.data?.subscription ?? {};
    const apiStart = subscription.starts_at ?? subscription.start_date ?? payload.starts_at;
    const apiEnd = subscription.ends_at ?? subscription.end_date ?? payload.ends_at;

    const startsAt = apiStart ? new Date(apiStart.includes('T') ? apiStart : apiStart.replace(' ', 'T')) : null;
    const endsAt = apiEnd ? new Date(apiEnd.includes('T') ? apiEnd : apiEnd.replace(' ', 'T')) : null;

    const period = buildSubscriptionPeriod({
      action: subscribeAction,
      plan,
      previousSubscription: currentSubscription,
    });

    const finalStarts = startsAt ?? period.startsAt;
    const finalEnds = endsAt ?? period.endsAt;

    persistLocalSubscription(storeId, {
      planId: plan.id,
      startsAt: finalStarts,
      endsAt: finalEnds,
      durationDays: plan.durationDays,
    });
    setSubscriptionDates({ startsAt: finalStarts, endsAt: finalEnds, durationDays: plan.durationDays });

    const updatedStore = extractStoreFromSubscriptionResponse(apiResponse, plan);

    if (storeId) {
      const isScheduled = finalStarts.getTime() > Date.now();
      if (!isScheduled) {
        updateStoreInSession({
          id: storeId,
          ...updatedStore,
          status: 'active',
          plan_id: updatedStore.plan_id ?? plan.id,
          subscription_starts_at: finalStarts.toISOString(),
          subscription_ends_at: finalEnds.toISOString(),
        });
      } else {
        updateStoreInSession({
          id: storeId,
          status: 'active',
        });
      }
    }

    try {
      await refreshSession();
      if (storeId) {
        const isScheduled = finalStarts.getTime() > Date.now();
        if (!isScheduled) {
          updateStoreInSession({
            id: storeId,
            status: 'active',
            plan_id: plan.id,
            ...updatedStore,
            subscription_starts_at: finalStarts.toISOString(),
            subscription_ends_at: finalEnds.toISOString(),
          });
        } else {
          updateStoreInSession({
            id: storeId,
            status: 'active',
          });
        }
      }
    } catch {
      // الاشتراك نجح — نُبقي التحديث المحلي
    }

    const friendlyStart = finalStarts ? formatDisplayDate(finalStarts) : '—';
    const messages = {
      renew: `تم تجديد اشتراك ${plan.title} بنجاح. يبدأ التمديد في ${friendlyStart}`,
      change: `تم الانتقال إلى ${plan.title} بنجاح. يبدأ العمل بها في ${friendlyStart}`,
      subscribe: `تم الاشتراك في ${plan.title} بنجاح. يبدأ الاشتراك في ${friendlyStart}`,
    };
    showToast(messages[subscribeAction] || messages.subscribe);
    setIsWalletModalOpen(false);

    if (onboarding) {
      navigate('/', { replace: true });
    }
  };

  const getPlanStatus = (planId) => {
    const sub = mySubscriptions.find((s) => Number(s.planId) === Number(planId) && !s.isExpired);
    if (!sub) return 'available';
    if (sub.status === 'نشط') return 'active';
    if (sub.status === 'مجدول') return 'scheduled';
    return 'available';
  };

  const formatDisplayDate = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
  };

  const activeSubscription = useMemo(
    () => mySubscriptions.find((sub) => sub.status === 'نشط' && !sub.isExpired),
    [mySubscriptions]
  );

  const scheduledSubscriptions = useMemo(
    () => mySubscriptions.filter((sub) => sub.status === 'مجدول' && !sub.isExpired).sort((a, b) => a.startsAtMs - b.startsAtMs),
    [mySubscriptions]
  );
  
  const expiredSubscriptions = useMemo(
    () => mySubscriptions.filter((sub) => sub.status === 'منتهي' || sub.isExpired),
    [mySubscriptions]
  );

  const hasNoSubscriptions = !activeSubscription && scheduledSubscriptions.length === 0;

  const getProgressPercent = (sub) => {
    if (!sub || !sub.durationDays) return 0;
    const remaining = sub.remainingDays ?? 0;
    const passed = Math.max(0, sub.durationDays - remaining);
    return Math.min(100, Math.round((passed / sub.durationDays) * 100));
  };

  const filteredAvailablePlans = availablePlans.filter((plan) =>
    plan.title.toLowerCase().includes(searchQuery.toLowerCase()),
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
          <svg width="20" height="20" className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
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
                  featuresText={plan.featuresText}
                  isPopular={plan.isPopular}
                  status={getPlanStatus(plan.id)}
                  onSubscribe={() => handleSubscribeClick(plan)}
                />
              ))
            ) : (
              !loadingPlans && !plansError && <p className="no-results">لا توجد خطط تطابق بحثك.</p>
            )}
          </div>
        )}

        {activeTab === 'my-subscriptions' && (
          <div className="my-subscriptions-container">
            {loadingSubscriptions ? (
              <p className="no-results">جاري تحميل اشتراكاتك...</p>
            ) : hasNoSubscriptions ? (
              <div className="empty-subscriptions-state">
                <div className="empty-icon-wrap">
                  <Search size={48} />
                </div>
                <h3>لا توجد اشتراكات نشطة أو مجدولة حالياً</h3>
                <p>يمكنك استعراض الخطط المتاحة والاشتراك في إحداها لتفعيل متجرك والبدء في إدارة الكتالوج والمبيعات.</p>
                <button 
                  className="empty-state-btn" 
                  onClick={() => setActiveTab('available')}
                >
                  عرض الخطط المتاحة
                </button>
              </div>
            ) : (
              <div className="subscriptions-layout">
                {/* 1. الخطة المفعّلة */}
                <div className="active-subscription-section">
                  <h2 className="section-title-sub">الخطة المفعّلة حالياً</h2>
                  {activeSubscription ? (
                    <div className="active-sub-card">
                      <div className="active-sub-header">
                        <div>
                          <h3 className="active-sub-title">{activeSubscription.title}</h3>
                          <span className="active-sub-dates">
                            الفترة: من {activeSubscription.dateRange.start} إلى {activeSubscription.dateRange.end}
                          </span>
                        </div>
                        <div className="active-sub-badge">نشط</div>
                      </div>
                      
                      <div className="active-sub-body">
                        <div className="active-sub-price">
                          <span className="price-amount">{activeSubscription.price}</span>
                          <span className="price-unit">د.ل / {activeSubscription.durationDays} يوم</span>
                        </div>
                        
                        <div className="active-sub-progress-wrapper">
                          <div className="progress-text-row">
                            <span>متبقي {activeSubscription.remainingDays ?? 0} يوم</span>
                            <span>{getProgressPercent(activeSubscription)}%</span>
                          </div>
                          <div className="progress-bar-track">
                            <div 
                              className="progress-bar-fill" 
                              style={{ width: `${getProgressPercent(activeSubscription)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="active-sub-footer">
                        <button 
                          className="renew-btn-active"
                          onClick={() => {
                            const plan = availablePlans.find((p) => p.id === activeSubscription.planId) ?? {
                              id: activeSubscription.planId,
                              title: activeSubscription.title,
                              price: activeSubscription.price,
                              durationDays: activeSubscription.durationDays ?? 30,
                            };
                            handleSubscribeClick(plan, 'renew');
                          }}
                        >
                          تجديد الاشتراك
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="active-sub-warning-card">
                      <p>لا يوجد اشتراك مفعّل حالياً. متجرك متوقف عن استقبال المبيعات والتصفح.</p>
                      <button 
                        className="warning-action-btn"
                        onClick={() => setActiveTab('available')}
                      >
                        تفعيل المتجر الآن
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. سلسلة الخطط المجدولة */}
                {scheduledSubscriptions.length > 0 && (
                  <div className="scheduled-subscriptions-section">
                    <h2 className="section-title-sub">سلسلة الاشتراكات المجدولة</h2>
                    <div className="subscriptions-timeline">
                      {scheduledSubscriptions.map((sub, index) => (
                        <div key={sub.id} className="timeline-node">
                          <div className="timeline-marker">
                            <span className="node-number">{index + 1}</span>
                            <div className="timeline-line"></div>
                          </div>
                          <div className="timeline-content-card">
                            <div className="timeline-card-header">
                              <h4>{sub.title}</h4>
                              <span className="timeline-badge">مجدول</span>
                            </div>
                            <div className="timeline-card-body">
                              <div className="timeline-dates">
                                <span>يبدأ في: {sub.dateRange.start}</span>
                                <span>ينتهي في: {sub.dateRange.end}</span>
                              </div>
                              <div className="timeline-price">
                                <span>{sub.price} د.ل</span>
                                <span className="price-sub-unit"> / {sub.durationDays} يوم</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 3. الاشتراكات السابقة */}
                {expiredSubscriptions.length > 0 && (
                  <div className="expired-subscriptions-section">
                    <h2 className="section-title-sub-small">الاشتراكات السابقة</h2>
                    <div className="expired-subs-list">
                      {expiredSubscriptions.map((sub) => (
                        <div key={sub.id} className="expired-sub-row">
                          <span className="expired-title">{sub.title}</span>
                          <span className="expired-dates">من {sub.dateRange.start} إلى {sub.dateRange.end}</span>
                          <span className="expired-price">{sub.price} د.ل</span>
                          <span className="expired-badge-label">منتهي</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
