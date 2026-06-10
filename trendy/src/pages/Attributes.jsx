import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Sliders, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { fetchAdminAttributes, createAdminAttribute, updateAdminAttribute, deleteAdminAttribute } from '../api/products';
import { getApiErrorMessage } from '../api/stores';
import { useAuth } from '../context/AuthContext';
import './Attributes.css';

const Attributes = () => {
  const { user } = useAuth();
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [newValueInput, setNewValueInput] = useState('');
  const [values, setValues] = useState([]); // list of strings

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadAttributes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminAttributes();
      setAttributes(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل الخصائص.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttributes();
  }, [loadAttributes]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setValues([]);
    setNewValueInput('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (attr) => {
    setEditingId(attr.id);
    setName(attr.name);
    setValues(attr.values.map(v => v.value));
    setNewValueInput('');
    setIsFormOpen(true);
  };

  const handleAddValue = () => {
    const val = newValueInput.trim();
    if (!val) return;
    if (values.includes(val)) {
      showToast('هذه القيمة موجودة بالفعل');
      return;
    }
    setValues([...values, val]);
    setNewValueInput('');
  };

  const handleRemoveValue = (indexToRemove) => {
    setValues(values.filter((_, idx) => idx !== indexToRemove));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الخاصية نهائياً؟')) return;
    try {
      await deleteAdminAttribute(id);
      showToast('تم حذف الخاصية بنجاح');
      loadAttributes();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر حذف الخاصية.'));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('اسم الخاصية مطلوب.');
      return;
    }
    if (values.length === 0) {
      setError('يجب إضافة قيمة واحدة على الأقل للخاصية.');
      return;
    }

    setIsSaving(true);
    setError('');

    // Payload supports both format styles for robustness
    const payload = {
      name: name.trim(),
      values: values.map(val => ({ value: val })),
      attribute_values: values.map(val => ({ value: val })),
      raw_values: values
    };

    try {
      if (editingId) {
        await updateAdminAttribute(editingId, payload);
        showToast('تم تعديل الخاصية بنجاح');
      } else {
        await createAdminAttribute(payload);
        showToast('تم إضافة الخاصية بنجاح');
      }
      setIsFormOpen(false);
      loadAttributes();
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر حفظ الخاصية.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="attributes-page">
      <header className="page-header attributes-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">إدارة الخصائص وقيمها</h1>
          <p className="page-subtitle">خاص بالإدارة العليا — إنشاء وتعديل خصائص المنتجات (مثل اللون، المقاس) وقيمها.</p>
        </div>
      </header>

      <div className="attributes-controls">
        <button className="add-attribute-btn" onClick={handleOpenAdd} type="button">
          <Plus size={18} />
          إضافة خاصية
        </button>
      </div>

      {error && !isFormOpen && (
        <div className="error-alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Attributes List */}
      <div className="attributes-table-wrapper">
        <table className="attributes-table">
          <thead>
            <tr>
              <th>اسم الخاصية</th>
              <th>القيم المتاحة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="3" className="no-results-cell">جاري تحميل الخصائص...</td>
              </tr>
            ) : attributes.length > 0 ? (
              attributes.map((attr) => (
                <tr key={attr.id}>
                  <td className="attr-name-cell">{attr.name}</td>
                  <td>
                    <div className="attr-values-tags">
                      {attr.values && attr.values.length > 0 ? (
                        attr.values.map((v) => (
                          <span key={v.id} className="attr-val-tag">{v.value}</span>
                        ))
                      ) : (
                        <span className="no-values">—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleOpenEdit(attr)}
                        title="تعديل"
                        type="button"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(attr.id)}
                        title="حذف"
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="no-results-cell">لا توجد خصائص مضافة حالياً.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form Dialog */}
      {isFormOpen && (
        <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
          <div className="modal-content attribute-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'تعديل الخاصية' : 'إضافة خاصية جديدة'}</h2>
              <button className="close-button" onClick={() => setIsFormOpen(false)} type="button">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="attribute-form">
              {error && <p className="form-error">{error}</p>}

              <div className="form-group">
                <label>اسم الخاصية <span className="required-mark">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: اللون، المقاس"
                  required
                />
              </div>

              <div className="form-group">
                <label>القيم المتاحة</label>
                <div className="value-input-row">
                  <input
                    type="text"
                    value={newValueInput}
                    onChange={(e) => setNewValueInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddValue();
                      }
                    }}
                    placeholder="أدخل قيمة ثم اضغط إضافة"
                  />
                  <button
                    type="button"
                    className="add-value-inner-btn"
                    onClick={handleAddValue}
                  >
                    أضف قيمة
                  </button>
                </div>

                <div className="values-chips-container">
                  {values.map((val, idx) => (
                    <span key={idx} className="value-chip">
                      {val}
                      <button
                        type="button"
                        className="remove-chip-btn"
                        onClick={() => handleRemoveValue(idx)}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {values.length === 0 && (
                    <p className="no-values-hint">لا توجد قيم مضافة بعد. أضف قيمة لتسجيلها.</p>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="cancel-button"
                  onClick={() => setIsFormOpen(false)}
                  type="button"
                  disabled={isSaving}
                >
                  إلغاء
                </button>
                <button
                  className="save-button"
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default Attributes;
