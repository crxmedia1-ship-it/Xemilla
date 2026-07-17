import { v2 as cloudinary } from 'cloudinary';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import { optimizedPublicUrl, parseCloudinaryUrl } from '../../lib/cloudinary.js';

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
 * Sube archivo binario a Cloudinary (auth requerida).
 * multipart/form-data: campo `file`
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

  // Fallback hardcodeado temporal: evita caché local de Vite con API key truncada
  const cloudinaryUrl =
    process.env.CLOUDINARY_URL ||
    import.meta.env.CLOUDINARY_URL ||
    'cloudinary://431243764553982:oueG6PQv3r_j02I_fhB0BY5x71Q@dgphys1xd';

  process.env.CLOUDINARY_URL = cloudinaryUrl;
  cloudinary.config({
    cloudinary_url: cloudinaryUrl,
  });

  // Forzar re-parse explícito (api_key / secret / cloud_name) por si cloudinary_url no se aplica en esta versión del SDK
  const parsed = parseCloudinaryUrl(cloudinaryUrl);
  if (parsed) {
    cloudinary.config({
      cloud_name: parsed.cloud_name,
      api_key: parsed.api_key,
      api_secret: parsed.api_secret,
      secure: true,
    });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'FormData inválido' }, 400);
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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          folder: 'xemilla',
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

    return json({
      ok: true,
      url: optimizedPublicUrl(result),
      public_id: result.public_id,
      resource_type: result.resource_type,
      bytes: result.bytes,
      format: result.format,
      width: result.width,
      height: result.height,
      duration: result.duration ?? null,
    });
  } catch (error) {
    console.error('❌ ERROR CRÍTICO CLOUDINARY:', error);
    return json(
      {
        error: error?.message || String(error) || 'Error al subir a Cloudinary',
      },
      500,
    );
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
