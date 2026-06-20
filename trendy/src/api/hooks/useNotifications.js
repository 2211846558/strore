import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../notifications'

export const NOTIF_KEY = 'notifications'

export function useNotifications(filters = {}) {
  return useQuery({
    queryKey: [NOTIF_KEY, filters],
    queryFn: () => fetchNotifications(filters),
    staleTime: 30 * 1000,
    refetchInterval: 120 * 1000,
  })
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: [NOTIF_KEY] }),
  })
}

export function useMarkAllAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: [NOTIF_KEY] }),
  })
}
