import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPosInit, fetchPosCart, addToPosCart, removeFromPosCart, checkoutPosCart } from '../pos'

const POS_CART_KEY = 'posCart'

export function usePosInit() {
  return useQuery({
    queryKey: ['posInit'],
    queryFn: fetchPosInit,
    staleTime: 15 * 1000,
  })
}

export function usePosCart() {
  return useQuery({
    queryKey: [POS_CART_KEY],
    queryFn: fetchPosCart,
    staleTime: 15 * 1000,
  })
}

export function useAddToCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addToPosCart,
    onSuccess: () => qc.invalidateQueries({ queryKey: [POS_CART_KEY] }),
  })
}

export function useRemoveFromCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeFromPosCart,
    onSuccess: () => qc.invalidateQueries({ queryKey: [POS_CART_KEY] }),
  })
}

export function useCheckoutCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: checkoutPosCart,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POS_CART_KEY] })
      qc.invalidateQueries({ queryKey: ['posInit'] })
    },
  })
}
