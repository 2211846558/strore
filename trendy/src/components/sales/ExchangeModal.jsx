import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import {
  fetchVariantStockPrice,
  resolveVariantByAttributes,
} from '../../api/pos';
import {
  clampInteger,
  clampIntegerInput,
  isValidIntegerInput,
  parseIntegerInput,
  preventWheelChange,
} from '../../utils/numericInput';
import SalesProductThumb from './SalesProductThumb';
import './SalesModals.css';

const ExchangeModal = ({ isOpen, onClose, item, products = [], storeProducts = [], onConfirm, isSaving = false }) => {
  const [exchangeQty, setExchangeQty] = useState('1');
  const [selectedNewItems, setSelectedNewItems] = useState([]);
  const [prevItem, setPrevItem] = useState(null);

  // Selector state for the new product being added
  const [currentProductId, setCurrentProductId] = useState('');
  const [selectedAttrs, setSelectedAttrs] = useState({});
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [liveStock, setLiveStock] = useState(null);
  const [livePrice, setLivePrice] = useState(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [addItemQty, setAddItemQty] = useState('1');

  // Reset/Initialize modal state when item changes
  if (item !== prevItem) {
    setPrevItem(item);
    setExchangeQty(item ? String(item.quantity || 1) : '1');
    setSelectedNewItems([]);
    setCurrentProductId('');
    setSelectedAttrs({});
    setSelectedVariantId('');
    setLiveStock(null);
    setLivePrice(null);
    setAddItemQty('1');
  }

  const currentProduct = products.find((p) => String(p.id) === String(currentProductId));
  const useDirectSelection = Boolean(currentProduct?.useDirectSelection);
  const variantOptions = currentProduct?.variantOptions ?? [];
  const attributeGroups = currentProduct?.attributeGroups ?? [];

  const currentVariant = useDirectSelection
    ? currentProduct?.variants?.find((v) => String(v.id) === String(selectedVariantId)) ?? null
    : currentProduct
      ? resolveVariantByAttributes(currentProduct, selectedAttrs)
      : null;

  const baseStock = currentVariant ? Number(currentVariant.stock ?? 0) : 0;

  const stock =
    liveStock != null && liveStock > 0
      ? liveStock
      : baseStock;

  const price = livePrice ?? currentVariant?.price ?? currentProduct?.price ?? 0;
  const selectionReady = useDirectSelection
    ? Boolean(selectedVariantId)
    : attributeGroups.length > 0 &&
      attributeGroups.every((g) => Boolean(selectedAttrs[g.name]));

  const isSameAsOriginal = currentVariant && currentVariant.id && item?.variantId && String(currentVariant.id) === String(item.variantId);

  const canAdd =
    currentProduct &&
    selectionReady &&
    currentVariant &&
    !isSameAsOriginal &&
    (stock > 0 || currentVariant?.stockUnknown);

  const addItemMaxQty = currentVariant?.stockUnknown ? 999 : stock;
  const addItemQtyNum = clampInteger(
    parseIntegerInput(addItemQty, 1),
    1,
    Math.max(1, addItemMaxQty),
  );

  // Fetch live stock and price when currentVariant changes
  useEffect(() => {
    if (!currentVariant?.id || !selectionReady) {
      setLiveStock(null);
      setLivePrice(null);
      return;
    }

    let cancelled = false;
    setLoadingStock(true);

    fetchVariantStockPrice(currentVariant.id, { fallbackStock: currentVariant.stock })
      .then(({ stock: nextStock, price: nextPrice }) => {
        if (cancelled) return;
        if (nextStock != null) setLiveStock(nextStock);
        if (nextPrice > 0) setLivePrice(nextPrice);
      })
      .catch(() => {
        if (!cancelled) {
          setLiveStock(null);
          setLivePrice(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStock(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentVariant?.id, selectionReady]);

  // Handle product change
  const handleProductChange = (prodId) => {
    setCurrentProductId(prodId);
    setSelectedAttrs({});
    setSelectedVariantId('');
    setLiveStock(null);
    setLivePrice(null);
    setAddItemQty('1');

    const nextProd = products.find((p) => String(p.id) === String(prodId));
    if (nextProd) {
      if (nextProd.useDirectSelection) {
        setSelectedVariantId(
          nextProd.variantOptions?.length === 1 ? String(nextProd.variantOptions[0].id) : '',
        );
      } else {
        // إذا كانت قيمة خاصية ما واحدة فقط، نختارها تلقائياً
        const autoAttrs = {};
        (nextProd.attributeGroups ?? []).forEach((group) => {
          if (group.values.length === 1) autoAttrs[group.name] = group.values[0];
        });
        setSelectedAttrs(autoAttrs);
      }
    }
  };

  const handleAttrChange = (attrName, value) => {
    setSelectedAttrs((prev) => ({ ...prev, [attrName]: value }));
  };

  // Add variant to exchange list
  const handleAddVariant = () => {
    if (!canAdd) return;

    const newItem = {
      id: currentVariant.id,
      product: currentProduct,
      variant: currentVariant,
      color: currentVariant.color ?? '—',
      size: currentVariant.size ?? '—',
      attributes: useDirectSelection ? (currentVariant.attributes ?? {}) : selectedAttrs,
      price,
      quantity: addItemQtyNum,
      stock,
      stockUnknown: Boolean(currentVariant.stockUnknown),
    };

    setSelectedNewItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.id === currentVariant.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        const nextQty = updated[existingIdx].quantity + addItemQtyNum;
        if (!currentVariant.stockUnknown && nextQty > stock) {
          updated[existingIdx].quantity = stock;
        } else {
          updated[existingIdx].quantity = nextQty;
        }
        return updated;
      } else {
        return [...prev, newItem];
      }
    });

    // Reset selectors
    setCurrentProductId('');
    setSelectedAttrs({});
    setSelectedVariantId('');
    setLiveStock(null);
    setLivePrice(null);
    setAddItemQty('1');
  };

  // Modify quantity of item in selected list
  const updateItemQty = (variantId, delta) => {
    setSelectedNewItems((prev) =>
      prev.map((item) => {
        if (item.id === variantId) {
          const nextQty = item.quantity + delta;
          if (nextQty < 1) return item;
          if (!item.stockUnknown && nextQty > item.stock) return item;
          return { ...item, quantity: nextQty };
        }
        return item;
      })
    );
  };

  // Remove item from selected list
  const removeItem = (variantId) => {
    setSelectedNewItems((prev) => prev.filter((item) => item.id !== variantId));
  };

  if (!isOpen || !item) return null;

  const exchangeQtyNum = clampInteger(
    parseIntegerInput(exchangeQty, 1),
    1,
    item.quantity,
  );

  // Calculate totals and validation
  const totalNewQty = selectedNewItems.reduce((sum, item) => sum + item.quantity, 0);
  const oldTotal = item.price * exchangeQtyNum;
  const newTotal = selectedNewItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const diff = newTotal - oldTotal;
  const diffAmount = Math.abs(diff);

  const handleConfirm = () => {
    if (selectedNewItems.length === 0) return;
    onConfirm(selectedNewItems, exchangeQtyNum);
  };

  return (
    <div className="sales-modal-overlay" onClick={() => !isSaving && onClose()}>
      <div className="sales-modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-header">
          <h2 className="sales-modal-title">استبدال منتج</h2>
          <button type="button" className="sales-modal-close" onClick={onClose} aria-label="إغلاق" disabled={isSaving}>
            <X size={24} />
          </button>
        </div>

        {/* Old product details and selection of quantity to exchange */}
        <div className="sales-old-product-box">
          <p className="sales-refund-label">المنتج القديم</p>
          <p className="sales-refund-name">{item.name}</p>
          <p className="sales-refund-meta">
            {item.color || item.size ? `اللون: ${item.color || '—'} | المقاس: ${item.size || '—'}` : item.sku} | الكمية المشتراة: {item.quantity}
          </p>
          <div className="sales-form-group" style={{ marginTop: '12px' }}>
            <label htmlFor="exchange-qty" style={{ fontSize: '13px', fontWeight: 'bold' }}>
              الكمية المراد تبديلها:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                className="sales-btn-secondary"
                style={{ padding: '6px 12px', minWidth: '40px', cursor: 'pointer' }}
                onClick={() => setExchangeQty(String(Math.max(1, exchangeQtyNum - 1)))}
                disabled={exchangeQtyNum <= 1}
              >
                -
              </button>
              <input
                id="exchange-qty"
                type="text"
                inputMode="numeric"
                className="sales-form-input"
                style={{ textAlign: 'center', width: '80px', padding: '6px 12px', cursor: 'default' }}
                value={exchangeQty}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (isValidIntegerInput(raw)) setExchangeQty(raw);
                }}
                onBlur={() => setExchangeQty(clampIntegerInput(exchangeQty, 1, item.quantity))}
                onWheel={preventWheelChange}
              />
              <button
                type="button"
                className="sales-btn-secondary"
                style={{ padding: '6px 12px', minWidth: '40px', cursor: 'pointer' }}
                onClick={() => setExchangeQty(String(Math.min(item.quantity, exchangeQtyNum + 1)))}
                disabled={exchangeQtyNum >= item.quantity}
              >
                +
              </button>
            </div>
          </div>
          <p className="sales-refund-amount" style={{ marginTop: '12px' }}>{item.price * exchangeQtyNum} د.ل</p>
        </div>

        {/* Selected replacement items list */}
        <div className="sales-form-group">
          <label style={{ fontWeight: 'bold', fontSize: '14px' }}>المنتجات البديلة المحددة ({totalNewQty} من {exchangeQtyNum}):</label>
          {selectedNewItems.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              border: '1px dashed var(--border-color)',
              borderRadius: '10px',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}>
              لم يتم تحديد أي منتجات بديلة بعد. يرجى اختيار وإضافة منتجات أدناه.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {selectedNewItems.map((newItem) => (
                <div key={newItem.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: 'var(--bg-input)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ textAlign: 'right', flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px' }}>{newItem.product.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      اللون: {newItem.color} | المقاس: {newItem.size} | المتوفر: {newItem.stockUnknown ? 'غير محدود' : `${newItem.stock} قطعة`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="sales-btn-secondary"
                        style={{ padding: '2px 8px', minWidth: '28px', cursor: 'pointer' }}
                        onClick={() => updateItemQty(newItem.id, -1)}
                        disabled={newItem.quantity <= 1}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>
                        {newItem.quantity}
                      </span>
                      <button
                        type="button"
                        className="sales-btn-secondary"
                        style={{ padding: '2px 8px', minWidth: '28px', cursor: 'pointer' }}
                        onClick={() => updateItemQty(newItem.id, 1)}
                        disabled={!newItem.stockUnknown && newItem.quantity >= newItem.stock}
                      >
                        +
                      </button>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', width: '80px', textAlign: 'left' }}>
                      {newItem.price * newItem.quantity} د.ل
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(newItem.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      aria-label="حذف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product selector to add to exchange list */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 'bold' }}>إضافة منتج بديل جديد:</h4>
          
          <div className="sales-form-group">
            <label htmlFor="new-product-select">المنتج الجديد</label>
            <select
              id="new-product-select"
              className="sales-form-select"
              value={currentProductId}
              onChange={(e) => handleProductChange(e.target.value)}
            >
              <option value="">اختر المنتج</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.price} د.ل
                </option>
              ))}
            </select>
          </div>

          {currentProduct && (
            <>
              <div className="sales-modal-product-preview exchange-product-preview">
                <SalesProductThumb
                  item={currentProduct}
                  storeProducts={storeProducts}
                  wrapperClassName="sales-modal-product-preview-image"
                  alt={currentProduct.name}
                />
                <p className="sales-modal-product-name">{currentProduct.name}</p>
                <p className="sales-modal-product-price">{currentProduct.price} د.ل</p>
              </div>
              {useDirectSelection ? (
                /* ─── اختيار مباشر ─────────────────────────────────────── */
                <div className="sales-form-group">
                  <label htmlFor="variant-direct-select">التنوع</label>
                  <select
                    id="variant-direct-select"
                    className="sales-form-select"
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    disabled={!variantOptions.length}
                  >
                    <option value="">اختر التنوع</option>
                    {variantOptions.map((option) => {
                      const isCurrent = option.id && item?.variantId && String(option.id) === String(item.variantId);
                      return (
                        <option key={option.id} value={String(option.id)} disabled={isCurrent}>
                          {option.label} {isCurrent ? '(التنوع الحالي - يرجى اختيار تنوع آخر)' : option.stockUnknown ? '' : `(المتوفر: ${option.stock} قطعة)`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                /* ─── dropdown لكل خاصية ديناميكياً ─────────────────────── */
                <>
                  {attributeGroups.map((group, idx) => (
                    <div className="sales-form-group" key={group.name}>
                      <label htmlFor={`exch-attr-${idx}`}>{group.name}</label>
                      <select
                        id={`exch-attr-${idx}`}
                        className="sales-form-select"
                        value={selectedAttrs[group.name] ?? ''}
                        onChange={(e) => handleAttrChange(group.name, e.target.value)}
                        disabled={!group.values.length}
                      >
                        <option value="">اختر {group.name}</option>
                        {group.values.map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </>
              )}

              {selectionReady && (
                <div className="sales-stock-box" style={isSameAsOriginal ? { color: '#ef4444' } : undefined}>
                  {loadingStock
                    ? 'جاري جلب الكمية المتوفرة...'
                    : isSameAsOriginal
                    ? 'هذا هو التنوع الحالي للقطعة المراد استبدالها (يرجى اختيار تنوع آخر).'
                    : `الكمية المتوفرة: ${currentVariant?.stockUnknown && liveStock == null ? 'غير محددة' : `${stock} قطعة`}`}
                </div>
              )}

              {/* Add item quantity and button */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '16px' }}>
                <div className="sales-form-group" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor="add-item-qty">الكمية البديلة:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="sales-btn-secondary"
                      style={{ padding: '6px 12px', minWidth: '40px', cursor: 'pointer' }}
                      onClick={() => setAddItemQty(String(Math.max(1, addItemQtyNum - 1)))}
                      disabled={addItemQtyNum <= 1}
                    >
                      -
                    </button>
                    <input
                      id="add-item-qty"
                      type="text"
                      inputMode="numeric"
                      className="sales-form-input"
                      style={{ textAlign: 'center', width: '80px', padding: '6px 12px', cursor: 'default' }}
                      value={addItemQty}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (isValidIntegerInput(raw)) setAddItemQty(raw);
                      }}
                      onBlur={() => setAddItemQty(clampIntegerInput(addItemQty, 1, addItemMaxQty))}
                      onWheel={preventWheelChange}
                    />
                    <button
                      type="button"
                      className="sales-btn-secondary"
                      style={{ padding: '6px 12px', minWidth: '40px', cursor: 'pointer' }}
                      onClick={() => setAddItemQty(String(Math.min(addItemMaxQty, addItemQtyNum + 1)))}
                      disabled={!currentVariant?.stockUnknown && addItemQtyNum >= stock}
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="sales-btn-primary"
                  style={{ height: '45px', padding: '0 20px' }}
                  onClick={handleAddVariant}
                  disabled={!canAdd}
                >
                  إضافة البديل
                </button>
              </div>
            </>
          )}
        </div>

        {/* Quantities info message */}
        {totalNewQty > 0 && (
          <div style={{
            padding: '12px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '600',
            textAlign: 'right',
            marginBottom: '16px',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)'
          }}>
            <span>كمية المنتج القديم للتبديل: {exchangeQtyNum} قطعة | كمية المنتجات البديلة المحددة: {totalNewQty} قطعة</span>
          </div>
        )}

        {/* Price difference summary */}
        {totalNewQty > 0 && (
          <div className={`sales-exchange-diff ${diff > 0 ? 'pay' : diff < 0 ? 'refund' : 'equal'}`} style={{ marginTop: '8px' }}>
            <div className="sales-exchange-diff-rows">
              <div className="sales-exchange-diff-row">
                <span>إجمالي المنتجات القديمة ({exchangeQtyNum} قطعة):</span>
                <strong>{oldTotal} د.ل</strong>
              </div>
              <div className="sales-exchange-diff-row">
                <span>إجمالي المنتجات البديلة ({totalNewQty} قطعة):</span>
                <strong>{newTotal} د.ل</strong>
              </div>
            </div>
            <p className="sales-exchange-diff-title">
              {diff < 0 ? 'مبلغ يُسترد للعميل' : diff > 0 ? 'مبلغ إضافي على العميل' : 'فرق السعر'}
            </p>
            <p className="sales-exchange-diff-amount">{diffAmount} د.ل</p>
            <p className="sales-exchange-diff-note">
              {diff < 0
                ? 'يجب على المتجر إرجاع هذا المبلغ للعميل لأن المنتج البديل أرخص.'
                : diff > 0
                ? 'يجب على العميل دفع هذا المبلغ الإضافي لأن المنتج البديل أغلى.'
                : 'لا يوجد فرق في السعر بين المنتجين.'}
            </p>
          </div>
        )}

        <div className="sales-modal-footer" style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="sales-btn-primary"
            onClick={handleConfirm}
            disabled={selectedNewItems.length === 0 || isSaving}
          >
            {isSaving ? 'جاري الاستبدال...' : 'تأكيد الاستبدال'}
          </button>
          <button type="button" className="sales-btn-secondary" onClick={onClose} disabled={isSaving}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExchangeModal;
