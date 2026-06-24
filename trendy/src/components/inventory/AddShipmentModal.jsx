import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { fetchShipmentCatalog, suggestBatchNumber } from '../../api/inventory';
import { fetchProductVariants } from '../../api/products';
import { getApiErrorMessage } from '../../api/stores';
import './AddShipmentModal.css';

const AddShipmentModal = ({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  storeId,
  isSaving = false,
}) => {
  const isEditMode = !!initialData;
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [variantsList, setVariantsList] = useState([]);
  const [quantities, setQuantities] = useState({}); // variantId -> quantity
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setError('');
    if (initialData) {
      setSelectedProductId(initialData.productId ? String(initialData.productId) : '');
      setPurchasePrice(initialData.costPrice !== undefined && initialData.costPrice !== null ? String(initialData.costPrice) : '');
      setSellingPrice(initialData.sellingPrice !== undefined && initialData.sellingPrice !== null ? String(initialData.sellingPrice) : '');
      setSupplierName(initialData.supplierName || '');
      setBatchNumber(initialData.batchNumber || '');
      
      const initialQtys = {};
      if (Array.isArray(initialData.items)) {
        initialData.items.forEach((item) => {
          if (item.variantId) {
            initialQtys[item.variantId] = item.quantity;
          }
        });
      }
      setQuantities(initialQtys);
    } else {
      setSelectedProductId('');
      setPurchasePrice('');
      setSellingPrice('');
      setSupplierName('');
      setVariantsList([]);
      setQuantities({});
      setBatchNumber(suggestBatchNumber());
    }

    setLoadingCatalog(true);
    fetchShipmentCatalog({ storeId })
      .then(setCatalog)
      .catch(() => {
        setCatalog([]);
        setError('تعذّر تحميل منتجات المتجر.');
      })
      .finally(() => setLoadingCatalog(false));
  }, [isOpen, initialData, storeId]);

  // Fetch variants when product is selected
  useEffect(() => {
    if (!selectedProductId) {
      setVariantsList([]);
      setQuantities({});
      return;
    }

    setLoadingVariants(true);
    setError('');
    const productName = catalog.find((p) => String(p.id) === String(selectedProductId))?.name;
    fetchProductVariants(selectedProductId, { productName })
      .then((variants) => {
        setVariantsList(variants);
        // Pre-fill quantities
        const initialQtys = {};
        variants.forEach((v) => {
          const existingItem = initialData && String(initialData.productId) === String(selectedProductId)
            ? initialData.items.find(item => String(item.variantId) === String(v.id))
            : null;
          initialQtys[v.id] = existingItem ? existingItem.quantity : '';
        });
        setQuantities(initialQtys);
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, 'تعذّر تحميل تنوعات المنتج.'));
        setVariantsList([]);
        setQuantities({});
      })
      .finally(() => setLoadingVariants(false));
  }, [selectedProductId, initialData, catalog]);

  const selectedProduct = catalog.find((p) => String(p.id) === String(selectedProductId));

  const handleQuantityChange = (variantId, val) => {
    const num = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    setQuantities((prev) => ({
      ...prev,
      [variantId]: num,
    }));
  };

  // Calculations for Summary
  const activeVariantsCount = Object.keys(quantities).filter(
    (vid) => Number(quantities[vid]) > 0
  ).length;

  const totalQuantity = Object.values(quantities).reduce(
    (sum, qty) => sum + Number(qty || 0),
    0
  );

  const showPriceWarning =
    purchasePrice !== '' &&
    sellingPrice !== '' &&
    Number(sellingPrice) < Number(purchasePrice);

  const handleSubmit = async () => {
    if (!batchNumber.trim()) {
      setError('رقم الشحنة مطلوب.');
      return;
    }

    if (!selectedProductId) {
      setError('يرجى اختيار المنتج.');
      return;
    }

    if (purchasePrice === '' || Number(purchasePrice) <= 0) {
      setError('سعر الشراء مطلوب وصحيح.');
      return;
    }

    if (sellingPrice === '' || Number(sellingPrice) <= 0) {
      setError('سعر البيع مطلوب وصحيح.');
      return;
    }

    // Build items payload — include real database `id` if editing an existing variant shipment
    const items = variantsList
      .filter((v) => Number(quantities[v.id]) > 0)
      .map((v) => {
        // Look for the existing variant shipment record id from initialData
        const existingItem =
          initialData && Array.isArray(initialData.items)
            ? initialData.items.find((item) => String(item.variantId) === String(v.id))
            : null;

        return {
          // Include the numeric database ID if editing so backend can match
          ...(existingItem && existingItem.id && /^\d+$/.test(String(existingItem.id))
            ? { id: existingItem.id }
            : {}),
          variantId: v.id,
          name: selectedProduct?.name || '',
          category: selectedProduct?.category || '',
          variantLabel: v.label,
          quantity: Number(quantities[v.id]),
          unitCost: Number(purchasePrice),
          sellingPrice: Number(sellingPrice),
        };
      });

    if (items.length === 0) {
      setError('يرجى إدخال كمية لواحد من التنوعات على الأقل.');
      return;
    }

    setError('');
    try {
      const payload = {
        batchNumber: batchNumber.trim(),
        supplierName: supplierName.trim(),
        costPrice: Number(purchasePrice),
        sellingPrice: Number(sellingPrice),
        items,
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر حفظ الشحنة.'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-shipment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEditMode ? 'تعديل الشحنة' : 'واجهة إنشاء الشحنة'}</h2>
          <button className="close-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        <div className="shipment-form">
          {error && <p className="form-error">{error}</p>}

          {/* الحقول الرئيسية */}
          <div className="form-row">
            <div className="form-group">
              <label>
                رقم الشحنة <span className="required-mark">*</span>
              </label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="رقم الشحنة الفريد"
                dir="ltr"
              />
            </div>
            <div className="form-group">
              <label>اسم المورد</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="اختياري"
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              المنتج <span className="required-mark">*</span>
            </label>
            {loadingCatalog ? (
              <p className="catalog-loading">جاري تحميل المنتجات...</p>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                <option value="">اختر منتجاً...</option>
                {catalog.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                سعر الشراء <span className="required-mark">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="ينطبق على جميع التنوعات"
              />
            </div>
            <div className="form-group">
              <label>
                سعر البيع <span className="required-mark">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="ينطبق على جميع التنوعات"
              />
            </div>
          </div>

          {showPriceWarning && (
            <div className="price-warning-banner">
              <AlertTriangle size={18} />
              <span>تحذير: سعر البيع أقل من سعر الشراء!</span>
            </div>
          )}

          {/* جدول التنوعات */}
          {selectedProductId && (
            <div className="shipment-variants-section">
              <h3 className="section-title">جدول التنوعات داخل الشحنة</h3>
              {loadingVariants ? (
                <p className="variants-loading">جاري تحميل التنوعات والكميات الحالية...</p>
              ) : variantsList.length === 0 ? (
                <p className="variants-empty">لا توجد تنوعات لهذا المنتج.</p>
              ) : (
                <div className="variants-table-wrapper">
                  <table className="variants-table">
                    <thead>
                      <tr>
                        <th>التنوع</th>
                        <th>الكمية الحالية</th>
                        <th>الكمية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantsList.map((v) => (
                        <tr key={v.id}>
                          <td className="variant-label">{v.label}</td>
                          <td className="current-qty">{v.quantity ?? 0} قطعة</td>
                          <td className="input-qty">
                            <input
                              type="number"
                              min="0"
                              value={quantities[v.id] ?? ''}
                              onChange={(e) => handleQuantityChange(v.id, e.target.value)}
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ملخص الشحنة قبل الحفظ */}
          {selectedProductId && (
            <div className="shipment-summary-card">
              <h4 className="summary-title">ملخص الشحنة</h4>
              <div className="summary-row">
                <span className="summary-label">المنتج:</span>
                <span className="summary-value">{selectedProduct?.name || '—'}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">إجمالي التنوعات:</span>
                <span className="summary-value">{activeVariantsCount}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">إجمالي الكمية:</span>
                <span className="summary-value">{totalQuantity}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">سعر الشراء:</span>
                <span className="summary-value">{purchasePrice ? `${purchasePrice} د.ل` : '—'}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">سعر البيع:</span>
                <span className="summary-value">{sellingPrice ? `${sellingPrice} د.ل` : '—'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} type="button" disabled={isSaving}>
            إلغاء
          </button>
          <button
            className="save-button"
            onClick={handleSubmit}
            type="button"
            disabled={totalQuantity === 0 || isSaving}
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddShipmentModal;
