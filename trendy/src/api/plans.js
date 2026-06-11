import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchTransactions } from './finance';

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

function subscriptionStorageKey(storeId) {
  return `trendy_plan_sub_${storeId}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days) || 0);
  return next;
}

function parseApiDate(value) {
  if (!value) return null;
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolvePlanDurationDays(planId, plans = [], nestedPlan = null, storedDurationDays = null) {
  const fromPlans = plans.find((p) => p.id === planId)?.durationDays;
  if (fromPlans != null) return Number(fromPlans) || 30;
  if (nestedPlan?.duration_days != null) return Number(nestedPlan.duration_days) || 30;
  if (storedDurationDays != null) return Number(storedDurationDays) || 30;
  return 30;
}

function diffCalendarDays(start, end) {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function alignSubscriptionPeriod({ startsAt, endsAt, durationDays }) {
  if (!startsAt) return { startsAt, endsAt };
  const days = Number(durationDays) || 30;
  const span = diffCalendarDays(startsAt, endsAt);
  if (!endsAt || span !== days) {
    return { startsAt, endsAt: addDays(startsAt, days) };
  }
  return { startsAt, endsAt };
}

export function calcRemainingDays(endDate) {
  if (!endDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function persistLocalSubscription(storeId, { planId, startsAt, endsAt, durationDays }) {
  if (!storeId || !startsAt || !endsAt) return;
  localStorage.setItem(
    subscriptionStorageKey(storeId),
    JSON.stringify({
      planId: planId ?? null,
      duration_days: durationDays ?? null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    }),
  );
}

function readLocalSubscription(storeId, planId = null) {
  try {
    const raw = localStorage.getItem(subscriptionStorageKey(storeId));
    if (!raw) return null;
    const item = JSON.parse(raw);
    if (planId && item.planId && Number(item.planId) !== Number(planId)) return null;
    const startsAt = parseApiDate(item.starts_at);
    const endsAt = parseApiDate(item.ends_at);
    if (!startsAt || !endsAt) return null;
    return {
      startsAt,
      endsAt,
      durationDays: item.duration_days ?? null,
    };
  } catch {
    return null;
  }
}

function readPivotDates(entry) {
  const pivot = entry?.pivot ?? entry?.plan_pivot ?? {};
  const startsAt = parseApiDate(
    pivot.starts_at ?? pivot.start_date ?? entry?.starts_at ?? entry?.start_date,
  );
  const endsAt = parseApiDate(
    pivot.ends_at ?? pivot.end_date ?? entry?.ends_at ?? entry?.expire_date ?? entry?.expires_at,
  );
  if (!startsAt && !endsAt) return null;
  return { startsAt, endsAt };
}

function extractSubscriptionDatesFromStore(store) {
  if (!store) return null;

  const directStart = parseApiDate(
    store.subscription_starts_at ??
      store.plan_starts_at ??
      store.subscription?.starts_at ??
      store.subscription?.start_date,
  );
  const directEnd = parseApiDate(
    store.subscription_ends_at ??
      store.plan_expires_at ??
      store.subscription?.ends_at ??
      store.subscription?.end_date ??
      store.expires_at,
  );
  if (directStart || directEnd) {
    return { startsAt: directStart, endsAt: directEnd };
  }

  const nestedSub = store.subscription ?? store.current_subscription ?? store.plan_subscription;
  const nestedDates = readPivotDates(nestedSub);
  if (nestedDates?.startsAt || nestedDates?.endsAt) return nestedDates;

  const planEntry = store.plan ?? store.current_plan;
  const planDates = readPivotDates(planEntry);
  if (planDates?.startsAt || planDates?.endsAt) return planDates;

  const plansList = store.plans ?? store.active_plans ?? store.plan_subscriptions ?? [];
  if (Array.isArray(plansList) && plansList.length) {
    const active =
      plansList.find((item) => String(item?.pivot?.status ?? item?.status ?? '').toLowerCase() === 'active') ??
      plansList[0];
    const activeDates = readPivotDates(active);
    if (activeDates?.startsAt || activeDates?.endsAt) return activeDates;
  }

  return null;
}

function isSubscriptionTransaction(tx, planTitle) {
  const desc = String(tx?.description ?? '');
  if (!/(اشتراك|تجديد|خطة)/.test(desc)) return false;
  if (!planTitle) return true;
  return desc.includes(planTitle);
}

function reconstructSubscriptionFromTransactions(transactions, planTitle, durationDays) {
  const subs = (transactions ?? [])
    .filter((tx) => isSubscriptionTransaction(tx, planTitle))
    .map((tx) => ({ date: parseApiDate(tx.date ?? tx.created_at) }))
    .filter((tx) => tx.date)
    .sort((a, b) => a.date - b.date);

  if (!subs.length) return null;

  let startsAt = subs[0].date;
  let endsAt = addDays(startsAt, durationDays);

  for (let i = 1; i < subs.length; i += 1) {
    const txDate = subs[i].date;
    if (txDate.getTime() <= endsAt.getTime()) {
      endsAt = addDays(endsAt, durationDays);
    } else {
      startsAt = txDate;
      endsAt = addDays(startsAt, durationDays);
    }
  }

  return { startsAt, endsAt };
}

async function fetchSubscriptionDatesFromFinance(storeId, planTitle, durationDays) {
  const searches = [planTitle, 'اشتراك', 'خطة'].filter(Boolean);
  const seen = new Set();
  const transactions = [];

  for (const term of searches) {
    try {
      const result = await fetchTransactions({ search: term, perPage: 50 });
      for (const tx of result.transactions ?? []) {
        if (!seen.has(tx.id)) {
          seen.add(tx.id);
          transactions.push(tx);
        }
      }
    } catch {
      // تجاهل — نُكمل بالمصادر الأخرى
    }
  }

  return reconstructSubscriptionFromTransactions(transactions, planTitle, durationDays);
}

/**
 * استخراج فترة الاشتراك من الجلسة، التخزين المحلي، أو GET /finance/transactions
 */
function normalizeSubscriptionDetails(details, planId, plans, nestedPlan) {
  if (!details?.startsAt) return details;

  const durationDays = resolvePlanDurationDays(
    planId,
    plans,
    nestedPlan,
    details.durationDays,
  );
  const aligned = alignSubscriptionPeriod({
    startsAt: details.startsAt,
    endsAt: details.endsAt,
    durationDays,
  });

  return { ...aligned, durationDays };
}

export async function resolveStoreSubscriptionDetails(store, storeId, plans = []) {
  const nestedPlan = store?.plan ?? store?.current_plan ?? store?.subscription?.plan ?? null;
  const planId = store?.plan_id ?? nestedPlan?.id ?? store?.subscription?.plan_id ?? null;
  const matchedPlan = plans.find((p) => p.id === planId) ?? (nestedPlan ? mapPlanFromApi(nestedPlan) : null);
  const durationDays = resolvePlanDurationDays(planId, plans, nestedPlan);
  const planTitle = matchedPlan?.title ?? nestedPlan?.name ?? '';

  const fromStore = extractSubscriptionDatesFromStore(store);
  if (fromStore?.startsAt) {
    return normalizeSubscriptionDetails(fromStore, planId, plans, nestedPlan);
  }

  const fromLocal = readLocalSubscription(storeId, planId);
  if (fromLocal) {
    return normalizeSubscriptionDetails(fromLocal, planId, plans, nestedPlan);
  }

  if (storeId && (store?.status === 'active' || planId)) {
    const fromFinance = await fetchSubscriptionDatesFromFinance(storeId, planTitle, durationDays);
    if (fromFinance?.startsAt && fromFinance?.endsAt) {
      const normalized = normalizeSubscriptionDetails(fromFinance, planId, plans, nestedPlan);
      persistLocalSubscription(storeId, { planId, ...normalized });
      return normalized;
    }
  }

  const fallback = fromStore ?? fromLocal ?? null;
  return fallback ? normalizeSubscriptionDetails(fallback, planId, plans, nestedPlan) : null;
}

export function buildSubscriptionPeriod({
  action = 'subscribe',
  plan,
  previousSubscription = null,
  now = new Date(),
}) {
  const durationDays = Number(plan?.durationDays ?? plan?.duration_days ?? 30) || 30;

  if (action === 'renew' && previousSubscription?.dateRange?.end) {
    const prevEnd = parseApiDate(
      previousSubscription.dateRange.end
        .split('-')
        .reverse()
        .join('-'),
    );
    const startsAt = prevEnd && prevEnd.getTime() > now.getTime() ? prevEnd : now;
    return { startsAt, endsAt: addDays(startsAt, durationDays) };
  }

  return { startsAt: now, endsAt: addDays(now, durationDays) };
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

export function mapStoreSubscription(store, plans = [], dateOverrides = null) {
  if (!store) return null;

  const nestedPlan = store.plan ?? store.current_plan ?? store.subscription?.plan ?? null;
  const planId = store.plan_id ?? nestedPlan?.id ?? store.subscription?.plan_id ?? null;
  const matchedPlan = plans.find((p) => p.id === planId) ?? (nestedPlan ? mapPlanFromApi(nestedPlan) : null);

  const durationDays = resolvePlanDurationDays(
    planId,
    plans,
    nestedPlan,
    dateOverrides?.durationDays,
  );

  const extracted = extractSubscriptionDatesFromStore(store);
  const rawStart = dateOverrides?.startsAt ?? extracted?.startsAt ?? null;
  const rawEnd = dateOverrides?.endsAt ?? extracted?.endsAt ?? null;
  const { startsAt: startDate, endsAt: endDate } = alignSubscriptionPeriod({
    startsAt: rawStart,
    endsAt: rawEnd,
    durationDays,
  });

  const isExpired = endDate ? endDate.getTime() < Date.now() : store.status !== 'active';
  const remainingDays = !isExpired && endDate ? calcRemainingDays(endDate) : null;

  if (!planId && !matchedPlan && store.status !== 'active') return null;

  return {
    id: planId ?? store.id,
    planId,
    title: matchedPlan?.title ?? nestedPlan?.name ?? 'خطة الاشتراك',
    price: matchedPlan?.price ?? String(nestedPlan?.price ?? store.plan_price ?? '0'),
    durationDays,
    remainingDays,
    status: isExpired ? 'منتهي' : 'نشط',
    isExpired,
    statusText: isExpired ? 'انتهى الاشتراك — جدّد الآن' : 'الاشتراك نشط حالياً',
    dateRange: {
      start: startDate ? formatDisplayDate(startDate) : '—',
      end: endDate ? formatDisplayDate(endDate) : '—',
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

  const fallbackPeriod = buildSubscriptionPeriod({ action: 'subscribe', plan });
  const resolvedStartsAt = startsAt ?? fallbackPeriod.startsAt.toISOString();
  const resolvedEndsAt = endsAt ?? fallbackPeriod.endsAt.toISOString();

  if (store) {
    return {
      ...store,
      status: store.status === 'inactive' ? 'active' : (store.status ?? 'active'),
      plan_id: planId,
      subscription_starts_at: resolvedStartsAt,
      subscription_ends_at: resolvedEndsAt,
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
    subscription_ends_at: resolvedEndsAt,
    subscription_starts_at: resolvedStartsAt,
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
