import { createSupabaseServiceClient } from '../../../lib/supabase/service.js';
import { createSupabaseServerClient } from '../../../lib/supabase/server.js';

export const prerender = false;

/**
 * Devuelve el estado de la sesión + pedidos activos.
 * GET ?sesion_id=UUID&restaurante_id=X
 * → { ok, sesion, pedidos, resumen: [{ comensal, items, total }] }
 */
export async function GET({ url, request, cookies }) {
  const sesionId = url.searchParams.get('sesion_id') || '';
  const restauranteId = url.searchParams.get('restaurante_id') || '';

  if (!sesionId || !restauranteId) return json({ error: 'sesion_id y restaurante_id requeridos' }, 400);

  const service = createSupabaseServiceClient() ?? createSupabaseServerClient({ request, cookies });

  const [{ data: sesion }, { data: pedidos }] = await Promise.all([
    service.from('sesiones_mesa').select('id, mesa_numero, estado, created_at, closed_at').eq('id', sesionId).maybeSingle(),
    service.from('pedidos_live').select('*').eq('sesion_id', sesionId).order('created_at', { ascending: true }),
  ]);

  if (!sesion) return json({ error: 'Sesión no encontrada' }, 404);

  // Build per-person summary
  const byPerson = {};
  for (const p of pedidos || []) {
    if (p.tipo !== 'plato') continue;
    if (!byPerson[p.comensal_nombre]) byPerson[p.comensal_nombre] = { items: [], total: 0 };
    byPerson[p.comensal_nombre].items.push(p);
    byPerson[p.comensal_nombre].total += (p.plato_precio || 0) * p.cantidad;
  }

  const resumen = Object.entries(byPerson).map(([comensal, data]) => ({
    comensal,
    items: data.items,
    total: data.total,
  }));

  const totalMesa = resumen.reduce((s, r) => s + r.total, 0);

  return json({ ok: true, sesion, pedidos: pedidos || [], resumen, total_mesa: totalMesa });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
