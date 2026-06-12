import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Eye, Package, CheckCircle2,
  Truck, Clock, BarChart2, Edit2
} from 'lucide-react';
import AddShipmentModal from '../components/inventory/AddShipmentModal';
import ShipmentDetailModal from '../components/inventory/ShipmentDetailModal';
import ShipmentStatusControl from '../components/inventory/ShipmentStatusControl';
import {
  createShipment,
  updateShipment,
  fetchShipments,
  archiveShipment,
  updateShipmentStatus,
  SHIPMENT_STATUS_FILTER_OPTIONS,
} from '../api/inventory';
import { getApiErrorMessage } from '../api/stores';
import { useAuth } from '../context/AuthContext';
import './Inventory.css';

const Inventory = () => {
  const { storeId } = useAuth();

  const [allShipments, setAllShipments] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, received: 0, totalQty: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState(null);
  const [detailShipment, setDetailShipment] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadShipments = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await fetchShipments({
        storeId,
        status: statusFilter,
        search: debouncedSearch,
      });
      setAllShipments(result.shipments || []);
      setStats({
        total: result.stats?.total || 0,
        pending: result.stats?.pending || 0,
        received: result.stats?.received || 0,
        totalQty: result.stats?.totalQty || 0,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل الشحنات من الخادم.'));
    } finally {
      setIsLoading(false);
    }
  }, [storeId, statusFilter, debouncedSearch]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  /* ── حفظ شحنة ── */
  const handleSaveShipment = async (shipmentData) => {
    setIsSaving(true);
    try {
      const payload = {
        storeId,
        productId: shipmentData.productId,
        items: shipmentData.items,
        batchNumber: shipmentData.batchNumber,
        supplierName: shipmentData.supplierName,
        costPrice: shipmentData.costPrice ?? shipmentData.items[0]?.unitCost,
        sellingPrice: shipmentData.sellingPrice ?? shipmentData.items[0]?.sellingPrice,
      };

      if (editingShipment?.id) {
        await updateShipment(editingShipment.id, payload);
        showToast(`تم تحديث الشحنة بنجاح.`);
      } else {
        await createShipment(payload);
        showToast(`تمت إضافة الشحنة بنجاح.`);
      }

      loadShipments();
      setIsShipmentModalOpen(false);
      setEditingShipment(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر حفظ الشحنة.'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  };


  const handleOpenAdd = () => {
    setEditingShipment(null);
    setIsShipmentModalOpen(true);
  };

  const handleOpenEdit = (shipment) => {
    setEditingShipment(shipment);
    setIsShipmentModalOpen(true);
  };

  const handleViewDetail = (shipment) => {
    setDetailShipment(shipment);
  };

  const handleArchiveShipment = async (shipment) => {
    if (!shipment?.id) return;
    setIsSaving(true);
    setError('');
    try {
      await archiveShipment(shipment, { storeId });
      showToast('تم أرشفة الشحنة بنجاح.');
      setIsShipmentModalOpen(false);
      setEditingShipment(null);
      setDetailShipment(null);
      await loadShipments();
    } catch (err) {
      const message = getApiErrorMessage(err, 'تعذّر تحديث حالة الشحنة.');
      setError(message);
      showToast(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (shipment, targetStatus) => {
    if (!shipment?.id) return;
    setStatusUpdatingId(shipment.id);
    setError('');
    try {
      await updateShipmentStatus(shipment, targetStatus, { storeId });
      showToast('تم تحديث حالة الشحنة بنجاح.');
      await loadShipments();
    } catch (err) {
      const message = getApiErrorMessage(err, 'تعذّر تحديث حالة الشحنة.');
      setError(message);
      showToast(message);
      throw err;
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const formatDate = (d) => d || '—';

  return (
    <div className="inventory-page">
      {/* ── Header ── */}
      <header className="page-header inventory-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">إدارة المخزون</h1>
          <p className="page-subtitle">سجل الشحنات الواردة — اضغط على شحنة لعرض تفاصيل تنوعاتها</p>
        </div>
      </header>

      {/* ── Stats ── */}
      <div className="inventory-stats">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">إجمالي الشحنات</span>
            <Truck size={20} className="stat-icon blue" />
          </div>
          <span className="stat-value blue">{stats.total}</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">قيد الانتظار</span>
            <Clock size={20} className="stat-icon orange" />
          </div>
          <span className="stat-value orange">{stats.pending}</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">مستلمة</span>
            <CheckCircle2 size={20} className="stat-icon green" />
          </div>
          <span className="stat-value green">{stats.received}</span>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">إجمالي القطع الواردة</span>
            <BarChart2 size={20} className="stat-icon blue" />
          </div>
          <span className="stat-value blue">{stats.totalQty}</span>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="inventory-controls">
        <button className="add-shipment-btn" onClick={handleOpenAdd} type="button">
          <Plus size={18} />
          إضافة شحنة
        </button>

        <div className="filter-dropdown">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {SHIPMENT_STATUS_FILTER_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="بحث برقم الشحنة أو اسم المنتج..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="inventory-error">{error}</p>}

      {/* ── Shipments Table ── */}
      <div className="shipment-table-wrapper">
        <table className="shipment-table">
          <thead>
            <tr>
              <th>رقم الشحنة</th>
              <th>تاريخ الإنشاء</th>
              <th>المنتج / المنتجات</th>
              <th>إجمالي القطع</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" className="no-results-cell">جاري تحميل الشحنات...</td>
              </tr>
            ) : allShipments.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-results-cell">
                  {allShipments.length === 0 && !debouncedSearch && statusFilter === 'all'
                    ? 'لا توجد شحنات بعد. اضغط «إضافة شحنة» لإنشاء أول شحنة.'
                    : 'لا توجد شحنات تطابق البحث أو الفلتر.'}
                </td>
              </tr>
            ) : (
              allShipments.map((shipment) => {
                /* حساب الكمية الفعلية من مجموع تنوعات الشحنة */
                const computedQty = (shipment.items || []).reduce(
                  (sum, item) => sum + Number(item.quantity || 0),
                  0
                );

                /* أسماء المنتجات الفريدة */
                const productNames = [
                  ...new Set(
                    (shipment.items || [])
                      .map((i) => i.name)
                      .filter(Boolean)
                  ),
                ];
                const productsLabel =
                  productNames.length === 0
                    ? '—'
                    : productNames.length === 1
                    ? productNames[0]
                    : `${productNames[0]} +${productNames.length - 1} آخر`;

                return (
                  <tr
                    key={shipment.id}
                    className="shipment-row"
                    onClick={() => handleViewDetail(shipment)}
                    style={{ cursor: 'pointer' }}
                    title="اضغط لعرض تفاصيل الشحنة"
                  >
                    <td className="shipment-code">{shipment.code}</td>
                    <td className="shipment-date">{formatDate(shipment.date)}</td>
                    <td className="shipment-products">
                      <div className="products-label">
                        <Package size={14} className="products-icon" />
                        <span className="products-label-text">{productsLabel}</span>
                      </div>
                      {productNames.length > 1 && (
                        <span className="products-sub-count">{productNames.length} منتجات</span>
                      )}
                    </td>
                    <td className="quantity-cell">
                      <span className="quantity-badge">{computedQty} قطعة</span>
                      {computedQty !== Number(shipment.totalQuantity || 0) &&
                        Number(shipment.totalQuantity || 0) > 0 && (
                        <span className="quantity-sub">
                          ({shipment.totalQuantity} مسجّل)
                        </span>
                      )}
                    </td>
                    <td>
                      <ShipmentStatusControl
                        shipment={shipment}
                        onStatusChange={handleStatusChange}
                        disabled={statusUpdatingId === shipment.id || isSaving}
                      />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="action-buttons">
                        <button
                          className="action-btn view-btn"
                          onClick={() => handleViewDetail(shipment)}
                          title="عرض التفاصيل"
                          type="button"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="action-btn edit-btn"
                          onClick={() => handleOpenEdit(shipment)}
                          title="تعديل الشحنة"
                          type="button"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add/Edit Shipment Modal ── */}
      <AddShipmentModal
        isOpen={isShipmentModalOpen}
        onClose={() => {
          if (!isSaving) {
            setIsShipmentModalOpen(false);
            setEditingShipment(null);
          }
        }}
        onSave={handleSaveShipment}
        onArchive={handleArchiveShipment}
        initialData={editingShipment}
        storeId={storeId}
        isSaving={isSaving}
      />

      {/* ── Shipment Detail Modal ── */}
      <ShipmentDetailModal
        isOpen={!!detailShipment}
        onClose={() => setDetailShipment(null)}
        shipment={detailShipment}
        onArchive={handleArchiveShipment}
        isSaving={isSaving}
      />

      {/* ── Toast ── */}
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
