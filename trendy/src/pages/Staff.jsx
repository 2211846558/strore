import React, { useState } from 'react';
import { Search, Plus, Edit2, Power, CheckCircle2 } from 'lucide-react';
import StaffModal from '../components/staff/StaffModal';
import RoleFilterDropdown from '../components/staff/RoleFilterDropdown';
import './Staff.css';

const ROLES = ['مسؤول عمليات', 'محاسب', 'موظف دعم فني', 'مدير متجر', 'موظف متجر'];

const initialStaff = [
  {
    id: 1,
    name: 'أحمد محمد',
    email: 'ahmed@trendy.com',
    phone: '0912345678',
    role: 'مسؤول عمليات',
    joinDate: '2026-01-15',
    lastLogin: '2026-05-03 10:30',
    status: 'نشط',
    active: true,
  },
  {
    id: 2,
    name: 'فاطمة علي',
    email: 'fatima@trendy.com',
    phone: '0923456789',
    role: 'محاسب',
    joinDate: '2026-02-20',
    lastLogin: '2026-05-03 09:15',
    status: 'نشط',
    active: true,
  },
  {
    id: 3,
    name: 'عمر سالم',
    email: 'omar@trendy.com',
    phone: '0934567890',
    role: 'موظف دعم فني',
    joinDate: '2026-03-10',
    lastLogin: '2026-04-28 14:20',
    status: 'نشط',
    active: true,
  },
  {
    id: 4,
    name: 'سارة محمود',
    email: 'sara@trendy.com',
    phone: '0945678901',
    role: 'مدير متجر',
    joinDate: '2026-03-25',
    lastLogin: '2026-05-02 16:00',
    status: 'نشط',
    active: true,
  },
  {
    id: 5,
    name: 'خالد إبراهيم',
    email: 'khaled@trendy.com',
    phone: '0956789012',
    role: 'موظف متجر',
    joinDate: '2026-04-05',
    lastLogin: '2026-05-01 11:45',
    status: 'معطل',
    active: false,
  },
];

const Staff = () => {
  const [staff, setStaff] = useState(initialStaff);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  const roleOptions = [
    { value: 'all', label: 'جميع الأدوار' },
    ...ROLES.map((r) => ({ value: r, label: r })),
  ];

  const filteredStaff = staff.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.phone.includes(searchQuery.trim());
    const matchRole = roleFilter === 'all' || s.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleAdd = (member) => {
    const newMember = {
      ...member,
      id: Date.now(),
      joinDate: new Date().toISOString().split('T')[0],
      lastLogin: '-',
      status: 'نشط',
      active: true,
    };
    setStaff((prev) => [...prev, newMember]);
    showToast('تم إضافة الموظف بنجاح');
  };

  const handleEdit = (member) => {
    setStaff((prev) =>
      prev.map((s) => (s.id === member.id ? { ...s, ...member } : s))
    );
    showToast('تم حفظ التغييرات بنجاح');
  };

  const handleToggleActive = (id) => {
    const target = staff.find((s) => s.id === id);
    if (!target) return;

    setStaff((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const newActive = !s.active;
        return { ...s, active: newActive, status: newActive ? 'نشط' : 'معطل' };
      })
    );

    showToast(
      target.active
        ? `تم تعطيل حساب «${target.name}»`
        : `تم تفعيل حساب «${target.name}»`
    );
  };

  const openAdd = () => {
    setEditingStaff(null);
    setIsModalOpen(true);
  };

  const openEdit = (member) => {
    setEditingStaff(member);
    setIsModalOpen(true);
  };

  const handleSave = (data) => {
    if (editingStaff) {
      handleEdit({ ...data, id: editingStaff.id, active: editingStaff.active, status: editingStaff.status });
    } else {
      handleAdd(data);
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
            {filteredStaff.length > 0 ? (
              filteredStaff.map((member) => (
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
                        onClick={() => handleToggleActive(member.id)}
                        title={member.active ? 'تعطيل' : 'تفعيل'}
                        aria-label={member.active ? 'تعطيل' : 'تفعيل'}
                      >
                        <Power size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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
        roles={ROLES}
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
