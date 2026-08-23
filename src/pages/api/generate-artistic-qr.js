import { isSuperAdminUser } from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { getSuperAdminWriteClient } from '../../lib/superadmin.js';
import {
  optimizedPublicUrl,
  parseCloudinaryUrl,
  resolveCloudinaryUrl,
} from '../../lib/cloudinary.js';
import { v2 as cloudinary } from 'cloudinary';

export const prerender = false;

const CLOUDINARY_FOLDER = 'xemilla/qr-artisticos';

/** Endpoint moderno de Replicate: modelo oficial sin hash de versión */
const REPLICATE_MODEL_PREDICTIONS =
  'https://api.replicate.com/v1/models/zylim0702/qr_code_controlnet/predictions';

/**
 * Genera un QR artístico vía Replicate ControlNet + lo sube a Cloudinary.
 * Body JSON: { restaurante_id, slug, peso_ia, prompt_personalizado }
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
  const promptPersonalizado = String(raw.prompt_personalizado ?? '')
    .trim()
    .slice(0, 800);
  // ControlNet conditioning scale (default 1.2 para el modelo zylim0702)
  const pesoIa = Number.parseFloat(
    String(raw.controlnet_conditioning_scale ?? raw.peso_ia ?? ''),
  );

  if (!restauranteId || !slug) {
    return json({ error: 'restaurante_id y slug son requeridos' }, 400);
  }

  if (!promptPersonalizado) {
    return json({ error: 'prompt_personalizado es requerido' }, 400);
  }

  if (!isSuperAdminUser(user)) {
    return json({ error: 'Solo SuperAdmin puede generar QR artísticos' }, 403);
  }

  const webAppUrl = `https://xemilla.app/${slug}`;

  // 1. Lectura transparente de la variable de entorno (sin hardcodear claves)
  const replicateToken = String(
    import.meta.env.REPLICATE_API_TOKEN ||
      process.env.REPLICATE_API_TOKEN ||
      '',
  ).trim();

  if (!replicateToken) {
    return json(
      { error: 'Falta la API Key de Replicate en el archivo .env local.' },
      401,
    );
  }

  // 2. Generación vía Replicate — errores de saldo/auth se propagan al frontend
  let imageUrl = '';
  try {
    imageUrl = await generateWithReplicate({
      webAppUrl,
      pesoIa,
      prompt: promptPersonalizado,
      token: replicateToken,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error desconocido en Replicate';
    console.error('[generate-artistic-qr] Replicate:', message);
    return json({ error: message }, 500);
  }

  if (!imageUrl) {
    return json({ error: 'Replicate no devolvió una imagen válida' }, 500);
  }

  // Subir a Cloudinary
  let cloudinaryUrl = imageUrl;
  try {
    cloudinaryUrl = await uploadUrlToCloudinary(imageUrl, slug);
  } catch (err) {
    console.warn('[generate-artistic-qr] Cloudinary upload falló:', err?.message);
    cloudinaryUrl = imageUrl;
  }

  // Persistir en Supabase
  try {
    const writeClient = getSuperAdminWriteClient(supabase, user);
    await writeClient
      .from('restaurantes')
      .update({ qr_artistico_url: cloudinaryUrl })
      .eq('id', restauranteId);
  } catch (err) {
    console.warn('[generate-artistic-qr] Supabase update falló:', err?.message);
  }

  // 3. Formato de salida exitoso
  return json({
    ok: true,
    imagen_url: cloudinaryUrl,
  });
}

/**
 * @param {{ webAppUrl: string, pesoIa: number, prompt: string, token: string }} params
 * @returns {Promise<string>}
 */
async function generateWithReplicate({ webAppUrl, pesoIa, prompt, token }) {
  const scale = Number.parseFloat(String(pesoIa)) || 1.2;

  const startRes = await fetch(REPLICATE_MODEL_PREDICTIONS, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        url: webAppUrl,
        prompt,
        negative_prompt: 'ugly, disfigured, low quality, blurry, nsfw',
        controlnet_conditioning_scale: scale,
      },
    }),
  });

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Replicate HTTP ${startRes.status}: ${errText}`);
  }

  const prediction = await startRes.json();

  // `Prefer: wait` puede devolver el resultado completo si termina en <60s
  const immediate = extractOutputUrl(prediction);
  if (immediate) return immediate;

  if (prediction.status === 'failed') {
    throw new Error(
      `Replicate predicción fallida: ${prediction.error || 'sin detalle'}`,
    );
  }

  const predId = prediction.id;
  if (!predId) throw new Error('Replicate no devolvió ID de predicción');

  // Polling hasta ~120s
  for (let i = 0; i < 24; i++) {
    await sleep(5000);
    const pollRes = await fetch(
      `https://api.replicate.com/v1/predictions/${predId}`,
      { headers: { Authorization: `Token ${token}` } },
    );
    if (!pollRes.ok) continue;
    const poll = await pollRes.json();
    const url = extractOutputUrl(poll);
    if (url) return url;
    if (poll.status === 'failed') {
      throw new Error(`Replicate predicción fallida: ${poll.error || 'sin detalle'}`);
    }
  }

  throw new Error('Replicate timeout: la generación tardó más de 2 minutos');
}

/**
 * Extrae la URL de imagen del output de Replicate (array o string).
 * @param {Record<string, unknown>} prediction
 * @returns {string}
 */
function extractOutputUrl(prediction) {
  if (!prediction || prediction.status !== 'succeeded') return '';
  const output = prediction.output;
  if (Array.isArray(output) && output.length > 0) {
    return String(output[0] || '').trim();
  }
  if (typeof output === 'string') {
    return output.trim();
  }
  return '';
}

/**
 * @param {string} url - URL a subir
 * @param {string} slug
 * @returns {Promise<string>}
 */
async function uploadUrlToCloudinary(url, slug) {
  const cloudinaryUrl =
    process.env.CLOUDINARY_URL ||
    import.meta.env.CLOUDINARY_URL ||
    resolveCloudinaryUrl();

  if (!cloudinaryUrl) throw new Error('CLOUDINARY_URL no configurada');

  process.env.CLOUDINARY_URL = cloudinaryUrl;
  cloudinary.config({ cloudinary_url: cloudinaryUrl });

  const parsed = parseCloudinaryUrl(cloudinaryUrl);
  if (parsed) {
    cloudinary.config({
      cloud_name: parsed.cloud_name,
      api_key: parsed.api_key,
      api_secret: parsed.api_secret,
      secure: true,
    });
  }

  const result = await cloudinary.uploader.upload(url, {
    folder: CLOUDINARY_FOLDER,
    public_id: `qr-artistico-${slug}-${Date.now()}`,
    overwrite: true,
    resource_type: 'image',
  });

  return optimizedPublicUrl(result);
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
