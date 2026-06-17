import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchChatMessages, sendChatMessage } from '../chat'

export function useChatMessages(orderId) {
  return useQuery({
    queryKey: ['chat', orderId],
    queryFn: () => fetchChatMessages(orderId),
    enabled: Boolean(orderId),
    staleTime: 15 * 1000,
    refetchInterval: 60 * 1000,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sendChatMessage,
    onSuccess: (_, { orderId }) =>
      qc.invalidateQueries({ queryKey: ['chat', orderId] }),
  })
}
