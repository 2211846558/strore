import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { fetchAccountStatement } from '../../api/finance';
import { getApiErrorMessage } from '../../api/stores';
import './StatementModal.css';

const getTypeClass = (type) => {
  if (type === 'مبيعات') return 'sales';
  if (type === 'اشتراك') return 'sub';
  return 'refund';
};

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date();
monthStart.setDate(1);
const defaultStart = monthStart.toISOString().slice(0, 10);

const StatementModal = ({ isOpen, onClose, onExportToast }) => {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [items, setItems] = useState([]);
  const [exporting, setExporting] = useState(false);
  const statementRef = useRef(null);

  const loadStatement = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAccountStatement({ startDate, endDate });
      setOpeningBalance(Number(data.openingBalance ?? 0));
      setClosingBalance(Number(data.closingBalance ?? 0));
      setItems(data.transactions ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل كشف الحساب'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, startDate, endDate]);

  useEffect(() => {
    loadStatement();
  }, [loadStatement]);

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

          {error && <p className="statement-error">{error}</p>}

          <div className="balance-row">
            <div className="balance-item">
              <span className="balance-label">الرصيد الافتتاحي</span>
              <span className="balance-value opening">
                {openingBalance.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
            <div className="balance-item">
              <span className="balance-label">الرصيد الختامي</span>
              <span className="balance-value closing">
                {closingBalance.toLocaleString('ar-LY')} د.ل
              </span>
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
                  <th>الوصف</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="no-results-cell">
                      جاري تحميل كشف الحساب...
                    </td>
                  </tr>
                ) : items.length > 0 ? (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.date}</td>
                      <td>{item.time}</td>
                      <td>
                        <span className={`type-badge ${getTypeClass(item.type)}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className={`amount-cell ${item.sign === '+' ? 'positive' : 'negative'}`}>
                        {item.sign}{item.net} د.ل
                      </td>
                      <td>{item.description || '—'}</td>
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
          <button type="button" className="save-button" onClick={handleExport} disabled={exporting || loading}>
            {exporting ? 'جاري التصدير...' : 'تصدير PDF'}
          </button>
          <button type="button" className="cancel-button" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatementModal;
