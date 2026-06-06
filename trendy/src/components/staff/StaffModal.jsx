import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import './StaffModal.css';

const StaffModal = ({ isOpen, onClose, onSave, member, roles }) => {
  const isEdit = !!member;

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    password: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (member) {
        setForm({
          name: member.name || '',
          email: member.email || '',
          phone: member.phone || '',
          role: member.role || '',
          password: '',
        });
      } else {
        setForm({
          name: '',
          email: '',
          phone: '',
          role: '',
          password: '',
        });
      }
    }
  }, [isOpen, member]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.phone.trim() &&
    form.role &&
    (isEdit || form.password.trim());

  const handleSubmit = () => {
    if (!canSubmit) return;
    const data = { ...form };
    if (isEdit && !form.password) {
      delete data.password;
    }
    onSave(data);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content staff-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="staff-form">
          <div className="form-group">
            <label>الاسم الكامل</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="أدخل الاسم الكامل"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="email@trendy.com"
              />
            </div>
            <div className="form-group">
              <label>رقم الهاتف</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="09XXXXXXXX"
              />
            </div>
          </div>

          <div className="form-group">
            <label>الدور الوظيفي</label>
            <select value={form.role} onChange={(e) => handleChange('role', e.target.value)}>
              <option value="">اختر الدور الوظيفي</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>
              {isEdit ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء على الحالية)' : 'كلمة المرور الأولية'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder={isEdit ? 'أدخل كلمة مرور جديدة' : 'أدخل كلمة المرور'}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            إلغاء
          </button>
          <button className="save-button" onClick={handleSubmit} disabled={!canSubmit}>
            {isEdit ? 'حفظ التغييرات' : 'إضافة الموظف'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffModal;
