import React, { useState } from 'react';
import { Search, Plus, Trash2, Edit2, CheckCircle2 } from 'lucide-react';
import OfferModal from '../components/offers/OfferModal';
import './Offers.css';

const AVAILABLE_PRODUCTS = [
  'قميص قطني أزرق', 'قميص قطني أبيض', 'فستان صيفي', 'فستان شتوي',
  'شورت رياضي', 'بنطلون جينز', 'بنطلون كاجوال', 'جاكيت شتوي', 'حذاء رياضي'
];

const initialOffers = [
  {
    id: 1,
    name: 'عرض نهاية الموسم',
    type: 'نسبة مئوية %',
    value: 30,
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    status: 'معطل',
    active: false,
    products: ['جاكيت شتوي'],
  },
  {
    id: 2,
    name: 'تخفيضات الجمعة',
    type: 'قيمة ثابتة',
    value: 50,
    startDate: '2026-05-10',
    endDate: '2026-05-10',
    status: 'مجدول',
    active: false,
    products: ['حذاء رياضي'],
  },
  {
    id: 3,
    name: 'خصم الصيف',
    type: 'نسبة مئوية %',
    value: 20,
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    status: 'نشط',
    active: true,
    products: ['قميص قطني', 'بنطال جينز'],
  },
];

const Offers = () => {
  const [offers, setOffers] = useState(initialOffers);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const filteredOffers = offers.filter((o) =>
    o.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = (offer) => {
    const newOffer = { ...offer, id: Date.now() };
    setOffers((prev) => [...prev, newOffer]);
    showToast('تم إنشاء الحملة بنجاح');
  };

  const handleEdit = (offer) => {
    setOffers((prev) => prev.map((o) => (o.id === offer.id ? offer : o)));
    showToast('تم تحديث الحملة');
  };

  const handleDelete = (id) => {
    setOffers((prev) => prev.filter((o) => o.id !== id));
    showToast('تم حذف الحملة');
  };

  const handleToggleActive = (id) => {
    setOffers((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const newActive = !o.active;
        return {
          ...o,
          active: newActive,
          status: newActive ? 'نشط' : 'معطل',
        };
      })
    );
  };

  const openAdd = () => {
    setEditingOffer(null);
    setIsModalOpen(true);
  };

  const openEdit = (offer) => {
    setEditingOffer(offer);
    setIsModalOpen(true);
  };

  const handleSave = (offerData) => {
    if (editingOffer) {
      handleEdit({ ...offerData, id: editingOffer.id });
    } else {
      handleAdd(offerData);
    }
  };

  const getStatusClass = (status) => {
    if (status === 'نشط') return 'status-active';
    if (status === 'معطل') return 'status-inactive';
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
        <button className="add-offer-btn" onClick={openAdd}>
          <Plus size={18} />
          إنشاء حملة تخفيض
        </button>
      </div>

      <div className="offers-grid">
        {filteredOffers.length > 0 ? (
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
                  {offer.products.map((p, idx) => (
                    <span key={idx} className="product-tag">{p}</span>
                  ))}
                </div>
              </div>

              <div className="offer-toggle-row">
                <span className="toggle-label">تفعيل</span>
                <button
                  className={`toggle-switch ${offer.active ? 'active' : ''}`}
                  onClick={() => handleToggleActive(offer.id)}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>

              <div className="offer-actions">
                <button className="offer-btn delete-btn" onClick={() => handleDelete(offer.id)}>
                  <Trash2 size={16} />
                </button>
                <button className="offer-btn edit-btn" onClick={() => openEdit(offer)}>
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

      <OfferModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        onValidationError={showToast}
        offer={editingOffer}
        availableProducts={AVAILABLE_PRODUCTS}
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
