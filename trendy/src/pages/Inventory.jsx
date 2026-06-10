import React, { useState, useEffect, useCallback } from 'react';

import { Search, Plus, Eye, Box, CheckCircle2, AlertTriangle } from 'lucide-react';

import AddShipmentModal from '../components/inventory/AddShipmentModal';

import ShipmentDetailModal from '../components/inventory/ShipmentDetailModal';

import {

  fetchInventory,

  createShipment,

  INVENTORY_STOCK_FILTER_OPTIONS,

} from '../api/inventory';

import { getApiErrorMessage } from '../api/stores';

import { useAuth } from '../context/AuthContext';

import './Inventory.css';



const Inventory = () => {

  const { storeId } = useAuth();

  const [inventoryRows, setInventoryRows] = useState([]);

  const [stats, setStats] = useState({ total: 0, available: 0, lowStock: 0, outOfStock: 0 });

  const [searchQuery, setSearchQuery] = useState('');

  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [stockFilter, setStockFilter] = useState('all');

  const [loading, setLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [detailModal, setDetailModal] = useState({ open: false, item: null });

  const [toast, setToast] = useState(null);



  const showToast = (message) => {

    setToast(message);

    setTimeout(() => setToast(null), 3500);

  };



  useEffect(() => {

    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);

    return () => clearTimeout(timer);

  }, [searchQuery]);



  const loadInventory = useCallback(async () => {

    setLoading(true);

    setError('');

    try {

      const result = await fetchInventory({

        storeId,

        search: debouncedSearch,

        stockFilter,

      });

      setInventoryRows(result.items);

      setStats(result.stats);

    } catch (err) {

      setError(getApiErrorMessage(err, 'تعذّر تحميل المخزون'));

      setInventoryRows([]);

      setStats({ total: 0, available: 0, lowStock: 0, outOfStock: 0 });

    } finally {

      setLoading(false);

    }

  }, [storeId, debouncedSearch, stockFilter]);



  useEffect(() => {

    loadInventory();

  }, [loadInventory]);



  const handleAddShipment = async (shipmentData) => {

    setIsSaving(true);

    try {

      const created = await createShipment({

        storeId,

        items: shipmentData.items,

        batchNumber: shipmentData.batchNumber,

      });

      const batchLabel = created.batchNumber || created.code || '';

      showToast(

        batchLabel

          ? `تمت إضافة الشحنة (${batchLabel}) — تحقّق من المخزون بالجدول`

          : 'تمت إضافة الشحنة — تحقّق من المخزون بالجدول',

      );

      setIsAddModalOpen(false);

      await loadInventory();

    } catch (err) {

      throw err;

    } finally {

      setIsSaving(false);

    }

  };



  const handleViewItem = (item) => {

    setDetailModal({

      open: true,

      item: {

        code: item.sku,

        batchNumber: item.sku,

        date: '—',

        status: item.status,

        statusRaw:

          item.statusAlert === 'available'

            ? 'received'

            : item.statusAlert === 'out_of_stock'

              ? 'cancelled'

              : 'pending',

        items: [

          {

            id: item.id,

            name: item.productName,

            category: '—',

            variantLabel: item.attributes,

            quantity: item.totalStock,

          },

        ],

      },

    });

  };



  return (

    <div className="inventory-page">

      <header className="page-header inventory-header">

        <div className="header-title-wrapper">

          <h1 className="page-title">إدارة المخزون</h1>

          <p className="page-subtitle">مخزون التنوعات — إضافة الشحنات تحدّث الكميات هنا</p>

        </div>

      </header>



      <div className="stats-grid inventory-stats">

        <div className="stat-card">

          <div className="stat-header">

            <span className="stat-label">نفد المخزون</span>

            <AlertTriangle size={20} className="stat-icon orange" />

          </div>

          <span className="stat-value orange">{stats.outOfStock}</span>

        </div>

        <div className="stat-card">

          <div className="stat-header">

            <span className="stat-label">مخزون منخفض</span>

            <AlertTriangle size={20} className="stat-icon orange" />

          </div>

          <span className="stat-value orange">{stats.lowStock}</span>

        </div>

        <div className="stat-card">

          <div className="stat-header">

            <span className="stat-label">إجمالي التنوعات</span>

            <Box size={20} className="stat-icon blue" />

          </div>

          <span className="stat-value blue">{stats.total}</span>

        </div>

      </div>



      <div className="inventory-controls">

        <button className="add-shipment-btn" onClick={() => setIsAddModalOpen(true)} type="button">

          <Plus size={18} />

          إضافة شحنة

        </button>



        <div className="filter-dropdown">

          <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>

            {INVENTORY_STOCK_FILTER_OPTIONS.map((s) => (

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

            placeholder="البحث باسم المنتج أو SKU..."

            className="search-input"

            value={searchQuery}

            onChange={(e) => setSearchQuery(e.target.value)}

          />

        </div>

      </div>



      {error && <p className="inventory-error">{error}</p>}



      <div className="shipment-table-wrapper">

        <table className="shipment-table">

          <thead>

            <tr>

              <th>المنتج</th>

              <th>SKU</th>

              <th>التنوع</th>

              <th>الكمية المتاحة</th>

              <th>سعر العرض (FIFO)</th>

              <th>الحالة</th>

              <th>الإجراءات</th>

            </tr>

          </thead>

          <tbody>

            {loading ? (

              <tr>

                <td colSpan="7" className="no-results-cell">

                  جاري تحميل المخزون...

                </td>

              </tr>

            ) : inventoryRows.length > 0 ? (

              inventoryRows.map((row) => (

                <tr key={row.id}>

                  <td className="shipment-code">{row.productName}</td>

                  <td dir="ltr">{row.sku}</td>

                  <td>{row.attributes}</td>

                  <td className="quantity-cell">

                    <span className="quantity-badge">{row.totalStock} قطعة</span>

                  </td>

                  <td>{row.displayPrice > 0 ? `${row.displayPrice} د.ل` : '—'}</td>

                  <td>

                    <span

                      className={`status-badge ${

                        row.statusAlert === 'available'

                          ? 'received'

                          : row.statusAlert === 'out_of_stock'

                            ? 'cancelled'

                            : 'pending'

                      }`}

                    >

                      {row.status}

                    </span>

                  </td>

                  <td>

                    <div className="action-buttons">

                      <button

                        className="action-btn view-btn"

                        onClick={() => handleViewItem(row)}

                        title="عرض"

                        type="button"

                      >

                        <Eye size={16} />

                      </button>

                    </div>

                  </td>

                </tr>

              ))

            ) : (

              <tr>

                <td colSpan="7" className="no-results-cell">

                  لا توجد نتائج. أضف شحنة لتوريد المخزون أو غيّر البحث.

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

        storeId={storeId}

        isSaving={isSaving}

      />



      <ShipmentDetailModal

        isOpen={detailModal.open}

        onClose={() => setDetailModal({ open: false, item: null })}

        shipment={detailModal.item}

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

