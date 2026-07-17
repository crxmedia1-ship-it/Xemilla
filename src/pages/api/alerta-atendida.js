import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';
import { isSuperAdminUser } from '../../config/superadmin.js';

export const prerender = false;

/**
 * Marca una alerta de mesa como atendida.
 * POST { alerta_id }
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

  /** @type {Record<string, unknown>} */
  let raw = {};
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const alertaId = String(raw.alerta_id || '').trim();
  if (!alertaId) return json({ error: 'alerta_id requerido' }, 400);

  const writeClient = isSuperAdminUser(user)
    ? getSuperAdminWriteClient(supabase, user)
    : supabase;

  let { data, error } = await writeClient
    .from('alertas_mesas')
    .update({ atendida: true, atendida_at: new Date().toISOString() })
    .eq('id', alertaId)
    .eq('atendida', false)
    .select('id, mesa, tipo, atendida, atendida_at')
    .maybeSingle();

  if (error && /atendida_at|column|schema cache/i.test(error.message || '')) {
    const retry = await writeClient
      .from('alertas_mesas')
      .update({ atendida: true })
      .eq('id', alertaId)
      .eq('atendida', false)
      .select('id, mesa, tipo, atendida')
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error('[api/alerta-atendida]', error.message);
    return json({ error: error.message }, 400);
  }

  if (!data) {
    return json({ error: 'Alerta no encontrada o ya atendida' }, 404);
  }

  return json({ ok: true, alerta: data });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
