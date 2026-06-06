import React from 'react';
import './StatCard.css';

const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, highlightValue, trend }) => {
  return (
    <div className={`stat-card ${colorClass || ''}`}>
      <div className="stat-card-content">
        <div className="stat-header">
          <h3 className="stat-title">{title}</h3>
          {Icon && <Icon className="stat-icon" size={20} />}
        </div>
        <div className="stat-body">
          {highlightValue ? (
            <div className="stat-value highlight">
              {value} <span className="currency">{highlightValue}</span>
            </div>
          ) : (
            <div className="stat-value">{value}</div>
          )}
        </div>
        <div className="stat-footer">
          <p className="stat-subtitle">{subtitle}</p>
          {trend && (
            <div className={`stat-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
              {trend.value}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;