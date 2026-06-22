import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise, isStripeConfigured } from '../api/stripe';

const elementsOptions = {
  locale: 'ar',
};

export function StripeProvider({ children }) {
  if (!isStripeConfigured()) {
    return children;
  }

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      {children}
    </Elements>
  );
}

/** سياق Elements منفصل للنوافذ المنبثقة — يضمن تحميل حقول البطاقة بشكل صحيح */
export function StripeModalElements({ children, mountKey = 'stripe-modal' }) {
  if (!isStripeConfigured() || !stripePromise) {
    return children;
  }

  return (
    <Elements stripe={stripePromise} options={elementsOptions} key={mountKey}>
      {children}
    </Elements>
  );
}

export default StripeProvider;
