import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchInventory, fetchShipments, createShipment, updateShipment,
  adjustInventory, archiveShipment, updateShipmentStatus,
} from '../inventory'

const INVENTORY_KEY = 'inventory'
export const SHIPMENTS_KEY = 'shipments'

export function useInventory(filters = {}) {
  return useQuery({
    queryKey: [INVENTORY_KEY, filters],
    queryFn: () => fetchInventory(filters),
    staleTime: 30 * 1000,
  })
}

export function useShipments(filters = {}) {
  return useQuery({
    queryKey: [SHIPMENTS_KEY, filters],
    queryFn: () => fetchShipments(filters),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateShipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createShipment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SHIPMENTS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
    },
  })
}

export function useUpdateShipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => updateShipment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SHIPMENTS_KEY] }),
  })
}

export function useArchiveShipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shipment, storeId }) => archiveShipment(shipment, { storeId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SHIPMENTS_KEY] }),
  })
}

export function useUpdateShipmentStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shipment, targetStatus, storeId }) =>
      updateShipmentStatus(shipment, targetStatus, { storeId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SHIPMENTS_KEY] }),
  })
}

export function useAdjustInventory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adjustInventory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
      qc.invalidateQueries({ queryKey: [SHIPMENTS_KEY] })
    },
  })
}
