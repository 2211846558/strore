import React, { useState, useEffect } from 'react';
import { X, Upload, ImageIcon, Layers } from 'lucide-react';
import './ProductModal.css';

const ProductModal = ({
  isOpen,
  onClose,
  onSave,
  onOpenVariants,
  product,
  categories = [],
  isSaving,
}) => {
  const isEdit = !!product;

  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    price: '',
    categoryId: '',
    stock: '',
  });
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [savedProduct, setSavedProduct] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setSavedProduct(null);
    setError('');
    setNewImages((prev) => {
      prev.forEach((img) => {
        if (img.preview?.startsWith('blob:')) URL.revokeObjectURL(img.preview);
      });
      return [];
    });

    if (product) {
      setForm({
        name: product.name || '',
        sku: product.sku || '',
        description: product.description || '',
        price: product.price || '',
        categoryId: product.categoryId ? String(product.categoryId) : '',
        stock: product.stock || '',
      });
      const imgs = product.images?.length
        ? product.images
        : product.image
          ? [{ url: product.image }]
          : [];
      setExistingImages(imgs);
    } else {
      setForm({
        name: '',
        sku: '',
        description: '',
        price: '',
        categoryId: '',
        stock: '',
      });
      setExistingImages([]);
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const added = files.map((file) => ({
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setNewImages((prev) => [...prev, ...added]);
    setError('');
    e.target.value = '';
  };

  const removeNewImage = (id) => {
    setNewImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target?.preview?.startsWith('blob:')) URL.revokeObjectURL(target.preview);
      return prev.filter((img) => img.id !== id);
    });
  };

  const totalImages = existingImages.length + newImages.length;

  const handleSubmit = async () => {
    if (!form.name || !form.sku || !form.categoryId) {
      setError('يرجى تعبئة اسم المنتج وSKU والتصنيف.');
      return;
    }
    if (!isEdit && totalImages === 0) {
      setError('يجب رفع صورة واحدة على الأقل للمنتج.');
      return;
    }

    setError('');
    try {
      const result = await onSave({
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description.trim(),
        price: form.price,
        categoryId: form.categoryId,
        stock: form.stock,
        imageFiles: newImages.map((img) => img.file),
      });
      if (!isEdit && result) {
        setSavedProduct(result);
        return;
      }
      onClose();
    } catch (err) {
      setError(err?.message || 'تعذّر حفظ المنتج.');
    }
  };

  const variantTarget = savedProduct || (isEdit ? product : null);
  const showSuccessStep = !!savedProduct;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content product-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {showSuccessStep ? 'تم إضافة المنتج' : isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد'}
          </h2>
          <button className="close-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        <div className="product-form">
          {showSuccessStep && (
            <div className="product-save-success">
              <p>تم حفظ المنتج بنجاح. يمكنك الآن إضافة التنوعات (لون، مقاس، ...) أو إغلاق النافذة.</p>
            </div>
          )}

          <div className="form-group">
            <label>
              صور المنتج {!isEdit && <span className="required-mark">*</span>}
              {totalImages > 0 && (
                <span className="image-count-badge">{totalImages} صورة</span>
              )}
            </label>

            {totalImages > 0 ? (
              <div className="images-gallery">
                {existingImages.map((img, index) => (
                  <div key={img.id ?? `existing-${index}`} className="gallery-item existing">
                    <img src={img.url} alt={`صورة ${index + 1}`} />
                    {isEdit && <span className="gallery-item-tag">حالية</span>}
                  </div>
                ))}
                {newImages.map((img, index) => (
                  <div key={img.id} className="gallery-item new">
                    <img src={img.preview} alt={`صورة جديدة ${index + 1}`} />
                    <button
                      type="button"
                      className="gallery-remove-btn"
                      onClick={() => removeNewImage(img.id)}
                      aria-label="حذف الصورة"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="image-placeholder">
                <ImageIcon size={32} />
                <span>JPEG, PNG أو WebP — حد أقصى 2MB لكل صورة</span>
              </div>
            )}

            <label className="upload-btn">
              <Upload size={16} />
              {totalImages > 0 ? 'إضافة صور' : 'رفع صور'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageChange}
                hidden
              />
            </label>
          </div>

          <div className="form-group">
            <label>اسم المنتج <span className="required-mark">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="مثال: قميص قطن"
            />
          </div>

          <div className="form-group">
            <label>SKU <span className="required-mark">*</span></label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => handleChange('sku', e.target.value)}
              placeholder="مثال: SHIRT-001"
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
                value={form.categoryId}
                onChange={(e) => handleChange('categoryId', e.target.value)}
              >
                <option value="">اختر التصنيف</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>السعر (د.ل)</label>
              <input
                type="number"
                min="0"
                value={form.price}
                readOnly
                className="readonly-field"
              />
              <span className="field-hint">تلقائي من سعر بيع الشحنة الحالية</span>
            </div>
          </div>

          <div className="form-group">
            <label>الكمية الإجمالية</label>
            <input
              type="number"
              min="0"
              value={form.stock}
              readOnly
              className="readonly-field"
            />
            <span className="field-hint">تلقائي من مجموع كميات التنوعات</span>
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer">
          {showSuccessStep ? (
            <>
              <button className="cancel-button" onClick={onClose} type="button">
                إغلاق
              </button>
              {onOpenVariants && (
                <button
                  className="variant-open-btn"
                  onClick={() => onOpenVariants(savedProduct)}
                  type="button"
                >
                  <Layers size={16} />
                  اختيار تنوع المنتج
                </button>
              )}
            </>
          ) : (
            <>
              <button className="cancel-button" onClick={onClose} type="button" disabled={isSaving}>
                إلغاء
              </button>
              {variantTarget && onOpenVariants && (
                <button
                  className="variant-open-btn"
                  onClick={() => onOpenVariants(variantTarget)}
                  type="button"
                  disabled={isSaving}
                >
                  <Layers size={16} />
                  إضافة تنوع
                </button>
              )}
              <button className="save-button" onClick={handleSubmit} type="button" disabled={isSaving}>
                {isSaving ? 'جاري الحفظ...' : isEdit ? 'حفظ التغييرات' : 'إضافة المنتج'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
