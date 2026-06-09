import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, CheckCircle2 } from 'lucide-react';
import ProductCard from '../components/products/ProductCard';
import ProductModal from '../components/products/ProductModal';
import ProductVariantModal from '../components/products/ProductVariantModal';
import ArchiveConfirmModal from '../components/products/ArchiveConfirmModal';
import {
  fetchCategories,
  fetchStoreProducts,
  fetchProductDetails,
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct,
} from '../api/products';
import { getApiErrorMessage } from '../api/stores';
import { useAuth } from '../context/AuthContext';
import './Products.css';

const STATUS_OPTIONS = [
  { value: 'all', label: 'الكل' },
  { value: 'active', label: 'نشط' },
  { value: 'archived', label: 'مؤرشف' },
];

const Products = () => {
  const { storeId } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null);
  const [error, setError] = useState('');

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchStoreProducts({
        storeId,
        name: debouncedSearch,
        categoryId: categoryFilter,
        status: statusFilter,
      });
      setProducts(list);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل المنتجات'));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, debouncedSearch, categoryFilter, statusFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSave = async (formData) => {
    setIsSaving(true);
    try {
      const payload = {
        storeId,
        name: formData.name,
        description: formData.description,
        price: formData.price,
        categoryId: formData.categoryId,
        stock: formData.stock,
        imageFiles: formData.imageFiles,
      };

      if (editingProduct) {
        const updated = await updateProduct(editingProduct.id, payload);
        setProducts((prev) =>
          prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
        );
        showToast(
          formData.imageFiles?.length
            ? 'تم تحديث المنتج وإضافة الصور'
            : 'تم تحديث المنتج',
        );
        await loadProducts();
        return updated;
      }

      const created = await createProduct(payload);
      setProducts((prev) => [created, ...prev]);
      showToast('تم إضافة المنتج بنجاح');
      await loadProducts();
      return created;
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveToggle = async (product) => {
    setIsArchiving(true);
    try {
      const isArchived = product.status === 'مؤرشف';
      if (isArchived) {
        await restoreProduct(product.id);
        showToast('تم إلغاء أرشفة المنتج');
      } else {
        await archiveProduct(product.id);
        showToast('تم أرشفة المنتج');
      }
      setArchiveTarget(null);
      await loadProducts();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تنفيذ العملية'));
    } finally {
      setIsArchiving(false);
    }
  };

  const openArchiveConfirm = (product) => {
    setArchiveTarget(product);
  };

  const openAdd = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openVariants = (product) => {
    setVariantProduct(product);
  };

  const openEdit = async (product) => {
    setLoadingEdit(true);
    setIsModalOpen(true);
    try {
      const details = await fetchProductDetails(product.id);
      setEditingProduct(details);
    } catch (err) {
      setIsModalOpen(false);
      showToast(getApiErrorMessage(err, 'تعذّر تحميل بيانات المنتج'));
    } finally {
      setLoadingEdit(false);
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
        <button className="add-product-btn" onClick={openAdd} type="button">
          <Plus size={18} />
          إضافة منتج
        </button>

        <div className="filter-dropdown">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-dropdown">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">جميع التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
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

      {error && <p className="products-error">{error}</p>}

      <div className="products-grid">
        {loading ? (
          <p className="no-results">جاري تحميل المنتجات...</p>
        ) : products.length > 0 ? (
          products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={openEdit}
              onArchive={openArchiveConfirm}
              onAddVariant={openVariants}
            />
          ))
        ) : (
          <p className="no-results">لا توجد منتجات تطابق بحثك.</p>
        )}
      </div>

      <ProductModal
        isOpen={isModalOpen && !loadingEdit}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSave}
        onOpenVariants={(product) => {
          setIsModalOpen(false);
          setEditingProduct(null);
          openVariants(product);
        }}
        product={editingProduct}
        categories={categories}
        isSaving={isSaving}
      />

      <ProductVariantModal
        isOpen={!!variantProduct}
        onClose={() => setVariantProduct(null)}
        product={variantProduct}
        storeId={storeId}
        onVariantAdded={() => showToast('تم إضافة التنوع بنجاح')}
      />

      <ArchiveConfirmModal
        isOpen={!!archiveTarget}
        onClose={() => !isArchiving && setArchiveTarget(null)}
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
