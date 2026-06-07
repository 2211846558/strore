import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ShieldCheck, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { verifyStoreJoin } from '../../api/auth';
import { getApiErrorMessage } from '../../api/stores';
import '../../pages/Login.css';

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 600;

const JoinEmailVerification = ({ storeEmail, storeName, onVerified }) => {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft]);

  const formatTime = (total) => {
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const updateDigit = (index, value) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((char, i) => {
      next[i] = char;
    });
    setDigits(next);
    setError('');

    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const otp = digits.join('');
    if (otp.length !== OTP_LENGTH) {
      setError('يرجى إدخال رمز التحقق المكوّن من 6 أرقام');
      return;
    }

    if (secondsLeft <= 0) {
      setError('انتهت صلاحية الرمز. أعد إرسال طلب الانضمام للحصول على رمز جديد.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyStoreJoin({ storeEmail, otp });
      onVerified?.(res?.message);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر التحقق من الرمز، حاول مرة أخرى'));
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container join-verify-container">
        <div className="login-header">
          <div className="brand-logo">
            <span className="brand-title">Trendy</span>
            <span className="brand-dot">.</span>
          </div>
          <div className="verify-icon-wrapper">
            <ShieldCheck size={36} />
          </div>
          <h1 className="login-title">التحقق من البريد الإلكتروني</h1>
          <p className="login-subtitle">
            تم إرسال رمز مكوّن من 6 أرقام إلى إيميل المتجر
          </p>
        </div>

        <div className="verify-email-badge" dir="ltr">
          <Mail size={18} />
          <span>{storeEmail}</span>
        </div>

        {storeName && (
          <p className="verify-store-name">
            متجر: <strong>{storeName}</strong>
          </p>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="otp-0">رمز التحقق</label>
            <div className="otp-inputs" onPaste={handlePaste}>
              {digits.map((digit, index) => (
                <input
                  key={index}
                  id={index === 0 ? 'otp-0' : undefined}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={digit}
                  onChange={(e) => updateDigit(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="otp-digit"
                  dir="ltr"
                  aria-label={`رقم ${index + 1} من رمز التحقق`}
                />
              ))}
            </div>
            <span className={`input-hint otp-timer ${secondsLeft <= 60 ? 'otp-timer-warning' : ''}`}>
              {secondsLeft > 0
                ? `صلاحية الرمز: ${formatTime(secondsLeft)}`
                : 'انتهت صلاحية الرمز'}
            </span>
          </div>

          {error && (
            <div className="form-error-banner" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isLoading || secondsLeft <= 0 || digits.join('').length !== OTP_LENGTH}
          >
            {isLoading ? (
              <span className="loader"></span>
            ) : (
              <>
                <span>تأكيد الرمز</span>
                <ArrowRight size={20} className="btn-icon" />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>
            <Link to="/login">
              <ArrowLeft size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} />
              العودة لتسجيل الدخول
            </Link>
          </p>
        </div>
      </div>

      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>
    </div>
  );
};

export const JoinVerificationSuccess = ({ message }) => (
  <div className="login-page">
    <div className="login-container" style={{ textAlign: 'center' }}>
      <div className="success-icon-wrapper">
        <Check size={48} className="success-icon" />
      </div>
      <h2 className="login-title">تم التحقق بنجاح</h2>
      <p className="login-subtitle">
        {message || 'تم تفعيل البريد الإلكتروني لطلب الانضمام. سيتم مراجعة بياناتك والتواصل معك قريباً بعد موافقة الإدارة.'}
      </p>
      <Link to="/login" className="login-submit-btn" style={{ marginTop: 24, display: 'inline-flex' }}>
        <ArrowLeft size={20} className="btn-icon" />
        <span>العودة لتسجيل الدخول</span>
      </Link>
    </div>
    <div className="bg-shape shape-1"></div>
    <div className="bg-shape shape-2"></div>
  </div>
);

export default JoinEmailVerification;
