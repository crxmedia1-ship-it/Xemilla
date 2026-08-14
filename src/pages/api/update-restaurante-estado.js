import { isSuperAdminUser } from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * SuperAdmin: activa o desactiva un restaurante (sin borrar datos).
 * Body: { id: uuid, activo: boolean }
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return json({ error: 'No autenticado' }, 401);
  if (!isSuperAdminUser(user)) {
    return json({ error: 'Solo SuperAdmin puede cambiar el estado del local' }, 403);
  }

  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const id = String(body.id || '').trim();
  if (!id) return json({ error: 'id de restaurante requerido' }, 400);

  const activo =
    typeof body.activo === 'boolean'
      ? body.activo
      : body.activo === 'true' || body.activo === 1 || body.activo === '1';

  const writeClient = getSuperAdminWriteClient(supabase, user);
  const { data, error } = await writeClient
    .from('restaurantes')
    .update({ activo: Boolean(activo) })
    .eq('id', id)
    .select('id, nombre_comercial, slug, activo')
    .maybeSingle();

  if (error) {
    if (/activo|column|does not exist|schema cache/i.test(error.message || '')) {
      return json(
        {
          error:
            'Columna activo no existe aún. Ejecutá supabase_restaurante_activo.sql en Supabase.',
        },
        400,
      );
    }
    console.error('[api/update-restaurante-estado]', error.message);
    return json({ error: error.message }, 400);
  }

  if (!data) return json({ error: 'Restaurante no encontrado' }, 404);

  return json({
    ok: true,
    restaurante: data,
    message: data.activo
      ? 'Local reactivado. La WebApp vuelve a estar pública.'
      : 'Local desactivado. La WebApp pública queda fuera de línea.',
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
