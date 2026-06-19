import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchChats, fetchChatMessages, sendChatMessage } from '../chat'

export const CHATS_KEY = 'chats'
export const CHAT_MESSAGES_KEY = 'chat'

/** تحديث الرسائل كل 3 ثوانٍ عند فتح محادثة */
const LIVE_MESSAGES_INTERVAL = 3000
/** تحديث قائمة المحادثات كل 5 ثوانٍ */
const LIVE_CHATS_INTERVAL = 5000
/** تحديث عداد الرسائل غير المقروءة عند إغلاق الشات */
const CHATS_BACKGROUND_INTERVAL = 10000

export function useChats({ storeId } = {}, options = {}) {
  const { enabled = true, refetchInterval = LIVE_CHATS_INTERVAL } = options
  return useQuery({
    queryKey: [CHATS_KEY, storeId],
    queryFn: () => fetchChats({ storeId }),
    enabled: Boolean(storeId) && enabled,
    staleTime: 0,
    refetchInterval: enabled ? refetchInterval : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  })
}

export function useChatMessages(chatId, options = {}) {
  const { enabled = true, refetchInterval = LIVE_MESSAGES_INTERVAL } = options
  return useQuery({
    queryKey: [CHAT_MESSAGES_KEY, chatId],
    queryFn: () => fetchChatMessages(chatId),
    enabled: Boolean(chatId) && enabled,
    staleTime: 0,
    refetchInterval: Boolean(chatId) && enabled ? refetchInterval : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, message }) => sendChatMessage(orderId, message),
    onSuccess: (newMessage, { orderId }) => {
      qc.setQueryData([CHAT_MESSAGES_KEY, orderId], (old) => {
        const list = Array.isArray(old) ? old : []
        if (list.some((m) => m.id === newMessage.id)) return list
        return [...list, newMessage]
      })
      qc.invalidateQueries({ queryKey: [CHATS_KEY] })
    },
  })
}

export { LIVE_MESSAGES_INTERVAL, LIVE_CHATS_INTERVAL, CHATS_BACKGROUND_INTERVAL }
