import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Plus, CheckCircle2, Eye } from 'lucide-react';

import ProductModal from '../components/products/ProductModal';
import ProductVariantModal from '../components/products/ProductVariantModal';
import ArchiveConfirmModal from '../components/products/ArchiveConfirmModal';
import ProductDetailModal from '../components/products/ProductDetailModal';
import { getApiErrorMessage } from '../api/stores';
import { fetchManagedProductDetails } from '../api/products';
import {
  useProducts,
  useCategories,
  useCreateProduct,
  useUpdateProduct,
  useArchiveProduct,
  useRestoreProduct,
} from '../api/hooks/useProducts';
import { useStore } from '../context/AuthContext';
import './Products.css';

const STATUS_OPTIONS = [
  { value: 'all', label: 'الكل' },
  { value: 'active', label: 'نشط' },
  { value: 'archived', label: 'مؤرشف' },
];

const PRODUCTS_KEY = 'products';

const Products = () => {
  const { storeId } = useStore();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [variantProduct, setVariantProduct] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filters = useMemo(
    () => ({ storeId, name: debouncedSearch, categoryId: categoryFilter, status: statusFilter }),
    [storeId, debouncedSearch, categoryFilter, statusFilter],
  );

  const { data: products = [], isLoading: loading, error } = useProducts(filters);
  const { data: categories = [] } = useCategories();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const archiveMutation = useArchiveProduct();
  const restoreMutation = useRestoreProduct();

  const handleSave = async (formData) => {
    if (!storeId) {
      throw new Error('لم يتم تحديد المتجر. يرجى تسجيل الدخول مرة أخرى.');
    }
    const payload = {
      storeId,
      name: formData.name,
      sku: formData.sku,
      description: formData.description,
      price: formData.price,
      categoryId: formData.categoryId,
      stock: formData.stock,
      imageFiles: formData.imageFiles,
      deletedImages: formData.deletedImageIds,
    };

    if (editingProduct) {
      const updated = await updateMutation.mutateAsync({ id: editingProduct.id, ...payload });
      const imageChanged = formData.imageFiles?.length || formData.deletedImageIds?.length;
      showToast(imageChanged ? 'تم تحديث المنتج وتعديل الصور' : 'تم تحديث المنتج');
      return updated;
    }

    await createMutation.mutateAsync(payload);
    setSearchQuery('');
    setDebouncedSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
    showToast('تم إضافة المنتج بنجاح');
  };

  const handleArchiveToggle = async (product) => {
    const isArchived = product.status === 'مؤرشف';
    try {
      if (isArchived) {
        await restoreMutation.mutateAsync(product.id);
        showToast('تم إلغاء أرشفة المنتج');
      } else {
        await archiveMutation.mutateAsync(product.id);
        showToast('تم أرشفة المنتج');
      }
      setArchiveTarget(null);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تنفيذ العملية'));
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

  const openDetails = (product) => {
    setDetailProduct(product);
  };

  const openEditFromDetails = async (details) => {
    setDetailProduct(null);
    try {
      const full = await fetchManagedProductDetails(details.id);
      setEditingProduct(full);
    } catch {
      setEditingProduct(details);
    }
    setIsModalOpen(true);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isArchiving = archiveMutation.isPending || restoreMutation.isPending;

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

      {error && <p className="products-error">{error?.message || 'تعذّر تحميل المنتجات'}</p>}

      <div className="products-table-wrapper">
        <table className="products-table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>SKU</th>
              <th>السعر</th>
              <th>الكمية الإجمالية</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="table-empty">جاري تحميل المنتجات...</td>
              </tr>
            ) : products.length > 0 ? (
              products.map((product) => {
                const isArchived = product.status === 'مؤرشف';
                return (
                  <tr key={product.id} className={isArchived ? 'row-archived' : ''}>
                     <td className="td-product-name">
                       <div className="product-name-cell">
                         <img
                           className="product-thumb"
                           src={product.image}
                           alt={product.name}
                           onError={(e) => { e.currentTarget.style.display = 'none'; }}
                         />
                         <div className="product-name-info">
                           <span className="pn-name">{product.name}</span>
                           {product.category && (
                             <span className="pn-category">{product.category}</span>
                           )}
                         </div>
                       </div>
                     </td>
                    <td className="td-sku">
                      <span className="sku-badge">{product.sku || '—'}</span>
                    </td>
                    <td className="td-price">
                      {product.price
                        ? <><strong>{product.price}</strong> <span className="price-currency">د.ل</span></>
                        : '—'}
                    </td>
                    <td className="td-qty">
                      {product.stock != null && product.stock !== ''
                        ? <span className="qty-pill">{product.stock}</span>
                        : <span className="qty-empty">—</span>}
                    </td>
                    <td className="td-status">
                      <span className={`status-badge ${isArchived ? 'status-archived' : 'status-active'}`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="td-actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="action-btn view-btn"
                          onClick={() => openDetails(product)}
                          title="عرض التفاصيل"
                        >
                          <Eye size={16} />
                        </button>
                        {!isArchived && (
                          <button
                            type="button"
                            className="row-btn btn-variant"
                            onClick={() => openVariants(product)}
                            title="التنوعات"
                          >
                            تنوع
                          </button>
                        )}
                        <button
                          type="button"
                          className={`row-btn ${isArchived ? 'btn-restore' : 'btn-archive'}`}
                          onClick={() => openArchiveConfirm(product)}
                          title={isArchived ? 'استعادة' : 'أرشفة'}
                        >
                          {isArchived ? 'استعادة' : 'أرشفة'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="table-empty">لا توجد منتجات تطابق بحثك.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ProductModal
        isOpen={isModalOpen}
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
        onVariantAdded={() => {
          showToast('تم إضافة التنوع بنجاح');
          queryClient.invalidateQueries({ queryKey: [PRODUCTS_KEY] });
        }}
      />

      <ArchiveConfirmModal
        isOpen={!!archiveTarget}
        onClose={() => !isArchiving && setArchiveTarget(null)}
        onConfirm={() => archiveTarget && handleArchiveToggle(archiveTarget)}
        product={archiveTarget}
        action={archiveTarget?.status === 'مؤرشف' ? 'restore' : 'archive'}
      />

      <ProductDetailModal
        isOpen={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        product={detailProduct}
        storeId={storeId}
        onEdit={openEditFromDetails}
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
