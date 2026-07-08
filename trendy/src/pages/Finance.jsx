import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Eye,
  Wallet,
  Download,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  CreditCard,
  Landmark,
  CheckCircle2,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import WalletModal from '../components/finance/WalletModal';
import TransactionDetailModal from '../components/finance/TransactionDetailModal';
import { fetchCustodyLogs } from '../api/custody';
import { useWallet } from '../context/WalletContext';
import { fetchCustodySummary } from '../api/custody';
import {
  fetchAllTransactions,
  fetchTransactionDetails,
  fetchRevenueOverview,
  fetchProfitOverview,
  fetchMonthlyRevenueChart,
  exportFinanceReport,
  filterFinanceTransactions,
  resolveStoreNetRevenue,
  resolveStoreNetProfit,
  FINANCE_TYPE_OPTIONS,
  FINANCE_STATUS_OPTIONS,
} from '../api/finance';
import { getApiErrorMessage } from '../api/stores';
import './Finance.css';

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('ar-LY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const Finance = () => {
  const { balance: walletBalance } = useWallet();
  const [transactions, setTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [revenueOverview, setRevenueOverview] = useState(null);
  const [profitOverview, setProfitOverview] = useState(null);
  const [custodySummary, setCustodySummary] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [custodyLogs, setCustodyLogs] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [toast, setToast] = useState(null);

  const reportRef = useRef(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [txResult, revenue, profit, chart, custody, logs] = await Promise.all([
        fetchAllTransactions({ perPage: 100 }),
        fetchRevenueOverview(),
        fetchProfitOverview(),
        fetchMonthlyRevenueChart(5),
        fetchCustodySummary().catch(() => null),
        fetchCustodyLogs({ perPage: 20 }).catch(() => ({ data: [] })),
      ]);

      setTransactions(txResult.transactions);
      setRevenueOverview(revenue);
      setProfitOverview(profit);
      setChartData(chart);
      setCustodySummary(custody);
      setCustodyLogs(logs?.data ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل البيانات المالية'));
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const filteredTransactions = useMemo(
    () =>
      filterFinanceTransactions(transactions, {
        search: debouncedSearch,
        status: statusFilter,
        type: typeFilter,
      }),
    [transactions, debouncedSearch, statusFilter, typeFilter],
  );

  const totalTransactions = transactions.length;
  const successfulTransactions = transactions.filter((t) => t.status === 'ناجح').length;
  const totalRevenue = resolveStoreNetRevenue(revenueOverview);
  const storeProfit = resolveStoreNetProfit(profitOverview);
  const currentBalance = walletBalance;

  const handleViewTransaction = async (transaction) => {
    setLoadingDetail(true);
    try {
      const detail = await fetchTransactionDetails(transaction.id);
      setSelectedTransaction(detail);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تحميل تفاصيل المعاملة'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleExportPDF = async () => {
    showToast('جاري تصدير التقرير...');
    try {
      const apiRes = await exportFinanceReport({
        search: debouncedSearch,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (apiRes?.message) {
        showToast(apiRes.message);
      }
    } catch {
      // التصدير المحلي يعمل حتى لو فشل endpoint الخادم
    }

    if (!reportRef.current) return;

    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('finance-report.pdf');
      showToast('تم تصدير التقرير بنجاح');
    } catch {
      showToast('حدث خطأ أثناء التصدير');
    }
  };

  return (
    <div className="finance-page">
      <header className="page-header finance-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">الإدارة المالية</h1>
          <p className="page-subtitle">مراقبة الإيرادات والمعاملات المالية للمتجر</p>
        </div>
      </header>

      <div className="stats-grid finance-stats">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">الرصيد الحالي</span>
            <DollarSign size={20} className="stat-icon blue" />
          </div>
          <span className="stat-value blue">{formatMoney(currentBalance)} د.ل</span>
          <span className="stat-sub">رصيد المتجر</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">إيرادات المتجر</span>
            <TrendingUp size={20} className="stat-icon green" />
          </div>
          <span className="stat-value green">{formatMoney(totalRevenue)} د.ل</span>
          <span className="stat-sub">إجمالي الإيرادات</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">أرباح المتجر</span>
            <ArrowUpRight size={20} className="stat-icon orange" />
          </div>
          <span className="stat-value orange">{formatMoney(storeProfit)} د.ل</span>
          <span className="stat-sub">صافي الأرباح</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">عهدة المتجر</span>
            <Landmark size={20} className="stat-icon orange" />
          </div>
          <span className="stat-value orange">
            {formatMoney(custodySummary?.total_custody_owed ?? 0)} د.ل
          </span>
          <span className="stat-sub">{custodySummary?.status_text || '—'}</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">عدد المعاملات</span>
            <CreditCard size={20} className="stat-icon dark" />
          </div>
          <span className="stat-value dark">{totalTransactions}</span>
          <span className="stat-sub">{successfulTransactions} ناجحة</span>
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-header">
          <h3 className="chart-title">الإيرادات الشهرية</h3>
          <p className="chart-subtitle">تطور الإيرادات خلال الأشهر الماضية</p>
        </div>
        <div className="chart-container">
          {loading ? (
            <p className="finance-loading-chart">جاري تحميل الرسم البياني...</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="month" tick={{ fontSize: 13, fill: 'var(--chart-tick)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 13, fill: 'var(--chart-tick)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [`${formatMoney(value)} د.ل`, 'الإيرادات']}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--bg-card)' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="transactions-section" ref={reportRef}>
        <div className="transactions-header">
          <div className="transactions-title-group">
            <h3 className="section-title">قائمة المعاملات المالية</h3>
            <p className="section-subtitle">جميع العمليات المالية للمتجر</p>
          </div>
          <div className="transactions-actions">
            <button className="wallet-btn" onClick={() => setIsWalletOpen(true)} type="button">
              <Wallet size={16} />
              المحفظة
            </button>
            <button className="export-btn" onClick={handleExportPDF} type="button">
              <Download size={16} />
              تصدير التقرير (PDF)
            </button>
          </div>
        </div>

        <div className="finance-controls">
          <div className="filter-dropdown">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {FINANCE_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-dropdown">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {FINANCE_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="البحث برقم المعاملة أو الوصف..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="finance-error">{error}</p>}

        <div className="transaction-table-wrapper">
          <table className="transaction-table">
            <thead>
              <tr>
                <th>رقم المعاملة</th>
                <th>التاريخ والوقت</th>
                <th>النوع</th>
                <th>العميل</th>
                <th>المبلغ</th>
                <th>صافي المبلغ</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="no-results-cell">
                    جاري تحميل المعاملات...
                  </td>
                </tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr key={t.id}>
                    <td className="txn-code">{t.code}</td>
                    <td>
                      <div className="txn-date">{t.date}</div>
                      <div className="txn-time">{t.time}</div>
                    </td>
                    <td>
                      <span
                        className={`type-badge ${
                          t.type === 'مبيعات' ? 'sales' : t.type === 'اشتراك' ? 'sub' : 'refund'
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td>{t.client}</td>
                    <td className={`amount-cell ${t.sign === '+' ? 'positive' : 'negative'}`}>
                      {formatMoney(t.amount)} د.ل{t.sign}
                    </td>
                    <td className={`amount-cell ${t.sign === '+' ? 'positive' : 'negative'}`}>
                      {formatMoney(t.net)} د.ل{t.sign}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          t.status === 'ناجح' ? 'success' : t.status === 'معلق' ? 'pending' : 'failed'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="action-btn view-btn"
                        title="عرض التفاصيل"
                        onClick={() => handleViewTransaction(t)}
                        disabled={loadingDetail}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="no-results-cell">
                    لا توجد معاملات تطابق بحثك.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {custodyLogs.length > 0 && (
        <div className="transactions-section custody-logs-section">
          <div className="transactions-header">
            <div className="transactions-title-group">
              <h3 className="section-title">سجل العهدة</h3>
              <p className="section-subtitle">آخر حركات العهدة المالية للمتجر</p>
            </div>
          </div>
          <div className="transaction-table-wrapper">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>المبلغ</th>
                  <th>الوصف</th>
                </tr>
              </thead>
              <tbody>
                {custodyLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.created_at?.slice(0, 10) ?? '—'}</td>
                    <td>{log.type ?? log.action ?? '—'}</td>
                    <td>{formatMoney(log.amount ?? 0)} د.ل</td>
                    <td>{log.description ?? log.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        onToast={showToast}
      />

      <TransactionDetailModal
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
      />

      {toast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default Finance;
