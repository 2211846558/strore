import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  FileText,
  Search,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  RotateCcw,
  ArrowLeftRight,
} from 'lucide-react';
import {
  COLOR_DOTS,
  getStock,
  getTotalStock,
  getExchangePriceDiff,
  createProductsWithStock,
  adjustProductStock,
  applyStockDeductions,
} from '../data/salesProducts';
import VariantModal from '../components/sales/VariantModal';
import CreateInvoiceModal from '../components/sales/CreateInvoiceModal';
import RefundModal from '../components/sales/RefundModal';
import ExchangeModal from '../components/sales/ExchangeModal';
import './Sales.css';

const today = new Date().toISOString().slice(0, 10);

const initialInvoices = [
  {
    id: 'INV-001',
    date: '2026-05-17',
    customer: 'أحمد محمد',
    status: 'مكتملة',
    items: [
      { lineId: 'l1', productId: 4, name: 'بنطلون جينز', color: 'أزرق داكن', size: 'L', quantity: 1, price: 120 },
    ],
  },
  {
    id: 'INV-002',
    date: '2026-05-17',
    customer: 'سارة علي',
    status: 'مكتملة',
    items: [
      { lineId: 'l2', productId: 1, name: 'قميص قطني', color: 'أبيض', size: 'M', quantity: 1, price: 85 },
    ],
  },
  {
    id: 'INV-003',
    date: '2026-05-18',
    customer: 'شششش',
    status: 'مكتملة',
    items: [
      { lineId: 'l3', productId: 3, name: 'شورت رياضي', color: 'أسود', size: 'XL', quantity: 1, price: 60 },
      { lineId: 'l4', productId: 2, name: 'فستان صيفي', color: 'أحمر', size: 'M', quantity: 1, price: 150 },
    ],
  },
];

const cartKey = (productId, color, size) => `${productId}-${color}-${size}`;

const calcInvoiceTotal = (items) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

const buildInitialProducts = () => {
  const soldItems = initialInvoices.flatMap((inv) => inv.items);
  return applyStockDeductions(createProductsWithStock(), soldItems);
};

const Sales = () => {
  const [activeTab, setActiveTab] = useState('cart');
  const [products, setProducts] = useState(buildInitialProducts);
  const [cart, setCart] = useState([]);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [invoiceSearch, setInvoiceSearch] = useState('');
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

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => inv.id.toLowerCase().includes(q));
  }, [invoices, invoiceSearch]);

  const nextInvoiceId = () => {
    const nums = invoices
      .map((inv) => parseInt(inv.id.replace('INV-', ''), 10))
      .filter((n) => !Number.isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `INV-${String(next).padStart(3, '0')}`;
  };

  const openProduct = (product) => {
    if (getTotalStock(product) <= 0) {
      showToast('هذا المنتج غير متوفر حالياً');
      return;
    }
    setSelectedProduct(product);
    setVariantOpen(true);
  };

  const activeProduct = selectedProduct
    ? products.find((p) => p.id === selectedProduct.id) ?? selectedProduct
    : null;

  const handleAddToCart = ({ product, color, size, price }) => {
    if (pendingExchange) {
      const { invoiceId, lineId, oldProductId, oldColor, oldSize, quantity } = pendingExchange;
      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== invoiceId) return inv;
          const items = inv.items.map((line) =>
            line.lineId === lineId
              ? {
                  ...line,
                  productId: product.id,
                  name: product.name,
                  color,
                  size,
                  price,
                }
              : line
          );
          return { ...inv, items };
        })
      );
      const liveProduct = products.find((p) => p.id === product.id) ?? product;
      const available = getStock(liveProduct, color, size);
      if (available < quantity) {
        showToast('الكمية غير متوفرة للمنتج البديل');
        return;
      }
      setProducts((prev) => {
        let next = adjustProductStock(prev, oldProductId, oldColor, oldSize, quantity);
        next = adjustProductStock(next, product.id, color, size, -quantity);
        return next;
      });
      const qty = pendingExchange.quantity || 1;
      const diffInfo = getExchangePriceDiff(pendingExchange.oldPrice, qty, price);
      setPendingExchange(null);
      setSelectedProduct(null);
      let msg = `تم تبديل المنتج إلى «${product.name}» (${color} | ${size}) بنجاح`;
      if (diffInfo.type === 'refund') {
        msg += ` — يُسترد للعميل ${diffInfo.amount} د.ل`;
      } else if (diffInfo.type === 'pay') {
        msg += ` — مبلغ إضافي على العميل ${diffInfo.amount} د.ل`;
      }
      showToast(msg);
      return;
    }

    const liveProduct = products.find((p) => p.id === product.id) ?? product;
    const available = getStock(liveProduct, color, size);
    if (available <= 0) {
      showToast('الكمية غير متوفرة لهذا المتغير');
      return;
    }

    setProducts((prev) => adjustProductStock(prev, product.id, color, size, -1));

    const key = cartKey(product.id, color, size);
    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          name: product.name,
          color,
          size,
          price,
          quantity: 1,
        },
      ];
    });
    showToast(`تمت إضافة «${product.name}» إلى السلة`);
  };

  const updateQty = (key, delta) => {
    const item = cart.find((i) => i.key === key);
    if (!item) return;

    if (delta > 0) {
      const liveProduct = products.find((p) => p.id === item.productId);
      const available = getStock(liveProduct, item.color, item.size);
      if (available <= 0) {
        showToast('لا توجد كمية إضافية متوفرة');
        return;
      }
      setProducts((prev) =>
        adjustProductStock(prev, item.productId, item.color, item.size, -1)
      );
    } else {
      setProducts((prev) =>
        adjustProductStock(prev, item.productId, item.color, item.size, 1)
      );
    }

    setCart((prev) =>
      prev
        .map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (key) => {
    const item = cart.find((i) => i.key === key);
    if (item) {
      setProducts((prev) =>
        adjustProductStock(prev, item.productId, item.color, item.size, item.quantity)
      );
    }
    setCart((prev) => prev.filter((i) => i.key !== key));
    showToast('تم حذف المنتج من السلة');
  };

  const handleCreateInvoice = (customerName) => {
    const items = cart.map((item, idx) => ({
      lineId: `line-${Date.now()}-${idx}`,
      productId: item.productId,
      name: item.name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
    }));

    const newInvoice = {
      id: nextInvoiceId(),
      date: today,
      customer: customerName,
      status: 'مكتملة',
      items,
    };

    setInvoices((prev) => [newInvoice, ...prev]);
    setCart([]);
    setActiveTab('invoices');
    showToast(`تم إنشاء الفاتورة ${newInvoice.id} بنجاح`);
  };

  const handleRefund = () => {
    if (!refundTarget) return;
    const { invoiceId, line } = refundTarget;

    setInvoices((prev) => {
      const updated = prev
        .map((inv) => {
          if (inv.id !== invoiceId) return inv;
          const items = inv.items.filter((i) => i.lineId !== line.lineId);
          return { ...inv, items };
        })
        .filter((inv) => inv.items.length > 0);
      return updated;
    });

    setProducts((prev) =>
      adjustProductStock(prev, line.productId, line.color, line.size, line.quantity || 1)
    );
    showToast(`تم استرداد «${line.name}» بنجاح — أُعيدت الكمية للمخزون`);
    setRefundTarget(null);
  };

  const handleExchangeSelect = (newProduct) => {
    if (!exchangeTarget) return;
    setPendingExchange({
      invoiceId: exchangeTarget.invoiceId,
      lineId: exchangeTarget.line.lineId,
      oldProductId: exchangeTarget.line.productId,
      oldColor: exchangeTarget.line.color,
      oldSize: exchangeTarget.line.size,
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

      {activeTab === 'cart' ? (
        <div className="sales-layout">
          <div className="sales-cart-panel">
            <h2 className="sales-cart-title">
              <ShoppingCart size={22} />
              السلة
            </h2>

            {cart.length === 0 ? (
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
                          {item.size} | {item.color}
                        </p>
                      </div>
                      <span className="sales-cart-item-price">
                        {item.price * item.quantity} د.ل
                      </span>
                    </div>
                    <div className="sales-cart-item-actions">
                      <div className="sales-qty-control">
                        <button
                          type="button"
                          className="sales-qty-btn"
                          onClick={() => updateQty(item.key, -1)}
                          aria-label="تقليل الكمية"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="sales-qty-value">{item.quantity}</span>
                        <button
                          type="button"
                          className="sales-qty-btn"
                          onClick={() => updateQty(item.key, 1)}
                          aria-label="زيادة الكمية"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="sales-remove-btn"
                        onClick={() => removeFromCart(item.key)}
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
                >
                  <Plus size={18} />
                  إنشاء فاتورة
                </button>
              </>
            )}
          </div>

          <div className="sales-products-panel">
            <h3>منتجات المتجر</h3>
            <div className="sales-products-grid">
              {products.map((product) => {
                const totalStock = getTotalStock(product);
                const outOfStock = totalStock <= 0;
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
                            style={{ background: COLOR_DOTS[c] || '#ccc' }}
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
                        {totalStock}
                      </span>
                      <span className="sales-product-price">{product.price} د.ل</span>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
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

          {filteredInvoices.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              لا توجد فواتير مطابقة للبحث
            </p>
          ) : (
            filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="sales-invoice-card">
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
                        المقاس: {line.size} | اللون: {line.color} | الكمية:{' '}
                        {line.quantity}
                      </p>
                    </div>
                    <span className="sales-invoice-line-price">
                      {line.price * line.quantity} د.ل
                    </span>
                    <div className="sales-invoice-line-actions">
                      <button
                        type="button"
                        className="sales-line-btn"
                        onClick={() =>
                          setRefundTarget({ invoiceId: invoice.id, line })
                        }
                      >
                        <RotateCcw size={14} />
                        استرداد
                      </button>
                      <button
                        type="button"
                        className="sales-line-btn"
                        onClick={() =>
                          setExchangeTarget({ invoiceId: invoice.id, line })
                        }
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
        exchangeFrom={
          pendingExchange
            ? { oldPrice: pendingExchange.oldPrice, quantity: pendingExchange.quantity }
            : null
        }
      />

      <CreateInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        cart={cart}
        onConfirm={handleCreateInvoice}
      />

      <RefundModal
        isOpen={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        item={refundTarget?.line}
        onConfirm={handleRefund}
      />

      <ExchangeModal
        isOpen={!!exchangeTarget}
        onClose={() => setExchangeTarget(null)}
        item={exchangeTarget?.line}
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
