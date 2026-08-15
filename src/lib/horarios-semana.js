/** @typedef {{ closed: boolean, open: string, close: string }} DiaHorario */

export const DIAS_SEMANA = [
  { id: 'lun', label: 'Lunes', short: 'L' },
  { id: 'mar', label: 'Martes', short: 'M' },
  { id: 'mie', label: 'Miércoles', short: 'X' },
  { id: 'jue', label: 'Jueves', short: 'J' },
  { id: 'vie', label: 'Viernes', short: 'V' },
  { id: 'sab', label: 'Sábado', short: 'S' },
  { id: 'dom', label: 'Domingo', short: 'D' },
];

const ALIAS = {
  lun: ['lun', 'lunes', 'l', 'mon', 'monday'],
  mar: ['mar', 'martes', 'tue', 'tues', 'tuesday'],
  mie: ['mie', 'mié', 'miercoles', 'miércoles', 'wed', 'wednesday'],
  jue: ['jue', 'jueves', 'thu', 'thur', 'thurs', 'thursday'],
  vie: ['vie', 'viernes', 'fri', 'friday'],
  sab: ['sab', 'sáb', 'sabado', 'sábado', 'sat', 'saturday'],
  dom: ['dom', 'domingo', 'sun', 'sunday'],
};

function emptyDay() {
  return { closed: false, open: '12:00', close: '22:00' };
}

/**
 * @param {string} token
 */
function dayIdFromToken(token) {
  const t = String(token || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!t) return '';
  for (const [id, aliases] of Object.entries(ALIAS)) {
    if (aliases.some((a) => a.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === t)) {
      return id;
    }
  }
  return '';
}

/**
 * @param {string} left
 * @returns {string[]}
 */
function resolveDayIds(left) {
  const raw = String(left || '').trim();
  if (!raw) return DIAS_SEMANA.map((d) => d.id);
  const parts = raw.split(/\s*(?:a|al|hasta|-|–|—)\s*/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) {
    const a = dayIdFromToken(parts[0]);
    const b = dayIdFromToken(parts[1]);
    if (a && b) {
      const ids = DIAS_SEMANA.map((d) => d.id);
      const i = ids.indexOf(a);
      const j = ids.indexOf(b);
      if (i >= 0 && j >= 0) {
        if (i <= j) return ids.slice(i, j + 1);
        return [...ids.slice(i), ...ids.slice(0, j + 1)];
      }
    }
  }
  const single = dayIdFromToken(raw);
  if (single) return [single];
  const found = [];
  for (const d of DIAS_SEMANA) {
    if (dayIdFromToken(raw.split(/[,/]/)[0])) break;
    if (raw.toLowerCase().includes(d.label.toLowerCase()) || raw.toLowerCase().includes(d.id)) {
      found.push(d.id);
    }
  }
  return found.length ? found : DIAS_SEMANA.map((d) => d.id);
}

/**
 * @param {string} token
 */
function toInputTime(token) {
  const raw = String(token || '').trim().toLowerCase().replace(/\./g, '');
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return '';
  let h = Number(m[1]);
  const min = m[2] != null ? m[2] : '00';
  const ap = m[3];
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (!Number.isFinite(h) || h < 0 || h > 23) return '';
  return `${String(h).padStart(2, '0')}:${min}`;
}

/**
 * @param {string} right
 * @returns {DiaHorario}
 */
function parseHours(right) {
  const t = String(right || '').trim();
  const low = t.toLowerCase();
  if (!t || /cerrad|closed|cierre/.test(low)) {
    return { closed: true, open: '12:00', close: '22:00' };
  }
  if (/24\s*h|abierto\s*todo|all\s*day/.test(low) && !/\d/.test(low.replace('24', ''))) {
    return { closed: false, open: '00:00', close: '23:59' };
  }
  const chunks = t.split(/\s*(?:-|–|—|a|to)\s*/i).filter(Boolean);
  const open = toInputTime(chunks[0] || '') || '12:00';
  const close = toInputTime(chunks[1] || chunks[0] || '') || '22:00';
  return { closed: false, open, close };
}

/**
 * @param {string} text
 * @returns {Record<string, DiaHorario>}
 */
export function parseHorarioSemana(text) {
  /** @type {Record<string, DiaHorario>} */
  const days = Object.fromEntries(DIAS_SEMANA.map((d) => [d.id, emptyDay()]));
  const raw = String(text || '').trim();
  if (!raw) return days;

  const lines = raw.split(/\n|;/).map((s) => s.trim()).filter(Boolean);
  for (const line of lines) {
    const idx = line.indexOf(':');
    const left = idx === -1 ? '' : line.slice(0, idx);
    const right = idx === -1 ? line : line.slice(idx + 1);
    const ids = resolveDayIds(left);
    const parsed = parseHours(right);
    for (const id of ids) {
      if (days[id]) days[id] = { ...parsed };
    }
  }
  return days;
}

/**
 * @param {Record<string, DiaHorario>} days
 */
export function serializeHorarioSemana(days) {
  return DIAS_SEMANA.map((d) => {
    const row = days?.[d.id] || emptyDay();
    if (row.closed) return `${d.label}: Cerrado`;
    return `${d.label}: ${row.open} – ${row.close}`;
  }).join('\n');
}

/**
 * @param {Record<string, DiaHorario>} days
 * @param {Date} [now]
 */
export function previewHorarioHoy(days, now = new Date()) {
  const map = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
  const id = map[now.getDay()] || 'lun';
  const meta = DIAS_SEMANA.find((d) => d.id === id);
  const row = days?.[id] || emptyDay();
  if (row.closed) {
    return { id, label: meta?.label || 'Hoy', open: false, text: 'Cerrado hoy' };
  }
  const cur = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = String(row.open || '00:00').split(':').map(Number);
  const [ch, cm] = String(row.close || '00:00').split(':').map(Number);
  const start = oh * 60 + om;
  let end = ch * 60 + cm;
  let isOpen = false;
  if (end <= start) {
    isOpen = cur >= start || cur < end;
  } else {
    isOpen = cur >= start && cur < end;
  }
  return {
    id,
    label: meta?.label || 'Hoy',
    open: isOpen,
    text: isOpen
      ? `Abierto ahora · ${row.open} – ${row.close}`
      : `Cerrado · hoy ${row.open} – ${row.close}`,
  };
}
