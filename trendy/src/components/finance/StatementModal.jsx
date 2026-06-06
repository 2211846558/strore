import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { X, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './StatementModal.css';

const OPENING_BALANCE = 10000;

const getTypeClass = (type) => {
  if (type === 'مبيعات') return 'sales';
  if (type === 'اشتراك') return 'sub';
  return 'refund';
};

const StatementModal = ({ isOpen, onClose, transactions = [], onExportToast }) => {
  const [startDate, setStartDate] = useState('2026-05-01');
  const [endDate, setEndDate] = useState('2026-05-03');
  const [exporting, setExporting] = useState(false);
  const statementRef = useRef(null);

  const { filteredItems, openingBalance, closingBalance } = useMemo(() => {
    const sorted = [...transactions]
      .filter((t) => t.status === 'ناجح')
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });

    let runningBalance = OPENING_BALANCE;
    const withBalance = sorted.map((t) => {
      const delta = t.sign === '+' ? t.net : -t.net;
      runningBalance += delta;
      return {
        date: t.date,
        time: t.time,
        type: t.type,
        amount: t.net,
        sign: t.sign,
        balance: runningBalance,
      };
    });

    const inRange = withBalance.filter(
      (item) => item.date >= startDate && item.date <= endDate
    );

    const beforeRange = withBalance.filter((item) => item.date < startDate);
    const opening =
      beforeRange.length > 0
        ? beforeRange[beforeRange.length - 1].balance
        : OPENING_BALANCE;

    const upToEnd = withBalance.filter((item) => item.date <= endDate);
    const closing =
      upToEnd.length > 0 ? upToEnd[upToEnd.length - 1].balance : opening;

    return {
      filteredItems: [...inRange].reverse(),
      openingBalance: opening,
      closingBalance: closing,
    };
  }, [transactions, startDate, endDate]);

  const handleExport = useCallback(async () => {
    if (!statementRef.current || exporting) return;
    setExporting(true);
    onExportToast?.('جاري تصدير كشف الحساب...');
    try {
      const canvas = await html2canvas(statementRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#1b1836',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`كشف-حساب-${startDate}-${endDate}.pdf`);
      onExportToast?.('تم تصدير كشف الحساب بنجاح');
    } catch {
      onExportToast?.('حدث خطأ أثناء التصدير');
    } finally {
      setExporting(false);
    }
  }, [exporting, startDate, endDate, onExportToast]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStartChange = (e) => {
    const value = e.target.value;
    setStartDate(value);
    if (value > endDate) setEndDate(value);
  };

  const handleEndChange = (e) => {
    const value = e.target.value;
    setEndDate(value);
    if (value < startDate) setStartDate(value);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="statement-title">
      <div className="modal-content statement-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="statement-title" className="modal-title">كشف حساب تفصيلي</h2>
          <button type="button" className="close-button" onClick={onClose} aria-label="إغلاق">
            <X size={24} />
          </button>
        </div>

        <div className="statement-body" ref={statementRef}>
          <div className="date-row">
            <div className="date-group">
              <label htmlFor="statement-start">تاريخ البداية</label>
              <input
                id="statement-start"
                type="date"
                value={startDate}
                onChange={handleStartChange}
              />
            </div>
            <div className="date-group">
              <label htmlFor="statement-end">تاريخ النهاية</label>
              <input
                id="statement-end"
                type="date"
                value={endDate}
                onChange={handleEndChange}
              />
            </div>
          </div>

          <div className="balance-row">
            <div className="balance-item">
              <span className="balance-label">الرصيد الافتتاحي</span>
              <span className="balance-value opening">{openingBalance.toLocaleString()} د.ل</span>
            </div>
            <div className="balance-item">
              <span className="balance-label">الرصيد الختامي</span>
              <span className="balance-value closing">{closingBalance.toLocaleString()} د.ل</span>
            </div>
          </div>

          <div className="statement-table-wrapper">
            <table className="statement-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الوقت</th>
                  <th>نوع العملية</th>
                  <th>المبلغ</th>
                  <th>الرصيد المتراكم</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length > 0 ? (
                  filteredItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.date}</td>
                      <td>{item.time}</td>
                      <td>
                        <span className={`type-badge ${getTypeClass(item.type)}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className={`amount-cell ${item.sign === '+' ? 'positive' : 'negative'}`}>
                        {item.sign}{item.amount} د.ل
                      </td>
                      <td className="balance-cell">{item.balance.toLocaleString()} د.ل</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="no-results-cell">
                      لا توجد معاملات في هذه الفترة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="cancel-button" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatementModal;
