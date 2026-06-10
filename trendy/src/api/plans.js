import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';

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

export function mapPlanFromApi(plan) {
  return {
    id: plan.id,
    title: plan.name,
    price: String(plan.price ?? ''),
    durationDays: plan.duration_days ?? 30,
    commissionRate: plan.commission_rate ?? 0,
    featuresText: `عمولة المنصة: ${plan.commission_rate ?? 0}% — مدة ${plan.duration_days ?? 30} يوم`,
    isPopular: Boolean(plan.is_popular ?? plan.is_featured ?? false),
  };
}

export function mapStoreSubscription(store, plans = []) {
  if (!store) return null;

  const nestedPlan = store.plan ?? store.current_plan ?? store.subscription?.plan ?? null;
  const planId = store.plan_id ?? nestedPlan?.id ?? store.subscription?.plan_id ?? null;
  const matchedPlan = plans.find((p) => p.id === planId) ?? (nestedPlan ? mapPlanFromApi(nestedPlan) : null);

  const startRaw =
    store.subscription_starts_at ??
    store.plan_starts_at ??
    store.subscription?.starts_at ??
    store.subscription?.start_date ??
    null;
  const endRaw =
    store.subscription_ends_at ??
    store.plan_expires_at ??
    store.subscription?.ends_at ??
    store.subscription?.end_date ??
    store.expires_at ??
    null;

  const endDate = endRaw ? new Date(endRaw) : null;
  const isExpired = endDate ? endDate.getTime() < Date.now() : store.status !== 'active';

  if (!planId && !matchedPlan && store.status !== 'active') return null;

  return {
    id: planId ?? store.id,
    planId,
    title: matchedPlan?.title ?? nestedPlan?.name ?? 'خطة الاشتراك',
    price: matchedPlan?.price ?? String(nestedPlan?.price ?? store.plan_price ?? '0'),
    durationDays: matchedPlan?.durationDays ?? nestedPlan?.duration_days ?? 30,
    status: isExpired ? 'منتهي' : 'نشط',
    isExpired,
    statusText: isExpired ? 'انتهى الاشتراك — جدّد الآن' : 'الاشتراك نشط حالياً',
    dateRange: {
      start: startRaw ? formatDisplayDate(new Date(startRaw)) : '—',
      end: endRaw ? formatDisplayDate(endDate) : '—',
    },
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
    body: { plan_id: planId, store_id: storeId },
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
