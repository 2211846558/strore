import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../api/stores';
import './Login.css';

const Login = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login({ email: email.trim(), password });
      navigate('/');
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
            <label>البريد الإلكتروني للمتجر</label>
            <div className="input-wrapper">
              <input
                type="email"
                placeholder="store@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                className="ltr-input"
              />
              <Mail className="input-icon" size={20} />
            </div>
          </div>

          <div className="input-group">
            <div className="password-header">
              <label>كلمة المرور</label>
              <Link to="/forgot-password" className="forgot-password">نسيت كلمة المرور؟</Link>
            </div>
            <div className="input-wrapper">
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
                className="ltr-input"
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
