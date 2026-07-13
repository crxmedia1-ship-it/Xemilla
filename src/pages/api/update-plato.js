import { isSuperAdminUser } from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * Actualiza disponibilidad y/o precio de un plato.
 * - Dueño: JWT + RLS
 * - SuperAdmin: service role (si hay key) o policies RLS de súper admin
 *
 * Body JSON: { id: number, disponible?: boolean, precio?: number }
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return new Response(JSON.stringify({ error: 'id de plato requerido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** @type {Record<string, unknown>} */
  const patch = {};

  if (typeof body.disponible === 'boolean') {
    patch.disponible = body.disponible;
  }

  if (body.precio !== undefined && body.precio !== null) {
    const precio = Number(body.precio);
    if (!Number.isFinite(precio) || precio < 0) {
      return new Response(JSON.stringify({ error: 'precio inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    patch.precio = precio;
  }

  if (Object.keys(patch).length === 0) {
    return new Response(
      JSON.stringify({ error: 'Enviá disponible y/o precio para actualizar' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const writeClient = getSuperAdminWriteClient(supabase, user);

  const { data, error } = await writeClient
    .from('platos')
    .update(patch)
    .eq('id', id)
    .select('id, nombre, precio, disponible')
    .maybeSingle();

  if (error) {
    console.error('[api/update-plato]', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!data) {
    return new Response(
      JSON.stringify({
        error: isSuperAdminUser(user)
          ? 'Plato no encontrado. Si el error persiste, configurá SUPABASE_SERVICE_ROLE_KEY o aplicá las policies de SuperAdmin en SQL.'
          : 'Plato no encontrado o sin permiso',
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return new Response(JSON.stringify({ ok: true, plato: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
