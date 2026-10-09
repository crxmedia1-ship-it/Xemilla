import { leerApplePassToken } from '../../../lib/wallet.js';
import { registrarWallet, retirarWallet, serialesWallet } from '../../../lib/fidelidad-store.js';
import { createSupabaseServiceClient } from '../../../lib/supabase/service.js';

export const prerender = false;

/**
 * Servicio que Apple Wallet llama para registrar el teléfono y pedir el pase nuevo.
 * @param {import('astro').APIContext} context
 * @param {'GET' | 'POST' | 'DELETE'} method
 */
async function handle({ request, params }, method) {
  const path = (Array.isArray(params.path) ? params.path : String(params.path || '').split('/')).filter(Boolean);
  const client = createSupabaseServiceClient();
  if (!client) return new Response('No disponible', { status: 503 });

  if (method === 'POST' && path[0] === 'v1' && path[1] === 'log') {
    return new Response(null, { status: 200 });
  }

  const token = leerApplePassToken(request.headers.get('authorization'));

  if (path[0] === 'v1' && path[1] === 'devices' && path[3] === 'registrations' && path.length === 6) {
    const deviceId = decodeURIComponent(path[2]);
    const serial = decodeURIComponent(path[5]);
    if (method === 'DELETE') {
      const result = await retirarWallet(client, { deviceId, serial, token });
      return new Response(null, { status: result.status });
    }
    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const result = await registrarWallet(client, {
        plataforma: 'apple',
        deviceId,
        pushToken: String(body.pushToken || ''),
        serial,
        token,
      });
      return new Response(null, { status: result.status || 500 });
    }
  }

  if (method === 'GET' && path[0] === 'v1' && path[1] === 'devices' && path[3] === 'registrations' && path.length === 5) {
    const url = new URL(request.url);
    const list = await serialesWallet(
      client,
      decodeURIComponent(path[2]),
      url.searchParams.get('passesUpdatedSince') || '',
    );
    return Response.json(list);
  }

  if (method === 'GET' && path[0] === 'v1' && path[1] === 'passes') {
    if (!token) return new Response(null, { status: 401 });
    return new Response('El pase firmado espera las claves del emisor.', { status: 503 });
  }

  return new Response(null, { status: 404 });
}

/** @param {import('astro').APIContext} context */
export function GET(context) {
  return handle(context, 'GET');
}

/** @param {import('astro').APIContext} context */
export function POST(context) {
  return handle(context, 'POST');
}

/** @param {import('astro').APIContext} context */
export function DELETE(context) {
  return handle(context, 'DELETE');
}
