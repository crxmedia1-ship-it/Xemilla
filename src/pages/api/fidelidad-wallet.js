import { registrarWallet, tokenDeTarjeta, verFidelidad } from '../../lib/fidelidad-store.js';
import { createSupabaseServiceClient } from '../../lib/supabase/service.js';
import { buildWalletPass, walletStatus } from '../../lib/wallet.js';

export const prerender = false;

/**
 * Arma el pase. Sin las claves del emisor no lo firma ni lo descarga.
 * POST { slug, codigo }
 */
export async function POST({ request }) {
  /** @type {Record<string, unknown>} */
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const client = createSupabaseServiceClient();
  if (!client) return json({ error: 'El servidor no puede leer la tarjeta ahora.' }, 500);

  const result = await verFidelidad(client, String(body.slug || '').trim(), body.codigo);
  if (result.error || !result.card) return json({ error: result.error || 'No se pudo armar el pase.' }, 400);

  const slug = String(body.slug || '').trim();
  const acceso = await tokenDeTarjeta(client, slug, body.codigo);
  const origin = new URL(request.url).origin;
  const status = walletStatus();
  const pass = buildWalletPass(
    result.card,
    { nombre: String(result.local || ''), slug },
    result.diseno,
    {
      webServiceURL: `${origin}/api/wallet`,
      authenticationToken: acceso.token || '',
      passTypeIdentifier: import.meta.env.APPLE_PASS_TYPE_ID || 'pending',
    },
  );

  if (body.plataforma === 'google' && acceso.tarjetaId && pass.google.id) {
    await registrarWallet(client, {
      plataforma: 'google',
      deviceId: pass.google.id,
      serial: `${slug}:${result.card.codigo}`,
      token: acceso.token || '',
    });
  }

  if (!status.ready) {
    return json({
      ok: true,
      ready: false,
      apple: false,
      google: false,
      message: 'Al guardar la tarjeta en Wallet, el teléfono avisa cuando sumes puntos. Falta la clave del emisor para firmar el pase.',
    });
  }

  return json({
    ok: true,
    ready: true,
    apple: status.apple,
    google: status.google,
    message: 'Las claves ya están. El pase queda listo para firmar.',
    pass,
  });
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
