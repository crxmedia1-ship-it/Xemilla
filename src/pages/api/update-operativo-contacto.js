import {
  getAssignedRestauranteId,
  isSuperAdminUser,
} from '../../config/superadmin.js';
import { parseRedesSociales } from '../../lib/secciones-ui.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * Actualiza SOLO datos operativos de contacto/horario/redes.
 * Aislado de Identidad / ui_estilo / plantillas.
 *
 * Body JSON: {
 *   restaurante_id,
 *   telefono? | whatsapp_url?,
 *   horario? | horarios?,
 *   instagram_url? | instagram?,
 *   facebook_url? | tiktok_url? | social_alt_url?
 * }
 *
 * Whitelist columnas: whatsapp_url, horarios, instagram_url, redes_sociales.
 * Nunca toca ui_estilo / design tokens.
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

  const telefonoRaw =
    raw.telefono !== undefined
      ? raw.telefono
      : raw.whatsapp_url !== undefined
        ? raw.whatsapp_url
        : undefined;
  if (telefonoRaw !== undefined) {
    const telefono = String(telefonoRaw ?? '').trim();
    patch.whatsapp_url = telefono || null;
  }

  const horarioRaw =
    raw.horario !== undefined
      ? raw.horario
      : raw.horarios !== undefined
        ? raw.horarios
        : undefined;
  if (horarioRaw !== undefined) {
    const horario = String(horarioRaw ?? '').trim();
    patch.horarios = horario || null;
  }

  const instagramRaw =
    raw.instagram_url !== undefined
      ? raw.instagram_url
      : raw.instagram !== undefined
        ? raw.instagram
        : undefined;

  const socialAltRaw =
    raw.facebook_url !== undefined
      ? raw.facebook_url
      : raw.tiktok_url !== undefined
        ? raw.tiktok_url
        : raw.social_alt_url !== undefined
          ? raw.social_alt_url
          : undefined;

  const needsRedes =
    instagramRaw !== undefined || socialAltRaw !== undefined;

  const writeClient = isSuper
    ? getSuperAdminWriteClient(supabase, user)
    : supabase;

  if (needsRedes) {
    const { data: current, error: readError } = await writeClient
      .from('restaurantes')
      .select('redes_sociales, instagram_url')
      .eq('id', restauranteId)
      .maybeSingle();

    if (readError) {
      console.error('[api/update-operativo-contacto] read', readError.message);
      return json({ error: readError.message }, 400);
    }
    if (!current) {
      return json(
        {
          error: isSuper
            ? 'Restaurante no encontrado'
            : 'Restaurante no encontrado o sin permiso',
        },
        404,
      );
    }

    /** @type {Array<{ red: string, url: string }>} */
    let redes = parseRedesSociales(current.redes_sociales);

    if (instagramRaw !== undefined) {
      const ig = String(instagramRaw ?? '').trim();
      patch.instagram_url = ig || null;
      redes = upsertRed(redes, 'instagram', ig);
    } else if (current.instagram_url && !redes.some((r) => r.red === 'instagram')) {
      redes = upsertRed(redes, 'instagram', String(current.instagram_url).trim());
    }

    if (socialAltRaw !== undefined) {
      const alt = String(socialAltRaw ?? '').trim();
      const kind = detectSocialAltKind(alt, redes);
      // Un solo campo TikTok/Facebook: reemplaza el otro de ese par.
      redes = redes.filter((r) => r.red !== 'facebook' && r.red !== 'tiktok');
      if (alt) {
        redes = upsertRed(redes, kind, alt);
      }
    }

    patch.redes_sociales = redes;
  }

  if (Object.keys(patch).length === 0) {
    return json({ error: 'No hay campos para actualizar' }, 400);
  }

  const { data, error } = await writeClient
    .from('restaurantes')
    .update(patch)
    .eq('id', restauranteId)
    .select('id, whatsapp_url, horarios, instagram_url, redes_sociales')
    .maybeSingle();

  if (error) {
    console.error('[api/update-operativo-contacto]', error.message);
    return json({ error: error.message }, 400);
  }

  if (!data) {
    return json(
      {
        error: isSuper
          ? 'Restaurante no encontrado'
          : 'Restaurante no encontrado o sin permiso',
      },
      404,
    );
  }

  const redesOut = parseRedesSociales(data.redes_sociales);
  const facebookUrl =
    redesOut.find((r) => r.red === 'facebook')?.url || '';
  const tiktokUrl = redesOut.find((r) => r.red === 'tiktok')?.url || '';

  return json({
    ok: true,
    restaurante: {
      id: data.id,
      whatsapp_url: data.whatsapp_url || '',
      horarios: data.horarios || '',
      instagram_url: data.instagram_url || '',
      facebook_url: facebookUrl,
      tiktok_url: tiktokUrl,
    },
  });
}

/**
 * @param {Array<{ red: string, url: string }>} list
 * @param {string} red
 * @param {string} url
 */
function upsertRed(list, red, url) {
  const next = list.filter((r) => r.red !== red);
  const trimmed = String(url || '').trim();
  if (trimmed) next.push({ red, url: trimmed });
  return next;
}

/**
 * Detecta si el enlace secundario es TikTok o Facebook.
 * @param {string} url
 * @param {Array<{ red: string, url: string }>} existing
 * @returns {'facebook' | 'tiktok'}
 */
function detectSocialAltKind(url, existing) {
  const lower = String(url || '').toLowerCase();
  if (/tiktok\.com|\/\/vm\.tiktok/.test(lower)) return 'tiktok';
  if (/facebook\.com|fb\.com|fb\.me/.test(lower)) return 'facebook';
  const hadTiktok = existing.some((r) => r.red === 'tiktok');
  const hadFacebook = existing.some((r) => r.red === 'facebook');
  if (hadTiktok && !hadFacebook) return 'tiktok';
  return 'facebook';
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
