import React from 'react';
import { X, ExternalLink, Edit } from 'lucide-react';
import './StoreDetailsModal.css';

const DetailRow = ({ label, value, children }) => {
  const content = children ?? value;
  if (content == null || content === '' || content === '—') return null;

  return (
    <div className="store-details-row">
      <span className="store-details-label">{label}</span>
      <span className="store-details-value">{content}</span>
    </div>
  );
};

const StoreDetailsModal = ({ isOpen, onClose, store, onEdit }) => {
  if (!isOpen || !store) return null;

  const mapUrl = store.googleMapUrl?.trim();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content store-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 className="modal-title">تفاصيل المتجر</h2>
            <p className="modal-subtitle">{store.name || '—'}</p>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="إغلاق">
            <X size={24} />
          </button>
        </div>

        <div className="store-details-body">
          {store.image && (
            <div className="store-details-logo-wrap">
              <img src={store.image} alt={store.name} className="store-details-logo" />
            </div>
          )}

          <div className="store-details-section">
            <h3 className="store-details-section-title">بيانات مدير المتجر</h3>
            <DetailRow label="اسم المدير" value={store.managerName} />
            <DetailRow label="البريد الإلكتروني للمدير" value={store.managerEmail} />
            <DetailRow label="رقم هاتف المدير" value={store.managerPhone} />
          </div>

          <div className="store-details-section">
            <h3 className="store-details-section-title">بيانات المتجر</h3>
            <DetailRow label="رقم كود المتجر" value={store.storeCode} />
            <DetailRow label="اسم المتجر" value={store.name} />
            <DetailRow label="وصف المتجر" value={store.description} />
            <DetailRow label="نوع المتجر" value={store.typeLabel} />
            <DetailRow label="نوع الكيان" value={store.entityTypeLabel} />
            <DetailRow label="رقم هاتف المتجر" value={store.phone} />
            <DetailRow label="البريد الإلكتروني للمتجر" value={store.email} />
            <DetailRow label="المنطقة / الموقع" value={store.location} />
            <DetailRow label="رابط خريطة Google">
              {mapUrl ? (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="store-details-link"
                  dir="ltr"
                >
                  {mapUrl}
                  <ExternalLink size={14} />
                </a>
              ) : null}
            </DetailRow>
            <DetailRow label="الرقم الضريبي" value={store.merchantData?.tax_number} />
            <DetailRow
              label="رقم السجل التجاري"
              value={store.commercialRegisterNumber || store.merchantData?.commercial_register}
            />
            <DetailRow label="الحالة">
              <span className={`store-details-status status-${store.statusRaw}`}>
                {store.statusLabel}
              </span>
            </DetailRow>
            <DetailRow label="التقييم العام" value={store.rating} />
            <DetailRow label="ملاحظات" value={store.notes} />
          </div>
        </div>

        <div className="modal-footer store-details-footer">
          {onEdit && (
            <button type="button" className="edit-store-details-btn" onClick={onEdit}>
              <Edit size={16} />
              تعديل بيانات المتجر
            </button>
          )}
          <button type="button" className="cancel-button" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreDetailsModal;
