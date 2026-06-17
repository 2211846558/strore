import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPlans, subscribeToPlan } from '../plans'

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: fetchPlans,
    staleTime: 60 * 60 * 1000,
  })
}

export function useSubscribeToPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: subscribeToPlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['currentUser'] })
      qc.invalidateQueries({ queryKey: ['plans'] })
    },
  })
}
