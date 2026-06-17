import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  storeLogin, storeLogout, fetchCurrentUser, verifyStoreJoin,
  forgotPassword, verifyPasswordOtp, resetPassword,
  getAuthToken,
} from '../auth'

export function useCurrentUser() {
  const token = getAuthToken()
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: Boolean(token),
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: storeLogin,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['currentUser'] }),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: storeLogout,
    onSuccess: () => qc.clear(),
  })
}

export { fetchCurrentUser as fetchCurrentUserFn }
