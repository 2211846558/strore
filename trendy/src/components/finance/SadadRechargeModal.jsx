import React, { useState } from 'react';
import { X, Wallet } from 'lucide-react';
import './SadadRechargeModal.css';

const SadadRechargeModal = ({ isOpen, onClose, onConfirm }) => {
  const [phone, setPhone] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onConfirm({ phone: phone.trim(), birthYear: birthYear.trim(), amount });
      setPhone('');
      setBirthYear('');
      setAmount('');
      onClose();
    } catch (err) {
      setError(err.message || 'تعذّر إتمام عملية الشحن');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sadad-overlay" onClick={onClose}>
      <div className="sadad-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sadad-close" onClick={onClose} aria-label="إغلاق">
          <X size={22} />
        </button>

        <div className="sadad-icon-wrap">
          <Wallet size={28} />
        </div>
        <h2>رصيد المحفظة</h2>
        <p className="sadad-subtitle">عملية شحن عبر سداد</p>

        <form onSubmit={handleSubmit} className="sadad-form">
          <div className="sadad-field readonly">
            <span>سداد</span>
          </div>
          <input
            type="tel"
            placeholder="رقم الهاتف"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
            dir="ltr"
            required
          />
          <input
            type="text"
            placeholder="سنة الميلاد"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            dir="ltr"
            required
            maxLength={4}
          />
          <input
            type="number"
            placeholder="المبلغ"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            step="0.01"
            dir="ltr"
            required
          />

          {error && <p className="sadad-error">{error}</p>}

          <button type="submit" className="sadad-submit" disabled={loading}>
            {loading ? 'جاري التأكيد...' : 'تأكيد البيانات'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SadadRechargeModal;
