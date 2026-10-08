export const SUCURSAL_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SUCURSAL_SLUGS_RESERVADOS = new Set(['menu', 'admin', 'api']);

/** Hora local a la que vuelven los platos marcados "agotado hoy". */
export const HORA_REINICIO_AGOTADO = 5;

/**
 * "Altamira Centro" → "altamira-centro".
 * @param {unknown} value
 */
export function slugifySucursal(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

/** @param {string} timeZone */
function offsetMinutes(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * Próximo reinicio del día operativo (05:00 local) en la zona de la sede.
 * Antes de las 05:00 cuenta como el mismo día (cierre de madrugada).
 * @param {Date} now
 * @param {string} [timeZone]
 */
export function finDelDiaOperativo(now = new Date(), timeZone = 'America/Caracas') {
  let tz = timeZone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    tz = 'America/Caracas';
  }
  const offset = offsetMinutes(now, tz);
  const local = new Date(now.getTime() + offset * 60000);
  const target = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + (local.getUTCHours() >= HORA_REINICIO_AGOTADO ? 1 : 0),
    HORA_REINICIO_AGOTADO,
  );
  return new Date(target - offset * 60000);
}

/**
 * ¿La fila de plato_sucursal deja el plato agotado en este momento?
 * @param {{ agotado?: boolean, agotado_hasta?: string | null } | null | undefined} row
 * @param {Date} [now]
 */
export function isAgotadoVigente(row, now = new Date()) {
  if (!row?.agotado) return false;
  if (!row.agotado_hasta) return true;
  return new Date(row.agotado_hasta).getTime() > now.getTime();
}
