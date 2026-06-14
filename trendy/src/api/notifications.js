import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';

/**
 * Fetch notifications list
 */
export async function fetchNotifications(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.perPage) query.append('per_page', params.perPage);
  
  const queryString = query.toString();
  const path = `${API_ENDPOINTS.notifications}${queryString ? `?${queryString}` : ''}`;
  return apiRequest(path);
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(id) {
  return apiRequest(API_ENDPOINTS.notificationRead(id), {
    method: 'PATCH',
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  return apiRequest(API_ENDPOINTS.notificationsReadAll, {
    method: 'POST',
  });
}

/**
 * Manually trigger a notification (for testing/developer trigger)
 */
export async function triggerNotification({ event, storeId, data = {} }) {
  return apiRequest(API_ENDPOINTS.notificationTrigger, {
    method: 'POST',
    body: {
      event,
      store_id: storeId ? Number(storeId) : undefined,
      data,
    },
  });
}
