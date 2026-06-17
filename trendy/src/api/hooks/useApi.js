import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../client'

export function useApiQuery({ key, path, options = {}, queryOptions = {} }) {
  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: () => apiRequest(path, options),
    ...queryOptions,
  })
}

export function useApiMutation({ path, options = {}, invalidateKeys = [] }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => apiRequest(path, { ...options, body }),
    onSuccess: () => {
      invalidateKeys.forEach(key =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
    },
  })
}
