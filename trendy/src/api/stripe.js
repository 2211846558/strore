/**
 * Stripe — مطابق لعقد الـ API في api.md
 *
 * 1. الفرونت إند يتواصل مع Stripe مباشرة (Publishable Key) لإنشاء payment_method_id
 * 2. ثم يرسل إلى الباكند: POST /api/stores/wallet/charge
 *    body: { store_id, amount, payment_method_id }
 */

import { loadStripe } from '@stripe/stripe-js';

export const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() || '';

export const stripePromise = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : null;

export function isStripeConfigured() {
  return Boolean(STRIPE_PUBLISHABLE_KEY && stripePromise);
}

const STRIPE_ERROR_MESSAGES = {
  'Your card number is incomplete.': 'رقم البطاقة غير مكتمل.',
  'Your card number is invalid.': 'رقم البطاقة غير صالح.',
  'Your card\'s expiration date is incomplete.': 'تاريخ انتهاء البطاقة غير مكتمل.',
  'Your card\'s expiration date is invalid.': 'تاريخ انتهاء البطاقة غير صالح.',
  'Your card\'s security code is incomplete.': 'رمز الأمان (CVV) غير مكتمل.',
  'Your card\'s security code is invalid.': 'رمز الأمان (CVV) غير صالح.',
  'Your card has expired.': 'انتهت صلاحية البطاقة.',
  'Your card was declined.': 'تم رفض البطاقة.',
};

export function translateStripeError(message) {
  if (!message) return 'تعذّر إتمام عملية الدفع';
  return STRIPE_ERROR_MESSAGES[message] || message;
}

/** تنسيق حقول Stripe (تاريخ/CVV) */
export function getStripeSplitFieldStyle() {
  const isLight =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'light';

  return {
    style: {
      base: {
        fontSize: '16px',
        color: isLight ? '#2d2d2d' : '#e8e6f5',
        fontFamily: '"Tajawal", system-ui, sans-serif',
        iconColor: isLight ? '#5d59af' : '#8b3dff',
        lineHeight: '24px',
        '::placeholder': {
          color: isLight ? '#9e9e9e' : '#7b7898',
        },
      },
      invalid: {
        color: '#dc2626',
        iconColor: '#dc2626',
      },
    },
  };
}

/** رقم البطاقة — بدون زر Link «أدخل البيانات تلقائياً» */
export function getStripeCardNumberOptions() {
  return {
    ...getStripeSplitFieldStyle(),
    disableLink: true,
  };
}

/**
 * إنشاء payment_method_id آمن عبر Stripe (CardElement).
 * بيانات البطاقة لا تمرّ بسيرفرنا — فقط المعرّف pm_...
 */
export async function createStripeCardPaymentMethod(stripe, cardElement) {
  if (!stripe || !cardElement) {
    throw new Error('بوابة الدفع غير جاهزة. يرجى المحاولة لاحقاً.');
  }

  const { error, paymentMethod } = await stripe.createPaymentMethod({
    type: 'card',
    card: cardElement,
  });

  if (error) {
    throw new Error(translateStripeError(error.message));
  }

  if (!paymentMethod?.id) {
    throw new Error('تعذّر إنشاء طريقة الدفع');
  }

  return paymentMethod;
}
