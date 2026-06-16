/** يمنع تغيير القيمة بعجلة الماوس في حقول الأرقام */
export function preventWheelChange(e) {
  e.currentTarget.blur();
}

/** يسمح بإدخال أرقام صحيحة فقط أثناء الكتابة */
export function isValidIntegerInput(raw) {
  return raw === '' || /^\d+$/.test(raw);
}

/** يسمح بإدخال أرقام عشرية فقط أثناء الكتابة */
export function isValidDecimalInput(raw) {
  return raw === '' || /^\d*\.?\d*$/.test(raw);
}

export function parseDecimalInput(raw) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : NaN;
}

export function parseIntegerInput(raw, fallback = NaN) {
  if (raw === '' || raw == null) return fallback;
  const value = parseInt(String(raw), 10);
  return Number.isFinite(value) ? value : fallback;
}

export function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** يقيّد القيمة عند مغادرة الحقل (للكميات الصحيحة) */
export function clampIntegerInput(raw, min, max) {
  const parsed = parseIntegerInput(raw, min);
  return String(clampInteger(parsed, min, max));
}
