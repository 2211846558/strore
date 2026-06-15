import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingCart,
  FileText,
  Search,
  Trash2,
  Plus,
  CheckCircle2,
  RotateCcw,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import {
  fetchPosCatalog,
  fetchPosCart,
  addToPosCart,
  removeFromPosCart,
  checkoutPosCart,
  refundPosItem,
  exchangePosItem,
  fetchPosInvoices,
  getProductStockInfo,
  isProductAvailable,
  getVariantStock,
  resolveVariant,
  getExchangePriceDiff,
  mapOrderToInvoice,
} from '../api/pos';
import { fetchOrders } from '../api/orders';
import { getApiErrorMessage } from '../api/stores';
import { useAuth, useStore } from '../context/AuthContext';
import VariantModal from '../components/sales/VariantModal';
import CreateInvoiceModal from '../components/sales/CreateInvoiceModal';
import RefundModal from '../components/sales/RefundModal';
import ExchangeModal from '../components/sales/ExchangeModal';
import './Sales.css';

const calcInvoiceTotal = (items) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

const Sales = () => {
  const { user } = useAuth();
  const { storeId } = useStore();
  const [activeTab, setActiveTab] = useState('cart');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [invoices, setInvoices] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [debouncedInvoiceSearch, setDebouncedInvoiceSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCart, setLoadingCart] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variantOpen, setVariantOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);
  const [exchangeTarget, setExchangeTarget] = useState(null);
  const [pendingExchange, setPendingExchange] = useState(null);
  const [toast, setToast] = useState(null);

  const [activeAction, setActiveAction] = useState(null); // 'refund' | 'exchange' | null
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState('');
  const [orderSearchResults, setOrderSearchResults] = useState([]);
  const [searchingOrders, setSearchingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInvoiceSearch(invoiceSearch), 400);
    return () => clearTimeout(timer);
  }, [invoiceSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedOrderSearch(orderSearchQuery), 400);
    return () => clearTimeout(timer);
  }, [orderSearchQuery]);

  const loadSearchOrders = useCallback(async (query = '') => {
    setSearchingOrders(true);
    try {
      const result = await fetchOrders({
        storeId,
        search: query,
        excludePos: false,
        perPage: 15,
      });
      setOrderSearchResults(result.orders || []);
    } catch (err) {
      console.error('Error fetching orders for search:', err);
      setOrderSearchResults([]);
    } finally {
      setSearchingOrders(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (activeAction) {
      loadSearchOrders(debouncedOrderSearch);
    }
  }, [activeAction, debouncedOrderSearch, loadSearchOrders]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.sales-dropdown-wrapper')) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [dropdownOpen]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const catalog = await fetchPosCatalog({ storeId });
      setProducts(catalog);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل المنتجات'));
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [storeId]);

  const loadCart = useCallback(async () => {
    setLoadingCart(true);
    try {
      const result = await fetchPosCart();
      setCart(result.items);
      setCartTotal(result.total);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل السلة'));
      setCart([]);
      setCartTotal(0);
    } finally {
      setLoadingCart(false);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const list = await fetchPosInvoices({ search: debouncedInvoiceSearch });
      setInvoices(list);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل الفواتير'));
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [debouncedInvoiceSearch]);

  useEffect(() => {
    loadProducts();
    loadCart();
  }, [loadProducts, loadCart]);

  useEffect(() => {
    if (activeTab === 'invoices') loadInvoices();
  }, [activeTab, loadInvoices]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => inv.id.toLowerCase().includes(q));
  }, [invoices, invoiceSearch]);

  const refreshAll = async () => {
    await Promise.all([loadProducts(), loadCart(), activeTab === 'invoices' ? loadInvoices() : Promise.resolve()]);
  };

  const openProduct = (product) => {
    if (!isProductAvailable(product)) {
      showToast('هذا المنتج غير متوفر حالياً');
      return;
    }
    setSelectedProduct(product);
    setVariantOpen(true);
  };

  const activeProduct = selectedProduct
    ? products.find((p) => p.id === selectedProduct.id) ?? selectedProduct
    : null;

  const handleAddToCart = async ({ product, color, size, price, variant }) => {
    const resolved = variant ?? resolveVariant(product, color, size);
    if (!resolved) {
      showToast('تعذّر تحديد التنوع — اختر لوناً ومقاساً صحيحين');
      return;
    }

    if (pendingExchange) {
      setIsSaving(true);
      try {
        await exchangePosItem({
          oldOrderId: pendingExchange.orderId,
          oldVariantId: pendingExchange.variantId,
          oldQuantity: pendingExchange.quantity,
          newVariantId: resolved.id,
          newQuantity: pendingExchange.quantity,
        });

        const diffInfo = getExchangePriceDiff(
          pendingExchange.oldPrice,
          pendingExchange.quantity,
          price ?? resolved.price,
        );
        let msg = `تم تبديل المنتج إلى «${product.name}» بنجاح`;
        if (diffInfo.type === 'refund') msg += ` — يُسترد للعميل ${diffInfo.amount} د.ل`;
        else if (diffInfo.type === 'pay') msg += ` — مبلغ إضافي ${diffInfo.amount} د.ل`;
        showToast(msg);
        setPendingExchange(null);
        setSelectedProduct(null);
        await refreshAll();
      } catch (err) {
        showToast(getApiErrorMessage(err, 'تعذّر إتمام التبديل'));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const availableStock = resolved.stockUnknown
      ? 1
      : Math.max(
          Number(resolved.stock ?? 0),
          Number(getVariantStock(product, color, size) ?? 0),
        );
    if (availableStock <= 0) {
      showToast('الكمية غير متوفرة لهذا التنوع');
      return;
    }

    setIsSaving(true);
    try {
      await addToPosCart({ variantId: resolved.id, quantity: 1 });
      await loadCart();
      showToast(`تمت إضافة «${product.name}» إلى السلة`);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر إضافة المنتج للسلة'));
    } finally {
      setIsSaving(false);
    }
  };

  const removeFromCart = async (cartItemId) => {
    setIsSaving(true);
    try {
      await removeFromPosCart(cartItemId);
      await loadCart();
      showToast('تم حذف المنتج من السلة');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر حذف المنتج'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateInvoice = async (customerId) => {
    setIsSaving(true);
    try {
      const invoice = await checkoutPosCart({ customerId });
      await loadCart();
      await loadInvoices();
      setActiveTab('invoices');
      showToast(`تم إنشاء الفاتورة ${invoice.id} بنجاح`);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefund = async (chosenQty) => {
    if (!refundTarget) return;
    const { line } = refundTarget;
    setIsSaving(true);
    try {
      await refundPosItem({
        orderId: line.orderId,
        variantId: line.variantId,
        quantity: chosenQty || line.quantity || 1,
      });
      showToast(`تم استرداد «${line.name}» بنجاح`);
      setRefundTarget(null);
      await refreshAll();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر إتمام الاسترداد'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExchangeSelect = async (selectedNewVariants, chosenQty) => {
    if (!exchangeTarget) return;
    setIsSaving(true);
    try {
      const qtyAllocations = [];
      let remainingOld = chosenQty;
      for (let i = 0; i < selectedNewVariants.length; i++) {
        const item = selectedNewVariants[i];
        const isLast = i === selectedNewVariants.length - 1;
        let oldQtyForThis = 0;
        if (isLast) {
          oldQtyForThis = remainingOld;
        } else {
          oldQtyForThis = Math.min(item.quantity, remainingOld);
          remainingOld -= oldQtyForThis;
        }
        qtyAllocations.push({ item, oldQtyForThis });
      }

      await Promise.allSettled(
        qtyAllocations.map(({ item, oldQtyForThis }) =>
          exchangePosItem({
            oldOrderId: exchangeTarget.line.orderId,
            oldVariantId: exchangeTarget.line.variantId,
            oldQuantity: oldQtyForThis,
            newVariantId: item.variant.id,
            newQuantity: item.quantity,
          }),
        ),
      );

      const oldTotal = exchangeTarget.line.price * chosenQty;
      const newTotal = selectedNewVariants.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const diff = newTotal - oldTotal;

      let msg = `تم استبدال المنتجات بنجاح`;
      if (diff < 0) msg += ` — يُسترد للعميل ${Math.abs(diff)} د.ل`;
      else if (diff > 0) msg += ` — مبلغ إضافي ${Math.abs(diff)} د.ل`;
      
      showToast(msg);
      setExchangeTarget(null);
      await refreshAll();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر إتمام الاستبدال'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div className="sales-header-content">
          <h1 className="page-title">المبيعات المباشرة</h1>
          <p className="page-subtitle">إدارة المنتجات المباعة مباشرة من المتجر</p>
        </div>
        <div className="sales-header-actions">
          <button
            type="button"
            className={`sales-action-btn refund-btn ${activeAction === 'refund' ? 'active' : ''}`}
            onClick={() => {
              if (activeAction === 'refund') {
                setActiveAction(null);
                setSelectedOrder(null);
                setOrderSearchQuery('');
              } else {
                setActiveAction('refund');
                setSelectedOrder(null);
                setOrderSearchQuery('');
                setDropdownOpen(true);
              }
            }}
          >
            <RotateCcw size={16} />
            عملية استرجاع
          </button>
          <button
            type="button"
            className={`sales-action-btn exchange-btn ${activeAction === 'exchange' ? 'active' : ''}`}
            onClick={() => {
              if (activeAction === 'exchange') {
                setActiveAction(null);
                setSelectedOrder(null);
                setOrderSearchQuery('');
              } else {
                setActiveAction('exchange');
                setSelectedOrder(null);
                setOrderSearchQuery('');
                setDropdownOpen(true);
              }
            }}
          >
            <ArrowLeftRight size={16} />
            عملية استبدال
          </button>
        </div>
      </div>

      <div className="sales-tabs">
        <button
          type="button"
          className={`sales-tab ${activeTab === 'cart' ? 'active' : ''}`}
          onClick={() => setActiveTab('cart')}
        >
          <ShoppingCart size={18} />
          سلة المنتجات ({cartCount})
        </button>
        <button
          type="button"
          className={`sales-tab ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
        >
          <FileText size={18} />
          الفواتير والمبيعات ({invoices.length})
        </button>
      </div>

      {error && <p className="sales-error">{error}</p>}

      {activeAction && (
        <div className="sales-action-panel">
          <div className="sales-action-panel-header">
            <h3>
              {activeAction === 'refund' ? (
                <>
                  <RotateCcw size={18} />
                  عملية استرجاع جديدة
                </>
              ) : (
                <>
                  <ArrowLeftRight size={18} />
                  عملية استبدال جديدة
                </>
              )}
            </h3>
            <button
              type="button"
              className="sales-action-panel-close"
              onClick={() => {
                setActiveAction(null);
                setSelectedOrder(null);
                setOrderSearchQuery('');
              }}
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
          </div>

          <div className="sales-action-panel-body">
            <div className="sales-order-search-container">
              <label className="sales-input-label">
                ابحث عن الطلب (سواء من المبيعات المباشرة أو طلبات الزبائن):
              </label>
              <div className="sales-dropdown-wrapper">
                <div className="sales-search-input-wrapper">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    placeholder="ابحث برقم الطلب، اسم العميل، أو الهاتف..."
                    value={orderSearchQuery}
                    onChange={(e) => {
                      setOrderSearchQuery(e.target.value);
                      setDropdownOpen(true);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                  />
                  {orderSearchQuery && (
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={() => {
                        setOrderSearchQuery('');
                        setDropdownOpen(true);
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {dropdownOpen && (
                  <div className="sales-orders-dropdown-list">
                    {searchingOrders ? (
                      <div className="dropdown-message">جاري البحث...</div>
                    ) : orderSearchResults.length === 0 ? (
                      <div className="dropdown-message">لا توجد طلبات مطابقة للبحث</div>
                    ) : (
                      orderSearchResults.map((order) => (
                        <div
                          key={order.orderId}
                          className="dropdown-item"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDropdownOpen(false);
                            setOrderSearchQuery(order.id);
                          }}
                        >
                          <div className="dropdown-item-header">
                            <span className="order-num">طلب رقم: {order.id}</span>
                            <span className="order-total">{order.total} د.ل</span>
                          </div>
                          <div className="dropdown-item-meta">
                            <span>العميل: {order.customerName}</span>
                            <span>التاريخ: {order.date}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedOrder && (
              <div className="sales-selected-order-details">
                <div className="selected-order-meta-grid">
                  <div className="meta-col">
                    <span className="meta-label">رقم الطلب:</span>
                    <strong className="meta-val">{selectedOrder.id}</strong>
                  </div>
                  <div className="meta-col">
                    <span className="meta-label">العميل:</span>
                    <strong className="meta-val">{selectedOrder.customerName}</strong>
                  </div>
                  <div className="meta-col">
                    <span className="meta-label">التاريخ:</span>
                    <strong className="meta-val">{selectedOrder.date}</strong>
                  </div>
                  <div className="meta-col">
                    <span className="meta-label">الحالة:</span>
                    <strong className="meta-val">{selectedOrder.status}</strong>
                  </div>
                </div>

                <div className="selected-order-products-table">
                  <h5>المنتجات القابلة {activeAction === 'refund' ? 'للإرجاع' : 'للتبديل'}</h5>
                  <div className="selected-order-products-list">
                    {selectedOrder.products && selectedOrder.products.length > 0 ? (
                      selectedOrder.products.map((item, idx) => {
                        const line = {
                          lineId: item.lineId ?? idx,
                          orderId: selectedOrder.orderId,
                          variantId: item.variantId,
                          productId: item.productId,
                          name: item.name,
                          price: item.price,
                          quantity: item.quantity,
                          sku: item.sku || '',
                          color: item.color || '',
                          size: item.size || '',
                        };
                        return (
                          <div key={idx} className="selected-order-product-row">
                            <div className="prod-info">
                              <span className="prod-name">{item.name}</span>
                              {(item.color || item.size) ? (
                                <span className="prod-variant">
                                  {item.color && `اللون: ${item.color}`}
                                  {item.color && item.size && ' | '}
                                  {item.size && `المقاس: ${item.size}`}
                                </span>
                              ) : item.variantLabel ? (
                                <span className="prod-variant">{item.variantLabel}</span>
                              ) : null}
                              {item.sku && (
                                <span className="prod-sku">SKU: {item.sku}</span>
                              )}
                            </div>
                            <div className="prod-meta">
                              <span>الكمية: {item.quantity}</span>
                              <span>السعر: {item.price} د.ل</span>
                              <span className="prod-total">
                                الإجمالي: {item.price * item.quantity} د.ل
                              </span>
                            </div>
                            <div className="prod-actions">
                              {activeAction === 'refund' ? (
                                <button
                                  type="button"
                                  className="sales-line-btn refund"
                                  onClick={() =>
                                    setRefundTarget({
                                      invoiceId: selectedOrder.id,
                                      line,
                                    })
                                  }
                                  disabled={isSaving}
                                >
                                  <RotateCcw size={14} />
                                  استرداد
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="sales-line-btn exchange"
                                  onClick={() =>
                                    setExchangeTarget({
                                      invoiceId: selectedOrder.id,
                                      line,
                                    })
                                  }
                                  disabled={isSaving}
                                >
                                  <ArrowLeftRight size={14} />
                                  تبديل
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="no-items">لا توجد منتجات في هذا الطلب</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'cart' ? (
        <div className="sales-layout">
          <div className="sales-cart-panel">
            <h2 className="sales-cart-title">
              <ShoppingCart size={22} />
              السلة
            </h2>

            {loadingCart ? (
              <div className="sales-cart-empty">
                <p>جاري تحميل السلة...</p>
              </div>
            ) : cart.length === 0 ? (
              <div className="sales-cart-empty">
                <ShoppingCart size={48} />
                <p>السلة فارغة</p>
                <span>انقر على المنتجات لإضافتها</span>
              </div>
            ) : (
              <>
                {cart.map((item) => (
                  <div key={item.key} className="sales-cart-item">
                    <div className="sales-cart-item-header">
                      <div>
                        <p className="sales-cart-item-name">{item.name}</p>
                        <p className="sales-cart-item-variant">
                          {item.sku || item.variantLabel}
                        </p>
                      </div>
                      <span className="sales-cart-item-price">
                        {item.price * item.quantity} د.ل
                      </span>
                    </div>
                    <div className="sales-cart-item-actions">
                      <span className="sales-qty-value">× {item.quantity}</span>
                      <button
                        type="button"
                        className="sales-remove-btn"
                        onClick={() => removeFromCart(item.cartItemId)}
                        disabled={isSaving}
                        aria-label="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="sales-cart-total">
                  <span>الإجمالي:</span>
                  <span>{cartTotal} د.ل</span>
                </div>

                <button
                  type="button"
                  className="sales-create-invoice-btn"
                  onClick={() => setInvoiceModalOpen(true)}
                  disabled={isSaving}
                >
                  <Plus size={18} />
                  إنشاء فاتورة
                </button>
              </>
            )}
          </div>

          <div className="sales-products-panel">
            <h3>منتجات المتجر</h3>
            {loadingProducts ? (
              <p className="sales-loading">جاري تحميل المنتجات...</p>
            ) : (
              <div className="sales-products-grid">
                {products.map((product) => {
                  const stockInfo = getProductStockInfo(product);
                  const totalStock = stockInfo.unknown && stockInfo.total === 0
                    ? null
                    : stockInfo.total;
                  const outOfStock = !isProductAvailable(product);
                  return (
                    <div
                      key={product.id}
                      className={`sales-product-card${outOfStock ? ' out-of-stock' : ''}`}
                      role="button"
                      tabIndex={outOfStock ? -1 : 0}
                      onClick={() => !outOfStock && openProduct(product)}
                      onKeyDown={(e) => e.key === 'Enter' && !outOfStock && openProduct(product)}
                    >
                      <img
                        className="sales-product-image"
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                      />
                      <div className="sales-product-body">
                        <p className="sales-product-name">{product.name}</p>
                        <div className="sales-product-colors">
                          {product.colors.map((c) => (
                            <span key={c} className="sales-color-dot">
                              {c}
                            </span>
                          ))}
                        </div>
                        <div className="sales-product-sizes">
                          {product.sizes.map((s) => (
                            <span key={s} className="sales-size-pill">
                              {s}
                            </span>
                          ))}
                        </div>
                        <div className="sales-product-footer">
                          <span className="sales-product-stock">
                            {totalStock == null ? '—' : totalStock}
                          </span>
                          <span className="sales-product-price">{product.price} د.ل</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="sales-invoices-search">
            <Search size={18} color="#9ca3af" />
            <input
              type="text"
              placeholder="البحث برقم الفاتورة..."
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
            />
          </div>

          {loadingInvoices ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              جاري تحميل الفواتير...
            </p>
          ) : filteredInvoices.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              لا توجد فواتير مطابقة للبحث
            </p>
          ) : (
            filteredInvoices.map((invoice) => (
              <div key={invoice.orderId} className="sales-invoice-card">
                <div className="sales-invoice-header">
                  <div>
                    <p className="sales-invoice-number">فاتورة رقم: {invoice.id}</p>
                    <p className="sales-invoice-meta">
                      التاريخ: {invoice.date} | الموظف: {invoice.staff ?? invoice.customer}
                    </p>
                  </div>
                  <span className="sales-invoice-status">{invoice.status}</span>
                </div>

                {invoice.items.map((line) => (
                  <div key={line.lineId} className="sales-invoice-line">
                    <div className="sales-invoice-line-info">
                      <p className="sales-invoice-line-name">{line.name}</p>
                      <p className="sales-invoice-line-detail">
                        SKU: {line.sku || '—'} | الكمية: {line.quantity}
                      </p>
                    </div>
                    <span className="sales-invoice-line-price">
                      {line.price * line.quantity} د.ل
                    </span>
                    <div className="sales-invoice-line-actions">
                      <button
                        type="button"
                        className="sales-line-btn"
                        onClick={() => setRefundTarget({ invoiceId: invoice.id, line })}
                        disabled={isSaving}
                      >
                        <RotateCcw size={14} />
                        استرداد
                      </button>
                      <button
                        type="button"
                        className="sales-line-btn"
                        onClick={() => setExchangeTarget({ invoiceId: invoice.id, line })}
                        disabled={isSaving}
                      >
                        <ArrowLeftRight size={14} />
                        تبديل
                      </button>
                    </div>
                  </div>
                ))}

                <div className="sales-invoice-total-row">
                  <span>الإجمالي:</span>
                  <span>{calcInvoiceTotal(invoice.items)} د.ل</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <VariantModal
        isOpen={variantOpen}
        onClose={() => {
          setVariantOpen(false);
          setSelectedProduct(null);
          setPendingExchange(null);
        }}
        product={activeProduct}
        storeId={storeId}
        onAdd={handleAddToCart}
        isSaving={isSaving}
        exchangeFrom={
          pendingExchange
            ? { oldPrice: pendingExchange.oldPrice, quantity: pendingExchange.quantity }
            : null
        }
      />

      <CreateInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => !isSaving && setInvoiceModalOpen(false)}
        cart={cart}
        onConfirm={handleCreateInvoice}
        isSaving={isSaving}
        user={user}
      />

      <RefundModal
        isOpen={!!refundTarget}
        onClose={() => !isSaving && setRefundTarget(null)}
        item={refundTarget?.line}
        onConfirm={handleRefund}
        isSaving={isSaving}
      />

      <ExchangeModal
        isOpen={!!exchangeTarget}
        onClose={() => setExchangeTarget(null)}
        item={exchangeTarget?.line}
        products={products}
        onConfirm={handleExchangeSelect}
      />

      {toast && (
        <div className="sales-toast">
          <CheckCircle2 size={20} />
          {toast}
        </div>
      )}
    </div>
  );
};

export default Sales;
