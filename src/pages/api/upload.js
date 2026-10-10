import { v2 as cloudinary } from 'cloudinary';
import { getAssignedRestauranteId, isSuperAdminUser } from '../../config/superadmin.js';
import { createSupabaseServerClient } from '../../lib/supabase/server.js';
import {
  optimizedPublicUrl,
  normalizeCloudinaryAssetType,
  resolveCloudinaryCredentials,
  sanitizeMediaFolderSegment,
} from '../../lib/cloudinary.js';

export const prerender = false;

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_SVG_BYTES = 2 * 1024 * 1024;
const SVG_TYPE = 'image/svg+xml';
const ALLOWED = new Set([
  SVG_TYPE,
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/x-m4v',
  'video/webm',
  'video/quicktime',
]);

/**
 * Configura el SDK con las credenciales de entorno y limpia CLOUDINARY_URL residual.
 * @returns {{ cloud_name: string, api_key: string, api_secret: string } | null}
 */
function configureCloudinaryServer() {
  const creds = resolveCloudinaryCredentials();
  if (!creds) return null;
  delete process.env.CLOUDINARY_URL;
  cloudinary.config({ ...creds, secure: true });
  return creds;
}

/**
 * Resuelve la carpeta destino respetando la propiedad del restaurante.
 * SuperAdmin puede subir a cualquier slug (incluido uno aún no creado).
 * Operativo solo a su restaurante asignado o del que es dueño (`user_id`).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('@supabase/supabase-js').User} user
 * @param {string} requestedSlug
 * @param {string} requestedId
 * @returns {Promise<{ slug: string } | { error: string, status: number }>}
 */
async function resolveUploadSlug(supabase, user, requestedSlug, requestedId) {
  /** @param {{ column: 'id' | 'slug', value: string }} q */
  const findRestaurante = async ({ column, value }) => {
    const { data } = await supabase
      .from('restaurantes')
      .select('id, slug, user_id')
      .eq(column, value)
      .maybeSingle();
    return data;
  };

  if (isSuperAdminUser(user)) {
    if (requestedSlug) return { slug: requestedSlug };
    if (requestedId) {
      const row = await findRestaurante({ column: 'id', value: requestedId });
      if (row?.slug) return { slug: row.slug };
    }
    return { slug: 'general' };
  }

  const assigned = getAssignedRestauranteId(user);
  const isAssigned = (row) =>
    Boolean(row) &&
    ((assigned && (String(row.id) === assigned || row.slug === assigned)) ||
      row.user_id === user.id);

  if (requestedId || requestedSlug) {
    const row = requestedId
      ? await findRestaurante({ column: 'id', value: requestedId })
      : await findRestaurante({ column: 'slug', value: requestedSlug });
    if (!isAssigned(row)) {
      return { error: 'Sin permiso para este restaurante', status: 403 };
    }
    return { slug: row.slug };
  }

  if (assigned) {
    const row =
      (await findRestaurante({ column: 'id', value: assigned })) ||
      (await findRestaurante({ column: 'slug', value: assigned }));
    if (row?.slug) return { slug: row.slug };
  }

  return { error: 'No hay un restaurante asignado a esta cuenta', status: 403 };
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
  if (!creds) {
    console.error(
      '[api/upload] Faltan CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET / PUBLIC_CLOUDINARY_CLOUD_NAME',
    );
    return json({ error: 'Cloudinary no está configurado en el servidor' }, 503);
  }

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

  const fileType = file.type === 'image/jpg' || file.type === 'image/pjpeg' ? 'image/jpeg' : file.type;
  const namedImage = !fileType && /\.(png|jpe?g|webp|gif|avif|heic|heif|svg)$/i.test(file.name);
  if (!ALLOWED.has(fileType) && !namedImage) {
    return json({ error: `Tipo no permitido: ${file.type || 'desconocido'}` }, 400);
  }

  const isSvg = fileType === SVG_TYPE || (!fileType && /\.svg$/i.test(file.name));
  if (isSvg) {
    if (file.size > MAX_SVG_BYTES) {
      return json({ error: 'El SVG no puede superar 2 MB' }, 400);
    }
    if (!isSafeSvg(await file.text())) {
      return json({ error: 'Ese SVG trae código o enlaces externos. Expórtalo de nuevo como SVG simple.' }, 400);
    }
  }

  const requestedSlug = String(form.get('restaurante_slug') || form.get('slug') || '').trim();
  const requestedId = String(form.get('restaurante_id') || '').trim();
  const target = await resolveUploadSlug(supabase, user, requestedSlug, requestedId);
  if ('error' in target) {
    return json({ error: target.error }, target.status);
  }
  const slug = sanitizeMediaFolderSegment(target.slug, 'general');

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

    /** El SVG va sin transformaciones de entrega para que siga siendo vectorial. */
    const url =
      (isSvg ? uploadResult.secure_url : optimizedPublicUrl(uploadResult)) ||
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
    });
    return json({ error: message }, 500);
  }
}

/**
 * Un SVG puede ejecutar código si alguien lo abre directo en el navegador:
 * solo se aceptan dibujos sin scripts, eventos ni recursos externos.
 * @param {string} text
 */
function isSafeSvg(text) {
  if (!/<svg[\s>]/i.test(text)) return false;
  const blocked = [
    /<script/i,
    /<foreignObject/i,
    /<(iframe|embed|object|audio|video)\b/i,
    /\son[a-z]+\s*=/i,
    /javascript:/i,
    /<!ENTITY/i,
    /(?:xlink:)?href\s*=\s*["']\s*(?!#|data:image\/)/i,
    /url\(\s*["']?\s*(?!#|data:image\/)/i,
    /@import/i,
  ];
  return !blocked.some((re) => re.test(text));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
