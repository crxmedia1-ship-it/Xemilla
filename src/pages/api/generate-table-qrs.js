import { isSuperAdminUser, getAssignedRestauranteId } from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';

export const prerender = false;

const MAX_MESAS = 200;
const QR_SIZE = 512;

/**
 * Genera URLs de QR individuales por mesa para impresión en lote.
 * Body JSON: { restaurante_id, slug, num_mesas }
 * Response: { ok: true, mesas: [{ numero, appUrl, qrUrl }] }
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
    return json({ error: 'Cuerpo de petición inválido' }, 400);
  }

  const restauranteId = String(raw.restaurante_id ?? '').trim();
  const slug = String(raw.slug ?? '').trim();
  const numMesas = Math.min(MAX_MESAS, Math.max(1, parseInt(String(raw.num_mesas ?? '10'), 10) || 10));

  if (!restauranteId || !slug) {
    return json({ error: 'restaurante_id y slug son requeridos' }, 400);
  }

  const isSuper = isSuperAdminUser(user);
  if (!isSuper) {
    const assigned = getAssignedRestauranteId(user);
    if (!assigned || assigned !== restauranteId) {
      return json({ error: 'Sin permiso para este restaurante' }, 403);
    }
  }

  const baseAppUrl = `https://xemilla.app/${slug}`;

  const mesas = Array.from({ length: numMesas }, (_, i) => {
    const numero = i + 1;
    const appUrl = `${baseAppUrl}?mesa=${numero}`;
    const qrUrl = buildQrUrl(appUrl, QR_SIZE);
    return { numero, appUrl, qrUrl };
  });

  // Persistir num_mesas para recordar la configuración del local
  try {
    const writeClient = getSuperAdminWriteClient(supabase, user);
    await writeClient
      .from('restaurantes')
      .update({ num_mesas: numMesas })
      .eq('id', restauranteId);
  } catch (err) {
    console.warn('[generate-table-qrs] num_mesas update:', err?.message);
  }

  return json({ ok: true, mesas, slug, baseAppUrl });
}

/**
 * @param {string} data
 * @param {number} size
 */
function buildQrUrl(data, size = 512) {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data,
    format: 'png',
    ecc: 'H',
    margin: '4',
    color: '000000',
    bgcolor: 'ffffff',
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params}`;
}

/**
 * @param {Record<string, unknown>} body
 * @param {number} [status]
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
