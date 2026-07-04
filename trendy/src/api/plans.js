import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { resolveMediaUrl } from './media';
import {
  getStorePlanId,
  getStoreSubscriptionEnd,
  storeHasActivePlan,
  resolveManagedStoreId,
} from './auth';

function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function formatDisplayDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function resolvePlanImage(plan) {
  const raw =
    plan?.image ??
    plan?.image_url ??
    plan?.thumbnail ??
    plan?.icon ??
    plan?.banner ??
    plan?.cover ??
    null;
  return raw ? resolveMediaUrl(raw) : null;
}

export function mapPlanFromApi(plan) {
  return {
    id: plan.id,
    title: plan.name,
    price: String(plan.price ?? ''),
    durationDays: plan.duration_days ?? 30,
    commissionRate: plan.commission_rate ?? 0,
    featuresText: `عمولة المنصة: ${plan.commission_rate ?? 0}% — مدة ${plan.duration_days ?? 30} يوم`,
    isPopular: Boolean(plan.is_popular ?? plan.is_featured ?? false),
    image: resolvePlanImage(plan),
  };
}

function calcRemainingDays(endDate) {
  if (!endDate) return null;
  const diff = endDate.getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function resolveSubscriptionPhase(subscription) {
  if (!subscription) return 'expired';

  const status = String(subscription.status ?? '').toLowerCase();
  if (status === 'expired' || status === 'cancelled' || status === 'inactive') {
    return 'expired';
  }

  const now = Date.now();
  const startAt = subscription.starts_at ? new Date(subscription.starts_at).getTime() : 0;
  const endAt = subscription.ends_at ? new Date(subscription.ends_at).getTime() : 0;

  if (endAt && endAt <= now) return 'expired';
  if (startAt && startAt > now) return 'scheduled';
  if (endAt && endAt > now) return 'active';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'active') return 'active';

  return 'expired';
}

function isSubscriptionCurrentlyActive(subscription) {
  return resolveSubscriptionPhase(subscription) === 'active';
}

function isSubscriptionScheduled(subscription) {
  return resolveSubscriptionPhase(subscription) === 'scheduled';
}

function subscriptionEndTimestamp(subscription) {
  if (!subscription?.ends_at) return 0;
  return new Date(subscription.ends_at).getTime();
}

function subscriptionStartTimestamp(subscription) {
  if (!subscription?.starts_at) return 0;
  return new Date(subscription.starts_at).getTime();
}

function isSubscriptionLive(subscription) {
  const phase = resolveSubscriptionPhase(subscription);
  return phase === 'active' || phase === 'scheduled';
}

function resolveSubscriptionPrice(plan, subscription, storePrice) {
  const planPrice = plan?.price ?? subscription?.plan?.price ?? storePrice;
  const paid = subscription?.price_paid;

  if (paid != null && paid !== '' && Number(paid) > 0) return String(paid);
  if (planPrice != null && planPrice !== '' && Number(planPrice) > 0) return String(planPrice);
  if (paid != null && paid !== '') return String(paid);
  if (planPrice != null && planPrice !== '') return String(planPrice);
  return '';
}

function resolveDurationDays(plan, subscription, startDate, endDate) {
  const fromPlan = plan?.durationDays ?? subscription?.plan?.duration_days;
  if (fromPlan != null && Number(fromPlan) > 0) return Number(fromPlan);

  if (startDate && endDate) {
    const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (days > 0) return days;
  }

  return null;
}

export function pickActiveStoreSubscription(subscriptions = [], store = null) {
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  const activeOnes = list.filter(isSubscriptionCurrentlyActive);
  if (activeOnes.length === 0) return null;
  if (activeOnes.length === 1) return activeOnes[0];

  const storePlanId = store ? getStorePlanId(store) : null;
  if (storePlanId != null) {
    const matched = activeOnes.find(
      (sub) => Number(sub.plan_id ?? sub.plan?.id) === Number(storePlanId),
    );
    if (matched) return matched;
  }

  return [...activeOnes].sort((a, b) => {
    const startDiff = subscriptionStartTimestamp(b) - subscriptionStartTimestamp(a);
    if (startDiff !== 0) return startDiff;
    return Number(b.id ?? 0) - Number(a.id ?? 0);
  })[0];
}

export function pickScheduledStoreSubscriptions(subscriptions = []) {
  const list = Array.isArray(subscriptions) ? subscriptions : [];

  return list
    .filter(isSubscriptionScheduled)
    .sort(
      (a, b) => subscriptionStartTimestamp(a) - subscriptionStartTimestamp(b),
    );
}

export function mapStoreSubscriptionsForDisplay(subscriptions = [], plans = [], store = null) {
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  const primaryActive = pickActiveStoreSubscription(list, store);
  const primaryActiveId = primaryActive?.id ?? null;

  const relevant = list.filter((sub) => {
    const phase = resolveSubscriptionPhase(sub);
    if (phase === 'scheduled' || phase === 'expired') return true;
    if (phase === 'active') {
      return primaryActiveId != null && Number(sub.id) === Number(primaryActiveId);
    }
    return false;
  });

  return relevant
    .sort((a, b) => {
      const phaseA = resolveSubscriptionPhase(a);
      const phaseB = resolveSubscriptionPhase(b);
      const rank = { active: 0, scheduled: 1, expired: 2 };
      const orderDiff = rank[phaseA] - rank[phaseB];
      if (orderDiff !== 0) return orderDiff;
      if (phaseA === 'expired') {
        return subscriptionEndTimestamp(b) - subscriptionEndTimestamp(a);
      }
      if (phaseA === 'scheduled') {
        return subscriptionStartTimestamp(a) - subscriptionStartTimestamp(b);
      }
      return 0;
    })
    .map((sub) => mapSubscriptionFromApi(sub, plans));
}

export function pickLatestStoreSubscription(subscriptions = []) {
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  if (list.length === 0) return null;

  return [...list].sort((a, b) => {
    const endDiff = subscriptionEndTimestamp(b) - subscriptionEndTimestamp(a);
    if (endDiff !== 0) return endDiff;
    return subscriptionStartTimestamp(b) - subscriptionStartTimestamp(a);
  })[0];
}

export function subscriptionToStorePatch(subscription) {
  if (!subscription) {
    return {
      plan_id: null,
      subscription_starts_at: null,
      subscription_ends_at: null,
      plan: null,
      subscription: null,
    };
  }

  return {
    plan_id: subscription.plan_id ?? subscription.plan?.id ?? null,
    subscription_starts_at: subscription.starts_at ?? null,
    subscription_ends_at: subscription.ends_at ?? null,
    plan: subscription.plan ?? null,
    subscription,
  };
}

export function mapSubscriptionFromApi(subscription, plans = []) {
  const plan =
    plans.find((item) => item.id === subscription.plan_id) ??
    (subscription.plan ? mapPlanFromApi(subscription.plan) : null);
  const endDate = subscription.ends_at ? new Date(subscription.ends_at) : null;
  const startDate = subscription.starts_at ? new Date(subscription.starts_at) : null;
  const phase = resolveSubscriptionPhase(subscription);
  const isExpired = phase === 'expired';
  const isScheduled = phase === 'scheduled';
  const remainingDays = !isExpired
    ? isScheduled && startDate
      ? calcRemainingDays(startDate)
      : calcRemainingDays(endDate)
    : 0;
  const durationDays = resolveDurationDays(plan, subscription, startDate, endDate);
  const displayPrice = resolveSubscriptionPrice(plan, subscription);
  const planPrice = plan?.price ?? (subscription.plan?.price != null ? String(subscription.plan.price) : '');

  return {
    id: subscription.id,
    planId: subscription.plan_id,
    title: plan?.title ?? subscription.plan?.name ?? '—',
    price: displayPrice || planPrice,
    pricePaid: subscription.price_paid != null ? String(subscription.price_paid) : null,
    durationDays,
    commissionRate: plan?.commissionRate ?? subscription.plan?.commission_rate ?? 0,
    featuresText:
      plan?.featuresText ??
      (subscription.plan ? mapPlanFromApi(subscription.plan).featuresText : ''),
    image: plan?.image ?? resolvePlanImage(subscription.plan),
    status: isExpired ? 'منتهي' : isScheduled ? 'مجدول' : 'نشط',
    isExpired,
    isScheduled,
    statusText: isExpired
      ? 'انتهى الاشتراك — جدّد الآن'
      : isScheduled
        ? 'اشتراك مجدول — يبدأ تلقائياً بعد انتهاء خطتك الحالية'
        : 'الاشتراك نشط حالياً',
    dateRange: {
      start: startDate ? formatDisplayDate(startDate) : '—',
      end: endDate ? formatDisplayDate(endDate) : '—',
    },
    remainingDays,
  };
}

export function mapStoreSubscription(store, plans = []) {
  if (!store) return null;

  const nestedPlan = store.plan ?? store.current_plan ?? store.subscription?.plan ?? null;
  const planId = getStorePlanId(store);
  const matchedPlan =
    plans.find((p) => p.id === planId) ?? (nestedPlan ? mapPlanFromApi(nestedPlan) : null);

  if (!planId && !matchedPlan && !nestedPlan) return null;

  const startRaw =
    store.subscription_starts_at ??
    store.plan_starts_at ??
    store.subscription?.starts_at ??
    store.subscription?.start_date ??
    null;
  const endDate = getStoreSubscriptionEnd(store);
  const startDate = startRaw ? new Date(startRaw) : null;
  const isExpired = !storeHasActivePlan(store);
  const remainingDays = !isExpired ? calcRemainingDays(endDate) : 0;
  const durationDays = resolveDurationDays(
    matchedPlan,
    store.subscription,
    startDate,
    endDate,
  );
  const displayPrice = resolveSubscriptionPrice(
    matchedPlan,
    store.subscription,
    store.plan_price,
  );
  const planPrice =
    matchedPlan?.price ?? (nestedPlan?.price != null ? String(nestedPlan.price) : '');

  return {
    id: store.subscription?.id ?? planId ?? store.id,
    planId,
    title: matchedPlan?.title ?? nestedPlan?.name ?? '—',
    price: displayPrice || planPrice,
    pricePaid:
      store.subscription?.price_paid != null ? String(store.subscription.price_paid) : null,
    durationDays,
    commissionRate: matchedPlan?.commissionRate ?? nestedPlan?.commission_rate ?? 0,
    featuresText:
      matchedPlan?.featuresText ??
      (nestedPlan ? mapPlanFromApi(nestedPlan).featuresText : ''),
    image: matchedPlan?.image ?? resolvePlanImage(nestedPlan),
    status: isExpired ? 'منتهي' : 'نشط',
    isExpired,
    statusText: isExpired ? 'انتهى الاشتراك — جدّد الآن' : 'الاشتراك نشط حالياً',
    dateRange: {
      start: startDate ? formatDisplayDate(startDate) : '—',
      end: endDate ? formatDisplayDate(endDate) : '—',
    },
    remainingDays,
  };
}

export async function fetchStoreSubscriptions(storeId) {
  const res = await apiRequest(API_ENDPOINTS.storeSubscriptions(storeId));
  const payload = res?.data ?? res ?? {};
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.subscriptions)) return payload.subscriptions;
  if (Array.isArray(payload.data?.subscriptions)) return payload.data.subscriptions;
  return [];
}

export async function enrichUserWithSubscription(user) {
  const storeId = resolveManagedStoreId(user);
  if (!storeId || !user) return user;

  let subscriptions = [];
  let fetchSucceeded = true;
  try {
    subscriptions = await fetchStoreSubscriptions(storeId);
  } catch {
    fetchSucceeded = false;
  }

  if (!fetchSucceeded) {
    return user;
  }

  const matchedStore =
    (user.owned_stores || user.ownedStores || []).find(
      (item) => Number(item.id) === Number(storeId),
    ) ?? user.store;

  const active = pickActiveStoreSubscription(subscriptions, matchedStore);
  const latest = pickLatestStoreSubscription(subscriptions);
  const sourceSubscription = active ?? latest;
  const patch = subscriptionToStorePatch(sourceSubscription);

  const applyPatch = (store) =>
    store && Number(store.id) === Number(storeId) ? { ...store, ...patch } : store;

  const owned = (user.owned_stores || user.ownedStores || []).map(applyPatch);
  let matchedOwned = owned.find((item) => Number(item.id) === Number(storeId));

  if (!matchedOwned) {
    const fallbackStore =
      user.store && Number(user.store.id) === Number(storeId)
        ? applyPatch(user.store)
        : { id: storeId, ...patch };
    matchedOwned = fallbackStore;
  }

  const nextOwned = owned.some((item) => Number(item.id) === Number(storeId))
    ? owned
    : [matchedOwned, ...owned];

  return {
    ...user,
    store_id: storeId,
    store: matchedOwned,
    owned_stores: nextOwned,
    ownedStores: nextOwned,
  };
}

export function extractStoreFromSubscriptionResponse(response, plan) {
  const payload = response?.data ?? response ?? {};
  const subscription = payload.subscription ?? payload.data?.subscription ?? {};
  const store =
    payload.store ??
    payload.data?.store ??
    subscription.store ??
    (payload.id && (payload.name || payload.status) ? payload : null);

  const planId = store?.plan_id ?? subscription.plan_id ?? plan.id;
  const startsAt =
    store?.subscription_starts_at ??
    store?.plan_starts_at ??
    subscription.starts_at ??
    subscription.start_date ??
    payload.subscription_starts_at ??
    payload.starts_at ??
    null;
  const endsAt =
    store?.subscription_ends_at ??
    store?.plan_expires_at ??
    subscription.ends_at ??
    subscription.end_date ??
    payload.subscription_ends_at ??
    payload.ends_at ??
    null;

  if (store) {
    return {
      ...store,
      status: store.status === 'inactive' ? 'active' : (store.status ?? 'active'),
      plan_id: planId,
      subscription_starts_at: startsAt,
      subscription_ends_at: endsAt,
      plan: store.plan ?? {
        id: plan.id,
        name: plan.title,
        price: plan.price,
        duration_days: plan.durationDays,
      },
    };
  }

  return {
    status: 'active',
    plan_id: planId,
    plan: {
      id: plan.id,
      name: plan.title,
      price: plan.price,
      duration_days: plan.durationDays,
    },
    subscription_ends_at: endsAt,
    subscription_starts_at: startsAt,
  };
}

/**
 * GET /api/plans — الخطط النشطة المتاحة للتجار
 */
export async function fetchPlans() {
  const res = await apiRequest(API_ENDPOINTS.plans);
  return extractList(res);
}

/**
 * POST /api/stores/subscribe — body: { plan_id, store_id }
 */
export async function subscribeToPlan({ planId, storeId }) {
  return apiRequest(API_ENDPOINTS.storeSubscribe, {
    method: 'POST',
    body: {
      plan_id: Number(planId),
      store_id: Number(storeId),
    },
  });
}

/**
 * POST /api/stores/{store}/renew
 */
export async function renewStorePlan(storeId) {
  return apiRequest(API_ENDPOINTS.storePlanRenew(storeId), { method: 'POST' });
}

/**
 * POST /api/stores/{store}/change-plan/{plan}
 */
export async function changeStorePlan(storeId, planId) {
  return apiRequest(API_ENDPOINTS.storePlanChange(storeId, planId), { method: 'POST' });
}
