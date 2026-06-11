import React, { useState, useEffect } from 'react';
import ConfirmDialog from '../common/ConfirmDialog';
import {
  SHIPMENT_STATUS_EDIT_OPTIONS,
  resolveShipmentSelectStatus,
} from '../../api/inventory';
import { SHIPMENT_STATUS_CONFIRM } from './shipmentStatusConfirm';
import './ShipmentStatusControl.css';

function ShipmentStatusControl({
  shipment,
  onStatusChange,
  disabled = false,
}) {
  const currentStatus = resolveShipmentSelectStatus(shipment.statusRaw);
  const [selectValue, setSelectValue] = useState(currentStatus);
  const [pendingAction, setPendingAction] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmConfig = pendingAction ? SHIPMENT_STATUS_CONFIRM[pendingAction] : null;

  useEffect(() => {
    setSelectValue(resolveShipmentSelectStatus(shipment.statusRaw));
  }, [shipment.id, shipment.statusRaw]);

  const resetSelection = () => {
    setSelectValue(currentStatus);
    setPendingAction(null);
  };

  const handleChange = (event) => {
    const value = resolveShipmentSelectStatus(event.target.value);
    if (value === currentStatus) return;

    setSelectValue(value);
    setPendingAction(value);
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setIsConfirming(true);
    try {
      await onStatusChange(shipment, pendingAction);
      setPendingAction(null);
    } catch {
      resetSelection();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <>
      <div
        className="filter-dropdown shipment-status-filter"
        onClick={(e) => e.stopPropagation()}
      >
        <select
          className="shipment-status-select"
          value={selectValue}
          onChange={handleChange}
          disabled={disabled || isConfirming}
          title="تغيير حالة الشحنة"
        >
          {SHIPMENT_STATUS_EDIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <ConfirmDialog
        isOpen={!!confirmConfig}
        onClose={() => !isConfirming && resetSelection()}
        onConfirm={handleConfirm}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        isLoading={isConfirming}
      />
    </>
  );
}

export default ShipmentStatusControl;
