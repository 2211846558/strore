import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, CheckCircle2, Eye } from 'lucide-react';
import OfferModal from '../components/offers/OfferModal';
import OfferDetailModal from '../components/offers/OfferDetailModal';
import {
  fetchPromotion,
  buildPromotionPayload,
  buildPromotionUpdatePayload,
} from '../api/promotions';
import { useProducts } from '../api/hooks/useProducts';
import {
  usePromotions,
  useCreatePromotion,
  useUpdatePromotion,
  useTogglePromotion,
  useDeletePromotion,
} from '../api/hooks/usePromotions';
import { getApiErrorMessage } from '../api/stores';
import { useStore } from '../context/AuthContext';
import './Offers.css';

const Offers = () => {
  const { storeId } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailOffer, setDetailOffer] = useState(null);
  const [editingOffer, setEditingOffer] = useState(null);
  const [loadingOfferDetails, setLoadingOfferDetails] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const { data: offers = [], isLoading: loading, error } = usePromotions({ storeId, maxPages: 3 });
  const { data: products = [] } = useProducts({ storeId, status: 'active', perPage: 100 });

  const catalogProducts = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.name })),
    [products],
  );

  const catalogProductsWithPrice = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.name, price: p.price })),
    [products],
  );

  const filteredOffers = offers.filter((o) =>
    o.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const createMutation = useCreatePromotion();
  const updateMutation = useUpdatePromotion();
  const toggleMutation = useTogglePromotion();
  const deleteMutation = useDeletePromotion();

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleSave = async (formData) => {
    const payload = editingOffer
      ? buildPromotionUpdatePayload(formData, { storeId })
      : buildPromotionPayload(formData, { storeId, forCreate: true });

    if (editingOffer) {
      await updateMutation.mutateAsync({ id: editingOffer.id, ...payload });
      showToast('تم تحديث الحملة');
    } else {
      await createMutation.mutateAsync(payload);
      showToast('تم إنشاء الحملة بنجاح');
    }
    setIsModalOpen(false);
    setEditingOffer(null);
  };

  const handleDelete = async (id) => {
    try {
      await deleteMutation.mutateAsync(id);
      showToast('تم حذف الحملة');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر حذف الحملة'));
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await toggleMutation.mutateAsync(id);
      showToast('تم تحديث حالة الحملة');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تغيير حالة الحملة'));
    }
  };

  const openAdd = () => {
    setEditingOffer(null);
    setIsModalOpen(true);
  };

  const openEdit = async (offer) => {
    setLoadingOfferDetails(true);
    try {
      const full = await fetchPromotion(offer.id);
      setEditingOffer(full);
      setIsModalOpen(true);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تحميل تفاصيل الحملة'));
    } finally {
      setLoadingOfferDetails(false);
    }
  };

  const openDetails = async (offer) => {
    setIsDetailOpen(true);
    setDetailOffer(null);
    setLoadingOfferDetails(true);
    try {
      const full = await fetchPromotion(offer.id);
      setDetailOffer(full);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر تحميل تفاصيل العرض'));
      setIsDetailOpen(false);
    } finally {
      setLoadingOfferDetails(false);
    }
  };

  const getStatusClass = (status) => {
    if (status === 'نشط') return 'status-active';
    if (status === 'معطل' || status === 'منتهي') return 'status-inactive';
    return 'status-scheduled';
  };

  return (
    <div className="offers-page">
      <header className="page-header offers-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">إدارة العروض والخصومات</h1>
          <p className="page-subtitle">إنشاء وإدارة حملات التخفيض</p>
        </div>
      </header>

      <div className="offers-controls">
        <button className="add-offer-btn" onClick={openAdd} type="button" disabled={loading}>
          <Plus size={18} />
          إنشاء حملة تخفيض
        </button>
      </div>

      {error && <p className="offers-error">{error?.message || 'تعذّر تحميل الحملات'}</p>}

      <div className="offers-grid">
        {loading ? (
          <p className="no-results">جاري تحميل الحملات...</p>
        ) : filteredOffers.length > 0 ? (
          filteredOffers.map((offer) => (
            <div key={offer.id} className="offer-card">
              <div className="offer-card-header">
                <div className="offer-header-main">
                  <span className={`offer-status-badge ${getStatusClass(offer.status)}`}>
                    {offer.status}
                  </span>
                  <h3 className="offer-name">{offer.name}</h3>
                </div>
                <span className="offer-value">
                  {offer.type === 'نسبة مئوية %' ? `${offer.value}%` : `د.ل ${offer.value}`}
                </span>
              </div>

              <div className="offer-dates">
                <div className="offer-date-row">
                  <span className="date-label">من:</span>
                  <span className="date-value">{offer.startDate}</span>
                </div>
                <div className="offer-date-row">
                  <span className="date-label">إلى:</span>
                  <span className="date-value">{offer.endDate}</span>
                </div>
              </div>

              <div className="offer-products">
                <span className="products-label">المنتجات المشمولة</span>
                <div className="products-tags">
                  {offer.products.length > 0 ? (
                    offer.products.map((p, idx) => (
                      <span key={idx} className="product-tag">
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="product-tag">—</span>
                  )}
                </div>
              </div>

              <div className="offer-toggle-row">
                <span className="toggle-label">تفعيل</span>
                <button
                  type="button"
                  className={`toggle-switch ${offer.statusRaw === 'active' ? 'active' : ''}`}
                  onClick={() => handleToggleActive(offer.id)}
                  disabled={toggleMutation.isPending || isSaving}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>

              <div className="offer-actions">
                <button
                  type="button"
                  className="offer-btn delete-btn"
                  onClick={() => handleDelete(offer.id)}
                  disabled={isSaving}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  type="button"
                  className="offer-btn view-btn"
                  onClick={() => openDetails(offer)}
                  disabled={isSaving || loadingOfferDetails}
                >
                  <Eye size={16} />
                  عرض التفاصيل
                </button>
                <button
                  type="button"
                  className="offer-btn edit-btn"
                  onClick={() => openEdit(offer)}
                  disabled={isSaving || loadingOfferDetails}
                >
                  <Edit2 size={16} />
                  تعديل
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="no-results">لا توجد عروض تطابق بحثك.</p>
        )}
      </div>

      <OfferDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailOffer(null);
        }}
        offer={detailOffer}
        catalogProducts={catalogProductsWithPrice}
        loading={loadingOfferDetails && !detailOffer}
      />

      <OfferModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isSaving) {
            setIsModalOpen(false);
            setEditingOffer(null);
          }
        }}
        onSave={handleSave}
        offer={editingOffer}
        catalogProducts={catalogProducts}
        isSaving={isSaving}
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

export default Offers;
