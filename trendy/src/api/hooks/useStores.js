import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchStore, fetchZones, submitStoreJoinRequest, updateStore } from '../stores'

export function useStore(storeId) {
  return useQuery({
    queryKey: ['store', storeId],
    queryFn: () => fetchStore(storeId),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(storeId),
  })
}

export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
    staleTime: 60 * 60 * 1000,
  })
}

export function useSubmitJoinRequest() {
  return useMutation({
    mutationFn: ({ form, logoFile }) => submitStoreJoinRequest(form, logoFile),
  })
}

export function useUpdateStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => updateStore(id, data),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['store', id] }),
  })
}
