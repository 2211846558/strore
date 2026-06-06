import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';

/**
 * GET /api/stores/custody/summary
 */
export async function fetchCustodySummary() {
  const res = await apiRequest(API_ENDPOINTS.custodySummary);
  return res?.data ?? res;
}

/**
 * GET /api/stores/custody/logs
 */
export async function fetchCustodyLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.page) query.set('page', String(params.page));
  const qs = query.toString();
  const path = qs ? `${API_ENDPOINTS.custodyLogs}?${qs}` : API_ENDPOINTS.custodyLogs;
  const res = await apiRequest(path);
  return {
    data: res?.data ?? [],
    meta: res?.meta ?? null,
  };
}
