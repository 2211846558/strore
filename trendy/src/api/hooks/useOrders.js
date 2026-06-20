import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAllOrders, fetchOrder, updateOrderStatus, cancelOrder,
  prepareOrder, confirmOrderDelivery,
} from '../orders'

export const ORDERS_KEY = 'orders'

export function useOrders(filters = {}) {
  return useQuery({
    queryKey: [ORDERS_KEY, filters],
    queryFn: () => fetchAllOrders(filters),
    staleTime: 30 * 1000,
    refetchInterval: 120 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useOrder(id) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, comment }) => updateOrderStatus(id, status, comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }) => cancelOrder(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}

export function usePrepareOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => prepareOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}

export function useConfirmDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: confirmOrderDelivery,
    onSuccess: () => qc.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}
