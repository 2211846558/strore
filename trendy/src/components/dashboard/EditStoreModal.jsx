import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, ImageIcon } from 'lucide-react';
import './EditStoreModal.css';

const EditStoreModal = ({ isOpen, onClose, store, onSave, saving = false }) => {
  const [formData, setFormData] = useState({ ...store });
  const [logoFile, setLogoFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...store });
      setLogoFile(null);
    }
  }, [isOpen, store]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await onSave(formData, logoFile);
    if (ok !== false) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-store-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">تعديل بيانات المتجر</h2>
            <p className="modal-subtitle">قم بتحديث المعلومات الأساسية الخاصة بالمتجر</p>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="إغلاق">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group store-image-group">
            <label>صورة المتجر</label>
            <div className="store-image-upload">
              {formData.image ? (
                <img src={formData.image} alt="معاينة صورة المتجر" className="store-image-preview" />
              ) : (
                <div className="store-image-placeholder-box">
                  <ImageIcon size={40} />
                  <span>لا توجد صورة</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="store-image-input"
              onChange={handleImageChange}
            />
            <button
              type="button"
              className="upload-image-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} />
              {formData.image ? 'تغيير صورة المتجر' : 'رفع صورة المتجر'}
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="name">اسم المتجر</label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="form-input" />
          </div>

          <div className="form-group">
            <label htmlFor="description">وصف المتجر</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} className="form-input textarea" rows={3} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">البريد الإلكتروني</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-group">
              <label htmlFor="phone">رقم الهاتف</label>
              <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} className="form-input text-left" dir="ltr" />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="location">الموقع الجغرافي</label>
            <input type="text" id="location" name="location" value={formData.location} onChange={handleChange} className="form-input" />
          </div>

          <div className="modal-footer">
            <button type="submit" className="save-button" disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
            <button type="button" className="cancel-button" onClick={onClose}>إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStoreModal;
