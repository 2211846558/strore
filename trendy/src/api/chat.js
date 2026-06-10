import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchAllOrders } from './orders';

function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.chats)) return payload.chats;
  return [];
}

function isChatListRouteError(err) {
  const msg = String(err?.message ?? '');
  return (
    /OrderController::show/i.test(msg) ||
    /must be of type int, string given/i.test(msg)
  );
}

function normalizeChatId(chatId) {
  const id = Number(chatId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('معرف المحادثة غير صالح');
  }
  return id;
}

function formatMessageTime(value) {
  if (!value) return '—';
  const raw = String(value);
  const date = new Date(raw.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return raw;

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'أمس';

  return date.toLocaleDateString('ar-LY', { day: 'numeric', month: 'short' });
}

function resolveSender(row) {
  const sender = String(row.sender_type ?? row.sender ?? row.from ?? '').toLowerCase();
  if (['store', 'store_manager', 'store_staff', 'merchant', 'admin'].includes(sender)) {
    return 'store';
  }
  return 'customer';
}

export function mapMessage(row) {
  return {
    id: row.id ?? `${row.created_at}-${row.message}`,
    text: row.message ?? row.body ?? row.content ?? row.text ?? '',
    sender: resolveSender(row),
    time: formatMessageTime(row.created_at ?? row.sent_at ?? row.time),
  };
}

export function mapChat(row) {
  const lastMessage = row.last_message ?? row.latest_message ?? null;

  return {
    id: Number(row.id ?? row.chat_id ?? row.order_id),
    customerName: row.customer_name ?? row.customer?.name ?? row.user?.name ?? '—',
    phone: row.customer_phone ?? row.customer?.phone ?? row.user?.phone ?? '',
    avatar: row.customer?.avatar ?? row.avatar ?? '',
    product: row.product_name ?? row.product?.name ?? row.subject ?? row.topic ?? '—',
    unread: Number(row.unread_count ?? row.unread ?? row.unread_messages ?? 0),
    lastTime: formatMessageTime(
      row.last_message_at ?? row.updated_at ?? lastMessage?.created_at ?? row.created_at,
    ),
    lastPreview:
      row.last_message_text ??
      lastMessage?.message ??
      lastMessage?.body ??
      lastMessage?.content ??
      '',
    messages: Array.isArray(row.messages) ? row.messages.map(mapMessage) : [],
  };
}

function mapOrderToChat(order) {
  const productName = order.products?.length
    ? order.products.map((p) => p.name).join('، ')
    : `طلب ${order.id}`;

  return {
    id: order.orderId,
    customerName: order.customerName,
    phone: order.phone,
    avatar: '',
    product: productName,
    unread: Number(order.raw?.unread_count ?? order.raw?.unread_messages ?? 0),
    lastTime: order.date,
    lastPreview: `طلب ${order.id} — ${order.status}`,
    messages: [],
  };
}

/**
 * GET /orders/chat — قائمة المحادثات
 * إذا تعارض المسار مع /orders/{id} نستخدم GET /orders كبديل
 */
export async function fetchChats({ storeId } = {}) {
  try {
    const res = await apiRequest(API_ENDPOINTS.ordersChat);
    return extractList(res).map((row) => mapChat(row));
  } catch (err) {
    if (!isChatListRouteError(err)) throw err;
  }

  const orders = await fetchAllOrders({ storeId });
  return orders.map(mapOrderToChat);
}

/**
 * GET /orders/chat/{id}/messages — رسائل محادثة
 */
export async function fetchChatMessages(chatId) {
  const id = normalizeChatId(chatId);
  const res = await apiRequest(API_ENDPOINTS.ordersChatMessages(id));
  const rows = extractList(res);
  return rows.map(mapMessage);
}

/**
 * POST /orders/chat/{id}/messages — إرسال رسالة
 */
export async function sendChatMessage(chatId, message) {
  const id = normalizeChatId(chatId);
  const text = message.trim();
  const res = await apiRequest(API_ENDPOINTS.ordersChatMessages(id), {
    method: 'POST',
    body: { message: text },
  });
  const row = res?.data ?? res;
  return mapMessage(row?.message ?? row);
}
