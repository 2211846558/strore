/**
 * واجهة طلب الانضمام — خطوتان:
 * 1) POST /api/stores/join           → إرسال الطلب + OTP لإيميل المتجر
 * 2) POST /api/v1/auth/store/verify-join → التحقق من الرمز
 */
import { getApiErrorMessage, submitStoreJoinRequest, fetchZones } from './stores';

export { submitStoreJoinRequest, fetchZones, getApiErrorMessage };
export { verifyStoreJoin, clearAuthSession } from './auth';

/** رسائل خطأ مخصصة لنموذج الانضمام (طلبات عامة بدون توكن) */
export function getJoinApiErrorMessage(error) {
  return getApiErrorMessage(error, 'تعذّر إرسال طلب الانضمام، حاول مرة أخرى');
}
