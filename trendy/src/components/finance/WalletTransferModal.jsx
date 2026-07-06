import React, { useMemo, useState } from 'react';
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { X, ArrowLeftRight, CreditCard, ShieldCheck } from 'lucide-react';
import {
  createStripeCardPaymentMethod,
  isStripeConfigured,
  STRIPE_PUBLISHABLE_KEY,
  translateStripeError,
} from '../../api/stripe';
import { isValidDecimalInput, preventWheelChange } from '../../utils/numericInput';
import './SadadRechargeModal.css';

const getStripeFieldStyle = () => ({
  style: {
    base: {
      fontSize: '16px',
      color: '#e8e6f5',
      fontFamily: '"Tajawal", system-ui, sans-serif',
      iconColor: '#8b3dff',
      lineHeight: '24px',
      '::placeholder': {
        color: '#7b7898',
      },
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
});

const WalletTransferForm = ({ onClose, onConfirm }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cardFields, setCardFields] = useState({ number: false, expiry: false, cvc: false });
  const [readyCount, setReadyCount] = useState(0);

  const stripeFieldOptions = useMemo(() => getStripeFieldStyle(), []);
  const cardComplete = cardFields.number && cardFields.expiry && cardFields.cvc;
  const cardReady = readyCount >= 3;

  const handleFieldChange = (field) => (event) => {
    setCardFields((prev) => ({ ...prev, [field]: event.complete }));
    if (event.error) {
      setError(translateStripeError(event.error.message));
    } else if (error && !event.empty) {
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!stripe || !elements) {
      setError('جاري تحميل بوابة الدفع. يرجى الانتظار ثم المحاولة مجدداً.');
      return;
    }

    const value = Number(amount);
    if (!value || value <= 0) {
      setError('يرجى إدخال مبلغ صالح');
      return;
    }

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      setError('حقول البطاقة غير متاحة. يرجى إعادة فتح النافذة.');
      return;
    }

    setLoading(true);
    try {
      const paymentMethod = await createStripeCardPaymentMethod(stripe, cardNumberElement);
      await onConfirm({
        paymentMethodId: paymentMethod.id,
        amount: value,
        cardLast4: paymentMethod.card?.last4,
      });
      setAmount('');
      cardNumberElement.clear();
      elements.getElement(CardExpiryElement)?.clear();
      elements.getElement(CardCvcElement)?.clear();
      setCardFields({ number: false, expiry: false, cvc: false });
      onClose();
    } catch (err) {
      setError(err.message || 'تعذّر إتمام عملية التحويل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="sadad-form">
      <label className="sadad-field-label">
        <CreditCard size={16} />
        بيانات البطاقة المستلمة
      </label>

      <div className="sadad-stripe-fields">
        <div className="sadad-stripe-field">
          <span className="sadad-stripe-label">رقم البطاقة</span>
          <div className="sadad-stripe-input">
            <CardNumberElement
              options={stripeFieldOptions}
              onReady={() => setReadyCount((c) => c + 1)}
              onChange={handleFieldChange('number')}
            />
          </div>
        </div>

        <div className="sadad-stripe-row">
          <div className="sadad-stripe-field">
            <span className="sadad-stripe-label">تاريخ الانتهاء</span>
            <div className="sadad-stripe-input">
              <CardExpiryElement
                options={stripeFieldOptions}
                onReady={() => setReadyCount((c) => c + 1)}
                onChange={handleFieldChange('expiry')}
              />
            </div>
          </div>
          <div className="sadad-stripe-field">
            <span className="sadad-stripe-label">CVV</span>
            <div className="sadad-stripe-input">
              <CardCvcElement
                options={stripeFieldOptions}
                onReady={() => setReadyCount((c) => c + 1)}
                onChange={handleFieldChange('cvc')}
              />
            </div>
          </div>
        </div>
      </div>

      {!cardReady && <p className="sadad-hint">جاري تحميل حقول البطاقة...</p>}

      <p className="sadad-secure-note">
        <ShieldCheck size={14} />
        الدفع عبر Stripe — بيانات البطاقة لا تمرّ بخوادمنا
      </p>

      <input
        type="text"
        inputMode="decimal"
        placeholder="المبلغ (د.ل)"
        value={amount}
        onChange={(e) => {
          const raw = e.target.value;
          if (isValidDecimalInput(raw)) setAmount(raw);
        }}
        onWheel={preventWheelChange}
        dir="ltr"
        required
      />

      {error && <p className="sadad-error">{error}</p>}

      <button
        type="submit"
        className="sadad-submit"
        disabled={loading || !stripe || !cardReady || !cardComplete}
      >
        {loading ? 'جاري التحويل...' : 'تأكيد التحويل'}
      </button>
    </form>
  );
};

const WalletTransferModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  const stripeReady = isStripeConfigured();

  return (
    <div className="sadad-overlay" onClick={onClose}>
      <div className="sadad-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sadad-close" onClick={onClose} aria-label="إغلاق">
          <X size={22} />
        </button>

        <div className="sadad-icon-wrap">
          <ArrowLeftRight size={28} />
        </div>
        <h2>تحويل الرصيد</h2>
        <p className="sadad-subtitle">تحويل الرصيد إلى بطاقة بنكية عبر Stripe</p>

        {!stripeReady ? (
          <div className="sadad-stripe-missing">
            <p className="sadad-error">مفتاح Stripe غير مُعدّ في ملف .env</p>
            <p className="sadad-hint">
              أضف: <code>VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...</code>
            </p>
            {!STRIPE_PUBLISHABLE_KEY && (
              <p className="sadad-hint">استخدم نفس قيمة STRIPE_KEY من الباكند.</p>
            )}
          </div>
        ) : (
          <WalletTransferForm onClose={onClose} onConfirm={onConfirm} />
        )}
      </div>
    </div>
  );
};

export default WalletTransferModal;
