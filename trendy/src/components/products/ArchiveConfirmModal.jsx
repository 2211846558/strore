import React from 'react';
import { X, Archive, ArchiveRestore } from 'lucide-react';
import './ArchiveConfirmModal.css';

const ArchiveConfirmModal = ({ isOpen, onClose, onConfirm, product, action }) => {
  if (!isOpen || !product) return null;

  const isArchive = action === 'archive';
  const title = isArchive ? 'تأكيد أرشفة المنتج' : 'تأكيد إلغاء الأرشفة';
  const message = isArchive
    ? `هل أنت متأكد من أرشفة "${product.name}"؟ سيتم إخفاؤه من العرض العام.`
    : `هل أنت متأكد من إلغاء أرشفة "${product.name}"؟ سيعود للعرض العام.`;
  const confirmText = isArchive ? 'أرشفة المنتج' : 'إلغاء الأرشفة';
  const Icon = isArchive ? Archive : ArchiveRestore;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content archive-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="archive-modal-body">
          <div className={`archive-icon ${isArchive ? 'archive' : 'restore'}`}>
            <Icon size={40} />
          </div>
          <p className="archive-message">{message}</p>
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            إلغاء
          </button>
          <button
            className={`save-button ${isArchive ? 'archive-btn' : 'restore-btn'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArchiveConfirmModal;
