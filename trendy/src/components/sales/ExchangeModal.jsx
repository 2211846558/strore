import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import {
  resolveVariant,
  getVariantStock,
  fetchVariantStockPrice,
} from '../../api/pos';
import {
  clampInteger,
  clampIntegerInput,
  isValidIntegerInput,
  parseIntegerInput,
  preventWheelChange,
} from '../../utils/numericInput';
import './SalesModals.css';

const ExchangeModal = ({ isOpen, onClose, item, products = [], onConfirm }) => {
  const [exchangeQty, setExchangeQty] = useState('1');
  const [selectedNewItems, setSelectedNewItems] = useState([]);
  const [prevItem, setPrevItem] = useState(null);

  // Selector state for the new product being added
  const [currentProductId, setCurrentProductId] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
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
    setColor('');
    setSize('');
    setSelectedVariantId('');
    setLiveStock(null);
    setLivePrice(null);
    setAddItemQty('1');
  }

  const currentProduct = products.find((p) => String(p.id) === String(currentProductId));
  const useDirectSelection = Boolean(currentProduct?.useDirectSelection);
  const variantOptions = currentProduct?.variantOptions ?? [];

  const hideSizeField =
    !useDirectSelection &&
    currentProduct?.sizes?.length === 1 &&
    currentProduct.sizes[0] === 'واحد';
  const effectiveSize = hideSizeField ? currentProduct?.sizes?.[0] || 'واحد' : size;

  const currentVariant = useDirectSelection
    ? currentProduct?.variants?.find((v) => String(v.id) === String(selectedVariantId)) ?? null
    : currentProduct
      ? resolveVariant(currentProduct, color, effectiveSize)
      : null;

  const baseStock = useDirectSelection
    ? Number(currentVariant?.stock ?? 0)
    : currentProduct
      ? getVariantStock(currentProduct, color, effectiveSize)
      : 0;

  const stock =
    liveStock != null && liveStock > 0
      ? liveStock
      : baseStock;

  const price = livePrice ?? currentVariant?.price ?? currentProduct?.price ?? 0;
  const selectionReady = useDirectSelection
    ? Boolean(selectedVariantId)
    : Boolean(color && (hideSizeField || size));

  const canAdd =
    currentProduct &&
    selectionReady &&
    currentVariant &&
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
    setColor('');
    setSize('');
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
        setColor(nextProd.colors?.length === 1 ? nextProd.colors[0] : '');
        setSize(nextProd.sizes?.length === 1 ? nextProd.sizes[0] : '');
      }
    }
  };

  // Add variant to exchange list
  const handleAddVariant = () => {
    if (!canAdd) return;

    const newItem = {
      id: currentVariant.id,
      product: currentProduct,
      variant: currentVariant,
      color: useDirectSelection ? currentVariant.color ?? '—' : color,
      size: useDirectSelection ? currentVariant.size ?? '—' : effectiveSize,
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
    setColor('');
    setSize('');
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
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-header">
          <h2 className="sales-modal-title">تبديل منتج (متعدد المنتجات)</h2>
          <button type="button" className="sales-modal-close" onClick={onClose} aria-label="إغلاق">
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
              {useDirectSelection ? (
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
                    {variantOptions.map((option) => (
                      <option key={option.id} value={String(option.id)}>
                        {option.label} {option.stockUnknown ? '' : `(المتوفر: ${option.stock} قطعة)`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="sales-form-group">
                    <label htmlFor="variant-color-select">اللون</label>
                    <select
                      id="variant-color-select"
                      className="sales-form-select"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      disabled={!currentProduct.colors?.length}
                    >
                      <option value="">اختر اللون</option>
                      {(currentProduct.colors ?? []).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!hideSizeField && (
                    <div className="sales-form-group">
                      <label htmlFor="variant-size-select">المقاس</label>
                      <select
                        id="variant-size-select"
                        className="sales-form-select"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        disabled={!currentProduct.sizes?.length}
                      >
                        <option value="">اختر المقاس</option>
                        {(currentProduct.sizes ?? []).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {selectionReady && (
                <div className="sales-stock-box">
                  {loadingStock
                    ? 'جاري جلب الكمية المتوفرة...'
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
            disabled={selectedNewItems.length === 0}
          >
            تأكيد التبديل
          </button>
          <button type="button" className="sales-btn-secondary" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExchangeModal;
