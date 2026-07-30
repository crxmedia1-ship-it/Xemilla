/**
 * Cliente compartido: estado ABIERTO/CERRADO + highlight del día.
 * Compatible con [data-ubicacion-panel][data-horarios].
 */

/** @type {Record<string, number>} */
const DAY_INDEX = {
  dom: 0,
  domingo: 0,
  lun: 1,
  lunes: 1,
  mar: 2,
  martes: 2,
  mie: 3,
  mié: 3,
  miercoles: 3,
  miércoles: 3,
  jue: 4,
  jueves: 4,
  vie: 5,
  viernes: 5,
  sab: 6,
  sáb: 6,
  sabado: 6,
  sábado: 6,
};

/**
 * @param {string} token
 */
function dayTokenToIndex(token) {
  const key = token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  return DAY_INDEX[key] ?? null;
}

/**
 * @param {string} diaLabel
 * @returns {number[]}
 */
function expandDays(diaLabel) {
  const parts = String(diaLabel)
    .split(/—|–|-|a|al/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return [];
  if (parts.length === 1) {
    const d = dayTokenToIndex(parts[0]);
    return d == null ? [] : [d];
  }

  const start = dayTokenToIndex(parts[0]);
  const end = dayTokenToIndex(parts[parts.length - 1]);
  if (start == null || end == null) return [];

  const days = [];
  let cur = start;
  for (let i = 0; i < 7; i += 1) {
    days.push(cur);
    if (cur === end) break;
    cur = (cur + 1) % 7;
  }
  return days;
}

/**
 * @param {string} raw
 * @returns {number | null}
 */
function parseTimeToMinutes(raw) {
  const m = String(raw)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 24 || min > 59) return null;
  if (h === 24 && min === 0) return 24 * 60;
  return h * 60 + min;
}

/**
 * @param {string} horasLabel
 * @returns {{ open: number, close: number } | null}
 */
function parseHoursRange(horasLabel) {
  const parts = String(horasLabel)
    .split(/—|–|-/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const open = parseTimeToMinutes(parts[0]);
  let close = parseTimeToMinutes(parts[1]);
  if (open == null || close == null) return null;
  if (close === 0) close = 24 * 60;
  return { open, close };
}

/**
 * @param {Array<{ dia: string, horas: string }>} horarios
 * @param {Date} now
 */
function isOpenNow(horarios, now) {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  for (const row of horarios) {
    const days = expandDays(row.dia);
    const range = parseHoursRange(row.horas);
    if (!range || days.length === 0) continue;

    const { open, close } = range;
    const crossesMidnight = close <= open;

    if (!crossesMidnight) {
      if (days.includes(day) && minutes >= open && minutes < close) {
        return true;
      }
    } else {
      if (days.includes(day) && minutes >= open) return true;
      const prevDay = (day + 6) % 7;
      if (days.includes(prevDay) && minutes < close) return true;
    }
  }

  return false;
}

/**
 * @param {HTMLElement} panel
 * @param {Date} now
 */
function highlightTodayRows(panel, now) {
  const day = now.getDay();
  panel.querySelectorAll('[data-horario-row]').forEach((row) => {
    if (!(row instanceof HTMLElement)) return;
    const days = expandDays(row.dataset.dia || '');
    row.classList.toggle('is-today', days.includes(day));
  });
}

/**
 * @param {HTMLElement} panel
 */
export function refreshUbicacionLiveStatus(panel) {
  let horarios = [];
  try {
    horarios = JSON.parse(panel.dataset.horarios || '[]');
  } catch {
    horarios = [];
  }

  const now = new Date();
  const labelEl = panel.querySelector('[data-live-label]');
  const badgeEl = panel.querySelector('[data-live-badge]');
  const dotEl = panel.querySelector('[data-live-dot]');

  highlightTodayRows(panel, now);

  if (!Array.isArray(horarios) || horarios.length === 0) {
    if (labelEl) labelEl.textContent = 'Horario no disponible';
    if (badgeEl instanceof HTMLElement) {
      badgeEl.dataset.open = 'unknown';
      badgeEl.classList.remove('is-open', 'is-closed');
    }
    if (dotEl instanceof HTMLElement) {
      dotEl.classList.remove('is-open');
      dotEl.classList.add('is-closed');
    }
    return;
  }

  const open = isOpenNow(horarios, now);
  if (labelEl) labelEl.textContent = open ? 'ABIERTO' : 'CERRADO';
  if (badgeEl instanceof HTMLElement) {
    badgeEl.dataset.open = open ? 'true' : 'false';
    badgeEl.classList.toggle('is-open', open);
    badgeEl.classList.toggle('is-closed', !open);
  }
  if (dotEl instanceof HTMLElement) {
    dotEl.classList.toggle('is-open', open);
    dotEl.classList.toggle('is-closed', !open);
  }
}

export function initUbicacionLivePanels(selector = '[data-ubicacion-panel]') {
  document.querySelectorAll(selector).forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    if (panel.dataset.liveReady === 'true') return;
    panel.dataset.liveReady = 'true';
    refreshUbicacionLiveStatus(panel);
    window.setInterval(() => refreshUbicacionLiveStatus(panel), 60_000);
  });
}
