import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Store,
  Lock,
  ImagePlus,
  FileText,
  ClipboardList,
  AlignLeft,
  MapPin,
  Globe,
  ArrowRight,
  ArrowLeft,
  Check
} from 'lucide-react';
import { submitStoreJoinRequest, fetchZones, getApiErrorMessage } from '../api/stores';
import './Login.css';

const isLocalType = (type) => type === 'محلي' || type === 'local';

const Join = () => {
  const [formData, setFormData] = useState({
    managerName: '',
    managerEmail: '',
    managerPhone: '',
    storeName: '',
    storeEmail: '',
    password: '',
    storePhone: '',
    commercialReg: '',
    notes: '',
    description: '',
    storeType: '',
    zoneId: '',
    googleMapUrl: '',
  });
  const [zones, setZones] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchZones()
      .then((list) => setZones(Array.isArray(list) ? list : []))
      .catch(() => setZones([]));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/[^0-9]/g, '');
    setFormData(prev => ({ ...prev, [name]: numericValue }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await submitStoreJoinRequest(formData, logoFile);
      setIsSubmitted(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'ltr-input';

  if (isSubmitted) {
    return (
      <div className="login-page">
        <div className="login-container" style={{ textAlign: 'center' }}>
          <div className="success-icon-wrapper">
            <Check size={48} className="success-icon" />
          </div>
          <h2 className="login-title">تم إرسال الطلب بنجاح</h2>
          <p className="login-subtitle">
            سيتم مراجعة بياناتك والتواصل معك قريباً
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
  }

  return (
    <div className="login-page">
      <div className="login-container join-container">
        <div className="login-header">
          <div className="brand-logo">
            <span className="brand-title">Trendy</span>
            <span className="brand-dot">.</span>
          </div>
          <h1 className="login-title">إرسال طلب انضمام</h1>
          <p className="login-subtitle">املأ البيانات التالية وسنتواصل معك خلال 24 ساعة</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {/* اسم مدير المتجر */}
          <div className="input-group">
            <label>اسم مدير المتجر</label>
            <div className="input-wrapper">
              <input
                type="text"
                name="managerName"
                placeholder="محمد أحمد"
                value={formData.managerName}
                onChange={handleChange}
                required
                className={inputClass}
              />
              <User className="input-icon" size={20} />
            </div>
          </div>

          {/* إيميل مدير المتجر */}
          <div className="input-group">
            <label>إيميل مدير المتجر</label>
            <div className="input-wrapper">
              <input
                type="email"
                name="managerEmail"
                placeholder="manager@store.com"
                value={formData.managerEmail}
                onChange={handleChange}
                required
                dir="ltr"
                className={inputClass}
              />
              <Mail className="input-icon" size={20} />
            </div>
          </div>

          {/* رقم هاتف مدير المتجر */}
          <div className="input-group">
            <label>رقم هاتف مدير المتجر</label>
            <div className="input-wrapper">
              <input
                type="tel"
                name="managerPhone"
                placeholder="0912345678"
                value={formData.managerPhone}
                onChange={handlePhoneChange}
                required
                dir="ltr"
                className={inputClass}
                inputMode="numeric"
              />
              <Phone className="input-icon" size={20} />
            </div>
          </div>

          {/* اسم المتجر */}
          <div className="input-group">
            <label>اسم المتجر</label>
            <div className="input-wrapper">
              <input
                type="text"
                name="storeName"
                placeholder="متجر الترندي"
                value={formData.storeName}
                onChange={handleChange}
                required
                className={inputClass}
              />
              <Store className="input-icon" size={20} />
            </div>
          </div>

          {/* إيميل المتجر */}
          <div className="input-group">
            <label>إيميل المتجر</label>
            <div className="input-wrapper">
              <input
                type="email"
                name="storeEmail"
                placeholder="info@store.com"
                value={formData.storeEmail}
                onChange={handleChange}
                required
                dir="ltr"
                className={inputClass}
              />
              <Mail className="input-icon" size={20} />
            </div>
          </div>

          {/* كلمة المرور */}
          <div className="input-group">
            <label>كلمة المرور</label>
            <div className="input-wrapper">
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                dir="ltr"
                className={inputClass}
              />
              <Lock className="input-icon" size={20} />
            </div>
            <span className="input-hint">8 أحرف على الأقل</span>
          </div>

          {/* رقم هاتف المتجر */}
          <div className="input-group">
            <label>رقم هاتف المتجر</label>
            <div className="input-wrapper">
              <input
                type="tel"
                name="storePhone"
                placeholder="0912345678"
                value={formData.storePhone}
                onChange={handlePhoneChange}
                required
                dir="ltr"
                className={inputClass}
                inputMode="numeric"
              />
              <Phone className="input-icon" size={20} />
            </div>
          </div>

          {/* لوقو المتجر */}
          <div className="input-group">
            <label>لوقو المتجر</label>
            <div
              className="logo-upload-box"
              onClick={() => fileInputRef.current?.click()}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="logo-preview" />
              ) : (
                <>
                  <ImagePlus size={32} className="logo-upload-icon" />
                  <span className="logo-upload-text">اضغط لرفع صورة اللوقو</span>
                  <span className="logo-upload-hint">PNG, JPG حتى 2MB</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="logo-file-input"
              />
            </div>
          </div>

          {/* رقم السجل التجاري */}
          <div className="input-group">
            <label>رقم السجل التجاري</label>
            <div className="input-wrapper">
              <input
                type="text"
                name="commercialReg"
                placeholder="123456789"
                value={formData.commercialReg}
                onChange={handleChange}
                dir="ltr"
                className={inputClass}
              />
              <FileText className="input-icon" size={20} />
            </div>
          </div>

          {/* وصف */}
          <div className="input-group">
            <label>وصف المتجر</label>
            <div className="input-wrapper textarea-wrapper">
              <textarea
                name="description"
                placeholder="اكتب وصفاً مختصراً عن المتجر والمنتجات التي تقدمها..."
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="form-textarea"
              />
              <AlignLeft className="input-icon textarea-icon" size={20} />
            </div>
          </div>

          {/* نوع المتجر */}
          <div className="input-group">
            <label>نوع المتجر</label>
            <div className="input-wrapper select-wrapper">
              <select
                name="storeType"
                value={formData.storeType}
                onChange={handleChange}
                required
                className="form-select"
              >
                <option value="">اختر نوع المتجر</option>
                <option value="محلي">محلي</option>
                <option value="الكتروني">إلكتروني</option>
              </select>
              <Store className="input-icon" size={20} />
            </div>
          </div>

          {isLocalType(formData.storeType) && (
            <>
              <div className="input-group">
                <label>المنطقة</label>
                <div className="input-wrapper select-wrapper">
                  <select
                    name="zoneId"
                    value={formData.zoneId}
                    onChange={handleChange}
                    required
                    className="form-select"
                  >
                    <option value="">اختر المنطقة</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name ?? zone.title ?? `منطقة ${zone.id}`}
                      </option>
                    ))}
                  </select>
                  <MapPin className="input-icon" size={20} />
                </div>
              </div>

              <div className="input-group">
                <label>رابط خريطة Google</label>
                <div className="input-wrapper">
                  <input
                    type="url"
                    name="googleMapUrl"
                    placeholder="https://maps.google.com/..."
                    value={formData.googleMapUrl}
                    onChange={handleChange}
                    required
                    dir="ltr"
                    className={inputClass}
                  />
                  <Globe className="input-icon" size={20} />
                </div>
              </div>
            </>
          )}

          {/* ملاحظات */}
          <div className="input-group">
            <label>ملاحظات</label>
            <div className="input-wrapper textarea-wrapper">
              <textarea
                name="notes"
                placeholder="أي ملاحظات إضافية..."
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                className="form-textarea"
              />
              <ClipboardList className="input-icon textarea-icon" size={20} />
            </div>
          </div>

          {error && (
            <div className="form-error-banner" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="login-submit-btn" disabled={isLoading}>
            {isLoading ? (
              <span className="loader"></span>
            ) : (
              <>
                <span>إرسال الطلب</span>
                <ArrowRight size={20} className="btn-icon" />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>لديك حساب بالفعل؟ <Link to="/login">تسجيل الدخول</Link></p>
        </div>
      </div>

      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>
    </div>
  );
};

export default Join;
