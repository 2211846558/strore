import { useState, useEffect } from 'react';
import { X, Search, ChevronRight, ArrowRight, Package, Trash2 } from 'lucide-react';
import { fetchOrder } from '../../api/orders';
import {
  fetchPosInvoices,
  findCatalogProductByVariantId,
  fetchVariantStockPrice,
  fetchPosProductVariantsEnriched,
  getCatalogVariantDisplay,
  resolveOrderForPosAction,
  fetchReturnRequestsForOrder,
  describeEmptyOrderReason,
} from '../../api/pos';
import { buildVariantFullLabel, isWeakVariantFullLabel } from '../../utils/variantLabel';
import { getApiErrorMessage } from '../../api/stores';
import { getStatusBadgeClass } from '../../data/ordersData';
import {
  clampInteger,
  clampIntegerInput,
  isValidIntegerInput,
  parseIntegerInput,
  preventWheelChange,
} from '../../utils/numericInput';
import './SalesModals.css';

const toSalesLine = (order, product) => ({
  lineId: product.lineId ?? product.line_id ?? product.id,
  orderId: order.orderId ?? order.id,
  variantId: product.variantId ?? product.variant_id ?? product.product_variant_id ?? product.variant?.id,
  name: product.name ?? product.product_name ?? '—',
  quantity: product.quantity,
  price: product.price ?? product.unit_price ?? 0,
  sku: product.sku ?? product.variant?.sku ?? '',
  isPos: Boolean(order.isPos),
  variantLabel: product.color ?? product.variantLabel ?? product.sku ?? '',
  color: product.color ?? product.variantLabel ?? product.sku ?? '—',
  size: product.size ?? '—',
});

const PosOrderActionModal = ({
  isOpen,
  onClose,
  mode = 'return',
  storeId,
  products = [],
  onRefundConfirm,
  onExchangeConfirm,
  isSaving = false,
}) => {
  const [step, setStep] = useState('search');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedOldItems, setSelectedOldItems] = useState([]);
  const [exchangeQty, setExchangeQty] = useState('1');
  const [refundQty, setRefundQty] = useState('1');
  const [selectedNewItems, setSelectedNewItems] = useState([]);
  const [pickerProductId, setPickerProductId] = useState('');
  const [pickerVariantId, setPickerVariantId] = useState('');
  const [addItemQty, setAddItemQty] = useState('1');
  const [liveVariantPrice, setLiveVariantPrice] = useState(null);
  const [loadingVariantPrice, setLoadingVariantPrice] = useState(false);
  const [exchangeVariants, setExchangeVariants] = useState([]);
  const [loadingExchangeVariants, setLoadingExchangeVariants] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loadingOrderHistory, setLoadingOrderHistory] = useState(false);

  const isExchange = mode === 'exchange';
  const title = isExchange ? 'استبدال منتج' : 'استرجاع منتج';

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!isOpen) return;
    setStep('search');
    setSearch('');
    setDebouncedSearch('');
    setOrders([]);
    setOrdersError('');
    setSelectedOrder(null);
    setSelectedLine(null);
    setSelectedOldItems([]);
    setExchangeQty('1');
    setRefundQty('1');
    setSelectedNewItems([]);
    setPickerProductId('');
    setPickerVariantId('');
    setAddItemQty('1');
    setLiveVariantPrice(null);
    setExchangeVariants([]);
    setOrderHistory([]);
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen || !storeId || step !== 'search') return;

    let cancelled = false;
    setLoadingOrders(true);
    setOrdersError('');

    fetchPosInvoices({ storeId, search: debouncedSearch })
      .then((result) => {
        if (cancelled) return;
        setOrders(result.invoices ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setOrdersError(getApiErrorMessage(err, 'تعذّر البحث عن الطلبات'));
        setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, storeId, debouncedSearch, step]);

  const handleSelectOrder = async (invoice) => {
    setLoadingOrder(true);
    setOrdersError('');
    try {
      let detailOrder = null;
      try {
        detailOrder = await fetchOrder(invoice.orderId);
      } catch {
        detailOrder = null;
      }

      const order = resolveOrderForPosAction(invoice, detailOrder);

      if (!order.products?.length) {
        setOrdersError(describeEmptyOrderReason(order, invoice));
        setLoadingOrderHistory(true);
        try {
          const history = await fetchReturnRequestsForOrder(order.orderId ?? invoice.orderId);
          setOrderHistory(history);
        } catch {
          setOrderHistory([]);
        } finally {
          setLoadingOrderHistory(false);
        }
      } else {
        setOrderHistory([]);
      }

      setSelectedOrder(order);
      setStep('items');
    } catch (err) {
      setOrdersError(getApiErrorMessage(err, 'تعذّر تحميل تفاصيل الطلب'));
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleSelectLine = (product) => {
    if (!selectedOrder) return;
    const line = toSalesLine(selectedOrder, product);
    setSelectedLine(line);
    setExchangeQty(String(line.quantity || 1));
    setRefundQty(String(line.quantity || 1));
    setSelectedNewItems([]);
    setPickerProductId('');
    setPickerVariantId('');
    setAddItemQty('1');
    setLiveVariantPrice(null);
    setExchangeVariants([]);
    setStep('confirm');
  };

  const catalogProduct = selectedLine
    ? findCatalogProductByVariantId(products, selectedLine.variantId)
    : null;

  const pickerProduct = products.find((p) => String(p.id) === String(pickerProductId)) ?? null;

  const variantOptions = exchangeVariants.length
    ? exchangeVariants
    : (pickerProduct?.variants ?? []);

  useEffect(() => {
    if (!isOpen || step !== 'confirm' || !isExchange || !pickerProductId) {
      setExchangeVariants([]);
      return;
    }

    let cancelled = false;
    setLoadingExchangeVariants(true);
    setPickerVariantId('');
    setLiveVariantPrice(null);

    fetchPosProductVariantsEnriched(pickerProductId, {
      productName: pickerProduct?.name,
      catalogProduct: pickerProduct,
    })
      .then((variants) => {
        if (!cancelled) setExchangeVariants(variants);
      })
      .catch(() => {
        if (!cancelled) setExchangeVariants(pickerProduct?.variants ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoadingExchangeVariants(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, step, isExchange, pickerProductId, pickerProduct?.name]);

  const resolveLineDisplay = (line) => {
    if (!line) return '—';
    const fromCatalog = getCatalogVariantDisplay(
      exchangeVariants.length
        ? { ...catalogProduct, variants: exchangeVariants }
        : products,
      line.variantId,
      line.name,
    );
    if (fromCatalog) return fromCatalog;
    const fallback = buildVariantFullLabel(line.name, line.variantLabel);
    return isWeakVariantFullLabel(fallback, line.name) ? line.name : fallback;
  };

  const resolveVariantCardLabel = (variant, product = pickerProduct) => {
    if (variant.fullLabel && !isWeakVariantFullLabel(variant.fullLabel, product?.name)) {
      return variant.fullLabel;
    }
    return buildVariantFullLabel(product?.name, variant.label ?? variant, { variant });
  };
  const pickerVariant = variantOptions.find(
    (variant) => String(variant.id) === String(pickerVariantId),
  );

  useEffect(() => {
    if (!isExchange || !pickerVariant?.id || step !== 'confirm') {
      setLiveVariantPrice(null);
      return;
    }

    let cancelled = false;
    setLoadingVariantPrice(true);

    fetchVariantStockPrice(pickerVariant.id, { fallbackStock: pickerVariant.stock })
      .then(({ price }) => {
        if (!cancelled && price > 0) setLiveVariantPrice(price);
      })
      .catch(() => {
        if (!cancelled) setLiveVariantPrice(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingVariantPrice(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isExchange, pickerVariant?.id, step]);

  if (!isOpen) return null;

  const exchangeQtyNum = isExchange
    ? selectedOldItems.reduce((sum, item) => sum + item.quantitySelected, 0)
    : (selectedLine ? clampInteger(parseIntegerInput(exchangeQty, 1), 1, selectedLine.quantity) : 1);
  const refundQtyNum = selectedLine
    ? clampInteger(parseIntegerInput(refundQty, 1), 1, selectedLine.quantity)
    : 1;

  const pickerPrice = liveVariantPrice ?? pickerVariant?.price ?? 0;
  const pickerStock = pickerVariant?.stockUnknown
    ? 999
    : Number(pickerVariant?.stock ?? 0);
  const addItemQtyNum = clampInteger(
    parseIntegerInput(addItemQty, 1),
    1,
    Math.max(1, pickerStock),
  );
  const totalNewQty = selectedNewItems.reduce((sum, item) => sum + item.quantity, 0);
  const oldTotal = isExchange
    ? selectedOldItems.reduce((sum, item) => sum + item.price * item.quantitySelected, 0)
    : (selectedLine ? selectedLine.price * exchangeQtyNum : 0);
  const newTotal = selectedNewItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const priceDiff = newTotal - oldTotal;

  const isVariantInOldItems = isExchange
    ? selectedOldItems.some(item => String(item.variantId) === String(pickerVariant?.id))
    : (selectedLine?.variantId && String(pickerVariant?.id) === String(selectedLine.variantId));

  const canAddPickerVariant =
    pickerVariant
    && !isVariantInOldItems
    && (pickerVariant.stockUnknown || pickerVariant.stock > 0);

  const handleAddVariant = () => {
    if (!canAddPickerVariant || !pickerProduct) return;

    const price = pickerPrice;
    const stock = pickerVariant.stockUnknown ? null : pickerVariant.stock;

    setSelectedNewItems((prev) => {
      const existingIdx = prev.findIndex((item) => String(item.id) === String(pickerVariant.id));
      if (existingIdx > -1) {
        const updated = [...prev];
        const nextQty = updated[existingIdx].quantity + addItemQtyNum;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: pickerVariant.stockUnknown ? nextQty : Math.min(nextQty, stock),
          price,
          label: resolveVariantCardLabel(pickerVariant),
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: pickerVariant.id,
          variant: pickerVariant,
          product: pickerProduct,
          label: resolveVariantCardLabel(pickerVariant),
          price,
          quantity: pickerVariant.stockUnknown ? addItemQtyNum : Math.min(addItemQtyNum, stock),
          stock,
          stockUnknown: Boolean(pickerVariant.stockUnknown),
        },
      ];
    });

    setPickerVariantId('');
    setAddItemQty('1');
    setLiveVariantPrice(null);
  };

  const handlePickerProductChange = (productId) => {
    setPickerProductId(productId);
    setPickerVariantId('');
    setExchangeVariants([]);
    setAddItemQty('1');
    setLiveVariantPrice(null);
  };

  const updateItemQty = (variantId, delta) => {
    setSelectedNewItems((prev) =>
      prev.map((item) => {
        if (String(item.id) !== String(variantId)) return item;
        const nextQty = item.quantity + delta;
        if (nextQty < 1) return item;
        if (!item.stockUnknown && item.stock != null && nextQty > item.stock) return item;
        return { ...item, quantity: nextQty };
      }),
    );
  };

  const removeItem = (variantId) => {
    setSelectedNewItems((prev) => prev.filter((item) => String(item.id) !== String(variantId)));
  };

  const handleBack = () => {
    if (step === 'confirm') {
      if (isExchange) {
        setStep('items');
      } else {
        setSelectedLine(null);
        setStep('items');
      }
      return;
    }
    if (step === 'items') {
      setSelectedOrder(null);
      setSelectedOldItems([]);
      setStep('search');
    }
  };

  const handleRefund = () => {
    if (!selectedLine) return;
    onRefundConfirm?.(refundQtyNum, selectedLine);
  };

  const handleExchange = () => {
    if (isExchange) {
      if (selectedOldItems.length === 0 || selectedNewItems.length === 0) return;
      onExchangeConfirm?.(
        selectedNewItems,
        selectedOldItems.map(item => ({
          variantId: item.variantId,
          quantity: item.quantitySelected,
          price: item.price,
          name: item.name,
        })),
        { orderId: selectedOrder.orderId ?? selectedOrder.id, isPos: selectedOrder.isPos }
      );
    } else {
      if (!selectedLine || selectedNewItems.length === 0) return;
      onExchangeConfirm?.(selectedNewItems, exchangeQtyNum, selectedLine);
    }
  };

  return (
    <div className="sales-modal-overlay" onClick={() => !isSaving && onClose()}>
      <div
        className="sales-modal pos-order-action-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sales-modal-header">
          <div>
            <h2 className="sales-modal-title">{title}</h2>
            <p className="pos-action-step-label">
              {step === 'search' && 'ابحث عن طلب أونلاين أو مبيعات مباشرة'}
              {step === 'items' && `اختر القطعة من الطلب ${selectedOrder?.id ?? ''}`}
              {step === 'confirm' && (isExchange ? 'اختر المنتج البديل من المتجر' : 'تأكيد الاسترجاع')}
            </p>
          </div>
          <button
            type="button"
            className="sales-modal-close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="إغلاق"
          >
            <X size={24} />
          </button>
        </div>

        {step !== 'search' && (
          <button
            type="button"
            className="pos-action-back-btn"
            onClick={handleBack}
            disabled={isSaving || loadingOrder}
          >
            <ArrowRight size={16} />
            رجوع
          </button>
        )}

        {ordersError && <p className="sales-form-error">{ordersError}</p>}

        {step === 'search' && (
          <>
            <div className="pos-action-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="ابحث برقم الطلب أو اسم العميل..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {loadingOrders || loadingOrder ? (
              <p className="pos-action-empty">جاري البحث...</p>
            ) : orders.length === 0 ? (
              <p className="pos-action-empty">لا توجد طلبات مطابقة للبحث</p>
            ) : (
              <div className="pos-action-orders-list">
                {orders.map((invoice) => (
                  <button
                    key={invoice.orderId}
                    type="button"
                    className="pos-action-order-card"
                    onClick={() => handleSelectOrder(invoice)}
                    disabled={loadingOrder || isSaving}
                  >
                    <div className="pos-action-order-main">
                      <strong>{invoice.id}</strong>
                      <span>{invoice.date}</span>
                    </div>
                    <div className="pos-action-order-meta">
                      <span>{invoice.customer}</span>
                      <span className={`order-status-badge ${getStatusBadgeClass(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </div>
                    <div className="pos-action-order-footer">
                      <span className={`sales-invoice-type ${invoice.isPos ? 'pos' : 'online'}`}>
                        {invoice.typeLabel}
                      </span>
                      <span>{invoice.total} د.ل</span>
                      <ChevronRight size={16} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 'items' && selectedOrder && (
          <>
            <div className="pos-action-order-summary">
              <div>
                <span className="pos-action-summary-label">العميل</span>
                <strong>{selectedOrder.customerName}</strong>
              </div>
              <div>
                <span className="pos-action-summary-label">الإجمالي</span>
                <strong>{selectedOrder.total} د.ل</strong>
              </div>
            </div>

            <div className="pos-action-lines-list">
              {selectedOrder.products?.length ? (
                selectedOrder.products.map((product, idx) => {
                  const line = toSalesLine(selectedOrder, product);

                  if (isExchange) {
                    const isSelected = selectedOldItems.some((item) => String(item.variantId) === String(line.variantId));
                    const selectedItem = selectedOldItems.find((item) => String(item.variantId) === String(line.variantId));
                    const quantitySelected = selectedItem ? selectedItem.quantitySelected : 1;

                    const handleToggleSelect = () => {
                      if (isSelected) {
                        setSelectedOldItems(prev => prev.filter(item => String(item.variantId) !== String(line.variantId)));
                      } else {
                        setSelectedOldItems(prev => [...prev, {
                          ...line,
                          quantitySelected: 1,
                        }]);
                      }
                    };

                    const handleIncrement = (e) => {
                      e.stopPropagation();
                      setSelectedOldItems(prev => prev.map(item => {
                        if (String(item.variantId) === String(line.variantId)) {
                          const nextQty = Math.min(line.quantity, item.quantitySelected + 1);
                          return { ...item, quantitySelected: nextQty };
                        }
                        return item;
                      }));
                    };

                    const handleDecrement = (e) => {
                      e.stopPropagation();
                      setSelectedOldItems(prev => prev.map(item => {
                        if (String(item.variantId) === String(line.variantId)) {
                          const nextQty = Math.max(1, item.quantitySelected - 1);
                          return { ...item, quantitySelected: nextQty };
                        }
                        return item;
                      }));
                    };

                    return (
                      <div
                        key={line.lineId ?? `${line.variantId}-${idx}`}
                        className={`pos-action-line-card ${isSelected ? 'selected-item-card' : ''}`}
                        onClick={handleToggleSelect}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 16px',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(var(--primary-rgb), 0.05)' : 'var(--bg-input)',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={handleToggleSelect}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <div className="pos-action-line-info" style={{ flex: 1 }}>
                          <strong style={{ display: 'block', fontSize: '14px' }}>
                            {resolveLineDisplay(product)}
                          </strong>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            الكمية المتاحة: {product.quantity}
                            {product.price > 0 ? ` — ${product.price} د.ل` : ''}
                          </span>
                        </div>
                        {isSelected && (
                          <div 
                            className="pos-action-qty-controls" 
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <button
                              type="button"
                              className="sales-btn-secondary"
                              style={{ padding: '2px 8px', minWidth: '28px' }}
                              onClick={handleDecrement}
                              disabled={quantitySelected <= 1}
                            >
                              -
                            </button>
                            <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold' }}>
                              {quantitySelected}
                            </span>
                            <button
                              type="button"
                              className="sales-btn-secondary"
                              style={{ padding: '2px 8px', minWidth: '28px' }}
                              onClick={handleIncrement}
                              disabled={quantitySelected >= line.quantity}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <button
                        key={product.lineId ?? `${product.variantId}-${idx}`}
                        type="button"
                        className="pos-action-line-card"
                        onClick={() => handleSelectLine(product)}
                        disabled={isSaving}
                      >
                        <div className="pos-action-line-icon">
                          <Package size={18} />
                        </div>
                        <div className="pos-action-line-info">
                          <strong>
                            {resolveLineDisplay(product)}
                          </strong>
                          <span>
                            الكمية: {product.quantity}
                            {product.price > 0 ? ` — ${product.price} د.ل` : ''}
                          </span>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    );
                  }
                })
              ) : (
                <div className="pos-action-empty-block">
                  <p className="pos-action-empty">
                    {ordersError || 'لا توجد قطع في هذا الطلب'}
                  </p>
                  {loadingOrderHistory ? (
                    <p className="pos-action-empty-hint">جاري تحميل سجل العمليات...</p>
                  ) : orderHistory.length > 0 ? (
                    <div className="pos-action-history">
                      <p className="pos-action-empty-hint">سجل العمليات السابقة على هذا الطلب:</p>
                      <ul className="pos-action-history-list">
                        {orderHistory.map((entry) => {
                          const name = entry.product_variant?.product?.name ?? '—';
                          const actionLabel = entry.action_type === 'replacement' ? 'استبدال' : 'استرجاع';
                          return (
                            <li key={entry.id}>
                              {actionLabel}: {name} (×{entry.quantity})
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {isExchange && (
              <div className="sales-modal-footer" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="sales-btn-primary"
                  onClick={() => setStep('confirm')}
                  disabled={selectedOldItems.length === 0}
                >
                  متابعة الاستبدال ({selectedOldItems.length} قطع مختارة)
                </button>
                <button type="button" className="sales-btn-secondary" onClick={onClose}>
                  إلغاء
                </button>
              </div>
            )}
          </>
        )}

        {step === 'confirm' && selectedLine && !isExchange && (
          <>
            <div className="sales-policy-box">
              <span className="sales-policy-icon">!</span>
              <div>
                <p className="sales-policy-title">سياسة الاسترجاع</p>
                <p className="sales-policy-text">يمكن استرجاع المنتجات خلال 14 يوماً من تاريخ الشراء</p>
              </div>
            </div>
            <div className="sales-refund-details">
              <p className="sales-refund-label">القطعة المحددة</p>
              <p className="sales-refund-name">
                {resolveLineDisplay(selectedLine)}
              </p>
              <p className="sales-refund-meta">
                الكمية المشتراة: {selectedLine.quantity}
              </p>
              {selectedLine.quantity > 1 && (
                <div className="sales-form-group" style={{ marginTop: '12px' }}>
                  <label htmlFor="pos-refund-qty" style={{ fontSize: '13px', fontWeight: 'bold' }}>
                    الكمية المراد استرجاعها:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="sales-btn-secondary"
                      style={{ padding: '6px 12px', minWidth: '40px' }}
                      onClick={() => setRefundQty(String(Math.max(1, refundQtyNum - 1)))}
                      disabled={refundQtyNum <= 1 || isSaving}
                    >
                      -
                    </button>
                    <input
                      id="pos-refund-qty"
                      type="text"
                      inputMode="numeric"
                      className="sales-form-input"
                      style={{ textAlign: 'center', width: '80px', padding: '6px 12px' }}
                      value={refundQty}
                      onChange={(e) => {
                        if (isValidIntegerInput(e.target.value)) setRefundQty(e.target.value);
                      }}
                      onBlur={() => setRefundQty(clampIntegerInput(refundQty, 1, selectedLine.quantity))}
                      onWheel={preventWheelChange}
                      disabled={isSaving}
                    />
                    <button
                      type="button"
                      className="sales-btn-secondary"
                      style={{ padding: '6px 12px', minWidth: '40px' }}
                      onClick={() => setRefundQty(String(Math.min(selectedLine.quantity, refundQtyNum + 1)))}
                      disabled={refundQtyNum >= selectedLine.quantity || isSaving}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
              <p className="sales-refund-amount" style={{ marginTop: '12px' }}>
                - {selectedLine.price * refundQtyNum} د.ل
              </p>
            </div>
            <div className="sales-modal-footer">
              <button
                type="button"
                className="sales-btn-primary"
                onClick={handleRefund}
                disabled={isSaving}
              >
                {isSaving ? 'جاري الاسترجاع...' : 'تأكيد الاسترجاع'}
              </button>
              <button type="button" className="sales-btn-secondary" onClick={onClose} disabled={isSaving}>
                إلغاء
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && isExchange && (
          <>
            <div className="sales-old-product-box" style={{ maxHeight: '180px', overflowY: 'auto' }}>
              <p className="sales-refund-label">القطع المراد استبدالها</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {selectedOldItems.map((item) => (
                  <div
                    key={item.variantId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--bg-input)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ textAlign: 'right', flex: 1 }}>
                      <strong style={{ fontSize: '13px', display: 'block' }}>{item.name}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        السعر: {item.price} د.ل | الكمية المتاحة: {item.quantity}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="sales-btn-secondary"
                        style={{ padding: '2px 8px', minWidth: '28px', cursor: 'pointer' }}
                        onClick={() => {
                          const nextQty = Math.max(1, item.quantitySelected - 1);
                          setSelectedOldItems(prev => prev.map(o => o.variantId === item.variantId ? { ...o, quantitySelected: nextQty } : o));
                        }}
                        disabled={item.quantitySelected <= 1 || isSaving}
                      >
                        -
                      </button>
                      <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>
                        {item.quantitySelected}
                      </span>
                      <button
                        type="button"
                        className="sales-btn-secondary"
                        style={{ padding: '2px 8px', minWidth: '28px', cursor: 'pointer' }}
                        onClick={() => {
                          const nextQty = Math.min(item.quantity, item.quantitySelected + 1);
                          setSelectedOldItems(prev => prev.map(o => o.variantId === item.variantId ? { ...o, quantitySelected: nextQty } : o));
                        }}
                        disabled={item.quantitySelected >= item.quantity || isSaving}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {products.length === 0 ? (
              <p className="pos-action-empty">
                لا توجد منتجات متاحة في المتجر حالياً.
              </p>
            ) : (
              <>
                <div className="sales-form-group">
                  <label htmlFor="picker-product-select">المنتج البديل</label>
                  <select
                    id="picker-product-select"
                    className="sales-form-select"
                    value={pickerProductId}
                    onChange={(e) => handlePickerProductChange(e.target.value)}
                    disabled={isSaving}
                  >
                    <option value="">اختر منتجاً من المتجر</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} — {product.price} د.ل
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sales-form-group">
                  <label className="pos-action-variants-title">
                    القطع البديلة المحددة ({totalNewQty} قطعة):
                  </label>
                  {selectedNewItems.length === 0 ? (
                    <div className="pos-action-selected-empty">
                      لم تُضف قطع بديلة بعد. يمكنك استبدال قطعة واحدة بعدة قطع أو العكس.
                    </div>
                  ) : (
                    <div className="pos-action-selected-list">
                      {selectedNewItems.map((item) => (
                        <div key={item.id} className="pos-action-selected-item">
                          <div className="pos-action-selected-info">
                            <strong>{item.label}</strong>
                            <span>
                              {item.stockUnknown ? 'متوفر' : `${item.stock} قطعة متبقية`}
                            </span>
                          </div>
                          <div className="pos-action-selected-controls">
                            <div className="pos-action-qty-controls">
                              <button
                                type="button"
                                className="sales-btn-secondary"
                                onClick={() => updateItemQty(item.id, -1)}
                                disabled={item.quantity <= 1 || isSaving}
                              >
                                -
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                type="button"
                                className="sales-btn-secondary"
                                onClick={() => updateItemQty(item.id, 1)}
                                disabled={
                                  isSaving
                                  || (!item.stockUnknown && item.stock != null && item.quantity >= item.stock)
                                }
                              >
                                +
                              </button>
                            </div>
                            <strong className="pos-action-selected-price">
                              {item.price * item.quantity} د.ل
                            </strong>
                            <button
                              type="button"
                              className="pos-action-remove-item"
                              onClick={() => removeItem(item.id)}
                              disabled={isSaving}
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

                {pickerProductId ? (
                  <>
                    <p className="pos-action-variants-title">
                      اختر تنوع «{pickerProduct?.name}»:
                    </p>
                    {loadingExchangeVariants ? (
                      <p className="pos-action-empty">جاري تحميل تنوعات المنتج...</p>
                    ) : variantOptions.length === 0 ? (
                      <p className="pos-action-empty">لا توجد تنوعات متاحة لهذا المنتج.</p>
                    ) : (
                      <div className="pos-action-variants-list">
                        {variantOptions.map((variant) => {
                          const isCurrent = variant.id && (isExchange
                            ? selectedOldItems.some(item => String(item.variantId) === String(variant.id))
                            : selectedLine?.variantId && String(variant.id) === String(selectedLine.variantId));
                          const isSelected = String(variant.id) === String(pickerVariantId);
                          const outOfStock = !variant.stockUnknown && variant.stock <= 0;

                          return (
                            <button
                              key={variant.id}
                              type="button"
                              className={`pos-action-variant-card${isSelected ? ' selected' : ''}${isCurrent ? ' current' : ''}`}
                              onClick={() => !isCurrent && !outOfStock && setPickerVariantId(String(variant.id))}
                              disabled={isCurrent || outOfStock || isSaving}
                            >
                              <div className="pos-action-variant-label">
                                {resolveVariantCardLabel(variant)}
                              </div>
                              <div className="pos-action-variant-meta">
                                <span>{variant.price} د.ل</span>
                                <span>
                                  {isCurrent
                                    ? 'التنوع الحالي'
                                    : outOfStock
                                      ? 'غير متوفر'
                                      : variant.stockUnknown
                                        ? 'متوفر'
                                        : `${variant.stock} قطعة`}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {pickerVariant && (
                      <div className="pos-action-add-variant">
                        {loadingVariantPrice ? (
                          <p className="pos-action-variant-hint">جاري جلب السعر والمخزون...</p>
                        ) : (
                          <p className="pos-action-variant-hint">
                            الكمية المتوفرة:{' '}
                            {pickerVariant.stockUnknown ? 'غير محددة' : `${pickerStock} قطعة`}
                          </p>
                        )}
                        <div className="pos-action-add-variant-row">
                          <div className="sales-form-group pos-action-add-qty">
                            <label htmlFor="pos-add-item-qty">كمية البديل:</label>
                            <div className="pos-action-qty-controls">
                              <button
                                type="button"
                                className="sales-btn-secondary"
                                onClick={() => setAddItemQty(String(Math.max(1, addItemQtyNum - 1)))}
                                disabled={addItemQtyNum <= 1 || isSaving}
                              >
                                -
                              </button>
                              <input
                                id="pos-add-item-qty"
                                type="text"
                                inputMode="numeric"
                                className="sales-form-input"
                                value={addItemQty}
                                onChange={(e) => {
                                  if (isValidIntegerInput(e.target.value)) setAddItemQty(e.target.value);
                                }}
                                onBlur={() => setAddItemQty(clampIntegerInput(addItemQty, 1, pickerStock))}
                                onWheel={preventWheelChange}
                                disabled={isSaving}
                              />
                              <button
                                type="button"
                                className="sales-btn-secondary"
                                onClick={() => setAddItemQty(String(Math.min(pickerStock, addItemQtyNum + 1)))}
                                disabled={
                                  isSaving
                                  || (!pickerVariant.stockUnknown && addItemQtyNum >= pickerStock)
                                }
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="sales-btn-primary"
                            onClick={handleAddVariant}
                            disabled={!canAddPickerVariant || isSaving || loadingVariantPrice}
                          >
                            إضافة البديل
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="pos-action-empty">اختر منتجاً من القائمة أعلاه لعرض تنوعاته.</p>
                )}
              </>
            )}

            {selectedNewItems.length > 0 && (
              <>
                <div className="pos-action-qty-summary">
                  <span>القطع القديمة للاستبدال: {exchangeQtyNum}</span>
                  <span>القطع البديلة المحددة: {totalNewQty}</span>
                </div>
                <div className={`sales-exchange-diff ${priceDiff > 0 ? 'pay' : priceDiff < 0 ? 'refund' : 'equal'}`}>
                  <div className="sales-exchange-diff-rows">
                    <div className="sales-exchange-diff-row">
                      <span>إجمالي القطع القديمة ({exchangeQtyNum}):</span>
                      <strong>{oldTotal} د.ل</strong>
                    </div>
                    <div className="sales-exchange-diff-row">
                      <span>إجمالي القطع البديلة ({totalNewQty}):</span>
                      <strong>{newTotal} د.ل</strong>
                    </div>
                  </div>
                  <p className="sales-exchange-diff-title">
                    {priceDiff < 0 ? 'مبلغ يُسترد للعميل' : priceDiff > 0 ? 'مبلغ إضافي على العميل' : 'فرق السعر'}
                  </p>
                  <p className="sales-exchange-diff-amount">{Math.abs(priceDiff)} د.ل</p>
                </div>
              </>
            )}

            <div className="sales-modal-footer">
              <button
                type="button"
                className="sales-btn-primary"
                onClick={handleExchange}
                disabled={selectedNewItems.length === 0 || isSaving}
              >
                {isSaving ? 'جاري الاستبدال...' : 'تأكيد الاستبدال'}
              </button>
              <button type="button" className="sales-btn-secondary" onClick={onClose} disabled={isSaving}>
                إلغاء
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PosOrderActionModal;
