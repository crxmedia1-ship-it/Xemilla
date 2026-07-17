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
