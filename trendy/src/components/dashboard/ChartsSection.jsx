import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import './ChartsSection.css';

const ChartsSection = () => {
  // Mock data for weekly orders (Bar Chart)
  const weeklyOrdersData = [
    { name: 'السبت', orders: 23 },
    { name: 'الأحد', orders: 31 },
    { name: 'الاثنين', orders: 19 },
    { name: 'الثلاثاء', orders: 38 },
    { name: 'الأربعاء', orders: 27 },
    { name: 'الخميس', orders: 42 },
    { name: 'الجمعة', orders: 35 },
  ];

  // Mock data for monthly revenue (Area Chart)
  const monthlyRevenueData = [
    { name: 'يناير', revenue: 35000 },
    { name: 'فبراير', revenue: 42000 },
    { name: 'مارس', revenue: 38000 },
    { name: 'أبريل', revenue: 52000 },
    { name: 'مايو', revenue: 48000 },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          <p className="tooltip-value">{`${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="charts-section">
      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">الطلبات الأسبوعية للمتجر</h3>
          <p className="chart-subtitle">عدد الطلبات خلال الأسبوع الحالي</p>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyOrdersData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#242240" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="orders" fill="#8b3dff" radius={[6, 6, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">الإيرادات الشهرية للمتجر</h3>
          <p className="chart-subtitle">تطور الإيرادات خلال آخر 5 أشهر</p>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyRevenueData} margin={{ top: 20, right: 0, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b3dff" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#8b3dff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#242240" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#4285f4" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ChartsSection;
