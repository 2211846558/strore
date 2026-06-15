import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchRevenueOverview, fetchProfitOverview } from './finance';

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

function formatYmd(date) {
  return date.toISOString().slice(0, 10);
}

function pickNumber(...values) {
  for (const value of values) {
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return null;
}

function pickGrowth(data) {
  return pickNumber(
    data?.growth_rate,
    data?.sales_growth,
    data?.growth_percentage,
    data?.growth,
    data?.change_percentage,
    data?.month_over_month_growth,
  );
}

export function formatDashboardTrend(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) {
    return { value: String(value), isPositive: true };
  }
  return {
    value: `${num >= 0 ? '+' : ''}${num}% عن الشهر الماضي`,
    isPositive: num >= 0,
  };
}

/**
 * GET /stores/dashboard/total-new-orders
 */
export async function fetchTotalNewOrders() {
  const res = await apiRequest(API_ENDPOINTS.storeDashboardTotalNewOrders);
  const data = res?.data ?? res;
  return pickNumber(data?.total, data?.count, data?.total_new_orders, data) ?? 0;
}

/**
 * GET /stores/dashboard/total-employees
 */
export async function fetchTotalEmployees() {
  const res = await apiRequest(API_ENDPOINTS.storeDashboardTotalEmployees);
  const data = res?.data ?? res;
  return pickNumber(data?.total, data?.count, data?.total_employees, data) ?? 0;
}

/**
 * GET /my-store/products?status=active — عدد المنتجات النشطة من meta
 */
export async function fetchActiveProductsCount({ storeId } = {}) {
  const query = new URLSearchParams({ per_page: '1', status: 'active' });
  if (storeId) query.set('store_id', String(storeId));

  const res = await apiRequest(`${API_ENDPOINTS.myStoreProducts}?${query}`);
  return pickNumber(res?.meta?.total, res?.data?.total) ?? 0;
}

/**
 * الإيرادات الشهرية — GET /finance/revenue-overview لكل شهر
 */
export async function fetchStoreMonthlyRevenueChart(monthCount = 5) {
  const now = new Date();

  return Promise.all(
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
          name: AR_MONTHS[monthStart.getMonth()],
          revenue: pickNumber(
            overview?.total_revenue,
            overview?.revenue,
            overview?.net_revenue,
            overview?.amount,
          ) ?? 0,
        };
      } catch {
        return {
          name: AR_MONTHS[monthStart.getMonth()],
          revenue: 0,
        };
      }
    }),
  );
}

/**
 * استدعاء لوحة التحكم الموحّدة — يُعيد الإحصائيات + الرسم البياني في طلب واحد
 * GET /stores/dashboard
 */
export async function fetchStoreDashboard({ storeId } = {}) {
  const query = new URLSearchParams();
  if (storeId) query.set('store_id', String(storeId));
  const qs = query.toString();
  const path = qs ? `${API_ENDPOINTS.storeDashboard}?${qs}` : API_ENDPOINTS.storeDashboard;

  const res = await apiRequest(path);
  const data = res?.data ?? res ?? {};

  const hasTrend = (v) => v != null && v !== '';

  const stats = {
    newOrders: data.new_orders ?? 0,
    totalRevenue: data.total_revenue ?? 0,
    activeProducts: data.active_products ?? 0,
    totalEmployees: data.total_employees ?? 0,
    salesGrowth: data.sales_growth ?? null,
    trends: {
      newOrders: hasTrend(data.new_orders_trend) ? formatDashboardTrend(data.new_orders_trend) : null,
      revenue: hasTrend(data.revenue_trend) ? formatDashboardTrend(data.revenue_trend) : null,
      products: hasTrend(data.products_trend) ? formatDashboardTrend(data.products_trend) : null,
      growth: hasTrend(data.growth_trend) ? formatDashboardTrend(data.growth_trend) : null,
    },
  };

  const monthlyRevenue = (data.monthly_revenue ?? []).map((item) => ({
    name: AR_MONTHS[item.month] ?? item.month_name ?? '',
    revenue: item.revenue ?? 0,
  }));

  return { stats, monthlyRevenue };
}

async function safeDashboardCall(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    if (err?.status === 401 || err?.isUnauthorized) throw err;
    return fallback;
  }
}

/**
 * إحصائيات لوحة التحكم من الـ API الموجودة فقط
 */
export async function fetchDashboardStats({ storeId } = {}) {
  const [newOrders, revenueOverview, profitOverview, activeProducts, totalEmployees] =
    await Promise.all([
      safeDashboardCall(fetchTotalNewOrders, 0),
      safeDashboardCall(() => fetchRevenueOverview(), {}),
      safeDashboardCall(() => fetchProfitOverview(), {}),
      safeDashboardCall(() => fetchActiveProductsCount({ storeId }), 0),
      safeDashboardCall(fetchTotalEmployees, 0),
    ]);

  const totalRevenue = pickNumber(
    revenueOverview?.total_revenue,
    revenueOverview?.revenue,
    revenueOverview?.net_revenue,
    revenueOverview?.amount,
  ) ?? 0;

  const salesGrowth = pickNumber(
    profitOverview?.growth_rate,
    profitOverview?.sales_growth,
    profitOverview?.growth_percentage,
    profitOverview?.growth,
    revenueOverview?.growth_rate,
    revenueOverview?.growth_percentage,
  );

  return {
    newOrders,
    totalRevenue,
    activeProducts,
    totalEmployees,
    salesGrowth,
    trends: {
      newOrders: formatDashboardTrend(
        pickGrowth(revenueOverview) ?? pickNumber(revenueOverview?.orders_change),
      ),
      revenue: formatDashboardTrend(pickGrowth(revenueOverview) ?? pickGrowth(profitOverview)),
      products: formatDashboardTrend(revenueOverview?.products_change),
      growth: formatDashboardTrend(pickGrowth(profitOverview)),
    },
  };
}
