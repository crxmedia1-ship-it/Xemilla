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
  // ui_estilo siempre incluido: ahí persistimos cover/logo_bg si faltan columnas Hub
  const selectSafe =
    'id, nombre_comercial, slug, user_id, whatsapp_num, whatsapp_url, direccion, logo_url, ui_estilo, imagen_fondo, share_image_url, gadget_wifi, gadget_dividir_cuenta, created_at';
  const selectMid =
    'id, nombre_comercial, slug, user_id, whatsapp_num, whatsapp_url, direccion, coordenadas_maps, logo_url, hub_cover_url, ui_estilo, imagen_fondo, share_image_url, gadget_wifi, gadget_dividir_cuenta, created_at';
  const selectFull =
    'id, nombre_comercial, slug, user_id, whatsapp_num, whatsapp_url, direccion, coordenadas_maps, logo_url, hub_cover_url, hub_logo_bg, ui_estilo, imagen_fondo, share_image_url, gadget_wifi, gadget_dividir_cuenta, created_at';

  let { data, error } = await client
    .from('restaurantes')
    .select(selectFull)
    .order('nombre_comercial', { ascending: true });

  if (error && /hub_logo_bg|hub_cover_url|coordenadas_maps|column|does not exist|schema cache/i.test(error.message || '')) {
    console.warn(
      '[superadmin] listAllRestaurantes: columna Hub ausente; SELECT fallback.',
      error.message,
    );
    const mid = await client
      .from('restaurantes')
      .select(selectMid)
      .order('nombre_comercial', { ascending: true });
    if (!mid.error) {
      data = mid.data;
      error = null;
    } else {
      const fallback = await client
        .from('restaurantes')
        .select(selectSafe)
        .order('nombre_comercial', { ascending: true });
      data = fallback.data;
      error = fallback.error;
    }
  }

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
 * @param {{
 *   userId: string,
 *   nombreComercial: string,
 *   slug: string,
 *   whatsapp?: string,
 *   direccion?: string,
 *   logoUrl?: string,
 *   hubCoverUrl?: string,
 *   hubLogoBg?: string,
 * }} input
 */
export async function createRestauranteAsSuperAdmin(supabase, user, input) {
  const slug = normalizeSlug(input.slug);
  const nombre = input.nombreComercial.trim();
  const whatsapp = (input.whatsapp ?? '').trim() || null;
  const direccion = (input.direccion ?? '').trim() || null;
  const logoUrl = String(input.logoUrl ?? '').trim() || null;
  const hubCoverUrl = String(input.hubCoverUrl ?? '').trim() || null;
  const hubLogoBg = String(input.hubLogoBg ?? '').trim() || null;
  const logoBgOk = hubLogoBg && /^#[0-9A-Fa-f]{6}$/.test(hubLogoBg) ? hubLogoBg : null;

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

  /** @type {Record<string, unknown>} */
  const baseRow = {
    user_id: input.userId,
    nombre_comercial: nombre,
    slug,
    whatsapp_num: whatsapp,
    whatsapp_url: whatsapp,
    direccion,
    logo_url: logoUrl,
    gadget_wifi: false,
    gadget_dividir_cuenta: false,
  };

  if (hubCoverUrl) baseRow.hub_cover_url = hubCoverUrl;
  if (logoBgOk) baseRow.hub_logo_bg = logoBgOk;

  let { data, error } = await client
    .from('restaurantes')
    .insert(baseRow)
    .select('id, nombre_comercial, slug')
    .maybeSingle();

  // Reintento sin columnas Hub / direccion si el schema aún no las tiene
  if (error && /hub_cover_url|hub_logo_bg|direccion|column|schema cache|does not exist/i.test(error.message || '')) {
    console.warn('[superadmin] createRestaurante: columnas opcionales ausentes; fallback.', error.message);
    const soft = { ...baseRow };
    delete soft.hub_cover_url;
    delete soft.hub_logo_bg;
    if (/direccion/i.test(error.message || '')) delete soft.direccion;

    const fallback = await client
      .from('restaurantes')
      .insert(soft)
      .select('id, nombre_comercial, slug')
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;

    if (!error && data?.id && (hubCoverUrl || logoBgOk)) {
      try {
        const { persistHubInUiEstilo } = await import('./hub-media.js');
        await persistHubInUiEstilo(client, String(data.id), {
          coverUrl: hubCoverUrl,
          logoBg: logoBgOk,
        });
      } catch (persistErr) {
        console.warn(
          '[superadmin] createRestaurante: no se pudo persistir hub en ui_estilo',
          persistErr,
        );
      }
    }
  }

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ese slug ya está en uso. Elegí otro.' };
    }
    console.error('[superadmin] createRestaurante:', error.message);
    return { error: error.message };
  }

  return { restaurante: data };
}
