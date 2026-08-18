import { createSupabaseServiceClient } from '../../../lib/supabase/service.js';
import { createSupabaseServerClient } from '../../../lib/supabase/server.js';

export const prerender = false;

/**
 * Agrega un pedido a la sesión activa de una mesa.
 * PÚBLICO — identificado por sesion_id (validado por PIN).
 * POST { sesion_id, restaurante_id, comensal_nombre, plato_id?, plato_nombre, plato_precio?, cantidad?, tipo? }
 * → { ok, pedido_id }
 */
export async function POST({ request, cookies }) {
  let raw = {};
  try { raw = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  const sesionId = String(raw.sesion_id ?? '').trim();
  const restauranteId = String(raw.restaurante_id ?? '').trim();
  const comensalNombre = String(raw.comensal_nombre ?? '').trim().slice(0, 60);
  const platoId = raw.plato_id ? String(raw.plato_id).trim() : null;
  const platoNombre = String(raw.plato_nombre ?? '').trim().slice(0, 120);
  const platoPrecio = Number(raw.plato_precio ?? 0) || 0;
  const cantidad = Math.max(1, Math.min(20, parseInt(String(raw.cantidad ?? '1'), 10) || 1));
  const tipo = ['plato', 'mesero', 'cuenta'].includes(String(raw.tipo ?? ''))
    ? String(raw.tipo)
    : 'plato';

  if (!sesionId || !restauranteId) return json({ error: 'sesion_id y restaurante_id requeridos' }, 400);
  if (!comensalNombre) return json({ error: 'comensal_nombre requerido' }, 400);
  if (!platoNombre) return json({ error: 'plato_nombre requerido' }, 400);

  const service = createSupabaseServiceClient() ?? createSupabaseServerClient({ request, cookies });

  // Verify session is still active
  const { data: sesion } = await service
    .from('sesiones_mesa')
    .select('id, estado, mesa_numero')
    .eq('id', sesionId)
    .eq('restaurante_id', restauranteId)
    .maybeSingle();

  if (!sesion) return json({ error: 'Sesión no encontrada', code: 'NO_SESSION' }, 404);
  if (sesion.estado !== 'activa') return json({ error: 'La sesión de esta mesa ya fue cerrada', code: 'SESSION_CLOSED' }, 410);

  const { data, error } = await service
    .from('pedidos_live')
    .insert({
      sesion_id: sesionId,
      restaurante_id: restauranteId,
      mesa_numero: sesion.mesa_numero,
      comensal_nombre: comensalNombre,
      plato_id: platoId,
      plato_nombre: platoNombre,
      plato_precio: platoPrecio,
      cantidad,
      tipo,
      estado: 'pendiente',
    })
    .select('id')
    .maybeSingle();

  if (error) return json({ error: error.message }, 400);

  return json({ ok: true, pedido_id: data.id });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
