import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  FileText,
  Search,
  Trash2,
  Plus,
  CheckCircle2,
  Eye,
  Wallet,
  ArrowLeftRight,
  Undo2,
} from 'lucide-react';
import { COLOR_DOTS } from '../data/salesProducts';
import { fetchAttributes, buildColorDotsFromAttributes } from '../api/products';
import { fetchOrder } from '../api/orders';
import { getStatusBadgeClass } from '../data/ordersData';
import {
  fetchPosInit,
  fetchPosCatalog,
  fetchPosCart,
  addToPosCart,
  removeFromPosCart,
  checkoutPosCart,
  refundPosItem,
  exchangeOrderItems,
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
import OrderDetailModal from '../components/orders/OrderDetailModal';
import VariantModal from '../components/sales/VariantModal';
import CreateInvoiceModal from '../components/sales/CreateInvoiceModal';
import RefundModal from '../components/sales/RefundModal';
import ExchangeModal from '../components/sales/ExchangeModal';
import PosOrderActionModal from '../components/sales/PosOrderActionModal';
import './Sales.css';

const toSalesLine = (order, product) => ({
  lineId: product.lineId,
  orderId: order.orderId,
  variantId: product.variantId,
  name: product.name,
  quantity: product.quantity,
  price: product.price,
  sku: product.sku,
  isPos: Boolean(order.isPos),
  color: product.variantLabel ?? product.sku ?? '—',
  size: '—',
});

const Sales = () => {
  const { storeId, user } = useAuth();
  const [activeTab, setActiveTab] = useState('cart');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [wallet, setWallet] = useState({ balance: 0, status: 'نشطة' });
  const [invoices, setInvoices] = useState([]);
  const [orderStats, setOrderStats] = useState({ total: 0, pos: 0, online: 0 });
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
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
  const [detailModal, setDetailModal] = useState({ open: false, order: null, loading: false });
  const [orderActionMode, setOrderActionMode] = useState(null);
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

  const loadPosInit = useCallback(async () => {
    if (!storeId) {
      setError('لم يتم تحديد المتجر — أعد تسجيل الدخول');
      setLoadingProducts(false);
      setLoadingCart(false);
      return;
    }

    setLoadingProducts(true);
    setLoadingCart(true);
    setError('');
    try {
      const init = await fetchPosInit({ storeId });
      setProducts(init.catalog);
      setCart(init.cart.items);
      setCartTotal(init.cart.total);
      setWallet(init.wallet);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل بيانات المبيعات المباشرة'));
      setProducts([]);
      setCart([]);
      setCartTotal(0);
    } finally {
      setLoadingProducts(false);
      setLoadingCart(false);
    }
  }, [storeId]);

  const loadProducts = useCallback(async () => {
    if (!storeId) return;
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

  const applyCartResult = (result) => {
    if (result?.cart) {
      setCart(result.cart.items);
      setCartTotal(result.cart.total);
    }
  };

  const loadInvoices = useCallback(async () => {
    if (!storeId) return;
    setLoadingInvoices(true);
    try {
      const result = await fetchPosInvoices({
        storeId,
        search: debouncedInvoiceSearch,
      });
      setInvoices(result.invoices);
      setOrderStats(result.stats ?? {
        total: result.invoices.length,
        pos: result.invoices.filter((inv) => inv.isPos).length,
        online: result.invoices.filter((inv) => !inv.isPos).length,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل الطلبات'));
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [storeId, debouncedInvoiceSearch]);

  useEffect(() => {
    loadPosInit();
  }, [loadPosInit]);

  useEffect(() => {
    if (storeId) loadInvoices();
  }, [storeId, loadInvoices]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const visibleInvoices = invoices.filter((invoice) => {
    if (orderTypeFilter === 'pos') return invoice.isPos;
    if (orderTypeFilter === 'online') return !invoice.isPos;
    return true;
  });

  const refreshAll = async () => {
    await Promise.all([
      loadProducts(),
      loadCart(),
      activeTab === 'invoices' ? loadInvoices() : Promise.resolve(),
    ]);
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
          isPos: pendingExchange.isPos,
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
      const result = await addToPosCart({ variantId: resolved.id, quantity: 1 });
      if (result?.cart) {
        applyCartResult(result);
      } else {
        await loadCart();
      }
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
      const result = await removeFromPosCart(cartItemId);
      if (result?.cart) {
        applyCartResult(result);
      } else {
        await loadCart();
      }
      showToast('تم حذف المنتج من السلة');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر حذف المنتج'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateInvoice = async () => {
    setIsSaving(true);
    try {
      const invoice = await checkoutPosCart();
      await loadPosInit();
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
    const quantity = chosenQty || line.quantity || 1;
    setIsSaving(true);
    try {
      await refundPosItem({
        orderId: line.orderId,
        variantId: line.variantId,
        quantity,
        isPos: line.isPos,
      });
      showToast(`تم استرداد «${line.name}» (${quantity} قطعة) بنجاح`);
      setRefundTarget(null);
      await refreshAll();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر إتمام الاسترداد'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExchangeConfirm = async (selectedNewItems, chosenQty, lineOverride = null) => {
    const sourceLine = lineOverride ?? exchangeTarget?.line;
    if (!sourceLine) return;
    setIsSaving(true);
    try {
      await exchangeOrderItems({
        orderId: sourceLine.orderId,
        isPos: sourceLine.isPos,
        oldItems: [{ variantId: sourceLine.variantId, quantity: chosenQty }],
        newItems: selectedNewItems.map((item) => ({
          variantId: item.variant?.id ?? item.id,
          quantity: item.quantity,
        })),
      });

      const oldTotal = sourceLine.price * chosenQty;
      const newTotal = selectedNewItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const diff = newTotal - oldTotal;

      let msg = 'تم استبدال المنتجات بنجاح';
      if (diff < 0) msg += ` — يُسترد للعميل ${Math.abs(diff)} د.ل`;
      else if (diff > 0) msg += ` — مبلغ إضافي ${Math.abs(diff)} د.ل`;

      showToast(msg);
      setExchangeTarget(null);
      setOrderActionMode(null);
      await refreshAll();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر إتمام الاستبدال'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOrderActionRefund = async (chosenQty, line) => {
    if (!line) return;
    const quantity = chosenQty || line.quantity || 1;
    setIsSaving(true);
    try {
      await refundPosItem({
        orderId: line.orderId,
        variantId: line.variantId,
        quantity,
        isPos: line.isPos,
      });
      showToast(`تم استرجاع «${line.name}» (${quantity} قطعة) بنجاح`);
      setOrderActionMode(null);
      await refreshAll();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر إتمام الاسترجاع'));
    } finally {
      setIsSaving(false);
    }
  };

  const openInvoiceDetails = async (invoice) => {
    setDetailModal({ open: true, order: null, loading: true });
    try {
      const details = await fetchOrder(invoice.orderId);
      setDetailModal({ open: true, order: details, loading: false });
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تحميل تفاصيل الطلب'));
      setDetailModal({ open: false, order: null, loading: false });
    }
  };

  const handlePosRefundLine = (product) => {
    const order = detailModal.order;
    if (!order) return;
    const line = toSalesLine(order, product);
    setDetailModal({ open: false, order: null, loading: false });
    setRefundTarget({ invoiceId: order.id, line });
  };

  const handlePosExchangeLine = (product) => {
    const order = detailModal.order;
    if (!order) return;
    const line = toSalesLine(order, product);
    setDetailModal({ open: false, order: null, loading: false });
    setExchangeTarget({ invoiceId: order.id, line });
  };

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div>
          <h1 className="page-title">المبيعات المباشرة</h1>
          <p className="page-subtitle">إدارة المبيعات المباشرة والاستبدال والاسترجاع لطلبات المتجر</p>
        </div>
        <div className="sales-wallet-badge">
          <Wallet size={18} />
          <div className="sales-wallet-info">
            <span className="sales-wallet-label">رصيد المحفظة</span>
            <strong>{wallet.balance} د.ل</strong>
            <span className="sales-wallet-status">{wallet.status}</span>
          </div>
        </div>
      </div>

      <div className="sales-top-actions">
        <button
          type="button"
          className="sales-top-action-btn exchange"
          onClick={() => setOrderActionMode('exchange')}
          disabled={isSaving}
        >
          <ArrowLeftRight size={18} />
          استبدال
        </button>
        <button
          type="button"
          className="sales-top-action-btn return"
          onClick={() => setOrderActionMode('return')}
          disabled={isSaving}
        >
          <Undo2 size={18} />
          استرجاع
        </button>
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
          الفواتير والمبيعات ({orderStats.total})
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
                        <p className="sales-cart-item-name">
                          {item.variantLabel || item.name}
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
        <div className="sales-invoices-panel">
          <div className="sales-invoices-toolbar">
            <div className="sales-invoices-search">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="البحث برقم الطلب أو اسم العميل..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
              />
            </div>

            <div className="sales-order-type-filters">
              <button
                type="button"
                className={`sales-order-type-btn ${orderTypeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setOrderTypeFilter('all')}
              >
                الكل ({orderStats.total})
              </button>
              <button
                type="button"
                className={`sales-order-type-btn online ${orderTypeFilter === 'online' ? 'active' : ''}`}
                onClick={() => setOrderTypeFilter('online')}
              >
                أونلاين ({orderStats.online})
              </button>
              <button
                type="button"
                className={`sales-order-type-btn pos ${orderTypeFilter === 'pos' ? 'active' : ''}`}
                onClick={() => setOrderTypeFilter('pos')}
              >
                مبيعات مباشرة ({orderStats.pos})
              </button>
            </div>
          </div>

          {loadingInvoices ? (
            <p className="sales-invoices-empty">جاري تحميل الطلبات...</p>
          ) : visibleInvoices.length === 0 ? (
            <p className="sales-invoices-empty">لا توجد طلبات مطابقة للبحث أو الفلتر</p>
          ) : (
            <div className="sales-invoices-table-wrap">
              <table className="sales-invoices-table">
                <thead>
                  <tr>
                    <th>رقم الطلب</th>
                    <th>التاريخ</th>
                    <th>العميل / الموظف</th>
                    <th>النوع</th>
                    <th>الحالة</th>
                    <th>الإجمالي</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInvoices.map((invoice) => (
                    <tr key={invoice.orderId}>
                      <td className="sales-invoices-cell-number">{invoice.id}</td>
                      <td>{invoice.date}</td>
                      <td>{invoice.customer}</td>
                      <td>
                        <span className={`sales-invoice-type ${invoice.isPos ? 'pos' : 'online'}`}>
                          {invoice.typeLabel}
                        </span>
                      </td>
                      <td>
                        <span className={`order-status-badge ${getStatusBadgeClass(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="sales-invoices-cell-total">{invoice.total} د.ل</td>
                      <td>
                        <button
                          type="button"
                          className="sales-invoice-view-btn"
                          onClick={() => openInvoiceDetails(invoice)}
                          aria-label={`عرض تفاصيل الطلب ${invoice.id}`}
                        >
                          <Eye size={16} />
                          <span>عرض التفاصيل</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        storeId={storeId}
        storeProducts={products}
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
        onClose={() => !isSaving && setExchangeTarget(null)}
        item={exchangeTarget?.line}
        products={products}
        storeProducts={products}
        onConfirm={(items, qty) => handleExchangeConfirm(items, qty)}
        isSaving={isSaving}
      />

      <PosOrderActionModal
        isOpen={!!orderActionMode}
        onClose={() => !isSaving && setOrderActionMode(null)}
        mode={orderActionMode ?? 'return'}
        storeId={storeId}
        products={products}
        onRefundConfirm={handleOrderActionRefund}
        onExchangeConfirm={handleExchangeConfirm}
        isSaving={isSaving}
      />

      <OrderDetailModal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, order: null, loading: false })}
        order={detailModal.order}
        loading={detailModal.loading}
        showPosActions
        onRefundLine={handlePosRefundLine}
        onExchangeLine={handlePosExchangeLine}
        actionsDisabled={isSaving}
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
