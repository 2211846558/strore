import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getWalletBalance, getStoreWalletBalance, chargeStoreWallet, withdrawStoreWallet } from '../wallet'

const WALLET_KEY = 'wallet'

export function useWalletBalance() {
  return useQuery({
    queryKey: [WALLET_KEY],
    queryFn: () => getStoreWalletBalance(),
    staleTime: 30 * 1000,
  })
}

export function useChargeWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: chargeStoreWallet,
    onSuccess: () => qc.invalidateQueries({ queryKey: [WALLET_KEY] }),
  })
}

export function useWithdrawWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: withdrawStoreWallet,
    onSuccess: () => qc.invalidateQueries({ queryKey: [WALLET_KEY] }),
  })
}
