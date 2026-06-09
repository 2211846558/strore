import React, { useState, useEffect, useMemo } from 'react';
import { X, Layers, Plus } from 'lucide-react';
import { fetchAttributes, createProductVariant } from '../../api/products';
import { getApiErrorMessage } from '../../api/stores';
import './ProductVariantModal.css';

function buildSuggestedSku(product, selectedByAttribute, attributes) {
  const parts = attributes
    .map((attr) => {
      const valueId = selectedByAttribute[attr.id];
      const value = attr.values.find((v) => v.id === Number(valueId));
      return value?.value?.replace(/\s+/g, '-');
    })
    .filter(Boolean);

  const suffix = parts.length ? parts.join('-') : 'VAR';
  return `P${product.id}-${suffix}`.slice(0, 255);
}

const ProductVariantModal = ({ isOpen, onClose, product, storeId, onVariantAdded }) => {
  const [attributes, setAttributes] = useState([]);
  const [loadingAttrs, setLoadingAttrs] = useState(false);
  const [selectedByAttribute, setSelectedByAttribute] = useState({});
  const [sku, setSku] = useState('');
  const [addedVariants, setAddedVariants] = useState([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !product) return;

    setSelectedByAttribute({});
    setSku('');
    setAddedVariants([]);
    setError('');
    setLoadingAttrs(true);

    fetchAttributes()
      .then(setAttributes)
      .catch(() => {
        setAttributes([]);
        setError('تعذّر تحميل الخصائص المتاحة.');
      })
      .finally(() => setLoadingAttrs(false));
  }, [isOpen, product?.id]);

  const selectedValueIds = useMemo(
    () =>
      Object.values(selectedByAttribute)
        .filter(Boolean)
        .map((id) => Number(id)),
    [selectedByAttribute],
  );

  const usableAttributes = useMemo(
    () => attributes.filter((attr) => attr.values?.length > 0),
    [attributes],
  );

  const missingSelections = useMemo(
    () => usableAttributes.filter((attr) => !selectedByAttribute[attr.id]),
    [usableAttributes, selectedByAttribute],
  );

  const canSubmit = useMemo(() => {
    if (!sku.trim() || !selectedValueIds.length) return false;
    if (!usableAttributes.length) return false;
    return usableAttributes.every((attr) => selectedByAttribute[attr.id]);
  }, [sku, selectedValueIds, usableAttributes, selectedByAttribute]);

  const submitHint = useMemo(() => {
    if (loadingAttrs) return '';
    if (!attributes.length) return 'لا توجد خصائص في الكتالوج. أضفها من لوحة الإدارة أولاً.';
    if (!usableAttributes.length) {
      return 'الخصائص موجودة لكن بدون قيم (مثل أحمر، XL). أضف القيم من لوحة الإدارة.';
    }
    if (missingSelections.length) {
      const names = missingSelections.map((a) => a.name).join('، ');
      return `اختر قيمة من القائمة: ${names}`;
    }
    if (!sku.trim()) return 'أدخل رمز SKU أو اختر كل الخصائص ليُولَّد تلقائياً.';
    return '';
  }, [loadingAttrs, attributes, usableAttributes, missingSelections, sku]);

  useEffect(() => {
    if (!product || !usableAttributes.length) return;
    const allSelected = usableAttributes.every((attr) => selectedByAttribute[attr.id]);
    if (allSelected) {
      setSku(buildSuggestedSku(product, selectedByAttribute, usableAttributes));
    }
  }, [product, usableAttributes, selectedByAttribute]);

  if (!isOpen || !product) return null;

  const handleAttributeChange = (attributeId, valueId) => {
    setSelectedByAttribute((prev) => ({ ...prev, [attributeId]: valueId }));
    setError('');
  };

  const handleAddVariant = async () => {
    if (!canSubmit) {
      setError('يرجى اختيار قيمة لكل خاصية وإدخال رمز SKU.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const created = await createProductVariant(product.id, {
        storeId,
        sku: sku.trim(),
        attributeValueIds: selectedValueIds,
      });

      const label = created.attribute_values
        ?.map((v) => v.value)
        .join(' / ') || sku.trim();

      setAddedVariants((prev) => [...prev, { id: created.id, sku: created.sku, label }]);
      setSelectedByAttribute({});
      setSku('');
      onVariantAdded?.(created);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر إضافة التنوع.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay variant-modal-overlay" onClick={onClose}>
      <div className="modal-content product-variant-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">إضافة تنوع المنتج</h2>
          <button className="close-button" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        <div className="variant-modal-body">
          <div className="variant-product-info">
            <Layers size={18} />
            <div>
              <p className="variant-product-name">{product.name}</p>
              <p className="variant-product-hint">
                1) اختر من كل قائمة (لون، مقاس، ...) — 2) SKU يتولّد لوحده — 3) اضغط «إضافة التنوع»
              </p>
            </div>
          </div>

          {loadingAttrs ? (
            <p className="variant-loading">جاري تحميل الخصائص...</p>
          ) : attributes.length === 0 ? (
            <p className="variant-empty">لا توجد خصائص متاحة في الكتالوج. أضف خصائص من لوحة الإدارة أولاً.</p>
          ) : (
            <>
              {attributes.map((attr) => (
                <div key={attr.id} className="form-group">
                  <label>{attr.name}</label>
                  {attr.values?.length ? (
                    <select
                      value={selectedByAttribute[attr.id] || ''}
                      onChange={(e) => handleAttributeChange(attr.id, e.target.value)}
                      className={!selectedByAttribute[attr.id] ? 'variant-select-required' : ''}
                    >
                      <option value="">— اختر {attr.name} —</option>
                      {attr.values.map((v) => (
                        <option key={v.id} value={String(v.id)}>
                          {v.value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="variant-no-values">
                      لا توجد قيم لهذه الخاصية. أضف قيم (مثل أحمر، M) من لوحة الإدارة.
                    </p>
                  )}
                </div>
              ))}

              <div className="form-group">
                <label>رمز SKU (اختياري — يتولّد بعد اختيار الخصائص)</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="مثال: P12-أحمر-XL"
                />
              </div>
            </>
          )}

          {!loadingAttrs && submitHint && !error && (
            <p className="variant-submit-hint">{submitHint}</p>
          )}

          {addedVariants.length > 0 && (
            <div className="added-variants-list">
              <p className="added-variants-title">التنوعات المضافة ({addedVariants.length})</p>
              {addedVariants.map((v) => (
                <div key={v.id} className="added-variant-item">
                  <span>{v.label}</span>
                  <span className="added-variant-sku">{v.sku}</span>
                </div>
              ))}
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} type="button" disabled={isSaving}>
            {addedVariants.length ? 'تم' : 'تخطّي'}
          </button>
          {usableAttributes.length > 0 && (
            <button
              className="save-button variant-add-btn"
              onClick={handleAddVariant}
              type="button"
              disabled={isSaving || !canSubmit}
            >
              <Plus size={16} />
              {isSaving ? 'جاري الإضافة...' : 'إضافة التنوع'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductVariantModal;
