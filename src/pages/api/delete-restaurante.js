import { isSuperAdminUser } from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * SuperAdmin: elimina un restaurante y su menú por completo.
 * Body: { id: uuid, confirm: slug } — confirm debe coincidir con el slug.
 *
 * Orden: platos → categorias → restaurante
 * (platos.categoria_id es ON DELETE RESTRICT).
 */
export async function POST({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return json({ error: 'No autenticado' }, 401);
  if (!isSuperAdminUser(user)) {
    return json({ error: 'Solo SuperAdmin puede eliminar restaurantes' }, 403);
  }

  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const id = String(body.id || '').trim();
  const confirm = String(body.confirm || '').trim().toLowerCase();
  if (!id) return json({ error: 'id de restaurante requerido' }, 400);
  if (!confirm) {
    return json(
      { error: 'Escribí el slug del local para confirmar la eliminación' },
      400,
    );
  }

  const writeClient = getSuperAdminWriteClient(supabase, user);
  const { data: row, error: fetchError } = await writeClient
    .from('restaurantes')
    .select('id, slug, nombre_comercial')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    console.error('[api/delete-restaurante] fetch', fetchError.message);
    return json({ error: fetchError.message }, 400);
  }
  if (!row) return json({ error: 'Restaurante no encontrado' }, 404);

  const slug = String(row.slug || '').trim().toLowerCase();
  if (confirm !== slug) {
    return json(
      {
        error: `Confirmación incorrecta. Escribí exactamente el slug: ${row.slug}`,
      },
      400,
    );
  }

  // 1) Platos primero (RESTRICT hacia categorias)
  const { error: platosError } = await writeClient
    .from('platos')
    .delete()
    .eq('restaurante_id', id);
  if (platosError) {
    console.error('[api/delete-restaurante] platos', platosError.message);
    return json({ error: `No se pudieron borrar platos: ${platosError.message}` }, 400);
  }

  // 2) Categorías
  const { error: catError } = await writeClient
    .from('categorias')
    .delete()
    .eq('restaurante_id', id);
  if (catError) {
    console.error('[api/delete-restaurante] categorias', catError.message);
    return json({
      error: `No se pudieron borrar categorías: ${catError.message}`,
    }, 400);
  }

  // 3) Restaurante (CASCADE limpia alertas / vistas si existen)
  const { data: deleted, error: delError } = await writeClient
    .from('restaurantes')
    .delete()
    .eq('id', id)
    .select('id, slug, nombre_comercial')
    .maybeSingle();

  if (delError) {
    console.error('[api/delete-restaurante]', delError.message);
    return json({ error: delError.message }, 400);
  }
  if (!deleted) return json({ error: 'No se pudo eliminar el restaurante' }, 404);

  return json({
    ok: true,
    deleted,
    message: `«${deleted.nombre_comercial || deleted.slug}» eliminado por completo.`,
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
