import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { fetchShipmentCatalog, suggestBatchNumber } from '../../api/inventory';
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
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setError('');
    if (initialData) {
      setItems(initialData.items || []);
    } else {
      setItems([]);
    }
    setSelectedProductId('');
    setSelectedVariantId('');
    setQuantity('');
    setUnitCost('');
    setSellingPrice('');
    setBatchNumber(initialData?.batchNumber || suggestBatchNumber());

    setLoadingCatalog(true);
    fetchShipmentCatalog({ storeId })
      .then(setCatalog)
      .catch(() => {
        setCatalog([]);
        setError('تعذّر تحميل منتجات المتجر.');
      })
      .finally(() => setLoadingCatalog(false));
  }, [isOpen, initialData, storeId]);

  const selectedProduct = catalog.find((p) => String(p.id) === String(selectedProductId));
  const selectedVariant = selectedProduct?.variants?.find(
    (v) => String(v.id) === String(selectedVariantId),
  );

  const canAddItem = Boolean(
    selectedProduct &&
      selectedVariant &&
      Number(quantity) > 0 &&
      sellingPrice !== '' &&
      Number(sellingPrice) >= 0 &&
      unitCost !== '' &&
      Number(unitCost) >= 0,
  );

  const addItemHint = (() => {
    if (loadingCatalog || !catalog.length) return '';
    if (!selectedProductId) return 'اختر المنتج أولاً';
    if (!selectedVariantId) return 'اختر التنوع (لون / مقاس)';
    if (!quantity || Number(quantity) <= 0) return 'أدخل الكمية';
    if (sellingPrice === '' || Number(sellingPrice) < 0) return 'أدخل سعر البيع للقطعة';
    if (unitCost === '' || Number(unitCost) < 0) return 'أدخل سعر التكلفة (الشراء) للقطعة';
    return '';
  })();

  const handleAddItem = () => {
    if (!selectedProduct || !selectedVariant) {
      setError('اختر المنتج والتنوع قبل الإضافة.');
      return;
    }

    if (!quantity) {
      setError('أدخل الكمية.');
      return;
    }

    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError('أدخل كمية صحيحة أكبر من صفر.');
      return;
    }

    if (sellingPrice === '' || Number(sellingPrice) < 0) {
      setError('أدخل سعر البيع للقطعة.');
      return;
    }

    if (unitCost === '' || Number(unitCost) < 0) {
      setError('أدخل سعر التكلفة (الشراء) للقطعة.');
      return;
    }

    const duplicate = items.some(
      (item) => String(item.variantId) === String(selectedVariant.id),
    );
    if (duplicate) {
      setError('هذا التنوع مضاف مسبقاً في الشحنة.');
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        id: `line-${selectedVariant.id}`,
        variantId: selectedVariant.id,
        name: selectedProduct.name,
        category: selectedProduct.category,
        variantLabel: selectedVariant.label,
        color: selectedVariant.label.split(' / ')[0] || '—',
        size: selectedVariant.label.split(' / ')[1] || '—',
        quantity: qty,
        unitCost: Number(unitCost),
        sellingPrice: Number(sellingPrice),
      },
    ]);

    setSelectedProductId('');
    setSelectedVariantId('');
    setQuantity('');
    setUnitCost('');
    setSellingPrice('');
    setError('');
  };

  const handleDeleteItem = (itemId) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const handleSubmit = async () => {
    if (!batchNumber.trim()) {
      setError('رقم الدفعة مطلوب — أدخل رقم الدفعة (batch number).');
      return;
    }

    if (!items.length) {
      setError('أضف منتجاً واحداً على الأقل للشحنة.');
      return;
    }

    setError('');
    try {
      const payload = {
        batchNumber: batchNumber.trim(),
        items,
      };
      if (isEditMode && initialData) {
        await onSave({ ...initialData, ...payload });
      } else {
        await onSave(payload);
      }
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر حفظ الشحنة.'));
    }
  };

  if (!isOpen) return null;

  const canEdit = !initialData || initialData.statusRaw === 'pending';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-shipment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEditMode ? 'تعديل الشحنة' : 'إضافة شحنة جديدة'}</h2>
          <button className="close-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        <div className="shipment-form">
          {!canEdit && (
            <p className="shipment-form-note">
              لا يمكن تعديل شحنة مستلمة. يمكنك عرض التفاصيل فقط.
            </p>
          )}

          {canEdit && (
            <div className="form-group shipment-batch-field">
              <label>
                رقم الدفعة (Batch Number) <span className="required-mark">*</span>
              </label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => {
                  setBatchNumber(e.target.value);
                  setError('');
                }}
                placeholder="مثال: BATCH-20260608-0001"
                dir="ltr"
              />
              <p className="field-hint">
                رقم تعريف للدفعة الواردة — يُستخدم لتتبع المخزون (FIFO).
              </p>
            </div>
          )}

          {canEdit && (
            <div className="add-products-section">
              <h3 className="section-title">إضافة منتجات للشحنة</h3>

              {loadingCatalog ? (
                <p className="catalog-loading">جاري تحميل المنتجات...</p>
              ) : catalog.length === 0 ? (
                <p className="catalog-empty">
                  لا توجد منتجات بتنوعات. أضف تنوعات للمنتجات أولاً من صفحة المنتجات.
                </p>
              ) : (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>اسم المنتج</label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => {
                          const productId = e.target.value;
                          setSelectedProductId(productId);
                          setSelectedVariantId('');
                          const product = catalog.find((p) => String(p.id) === productId);
                          setSellingPrice(product?.price ? String(product.price) : '');
                          setError('');
                        }}
                      >
                        <option value="">اختر المنتج</option>
                        {catalog.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>التصنيف</label>
                      <div
                        className={`category-display ${selectedProduct ? 'filled' : 'empty'}`}
                        aria-live="polite"
                      >
                        {selectedProduct?.category || 'يظهر تلقائياً بعد اختيار المنتج'}
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>التنوع (لون / مقاس)</label>
                      <select
                        value={selectedVariantId}
                        onChange={(e) => {
                          setSelectedVariantId(e.target.value);
                          setError('');
                        }}
                        disabled={!selectedProductId}
                      >
                        <option value="">اختر التنوع</option>
                        {selectedProduct?.variants?.map((v) => (
                          <option key={v.id} value={String(v.id)}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>الكمية</label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => {
                          setQuantity(e.target.value);
                          setError('');
                        }}
                        placeholder="الكمية"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>
                        سعر البيع للقطعة <span className="required-mark">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={sellingPrice}
                        onChange={(e) => {
                          setSellingPrice(e.target.value);
                          setError('');
                        }}
                        placeholder="مثال: 120"
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        سعر التكلفة للقطعة <span className="required-mark">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={unitCost}
                        onChange={(e) => {
                          setUnitCost(e.target.value);
                          setError('');
                        }}
                        placeholder="مثال: 50"
                      />
                    </div>
                  </div>

                  <button
                    className="add-item-btn"
                    type="button"
                    onClick={handleAddItem}
                    disabled={!canAddItem}
                  >
                    <Plus size={18} />
                    إضافة المنتج للشحنة
                  </button>

                  {addItemHint && !error && (
                    <p className="add-item-hint">{addItemHint}</p>
                  )}
                </>
              )}
            </div>
          )}

          {items.length > 0 && (
            <div className="shipment-items-section">
              <h3 className="section-title">المنتجات في الشحنة ({items.length})</h3>
              <div className="shipment-items-list">
                {items.map((item) => (
                  <div key={item.id} className="shipment-item-row">
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-details">
                        التصنيف: {item.category} | التنوع: {item.variantLabel || `${item.color} / ${item.size}`}
                        {item.sellingPrice != null && ` | بيع: ${item.sellingPrice} د.ل`}
                        {item.unitCost != null && ` | تكلفة: ${item.unitCost} د.ل`}
                      </span>
                    </div>
                    <div className="item-qty">{item.quantity} قطعة</div>
                    {canEdit && (
                      <button
                        className="item-delete-btn"
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="shipment-total">
                <span className="total-label">إجمالي الكميات:</span>
                <span className="total-value">{totalQuantity} قطعة</span>
              </div>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} type="button" disabled={isSaving}>
            إلغاء
          </button>
          {canEdit && (
            <button
              className="save-button"
              onClick={handleSubmit}
              type="button"
              disabled={items.length === 0 || isSaving}
            >
              {isSaving ? 'جاري الحفظ...' : isEditMode ? 'حفظ التعديلات' : 'إنشاء الشحنة'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddShipmentModal;
