/**
 * Correo maestro del dueño del SaaS Xemilla (Carlos / CRX).
 * Preferí SUPERADMIN_EMAIL en `.env` (solo servidor).
 */
export const SUPERADMIN_EMAIL = String(
  import.meta.env.SUPERADMIN_EMAIL ||
    import.meta.env.PUBLIC_SUPERADMIN_EMAIL ||
    'carlos@crx.com',
)
  .trim()
  .toLowerCase();

/** @typedef {'superadmin' | 'admin_operativo'} AdminRole */

export const ADMIN_ROLE_SUPER = 'superadmin';
export const ADMIN_ROLE_OPERATIVO = 'admin_operativo';

/**
 * Lee `role` desde app_metadata (preferido) o user_metadata.
 * @param {{ app_metadata?: Record<string, unknown>, user_metadata?: Record<string, unknown> } | null | undefined} user
 * @returns {string}
 */
function readMetaRole(user) {
  const app = user?.app_metadata?.role;
  const um = user?.user_metadata?.role;
  const raw = app ?? um ?? '';
  return String(raw).trim().toLowerCase();
}

/**
 * SuperAdmin = email allowlist (dueño CRX) OR metadata `role === 'superadmin'`.
 * Admin Operativo (`role: 'admin_operativo'`) is strictly false unless allowlisted.
 *
 * @param {{ email?: string | null, app_metadata?: Record<string, unknown>, user_metadata?: Record<string, unknown> } | null | undefined} user
 */
export function isSuperAdminUser(user) {
  if (!user) return false;
  const email = user?.email?.trim().toLowerCase();
  if (email && email === SUPERADMIN_EMAIL) return true;
  return readMetaRole(user) === ADMIN_ROLE_SUPER;
}

/**
 * Rol efectivo del usuario autenticado.
 * Fuente de verdad: `isSuperAdminUser` (allowlist + role metadata).
 *
 * @param {{ email?: string | null, app_metadata?: Record<string, unknown>, user_metadata?: Record<string, unknown> } | null | undefined} user
 * @returns {AdminRole}
 */
export function getUserAdminRole(user) {
  if (!user) return ADMIN_ROLE_OPERATIVO;
  if (isSuperAdminUser(user)) return ADMIN_ROLE_SUPER;
  return ADMIN_ROLE_OPERATIVO;
}

/**
 * Restaurante asignado al Admin Operativo (metadata).
 * Preferencia: app_metadata → user_metadata. Acepta `restaurante_id` o `restauranteId`.
 * No usa `??` a ciegas: un string vacío en app_metadata no debe tapar user_metadata.
 *
 * @param {{ app_metadata?: Record<string, unknown>, user_metadata?: Record<string, unknown> } | null | undefined} user
 * @returns {string | null}
 */
export function getAssignedRestauranteId(user) {
  if (!user) return null;
  const candidates = [
    user.app_metadata?.restaurante_id,
    user.app_metadata?.restauranteId,
    user.user_metadata?.restaurante_id,
    user.user_metadata?.restauranteId,
  ];
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
 * @param {{ email?: string | null, app_metadata?: Record<string, unknown>, user_metadata?: Record<string, unknown> } | null | undefined} user
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
