import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import './OfferModal.css';

const DISCOUNT_TYPES = ['نسبة مئوية %', 'قيمة ثابتة'];

const OfferModal = ({ isOpen, onClose, onSave, onValidationError, offer, availableProducts }) => {
  const isEdit = !!offer;

  const [form, setForm] = useState({
    name: '',
    type: 'نسبة مئوية %',
    value: '',
    startDate: '',
    endDate: '',
    products: [],
    active: false,
    status: 'معطل',
  });

  useEffect(() => {
    if (isOpen) {
      if (offer) {
        setForm({
          name: offer.name || '',
          type: offer.type || 'نسبة مئوية %',
          value: offer.value || '',
          startDate: offer.startDate || '',
          endDate: offer.endDate || '',
          products: offer.products || [],
          active: offer.active || false,
          status: offer.status || 'معطل',
        });
      } else {
        setForm({
          name: '',
          type: 'نسبة مئوية %',
          value: '',
          startDate: '',
          endDate: '',
          products: [],
          active: false,
          status: 'معطل',
        });
      }
    }
  }, [isOpen, offer]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleProduct = (product) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.includes(product)
        ? prev.products.filter((p) => p !== product)
        : [...prev.products, product],
    }));
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
    new Date(form.endDate) >= new Date(form.startDate);

  const canSubmit =
    form.name.trim() !== '' &&
    isValidValue &&
    isValidDates &&
    form.products.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      onValidationError?.('يجب تعبئة جميع البيانات');
      return;
    }
    const status = form.active ? 'نشط' : 'معطل';
    onSave({ ...form, status, value: numericValue });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content offer-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'تعديل الخصم' : 'إنشاء حملة تخفيض جديدة'}</h2>
          <button className="close-button" onClick={onClose}>
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
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>قيمة الخصم</label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => handleChange('value', e.target.value)}
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
                onChange={(e) => handleChange('startDate', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>تاريخ النهاية</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>المنتجات المشمولة بالحملة</label>
            <div className="products-selection">
              {availableProducts.map((product) => (
                <button
                  key={product}
                  type="button"
                  className={`product-select-btn ${form.products.includes(product) ? 'selected' : ''}`}
                  onClick={() => toggleProduct(product)}
                >
                  {product}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            إلغاء
          </button>
          <button type="button" className="save-button" onClick={handleSubmit}>
            {isEdit ? 'حفظ التغييرات' : 'إنشاء الحملة'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfferModal;
