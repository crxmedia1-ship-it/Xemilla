import { isSuperAdminUser } from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * SuperAdmin: prende/apaga solo gadgets.nutricion sin tocar el resto de Identidad.
 * Body: { restaurante_id, activo: boolean }
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return json({ error: 'No autenticado' }, 401);
  if (!isSuperAdminUser(user)) {
    return json({ error: 'Solo SuperAdmin puede contratar este gadget' }, 403);
  }

  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const restauranteId = String(body.restaurante_id || body.id || '').trim();
  if (!restauranteId) return json({ error: 'restaurante_id requerido' }, 400);

  const activo =
    typeof body.activo === 'boolean'
      ? body.activo
      : body.activo === 'true' || body.activo === 1 || body.activo === '1';

  const writeClient = getSuperAdminWriteClient(supabase, user);
  const { data, error } = await writeClient
    .from('restaurantes')
    .update({ gadget_nutricion: Boolean(activo) })
    .eq('id', restauranteId)
    .select('id, nombre_comercial, slug, gadget_nutricion')
    .maybeSingle();

  if (error) {
    if (/gadget_nutricion|column|does not exist|schema cache/i.test(error.message || '')) {
      return json(
        {
          error:
            'Columna gadget_nutricion no existe. Ejecutá supabase_nutricion.sql en Supabase.',
        },
        400,
      );
    }
    console.error('[api/update-gadget-nutricion]', error.message);
    return json({ error: error.message }, 400);
  }

  if (!data) return json({ error: 'Restaurante no encontrado' }, 404);

  return json({
    ok: true,
    restaurante: data,
    message: data.gadget_nutricion
      ? 'Gadget nutricional activo. En Menú, cada plato tiene Nutrición / Alérgenos.'
      : 'Gadget nutricional apagado. Sin rastro en admin ni WebApp.',
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
