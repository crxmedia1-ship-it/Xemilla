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

/**
 * @param {{ email?: string | null } | null | undefined} user
 */
export function isSuperAdminUser(user) {
  const email = user?.email?.trim().toLowerCase();
  return Boolean(email && email === SUPERADMIN_EMAIL);
}
