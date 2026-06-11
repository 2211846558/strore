import React from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import './ConfirmDialog.css';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'تأكيد العملية',
  message,
  confirmText = 'موافق',
  cancelText = 'إلغاء',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={!isLoading ? onClose : undefined}>
      <div className="confirm-dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <h2 className="confirm-dialog-title">{title}</h2>
          <button
            type="button"
            className="confirm-dialog-close"
            onClick={onClose}
            disabled={isLoading}
            aria-label="إغلاق"
          >
            <X size={24} />
          </button>
        </div>

        <div className="confirm-dialog-body">
          <div className="confirm-dialog-icon">
            <CheckCircle2 size={40} />
          </div>
          <p className="confirm-dialog-message">{message}</p>
        </div>

        <div className="confirm-dialog-footer">
          <button
            type="button"
            className="confirm-dialog-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="confirm-dialog-confirm"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'جاري التنفيذ...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
