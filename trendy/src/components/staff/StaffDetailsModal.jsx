import React from 'react';
import { X, Edit2 } from 'lucide-react';
import './StaffDetailsModal.css';

const StaffDetailsModal = ({ isOpen, onClose, member, loading, onEdit }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content staff-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">تفاصيل الموظف</h2>
          <button className="close-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="staff-details-loading">جاري تحميل التفاصيل...</div>
        ) : member ? (
          <div className="staff-details-body">
            <div className="staff-details-row">
              <span className="staff-details-label">الاسم الكامل</span>
              <span className="staff-details-value">{member.name}</span>
            </div>
            <div className="staff-details-row">
              <span className="staff-details-label">البريد الإلكتروني</span>
              <span className="staff-details-value">{member.email}</span>
            </div>
            <div className="staff-details-row">
              <span className="staff-details-label">رقم الهاتف</span>
              <span className="staff-details-value">{member.phone}</span>
            </div>
            <div className="staff-details-row">
              <span className="staff-details-label">الدور الوظيفي</span>
              <span className="staff-details-value">
                <span className="role-badge">{member.role}</span>
              </span>
            </div>
            <div className="staff-details-row">
              <span className="staff-details-label">تاريخ الانضمام</span>
              <span className="staff-details-value">{member.joinDate}</span>
            </div>
            <div className="staff-details-row">
              <span className="staff-details-label">آخر تسجيل دخول</span>
              <span className="staff-details-value">{member.lastLogin}</span>
            </div>
            <div className="staff-details-row">
              <span className="staff-details-label">الحالة</span>
              <span className="staff-details-value">
                <span className={`status-badge ${member.active ? 'active' : 'inactive'}`}>
                  {member.status}
                </span>
              </span>
            </div>
            {member.storeName && (
              <div className="staff-details-row">
                <span className="staff-details-label">المتجر</span>
                <span className="staff-details-value">{member.storeName}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="staff-details-loading">تعذّر تحميل بيانات الموظف.</div>
        )}

        <div className="modal-footer">
          {typeof onEdit === 'function' && member && !loading && (
            <button
              className="save-button staff-details-edit-btn"
              onClick={() => onEdit(member)}
              type="button"
            >
              <Edit2 size={16} />
              تعديل
            </button>
          )}
          <button className="cancel-button" onClick={onClose} type="button">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffDetailsModal;
