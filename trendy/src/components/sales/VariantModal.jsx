import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  getVariantStock,
  resolveVariant,
  fetchVariantStockPrice,
} from '../../api/pos';
import ExchangePriceDiff from './ExchangePriceDiff';
import SalesProductThumb from './SalesProductThumb';
import './SalesModals.css';

const VariantModal = ({ isOpen, onClose, product, onAdd, isSaving, exchangeFrom, storeId, storeProducts = [] }) => {
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [liveStock, setLiveStock] = useState(null);
  const [livePrice, setLivePrice] = useState(null);
  const [loadingStock, setLoadingStock] = useState(false);

  const activeProduct = product;
  const useDirectSelection = Boolean(activeProduct?.useDirectSelection);
  const variantOptions = activeProduct?.variantOptions ?? [];

  useEffect(() => {
    if (!isOpen || !product?.id) {
      setColor('');
      setSize('');
      setSelectedVariantId('');
      setLiveStock(null);
      setLivePrice(null);
      return;
    }

    if (product.useDirectSelection) {
      setSelectedVariantId(
        product.variantOptions?.length === 1 ? String(product.variantOptions[0].id) : '',
      );
    } else {
      setColor(product.colors?.length === 1 ? product.colors[0] : '');
      setSize(product.sizes?.length === 1 ? product.sizes[0] : '');
    }
  }, [isOpen, product]);

  const hideSizeField =
    !useDirectSelection &&
    activeProduct?.sizes?.length === 1 &&
    activeProduct.sizes[0] === 'واحد';
  const effectiveSize = hideSizeField ? activeProduct?.sizes?.[0] || 'واحد' : size;
  const variant = useDirectSelection
    ? activeProduct?.variants?.find((v) => String(v.id) === String(selectedVariantId)) ?? null
    : activeProduct
      ? resolveVariant(activeProduct, color, effectiveSize || size)
      : null;
  const baseStock = useDirectSelection
    ? Number(variant?.stock ?? 0)
    : activeProduct
      ? getVariantStock(activeProduct, color, effectiveSize || size)
      : 0;
  const stock =
    liveStock != null && liveStock > 0
      ? liveStock
      : baseStock;
  const price = livePrice ?? variant?.price ?? activeProduct?.price;
  const selectionReady = useDirectSelection
    ? Boolean(selectedVariantId)
    : Boolean(color && (hideSizeField || size));
  const canAdd =
    selectionReady &&
    variant &&
    (stock > 0 || variant?.stockUnknown) &&
    !isSaving;
  const isExchange = Boolean(exchangeFrom);

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

    return () => {
      cancelled = true;
    };
  }, [variant?.id, selectionReady, useDirectSelection, color, size, hideSizeField]);

  if (!isOpen || !activeProduct) return null;

  const handleAdd = async () => {
    if (!canAdd) return;
    await onAdd({
      product: activeProduct,
      color: useDirectSelection ? variant?.color ?? '—' : color,
      size: useDirectSelection ? variant?.size ?? '—' : effectiveSize,
      price,
      variant,
    });
    if (!isExchange) onClose();
  };

  return (
    <div className="sales-modal-overlay" onClick={onClose}>
      <div className="sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-header">
          <h2 className="sales-modal-title">
            {isExchange ? 'اختيار متغير المنتج الجديد' : 'اختيار متغير المنتج'}
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
          />
          <p className="sales-modal-product-name">{activeProduct?.name ?? product.name}</p>
          <p className="sales-modal-product-price">{price} د.ل</p>
        </div>

        {useDirectSelection ? (
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
          <>
            <div className="sales-form-group">
              <label htmlFor="variant-color">اللون</label>
              <select
                id="variant-color"
                className="sales-form-select"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={!activeProduct?.colors?.length}
              >
                <option value="">اختر اللون</option>
                {(activeProduct?.colors ?? []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {!hideSizeField && (
              <div className="sales-form-group">
                <label htmlFor="variant-size">المقاس</label>
                <select
                  id="variant-size"
                  className="sales-form-select"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  disabled={!activeProduct?.sizes?.length}
                >
                  <option value="">اختر المقاس</option>
                  {(activeProduct?.sizes ?? []).map((s) => (
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
              : `الكمية المتوفرة: ${variant?.stockUnknown && liveStock == null ? '—' : stock} قطعة`}
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
    </div>
  );
};

export default VariantModal;
