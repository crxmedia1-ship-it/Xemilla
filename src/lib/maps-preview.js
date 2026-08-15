/**
 * Preview / embed de Google Maps a partir de coordenadas_maps.
 */

function isGenericMapsHome(url) {
  const u = String(url || '').trim();
  return !u || /^https?:\/\/(www\.)?maps\.google\.com\/?$/i.test(u);
}

/**
 * @param {string} url
 * @returns {{ lat: number, lng: number } | null}
 */
export function parseMapsLatLng(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /destination=(-?\d+(?:\.\d+)?)%2C(-?\d+(?:\.\d+)?)/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * @param {string} url
 */
export function extractMapsQuery(url) {
  const raw = String(url || '').trim();
  if (!raw || isGenericMapsHome(raw)) return '';
  try {
    const u = new URL(raw);
    const q = u.searchParams.get('query') || u.searchParams.get('q') || '';
    if (q && !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(q)) return q;
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * Enlace para abrir Google Maps.
 * @param {string} mapsUrl
 * @param {string} [fallbackQuery]
 */
export function mapsOpenHref(mapsUrl, fallbackQuery = '') {
  const url = String(mapsUrl || '').trim();
  if (url && !isGenericMapsHome(url)) return url;
  const q = String(fallbackQuery || '').trim();
  if (q) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  return '';
}

/**
 * Iframe de Google Maps (vista del mapa).
 * @param {string} mapsUrl
 * @param {string} [fallbackQuery]
 */
export function googleMapsEmbedSrc(mapsUrl, fallbackQuery = '') {
  const url = String(mapsUrl || '').trim();
  const coords = parseMapsLatLng(url);
  if (coords) {
    return `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=16&output=embed`;
  }
  const q = extractMapsQuery(url) || String(fallbackQuery || '').trim();
  if (q) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;
  }
  if (url && !isGenericMapsHome(url)) {
    try {
      const u = new URL(url);
      if (/google\./i.test(u.hostname) || /goo\.gl/i.test(u.hostname)) {
        u.searchParams.set('output', 'embed');
        return u.toString();
      }
    } catch {
      /* ignore */
    }
    return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&z=15&output=embed`;
  }
  return '';
}

/**
 * Miniatura estática (OSM) si hay coordenadas; si no, vacía.
 * @param {string} mapsUrl
 */
export function mapsStaticImageSrc(mapsUrl) {
  const coords = parseMapsLatLng(mapsUrl);
  if (!coords) return '';
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${coords.lat},${coords.lng}&zoom=16&size=800x420&maptype=mapnik&markers=${coords.lat},${coords.lng},red-pushpin`;
}
