import { createSupabaseServiceClient } from '../../lib/supabase/service.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';

export const prerender = false;

/**
 * Registra una visualización de plato (upsert + incremento).
 * Pensado para fire-and-forget: errores no deben romper el menú.
 * POST { restaurante_id, plato_id, plato_nombre? }
 */
export async function POST({ request, cookies }) {
  /** @type {Record<string, unknown>} */
  let raw = {};
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }

  const restauranteId = String(raw.restaurante_id || '').trim();
  const platoId = Number(raw.plato_id);
  const platoNombre = String(raw.plato_nombre || raw.nombre || '')
    .trim()
    .slice(0, 160);

  if (!restauranteId) {
    return json({ ok: false, error: 'restaurante_id requerido' }, 400);
  }
  if (!Number.isFinite(platoId) || platoId <= 0 || !Number.isInteger(platoId)) {
    return json({ ok: false, error: 'plato_id bigint inválido' }, 400);
  }

  try {
    const service = createSupabaseServiceClient();
    const client = service ?? createSupabaseServerClient({ request, cookies });

    const { data: existing, error: readErr } = await client
      .from('plato_vistas')
      .select('id, vistas')
      .eq('restaurante_id', restauranteId)
      .eq('plato_id', platoId)
      .maybeSingle();

    if (readErr) {
      console.warn('[api/registro-vista]', readErr.message);
      return json({ ok: false, skipped: true }, 200);
    }

    const now = new Date().toISOString();

    if (existing?.id) {
      const { error: updErr } = await client
        .from('plato_vistas')
        .update({
          vistas: (Number(existing.vistas) || 0) + 1,
          updated_at: now,
          ...(platoNombre ? { plato_nombre: platoNombre } : {}),
        })
        .eq('id', existing.id);

      if (updErr) {
        console.warn('[api/registro-vista] update:', updErr.message);
        return json({ ok: false }, 200);
      }
    } else {
      const { error: insErr } = await client.from('plato_vistas').insert({
        restaurante_id: restauranteId,
        plato_id: platoId,
        plato_nombre: platoNombre || null,
        vistas: 1,
        updated_at: now,
      });

      if (insErr) {
        if (/duplicate|unique/i.test(insErr.message || '')) {
          const { data: again } = await client
            .from('plato_vistas')
            .select('id, vistas')
            .eq('restaurante_id', restauranteId)
            .eq('plato_id', platoId)
            .maybeSingle();
          if (again?.id) {
            await client
              .from('plato_vistas')
              .update({
                vistas: (Number(again.vistas) || 0) + 1,
                updated_at: now,
                ...(platoNombre ? { plato_nombre: platoNombre } : {}),
              })
              .eq('id', again.id);
          }
        } else {
          console.warn('[api/registro-vista] insert:', insErr.message);
          return json({ ok: false }, 200);
        }
      }
    }

    return json({ ok: true });
  } catch (err) {
    console.warn(
      '[api/registro-vista]',
      err instanceof Error ? err.message : err,
    );
    return json({ ok: false }, 200);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
