import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getApiErrorMessage } from '../../api/stores';
import {
  isValidDecimalInput,
  isValidIntegerInput,
  preventWheelChange,
} from '../../utils/numericInput';
import './OfferModal.css';

const DISCOUNT_TYPES = ['نسبة مئوية %', 'قيمة ثابتة'];

function localTodayYmd() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const OfferModal = ({
  isOpen,
  onClose,
  onSave,
  offer,
  catalogProducts = [],
  isSaving = false,
}) => {
  const isEdit = !!offer;

  const [form, setForm] = useState({
    name: '',
    type: 'نسبة مئوية %',
    value: '',
    startDate: '',
    endDate: '',
    productIds: [],
    active: false,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setError('');
    if (offer) {
      setForm({
        name: offer.name || '',
        type: offer.type || 'نسبة مئوية %',
        value: offer.value != null ? String(offer.value) : '',
        startDate: offer.startDate || '',
        endDate: offer.endDate || '',
        productIds: offer.productIds || [],
        active: offer.statusRaw === 'active',
        statusRaw: offer.statusRaw,
      });
    } else {
      setForm({
        name: '',
        type: 'نسبة مئوية %',
        value: '',
        startDate: localTodayYmd(),
        endDate: '',
        productIds: [],
        active: true,
      });
    }
  }, [isOpen, offer]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const toggleProduct = (productId) => {
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter((id) => id !== productId)
        : [...prev.productIds, productId],
    }));
    setError('');
  };

  const numericValue = Number(form.value);
  const isValidValue =
    form.value !== '' &&
    !Number.isNaN(numericValue) &&
    numericValue > 0 &&
    (form.type !== 'نسبة مئوية %' || numericValue <= 100);

  const isValidDates =
    form.startDate &&
    form.endDate &&
    new Date(`${form.endDate}T23:59:59`) >= new Date(`${form.startDate}T00:00:00`) &&
    (!isEdit ? form.startDate >= localTodayYmd() : true);

  const canSubmit =
    form.name.trim() !== '' &&
    isValidValue &&
    isValidDates &&
    form.productIds.length > 0 &&
    !isSaving;

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (form.startDate && !isEdit && form.startDate < localTodayYmd()) {
        setError('تاريخ البداية لا يمكن أن يكون في الماضي');
        return;
      }
      setError('يجب تعبئة جميع البيانات واختيار منتج واحد على الأقل');
      return;
    }

    setError('');
    try {
      await onSave({ ...form, value: numericValue });
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر حفظ الحملة'));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content offer-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'تعديل الخصم' : 'إنشاء حملة تخفيض جديدة'}</h2>
          <button className="close-button" onClick={onClose} type="button" disabled={isSaving}>
            <X size={24} />
          </button>
        </div>

        <div className="offer-form">
          <div className="form-group">
            <label>اسم الحملة</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="مثال: خصم الصيف"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>نوع الخصم</label>
              <select value={form.type} onChange={(e) => handleChange('type', e.target.value)}>
                {DISCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>قيمة الخصم</label>
              <input
                type="text"
                inputMode={form.type === 'نسبة مئوية %' ? 'numeric' : 'decimal'}
                value={form.value}
                onChange={(e) => {
                  const raw = e.target.value;
                  const valid =
                    form.type === 'نسبة مئوية %'
                      ? isValidIntegerInput(raw)
                      : isValidDecimalInput(raw);
                  if (valid) handleChange('value', raw);
                }}
                onWheel={preventWheelChange}
                placeholder={form.type === 'نسبة مئوية %' ? '20' : '50'}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>تاريخ البداية</label>
              <input
                type="date"
                value={form.startDate}
                min={localTodayYmd()}
                onChange={(e) => handleChange('startDate', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>تاريخ النهاية</label>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate || localTodayYmd()}
                onChange={(e) => handleChange('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>المنتجات المشمولة بالحملة</label>
            {catalogProducts.length === 0 ? (
              <p className="offer-catalog-empty">لا توجد منتجات نشطة. أضف منتجات أولاً.</p>
            ) : (
              <div className="products-selection">
                {catalogProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className={`product-select-btn ${
                      form.productIds.includes(product.id) ? 'selected' : ''
                    }`}
                    onClick={() => toggleProduct(product.id)}
                  >
                    {product.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="offer-form-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} type="button" disabled={isSaving}>
            إلغاء
          </button>
          <button
            type="button"
            className="save-button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSaving ? 'جاري الحفظ...' : isEdit ? 'حفظ التغييرات' : 'إنشاء الحملة'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfferModal;
