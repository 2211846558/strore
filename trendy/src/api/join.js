/**
 * واجهة طلب الانضمام — خطوتان:
 * 1) POST /api/stores/join           → إرسال الطلب + OTP لإيميل المتجر
 * 2) POST /api/v1/auth/store/verify-join → التحقق من الرمز
 */
export { submitStoreJoinRequest, fetchZones, getApiErrorMessage } from './stores';
export { verifyStoreJoin } from './auth';
