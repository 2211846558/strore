import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAvailableCampaigns, subscribeToCampaign } from '../campaigns'

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchAvailableCampaigns,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSubscribeToCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: subscribeToCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}
