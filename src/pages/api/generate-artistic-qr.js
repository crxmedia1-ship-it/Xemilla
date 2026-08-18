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

const QR_CONCEPTS = {
  sushi: {
    prompt:
      'Japanese sushi restaurant, zen minimalist interior, dark wood and stone textures, soft ambient lighting, cherry blossom motifs, elegant black and red palette, food photography style',
    negative:
      'ugly, blurry, distorted, western, colorful chaos, neon, cartoon',
  },
  burger: {
    prompt:
      'American grill burger restaurant, rustic industrial interior, exposed brick, warm Edison lights, dark metal and wood tones, smoky atmosphere, bold textures',
    negative:
      'ugly, blurry, distorted, japanese, sushi, elegant fine dining, pastel',
  },
  pizza: {
    prompt:
      'Italian pizzeria, mediterranean rustic interior, terracotta and cream tones, vine leaves, warm candlelight, artisan wood-fire oven in background, tuscany aesthetic',
    negative:
      'ugly, blurry, distorted, neon, modern industrial, dark, burger, sushi',
  },
  cocktails: {
    prompt:
      'Upscale cocktail bar, neon lights, dark moody atmosphere, purple and cyan glow, geometric patterns, luxury night club aesthetic, smoke and mirrors',
    negative:
      'ugly, blurry, distorted, natural daylight, rustic, wood, farmhouse',
  },
  finedining: {
    prompt:
      'Fine dining luxury restaurant, white tablecloths, crystal glassware, gold and ivory palette, soft elegant lighting, Michelin star aesthetic, minimalist modern',
    negative:
      'ugly, blurry, distorted, casual, fast food, neon, loud colors, busy patterns',
  },
};

const CLOUDINARY_FOLDER = 'xemilla/qr-artisticos';

/**
 * Genera un QR artístico vía Replicate ControlNet + lo sube a Cloudinary.
 * Body JSON: { restaurante_id, slug, concepto, peso_ia }
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

  if (!isSuperAdminUser(user)) {
    return json({ error: 'Solo el SuperAdmin puede generar QR artísticos' }, 403);
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
  const concepto = String(raw.concepto ?? 'sushi').toLowerCase().trim();
  const pesoIa = Math.min(0.5, Math.max(0.2, Number(raw.peso_ia ?? 0.35)));

  if (!restauranteId || !slug) {
    return json({ error: 'restaurante_id y slug son requeridos' }, 400);
  }

  const webAppUrl = `https://xemilla.app/${slug}`;

  const replicateToken =
    import.meta.env.REPLICATE_API_TOKEN ||
    process.env.REPLICATE_API_TOKEN ||
    '';

  let imageUrl = '';

  if (replicateToken) {
    try {
      imageUrl = await generateWithReplicate({
        webAppUrl,
        concepto,
        pesoIa,
        token: replicateToken,
      });
    } catch (err) {
      console.warn('[generate-artistic-qr] Replicate falló, usando QR estándar:', err?.message);
    }
  }

  // Fallback: QR estándar de alta resolución (800px)
  if (!imageUrl) {
    imageUrl = buildStandardQrUrl(webAppUrl, 800);
  }

  // Subir a Cloudinary si la URL es de Replicate (imagen generada)
  let cloudinaryUrl = imageUrl;
  if (imageUrl && !imageUrl.includes('qrserver.com')) {
    try {
      cloudinaryUrl = await uploadUrlToCloudinary(imageUrl, slug);
    } catch (err) {
      console.warn('[generate-artistic-qr] Cloudinary upload falló:', err?.message);
      cloudinaryUrl = imageUrl;
    }
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

  return json({
    ok: true,
    url: cloudinaryUrl,
    isArtistic: Boolean(replicateToken && !imageUrl.includes('qrserver.com')),
    webAppUrl,
  });
}

/**
 * @param {{ webAppUrl: string, concepto: string, pesoIa: number, token: string }} params
 * @returns {Promise<string>}
 */
async function generateWithReplicate({ webAppUrl, concepto, pesoIa, token }) {
  const concept = QR_CONCEPTS[concepto] || QR_CONCEPTS.sushi;

  // Iniciar predicción
  const startRes = await fetch(
    'https://api.replicate.com/v1/models/monster-labs/control_v1p_sd15_qrcode_monster/predictions',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: {
          image: buildStandardQrUrl(webAppUrl, 768),
          prompt: concept.prompt,
          negative_prompt: concept.negative,
          num_inference_steps: 40,
          guidance_scale: 7.5,
          controlnet_conditioning_scale: pesoIa,
          seed: Math.floor(Math.random() * 1_000_000),
          width: 768,
          height: 768,
        },
      }),
    },
  );

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Replicate HTTP ${startRes.status}: ${errText}`);
  }

  const prediction = await startRes.json();

  // `Prefer: wait` devuelve el resultado directamente si termina en <60s
  if (prediction.status === 'succeeded' && Array.isArray(prediction.output)) {
    return prediction.output[0];
  }

  // Polling hasta 120 segundos
  const predId = prediction.id;
  if (!predId) throw new Error('Replicate no devolvió ID de predicción');

  for (let i = 0; i < 24; i++) {
    await sleep(5000);
    const pollRes = await fetch(
      `https://api.replicate.com/v1/predictions/${predId}`,
      { headers: { Authorization: `Token ${token}` } },
    );
    if (!pollRes.ok) continue;
    const poll = await pollRes.json();
    if (poll.status === 'succeeded' && Array.isArray(poll.output)) {
      return poll.output[0];
    }
    if (poll.status === 'failed') {
      throw new Error(`Replicate predicción fallida: ${poll.error}`);
    }
  }

  throw new Error('Replicate timeout: la generación tardó más de 2 minutos');
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

/**
 * URL de QR estándar vía qrserver.com (sin API key, alta resolución).
 * @param {string} data
 * @param {number} size
 */
function buildStandardQrUrl(data, size = 512) {
  const params = new URLSearchParams({
    size: `${size}x${size}`,
    data,
    format: 'png',
    ecc: 'H',
    margin: '4',
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params}`;
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
