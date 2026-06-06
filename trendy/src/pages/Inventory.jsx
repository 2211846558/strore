import React, { useState } from 'react';
import { Search, Plus, Trash2, Eye, Pencil, Box, CheckCircle2, Clock } from 'lucide-react';
import AddShipmentModal from '../components/inventory/AddShipmentModal';
import ShipmentDetailModal from '../components/inventory/ShipmentDetailModal';
import './Inventory.css';

const initialShipments = [
  {
    id: 1,
    code: 'SH-001',
    date: '2026-05-10',
    productsCount: 2,
    totalQuantity: 80,
    status: 'مستلمة',
    items: [
      { id: 1, name: 'فستان صيفي', category: 'فستان', color: 'أبيض', size: 'M', quantity: 11 },
      { id: 2, name: 'فستان صيفي', category: 'فستان', color: 'أبيض', size: 'L', quantity: 11 },
    ],
  },
  {
    id: 2,
    code: 'SH-002',
    date: '2026-05-12',
    productsCount: 2,
    totalQuantity: 75,
    status: 'مستلمة',
    items: [
      { id: 3, name: 'فستان صيفي', category: 'فستان', color: 'بني', size: 'L', quantity: 11 },
      { id: 4, name: 'فستان صيفي', category: 'فستان', color: 'بني', size: 'S', quantity: 11 },
    ],
  },
  {
    id: 3,
    code: 'SH-003',
    date: '2026-05-14',
    productsCount: 1,
    totalQuantity: 25,
    status: 'قيد الانتظار',
    items: [
      { id: 5, name: 'فستان صيفي', category: 'فستان', color: 'بني', size: 'M', quantity: 11 },
    ],
  },
];

const Inventory = () => {
  const [shipments, setShipments] = useState(initialShipments);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState({ open: false, shipment: null });
  const [editModal, setEditModal] = useState({ open: false, shipment: null });
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const statuses = [
    { value: 'all', label: 'جميع الحالات' },
    { value: 'مستلمة', label: 'مستلمة' },
    { value: 'قيد الانتظار', label: 'قيد الانتظار' },
  ];

  const filteredShipments = shipments.filter((s) => {
    const matchSearch =
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.items.some((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalShipments = shipments.length;
  const receivedShipments = shipments.filter((s) => s.status === 'مستلمة').length;
  const pendingShipments = shipments.filter((s) => s.status === 'قيد الانتظار').length;

  const handleAddShipment = (shipmentData) => {
    const newId = shipments.length > 0 ? Math.max(...shipments.map((s) => s.id)) + 1 : 1;
    const code = `SH-${String(newId).padStart(3, '0')}`;
    const totalQuantity = shipmentData.items.reduce((sum, item) => sum + Number(item.quantity), 0);
    const newShipment = {
      id: newId,
      code,
      date: new Date().toISOString().split('T')[0],
      productsCount: shipmentData.items.length,
      totalQuantity,
      status: 'قيد الانتظار',
      items: shipmentData.items,
    };
    setShipments((prev) => [newShipment, ...prev]);
    showToast('تم إنشاء الشحنة بنجاح');
  };

  const handleDeleteShipment = (id) => {
    setShipments((prev) => prev.filter((s) => s.id !== id));
    showToast('تم حذف الشحنة');
  };

  const handleViewShipment = (shipment) => {
    setDetailModal({ open: true, shipment });
  };

  const handleEditShipment = (shipment) => {
    setEditModal({ open: true, shipment });
  };

  const handleUpdateShipment = (updatedData) => {
    setShipments((prev) =>
      prev.map((s) =>
        s.id === updatedData.id
          ? {
              ...s,
              items: updatedData.items,
              productsCount: updatedData.items.length,
              totalQuantity: updatedData.items.reduce((sum, item) => sum + Number(item.quantity), 0),
            }
          : s
      )
    );
    showToast('تم تعديل الشحنة بنجاح');
  };

  return (
    <div className="inventory-page">
      <header className="page-header inventory-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">إدارة المخزون</h1>
          <p className="page-subtitle">نظام شحنات المنتجات والكميات</p>
        </div>
      </header>

      <div className="stats-grid inventory-stats">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">الشحنات قيد الانتظار</span>
            <Clock size={20} className="stat-icon orange" />
          </div>
          <span className="stat-value orange">{pendingShipments}</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">الشحنات المستلمة</span>
            <CheckCircle2 size={20} className="stat-icon green" />
          </div>
          <span className="stat-value green">{receivedShipments}</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">إجمالي الشحنات</span>
            <Box size={20} className="stat-icon blue" />
          </div>
          <span className="stat-value blue">{totalShipments}</span>
        </div>
      </div>

      <div className="inventory-controls">
        <button className="add-shipment-btn" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} />
          إضافة شحنة
        </button>

        <div className="filter-dropdown">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="البحث برقم الشحنة أو اسم المنتج..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="shipment-table-wrapper">
        <table className="shipment-table">
          <thead>
            <tr>
              <th>رقم الشحنة</th>
              <th>التاريخ</th>
              <th>عدد المنتجات</th>
              <th>إجمالي الكميات</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredShipments.length > 0 ? (
              filteredShipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td className="shipment-code">{shipment.code}</td>
                  <td>{shipment.date}</td>
                  <td>منتج {shipment.productsCount}</td>
                  <td className="quantity-cell">
                    <span className="quantity-badge">{shipment.totalQuantity} قطعة</span>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        shipment.status === 'مستلمة' ? 'received' : 'pending'
                      }`}
                    >
                      {shipment.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEditShipment(shipment)}
                        title="تعديل"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="action-btn view-btn"
                        onClick={() => handleViewShipment(shipment)}
                        title="عرض"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteShipment(shipment.id)}
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="no-results-cell">
                  لا توجد شحنات تطابق بحثك.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddShipmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddShipment}
      />

      <AddShipmentModal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, shipment: null })}
        onSave={handleUpdateShipment}
        initialData={editModal.shipment}
      />

      <ShipmentDetailModal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, shipment: null })}
        shipment={detailModal.shipment}
      />

      {toast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default Inventory;
