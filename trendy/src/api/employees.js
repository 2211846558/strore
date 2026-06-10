import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';

function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

/**
 * أرقام الأدوار في جدول roles — ترتيب افتراضي حسب api.md
 * يمكن تجاوزها من .env إذا اختلفت عندك في قاعدة البيانات
 */
export const DEFAULT_ROLE_IDS = {
  super_admin: Number(import.meta.env.VITE_ROLE_SUPER_ADMIN_ID) || 1,
  stores_admin: Number(import.meta.env.VITE_ROLE_STORES_ADMIN_ID) || 2,
  accountant: Number(import.meta.env.VITE_ROLE_ACCOUNTANT_ID) || 3,
  operations_admin: Number(import.meta.env.VITE_ROLE_OPERATIONS_ADMIN_ID) || 4,
  store_manager: Number(import.meta.env.VITE_ROLE_STORE_MANAGER_ID) || 5,
  store_staff: Number(import.meta.env.VITE_ROLE_STORE_STAFF_ID) || 6,
};

/** أدوار الموظفين — slug في الـ API → تسمية عربية في الواجهة */
export const EMPLOYEE_ROLE_MAP = {
  operations_admin: 'مسؤول عمليات',
  accountant: 'محاسب',
  store_staff: 'موظف متجر',
  store_manager: 'مدير متجر',
  stores_admin: 'مسؤول المتاجر',
  super_admin: 'مدير النظام',
};

function resolveRoleIdFromForm(roleValue) {
  const { roleId } = parseRoleSelection(roleValue);
  if (roleId) return roleId;
  const numeric = Number(roleValue);
  if (!Number.isNaN(numeric) && numeric > 0) return numeric;
  return DEFAULT_ROLE_IDS[roleValue] ?? null;
}

/** يفك قيمة الاختيار "roleId__label" أو role_id فقط */
export function parseRoleSelection(roleValue) {
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
  const slugId = DEFAULT_ROLE_IDS[raw];
  return { roleId: slugId ?? null, jobTitle: '' };
}

export function formatRoleSelection(roleId, jobTitle) {
  if (roleId == null) return '';
  return jobTitle ? `${roleId}__${jobTitle}` : String(roleId);
}

/** خيارات الأدوار في النماذج والفلترة */
export const EMPLOYEE_ROLE_OPTIONS = [
  {
    value: formatRoleSelection(DEFAULT_ROLE_IDS.operations_admin, 'مسؤول عمليات'),
    slug: 'operations_admin',
    label: 'مسؤول عمليات',
  },
  {
    value: formatRoleSelection(DEFAULT_ROLE_IDS.accountant, 'محاسب'),
    slug: 'accountant',
    label: 'محاسب',
  },
  {
    value: formatRoleSelection(DEFAULT_ROLE_IDS.store_staff, 'موظف دعم فني'),
    slug: 'store_staff',
    label: 'موظف دعم فني',
  },
  {
    value: formatRoleSelection(DEFAULT_ROLE_IDS.store_manager, 'مدير متجر'),
    slug: 'store_manager',
    label: 'مدير متجر',
  },
  {
    value: formatRoleSelection(DEFAULT_ROLE_IDS.store_staff, 'موظف متجر'),
    slug: 'store_staff_store',
    label: 'موظف متجر',
  },
];

function resolveRoleId(row) {
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
  return slug ? DEFAULT_ROLE_IDS[slug] ?? null : null;
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

export function mapEmployee(row) {
  const roleSlug = resolveRoleSlug(row);
  const roleId = resolveRoleId(row);
  const active = resolveActive(row);

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

/** دمج أدوار مكتشفة من الـ API مع الخيارات الافتراضية */
export function buildRoleOptions(employees = []) {
  const options = new Map();

  EMPLOYEE_ROLE_OPTIONS.forEach((opt) => {
    options.set(`${opt.value}-${opt.label}`, opt);
  });

  employees.forEach((emp) => {
    if (emp.roleId) {
      options.set(`${emp.roleId}-${emp.role}`, {
        value: formatRoleSelection(emp.roleId, emp.role),
        slug: emp.roleSlug,
        label: emp.role,
      });
    }
  });

  return Array.from(options.values());
}

export function buildEmployeePayload(form, { storeId, roleOptions } = {}) {
  const { roleId } = parseRoleSelection(form.role);
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

/**
 * GET /employees — قائمة الموظفين مع البحث والفلترة
 */
export async function fetchEmployees({
  storeId,
  search,
  role,
  perPage = 50,
  page = 1,
} = {}) {
  const query = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
  });
  if (storeId) query.set('store_id', String(storeId));
  if (search?.trim()) query.set('search', search.trim());
  if (role && role !== 'all') {
    const { roleId } = parseRoleSelection(role);
    if (roleId) query.set('role_id', String(roleId));
  }

  const res = await apiRequest(`${API_ENDPOINTS.employees}?${query}`);
  return {
    employees: extractList(res).map(mapEmployee),
    meta: res?.meta ?? null,
  };
}

export async function fetchAllEmployees(filters = {}) {
  const perPage = filters.perPage ?? 100;
  const all = [];
  let page = 1;
  let lastPage = 1;

  do {
    const result = await fetchEmployees({ ...filters, perPage, page });
    all.push(...result.employees);
    lastPage = Number(result.meta?.last_page ?? 1);
    page += 1;
  } while (page <= lastPage);

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
