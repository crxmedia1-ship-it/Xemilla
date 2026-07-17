import { isSuperAdminUser } from '../../config/superadmin.js';
import { parseMenuBulkText, bulkInsertPlatos } from '../../lib/menu-bulk.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * Bulk insert de menú completo.
 * Body JSON: { restaurante_id: string, text: string }
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

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const restauranteId = String(body?.restaurante_id ?? '').trim();
  const text = String(body?.text ?? '');

  if (!restauranteId) return json({ error: 'restaurante_id requerido' }, 400);

  // Carga masiva: exclusivo SuperAdmin (UI + API)
  if (!isSuperAdminUser(user)) {
    return json(
      { error: 'Carga masiva solo disponible para SuperAdmin' },
      403,
    );
  }

  const { rows, errors } = parseMenuBulkText(text);
  if (rows.length === 0) {
    return json(
      {
        error: errors[0] || 'No hay filas válidas para insertar.',
        parse_errors: errors,
      },
      400,
    );
  }

  const writeClient = getSuperAdminWriteClient(supabase, user);

  let result;
  try {
    result = await bulkInsertPlatos(writeClient, restauranteId, rows);
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Error en inserción masiva' },
      400,
    );
  }

  if (result.error) {
    return json({ error: result.error, parse_errors: errors }, 400);
  }

  return json({
    ok: true,
    count: result.inserted.length,
    platos: result.inserted,
    parse_errors: errors,
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
