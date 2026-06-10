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
} from 'lucide-react';
import { COLOR_DOTS } from '../data/salesProducts';
import { fetchAttributes, buildColorDotsFromAttributes } from '../api/products';
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
} from '../api/pos';
import { getApiErrorMessage } from '../api/stores';
import { useAuth } from '../context/AuthContext';
import VariantModal from '../components/sales/VariantModal';
import CreateInvoiceModal from '../components/sales/CreateInvoiceModal';
import RefundModal from '../components/sales/RefundModal';
import ExchangeModal from '../components/sales/ExchangeModal';
import './Sales.css';

const calcInvoiceTotal = (items) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

const Sales = () => {
  const { storeId } = useAuth();
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
  const [colorDots, setColorDots] = useState(COLOR_DOTS);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variantOpen, setVariantOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);
  const [exchangeTarget, setExchangeTarget] = useState(null);
  const [pendingExchange, setPendingExchange] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInvoiceSearch(invoiceSearch), 400);
    return () => clearTimeout(timer);
  }, [invoiceSearch]);

  useEffect(() => {
    fetchAttributes()
      .then((attrs) => setColorDots(buildColorDotsFromAttributes(attrs)))
      .catch(() => {});
  }, []);

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

    if (getVariantStock(product, color, size) <= 0) {
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

  const handleRefund = async () => {
    if (!refundTarget) return;
    const { line } = refundTarget;
    setIsSaving(true);
    try {
      await refundPosItem({
        orderId: line.orderId,
        variantId: line.variantId,
        quantity: line.quantity || 1,
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

  const handleExchangeSelect = (newProduct) => {
    if (!exchangeTarget) return;
    setPendingExchange({
      orderId: exchangeTarget.line.orderId,
      variantId: exchangeTarget.line.variantId,
      oldPrice: exchangeTarget.line.price,
      quantity: exchangeTarget.line.quantity || 1,
    });
    setExchangeTarget(null);
    setSelectedProduct(products.find((p) => p.id === newProduct.id) ?? newProduct);
    setVariantOpen(true);
    showToast('اختر اللون والمقاس للمنتج الجديد');
  };

  return (
    <div className="sales-page">
      <div className="sales-header">
        <h1 className="page-title">المبيعات المباشرة</h1>
        <p className="page-subtitle">إدارة المنتجات المباعة مباشرة من المتجر</p>
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
                              <span
                                className="sales-color-circle"
                                style={{ background: colorDots[c] || '#ccc' }}
                              />
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
                      التاريخ: {invoice.date} | العميل: {invoice.customer}
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
