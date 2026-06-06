import React, { useState } from 'react';
import { Search, Plus, CheckCircle2 } from 'lucide-react';
import ProductCard from '../components/products/ProductCard';
import ProductModal from '../components/products/ProductModal';
import ArchiveConfirmModal from '../components/products/ArchiveConfirmModal';
import './Products.css';

const initialProducts = [
  {
    id: 1,
    name: 'بنطلون جينز',
    description: 'بنطلون جينز عصري بقصة مريحة',
    price: '120',
    category: 'بنطلون',
    colors: ['أزرق داكن'],
    sizes: ['L', 'M'],
    stock: '15',
    status: 'نشط',
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 2,
    name: 'شورت رياضي',
    description: 'شورت رياضي مناسب للتمرين',
    price: '60',
    category: 'شورت',
    colors: ['أسود', 'رمادي'],
    sizes: ['XL', 'L'],
    stock: '30',
    status: 'نشط',
    image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 3,
    name: 'فستان صيفي',
    description: 'فستان صيفي أنيق ومريح',
    price: '150',
    category: 'فستان',
    colors: ['أحمر', 'وردي'],
    sizes: ['L', 'M', 'S'],
    stock: '23',
    status: 'نشط',
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 4,
    name: 'قميص قطني أزرق',
    description: 'قميص قطني عالي الجودة بلون أزرق سماوي يناسب جميع المناسبات',
    price: '85',
    category: 'قميص',
    colors: ['أزرق', 'أبيض'],
    sizes: ['L', 'M', 'XL'],
    stock: '45',
    status: 'نشط',
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
  },
];

const Products = () => {
  const [products, setProducts] = useState(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const categories = ['all', 'قميص', 'فستان', 'شورت', 'بنطلون'];
  const statuses = [
    { value: 'all', label: 'الكل' },
    { value: 'نشط', label: 'نشط' },
    { value: 'مؤرشف', label: 'مؤرشف' },
  ];

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  });

  const handleAdd = (product) => {
    const newProduct = { ...product, id: Date.now() };
    setProducts((prev) => [...prev, newProduct]);
    showToast('تم إضافة المنتج');
  };

  const handleEdit = (product) => {
    setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
    showToast('تم تحديث المنتج');
  };

  const handleArchiveToggle = (product) => {
    const newStatus = product.status === 'مؤرشف' ? 'نشط' : 'مؤرشف';
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, status: newStatus } : p))
    );
    showToast(newStatus === 'مؤرشف' ? 'تم أرشفة المنتج' : 'تم إلغاء أرشفة المنتج');
    setArchiveTarget(null);
  };

  const openArchiveConfirm = (product) => {
    setArchiveTarget(product);
  };

  const openAdd = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleSave = (productData) => {
    if (editingProduct) {
      handleEdit({ ...productData, id: editingProduct.id });
    } else {
      handleAdd(productData);
    }
  };

  return (
    <div className="products-page">
      <header className="page-header products-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">إدارة المنتجات</h1>
          <p className="page-subtitle">إدارة كتالوج المنتجات</p>
        </div>
      </header>

      <div className="products-controls">
        <button className="add-product-btn" onClick={openAdd}>
          <Plus size={18} />
          إضافة منتج
        </button>

        <div className="filter-dropdown">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-dropdown">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">جميع التصنيفات</option>
            {categories.filter((c) => c !== 'all').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="البحث عن منتج..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="products-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={openEdit}
              onArchive={openArchiveConfirm}
            />
          ))
        ) : (
          <p className="no-results">لا توجد منتجات تطابق بحثك.</p>
        )}
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        product={editingProduct}
      />

      <ArchiveConfirmModal
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && handleArchiveToggle(archiveTarget)}
        product={archiveTarget}
        action={archiveTarget?.status === 'مؤرشف' ? 'restore' : 'archive'}
      />

      {toast && (
        <div className="toast-notification">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default Products;
