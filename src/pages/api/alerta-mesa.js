import { createSupabaseServiceClient } from '../../lib/supabase/service.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { normalizeMesa } from '../../lib/mesa-session.js';

export const prerender = false;

const TIPOS = new Set(['mesero', 'cuenta']);

/**
 * Crea una alerta de mesa desde la WebApp pública.
 * POST { restaurante_id, mesa, tipo: 'mesero'|'cuenta' }
 * Requiere `mesa` válida (asignada vía QR); sin ella → 403.
 */
export async function POST({ request, cookies }) {
  /** @type {Record<string, unknown>} */
  let raw = {};
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const restauranteId = String(raw.restaurante_id || '').trim();
  const mesa = normalizeMesa(raw.mesa);
  const tipo = String(raw.tipo || '').trim().toLowerCase();

  if (!restauranteId) {
    return json({ error: 'restaurante_id requerido' }, 400);
  }

  if (!mesa) {
    return json(
      {
        error:
          'No autorizado: se requiere un número de mesa válido (escanea el QR de tu mesa).',
        code: 'MESA_REQUIRED',
      },
      403,
    );
  }

  if (!TIPOS.has(tipo)) {
    return json({ error: 'tipo inválido (mesero | cuenta)' }, 400);
  }

  const service = createSupabaseServiceClient();
  const client = service ?? createSupabaseServerClient({ request, cookies });

  const { data, error } = await client
    .from('alertas_mesas')
    .insert({
      restaurante_id: restauranteId,
      mesa,
      tipo,
      atendida: false,
    })
    .select('id, restaurante_id, mesa, tipo, atendida, created_at')
    .maybeSingle();

  if (error) {
    console.error('[api/alerta-mesa]', error.message);
    return json({ error: error.message }, 400);
  }

  return json({
    ok: true,
    message:
      tipo === 'cuenta'
        ? 'Solicitud de cuenta enviada. Enseguida te atienden.'
        : 'Mesero avisado. Enseguida te atienden.',
    alerta: data,
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
