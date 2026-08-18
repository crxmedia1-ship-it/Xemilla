/**
 * Datos compartidos para plantillas Ubicación (modal / split / minimal).
 */

/**
 * @param {string | Array<{ dia: string, horas: string }>} horarios
 * @param {Array<{ dia: string, horas: string }> | undefined} horariosRows
 */
export function resolveHorarioFilas(horarios, horariosRows) {
  if (Array.isArray(horariosRows) && horariosRows.length > 0) return horariosRows;
  if (Array.isArray(horarios) && horarios.length > 0) return horarios;
  if (typeof horarios === 'string' && horarios.trim()) {
    return horarios
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(':');
        if (idx === -1) return { dia: '', horas: line };
        return { dia: line.slice(0, idx).trim(), horas: line.slice(idx + 1).trim() };
      });
  }
  return [];
}

/**
 * @param {string} red
 */
export function redLabel(red) {
  const key = String(red || '').toLowerCase();
  if (key === 'whatsapp') return 'WhatsApp';
  if (key === 'instagram') return 'Instagram';
  if (key === 'facebook') return 'Facebook';
  if (key === 'tiktok') return 'TikTok';
  if (key === 'tripadvisor') return 'TripAdvisor';
  if (key === 'maps') return 'Maps';
  return red;
}

/**
 * @param {string} instagram
 * @param {Array<{ red?: string, url?: string, activo?: boolean }>} redes
 * @param {string} [legacyWhatsapp]
 */
export function resolveRedesActivas(instagram, redes = [], legacyWhatsapp = '') {
  /** @type {Array<{ red: string, url: string, activo?: boolean }>} */
  let list = [];

  if (Array.isArray(redes) && redes.length > 0) {
    list = redes.filter((r) => r?.red && r?.url && r?.activo !== false);
  } else {
    const ig = String(instagram || '').trim();
    if (ig) {
      list.push({
        red: 'instagram',
        url: /^https?:\/\//i.test(ig)
          ? ig
          : `https://instagram.com/${ig.replace(/^@/, '')}`,
      });
    }
  }

  const wa = String(legacyWhatsapp || '').trim();
  if (wa && !list.some((r) => r.red === 'whatsapp')) {
    list.unshift({ red: 'whatsapp', url: wa });
  }

  return list.map((r) => ({
    ...r,
    url: resolveRedHref(r.red, r.url),
  }));
}

/**
 * @param {string} red
 * @param {string} url
 */
export function resolveRedHref(red, url) {
  const key = String(red || '').toLowerCase();
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (key === 'whatsapp') return resolveWaHref(raw);
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, '');
  if (key === 'instagram') return `https://instagram.com/${handle}`;
  if (key === 'facebook') return `https://facebook.com/${handle}`;
  if (key === 'tiktok') return `https://www.tiktok.com/@${handle}`;
  if (key === 'tripadvisor') return `https://www.tripadvisor.com/${handle}`;
  return raw;
}

/**
 * @param {string} whatsapp
 * @param {string} telefono
 */
export function resolveWaHref(whatsapp, telefono = '') {
  const waRaw = String(whatsapp || telefono).trim();
  const waDigits = waRaw.replace(/\D/g, '');
  if (/^https?:\/\//i.test(waRaw)) return waRaw;
  return waDigits ? `https://wa.me/${waDigits}` : '';
}

/**
 * @param {string} mapaUrl
 * @param {string} direccion
 * @param {string} ciudad
 */
export function resolveMapsHref(mapaUrl, direccion, ciudad = '') {
  const mapsQuery = [direccion, ciudad].filter(Boolean).join(', ');
  const url = String(mapaUrl || '').trim();
  if (url && !/maps\.google\.com\/?$/i.test(url)) return url;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    mapsQuery || 'restaurante',
  )}`;
}

/**
 * @param {string} instagram
 */
export function resolveInstagramHref(instagram) {
  const ig = String(instagram || '').trim();
  if (!ig) return '';
  return /^https?:\/\//i.test(ig) ? ig : `https://instagram.com/${ig.replace(/^@/, '')}`;
}

/**
 * @param {string} mapsHref
 * @param {Array<{ red: string, url: string }>} redesActivas
 */
export function buildContactActions(mapsHref, redesActivas = []) {
  /** @type {Array<{ id: string, label: string, href: string, icon: string }>} */
  const actions = [];
  const maps = String(mapsHref || '').trim();
  if (maps) {
    actions.push({ id: 'maps', label: redLabel('maps'), href: maps, icon: 'maps' });
  }
  for (const r of redesActivas) {
    const href = resolveRedHref(r.red, r.url);
    if (!href) continue;
    actions.push({
      id: r.red,
      label: redLabel(r.red),
      href,
      icon: r.red,
    });
  }
  return actions;
}
