import { isSuperAdminUser } from '../config/superadmin.js';
import { createSupabaseServerClient } from './supabase/server.js';
import { createSupabaseServiceClient } from './supabase/service.js';
import { normalizeSlug, isValidSlug } from './superadmin-slug.js';

/**
 * Sesión válida solo si el email coincide con el SuperAdmin.
 * @param {{ request: Request, cookies: import('astro').AstroCookies }} ctx
 */
export async function requireSuperAdmin(ctx) {
  const supabase = createSupabaseServerClient(ctx);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !isSuperAdminUser(user)) {
    return null;
  }

  return { user, supabase };
}

/**
 * Lista global de restaurantes (panel maestro).
 * Usa service role si está disponible para no depender de RLS de dueño.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ email?: string | null } | null} [user]
 */
export async function listAllRestaurantes(supabase, user = null) {
  const client = user ? getSuperAdminWriteClient(supabase, user) : supabase;
  const { data, error } = await client
    .from('restaurantes')
    .select(
      'id, nombre_comercial, slug, whatsapp_num, gadget_wifi, gadget_dividir_cuenta, created_at',
    )
    .order('nombre_comercial', { ascending: true });

  if (error) {
    console.error('[superadmin] listAllRestaurantes:', error.message);
    return [];
  }

  return data ?? [];
}

/**
 * Cliente con privilegios de escritura para SuperAdmin (service role si existe).
 * @param {import('@supabase/supabase-js').SupabaseClient} sessionClient
 * @param {{ email?: string | null } | null} user
 */
export function getSuperAdminWriteClient(sessionClient, user) {
  if (!isSuperAdminUser(user)) return sessionClient;
  return createSupabaseServiceClient() ?? sessionClient;
}

/**
 * Alta de restaurante desde el panel maestro.
 * Se vincula al user_id del SuperAdmin (gestión centralizada).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ email?: string | null } | null} user
 * @param {{ userId: string, nombreComercial: string, slug: string, whatsapp?: string }} input
 */
export async function createRestauranteAsSuperAdmin(supabase, user, input) {
  const slug = normalizeSlug(input.slug);
  const nombre = input.nombreComercial.trim();
  const whatsapp = (input.whatsapp ?? '').trim() || null;

  if (!nombre) {
    return { error: 'El nombre comercial es obligatorio' };
  }
  if (!isValidSlug(slug)) {
    return {
      error:
        'Slug inválido. Usá solo minúsculas, números y guiones (ej: blacksushi).',
    };
  }

  const client = getSuperAdminWriteClient(supabase, user);

  const { data, error } = await client
    .from('restaurantes')
    .insert({
      user_id: input.userId,
      nombre_comercial: nombre,
      slug,
      whatsapp_num: whatsapp,
      gadget_wifi: false,
      gadget_dividir_cuenta: false,
    })
    .select('id, nombre_comercial, slug')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ese slug ya está en uso. Elegí otro.' };
    }
    console.error('[superadmin] createRestaurante:', error.message);
    return { error: error.message };
  }

  return { restaurante: data };
}
