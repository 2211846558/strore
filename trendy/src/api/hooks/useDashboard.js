import { useQuery } from '@tanstack/react-query'
import { fetchStoreDashboard, fetchDashboardStats } from '../dashboard'

export function useDashboard(storeId) {
  return useQuery({
    queryKey: ['dashboard', storeId],
    queryFn: () => fetchStoreDashboard({ storeId }),
    staleTime: 15 * 1000,
  })
}

export function useDashboardStats(storeId) {
  return useQuery({
    queryKey: ['dashboardStats', storeId],
    queryFn: () => fetchDashboardStats({ storeId }),
    staleTime: 15 * 1000,
  })
}
