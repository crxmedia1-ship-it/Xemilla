import { createSupabaseServiceClient } from '../../../lib/supabase/service.js';
import { createSupabaseServerClient } from '../../../lib/supabase/server.js';

export const prerender = false;

/**
 * Valida el PIN de 4 dígitos para unirse a una sesión de mesa activa.
 * PÚBLICO — no requiere auth.
 * POST { restaurante_id, mesa_numero, pin }
 * → { ok, sesion_id, mesa_numero }
 */
export async function POST({ request, cookies }) {
  let raw = {};
  try { raw = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  const restauranteId = String(raw.restaurante_id ?? '').trim();
  const mesaNumero = parseInt(String(raw.mesa_numero ?? '0'), 10);
  const pin = String(raw.pin ?? '').trim();

  if (!restauranteId) return json({ error: 'restaurante_id requerido' }, 400);
  if (!mesaNumero || mesaNumero < 1) return json({ error: 'mesa_numero inválido' }, 400);
  if (!pin || !/^\d{4}$/.test(pin)) return json({ error: 'PIN debe ser 4 dígitos' }, 400);

  const service = createSupabaseServiceClient() ?? createSupabaseServerClient({ request, cookies });

  const { data, error } = await service
    .from('sesiones_mesa')
    .select('id, mesa_numero, pin, estado')
    .eq('restaurante_id', restauranteId)
    .eq('mesa_numero', mesaNumero)
    .eq('estado', 'activa')
    .maybeSingle();

  if (error) return json({ error: 'Error consultando sesión' }, 500);
  if (!data) return json({ error: 'No hay sesión activa en esta mesa', code: 'NO_SESSION' }, 404);
  if (data.pin !== pin) return json({ error: 'PIN incorrecto', code: 'WRONG_PIN' }, 403);

  return json({ ok: true, sesion_id: data.id, mesa_numero: data.mesa_numero });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
