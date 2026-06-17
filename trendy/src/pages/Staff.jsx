import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit2, Power, CheckCircle2, Eye, Trash2 } from 'lucide-react';
import StaffModal from '../components/staff/StaffModal';
import StaffDetailsModal from '../components/staff/StaffDetailsModal';
import RoleFilterDropdown from '../components/staff/RoleFilterDropdown';
import {
  fetchEmployee,
  buildEmployeePayload,
  buildEmployeeUpdatePayload,
  buildRoleOptions,
  EMPLOYEE_ROLE_OPTIONS,
} from '../api/employees';
import { getApiErrorMessage } from '../api/stores';
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useToggleEmployee,
  useDeleteEmployee,
} from '../api/hooks/useEmployees';
import { useStore } from '../context/AuthContext';
import './Staff.css';

const Staff = () => {
  const { storeId } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [detailsModal, setDetailsModal] = useState({ open: false, member: null, loading: false });
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filters = useMemo(
    () => ({ storeId, search: debouncedSearch, role: roleFilter, maxPages: 3 }),
    [storeId, debouncedSearch, roleFilter],
  );

  const { data: staff = [], isLoading: loading, error } = useEmployees(filters);

  const formRoleOptions = useMemo(
    () => (buildRoleOptions(staff).length ? buildRoleOptions(staff) : EMPLOYEE_ROLE_OPTIONS),
    [staff],
  );

  const roleOptions = useMemo(
    () => [
      { value: 'all', label: 'جميع الأدوار' },
      ...formRoleOptions.map((r) => ({
        value: String(r.value),
        label: r.label,
      })),
    ],
    [formRoleOptions],
  );

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const toggleMutation = useToggleEmployee();
  const deleteMutation = useDeleteEmployee();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSave = async (formData) => {
    if (editingStaff) {
      const payload = buildEmployeeUpdatePayload(formData, {
        storeId,
        roleOptions: formRoleOptions,
      });
      await updateMutation.mutateAsync({ id: editingStaff.id, ...payload });
      showToast('تم حفظ التغييرات بنجاح');
    } else {
      const payload = buildEmployeePayload(formData, {
        storeId,
        roleOptions: formRoleOptions,
      });
      await createMutation.mutateAsync(payload);
      showToast('تم إضافة الموظف بنجاح');
    }
    setIsModalOpen(false);
    setEditingStaff(null);
  };

  const handleToggleActive = async (member) => {
    if (member.roleSlug === 'store_manager') return;
    try {
      await toggleMutation.mutateAsync(member.id);
      showToast(
        member.active
          ? `تم تعطيل حساب «${member.name}»`
          : `تم تفعيل حساب «${member.name}»`
      );
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تغيير حالة الموظف'));
    }
  };

  const handleDeleteStaff = async (member) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف الموظف «${member.name}» نهائياً؟`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(member.id);
      showToast(`تم حذف الموظف «${member.name}» بنجاح`);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر حذف الموظف'));
    }
  };

  const openAdd = () => {
    setEditingStaff(null);
    setIsModalOpen(true);
  };

  const openEdit = (member) => {
    setEditingStaff(member);
    setIsModalOpen(true);
  };

  const openDetails = async (member) => {
    setDetailsModal({ open: true, member: null, loading: true });
    try {
      const details = await fetchEmployee(member.id);
      setDetailsModal({ open: true, member: details, loading: false });
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تحميل تفاصيل الموظف'));
      setDetailsModal({ open: false, member: null, loading: false });
    }
  };

  return (
    <div className="staff-page">
      <header className="page-header staff-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">إدارة الموظفين</h1>
          <p className="page-subtitle">إدارة حسابات وصلاحيات الموظفين</p>
        </div>
      </header>

      <div className="staff-controls">
        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="البحث عن موظف..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <RoleFilterDropdown
          value={roleFilter}
          options={roleOptions}
          onChange={setRoleFilter}
        />

        <button type="button" className="add-staff-btn" onClick={openAdd}>
          <Plus size={18} />
          إضافة موظف
        </button>
      </div>

      {error && <div className="staff-error">{error?.message || 'تعذّر تحميل قائمة الموظفين'}</div>}

      <div className="staff-table-wrapper">
        <table className="staff-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد الإلكتروني</th>
              <th>رقم الهاتف</th>
              <th>الدور الوظيفي</th>
              <th>تاريخ الانضمام</th>
              <th>آخر تسجيل دخول</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="no-results-cell">
                  جاري تحميل الموظفين...
                </td>
              </tr>
            ) : staff.length > 0 ? (
              staff.map((member) => {
                const memberBusy =
                  (toggleMutation.isPending && toggleMutation.variables === member.id) ||
                  (deleteMutation.isPending && deleteMutation.variables === member.id);

                return (
                  <tr key={member.id}>
                    <td className="staff-name">{member.name}</td>
                    <td>{member.email}</td>
                    <td>{member.phone}</td>
                    <td>
                      <span className="role-badge">{member.role}</span>
                    </td>
                    <td>{member.joinDate}</td>
                    <td>{member.lastLogin}</td>
                    <td>
                      <span className={`status-badge ${member.active ? 'active' : 'inactive'}`}>
                        {member.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="action-btn view-btn"
                          onClick={() => openDetails(member)}
                          title="عرض التفاصيل"
                          aria-label="عرض التفاصيل"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="action-btn edit-btn"
                          onClick={() => openEdit(member)}
                          title="تعديل"
                          aria-label="تعديل"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          className={`action-btn toggle-btn ${member.active ? 'active' : 'inactive'}`}
                          onClick={() => handleToggleActive(member)}
                          disabled={memberBusy || member.roleSlug === 'store_manager'}
                          title={member.active ? 'تعطيل' : 'تفعيل'}
                          aria-label={member.active ? 'تعطيل' : 'تفعيل'}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          type="button"
                          className="action-btn delete-btn"
                          onClick={() => handleDeleteStaff(member)}
                          disabled={memberBusy}
                          title="حذف"
                          aria-label="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="no-results-cell">
                  لا يوجد موظفون يطابقون بحثك.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <StaffModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingStaff(null);
        }}
        onSave={handleSave}
        member={editingStaff}
        roles={formRoleOptions}
        existingStaff={staff}
        isSaving={isSaving}
      />

      <StaffDetailsModal
        isOpen={detailsModal.open}
        onClose={() => setDetailsModal({ open: false, member: null, loading: false })}
        member={detailsModal.member}
        loading={detailsModal.loading}
      />

      {toast && (
        <div className="staff-toast">
          <CheckCircle2 size={20} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default Staff;
