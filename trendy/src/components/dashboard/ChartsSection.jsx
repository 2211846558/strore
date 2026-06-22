import React from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import './ChartsSection.css';

const ChartsSection = ({ data = [], loading = false }) => {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          <p className="tooltip-value">{`${Number(payload[0].value).toLocaleString('ar-LY')} د.ل`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="charts-section">
      <div className="chart-card chart-card-full">
        <div className="chart-header">
          <h3 className="chart-title">الإيرادات الشهرية للمتجر</h3>
          <p className="chart-subtitle">تطور الإيرادات خلال آخر 5 أشهر</p>
        </div>
        <div className="chart-container">
          {loading ? (
            <div className="chart-loading">جاري تحميل الإيرادات...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 20, right: 0, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b3dff" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#8b3dff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#242240" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4285f4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartsSection;
