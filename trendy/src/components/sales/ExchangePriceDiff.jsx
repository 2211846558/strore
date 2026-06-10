import React from 'react';
import { getExchangePriceDiff } from '../../api/pos';

const ExchangePriceDiff = ({ oldUnitPrice, quantity, newUnitPrice }) => {
  const qty = quantity || 1;
  const info = getExchangePriceDiff(oldUnitPrice, qty, newUnitPrice);

  if (info.type === 'equal') {
    return (
      <div className="sales-exchange-diff equal">
        <p className="sales-exchange-diff-title">فرق السعر</p>
        <p className="sales-exchange-diff-note" style={{ margin: 0 }}>
          لا يوجد فرق في السعر بين المنتجين (كلاهما {info.oldTotal} د.ل)
        </p>
      </div>
    );
  }

  const isRefund = info.type === 'refund';

  return (
    <div className={`sales-exchange-diff ${info.type}`}>
      <div className="sales-exchange-diff-rows">
        <div className="sales-exchange-diff-row">
          <span>إجمالي المنتج القديم ({qty} قطعة):</span>
          <strong>{info.oldTotal} د.ل</strong>
        </div>
        <div className="sales-exchange-diff-row">
          <span>إجمالي المنتج الجديد ({qty} قطعة):</span>
          <strong>{info.newTotal} د.ل</strong>
        </div>
      </div>
      <p className="sales-exchange-diff-title">
        {isRefund ? 'مبلغ يُسترد للعميل' : 'مبلغ إضافي على العميل'}
      </p>
      <p className="sales-exchange-diff-amount">{info.amount} د.ل</p>
      <p className="sales-exchange-diff-note">
        {isRefund
          ? 'يجب على المتجر إرجاع هذا المبلغ للعميل لأن المنتج البديل أرخص.'
          : 'يجب على العميل دفع هذا المبلغ الإضافي لأن المنتج البديل أغلى.'}
      </p>
    </div>
  );
};

export default ExchangePriceDiff;
