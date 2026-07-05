import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Hash } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActiveStore, storeHasActivePlan, userIsStoreStaff } from '../api/auth';
import { getApiErrorMessage } from '../api/stores';
import './Login.css';

const Login = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login({
        email: email.trim(),
        password,
        storeCode: storeCode.trim(),
      });
      const store = getActiveStore(data.user);
      const shouldGoToDashboard = userIsStoreStaff(data.user) || storeHasActivePlan(store);
      navigate(shouldGoToDashboard ? '/' : '/plans');
    } catch (err) {
      setError(getApiErrorMessage(err, 'فشل تسجيل الدخول. تحقق من البيانات.'));
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="brand-logo">
            <span className="brand-title">Trendy</span>
            <span className="brand-dot">.</span>
          </div>
          <h1 className="login-title">أهلاً بك</h1>
          <p className="login-subtitle">يرجى تسجيل الدخول للوصول إلى لوحة التحكم</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <p className="login-error">{error}</p>}

          <div className="input-group">
            <label htmlFor="store-code">رقم المتجر</label>
            <div className="input-wrapper">
              <input
                id="store-code"
                type="text"
                placeholder="مثال: my-store"
                value={storeCode}
                onChange={(e) => setStoreCode(e.target.value)}
                required
                dir="ltr"
                className="ltr-input"
                autoComplete="organization"
              />
              <Hash className="input-icon" size={20} />
            </div>
            <span className="input-hint">الرمز الفريد للمتجر الذي حصلت عليه عند قبول طلب الانضمام</span>
          </div>

          <div className="input-group">
            <label htmlFor="login-email">البريد الإلكتروني</label>
            <div className="input-wrapper">
              <input
                id="login-email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                className="ltr-input"
                autoComplete="email"
              />
              <Mail className="input-icon" size={20} />
            </div>
          </div>

          <div className="input-group">
            <div className="password-header">
              <label htmlFor="login-password">كلمة المرور</label>
              <Link to="/forgot-password" className="forgot-password">نسيت كلمة المرور؟</Link>
            </div>
            <div className="input-wrapper">
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
                className="ltr-input"
                autoComplete="current-password"
              />
              <Lock className="input-icon" size={20} />
            </div>
          </div>

          <button type="submit" className="login-submit-btn" disabled={isLoading}>
            {isLoading ? (
              <span className="loader"></span>
            ) : (
              <>
                <span>تسجيل الدخول</span>
                <ArrowRight size={20} className="btn-icon" />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>ليس لديك حساب؟ <Link to="/join">إرسال طلب انضمام</Link></p>
        </div>
      </div>

      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>
    </div>
  );
};

export default Login;
