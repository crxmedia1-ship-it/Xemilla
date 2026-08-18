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
  if (key === 'telefono') return 'Llamar';
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
  if (key === 'telefono') return resolveTelHref(raw);
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
 * @param {string} telefono
 */
export function resolveTelHref(telefono) {
  const raw = String(telefono || '').trim();
  if (!raw) return '';
  if (/^tel:/i.test(raw)) return raw;
  const digits = raw.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
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
 * @param {string} hex
 * @returns {string}
 */
export function contrastOnHex(hex) {
  const raw = String(hex || '').replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return '#ffffff';
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.58 ? '#111111' : '#ffffff';
}

/**
 * @param {unknown} value
 * @returns {'solido' | 'vidrio' | 'blur'}
 */
export function normalizeUbicacionGridEstilo(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (v === 'solido' || v === 'solid' || v === 'opaco') return 'solido';
  if (v === 'blur' || v === 'niebla' || v === 'frost') return 'blur';
  return 'vidrio';
}

/**
 * @param {'solido' | 'vidrio' | 'blur'} estilo
 * @param {string} [color]
 */
export function ubicacionCardStyle(estilo, color = '') {
  const bg = String(color || '').trim();
  if (estilo === 'solido') {
    return bg
      ? `background:${bg}; border:1px solid color-mix(in srgb, ${bg} 72%, transparent); backdrop-filter:none; -webkit-backdrop-filter:none;`
      : 'background:rgba(10,10,10,.92); border:1px solid rgba(255,255,255,.1); backdrop-filter:none; -webkit-backdrop-filter:none;';
  }
  if (estilo === 'blur') {
    return bg
      ? `background:color-mix(in srgb, ${bg} 36%, transparent); border:1px solid color-mix(in srgb, ${bg} 22%, transparent); backdrop-filter:blur(28px); -webkit-backdrop-filter:blur(28px);`
      : 'background:rgba(0,0,0,.22); border:1px solid rgba(255,255,255,.1); backdrop-filter:blur(28px); -webkit-backdrop-filter:blur(28px);';
  }
  return bg
    ? `background:color-mix(in srgb, ${bg} 78%, transparent); border:1px solid color-mix(in srgb, ${bg} 40%, transparent); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);`
    : 'background:rgba(0,0,0,.4); border:1px solid rgba(255,255,255,.1); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);';
}

/**
 * Colores de Ubicación. El acento NO hereda del Home.
 * @param {Record<string, unknown>} ubicacion
 * @param {Record<string, unknown>} home
 * @param {{ fondoColor?: string, primario?: string }} [extras]
 */
export function resolveUbicacionSectionColors(ubicacion = {}, home = {}, extras = {}) {
  const fondo = String(ubicacion.color_fondo || extras.fondoColor || '').trim();
  const titulo = String(
    ubicacion.color_titulo || home.titulo_color || home.tituloColor || '',
  ).trim();
  const cuerpo = String(
    ubicacion.color_cuerpo || home.eslogan_color || home.esloganColor || '',
  ).trim();
  const acento = String(
    ubicacion.color_acento || ubicacion.color_boton || extras.primario || '',
  ).trim();
  const grid = normalizeUbicacionGridEstilo(ubicacion.grid_estilo);

  return {
    color_fondo: fondo,
    color_titulo: titulo,
    color_cuerpo: cuerpo,
    color_boton: acento,
    color_acento: acento,
    color_boton_texto: contrastOnHex(acento),
    grid_estilo: grid,
  };
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
    actions.push({ id: 'maps', label: redLabel('maps'), href: maps, icon: 'maps', external: true });
  }
  for (const r of redesActivas) {
    const href = resolveRedHref(r.red, r.url);
    if (!href) continue;
    actions.push({
      id: r.red,
      label: redLabel(r.red),
      href,
      icon: r.red,
      external: !/^(tel:|mailto:)/i.test(href),
    });
  }
  return actions;
}
