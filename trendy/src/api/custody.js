import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { getStoredUser, resolveManagedStoreId } from './auth';

function resolveCustodyStoreId(storeId) {
  return resolveManagedStoreId(getStoredUser(), storeId);
}

function unwrapCustodyPayload(res) {
  const payload = res?.data ?? res;
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
}

/**
 * GET /api/stores/custody/summary
 * query: store_id (مطلوب لبعض الأدوار)
 */
export function mapCustodySummaryFromApi(res) {
  const data = unwrapCustodyPayload(res);

  const totalCustodyOwed = Number(data.total_custody_owed ?? data.totalCustodyOwed ?? 0);
  const status = data.status ?? (totalCustodyOwed > 0 ? 'pending_settlement' : 'settled');

  return {
    total_custody_owed: totalCustodyOwed,
    number_of_orders: Number(data.number_of_orders ?? data.numberOfOrders ?? 0),
    last_settled_at: data.last_settled_at ?? data.lastSettledAt ?? null,
    status,
    status_text:
      data.status_text ??
      data.statusText ??
      (status === 'pending_settlement' ? 'بانتظار التسوية' : 'تمت التسوية'),
    total_profits: Number(data.total_profits ?? data.totalProfits ?? 0),
    currency: data.currency ?? 'LYD',
  };
}

export function mapCustodyLogFromApi(log) {
  const amount = Number(log.amount ?? 0);
  const amountFormatted =
    log.amount_formatted ??
    log.amountFormatted ??
    `${amount > 0 ? '+' : ''}${amount}`;

  return {
    id: log.id,
    date: log.date ?? log.created_at ?? null,
    action: log.action ?? (log.type === 'settlement' ? 'تسوية' : log.type ?? '—'),
    type: log.type ?? null,
    amount,
    amount_formatted: amountFormatted,
    balance_after: Number(log.balance_after ?? log.balanceAfter ?? 0),
    description:
      log.description ??
      log.note ??
      (log.order?.order_number ? `طلب #${log.order.order_number}` : null),
  };
}

function buildCustodyQuery(params = {}) {
  const query = new URLSearchParams();
  const resolvedStoreId = resolveCustodyStoreId(params.storeId);
  if (resolvedStoreId) query.set('store_id', String(resolvedStoreId));
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.page) query.set('page', String(params.page));
  return query;
}

/**
 * GET /api/stores/custody/summary
 */
export async function fetchCustodySummary({ storeId } = {}) {
  const query = buildCustodyQuery({ storeId });
  const qs = query.toString();
  const path = qs ? `${API_ENDPOINTS.custodySummary}?${qs}` : API_ENDPOINTS.custodySummary;
  const res = await apiRequest(path);
  return mapCustodySummaryFromApi(res);
}

/**
 * GET /api/stores/custody/logs
 */
export async function fetchCustodyLogs({ storeId, perPage = 20, page = 1 } = {}) {
  const query = buildCustodyQuery({ storeId, per_page: perPage, page });
  const path = `${API_ENDPOINTS.custodyLogs}?${query.toString()}`;
  const res = await apiRequest(path);
  const list = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res?.data?.data)
      ? res.data.data
      : [];

  return {
    data: list.map(mapCustodyLogFromApi),
    meta: res?.meta ?? null,
  };
}
