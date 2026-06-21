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
  Building2,
  UserCircle,
} from 'lucide-react';
import { submitStoreJoinRequest, fetchZones, getJoinApiErrorMessage } from '../api/join';
import { clearAuthSession } from '../api/auth';
import JoinEmailVerification, { JoinVerificationSuccess } from '../components/join/JoinEmailVerification';
import './Login.css';

const isLocalType = (type) => type === 'محلي' || type === 'local';
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ACCEPT = 'image/jpeg,image/png,image/webp';

const Join = () => {
  const [formData, setFormData] = useState({
    managerName: '',
    managerEmail: '',
    managerPhone: '',
    storeName: '',
    storeEmail: '',
    password: '',
    storePhone: '',
    entityType: '',
    commercialReg: '',
    notes: '',
    description: '',
    storeType: '',
    storeAddress: '',
    zoneId: '',
    googleMapUrl: '',
  });
  const [zones, setZones] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [joinStep, setJoinStep] = useState('form');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    clearAuthSession();
    fetchZones()
      .then((list) => setZones(Array.isArray(list) ? list : []))
      .catch(() => setZones([]));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/[^0-9]/g, '');
    setFormData((prev) => ({ ...prev, [name]: numericValue }));
  };

  const handleEntityTypeChange = (entityType) => {
    setFormData((prev) => ({
      ...prev,
      entityType,
      commercialReg: entityType === 'individual' ? '' : prev.commercialReg,
    }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('صيغة اللوقو غير مدعومة. استخدم JPEG أو PNG أو WEBP');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError('حجم اللوقو يجب ألا يتجاوز 2 ميغابايت');
      return;
    }

    setError('');
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const validateForm = () => {
    if (!formData.entityType) {
      return 'يرجى اختيار نوع الكيان (شركة أو فرد)';
    }
    if (formData.entityType === 'company' && !formData.commercialReg.trim()) {
      return 'رقم السجل التجاري مطلوب للشركات';
    }
    if (!formData.storeType) {
      return 'يرجى اختيار نوع المتجر';
    }
    if (!formData.storeAddress.trim()) {
      return 'عنوان المتجر مطلوب';
    }
    if (!formData.zoneId) {
      return 'يرجى اختيار منطقة المتجر';
    }
    if (isLocalType(formData.storeType) && !formData.googleMapUrl.trim()) {
      return 'رابط خريطة Google مطلوب للمتجر المحلي';
    }
    if (formData.notes.length > 2000) {
      return 'الملاحظات يجب ألا تتجاوز 2000 حرف';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      const res = await submitStoreJoinRequest(formData, logoFile);
      setVerifyMessage(res?.message || '');
      setJoinStep('verify');
    } catch (err) {
      setError(getJoinApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'ltr-input';
  const isCompany = formData.entityType === 'company';

  if (joinStep === 'verify') {
    return (
      <JoinEmailVerification
        storeEmail={formData.storeEmail}
        storeName={formData.storeName}
        onVerified={(message) => {
          setVerifyMessage(message || '');
          setJoinStep('verified');
        }}
      />
    );
  }

  if (joinStep === 'verified') {
    return <JoinVerificationSuccess message={verifyMessage} />;
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
          <p className="join-section-label">بيانات مدير المتجر</p>

          <div className="input-group">
            <label htmlFor="managerName">اسم مدير المتجر</label>
            <div className="input-wrapper">
              <input
                id="managerName"
                type="text"
                name="managerName"
                placeholder="محمد أحمد"
                value={formData.managerName}
                onChange={handleChange}
                required
                maxLength={255}
                className={inputClass}
              />
              <User className="input-icon" size={20} />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="managerEmail">إيميل مدير المتجر</label>
            <div className="input-wrapper">
              <input
                id="managerEmail"
                type="email"
                name="managerEmail"
                placeholder="manager@store.com"
                value={formData.managerEmail}
                onChange={handleChange}
                required
                maxLength={255}
                dir="ltr"
                className={inputClass}
              />
              <Mail className="input-icon" size={20} />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="managerPhone">رقم هاتف مدير المتجر</label>
            <div className="input-wrapper">
              <input
                id="managerPhone"
                type="tel"
                name="managerPhone"
                placeholder="0912345678"
                value={formData.managerPhone}
                onChange={handlePhoneChange}
                required
                maxLength={20}
                dir="ltr"
                className={inputClass}
                inputMode="numeric"
              />
              <Phone className="input-icon" size={20} />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">كلمة المرور</label>
            <div className="input-wrapper">
              <input
                id="password"
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

          <p className="join-section-label">بيانات المتجر</p>

          <div className="input-group">
            <label htmlFor="storeName">اسم المتجر</label>
            <div className="input-wrapper">
              <input
                id="storeName"
                type="text"
                name="storeName"
                placeholder="متجر الترندي"
                value={formData.storeName}
                onChange={handleChange}
                required
                maxLength={255}
                className={inputClass}
              />
              <Store className="input-icon" size={20} />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="storeEmail">إيميل المتجر</label>
            <div className="input-wrapper">
              <input
                id="storeEmail"
                type="email"
                name="storeEmail"
                placeholder="info@store.com"
                value={formData.storeEmail}
                onChange={handleChange}
                required
                maxLength={255}
                dir="ltr"
                className={inputClass}
              />
              <Mail className="input-icon" size={20} />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="storePhone">رقم هاتف المتجر</label>
            <div className="input-wrapper">
              <input
                id="storePhone"
                type="tel"
                name="storePhone"
                placeholder="0912345678"
                value={formData.storePhone}
                onChange={handlePhoneChange}
                required
                maxLength={20}
                dir="ltr"
                className={inputClass}
                inputMode="numeric"
              />
              <Phone className="input-icon" size={20} />
            </div>
          </div>

          <div className="input-group">
            <label>نوع الكيان <span className="required-mark">*</span></label>
            <div className="entity-type-group">
              <button
                type="button"
                className={`entity-type-btn ${formData.entityType === 'company' ? 'active' : ''}`}
                onClick={() => handleEntityTypeChange('company')}
              >
                <Building2 size={18} />
                شركة
              </button>
              <button
                type="button"
                className={`entity-type-btn ${formData.entityType === 'individual' ? 'active' : ''}`}
                onClick={() => handleEntityTypeChange('individual')}
              >
                <UserCircle size={18} />
                فرد
              </button>
            </div>
          </div>

          {isCompany && (
            <div className="input-group">
              <label htmlFor="commercialReg">رقم السجل التجاري</label>
              <div className="input-wrapper">
                <input
                  id="commercialReg"
                  type="text"
                  name="commercialReg"
                  placeholder="123456789"
                  value={formData.commercialReg}
                  onChange={handleChange}
                  required={isCompany}
                  maxLength={255}
                  dir="ltr"
                  className={inputClass}
                />
                <FileText className="input-icon" size={20} />
              </div>
            </div>
          )}

          <div className="input-group">
            <label>لوقو المتجر <span className="optional-mark">(اختياري)</span></label>
            <div
              className="logo-upload-box"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="معاينة اللوقو" className="logo-preview" />
              ) : (
                <>
                  <ImagePlus size={32} className="logo-upload-icon" />
                  <span className="logo-upload-text">اضغط لرفع الشعار</span>
                  <span className="logo-upload-hint">JPEG, PNG, WEBP — حتى 2MB</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={LOGO_ACCEPT}
                onChange={handleLogoChange}
                className="logo-file-input"
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="description">وصف المتجر <span className="optional-mark">(اختياري)</span></label>
            <div className="input-wrapper textarea-wrapper">
              <textarea
                id="description"
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

          <div className="input-group">
            <label htmlFor="storeType">نوع المتجر</label>
            <div className="input-wrapper select-wrapper">
              <select
                id="storeType"
                name="storeType"
                value={formData.storeType}
                onChange={handleChange}
                required
                className="form-select"
              >
                <option value="">اختر نوع المتجر</option>
                <option value="local">محلي</option>
                <option value="electronic">إلكتروني</option>
              </select>
              <Store className="input-icon" size={20} />
            </div>
          </div>

          {formData.storeType && (
            <div className="input-group">
              <label htmlFor="storeAddress">عنوان المتجر</label>
              <div className="input-wrapper textarea-wrapper">
                <textarea
                  id="storeAddress"
                  name="storeAddress"
                  placeholder="مثال: طرابلس، شارع الجمهورية، بجوار ..."
                  value={formData.storeAddress}
                  onChange={handleChange}
                  required
                  rows={2}
                  maxLength={500}
                  className="form-textarea"
                />
                <MapPin className="input-icon textarea-icon" size={20} />
              </div>
            </div>
          )}

          {formData.storeType && (
            <div className="input-group">
              <label htmlFor="zoneId">منطقة المتجر</label>
              <div className="input-wrapper select-wrapper">
                <select
                  id="zoneId"
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
          )}

          {formData.storeType && isLocalType(formData.storeType) && (
            <div className="input-group">
              <label htmlFor="googleMapUrl">رابط خريطة Google</label>
              <div className="input-wrapper">
                <input
                  id="googleMapUrl"
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
          )}

          <div className="input-group">
            <label htmlFor="notes">ملاحظات <span className="optional-mark">(اختياري)</span></label>
            <div className="input-wrapper textarea-wrapper">
              <textarea
                id="notes"
                name="notes"
                placeholder="أي ملاحظات إضافية..."
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                maxLength={2000}
                className="form-textarea"
              />
              <ClipboardList className="input-icon textarea-icon" size={20} />
            </div>
            <span className="input-hint">{formData.notes.length}/2000</span>
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
