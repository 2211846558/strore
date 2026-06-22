import React from 'react';
import { X, Archive } from 'lucide-react';
import '../products/ArchiveConfirmModal.css';
import './ShipmentArchiveConfirmModal.css';

const ShipmentArchiveConfirmModal = ({ isOpen, onClose, onConfirm, shipment, isArchiving }) => {
  if (!isOpen || !shipment) return null;

  return (
    <div className="modal-overlay shipment-archive-overlay" onClick={onClose}>
      <div className="modal-content archive-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">تأكيد أرشفة الشحنة</h2>
          <button className="close-button" onClick={onClose} type="button" disabled={isArchiving}>
            <X size={24} />
          </button>
        </div>

        <div className="archive-modal-body">
          <div className="archive-icon archive">
            <Archive size={40} />
          </div>
          <p className="archive-message">
            هل أنت متأكد من أرشفة الشحنة «{shipment.code}»؟
            <br />
            سيتم إخفاؤها من القوائم النشطة دون حذفها.
            <br />
            <strong>لا يمكن الأرشفة إذا كانت الشحنة لا تزال تحتوي على كميات متوفرة للبيع.</strong>
          </p>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose} type="button" disabled={isArchiving}>
            إلغاء
          </button>
          <button
            className="save-button archive-btn"
            onClick={onConfirm}
            type="button"
            disabled={isArchiving}
          >
            {isArchiving ? 'جاري الأرشفة...' : 'أرشفة الشحنة'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShipmentArchiveConfirmModal;
