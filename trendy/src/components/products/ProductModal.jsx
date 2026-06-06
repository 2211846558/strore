import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import './ProductModal.css';

const ALL_COLORS = ['أبيض', 'أسود', 'أزرق داكن', 'أخضر', 'أحمر', 'وردي', 'أصفر', 'رمادي', 'بني'];
const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const CATEGORIES = ['قميص', 'فستان', 'شورت', 'بنطلون'];

const getDefaultImage = (category, name) => {
  const categoryImages = {
    'قميص': 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
    'فستان': 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80',
    'شورت': 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=400&q=80',
    'بنطلون': 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=400&q=80',
  };
  return categoryImages[category] || `https://placehold.co/400x400/e2e8f0/475569?text=${encodeURIComponent(name || 'منتج')}`;
};

const ProductModal = ({ isOpen, onClose, onSave, product }) => {
  const isEdit = !!product;

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    colors: [],
    sizes: [],
    stock: '',
    status: 'نشط',
    image: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setForm({
          name: product.name || '',
          description: product.description || '',
          price: product.price || '',
          category: product.category || '',
          colors: product.colors || [],
          sizes: product.sizes || [],
          stock: product.stock || '',
          status: product.status || 'نشط',
          image: product.image || '',
        });
      } else {
        setForm({
          name: '',
          description: '',
          price: '',
          category: '',
          colors: [],
          sizes: [],
          stock: '',
          status: 'نشط',
          image: '',
        });
      }
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleColor = (color) => {
    setForm((prev) => ({
      ...prev,
      colors: prev.colors.includes(color)
        ? prev.colors.filter((c) => c !== color)
        : [...prev.colors, color],
    }));
  };

  const toggleSize = (size) => {
    setForm((prev) => ({
      ...prev,
      sizes: prev.sizes.includes(size)
        ? prev.sizes.filter((s) => s !== size)
        : [...prev.sizes, size],
    }));
  };

  const handleSubmit = () => {
    if (!form.name || !form.price || !form.category || !form.stock) return;
    const image = form.image || getDefaultImage(form.category, form.name);
    onSave({ ...form, image, price: String(form.price), stock: String(form.stock) });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content product-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="product-form">
          <div className="form-group">
            <label>اسم المنتج</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder=""
            />
          </div>

          <div className="form-group">
            <label>الوصف</label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>التصنيف</label>
              <select
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
              >
                <option value="">اختر التصنيف</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>السعر (د.ل)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => handleChange('price', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>الألوان المتاحة</label>
            <div className="checkbox-grid colors-grid">
              {ALL_COLORS.map((color) => (
                <label key={color} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.colors.includes(color)}
                    onChange={() => toggleColor(color)}
                  />
                  <span>{color}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>المقاسات المتاحة</label>
            <div className="checkbox-grid sizes-grid">
              {ALL_SIZES.map((size) => (
                <label key={size} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.sizes.includes(size)}
                    onChange={() => toggleSize(size)}
                  />
                  <span>{size}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>الكمية</label>
            <input
              type="number"
              value={form.stock}
              onChange={(e) => handleChange('stock', e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            إلغاء
          </button>
          <button className="save-button" onClick={handleSubmit}>
            {isEdit ? 'حفظ التغييرات' : 'إضافة المنتج'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
