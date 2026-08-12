import {
  getAssignedRestauranteId,
  isSuperAdminUser,
} from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';
import { isHttpUrl, persistHubInUiEstilo } from '../../lib/hub-media.js';

export const prerender = false;

/** SELECT que siempre existe (evita errores de schema cache por columnas Hub nuevas). */
const SAFE_SELECT =
  'id, nombre_comercial, slug, logo_url, whatsapp_num, whatsapp_url, ui_estilo';

/**
 * Actualiza datos de ficha del local (Hub + identidad básica).
 * NO toca imagen_fondo / secciones_fondo (fondo WebApp).
 *
 * Body JSON: {
 *   restaurante_id,
 *   nombre_comercial?,
 *   whatsapp_num? | telefono?,
 *   logo_url?,
 *   hub_cover_url?,
 *   hub_logo_bg?
 * }
 *
 * URLs vacías NO borran media existente.
 * hub_cover_url / hub_logo_bg: columna dedicada si existe; si no, ui_estilo.hub.
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return json({ error: 'No autenticado' }, 401);
  }

  /** @type {Record<string, unknown>} */
  let raw = {};
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'Cuerpo de petición inválido' }, 400);
  }

  const restauranteId = String(raw.restaurante_id ?? '').trim();
  if (!restauranteId) {
    return json({ error: 'restaurante_id requerido' }, 400);
  }

  const isSuper = isSuperAdminUser(user);
  if (!isSuper) {
    const assigned = getAssignedRestauranteId(user);
    if (!assigned || assigned !== restauranteId) {
      return json({ error: 'Sin permiso para este restaurante' }, 403);
    }
  }

  /** @type {Record<string, unknown>} */
  const patch = {};
  /** @type {string | null} */
  let coverUrl = null;
  /** @type {string | null} */
  let logoBg = null;

  if (raw.nombre_comercial !== undefined) {
    const nombre = String(raw.nombre_comercial ?? '').trim();
    if (!nombre) return json({ error: 'El nombre comercial no puede quedar vacío' }, 400);
    patch.nombre_comercial = nombre;
  }

  const telefonoRaw =
    raw.whatsapp_num !== undefined
      ? raw.whatsapp_num
      : raw.telefono !== undefined
        ? raw.telefono
        : undefined;
  if (telefonoRaw !== undefined) {
    const telefono = String(telefonoRaw ?? '').trim();
    patch.whatsapp_num = telefono || null;
    patch.whatsapp_url = telefono || null;
  }

  if (raw.clear_logo === true) {
    patch.logo_url = null;
  } else if (raw.logo_url !== undefined) {
    const logo = String(raw.logo_url ?? '').trim();
    if (logo) patch.logo_url = logo;
  }

  if (raw.clear_hub_cover === true) {
    patch.hub_cover_url = null;
    coverUrl = null;
  } else if (raw.hub_cover_url !== undefined) {
    const cover = String(raw.hub_cover_url ?? '').trim();
    if (cover && isHttpUrl(cover)) {
      patch.hub_cover_url = cover;
      coverUrl = cover;
    }
  }

  if (raw.hub_logo_bg !== undefined) {
    const bg = String(raw.hub_logo_bg ?? '').trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(bg)) {
      logoBg = bg;
      patch.hub_logo_bg = bg;
    }
  }

  if (Object.keys(patch).length === 0) {
    return json({ error: 'Sin campos para actualizar' }, 400);
  }

  const writeClient = isSuper
    ? getSuperAdminWriteClient(supabase, user)
    : supabase;

  const result = await updateHubDatos(writeClient, restauranteId, patch, {
    coverUrl,
    logoBg,
  });
  if (result.error) {
    console.error('[api/update-hub-datos]', result.error);
    return json({ error: result.error }, 400);
  }

  return json({ ok: true, restaurante: result.data });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} restauranteId
 * @param {Record<string, unknown>} patch
 * @param {{ coverUrl: string | null, logoBg: string | null }} hubMeta
 */
async function updateHubDatos(client, restauranteId, patch, hubMeta) {
  const attempts = [
    patch,
    omitKeys(patch, ['hub_logo_bg']),
    omitKeys(patch, ['hub_logo_bg', 'hub_cover_url']),
  ];

  /** @type {string | null} */
  let lastError = null;

  for (const attemptPatch of attempts) {
    if (Object.keys(attemptPatch).length === 0) continue;

    const { data, error } = await client
      .from('restaurantes')
      .update(attemptPatch)
      .eq('id', restauranteId)
      .select(SAFE_SELECT)
      .maybeSingle();

    if (!error && data) {
      /** @type {Record<string, unknown>} */
      const row = { ...data };

      const usedCoverColumn = Object.prototype.hasOwnProperty.call(
        attemptPatch,
        'hub_cover_url',
      );
      const usedLogoBgColumn = Object.prototype.hasOwnProperty.call(
        attemptPatch,
        'hub_logo_bg',
      );

      if (hubMeta.coverUrl) row.hub_cover_url = hubMeta.coverUrl;
      if (hubMeta.logoBg) row.hub_logo_bg = hubMeta.logoBg;

      /** @type {{ coverUrl?: string, logoBg?: string }} */
      const uiFallback = {};
      if (hubMeta.coverUrl && !usedCoverColumn) uiFallback.coverUrl = hubMeta.coverUrl;
      if (hubMeta.logoBg && !usedLogoBgColumn) uiFallback.logoBg = hubMeta.logoBg;
      // Siempre duplicar en ui_estilo (respaldo durable aunque existan columnas Hub)
      if (hubMeta.coverUrl) uiFallback.coverUrl = hubMeta.coverUrl;
      if (hubMeta.logoBg) uiFallback.logoBg = hubMeta.logoBg;

      if (Object.keys(uiFallback).length > 0) {
        await persistHubInUiEstilo(client, restauranteId, uiFallback);
      }

      return { data: row, error: null };
    }

    lastError = error?.message || 'No se pudo actualizar';
    if (!isMissingColumnError(lastError)) {
      return { data: null, error: lastError };
    }
  }

  return { data: null, error: lastError || 'No se pudo actualizar' };
}

/**
 * @param {string} message
 */
function isMissingColumnError(message) {
  return /hub_cover_url|hub_logo_bg|column|schema cache|does not exist/i.test(
    message || '',
  );
}

/**
 * @param {Record<string, unknown>} obj
 * @param {string[]} keys
 */
function omitKeys(obj, keys) {
  /** @type {Record<string, unknown>} */
  const next = { ...obj };
  for (const key of keys) delete next[key];
  return next;
}

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
