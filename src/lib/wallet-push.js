import http2 from 'node:http2';
import { walletStatus } from './wallet.js';

/**
 * Aviso que Wallet muestra en el teléfono al cambiar la tarjeta.
 * @param {string} texto
 */
export function mensajeWallet(texto) {
  const body = String(texto || 'Tu tarjeta se actualizó').trim().slice(0, 120) || 'Tu tarjeta se actualizó';
  return { header: 'Fidelidad', body, messageType: 'TEXT_AND_NOTIFY' };
}

/**
 * @param {{ token: string, topic: string, pfx: string, passphrase?: string }} aviso
 */
export function enviarPushApple(aviso) {
  if (!aviso.token || !aviso.topic || !aviso.pfx) return Promise.resolve({ ok: false, reason: 'claves' });
  return new Promise((resolve) => {
    const client = http2.connect('https://api.push.apple.com', {
      pfx: Buffer.from(aviso.pfx, 'base64'),
      passphrase: aviso.passphrase || '',
    });
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      client.close();
      resolve(result);
    };
    client.on('error', (error) => done({ ok: false, reason: error.message }));
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${aviso.token}`,
      'apns-topic': aviso.topic,
      'apns-push-type': 'background',
      'apns-priority': '5',
    });
    let status = 0;
    req.setTimeout(8000, () => done({ ok: false, reason: 'tiempo' }));
    req.on('response', (headers) => {
      status = Number(headers[':status'] || 0);
    });
    req.on('end', () => done({ ok: status === 200, status }));
    req.on('error', (error) => done({ ok: false, reason: error.message }));
    req.end('{}');
  });
}

/**
 * @param {{ clientEmail: string, privateKey: string }} cuenta
 */
async function tokenGoogle(cuenta) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claim = Buffer.from(JSON.stringify({
    iss: cuenta.clientEmail,
    scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const firma = signer.sign(cuenta.privateKey).toString('base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${firma}`,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  return String(payload.access_token || '');
}

/**
 * @param {{ objectId: string, texto: string, serviceAccountJson: string }} aviso
 */
export async function enviarPushGoogle(aviso) {
  if (!aviso.objectId || !aviso.serviceAccountJson) return { ok: false, reason: 'claves' };
  let cuenta;
  try {
    cuenta = JSON.parse(aviso.serviceAccountJson);
  } catch {
    return { ok: false, reason: 'claves' };
  }
  const access = await tokenGoogle({
    clientEmail: String(cuenta.client_email || ''),
    privateKey: String(cuenta.private_key || ''),
  });
  if (!access) return { ok: false, reason: 'claves' };
  const response = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(aviso.objectId)}/addMessage`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: mensajeWallet(aviso.texto) }),
    },
  );
  return { ok: response.ok, status: response.status };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} tarjetaId
 * @param {string} texto
 * @param {Record<string, string | undefined>} [env]
 */
export async function avisarWallet(client, tarjetaId, texto, env = import.meta.env) {
  const { data, error } = await client
    .from('fidelidad_wallet_dispositivos')
    .select('plataforma, device_id, push_token')
    .eq('tarjeta_id', tarjetaId);
  if (error || !data?.length) return { enviados: 0 };
  const status = walletStatus(env);
  const issuer = String(env.GOOGLE_WALLET_ISSUER_ID || '');
  let enviados = 0;
  await Promise.all(data.map(async (device) => {
    if (device.plataforma === 'apple' && device.push_token && status.apple) {
      const result = await enviarPushApple({
        token: device.push_token,
        topic: String(env.APPLE_PASS_TYPE_ID || ''),
        pfx: String(env.APPLE_PASS_CERT_BASE64 || ''),
        passphrase: env.APPLE_PASS_CERT_PASSWORD,
      });
      if (result.ok) enviados += 1;
      else console.error('[wallet] apple:', result.reason || result.status);
      return;
    }
    if (device.plataforma === 'google' && status.google) {
      const objectId = device.device_id.includes('.') ? device.device_id : `${issuer}.${device.device_id}`;
      const result = await enviarPushGoogle({
        objectId,
        texto,
        serviceAccountJson: String(env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON || ''),
      });
      if (result.ok) enviados += 1;
      else console.error('[wallet] google:', result.reason || result.status);
    }
  }));
  return { enviados };
}
