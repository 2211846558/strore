import { useQuery } from '@tanstack/react-query'
import {
  fetchRevenueOverview, fetchProfitOverview,
  fetchAllTransactions, fetchMonthlyRevenueChart,
  fetchAccountStatement,
} from '../finance'

export const TRANSACTIONS_KEY = 'transactions'

export function useRevenueOverview(filters = {}) {
  return useQuery({
    queryKey: ['revenueOverview', filters],
    queryFn: () => fetchRevenueOverview(filters),
    staleTime: 30 * 1000,
  })
}

export function useProfitOverview(filters = {}) {
  return useQuery({
    queryKey: ['profitOverview', filters],
    queryFn: () => fetchProfitOverview(filters),
    staleTime: 30 * 1000,
  })
}

export function useTransactions(filters = {}) {
  return useQuery({
    queryKey: [TRANSACTIONS_KEY, filters],
    queryFn: () => fetchAllTransactions(filters),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useMonthlyRevenueChart(monthCount = 5) {
  return useQuery({
    queryKey: ['monthlyRevenueChart', monthCount],
    queryFn: () => fetchMonthlyRevenueChart(monthCount),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAccountStatement(filters = {}) {
  return useQuery({
    queryKey: ['accountStatement', filters],
    queryFn: () => fetchAccountStatement(filters),
    staleTime: 30 * 1000,
  })
}
