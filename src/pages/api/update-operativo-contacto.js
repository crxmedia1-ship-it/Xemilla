import {
  getAssignedRestauranteId,
  isSuperAdminUser,
} from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * Actualiza SOLO datos operativos de contacto/horario.
 * Aislado de Identidad / ui_estilo / plantillas.
 *
 * Body JSON: {
 *   restaurante_id,
 *   telefono? | whatsapp_url?,
 *   horario? | horarios?
 * }
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

  if (Object.keys(patch).length === 0) {
    return json({ error: 'No hay campos para actualizar' }, 400);
  }

  const writeClient = isSuper
    ? getSuperAdminWriteClient(supabase, user)
    : supabase;

  const { data, error } = await writeClient
    .from('restaurantes')
    .update(patch)
    .eq('id', restauranteId)
    .select('id, whatsapp_url, horarios')
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

  return json({
    ok: true,
    restaurante: {
      id: data.id,
      whatsapp_url: data.whatsapp_url || '',
      horarios: data.horarios || '',
    },
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
