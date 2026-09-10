import { v2 as cloudinary } from 'cloudinary';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import {
  optimizedPublicUrl,
  normalizeCloudinaryAssetType,
} from '../../lib/cloudinary.js';

export const prerender = false;

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

/**
 * @param {unknown} value
 */
function envStr(value) {
  return String(value ?? '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

/**
 * Credenciales xemilla-app / wdmzaemi (solo servidor).
 */
function getServerCredentials() {
  return {
    cloud_name:
      envStr(import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME) ||
      envStr(process.env.PUBLIC_CLOUDINARY_CLOUD_NAME) ||
      'wdmzaemi',
    api_key:
      envStr(import.meta.env.CLOUDINARY_API_KEY) ||
      envStr(process.env.CLOUDINARY_API_KEY) ||
      '898619513596338',
    api_secret:
      envStr(import.meta.env.CLOUDINARY_API_SECRET) ||
      envStr(process.env.CLOUDINARY_API_SECRET) ||
      'wwbvurr5oDt0BantZHTn4O3IJJQ',
  };
}

/**
 * Configura el SDK y limpia CLOUDINARY_URL residual.
 */
function configureCloudinaryServer() {
  const { cloud_name, api_key, api_secret } = getServerCredentials();
  delete process.env.CLOUDINARY_URL;
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return { cloud_name, api_key, api_secret };
}

/**
 * Subida 100% server-side con Basic Auth (sin firma calculada en el cliente).
 * FormData: file, restaurante_slug, asset_type [, restaurante_id]
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

  const creds = configureCloudinaryServer();

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'FormData inválido' }, 400);
  }

  // Ignorar cualquier intento de firma enviada por el navegador
  for (const key of ['signature', 'timestamp', 'api_key', 'api_secret']) {
    if (form.has(key)) form.delete(key);
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return json({ error: 'Archivo requerido (campo file)' }, 400);
  }

  if (file.size > MAX_BYTES) {
    return json({ error: 'El archivo no puede superar 25 MB' }, 400);
  }

  if (
    file.type &&
    !ALLOWED.has(file.type) &&
    !file.type.startsWith('image/') &&
    !file.type.startsWith('video/')
  ) {
    return json({ error: `Tipo no permitido: ${file.type}` }, 400);
  }

  let slug = String(form.get('restaurante_slug') || form.get('slug') || '').trim();
  const restauranteId = String(form.get('restaurante_id') || '').trim();
  if (!slug && restauranteId) {
    const { data: restRow } = await supabase
      .from('restaurantes')
      .select('slug')
      .eq('id', restauranteId)
      .maybeSingle();
    slug = String(restRow?.slug || '').trim();
  }
  if (!slug) slug = 'black-sushi';

  const rawAssetType = String(form.get('asset_type') || '').trim();
  const assetType = normalizeCloudinaryAssetType(rawAssetType || 'dishes');
  const targetFolder = `xemilla/restaurants/${slug}/${assetType}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    /** Prefer upload_stream (binary) — SDK firma en servidor con api_secret */
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: targetFolder,
          resource_type: 'auto',
          overwrite: false,
          unique_filename: true,
          use_filename: true,
        },
        (err, uploaded) => {
          if (err || !uploaded) reject(err || new Error('Upload vacío'));
          else resolve(uploaded);
        },
      );
      stream.end(buffer);
    });

    const url =
      optimizedPublicUrl(uploadResult) ||
      uploadResult.secure_url ||
      uploadResult.url ||
      '';

    return json({
      ok: true,
      url,
      secure_url: uploadResult.secure_url || url,
      public_id: uploadResult.public_id,
      folder: targetFolder,
      resource_type: uploadResult.resource_type,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      width: uploadResult.width,
      height: uploadResult.height,
      duration: uploadResult.duration ?? null,
      cloud_name: creds.cloud_name,
    });
  } catch (error) {
    const message = error?.message || String(error) || 'Error al subir a Cloudinary';
    console.error('❌ ERROR CRÍTICO CLOUDINARY:', {
      message,
      cloud_name: creds.cloud_name,
      api_key: creds.api_key,
    });
    return json({ error: message }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
