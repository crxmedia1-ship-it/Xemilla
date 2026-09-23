import { squareAppIconUrl } from './cloudinary.js';

const FALLBACK_ICON =
  'https://res.cloudinary.com/dgphys1xd/image/upload/v1786337633/IMG_3774_zsxajg.png';

/**
 * Nombre corto para el ícono de inicio (iOS recorta cerca de 12 caracteres).
 * @param {unknown} name
 */
export function pwaShortName(name) {
  const label = String(name || 'Menú').replace(/\s+/g, ' ').trim() || 'Menú';
  if (label.length <= 12) return label;
  return label.slice(0, 12).trim();
}

/**
 * Manifiesto e íconos cuadrados de la webapp de un restaurante.
 * @param {{ slug?: string, nombre?: string, tagline?: string, theme?: { colorFondo?: string }, appIconUrl?: string, logoUrl?: string }} restaurante
 */
export function buildRestaurantPwa(restaurante) {
  const slug = String(restaurante?.slug || '').trim();
  const name = String(restaurante?.nombre || 'Menú').replace(/\s+/g, ' ').trim() || 'Menú';
  const shortName = pwaShortName(name);
  const background = String(restaurante?.theme?.colorFondo || '#09090b').trim() || '#09090b';
  const source = String(restaurante?.appIconUrl || restaurante?.logoUrl || FALLBACK_ICON).trim();
  const appleIcon = squareAppIconUrl(source, { size: 180, background, padding: 0.08 });
  const icon192 = squareAppIconUrl(source, { size: 192, background, padding: 0.08 });
  const icon512 = squareAppIconUrl(source, { size: 512, background, padding: 0.08 });
  const iconMaskable = squareAppIconUrl(source, { size: 512, background, padding: 0.22 });
  const description =
    String(restaurante?.tagline || '').trim() || `${name} · menú y experiencia`;

  return {
    slug,
    name,
    shortName,
    themeColor: background,
    appleIcon,
    manifest: {
      id: `/${slug}`,
      name,
      short_name: shortName,
      description,
      start_url: `/${slug}`,
      scope: `/${slug}`,
      display: 'standalone',
      background_color: background,
      theme_color: background,
      lang: 'es',
      icons: [
        { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: iconMaskable, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  };
}
