import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  fetchVariantStockPrice,
  resolveVariantByAttributes,
} from '../../api/pos';
import ExchangePriceDiff from './ExchangePriceDiff';
import SalesProductThumb from './SalesProductThumb';
import { buildCandidates } from '../../utils/salesImageHelper';
import ProductImageLightbox from './ProductImageLightbox';
import {
  clampInteger,
  clampIntegerInput,
  isValidIntegerInput,
  parseIntegerInput,
  preventWheelChange,
} from '../../utils/numericInput';
import './SalesModals.css';

const VariantModal = ({ isOpen, onClose, product, onAdd, isSaving, exchangeFrom, storeId, storeProducts = [] }) => {
  // selectedAttrs: { [attrName]: value }
  const [selectedAttrs, setSelectedAttrs] = useState({});
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [liveStock, setLiveStock] = useState(null);
  const [livePrice, setLivePrice] = useState(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState('1');

  const activeProduct = product;
  const useDirectSelection = Boolean(activeProduct?.useDirectSelection);
  const variantOptions = activeProduct?.variantOptions ?? [];
  const attributeGroups = activeProduct?.attributeGroups ?? [];

  // إعادة ضبط الحالة عند فتح المودال أو تغيير المنتج
  useEffect(() => {
    if (!isOpen || !product?.id) {
      setSelectedAttrs({});
      setSelectedVariantId('');
      setLiveStock(null);
      setLivePrice(null);
      setActiveImageIndex(0);
      setQuantity('1');
      return;
    }

    setQuantity('1');
    if (useDirectSelection) {
      setSelectedVariantId(
        product.variantOptions?.length === 1 ? String(product.variantOptions[0].id) : '',
      );
    } else {
      // إذا كانت قيمة خاصية ما واحدة فقط، نختارها تلقائياً
      const autoAttrs = {};
      attributeGroups.forEach((group) => {
        if (group.values.length === 1) {
          autoAttrs[group.name] = group.values[0];
        }
      });
      setSelectedAttrs(autoAttrs);
    }
  }, [isOpen, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // إيجاد التنوع المطابق
  const variant = useDirectSelection
    ? activeProduct?.variants?.find((v) => String(v.id) === String(selectedVariantId)) ?? null
    : activeProduct
      ? resolveVariantByAttributes(activeProduct, selectedAttrs)
      : null;

  // التحقق من اكتمال الاختيار (جميع الخصائص محددة)
  const selectionReady = useDirectSelection
    ? Boolean(selectedVariantId)
    : attributeGroups.length > 0 &&
      attributeGroups.every((g) => Boolean(selectedAttrs[g.name]));

  const baseStock = selectionReady && variant ? Number(variant.stock ?? 0) : 0;
  const stock = liveStock != null && liveStock > 0 ? liveStock : baseStock;
  const price = livePrice ?? variant?.price ?? activeProduct?.price;

  const isExchange = Boolean(exchangeFrom);
  const maxQty = variant?.stockUnknown ? 9999 : stock;
  const qtyNum = clampInteger(parseIntegerInput(quantity, 1), 1, maxQty);

  const canAdd =
    selectionReady &&
    variant &&
    (stock >= qtyNum || variant?.stockUnknown) &&
    qtyNum > 0 &&
    !isSaving;

  // تسمية الاختيارات المحددة
  const selectedAttrsLabel = selectionReady
    ? useDirectSelection
      ? (variant?.label ?? '')
      : Object.values(selectedAttrs).filter((v) => v && v !== '—' && v !== 'واحد').join(' / ')
    : '';

  // جلب الكمية والسعر الحية
  useEffect(() => {
    if (!variant?.id || !selectionReady) {
      setLiveStock(null);
      setLivePrice(null);
      return;
    }

    let cancelled = false;
    setLoadingStock(true);

    fetchVariantStockPrice(variant.id, { fallbackStock: variant.stock })
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

    return () => { cancelled = true; };
  }, [variant?.id, selectionReady]);

  if (!isOpen || !activeProduct) return null;

  const handleAttrChange = (attrName, value) => {
    setSelectedAttrs((prev) => ({ ...prev, [attrName]: value }));
  };

  const handleAdd = async () => {
    if (!canAdd) return;
    await onAdd({
      product: activeProduct,
      color: variant?.color ?? '—',
      size: variant?.size ?? '—',
      attributes: useDirectSelection ? (variant?.attributes ?? {}) : selectedAttrs,
      price,
      variant,
      quantity: qtyNum,
    });
    if (!isExchange) onClose();
  };

  return (
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-header">
          <h2 className="sales-modal-title">
            {isExchange ? 'اختيار خصائص المنتج الجديد' : 'اختيار خصائص المنتج'}
          </h2>
          <button type="button" className="sales-modal-close" onClick={onClose} aria-label="إغلاق">
            <X size={24} />
          </button>
        </div>
        <div className="sales-modal-product-preview">
          <SalesProductThumb
            item={activeProduct ?? product}
            storeProducts={storeProducts}
            wrapperClassName="sales-modal-product-preview-image"
            alt={activeProduct?.name ?? product?.name}
            onClick={() => setIsLightboxOpen(true)}
            enableNavigation={true}
            currentIndex={activeImageIndex}
            onIndexChange={setActiveImageIndex}
          />
          <p className="sales-modal-product-name">{activeProduct?.name ?? product.name}</p>
          {selectedAttrsLabel && (
            <p className="sales-modal-variant-label">{selectedAttrsLabel}</p>
          )}
          <p className="sales-modal-product-price">{price} د.ل</p>
        </div>

        {useDirectSelection ? (
          /* ─── اختيار مباشر (تنوع واحد أو لا خصائص متعددة) ───────────── */
          <div className="sales-form-group">
            <label htmlFor="variant-direct">التنوع</label>
            <select
              id="variant-direct"
              className="sales-form-select"
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              disabled={!variantOptions.length}
            >
              <option value="">اختر التنوع</option>
              {variantOptions.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          /* ─── dropdown لكل خاصية ديناميكياً ─────────────────────────── */
          <>
            {attributeGroups.map((group, idx) => (
              <div className="sales-form-group" key={group.name}>
                <label htmlFor={`variant-attr-${idx}`}>{group.name}</label>
                <select
                  id={`variant-attr-${idx}`}
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
          <div className="sales-stock-box">
            {loadingStock
              ? 'جاري جلب الكمية المتوفرة...'
              : `الكمية المتوفرة: ${variant?.stockUnknown && liveStock == null ? '—' : stock} قطعة`}
          </div>
        )}

        {selectionReady && !isExchange && (stock > 0 || variant?.stockUnknown) && (
          <div className="sales-form-group" style={{ marginTop: '12px' }}>
            <label htmlFor="modal-qty" style={{ fontSize: '13px', fontWeight: 'bold' }}>
              الكمية المطلوبة:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                className="sales-btn-secondary"
                style={{ padding: '6px 12px', minWidth: '40px', cursor: 'pointer' }}
                onClick={() => setQuantity(String(Math.max(1, qtyNum - 1)))}
                disabled={qtyNum <= 1 || isSaving}
              >
                -
              </button>
              <input
                id="modal-qty"
                type="text"
                inputMode="numeric"
                className="sales-form-input"
                style={{ textAlign: 'center', width: '80px', padding: '6px 12px', cursor: 'default' }}
                value={quantity}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (isValidIntegerInput(raw)) setQuantity(raw);
                }}
                onBlur={() => setQuantity(clampIntegerInput(quantity, 1, maxQty))}
                onWheel={preventWheelChange}
                disabled={isSaving}
              />
              <button
                type="button"
                className="sales-btn-secondary"
                style={{ padding: '6px 12px', minWidth: '40px', cursor: 'pointer' }}
                onClick={() => setQuantity(String(Math.min(maxQty, qtyNum + 1)))}
                disabled={(qtyNum >= maxQty && !variant?.stockUnknown) || isSaving}
              >
                +
              </button>
            </div>
          </div>
        )}

        {isExchange && activeProduct && (
          <ExchangePriceDiff
            oldUnitPrice={exchangeFrom.oldPrice}
            quantity={exchangeFrom.quantity}
            newUnitPrice={price}
          />
        )}
        <div className="sales-modal-footer">
          <button type="button" className="sales-btn-primary" onClick={handleAdd} disabled={!canAdd}>
            {isSaving ? 'جاري المعالجة...' : isExchange ? 'تأكيد التبديل' : 'إضافة للسلة'}
          </button>
          <button type="button" className="sales-btn-secondary" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>

      {isLightboxOpen && (
        <ProductImageLightbox
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          images={activeProduct ? buildCandidates(activeProduct, storeProducts) : []}
          productName={activeProduct?.name ?? product?.name}
          initialIndex={activeImageIndex}
          onIndexChange={setActiveImageIndex}
        />
      )}
    </div>
  );
};

export default VariantModal;
