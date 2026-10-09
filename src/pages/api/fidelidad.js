import { getAdminDashboardData } from '../../lib/admin.js';
import { entrarFidelidad, escanearFidelidad, verFidelidad } from '../../lib/fidelidad-store.js';
import { createSupabaseServiceClient } from '../../lib/supabase/service.js';

export const prerender = false;

/**
 * Carta pública: entrar | ver.
 * Escáner del local (sesión): visita | canje.
 */
export async function POST({ request, cookies }) {
  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const action = String(body.action || '');
  const client = createSupabaseServiceClient();
  if (!client) return json({ error: 'El servidor no puede guardar tarjetas ahora.' }, 500);

  if (action === 'entrar' || action === 'ver') {
    const slug = String(body.slug || '').trim();
    if (!slug) return json({ error: 'Falta el local.' }, 400);
    const result =
      action === 'entrar'
        ? await entrarFidelidad(client, slug, body.telefono, body.nombre)
        : await verFidelidad(client, slug, body.codigo);
    if (result.error || !result.card) return json({ error: result.error || 'No se pudo abrir la tarjeta.' }, 400);
    return json({ ok: true, card: result.card, local: result.local || '' });
  }

  if (action === 'visita' || action === 'canje') {
    const session = await getAdminDashboardData(
      { request, cookies },
      { restauranteId: String(body.restaurante || ''), slug: String(body.slug || '') },
    );
    if (!session?.restaurante) return json({ error: 'No autenticado' }, 401);
    const result = await escanearFidelidad(client, session.restaurante, body.codigo, action);
    if (result.error || !result.card) return json({ error: result.error || 'No se pudo registrar.' }, 400);
    return json({ ok: true, card: result.card, mensaje: result.mensaje || '' });
  }

  return json({ error: 'Acción inválida.' }, 400);
}

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
