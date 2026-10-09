import { isSuperAdminUser } from '../../config/superadmin.js';
import { savePropuestaDefaults } from '../../lib/propuestas.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

/**
 * SuperAdmin: guarda el juego de precios de «Solo para degustadores».
 * PUT { adicionales }
 */
export async function PUT({ request, cookies }) {
  const supabase = createSupabaseServerClient({ request, cookies });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return json({ error: 'No autenticado' }, 401);
  if (!isSuperAdminUser(user)) return json({ error: 'Solo SuperAdmin' }, 403);

  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const result = await savePropuestaDefaults(
    getSuperAdminWriteClient(supabase, user),
    body.adicionales,
  );
  if (result.error || !result.data) return json({ error: result.error || 'No se pudo guardar' }, 400);
  return json({ ok: true, adicionales: result.data });
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
