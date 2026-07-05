import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { formatRoleSelection } from '../../api/employees';
import { getApiErrorMessage } from '../../api/stores';
import './StaffModal.css';

const StaffModal = ({ isOpen, onClose, onSave, member, roles, isSaving = false }) => {
  const isEdit = !!member;

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    password: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (member) {
        setForm({
          name: member.name || '',
          email: member.email || '',
          phone: member.phone || '',
          role: formatRoleSelection(member.roleId, member.role),
          password: '',
        });
      } else {
        const staffRole = roles?.find((r) => r.slug === 'store_staff')?.value || '';
        setForm({
          name: '',
          email: '',
          phone: '',
          role: staffRole,
          password: '',
        });
      }
    }
  }, [isOpen, member, roles]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.phone.trim() &&
    form.role &&
    (isEdit || form.password.trim()) &&
    !isSaving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    try {
      await onSave({ ...form });
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر حفظ بيانات الموظف'));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content staff-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</h2>
          <button className="close-button" onClick={onClose} type="button" disabled={isSaving}>
            <X size={24} />
          </button>
        </div>

        <div className="staff-form">
          {error && <div className="staff-form-error">{error}</div>}

          <div className="form-group">
            <label>الاسم الكامل</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="أدخل الاسم الكامل"
              disabled={isSaving}
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
                disabled={isSaving}
              />
            </div>
            <div className="form-group">
              <label>رقم الهاتف</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="09XXXXXXXX"
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="form-group">
            <label>الدور الوظيفي</label>
            <select
              value={form.role}
              onChange={(e) => handleChange('role', e.target.value)}
              disabled={true}
            >
              <option value="">اختر الدور الوظيفي</option>
              {roles.map((r) => (
                <option key={`${r.value}-${r.label}`} value={String(r.value)}>
                  {r.label}
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
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} type="button" disabled={isSaving}>
            إلغاء
          </button>
          <button className="save-button" onClick={handleSubmit} disabled={!canSubmit} type="button">
            {isSaving ? 'جاري الحفظ...' : isEdit ? 'حفظ التغييرات' : 'إضافة الموظف'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffModal;
