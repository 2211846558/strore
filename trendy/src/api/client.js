import { API_BASE_URL } from './config';
import { getAuthToken, notifyUnauthorized } from './auth';

/**
 * طلب HTTP عام للـ API مع دعم JSON و FormData
 */
export async function apiRequest(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const isFormData = body instanceof FormData;
  const token = auth ? getAuthToken() : null;

  const config = {
    method,
    credentials: auth ? 'same-origin' : 'omit',
    headers: {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  if (body !== undefined && body !== null) {
    config.body = isFormData ? body : JSON.stringify(body);
  }

  const response = await fetch(url, config).catch(() => {
    const error = new Error(
      'تعذّر الاتصال بالخادم. تأكد من تشغيل الباكند وأن عنوان API صحيح في ملف .env'
    );
    error.isNetworkError = true;
    throw error;
  });

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text ? { message: text } : null;
  }

  if (!response.ok) {
    const error = new Error(data?.message || 'حدث خطأ أثناء معالجة الطلب');
    error.status = response.status;
    error.errors = data?.errors || null;
    error.data = data;
    error.isUnauthorized = response.status === 401;
    error.isPublicRequest = !auth;

    if (error.isUnauthorized && auth && token) {
      notifyUnauthorized();
    }

    throw error;
  }

  return data;
}
