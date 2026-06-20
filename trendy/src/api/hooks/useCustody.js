import { useQuery } from '@tanstack/react-query'
import { fetchCustodySummary, fetchCustodyLogs } from '../custody'

export function useCustodySummary(filters = {}) {
  return useQuery({
    queryKey: ['custodySummary', filters],
    queryFn: () => fetchCustodySummary(filters),
    staleTime: 30 * 1000,
  })
}

export function useCustodyLogs(filters = {}) {
  return useQuery({
    queryKey: ['custodyLogs', filters],
    queryFn: () => fetchCustodyLogs(filters),
    staleTime: 30 * 1000,
  })
}
