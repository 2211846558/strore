import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';

const ROLE_ID_CACHE_KEY = 'trendy_role_id_map';

const ROLE_SEED_ORDER = [
  'super_admin',
  'stores_admin',
  'accountant',
  'operations_admin',
  'store_manager',
  'store_staff',
];

/** معرّفات seed نظيف — وليس 1855+ */
const STANDARD_ROLE_IDS = {
  super_admin: 1,
  stores_admin: 2,
  accountant: 3,
  operations_admin: 4,
  store_manager: 5,
  store_staff: 6,
};

function readEnvRoleId(slug) {
  const envMap = {
    super_admin: import.meta.env.VITE_ROLE_SUPER_ADMIN_ID,
    stores_admin: import.meta.env.VITE_ROLE_STORES_ADMIN_ID,
    accountant: import.meta.env.VITE_ROLE_ACCOUNTANT_ID,
    operations_admin: import.meta.env.VITE_ROLE_OPERATIONS_ADMIN_ID,
    store_manager: import.meta.env.VITE_ROLE_STORE_MANAGER_ID,
    store_staff: import.meta.env.VITE_ROLE_STORE_STAFF_ID,
  };
  const value = Number(envMap[slug]);
  return !Number.isNaN(value) && value > 0 ? value : null;
}

function readCachedRoleIds() {
  try {
    const raw = localStorage.getItem(ROLE_ID_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCachedRoleIds(map) {
  localStorage.setItem(ROLE_ID_CACHE_KEY, JSON.stringify(map));
}

export function extractRoleIdsFromUser(user) {
  const map = {};
  const roles = user?.roles;
  if (!Array.isArray(roles)) return map;

  for (const role of roles) {
    if (typeof role === 'object' && role?.id != null && role?.name) {
      map[String(role.name)] = Number(role.id);
    }
  }
  return map;
}

export function syncRoleIdCacheFromUser(user) {
  const extracted = extractRoleIdsFromUser(user);
  if (Object.keys(extracted).length === 0) return;
  writeCachedRoleIds({ ...readCachedRoleIds(), ...extracted });
}

function inferRoleIdsFromKnown(known) {
  const result = { ...known };
  for (const [slug, id] of Object.entries(known)) {
    const idx = ROLE_SEED_ORDER.indexOf(slug);
    if (idx === -1 || !id) continue;
    for (const targetSlug of ROLE_SEED_ORDER) {
      if (result[targetSlug]) continue;
      const targetIdx = ROLE_SEED_ORDER.indexOf(targetSlug);
      if (targetIdx === -1) continue;
      const inferred = Number(id) + (targetIdx - idx);
      if (inferred > 0) result[targetSlug] = inferred;
    }
  }
  return result;
}

export function getResolvedRoleIds(user = null) {
  const cached = readCachedRoleIds();
  const fromUser = user ? extractRoleIdsFromUser(user) : {};
  const merged = { ...STANDARD_ROLE_IDS };

  for (const slug of ROLE_SEED_ORDER) {
    const id =
      fromUser[slug] ??
      cached[slug] ??
      readEnvRoleId(slug) ??
      STANDARD_ROLE_IDS[slug];
    if (id) merged[slug] = id;
  }

  return inferRoleIdsFromKnown(merged);
}

export const DEFAULT_ROLE_IDS = STANDARD_ROLE_IDS;

/** أدوار الموظفين — slug في الـ API → تسمية عربية في الواجهة */
export const EMPLOYEE_ROLE_MAP = {
  operations_admin: 'مسؤول عمليات',
  accountant: 'محاسب',
  store_staff: 'موظف متجر',
  store_manager: 'مدير متجر',
  stores_admin: 'مسؤول المتاجر',
  super_admin: 'مدير النظام',
};

/** يفك قيمة الاختيار "roleId__label" أو role_id فقط */
export function parseRoleSelection(roleValue, user = null) {
  const raw = String(roleValue ?? '');
  if (raw.includes('__')) {
    const sep = raw.indexOf('__');
    return {
      roleId: Number(raw.slice(0, sep)),
      jobTitle: raw.slice(sep + 2).trim(),
    };
  }
  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && numeric > 0) {
    return { roleId: numeric, jobTitle: '' };
  }
  const roleIds = getResolvedRoleIds(user);
  const slugId = roleIds[raw];
  return { roleId: slugId ?? null, jobTitle: '' };
}

export function formatRoleSelection(roleId, jobTitle) {
  if (roleId == null) return '';
  return jobTitle ? `${roleId}__${jobTitle}` : String(roleId);
}

/** خيارات الأدوار في النماذج والفلترة */
export function getEmployeeRoleOptions(user = null) {
  const roleIds = getResolvedRoleIds(user);
  return [
    {
      value: formatRoleSelection(roleIds.store_staff, 'موظف متجر'),
      slug: 'store_staff',
      label: 'موظف متجر',
    },
    {
      value: formatRoleSelection(roleIds.store_manager, 'مدير متجر'),
      slug: 'store_manager',
      label: 'مدير متجر',
    },
  ];
}

export const EMPLOYEE_ROLE_OPTIONS = getEmployeeRoleOptions();

function resolveRoleId(row, user = null) {
  if (row.role_id != null) return Number(row.role_id);
  if (row.role?.id != null) return Number(row.role.id);
  const roles = row.roles;
  if (Array.isArray(roles) && roles.length > 0) {
    const first = roles[0];
    if (typeof first === 'object') {
      if (first.id != null) return Number(first.id);
      if (first.pivot?.role_id != null) return Number(first.pivot.role_id);
    }
  }
  const slug = resolveRoleSlug(row);
  const roleIds = getResolvedRoleIds(user);
  return slug ? roleIds[slug] ?? null : null;
}

function resolveRoleSlug(row) {
  if (typeof row.role === 'string') return row.role;
  if (row.role?.name) return String(row.role.name);
  if (row.role?.slug) return String(row.role.slug);
  const roles = row.roles;
  if (Array.isArray(roles) && roles.length > 0) {
    const first = roles[0];
    return typeof first === 'string' ? first : first?.name ?? first?.slug ?? '';
  }
  return '';
}

function resolveRoleLabel(slug, row) {
  if (row?.job_title) return row.job_title;
  if (row?.role?.display_name) return row.role.display_name;
  if (row?.role_label) return row.role_label;
  if (row?.role?.name && EMPLOYEE_ROLE_MAP[row.role.name]) {
    return EMPLOYEE_ROLE_MAP[row.role.name];
  }
  const fromMap = EMPLOYEE_ROLE_MAP[slug];
  if (fromMap) return fromMap;
  return slug || '—';
}

function resolveJobTitle(form, roleOptions = EMPLOYEE_ROLE_OPTIONS) {
  if (form.jobTitle?.trim()) return form.jobTitle.trim();
  const { roleId, jobTitle } = parseRoleSelection(form.role);
  if (jobTitle) return jobTitle;
  const match =
    roleOptions.find((r) => String(r.value) === String(form.role)) ||
    roleOptions.find((r) => parseRoleSelection(r.value).roleId === roleId);
  return match?.label?.trim() ?? '';
}

function formatDate(value) {
  if (!value) return '—';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = new Date(raw.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return raw;
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '—';
  const raw = String(value);
  const date = new Date(raw.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return raw;
  const datePart = date.toISOString().slice(0, 10);
  const timePart = date.toTimeString().slice(0, 5);
  return `${datePart} ${timePart}`;
}

function resolveActive(row) {
  if (typeof row.is_active === 'boolean') return row.is_active;
  if (typeof row.active === 'boolean') return row.active;
  const status = String(row.status ?? '').toLowerCase();
  if (status === 'active' || status === 'نشط') return true;
  if (status === 'inactive' || status === 'disabled' || status === 'معطل') return false;
  return true;
}

export function mapEmployee(row, user = null) {
  const roleSlug = resolveRoleSlug(row);
  const roleId = resolveRoleId(row, user);
  let active = resolveActive(row);
  if (roleSlug === 'store_manager') {
    active = true;
  }

  return {
    id: row.id,
    name: row.name ?? row.user_name ?? row.full_name ?? '—',
    email: row.email ?? '—',
    phone: row.phone ?? row.user_phone ?? '—',
    roleId,
    roleSlug,
    role: resolveRoleLabel(roleSlug, row),
    joinDate: formatDate(row.created_at ?? row.join_date ?? row.joined_at),
    lastLogin: formatDateTime(row.last_login_at ?? row.last_login ?? row.last_login_date),
    status: active ? 'نشط' : 'معطل',
    active,
    storeId: row.store_id ?? row.store?.id ?? null,
    storeName: row.store?.name ?? row.store_name ?? null,
    raw: row,
  };
}

export function buildRoleOptions(_employees = [], user = null) {
  return getEmployeeRoleOptions(user);
}

function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function buildEmployeePayload(form, { storeId, roleOptions, user } = {}) {
  const { roleId } = parseRoleSelection(form.role, user);
  const jobTitle = resolveJobTitle(form, roleOptions);

  const body = {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    role_id: roleId,
    job_title: jobTitle,
  };

  if (storeId) body.store_id = storeId;
  if (form.password?.trim()) body.password = form.password.trim();

  return body;
}

export function buildEmployeeUpdatePayload(form, options = {}) {
  const body = buildEmployeePayload(form, options);
  if (!form.password?.trim()) delete body.password;
  return body;
}

function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * تحقق من مدخلات الموظف قبل الإرسال — يمنع أرقام وهمية ويتكرار البيانات ضمن القائمة المحمّلة
 */
export function validateEmployeeForm(form, { existingEmployees = [], editingId = null } = {}) {
  const phone = form.phone?.trim() ?? '';
  const email = form.email?.trim().toLowerCase() ?? '';
  const digits = normalizePhone(phone);

  if (digits.length < 8) {
    return 'رقم الهاتف قصير جداً. أدخل رقماً صالحاً (8 أرقام على الأقل).';
  }
  if (/^(\d)\1+$/.test(digits)) {
    return 'رقم الهاتف غير صالح. لا يمكن استخدام أرقام متكررة مثل 0000000.';
  }

  const duplicatePhone = existingEmployees.find(
    (member) =>
      member.id !== editingId && normalizePhone(member.phone) === digits,
  );
  if (duplicatePhone) {
    return `رقم الهاتف مستخدم مسبقاً للموظف «${duplicatePhone.name}».`;
  }

  if (email) {
    const duplicateEmail = existingEmployees.find(
      (member) =>
        member.id !== editingId &&
        String(member.email ?? '').trim().toLowerCase() === email,
    );
    if (duplicateEmail) {
      return `البريد الإلكتروني مستخدم مسبقاً للموظف «${duplicateEmail.name}».`;
    }
  }

  return '';
}

/**
 * GET /employees — قائمة الموظفين مع البحث والفلترة
 */
export async function fetchEmployees({
  storeId,
  search,
  role,
  perPage = 50,
  page = 1,
  user = null,
} = {}) {
  const query = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
  });
  if (storeId) query.set('store_id', String(storeId));
  if (search?.trim()) query.set('search', search.trim());
  if (role && role !== 'all') {
    const roleOptions = getEmployeeRoleOptions(user);
    const opt = roleOptions.find((o) => String(o.value) === String(role));
    if (opt) {
      query.set('role', opt.slug);
    } else {
      query.set('role', role);
    }
  }

  const res = await apiRequest(`${API_ENDPOINTS.employees}?${query}`);
  return {
    employees: extractList(res).map((row) => mapEmployee(row, user)),
    meta: res?.meta ?? null,
  };
}

export async function fetchAllEmployees(filters = {}) {
  const perPage = filters.perPage ?? 100;
  const maxPages = filters.maxPages ?? null;
  const all = [];
  let page = 1;
  let lastPage = 1;

  do {
    const result = await fetchEmployees({ ...filters, perPage, page });
    all.push(...result.employees);
    lastPage = Number(result.meta?.last_page ?? 1);
    page += 1;
  } while (page <= lastPage && (maxPages === null || page <= maxPages));

  return all;
}

/**
 * GET /employees/{id} — تفاصيل موظف
 */
export async function fetchEmployee(id) {
  const res = await apiRequest(API_ENDPOINTS.employee(id));
  return mapEmployee(res?.data ?? res);
}

/**
 * POST /employees — إضافة موظف
 */
export async function createEmployee(payload) {
  const res = await apiRequest(API_ENDPOINTS.employees, {
    method: 'POST',
    body: payload,
  });
  return mapEmployee(res?.data ?? res);
}

/**
 * PATCH /employees/{id} — تعديل موظف
 */
export async function updateEmployee(id, payload) {
  const res = await apiRequest(API_ENDPOINTS.employee(id), {
    method: 'PATCH',
    body: payload,
  });
  return mapEmployee(res?.data ?? res);
}

/**
 * POST /employees/{id}/toggle — تفعيل / تعطيل
 */
export async function toggleEmployee(id) {
  const res = await apiRequest(API_ENDPOINTS.employeeToggle(id), { method: 'POST' });
  return mapEmployee(res?.data ?? res);
}

/**
 * DELETE /employees/{id} — حذف موظف
 */
export async function deleteEmployee(id) {
  const res = await apiRequest(API_ENDPOINTS.employee(id), {
    method: 'DELETE',
  });
  return res;
}
