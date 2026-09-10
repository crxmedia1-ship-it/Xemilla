import { v2 as cloudinary } from 'cloudinary';

/**
 * @param {string} value
 */
function stripQuotes(value) {
  return value.replace(/^["']|["']$/g, '');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function envString(value) {
  return stripQuotes(String(value ?? '').trim());
}

/**
 * Lee una variable de entorno (Vite + Node).
 * @param {string} name
 * @returns {string}
 */
function readEnv(name) {
  const fromMeta =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env[name]
      : undefined;
  return envString(fromMeta) || envString(process.env[name]);
}

/**
 * Credenciales Root estrictas desde env (sin CLOUDINARY_URL).
 * @returns {{ cloud_name: string, api_key: string, api_secret: string } | null}
 */
export function resolveCloudinaryCredentials() {
  const api_key = readEnv('CLOUDINARY_API_KEY');
  const api_secret = readEnv('CLOUDINARY_API_SECRET');
  const cloud_name =
    readEnv('PUBLIC_CLOUDINARY_CLOUD_NAME') || readEnv('CLOUDINARY_CLOUD_NAME');

  if (api_key && api_secret && cloud_name) {
    return { cloud_name, api_key, api_secret };
  }

  return null;
}

/**
 * Construye connection string solo desde las 3 variables Root.
 * @returns {string}
 */
export function resolveCloudinaryUrl() {
  const creds = resolveCloudinaryCredentials();
  if (!creds) return '';
  return `cloudinary://${creds.api_key}:${creds.api_secret}@${creds.cloud_name}`;
}

/**
 * Parsea cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 * @param {string} connectionUrl
 * @returns {{ cloud_name: string, api_key: string, api_secret: string } | null}
 */
export function parseCloudinaryUrl(connectionUrl) {
  const raw = stripQuotes(String(connectionUrl ?? '').trim());
  if (!raw) return null;

  const match = raw.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/i);
  if (!match) return null;

  return {
    api_key: match[1],
    api_secret: match[2],
    cloud_name: match[3],
  };
}

/**
 * Inicializa el SDK estrictamente con CLOUDINARY_API_KEY / SECRET / PUBLIC_CLOUDINARY_CLOUD_NAME.
 * @param {string} [connectionUrl] Ignorado salvo para tests; preferimos env Root.
 * @returns {typeof cloudinary | null}
 */
export function initCloudinary(connectionUrl) {
  const parsed =
    resolveCloudinaryCredentials() ||
    (connectionUrl ? parseCloudinaryUrl(connectionUrl) : null);

  if (!parsed) {
    console.error(
      '[cloudinary] Faltan CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET / PUBLIC_CLOUDINARY_CLOUD_NAME',
    );
    return null;
  }

  delete process.env.CLOUDINARY_URL;

  cloudinary.config({
    cloud_name: parsed.cloud_name,
    api_key: parsed.api_key,
    api_secret: parsed.api_secret,
    secure: true,
  });

  return cloudinary;
}

/** Carpetas de Asset Management: identity | categories | dishes */
export const CLOUDINARY_ASSET_TYPES = new Set(['identity', 'categories', 'dishes']);

/**
 * Transformaciones de entrega (0 créditos extra: f_auto / q_auto).
 * @type {Record<'logo' | 'cover' | 'dish', string>}
 */
export const CLOUDINARY_MEDIA_TRANSFORMS = {
  logo: 'c_fit,w_400,h_200,f_auto,q_auto',
  cover: 'c_fill,g_auto,w_1200,f_auto,q_auto:eco',
  dish: 'c_fill,g_auto,w_800,h_600,f_auto,q_auto:eco',
};

const DEFAULT_MEDIA_TRANSFORM = 'f_auto,q_auto';

/**
 * @param {unknown} value
 * @param {string} [fallback]
 */
export function sanitizeMediaFolderSegment(value, fallback = 'general') {
  const cleaned = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
}

/**
 * @param {unknown} value
 * @param {'identity' | 'categories' | 'dishes'} [fallback]
 * @returns {'identity' | 'categories' | 'dishes'}
 */
export function normalizeCloudinaryAssetType(value, fallback = 'identity') {
  const key = String(value ?? '').trim().toLowerCase();
  if (CLOUDINARY_ASSET_TYPES.has(key)) return /** @type {'identity' | 'categories' | 'dishes'} */ (key);
  if (key === 'logo' || key === 'cover' || key === 'portada' || key === 'popup') {
    return 'identity';
  }
  if (key === 'category' || key === 'fondo' || key === 'menu') return 'categories';
  if (key === 'dish' || key === 'plato' || key === 'platos') return 'dishes';
  return fallback;
}

/**
 * `xemilla/restaurants/${slug}/${asset_type}`
 * @param {unknown} slug
 * @param {unknown} assetType
 */
export function buildRestaurantMediaFolder(slug, assetType) {
  return `xemilla/restaurants/${sanitizeMediaFolderSegment(slug, 'general')}/${normalizeCloudinaryAssetType(assetType)}`;
}

/**
 * URL pública optimizada (f_auto,q_auto) para imágenes/GIF.
 * @param {{ secure_url?: string, resource_type?: string }} result
 */
export function optimizedPublicUrl(result) {
  const secure = result?.secure_url || '';
  if (!secure) return '';
  if (result.resource_type === 'video') return secure;
  return applyCloudinaryDeliveryTransform(secure) || secure;
}

/**
 * Cloud name desde PUBLIC_CLOUDINARY_CLOUD_NAME.
 * @returns {string}
 */
export function getCloudinaryCloudName() {
  return (
    resolveCloudinaryCredentials()?.cloud_name ||
    readEnv('PUBLIC_CLOUDINARY_CLOUD_NAME') ||
    'wdmzaemi'
  );
}

/**
 * @param {unknown} url
 */
function isCloudinaryDeliveryUrl(url) {
  return /(?:^https?:\/\/)?(?:res\.cloudinary\.com|[\w.-]+\.cloudinary\.com)\//i.test(
    String(url || ''),
  );
}

/**
 * Inserta transformaciones de entrega después de `/upload/` (sin tocar videos ni URLs ajenas).
 * @param {string} url
 * @param {string} [type]
 * @returns {string}
 */
export function applyCloudinaryDeliveryTransform(url, type) {
  const raw = String(url || '').trim();
  if (!raw || !isCloudinaryDeliveryUrl(raw) || /\/video\/upload\//i.test(raw)) {
    return raw;
  }

  const marker = '/upload/';
  const at = raw.indexOf(marker);
  if (at === -1) return raw;

  const key = String(type || '').trim().toLowerCase();
  const tx =
    key && key in CLOUDINARY_MEDIA_TRANSFORMS
      ? CLOUDINARY_MEDIA_TRANSFORMS[/** @type {'logo' | 'cover' | 'dish'} */ (key)]
      : DEFAULT_MEDIA_TRANSFORM;

  let rest = raw.slice(at + marker.length);
  if (rest === tx || rest.startsWith(`${tx}/`)) {
    return raw;
  }

  const known = [...Object.values(CLOUDINARY_MEDIA_TRANSFORMS), DEFAULT_MEDIA_TRANSFORM];
  for (const prefix of known) {
    if (rest.startsWith(`${prefix}/`)) {
      rest = rest.slice(prefix.length + 1);
      break;
    }
  }
  rest = rest.replace(/^f_auto,q_auto(?::\w+)?\//, '');

  return `${raw.slice(0, at + marker.length)}${tx}/${rest}`;
}

/**
 * Normaliza URLs de media (logo, OG, etc.) e inyecta transformaciones Cloudinary.
 * - Vacío → `null`
 * - URLs externas / locales (no Cloudinary) → intactas
 * - `type`: `logo` | `cover` | `dish` | omitido (`f_auto,q_auto`)
 *
 * @param {unknown} pathOrUrl
 * @param {string} [type]
 * @returns {string | null}
 */
export function resolveMediaUrl(pathOrUrl, type) {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw || raw === 'null' || raw === 'undefined') return null;

  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (/^\.\.?\//.test(raw)) return raw;

  /** @type {string} */
  let absolute = raw;
  if (raw.startsWith('//')) {
    absolute = `https:${raw}`;
  } else if (
    /^(res\.cloudinary\.com\/|[\w.-]+\.cloudinary\.com\/)/i.test(raw) ||
    /^[\w.-]+\.(cloudfront\.net|amazonaws\.com)\//i.test(raw)
  ) {
    absolute = `https://${raw}`;
  }

  if (/^https?:\/\//i.test(absolute)) {
    if (!isCloudinaryDeliveryUrl(absolute)) return absolute;
    return applyCloudinaryDeliveryTransform(absolute, type);
  }

  // Ruta local del sitio, no public_id de Cloudinary
  if (raw.startsWith('/') && !/\/upload\//i.test(raw) && !/cloudinary\.com/i.test(raw)) {
    return raw;
  }

  const cloud = getCloudinaryCloudName();
  let path = raw.replace(/^\//, '');
  /** @type {string} */
  let resolved;

  if (/^(image|video|raw)\/upload\//i.test(path)) {
    resolved = `https://res.cloudinary.com/${cloud}/${path}`;
  } else if (/^upload\//i.test(path)) {
    resolved = `https://res.cloudinary.com/${cloud}/image/${path}`;
  } else {
    const uploadIdx = path.toLowerCase().indexOf('upload/');
    if (uploadIdx >= 0) {
      path = path.slice(uploadIdx + 'upload/'.length);
    }
    if (!path) return null;
    resolved = `https://res.cloudinary.com/${cloud}/image/upload/${path}`;
  }

  return applyCloudinaryDeliveryTransform(resolved, type);
}
