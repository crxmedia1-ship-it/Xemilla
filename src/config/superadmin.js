/**
 * Correo maestro del dueño del SaaS Xemilla (Carlos / CRX).
 * Definilo en SUPERADMIN_EMAIL (`.env` / Vercel, solo servidor).
 * Debe coincidir con el email de `public.is_superadmin()` en Supabase.
 */
export const SUPERADMIN_EMAIL = String(
  import.meta.env.SUPERADMIN_EMAIL || process.env.SUPERADMIN_EMAIL || '',
)
  .trim()
  .toLowerCase();

/** @typedef {'superadmin' | 'admin_operativo' | 'mesonero'} AdminRole */

export const ADMIN_ROLE_SUPER = 'superadmin';
export const ADMIN_ROLE_OPERATIVO = 'admin_operativo';
export const ADMIN_ROLE_MESONERO = 'mesonero';

/**
 * Lee `role` solo desde app_metadata.
 * `user_metadata` lo puede editar el propio usuario con `auth.updateUser`,
 * así que nunca debe decidir permisos.
 * @param {{ app_metadata?: Record<string, unknown> } | null | undefined} user
 * @returns {string}
 */
function readMetaRole(user) {
  return String(user?.app_metadata?.role ?? '').trim().toLowerCase();
}

/**
 * SuperAdmin = email allowlist (dueño CRX) OR app_metadata `role === 'superadmin'`.
 * Admin Operativo (`role: 'admin_operativo'`) is strictly false unless allowlisted.
 *
 * @param {{ email?: string | null, app_metadata?: Record<string, unknown> } | null | undefined} user
 */
export function isSuperAdminUser(user) {
  if (!user) return false;
  const email = user?.email?.trim().toLowerCase();
  if (email && SUPERADMIN_EMAIL && email === SUPERADMIN_EMAIL) return true;
  return readMetaRole(user) === ADMIN_ROLE_SUPER;
}

/**
 * Staff de mesa: `role === 'mesonero' | 'staff'` en app_metadata (nunca SuperAdmin).
 */
export function isMesoneroUser(user) {
  if (!user || isSuperAdminUser(user)) return false;
  const role = readMetaRole(user);
  return role === ADMIN_ROLE_MESONERO || role === 'staff';
}

/**
 * Rol efectivo del usuario autenticado.
 * Fuente de verdad: `isSuperAdminUser` (allowlist + role en app_metadata).
 *
 * @param {{ email?: string | null, app_metadata?: Record<string, unknown> } | null | undefined} user
 * @returns {AdminRole}
 */
export function getUserAdminRole(user) {
  if (!user) return ADMIN_ROLE_OPERATIVO;
  if (isSuperAdminUser(user)) return ADMIN_ROLE_SUPER;
  if (isMesoneroUser(user)) return ADMIN_ROLE_MESONERO;
  return ADMIN_ROLE_OPERATIVO;
}

/**
 * Restaurante asignado al Admin Operativo (solo app_metadata).
 * Acepta `restaurante_id` o `restauranteId`.
 *
 * @param {{ app_metadata?: Record<string, unknown> } | null | undefined} user
 * @returns {string | null}
 */
export function getAssignedRestauranteId(user) {
  if (!user) return null;
  const candidates = [user.app_metadata?.restaurante_id, user.app_metadata?.restauranteId];
  for (const raw of candidates) {
    const id = String(raw ?? '').trim();
    if (id) return id;
  }
  return null;
}

/**
 * Destino post-login según rol.
 * Operativo: incluye `?restaurante=` del asignado (coherencia URL; SSR fuerza metadata).
 *
 * @param {{ email?: string | null, app_metadata?: Record<string, unknown> } | null | undefined} user
 */
export function getAdminPostLoginPath(user) {
  if (getUserAdminRole(user) === ADMIN_ROLE_SUPER) {
    return '/admin/super/dashboard';
  }
  const assigned = getAssignedRestauranteId(user);
  if (assigned) {
    return `/admin/dashboard?restaurante=${encodeURIComponent(assigned)}`;
  }
  return '/admin/dashboard';
}
