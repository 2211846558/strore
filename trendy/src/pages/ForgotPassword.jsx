import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import './Login.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSent(true);
    }, 1500);
  };

  if (isSent) {
    return (
      <div className="login-page">
        <div className="login-container" style={{ textAlign: 'center' }}>
          <div className="success-icon-wrapper">
            <Check size={48} className="success-icon" />
          </div>
          <h2 className="login-title">تم إرسال الرابط</h2>
          <p className="login-subtitle">
            تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني
          </p>
          <Link
            to="/login"
            className="login-submit-btn"
            style={{ marginTop: 24, display: 'inline-flex' }}
          >
            <ArrowLeft size={20} className="btn-icon" />
            <span>العودة لتسجيل الدخول</span>
          </Link>
        </div>
        <div className="bg-shape shape-1"></div>
        <div className="bg-shape shape-2"></div>
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
            أدخل بريدك الإلكتروني وسنرسل لك رابط لإعادة تعيين كلمة المرور
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
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
            {isLoading ? (
              <span className="loader"></span>
            ) : (
              <>
                <span>إرسال رابط الاستعادة</span>
                <ArrowRight size={20} className="btn-icon" />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>
            <Link to="/login">العودة لتسجيل الدخول</Link>
          </p>
        </div>
      </div>

      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>
    </div>
  );
};

export default ForgotPassword;
