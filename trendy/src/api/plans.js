import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchTransactions, fetchAllTransactions } from './finance';

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

function subscriptionHistoryStorageKey(storeId) {
  return `trendy_plan_sub_history_${storeId}`;
}

function readLocalSubscriptionHistory(storeId) {
  try {
    const raw = localStorage.getItem(subscriptionHistoryStorageKey(storeId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendLocalSubscriptionHistory(storeId, { planId, startsAt, endsAt, durationDays }) {
  if (!storeId || !planId || !startsAt || !endsAt) return;

  const history = readLocalSubscriptionHistory(storeId);
  const key = `${planId}-${startsAt.toISOString()}`;
  if (history.some((item) => `${item.planId}-${item.starts_at}` === key)) return;

  history.push({
    planId,
    duration_days: durationDays ?? null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  });
  localStorage.setItem(subscriptionHistoryStorageKey(storeId), JSON.stringify(history));
}

export function persistLocalSubscription(storeId, { planId, startsAt, endsAt, durationDays }) {
  if (!storeId || !startsAt || !endsAt) return;
  const now = Date.now();
  const isScheduled = startsAt.getTime() > now;
  if (!isScheduled) {
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
  appendLocalSubscriptionHistory(storeId, { planId, startsAt, endsAt, durationDays });
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
    featuresText: `مدة ${plan.duration_days ?? 30} يوم`,
    isPopular: Boolean(plan.is_popular ?? plan.is_featured ?? (plan.id === 2 || plan.name?.includes('شهرية'))),
  };
}

function isPlanSubscriptionTransaction(tx) {
  const desc = String(tx?.description ?? tx?.raw?.description ?? '');
  const type = String(tx?.typeRaw ?? tx?.transaction_type ?? '').toLowerCase();
  return (
    tx?.type === 'اشتراك' ||
    ['deposit', 'subscription', 'plan_subscription'].includes(type) ||
    /(اشتراك|تجديد|خطة|plan)/i.test(desc)
  );
}

function matchPlanFromText(text, plans = []) {
  const normalized = String(text ?? '').trim().toLowerCase();
  if (!normalized) return null;

  return plans.find((plan) => {
    const title = String(plan.title ?? '').trim().toLowerCase();
    return title && normalized.includes(title);
  }) ?? null;
}

function buildSubscriptionEntry(
  planId,
  plans = [],
  { startsAt, endsAt, durationDays, nestedPlan = null } = {},
) {
  if (!planId || !startsAt) return null;

  const matchedPlan =
    plans.find((p) => Number(p.id) === Number(planId)) ??
    (nestedPlan ? mapPlanFromApi(nestedPlan) : null);
  const resolvedDuration = resolvePlanDurationDays(planId, plans, nestedPlan, durationDays);
  const aligned = alignSubscriptionPeriod({
    startsAt,
    endsAt,
    durationDays: resolvedDuration,
  });
  const now = Date.now();
  const isExpired = aligned.endsAt ? aligned.endsAt.getTime() < now : true;
  const isScheduled = aligned.startsAt ? aligned.startsAt.getTime() > now : false;
  const remainingDays = !isExpired && aligned.endsAt ? calcRemainingDays(aligned.endsAt) : null;

  let status = 'منتهي';
  let statusText = 'انتهى الاشتراك — جدّد الآن';

  if (isScheduled) {
    status = 'مجدول';
    statusText = `مجدول للبدء في ${formatDisplayDate(aligned.startsAt)}`;
  } else if (!isExpired) {
    status = 'نشط';
    statusText = 'الاشتراك نشط حالياً';
  }

  return {
    id: `${planId}-${aligned.startsAt.toISOString()}`,
    planId: Number(planId),
    title: matchedPlan?.title ?? nestedPlan?.name ?? `خطة #${planId}`,
    price: matchedPlan?.price ?? String(nestedPlan?.price ?? '0'),
    durationDays: resolvedDuration,
    remainingDays,
    status,
    isExpired,
    statusText,
    dateRange: {
      start: formatDisplayDate(aligned.startsAt),
      end: aligned.endsAt ? formatDisplayDate(aligned.endsAt) : '—',
    },
    startsAtMs: aligned.startsAt.getTime(),
  };
}

export function mapSubscriptionFromApi(apiSub, plans = []) {
  if (!apiSub) return null;

  const startsAt = parseApiDate(apiSub.starts_at);
  const endsAt = parseApiDate(apiSub.ends_at);

  const matchedPlan = plans.find((p) => Number(p.id) === Number(apiSub.plan_id));
  const planName = apiSub.plan?.name ?? matchedPlan?.title ?? `خطة #${apiSub.plan_id}`;
  const planPrice = apiSub.price_paid ?? apiSub.plan?.price ?? matchedPlan?.price ?? '0';
  const durationDays = Number(apiSub.plan?.duration_days ?? matchedPlan?.durationDays ?? 30);

  const now = Date.now();
  const isExpired = endsAt ? endsAt.getTime() < now : false;
  const isScheduled = startsAt ? startsAt.getTime() > now : false;
  const remainingDays = !isExpired && endsAt ? calcRemainingDays(endsAt) : null;

  let status = 'منتهي';
  let statusText = 'انتهى الاشتراك — جدّد الآن';

  if (apiSub.status === 'scheduled' || isScheduled) {
    status = 'مجدول';
    statusText = startsAt ? `مجدول للبدء في ${formatDisplayDate(startsAt)}` : 'مجدول للبدء';
  } else if ((apiSub.status === 'active' || apiSub.status === 'نشط') && !isExpired) {
    status = 'نشط';
    statusText = 'الاشتراك نشط حالياً';
  }

  return {
    id: apiSub.id,
    planId: Number(apiSub.plan_id),
    title: planName,
    price: String(planPrice),
    durationDays,
    remainingDays,
    status,
    isExpired,
    statusText,
    dateRange: {
      start: startsAt ? formatDisplayDate(startsAt) : '—',
      end: endsAt ? formatDisplayDate(endsAt) : '—',
    },
    startsAtMs: startsAt ? startsAt.getTime() : 0,
  };
}

function seedHistoryFromCurrentLocal(storeId) {
  if (!storeId) return;
  try {
    const raw = localStorage.getItem(subscriptionStorageKey(storeId));
    if (!raw) return;
    const item = JSON.parse(raw);
    const startsAt = parseApiDate(item.starts_at);
    const endsAt = parseApiDate(item.ends_at);
    if (item.planId && startsAt && endsAt) {
      appendLocalSubscriptionHistory(storeId, {
        planId: item.planId,
        startsAt,
        endsAt,
        durationDays: item.duration_days,
      });
    }
  } catch {
    // ignore
  }
}

function extractSubscriptionsFromStoreList(store, plans = []) {
  const list = store?.plans ?? store?.active_plans ?? store?.plan_subscriptions ?? [];
  if (!Array.isArray(list) || !list.length) return [];

  return list
    .map((entry) => {
      const planId = entry.plan_id ?? entry.pivot?.plan_id ?? entry.id;
      const nestedPlan = entry.plan ?? entry;
      const dates = readPivotDates(entry);
      if (!planId || !dates?.startsAt) return null;
      return buildSubscriptionEntry(planId, plans, {
        startsAt: dates.startsAt,
        endsAt: dates.endsAt,
        durationDays: entry.duration_days ?? nestedPlan?.duration_days,
        nestedPlan,
      });
    })
    .filter(Boolean);
}

async function fetchSubscriptionEntriesFromFinance(plans = []) {
  try {
    const primary = await fetchAllTransactions({ search: 'اشتراك', perPage: 100 });
    const secondary = await fetchAllTransactions({ search: 'خطة', perPage: 100 });
    const seen = new Set();
    const merged = [];

    for (const tx of [...(primary.transactions ?? []), ...(secondary.transactions ?? [])]) {
      const id = tx.id ?? tx.code;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      if (!isPlanSubscriptionTransaction(tx)) continue;

      const plan = matchPlanFromText(tx.description, plans);
      if (!plan) continue;

      const startsAt = parseApiDate(tx.date ?? tx.created_at);
      if (!startsAt) continue;

      const entry = buildSubscriptionEntry(plan.id, plans, {
        startsAt,
        endsAt: addDays(startsAt, plan.durationDays ?? 30),
        durationDays: plan.durationDays,
      });
      if (entry) merged.push(entry);
    }

    return merged;
  } catch {
    return [];
  }
}

function readHistorySubscriptionEntries(storeId, plans = []) {
  return readLocalSubscriptionHistory(storeId)
    .map((item) => {
      const startsAt = parseApiDate(item.starts_at);
      const endsAt = parseApiDate(item.ends_at);
      if (!item.planId || !startsAt) return null;
      return buildSubscriptionEntry(item.planId, plans, {
        startsAt,
        endsAt,
        durationDays: item.duration_days,
      });
    })
    .filter(Boolean);
}

function mergeSubscriptionEntries(entries) {
  const merged = [];

  for (const entry of entries) {
    if (!entry?.planId) continue;
    // Check if we already have a similar entry (same planId and within 5 minutes)
    const isDuplicate = merged.some(
      (m) =>
        m.planId === entry.planId &&
        Math.abs((m.startsAtMs ?? 0) - (entry.startsAtMs ?? 0)) < 5 * 60 * 1000
    );
    if (!isDuplicate) {
      merged.push(entry);
    }
  }

  return merged;
}

function stackSubscriptionPeriods(entries) {
  if (!entries.length) return [];

  const sorted = [...entries].sort((a, b) => (a.startsAtMs ?? 0) - (b.startsAtMs ?? 0));
  const stacked = [];
  let lastEnd = null;

  for (const entry of sorted) {
    const durationDays = Number(entry.durationDays) || 30;
    const purchaseDate = new Date(entry.startsAtMs);

    let startsAt;
    if (lastEnd && lastEnd.getTime() >= purchaseDate.getTime()) {
      startsAt = new Date(lastEnd.getTime());
      startsAt.setDate(startsAt.getDate() + 1);
      startsAt.setHours(0, 0, 0, 0);
    } else {
      startsAt = new Date(purchaseDate.getTime());
    }

    const endsAt = new Date(startsAt.getTime());
    endsAt.setDate(endsAt.getDate() + durationDays);
    endsAt.setSeconds(endsAt.getSeconds() - 1);
    if (lastEnd && lastEnd.getTime() >= purchaseDate.getTime()) {
      endsAt.setHours(23, 59, 59, 999);
    }

    const now = Date.now();
    const isExpired = endsAt.getTime() < now;
    const isScheduled = startsAt.getTime() > now;
    const remainingDays = !isExpired ? calcRemainingDays(endsAt) : null;

    let status = 'منتهي';
    let statusText = 'انتهى الاشتراك — جدّد الآن';

    if (isScheduled) {
      status = 'مجدول';
      statusText = `مجدول للبدء في ${formatDisplayDate(startsAt)}`;
    } else if (!isExpired) {
      status = 'نشط';
      statusText = 'الاشتراك نشط حالياً';
    }

    stacked.push({
      ...entry,
      startsAtMs: startsAt.getTime(),
      dateRange: {
        start: formatDisplayDate(startsAt),
        end: formatDisplayDate(endsAt),
      },
      status,
      statusText,
      isExpired,
      remainingDays,
    });

    lastEnd = endsAt;
  }

  return stacked;
}

export async function resolveAllStoreSubscriptions(store, storeId, plans = [], activeDetails = null) {
  seedHistoryFromCurrentLocal(storeId);

  let apiSubscriptions = [];
  let apiSuccess = false;
  if (storeId) {
    try {
      const res = await apiRequest(API_ENDPOINTS.storePlanSubscriptions(storeId));
      const subs = res?.subscriptions ?? res?.data?.subscriptions ?? [];
      apiSubscriptions = subs.map((s) => mapSubscriptionFromApi(s, plans)).filter(Boolean);
      apiSuccess = true;
    } catch (err) {
      console.error('Failed to fetch store subscriptions:', err);
    }
  }

  const collected = [
    ...extractSubscriptionsFromStoreList(store, plans),
    ...readHistorySubscriptionEntries(storeId, plans),
    ...(await fetchSubscriptionEntriesFromFinance(plans)),
  ];

  const current = mapStoreSubscription(store, plans, activeDetails);
  if (current) {
    collected.push(current);
  }

  const merged = mergeSubscriptionEntries(collected);
  const stacked = stackSubscriptionPeriods(merged);

  if (apiSuccess) {
    const expiredFromStacked = stacked.filter((sub) => sub.status === 'منتهي' || sub.isExpired);
    const finalExpired = expiredFromStacked.filter(
      (exp) => !apiSubscriptions.some((apiSub) => apiSub.planId === exp.planId && Math.abs(apiSub.startsAtMs - exp.startsAtMs) < 1000 * 60)
    );
    return [...apiSubscriptions, ...finalExpired].sort((a, b) => (b.startsAtMs ?? 0) - (a.startsAtMs ?? 0));
  } else {
    return stacked.sort((a, b) => (b.startsAtMs ?? 0) - (a.startsAtMs ?? 0));
  }
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

  if (!planId && !matchedPlan && store.status !== 'active') return null;

  const { startsAt, endsAt } = alignSubscriptionPeriod({
    startsAt: rawStart ?? new Date(),
    endsAt: rawEnd,
    durationDays,
  });

  const now = Date.now();
  const isExpired = endsAt ? endsAt.getTime() < now : store.status !== 'active';
  const isScheduled = startsAt ? startsAt.getTime() > now : false;

  let status = 'منتهي';
  let statusText = 'انتهى الاشتراك — جدّد الآن';

  if (isScheduled) {
    status = 'مجدول';
    statusText = `مجدول للبدء في ${formatDisplayDate(startsAt)}`;
  } else if (!isExpired) {
    status = 'نشط';
    statusText = 'الاشتراك نشط حالياً';
  }

  return {
    id: planId ?? store.id,
    planId: Number(planId),
    title: matchedPlan?.title ?? nestedPlan?.name ?? 'خطة الاشتراك',
    price: matchedPlan?.price ?? String(nestedPlan?.price ?? store.plan_price ?? '0'),
    durationDays,
    remainingDays: !isExpired && endsAt ? calcRemainingDays(endsAt) : null,
    status,
    isExpired,
    statusText,
    dateRange: {
      start: startsAt ? formatDisplayDate(startsAt) : '—',
      end: endsAt ? formatDisplayDate(endsAt) : '—',
    },
    startsAtMs: startsAt ? startsAt.getTime() : 0,
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

/**
 * POST /api/stores/subscribe/preview — body: { plan_id, store_id }
 */
export async function previewSubscribeToPlan({ planId, storeId }) {
  return apiRequest(API_ENDPOINTS.storeSubscribePreview, {
    method: 'POST',
    body: {
      plan_id: Number(planId),
      store_id: Number(storeId),
    },
  });
}
