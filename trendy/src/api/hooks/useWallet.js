import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getWalletBalance, getStoreWalletBalance, chargeStoreWallet, withdrawStoreWallet } from '../wallet'
import { useAuth } from '../../context/AuthContext'
import { resolveManagedStoreId } from '../auth'

const WALLET_KEY = 'wallet'

export function useWalletBalance(options = {}) {
  const { storeId, user } = useAuth()
  const effectiveStoreId = resolveManagedStoreId(user, storeId) ?? storeId
  return useQuery({
    queryKey: [WALLET_KEY, effectiveStoreId],
    queryFn: () => getStoreWalletBalance({ storeId: effectiveStoreId }),
    staleTime: 30 * 1000,
    ...options,
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
