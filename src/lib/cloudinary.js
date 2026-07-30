import { loadEnv } from 'vite';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Resuelve CLOUDINARY_URL desde todas las fuentes posibles.
 * @returns {string}
 */
export function resolveCloudinaryUrl() {
  const candidates = [
    import.meta.env.CLOUDINARY_URL,
    process.env.CLOUDINARY_URL,
  ];

  for (const value of candidates) {
    const url = String(value ?? '').trim();
    if (url) return stripQuotes(url);
  }

  // Fallback: leer .env del cwd (Astro/Vite a veces no inyecta vars privadas en process.env)
  try {
    const mode = process.env.NODE_ENV || 'development';
    const loaded = loadEnv(mode, process.cwd(), '');
    const fromFile = String(loaded.CLOUDINARY_URL ?? '').trim();
    if (fromFile) return stripQuotes(fromFile);
  } catch (err) {
    console.error('[cloudinary] loadEnv fallback failed:', err);
  }

  return '';
}

/**
 * @param {string} value
 */
function stripQuotes(value) {
  return value.replace(/^["']|["']$/g, '');
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
 * Inicializa el SDK de forma explícita con el string de conexión.
 * @param {string} [connectionUrl]
 * @returns {typeof cloudinary | null}
 */
export function initCloudinary(connectionUrl) {
  const url = stripQuotes(String(connectionUrl ?? resolveCloudinaryUrl()).trim());
  if (!url) return null;

  const parsed = parseCloudinaryUrl(url);
  if (!parsed) {
    console.error('[cloudinary] CLOUDINARY_URL con formato inválido');
    return null;
  }

  // Disponible para el SDK si algún método lee process.env
  process.env.CLOUDINARY_URL = url;

  cloudinary.config({
    cloud_name: parsed.cloud_name,
    api_key: parsed.api_key,
    api_secret: parsed.api_secret,
    secure: true,
  });

  return cloudinary;
}

/**
 * URL pública optimizada (f_auto,q_auto) para imágenes/GIF.
 * @param {{ secure_url?: string, resource_type?: string }} result
 */
export function optimizedPublicUrl(result) {
  const secure = result?.secure_url || '';
  if (!secure) return '';
  if (result.resource_type === 'video') return secure;
  if (secure.includes('/upload/')) {
    return secure.replace('/upload/', '/upload/f_auto,q_auto/');
  }
  return secure;
}

/**
 * Cloud name desde CLOUDINARY_URL (o fallback del proyecto).
 * @returns {string}
 */
export function getCloudinaryCloudName() {
  const parsed = parseCloudinaryUrl(resolveCloudinaryUrl());
  return parsed?.cloud_name || 'dgphys1xd';
}

/**
 * Normaliza URLs de media (logo, OG, etc.).
 * - Vacío → `null`
 * - `http(s)://…` → se deja igual
 * - `//…` o dominio Cloudinary sin protocolo → antepone `https:`
 * - Rutas parciales (`ge/upload/…`, `upload/…`, public_id) → base Cloudinary
 *
 * @param {unknown} pathOrUrl
 * @returns {string | null}
 */
export function resolveMediaUrl(pathOrUrl) {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw || raw === 'null' || raw === 'undefined') return null;

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;

  // Dominio Cloudinary / CDN sin protocolo
  if (
    /^(res\.cloudinary\.com\/|[\w.-]+\.cloudinary\.com\/)/i.test(raw) ||
    /^[\w.-]+\.(cloudfront\.net|amazonaws\.com)\//i.test(raw)
  ) {
    return `https://${raw}`;
  }

  const cloud = getCloudinaryCloudName();
  const base = `https://res.cloudinary.com/${cloud}/image/upload/`;
  let path = raw.replace(/^\//, '');

  if (/^image\/upload\//i.test(path)) {
    return `https://res.cloudinary.com/${cloud}/${path}`;
  }
  if (/^upload\//i.test(path)) {
    return `https://res.cloudinary.com/${cloud}/image/${path}`;
  }

  // Prefijo truncado tipo "ge/upload/..." → tomar desde "upload/"
  const uploadIdx = path.toLowerCase().indexOf('upload/');
  if (uploadIdx >= 0) {
    path = path.slice(uploadIdx + 'upload/'.length);
  }

  if (!path) return null;
  return `${base}${path}`;
}
