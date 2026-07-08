import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';


function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function extractListFromResponse(res) {
  return extractList(res);
}

const AR_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const FINANCE_TYPE_OPTIONS = [
  { value: 'all', label: 'جميع الأنواع' },
  { value: 'مبيعات', label: 'مبيعات' },
  { value: 'اشتراك', label: 'اشتراك' },
  { value: 'استرداد', label: 'استرداد' },
];

export const FINANCE_STATUS_OPTIONS = [
  { value: 'all', label: 'جميع الحالات' },
  { value: 'completed', label: 'ناجح' },
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'failed', label: 'فاشل' },
];

const TRANSACTION_TYPE_AR = {
  order_payment: 'مبيعات',
  order_sale: 'مبيعات',
  sale: 'مبيعات',
  deposit: 'اشتراك',
  subscription: 'اشتراك',
  plan_subscription: 'اشتراك',
  withdrawal: 'اشتراك',
  refund: 'استرداد',
  payout: 'استرداد',
};

function formatYmd(date) {
  return date.toISOString().slice(0, 10);
}

function resolveTransactionType(row) {
  const txType = String(row.transaction_type ?? '').toLowerCase();
  if (TRANSACTION_TYPE_AR[txType]) return TRANSACTION_TYPE_AR[txType];

  const desc = String(row.description ?? '').toLowerCase();
  if (desc.includes('refund') || desc.includes('استرداد')) return 'استرداد';
  if (desc.includes('اشتراك') || desc.includes('plan') || desc.includes('deposit')) return 'اشتراك';

  return row.type === 'credit' ? 'مبيعات' : 'اشتراك';
}

function resolveClient(row) {
  if (row.reference_details?.order_number) {
    return `طلب #${row.reference_details.order_number}`;
  }

  const desc = String(row.description ?? '').trim();
  const txType = String(row.transaction_type ?? '').toLowerCase();
  if (['deposit', 'subscription', 'plan_subscription', 'withdrawal'].includes(txType)) {
    return 'المنصة';
  }
  if (desc.includes('اشتراك') || desc.includes('خطة')) return 'المنصة';

  return desc || '—';
}

export function mapTransaction(row) {
  const dateStr = row.date ?? row.created_at;
  const dateObj = dateStr ? new Date(dateStr.replace(' ', 'T')) : new Date();
  const type = resolveTransactionType(row);
  const amount = Math.abs(Number(row.amount ?? 0));
  const net = Math.abs(Number(row.net_amount ?? row.amount ?? 0));
  const fee = Math.abs(Number(row.fee ?? row.fee_amount ?? 0));
  const isCredit = row.type === 'credit' || Number(row.net_amount) >= 0;

  return {
    id: row.transaction_id ?? row.id,
    code: `TXN${String(row.transaction_id ?? row.id).padStart(4, '0')}`,
    date: Number.isNaN(dateObj.getTime()) ? '—' : dateObj.toISOString().slice(0, 10),
    time: Number.isNaN(dateObj.getTime())
      ? '—'
      : dateObj.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }),
    type,
    typeRaw: row.transaction_type ?? row.type,
    client: resolveClient(row),
    amount,
    net,
    fee,
    sign: isCredit ? '+' : '-',
    status: resolveTransactionStatus(row),
    statusRaw: String(row.status ?? row.payment_status ?? row.transaction_status ?? 'completed').toLowerCase(),
    description: row.description ?? '',
    balanceAfter: row.balance_after ?? null,
    referenceDetails: row.reference_details ?? null,
  };
}

function buildFinanceQuery({ search, status, startDate, endDate, perPage, page } = {}) {
  const query = new URLSearchParams();
  if (search?.trim()) query.set('search', search.trim());
  if (status && status !== 'all') query.set('status', status);
  if (startDate) query.set('start_date', startDate);
  if (endDate) query.set('end_date', endDate);
  if (perPage) query.set('per_page', String(perPage));
  if (page) query.set('page', String(page));
  return query;
}

/**
 * GET /finance/revenue-overview
 */
export async function fetchRevenueOverview({ startDate, endDate } = {}) {
  const query = buildFinanceQuery({ startDate, endDate });
  const qs = query.toString();
  const path = qs
    ? `${API_ENDPOINTS.financeRevenueOverview}?${qs}`
    : API_ENDPOINTS.financeRevenueOverview;
  const res = await apiRequest(path);
  return res?.data ?? res;
}

/**
 * GET /finance/profit-overview
 */
export async function fetchProfitOverview({ startDate, endDate } = {}) {
  const query = buildFinanceQuery({ startDate, endDate });
  const qs = query.toString();
  const path = qs
    ? `${API_ENDPOINTS.financeProfitOverview}?${qs}`
    : API_ENDPOINTS.financeProfitOverview;
  const res = await apiRequest(path);
  return res?.data ?? res;
}

/** صافي إيرادات المتجر — GET /finance/revenue-overview → total_store_revenue */
export function resolveStoreNetRevenue(revenueOverview) {
  if (!revenueOverview || typeof revenueOverview !== 'object') return 0;
  const value = Number(
    revenueOverview.total_store_revenue ??
      revenueOverview.total_revenue ??
      revenueOverview.revenue ??
      0,
  );
  return Number.isNaN(value) ? 0 : value;
}

/** صافي أرباح المتجر — GET /finance/profit-overview → net_profit */
export function resolveStoreNetProfit(profitOverview) {
  if (!profitOverview || typeof profitOverview !== 'object') return 0;
  const value = Number(profitOverview.net_profit);
  return Number.isNaN(value) ? 0 : value;
}

/**
 * GET /finance/transactions — بحث وفلترة من الخادم
 */
export async function fetchTransactions({
  search,
  status,
  startDate,
  endDate,
  perPage = 50,
  page = 1,
} = {}) {
  const query = buildFinanceQuery({ search, status, startDate, endDate, perPage, page });
  const res = await apiRequest(`${API_ENDPOINTS.financeTransactions}?${query}`);
  const rows = extractList(res).map(mapTransaction);

  return {
    transactions: rows,
    meta: res?.meta ?? null,
  };
}

/**
 * جلب جميع معاملات المتجر عبر الصفحات — GET /finance/transactions
 * (محفظة المتجر — وليس /wallet/logs الذي يعيد محفظة المستخدم)
 */
export async function fetchAllTransactions(filters = {}) {
  const perPage = filters.perPage ?? 100;
  const maxPages = filters.maxPages ?? null;
  const all = [];
  let page = 1;
  let lastPage = 1;

  do {
    const result = await fetchTransactions({ ...filters, perPage, page }, true);
    all.push(...result.transactions);
    lastPage = Number(result.meta?.last_page ?? 1);
    page += 1;
  } while (page <= lastPage && (maxPages == null || page <= maxPages));

  return {
    transactions: all,
    meta: { total: all.length, last_page: lastPage },
  };
}

/** تحويل معاملة مالية لعرضها في نافذة المحفظة */
export function mapToWalletLog(tx) {
  return {
    id: tx.id,
    type: tx.sign === '+' ? 'credit' : 'debit',
    amount: tx.net,
    description: tx.description || tx.type,
    date: tx.date,
    time: tx.time,
    ref: tx.referenceDetails?.order_number
      ? `#${tx.referenceDetails.order_number}`
      : null,
  };
}

/**
 * GET /finance/transactions/{id}
 */
export async function fetchTransactionDetails(id) {
  const res = await apiRequest(API_ENDPOINTS.financeTransaction(id));
  const row = res?.data ?? res;
  return mapTransaction(row);
}

/**
 * GET /finance/account-statement
 */
export async function fetchAccountStatement({ startDate, endDate }) {
  const query = buildFinanceQuery({ startDate, endDate });
  const res = await apiRequest(`${API_ENDPOINTS.financeAccountStatement}?${query}`);
  const payload = res?.data ?? res;
  const rows = (Array.isArray(payload?.transactions) ? payload.transactions : extractList(payload))
    .map(mapTransaction);

  return {
    openingBalance: Number(payload?.opening_balance ?? 0),
    closingBalance: Number(payload?.closing_balance ?? 0),
    period: payload?.period ?? '',
    transactions: rows,
  };
}

/**
 * GET /finance/export
 */
export async function exportFinanceReport({ search, status, startDate, endDate } = {}) {
  const query = buildFinanceQuery({ search, status, startDate, endDate });
  const qs = query.toString();
  const path = qs ? `${API_ENDPOINTS.financeExport}?${qs}` : API_ENDPOINTS.financeExport;
  return apiRequest(path);
}

/**
 * إيرادات شهرية — استدعاء revenue-overview لكل شهر
 */
export async function fetchMonthlyRevenueChart(monthCount = 5) {
  const now = new Date();
  const results = await Promise.all(
    Array.from({ length: monthCount }, async (_, index) => {
      const offset = monthCount - 1 - index;
      const monthStart = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);

      try {
        const overview = await fetchRevenueOverview({
          startDate: formatYmd(monthStart),
          endDate: formatYmd(monthEnd),
        });
        return {
          month: AR_MONTHS[monthStart.getMonth()],
          revenue: resolveStoreNetRevenue(overview),
        };
      } catch {
        return {
          month: AR_MONTHS[monthStart.getMonth()],
          revenue: 0,
        };
      }
    }),
  );

  return results;
}

function resolveTransactionStatus(row) {
  const raw = String(row.status ?? row.payment_status ?? row.transaction_status ?? 'completed').toLowerCase();
  if (['completed', 'success', 'successful', 'paid', 'ناجح'].includes(raw)) return 'ناجح';
  if (['pending', 'processing', 'معلق', 'قيد الانتظار'].includes(raw)) return 'معلق';
  if (['failed', 'cancelled', 'canceled', 'rejected', 'فاشل'].includes(raw)) return 'فاشل';
  return 'ناجح';
}

export function filterTransactionsBySearch(transactions, search) {
  if (!search?.trim()) return transactions;
  const query = search.trim().toLowerCase();

  return transactions.filter((transaction) => {
    const haystack = [
      transaction.code,
      transaction.client,
      transaction.description,
      transaction.type,
      String(transaction.id),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function filterTransactionsByStatus(transactions, statusFilter) {
  if (!statusFilter || statusFilter === 'all') return transactions;

  return transactions.filter((transaction) => {
    if (statusFilter === 'completed') return transaction.status === 'ناجح';
    if (statusFilter === 'pending') {
      return transaction.status === 'معلق' || transaction.status === 'قيد الانتظار';
    }
    if (statusFilter === 'failed') return transaction.status === 'فاشل';
    return true;
  });
}

export function filterTransactionsByType(transactions, typeFilter) {
  if (!typeFilter || typeFilter === 'all') return transactions;
  return transactions.filter((t) => t.type === typeFilter);
}

export function filterFinanceTransactions(transactions, { search, status, type } = {}) {
  let list = transactions;
  list = filterTransactionsBySearch(list, search);
  list = filterTransactionsByStatus(list, status);
  list = filterTransactionsByType(list, type);
  return list;
}

export function computeFinanceStats(transactions, profitOverview) {
  const successful = transactions.filter((t) => t.status === 'ناجح').length;
  const platformFee = transactions.reduce((sum, t) => sum + Number(t.fee || 0), 0);
  const netRevenue = Number(
    profitOverview?.net_profit ??
      profitOverview?.total_revenue ??
      transactions.reduce((sum, t) => (t.sign === '+' ? sum + t.net : sum - t.net), 0),
  );

  return {
    totalTransactions: transactions.length,
    successfulTransactions: successful,
    netRevenue,
    platformFee,
  };
}
