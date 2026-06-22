import React, { useState, useEffect, useMemo } from 'react';
import { X, Wallet, CreditCard, ArrowRight, ShieldCheck } from 'lucide-react';
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { useWalletBalance, useChargeWallet } from '../../api/hooks/useWallet';
import { useStore } from '../../context/AuthContext';
import { subscribeToPlan, renewStorePlan, changeStorePlan, previewSubscribeToPlan } from '../../api/plans';
import { getApiErrorMessage } from '../../api/stores';
import {
  createStripeCardPaymentMethod,
  isStripeConfigured,
  STRIPE_PUBLISHABLE_KEY,
  translateStripeError,
  getStripeCardNumberOptions,
  getStripeSplitFieldStyle,
} from '../../api/stripe';
import { isValidDecimalInput, preventWheelChange } from '../../utils/numericInput';
import { StripeModalElements } from '../../providers/StripeProvider';
import './PlanSubscribeWalletModal.css';

const usePlanWalletState = (plan) => {
  const { data: walletData, refetch: refreshWallet } = useWalletBalance();
  const { storeId } = useStore();
  const balance = walletData?.balance ?? 0;
  const planPrice = Number(plan?.price ?? 0);
  const hasEnoughBalance = balance >= planPrice;
  const missingAmount = Math.max(0, planPrice - balance);
  return { balance, refreshWallet, storeId, planPrice, hasEnoughBalance, missingAmount };
};

const PlanWalletBalanceBox = ({ balance, hasEnoughBalance, missingAmount }) => (
  <div className="plan-wallet-balance-box">
    <span className="plan-wallet-balance-label">الرصيد الحالي</span>
    <span className={`plan-wallet-balance-value ${hasEnoughBalance ? 'ok' : 'low'}`}>
      {balance.toFixed(2)} د.ل
    </span>
    {!hasEnoughBalance && (
      <span className="plan-wallet-missing">
        ينقصك {missingAmount.toFixed(2)} د.ل للاشتراك
      </span>
    )}
  </div>
);

const PlanSubscribeActions = ({
  plan,
  action = 'subscribe',
  onClose,
  onConfirm,
  hasEnoughBalance,
  storeId,
  refreshWallet,
  loadingPreview = false,
}) => {
  const [subscribeError, setSubscribeError] = useState('');
  const [subscribeLoading, setSubscribeLoading] = useState(false);

  const handleSubscribe = async () => {
    setSubscribeError('');
    if (!storeId) {
      setSubscribeError('لم يتم تحديد المتجر. يرجى تسجيل الدخول مرة أخرى.');
      return;
    }
    if (!hasEnoughBalance) {
      setSubscribeError('رصيد المحفظة غير كافٍ. يرجى شحن المحفظة أولاً.');
      return;
    }

    setSubscribeLoading(true);
    try {
      let res;
      if (action === 'renew') {
        res = await renewStorePlan(storeId);
      } else if (action === 'change') {
        res = await changeStorePlan(storeId, plan.id);
      } else {
        res = await subscribeToPlan({ planId: plan.id, storeId });
      }
      await refreshWallet();
      onConfirm(plan, res);
      onClose();
    } catch (err) {
      setSubscribeError(getApiErrorMessage(err, 'تعذّر إتمام الاشتراك'));
    } finally {
      setSubscribeLoading(false);
    }
  };

  return (
    <div className="plan-wallet-actions">
      {subscribeError && <p className="plan-wallet-error">{subscribeError}</p>}
      <button
        type="button"
        className="plan-wallet-btn subscribe"
        onClick={handleSubscribe}
        disabled={!hasEnoughBalance || subscribeLoading || loadingPreview}
      >
        {subscribeLoading
          ? 'جاري المعالجة...'
          : action === 'renew'
            ? 'تأكيد التجديد'
            : action === 'change'
              ? 'تأكيد تغيير الخطة'
              : 'تأكيد الاشتراك'}
      </button>
      <button type="button" className="plan-wallet-btn back" onClick={onClose} disabled={subscribeLoading}>
        <ArrowRight size={18} />
        العودة للخطط
      </button>
    </div>
  );
};

const PlanSubscribeWalletForm = ({ plan, action = 'subscribe', onClose, onConfirm, onToast, loadingPreview = false }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { balance, refreshWallet, storeId, hasEnoughBalance, missingAmount } = usePlanWalletState(plan);
  const chargeMutation = useChargeWallet();
  const [amount, setAmount] = useState('');
  const [rechargeError, setRechargeError] = useState('');
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeSuccess, setRechargeSuccess] = useState(false);
  const [cardFields, setCardFields] = useState({
    number: false,
    expiry: false,
    cvc: false,
  });

  const stripeNumberOptions = useMemo(() => getStripeCardNumberOptions(), []);
  const stripeFieldOptions = useMemo(() => getStripeSplitFieldStyle(), []);
  const cardComplete = cardFields.number && cardFields.expiry && cardFields.cvc;
  const stripeReady = Boolean(stripe && elements);

  const handleFieldChange = (field) => (event) => {
    setCardFields((prev) => ({ ...prev, [field]: event.complete }));
    if (event.error) {
      setRechargeError(translateStripeError(event.error.message));
    } else if (rechargeError && !event.empty) {
      setRechargeError('');
    }
  };

  useEffect(() => {
    const defaultAmount = missingAmount > 0 ? missingAmount : plan?.price;
    if (defaultAmount != null) {
      setAmount(String(defaultAmount));
    }
    setRechargeError('');
    setRechargeSuccess(false);
    setCardFields({ number: false, expiry: false, cvc: false });
  }, [plan?.id, plan?.price, missingAmount]);

  const handleRecharge = async (e) => {
    e.preventDefault();
    setRechargeError('');
    setRechargeSuccess(false);

    if (!stripe || !elements) {
      setRechargeError('جاري تحميل بوابة الدفع. يرجى الانتظار ثم المحاولة مجدداً.');
      return;
    }

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      setRechargeError('حقول البطاقة غير متاحة. يرجى إعادة فتح النافذة.');
      return;
    }

    setRechargeLoading(true);
    try {
      const paymentMethod = await createStripeCardPaymentMethod(stripe, cardNumberElement);
      const charged = await chargeMutation.mutateAsync({ storeId, amount: Number(amount), paymentMethodId: paymentMethod.id });
      await refreshWallet();
      cardNumberElement.clear();
      elements.getElement(CardExpiryElement)?.clear();
      elements.getElement(CardCvcElement)?.clear();
      setCardFields({ number: false, expiry: false, cvc: false });
      setRechargeSuccess(true);
      onToast?.(`تم شحن المحفظة بمبلغ ${charged.toLocaleString()} د.ل بنجاح`);
    } catch (err) {
      setRechargeError(getApiErrorMessage(err, 'تعذّر إتمام عملية الشحن'));
    } finally {
      setRechargeLoading(false);
    }
  };

  return (
    <>
      <PlanWalletBalanceBox
        balance={balance}
        hasEnoughBalance={hasEnoughBalance}
        missingAmount={missingAmount}
      />

      {hasEnoughBalance && (
        <p className="plan-wallet-success plan-wallet-ready-hint">
          رصيدك كافٍ للاشتراك ({balance.toFixed(2)} د.ل). يمكنك تأكيد الاشتراك مباشرة، أو شحن المحفظة إضافياً عبر البطاقة.
        </p>
      )}

      <form onSubmit={handleRecharge} className="plan-wallet-form">
        <label className="plan-wallet-field-label">
          <CreditCard size={16} />
          بيانات البطاقة
        </label>
        <div className="plan-wallet-stripe-fields">
          {!stripeReady ? (
            <p className="plan-wallet-stripe-loading">جاري تهيئة بوابة الدفع...</p>
          ) : (
            <>
              <div className="plan-wallet-stripe-field">
                <label className="plan-wallet-stripe-label">رقم البطاقة</label>
                <div className="plan-wallet-stripe-card">
                  <CardNumberElement
                    options={stripeNumberOptions}
                    onChange={handleFieldChange('number')}
                  />
                </div>
              </div>

              <div className="plan-wallet-stripe-row">
                <div className="plan-wallet-stripe-field">
                  <label className="plan-wallet-stripe-label">تاريخ الانتهاء</label>
                  <div className="plan-wallet-stripe-card">
                    <CardExpiryElement
                      options={stripeFieldOptions}
                      onChange={handleFieldChange('expiry')}
                    />
                  </div>
                  <span className="plan-wallet-stripe-hint">مثال: 12 / 34</span>
                </div>

                <div className="plan-wallet-stripe-field">
                  <label className="plan-wallet-stripe-label">رمز الأمان (CVV)</label>
                  <div className="plan-wallet-stripe-card">
                    <CardCvcElement
                      options={stripeFieldOptions}
                      onChange={handleFieldChange('cvc')}
                    />
                  </div>
                  <span className="plan-wallet-stripe-hint">3 أرقام خلف البطاقة</span>
                </div>
              </div>
            </>
          )}
        </div>
        <p className="plan-wallet-secure-note">
          <ShieldCheck size={14} />
          بيانات البطاقة تُعالَج مباشرة عبر Stripe ولا تمرّ بخوادمنا
        </p>

        <label className="plan-wallet-field-label">المبلغ (د.ل)</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="المبلغ"
          value={amount}
          onChange={(e) => {
            const raw = e.target.value;
            if (isValidDecimalInput(raw)) setAmount(raw);
          }}
          onWheel={preventWheelChange}
          dir="ltr"
          className="plan-wallet-input"
          required
        />

        {rechargeError && <p className="plan-wallet-error">{rechargeError}</p>}
        {rechargeSuccess && !rechargeError && (
          <p className="plan-wallet-success">تم الشحن بنجاح. يمكنك الآن إتمام الاشتراك.</p>
        )}

        <button
          type="submit"
          className="plan-wallet-btn recharge"
          disabled={rechargeLoading || !stripeReady || !cardComplete}
        >
          {rechargeLoading ? 'جاري الشحن...' : 'شحن المحفظة'}
        </button>
      </form>

      <PlanSubscribeActions
        plan={plan}
        action={action}
        onClose={onClose}
        onConfirm={onConfirm}
        hasEnoughBalance={hasEnoughBalance}
        storeId={storeId}
        refreshWallet={refreshWallet}
        loadingPreview={loadingPreview}
      />
    </>
  );
};

const formatFriendlyDate = (dateStr) => {
  if (!dateStr) return '';
  const cleanStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const d = new Date(cleanStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

const PlanSubscribeWalletModal = ({
  isOpen,
  onClose,
  plan,
  action = 'subscribe',
  onConfirm,
  onToast,
}) => {
  const { refetch: refreshWallet } = useWalletBalance();
  const walletState = usePlanWalletState(plan);
  const stripeReady = isStripeConfigured();

  const [previewDates, setPreviewDates] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    refreshWallet();
  }, [isOpen, plan?.id, refreshWallet]);

  useEffect(() => {
    if (!isOpen || !plan?.id || !walletState.storeId) {
      setPreviewDates(null);
      return;
    }

    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError('');
    setPreviewDates(null);

    previewSubscribeToPlan({ planId: plan.id, storeId: walletState.storeId })
      .then((res) => {
        if (!cancelled) {
          setPreviewDates(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewError(getApiErrorMessage(err, 'تعذر احتساب تاريخ بدء الاشتراك المتوقع'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, plan?.id, walletState.storeId]);

  if (!isOpen || !plan) return null;

  return (
    <div className="plan-wallet-overlay" onClick={onClose}>
      <div className="plan-wallet-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="plan-wallet-close" onClick={onClose} aria-label="إغلاق" disabled={loadingPreview}>
          <X size={22} />
        </button>

        <div className="plan-wallet-icon-wrap">
          <Wallet size={28} />
        </div>
        <h2>محفظة الاشتراك</h2>
        <p className="plan-wallet-subtitle">
          {action === 'renew' ? (
            <>تجديد اشتراك <strong>{plan.title}</strong> — {plan.price} د.ل</>
          ) : action === 'change' ? (
            <>الانتقال إلى <strong>{plan.title}</strong> — {plan.price} د.ل</>
          ) : (
            <>اشتراك في <strong>{plan.title}</strong> — {plan.price} د.ل</>
          )}
        </p>

        {/* صندوق معاينة تاريخ بدء الاشتراك المتوقع */}
        <div className="plan-subscription-preview-box">
          {loadingPreview && (
            <div className="preview-loading">
              <span className="spinner"></span>
              <span>جاري احتساب تاريخ بدء الاشتراك...</span>
            </div>
          )}
          {previewError && (
            <div className="preview-error">
              <span>{previewError}</span>
            </div>
          )}
          {previewDates && !loadingPreview && (
            <div className="preview-dates-content">
              <div className="preview-dates-row">
                <div className="date-item">
                  <span className="date-label">تاريخ البدء المتوقع:</span>
                  <span className="date-val">{formatFriendlyDate(previewDates.starts_at)}</span>
                </div>
                <div className="date-item">
                  <span className="date-label">تاريخ الانتهاء المتوقع:</span>
                  <span className="date-val">{formatFriendlyDate(previewDates.ends_at)}</span>
                </div>
              </div>
              
              {previewDates.status === 'active' ? (
                <div className="preview-alert active-alert">
                  <span>سيبدأ هذا الاشتراك فوراً اليوم وسيتم تفعيل متجرك.</span>
                </div>
              ) : (
                <div className="preview-alert scheduled-alert">
                  <span>سيتم جدولة هذا الاشتراك ويبدأ تلقائياً بعد انتهاء الخطة الحالية في {formatFriendlyDate(previewDates.starts_at)}.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {!stripeReady && !walletState.hasEnoughBalance ? (
          <div className="plan-wallet-stripe-missing">
            <PlanWalletBalanceBox {...walletState} />
            <p className="plan-wallet-error">
              مفتاح Stripe Publishable Key غير مُعدّ في الواجهة.
            </p>
            <p className="plan-wallet-config-hint">
              أضيفي في ملف <code>.env</code>:
              <br />
              <code>VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...</code>
            </p>
            {!STRIPE_PUBLISHABLE_KEY && (
              <p className="plan-wallet-config-hint">
                استخدمي نفس قيمة <code>STRIPE_KEY</code> من الباكند.
              </p>
            )}
            <button type="button" className="plan-wallet-btn back" onClick={onClose}>
              <ArrowRight size={18} />
              العودة للخطط
            </button>
          </div>
        ) : !stripeReady && walletState.hasEnoughBalance ? (
          <>
            <PlanWalletBalanceBox {...walletState} />
            <p className="plan-wallet-success plan-wallet-ready-hint">
              رصيدك كافٍ للاشتراك ({walletState.balance.toFixed(2)} د.ل). اضغط «تأكيد الاشتراك» مباشرة.
            </p>
            <PlanSubscribeActions
              plan={plan}
              action={action}
              onClose={onClose}
              onConfirm={onConfirm}
              hasEnoughBalance={walletState.hasEnoughBalance}
              storeId={walletState.storeId}
              refreshWallet={refreshWallet}
              loadingPreview={loadingPreview}
            />
          </>
        ) : (
          <StripeModalElements mountKey={`plan-wallet-${plan.id}`}>
            <PlanSubscribeWalletForm
              key={plan.id}
              plan={plan}
              action={action}
              onClose={onClose}
              onConfirm={onConfirm}
              onToast={onToast}
              loadingPreview={loadingPreview}
            />
          </StripeModalElements>
        )}
      </div>
    </div>
  );
};

export default PlanSubscribeWalletModal;
