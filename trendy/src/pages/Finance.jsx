import React, { useState, useRef, useEffect } from 'react';
import { Search, Eye, Wallet, Download, DollarSign, TrendingUp, ArrowUpRight, CreditCard, Landmark } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import WalletModal from '../components/finance/WalletModal';
import TransactionDetailModal from '../components/finance/TransactionDetailModal';
import { useWallet } from '../context/WalletContext';
import { fetchCustodySummary } from '../api/custody';
import './Finance.css';

const chartData = [
  { month: 'يناير', revenue: 45000 },
  { month: 'فبراير', revenue: 52000 },
  { month: 'مارس', revenue: 48000 },
  { month: 'أبريل', revenue: 62000 },
  { month: 'مايو', revenue: 69000 },
];

const initialTransactions = [
  {
    id: 1, code: 'TXN001', date: '2026-05-03', time: '14:30',
    type: 'مبيعات', client: 'محمد أحمد', amount: 450, net: 427.5,
    status: 'ناجح', sign: '+'
  },
  {
    id: 2, code: 'TXN002', date: '2026-05-03', time: '11:15',
    type: 'اشتراك', client: 'المنصة', amount: 250, net: 250,
    status: 'ناجح', sign: '-'
  },
  {
    id: 3, code: 'TXN003', date: '2026-05-02', time: '16:45',
    type: 'مبيعات', client: 'فاطمة علي', amount: 180, net: 171,
    status: 'ناجح', sign: '+'
  },
  {
    id: 4, code: 'TXN004', date: '2026-05-02', time: '13:20',
    type: 'استرداد', client: 'عمر سالم', amount: 85, net: 85,
    status: 'ناجح', sign: '-'
  },
  {
    id: 5, code: 'TXN005', date: '2026-05-01', time: '10:30',
    type: 'مبيعات', client: 'سارة محمود', amount: 125, net: 118.75,
    status: 'معلق', sign: '+'
  },
];

const Finance = () => {
  const { balance: walletBalance } = useWallet();
  const [transactions] = useState(initialTransactions);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [toast, setToast] = useState(null);
  const [custodySummary, setCustodySummary] = useState(null);

  useEffect(() => {
    fetchCustodySummary()
      .then(setCustodySummary)
      .catch(() => {});
  }, []);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const statuses = [
    { value: 'all', label: 'جميع الحالات' },
    { value: 'ناجح', label: 'ناجح' },
    { value: 'معلق', label: 'معلق' },
    { value: 'فاشل', label: 'فاشل' },
  ];

  const types = [
    { value: 'all', label: 'جميع الأنواع' },
    { value: 'مبيعات', label: 'مبيعات' },
    { value: 'اشتراك', label: 'اشتراك' },
    { value: 'استرداد', label: 'استرداد' },
  ];

  const filteredTransactions = transactions.filter((t) => {
    const matchSearch =
      t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.client.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchType = typeFilter === 'all' || t.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const totalTransactions = transactions.length;
  const successfulTransactions = transactions.filter((t) => t.status === 'ناجح').length;
  const totalRevenue = transactions.reduce((sum, t) => (t.sign === '+' ? sum + t.net : sum - t.net), 0);
  const platformFee = transactions.filter((t) => t.type === 'مبيعات').reduce((sum, t) => sum + t.amount * 0.05, 0);
  const currentBalance = walletBalance;

  const reportRef = useRef(null);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    showToast('جاري تصدير التقرير...');
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('finance-report.pdf');
      showToast('تم تصدير التقرير بنجاح');
    } catch (err) {
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
          <span className="stat-value blue">د.ل {currentBalance.toLocaleString()}</span>
          <span className="stat-sub">رصيد المتجر</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">صافي الإيرادات</span>
            <TrendingUp size={20} className="stat-icon green" />
          </div>
          <span className="stat-value green">د.ل {totalRevenue.toLocaleString()}</span>
          <span className="stat-sub">+15% عن الشهر الماضي</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">عمولة المنصة</span>
            <ArrowUpRight size={20} className="stat-icon orange" />
          </div>
          <span className="stat-value orange">د.ل {platformFee.toLocaleString()}</span>
          <span className="stat-sub">5% من المبيعات</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">عهدة المتجر</span>
            <Landmark size={20} className="stat-icon orange" />
          </div>
          <span className="stat-value orange">
            د.ل {(custodySummary?.total_custody_owed ?? 0).toLocaleString()}
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
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#242240" />
              <XAxis dataKey="month" tick={{ fontSize: 13, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 13, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value) => [`${value.toLocaleString()} د.ل`, 'الإيرادات']}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#8b3dff"
                strokeWidth={2}
                dot={{ r: 4, fill: '#8b3dff', strokeWidth: 2, stroke: '#18162e' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="transactions-section" ref={reportRef}>
        <div className="transactions-header">
          <div className="transactions-title-group">
            <h3 className="section-title">قائمة المعاملات المالية</h3>
            <p className="section-subtitle">جميع العمليات المالية للمتجر</p>
          </div>
          <div className="transactions-actions">
            <button className="wallet-btn" onClick={() => setIsWalletOpen(true)}>
              <Wallet size={16} />
              المحفظة
            </button>
            <button className="export-btn" onClick={handleExportPDF}>
              <Download size={16} />
              تصدير التقرير (PDF)
            </button>
          </div>
        </div>

        <div className="finance-controls">
          <div className="filter-dropdown">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-dropdown">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {types.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="البحث برقم المعاملة أو اسم العميل..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

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
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr key={t.id}>
                    <td className="txn-code">{t.code}</td>
                    <td>
                      <div className="txn-date">{t.date}</div>
                      <div className="txn-time">{t.time}</div>
                    </td>
                    <td>
                      <span className={`type-badge ${t.type === 'مبيعات' ? 'sales' : t.type === 'اشتراك' ? 'sub' : 'refund'}`}>
                        {t.type}
                      </span>
                    </td>
                    <td>{t.client}</td>
                    <td className={`amount-cell ${t.sign === '+' ? 'positive' : 'negative'}`}>
                      د.ل {t.amount}{t.sign}
                    </td>
                    <td className={`amount-cell ${t.sign === '+' ? 'positive' : 'negative'}`}>
                      د.ل {t.net}{t.sign}
                    </td>
                    <td>
                      <span className={`status-badge ${t.status === 'ناجح' ? 'success' : t.status === 'معلق' ? 'pending' : 'failed'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="action-btn view-btn"
                        title="عرض التفاصيل"
                        onClick={() => setSelectedTransaction(t)}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="no-results-cell">لا توجد معاملات تطابق بحثك.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default Finance;
