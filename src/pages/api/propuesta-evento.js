import { isPropuestaId, readPropuestaTipo, touchPropuesta } from '../../lib/propuestas.js';
import { createSupabaseServiceClient } from '../../lib/supabase/service.js';

export const prerender = false;

const THROTTLE_MS = 12_000;
const THROTTLE_MAX_KEYS = 4_000;
/** @type {Map<string, number>} */
const recent = new Map();

/**
 * @param {string} key
 */
function isThrottled(key) {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < THROTTLE_MS) return true;
  if (recent.size >= THROTTLE_MAX_KEYS) recent.clear();
  recent.set(key, now);
  return false;
}

/**
 * Cuenta lo que el cliente abrió en una propuesta guardada.
 * POST { id, tipo: 'ar' | 'nutri' | 'qr' | 'ia' | 'whatsapp' }
 * La vista de la página se cuenta en el servidor al abrir el enlace.
 */
export async function POST(ctx) {
  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await ctx.request.json();
  } catch {
    return json({ ok: false }, 400);
  }

  const id = String(body.id || '').trim();
  const tipo = readPropuestaTipo(body.tipo);
  if (!isPropuestaId(id) || !tipo || tipo === 'vista') return json({ ok: false }, 400);

  let ip = 'unknown';
  try {
    ip = ctx.clientAddress || 'unknown';
  } catch {
    ip = 'unknown';
  }
  if (isThrottled(`${ip}:${id}:${tipo}`)) return json({ ok: true, throttled: true });

  const service = createSupabaseServiceClient();
  if (!service) return json({ ok: false }, 503);

  const ok = await touchPropuesta(service, id, tipo);
  return json({ ok }, ok ? 200 : 500);
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
