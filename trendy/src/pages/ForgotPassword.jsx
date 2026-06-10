import { useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { Mail, ArrowRight, ArrowLeft, Check, KeyRound, Lock } from 'lucide-react';

import { forgotPassword, verifyPasswordOtp, resetPassword } from '../api/auth';

import { getApiErrorMessage } from '../api/stores';

import './Login.css';



const ForgotPassword = () => {

  const navigate = useNavigate();

  const [step, setStep] = useState('email');

  const [email, setEmail] = useState('');

  const [otp, setOtp] = useState('');

  const [password, setPassword] = useState('');

  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState('');



  const handleForgotSubmit = async (e) => {

    e.preventDefault();

    setIsLoading(true);

    setError('');

    try {

      await forgotPassword({ email });

      setStep('reset');

    } catch (err) {

      setError(getApiErrorMessage(err, 'تعذّر إرسال رمز التحقق'));

    } finally {

      setIsLoading(false);

    }

  };



  const handleResetSubmit = async (e) => {

    e.preventDefault();



    if (otp.length !== 6) {

      setError('رمز التحقق يجب أن يكون 6 أرقام');

      return;

    }

    if (password.length < 8) {

      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');

      return;

    }

    if (password !== passwordConfirmation) {

      setError('تأكيد كلمة المرور غير متطابق');

      return;

    }



    setIsLoading(true);

    setError('');

    try {

      // التحقق ثم الحفظ مباشرة — OTP يُستخدم مرة واحدة فقط

      await verifyPasswordOtp({ email, otp });

      await resetPassword({ email, otp, password, passwordConfirmation });

      setStep('done');

    } catch (err) {

      setError(getApiErrorMessage(err, 'تعذّر إعادة تعيين كلمة المرور'));

    } finally {

      setIsLoading(false);

    }

  };



  if (step === 'done') {

    return (

      <div className="login-page">

        <div className="login-container" style={{ textAlign: 'center' }}>

          <div className="success-icon-wrapper">

            <Check size={48} className="success-icon" />

          </div>

          <h2 className="login-title">تم تغيير كلمة المرور</h2>

          <p className="login-subtitle">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة</p>

          <button

            type="button"

            className="login-submit-btn"

            style={{ marginTop: 24, display: 'inline-flex' }}

            onClick={() => navigate('/login')}

          >

            <ArrowLeft size={20} className="btn-icon" />

            <span>العودة لتسجيل الدخول</span>

          </button>

        </div>

        <div className="bg-shape shape-1" />

        <div className="bg-shape shape-2" />

      </div>

    );

  }



  return (

    <div className="login-page">

      <div className="login-container">

        <div className="login-header">

          <div className="brand-logo">
            <span className="brand-title">Trendy</span>
            <span className="brand-dot">.</span>
          </div>

          <h1 className="login-title">استعادة كلمة المرور</h1>

          <p className="login-subtitle">

            {step === 'email'

              ? 'أدخل بريدك الإلكتروني وسنرسل لك رمز التحقق'

              : 'أدخل رمز التحقق وكلمة المرور الجديدة'}

          </p>

        </div>



        {error && (

          <p className="login-error" style={{ color: 'var(--danger)', marginBottom: 16, textAlign: 'center' }}>

            {error}

          </p>

        )}



        {step === 'email' && (

          <form className="login-form" onSubmit={handleForgotSubmit}>

            <div className="input-group">

              <label>البريد الإلكتروني</label>

              <div className="input-wrapper">

                <input

                  type="email"

                  placeholder="example@mail.com"

                  value={email}

                  onChange={(e) => setEmail(e.target.value)}

                  required

                  dir="ltr"

                  className="ltr-input"

                />

                <Mail className="input-icon" size={20} />

              </div>

            </div>

            <button type="submit" className="login-submit-btn" disabled={isLoading}>

              {isLoading ? <span className="loader" /> : (

                <>

                  <span>إرسال رمز التحقق</span>

                  <ArrowRight size={20} className="btn-icon" />

                </>

              )}

            </button>

          </form>

        )}



        {step === 'reset' && (

          <form className="login-form" onSubmit={handleResetSubmit}>

            <div className="verify-email-badge" dir="ltr">

              <Mail size={18} />

              <span>{email}</span>

            </div>



            <div className="input-group">

              <label>رمز التحقق</label>

              <div className="input-wrapper">

                <input

                  type="text"

                  inputMode="numeric"

                  placeholder="123456"

                  value={otp}

                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}

                  required

                  maxLength={6}

                  dir="ltr"

                  className="ltr-input"

                />

                <KeyRound className="input-icon" size={20} />

              </div>

            </div>



            <div className="input-group">

              <label>كلمة المرور الجديدة</label>

              <div className="input-wrapper">

                <input

                  type="password"

                  value={password}

                  onChange={(e) => setPassword(e.target.value)}

                  required

                  minLength={8}

                  dir="ltr"

                  className="ltr-input"

                />

                <Lock className="input-icon" size={20} />

              </div>

            </div>



            <div className="input-group">

              <label>تأكيد كلمة المرور</label>

              <div className="input-wrapper">

                <input

                  type="password"

                  value={passwordConfirmation}

                  onChange={(e) => setPasswordConfirmation(e.target.value)}

                  required

                  minLength={8}

                  dir="ltr"

                  className="ltr-input"

                />

                <Lock className="input-icon" size={20} />

              </div>

            </div>



            <button type="submit" className="login-submit-btn" disabled={isLoading}>

              {isLoading ? <span className="loader" /> : (

                <>

                  <span>حفظ كلمة المرور</span>

                  <ArrowRight size={20} className="btn-icon" />

                </>

              )}

            </button>

          </form>

        )}



        <div className="login-footer">

          <p>

            <Link to="/login">العودة لتسجيل الدخول</Link>

          </p>

        </div>

      </div>



      <div className="bg-shape shape-1" />

      <div className="bg-shape shape-2" />

    </div>

  );

};



export default ForgotPassword;

