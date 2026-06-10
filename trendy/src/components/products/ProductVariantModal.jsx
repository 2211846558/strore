import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Plus, Layers, Save, Trash2, AlertCircle } from 'lucide-react';
import {
  fetchAttributes,
  fetchProductVariants,
  createProductVariant,
  deleteProductVariant,
} from '../../api/products';
import { getApiErrorMessage } from '../../api/stores';
import './ProductVariantModal.css';

/* ─── مُعرِّف فريد للتركيبة المحددة في صف معين ─── */
function buildSelectionKey(selections, attributes) {
  return attributes
    .map((attr) => `${attr.id}:${selections[attr.id] ?? ''}`)
    .sort()
    .join('|');
}

/* ─── صف معلّق (قيد الإدخال) ─── */
function PendingRow({
  row,
  attributes,
  onChange,
  onRemove,
  rowError,
  disabled,
}) {
  return (
    <tr className={`vt-row vt-row--pending${rowError ? ' vt-row--error' : ''}`}>
      {attributes.map((attr) => (
        <td key={attr.id} className="vt-cell">
          <select
            className={`vt-select${!row.selections[attr.id] ? ' vt-select--empty' : ''}`}
            value={row.selections[attr.id] || ''}
            onChange={(e) => onChange(row.id, attr.id, e.target.value)}
            disabled={disabled}
          >
            <option value="">— {attr.name} —</option>
            {attr.values.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.value}
              </option>
            ))}
          </select>
        </td>
      ))}
      {/* السعر — read only */}
      <td className="vt-cell vt-cell--readonly">
        <span className="vt-auto-badge">🔒 تلقائي</span>
      </td>
      {/* الكمية — read only */}
      <td className="vt-cell vt-cell--readonly">
        <span className="vt-auto-badge">🔒 تلقائي</span>
      </td>
      {/* الشحنة الحالية — read only */}
      <td className="vt-cell vt-cell--readonly">
        <span className="vt-auto-badge">🔒 تلقائي</span>
      </td>
      {/* حذف الصف */}
      <td className="vt-cell vt-cell--action">
        <button
          type="button"
          className="vt-remove-btn"
          onClick={() => onRemove(row.id)}
          disabled={disabled}
          title="حذف الصف"
        >
          <X size={14} />
        </button>
        {rowError && (
          <span className="vt-row-error" title={rowError}>
            <AlertCircle size={13} />
          </span>
        )}
      </td>
    </tr>
  );
}


/* ─── صف محفوظ ─── */
function SavedRow({ variant, attributes, onDelete, disabled }) {
  return (
    <tr className="vt-row vt-row--saved">
      {attributes.map((attr) => {
        const localAv = variant.attributeValues?.find(
          (val) => String(val.attribute_id ?? val.pivot?.attribute_id ?? val.attribute?.id ?? '') === String(attr.id)
        );
        const localValue = localAv?.value ?? localAv?.name;

        const valId = variant.selections?.[attr.id];
        const valObj = attr.values.find((v) => String(v.id) === String(valId));
        const catalogValue = valObj?.value;

        const displayValue = localValue || catalogValue || '—';

        return (
          <td key={attr.id} className="vt-cell vt-cell--saved-value">
            {displayValue}
          </td>
        );
      })}
      <td className="vt-cell vt-cell--readonly">
        {variant.price ? (
          <>
            <strong>{variant.price}</strong>{' '}
            <span className="vt-currency">د.ل</span>
          </>
        ) : (
          <span className="vt-dash">—</span>
        )}
      </td>
      <td className="vt-cell vt-cell--readonly">
        {variant.quantity != null && variant.quantity !== '' ? (
          <span className="vt-qty-pill">{variant.quantity}</span>
        ) : (
          <span className="vt-dash">—</span>
        )}
      </td>
      <td className="vt-cell vt-cell--readonly">
        {variant.currentShipment ? (
          <span className="vt-shipment-badge">#{variant.currentShipment}</span>
        ) : (
          <span className="vt-dash">—</span>
        )}
      </td>
      <td className="vt-cell vt-cell--action">
        <button
          type="button"
          className="vt-delete-btn"
          onClick={() => onDelete(variant.id)}
          disabled={disabled}
          title="حذف التنوع"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

/* ════════════════════════════════════════════════════════ */
const ProductVariantModal = ({ isOpen, onClose, product, storeId, onVariantAdded }) => {
  const [attributes, setAttributes] = useState([]);
  const [savedVariants, setSavedVariants] = useState([]);
  const [pendingRows, setPendingRows] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [globalError, setGlobalError] = useState('');

  /* مُعرِّف فريد لكل صف معلّق */
  const nextId = useCallback(() => `row-${Date.now()}-${Math.random().toString(36).slice(2)}`, []);

  /* إنشاء صف فارغ */
  const makeEmptyRow = useCallback(
    () => ({ id: nextId(), selections: {} }),
    [nextId],
  );

  /* تحميل الخصائص والتنوعات المحفوظة */
  useEffect(() => {
    if (!isOpen || !product) return;
    setLoading(true);
    setGlobalError('');
    setRowErrors({});
    setPendingRows([makeEmptyRow()]);

    Promise.all([fetchAttributes(), fetchProductVariants(product.id)])
      .then(([attrs, variants]) => {
        setAttributes(attrs.filter((a) => a.values?.length > 0));
        setSavedVariants(variants);
      })
      .catch((err) => {
        setGlobalError(getApiErrorMessage(err, 'تعذّر تحميل بيانات التنوعات.'));
        setAttributes([]);
        setSavedVariants([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, product?.id, makeEmptyRow]);


  /* ─── Pending rows helpers ─── */
  const addRow = () => setPendingRows((prev) => [...prev, makeEmptyRow()]);

  const removeRow = (rowId) => {
    setPendingRows((prev) => prev.filter((r) => r.id !== rowId));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const updateSelection = (rowId, attrId, valueId) => {
    setPendingRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, selections: { ...r.selections, [attrId]: valueId } }
          : r,
      ),
    );
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  /* ─── Validation ─── */
  function validateRows() {
    const errors = {};
    const usedKeys = new Set(savedVariants.map((v) => v.selectionKey));

    pendingRows.forEach((row) => {
      // تحقق من اختيار جميع الخصائص
      const missing = attributes.filter((attr) => !row.selections[attr.id]);
      if (missing.length) {
        errors[row.id] = `اختر قيمة لـ: ${missing.map((a) => a.name).join('، ')}`;
        return;
      }

      // تحقق من عدم التكرار مع المحفوظات
      const key = buildSelectionKey(row.selections, attributes);
      if (usedKeys.has(key)) {
        errors[row.id] = 'هذا التنوع موجود مسبقاً';
      } else {
        usedKeys.add(key); // حماية من التكرار بين الصفوف الجديدة أيضاً
      }
    });

    return errors;
  }

  /* ─── حفظ جميع الصفوف دفعة واحدة ─── */
  const handleSaveAll = async () => {
    if (!pendingRows.length) return;

    const errors = validateRows();
    setRowErrors(errors);
    if (Object.keys(errors).length) return;

    setIsSaving(true);
    setGlobalError('');

    const newErrors = {};
    const succeeded = [];

    await Promise.all(
      pendingRows.map(async (row) => {
        const attributeValueIds = attributes.map((attr) => Number(row.selections[attr.id]));
        try {
          const created = await createProductVariant(product.id, {
            storeId,
            sku: `P${product.id}-${attributeValueIds.join('-')}`,
            attributeValueIds,
          });
          succeeded.push(created);
        } catch (err) {
          newErrors[row.id] = getApiErrorMessage(err, 'تعذّر حفظ التنوع.');
        }
      }),
    );

    setRowErrors(newErrors);

    if (succeeded.length) {
      // إعادة جلب التنوعات المحدّثة
      try {
        const fresh = await fetchProductVariants(product.id);
        setSavedVariants(fresh);
      } catch {
        /* ignore */
      }
      // إزالة الصفوف التي نجح حفظها
      const failedIds = new Set(Object.keys(newErrors));
      setPendingRows((prev) => prev.filter((r) => failedIds.has(r.id)));
      succeeded.forEach((v) => onVariantAdded?.(v));

      if (!Object.keys(newErrors).length) {
        // إضافة صف فارغ جديد للاستمرار بالإضافة
        setPendingRows([makeEmptyRow()]);
      }
    }

    setIsSaving(false);
  };

  /* ─── حذف تنوع محفوظ ─── */
  const handleDeleteSaved = async (variantId) => {
    setIsSaving(true);
    try {
      await deleteProductVariant(product.id, variantId);
      setSavedVariants((prev) => prev.filter((v) => v.id !== variantId));
    } catch (err) {
      setGlobalError(getApiErrorMessage(err, 'تعذّر حذف التنوع.'));
    } finally {
      setIsSaving(false);
    }
  };

  /* ─── هل زر الحفظ مُفعَّل? ─── */
  const canSave = useMemo(
    () =>
      !isSaving &&
      pendingRows.length > 0 &&
      attributes.length > 0 &&
      pendingRows.some((r) =>
        attributes.every((attr) => r.selections[attr.id]),
      ),
    [isSaving, pendingRows, attributes],
  );

  /* العناوين (أعمدة الخصائص + ثابتة) */
  const attrHeaders = attributes.map((attr) => attr.name);

  /* هل الجدول فارغ تماماً؟ */
  const hasAnyData = savedVariants.length > 0 || pendingRows.length > 0;

  if (!isOpen || !product) return null;

  return (
    <div className="modal-overlay variant-modal-overlay" onClick={onClose}>
      <div
        className="modal-content product-variant-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="vm-title-wrap">
            <Layers size={20} className="vm-icon" />
            <div>
              <h2 className="modal-title">تنوعات المنتج</h2>
              <p className="vm-subtitle">{product.name}</p>
            </div>
          </div>
          <button className="close-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="variant-modal-body">
          {loading ? (
            <p className="variant-loading">جاري تحميل التنوعات والخصائص...</p>
          ) : attributes.length === 0 ? (
            <p className="variant-empty">
              لا توجد خصائص متاحة بقيم. أضف خصائص (لون، مقاس، ...) من لوحة الإدارة أولاً.
            </p>
          ) : (
            <>
              {globalError && (
                <p className="form-error vm-global-error">{globalError}</p>
              )}

              <div className="vt-table-wrapper">
                <table className="vt-table">
                  <thead>
                    <tr>
                      {/* عمود لكل خاصية */}
                      {attrHeaders.map((name) => (
                        <th key={name} className="vt-th">{name}</th>
                      ))}
                      <th className="vt-th">السعر</th>
                      <th className="vt-th">الكمية الإجمالية</th>
                      <th className="vt-th">الشحنة الحالية</th>
                      <th className="vt-th"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* صفوف محفوظة */}
                    {savedVariants.map((variant) => (
                      <SavedRow
                        key={variant.id}
                        variant={variant}
                        attributes={attributes}
                        onDelete={handleDeleteSaved}
                        disabled={isSaving}
                      />
                    ))}

                    {/* فاصل إذا وجدت صفوف من النوعين */}
                    {savedVariants.length > 0 && pendingRows.length > 0 && (
                      <tr className="vt-separator">
                        <td
                          colSpan={attrHeaders.length + 4}
                          className="vt-separator-cell"
                        >
                          — صفوف جديدة —
                        </td>
                      </tr>
                    )}

                    {/* صفوف معلّقة */}
                    {pendingRows.map((row) => (
                      <PendingRow
                        key={row.id}
                        row={row}
                        attributes={attributes}
                        onChange={updateSelection}
                        onRemove={removeRow}
                        rowError={rowErrors[row.id]}
                        disabled={isSaving}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* أضف صف آخر */}
              <button
                type="button"
                className="vt-add-row-btn"
                onClick={addRow}
                disabled={isSaving}
              >
                <Plus size={15} />
                أضف صف آخر
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            className="cancel-button"
            onClick={onClose}
            type="button"
            disabled={isSaving}
          >
            {savedVariants.length || pendingRows.length ? 'إغلاق' : 'تخطّي'}
          </button>

          {attributes.length > 0 && (
            <button
              className="save-button variant-save-btn"
              onClick={handleSaveAll}
              type="button"
              disabled={!canSave}
            >
              <Save size={16} />
              {isSaving ? 'جاري الحفظ...' : 'حفظ التنوعات'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

class ProductVariantModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ProductVariantModal Error caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          right: '20px',
          background: '#fee2e2',
          border: '2px solid #ef4444',
          color: '#991b1b',
          padding: '24px',
          borderRadius: '12px',
          zIndex: 999999,
          direction: 'ltr',
          textAlign: 'left',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 'bold' }}>⚠️ ProductVariantModal Render Error:</h3>
          <p style={{ margin: '0 0 15px 0', fontFamily: 'monospace', fontSize: '14px' }}>{this.state.error?.message}</p>
          <pre style={{
            background: 'rgba(0,0,0,0.05)',
            padding: '12px',
            borderRadius: '6px',
            overflow: 'auto',
            fontSize: '12px',
            maxHeight: '300px',
            margin: 0
          }}>
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '15px',
              padding: '8px 16px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            حاول مجدداً
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProductVariantModalSafe = (props) => {
  return (
    <ProductVariantModalErrorBoundary>
      <ProductVariantModal {...props} />
    </ProductVariantModalErrorBoundary>
  );
};

export default ProductVariantModalSafe;
