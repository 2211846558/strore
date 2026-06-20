import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAllPromotions, createPromotion, updatePromotion, deletePromotion, togglePromotion } from '../promotions'

const PROMO_KEY = 'promotions'

export function usePromotions(filters = {}) {
  return useQuery({
    queryKey: [PROMO_KEY, filters],
    queryFn: () => fetchAllPromotions(filters),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPromotion,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROMO_KEY] }),
  })
}

export function useUpdatePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => updatePromotion(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROMO_KEY] }),
  })
}

export function useTogglePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: togglePromotion,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROMO_KEY] }),
  })
}

export function useDeletePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePromotion,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROMO_KEY] }),
  })
}
