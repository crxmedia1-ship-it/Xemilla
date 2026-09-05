/**
 * Agregación de métricas operativas (alertas_mesas + plato_vistas).
 */

/**
 * @typedef {{
 *   mesa: string,
 *   tipo: string,
 *   atendida: boolean,
 *   created_at: string,
 *   atendida_at?: string | null,
 *   restaurante_id?: string,
 * }} AlertaRow
 */

/**
 * @typedef {{
 *   tiempoPromedioMinutos: number | null,
 *   tiempoPromedioLabel: string,
 *   mesasActivas: Array<{ mesa: string, total: number, pct: number }>,
 *   volumen: {
 *     hoy: { total: number, mesero: number, cuenta: number },
 *     semana: { total: number, mesero: number, cuenta: number },
 *   },
 *   platosMasVistos: Array<{ plato_id?: string, nombre: string, vistas: number, pct: number }>,
 *   platosMenosVistos: Array<{ plato_id?: string, nombre: string, vistas: number, pct: number }>,
 *   totalVistas: number,
 *   eventMode: boolean,
 *   vistasSeries: {
 *     all: { total: number, platos: Record<string, number> },
 *     months: Record<string, { total: number, platos: Record<string, number> }>,
 *   },
 *   pendientes: number,
 *   totalAlertas: number,
 * }} MetricsSnapshot
 */

/**
 * @param {string | Date | number} [value]
 */
function monthKeyFrom(value) {
  const d = value instanceof Date ? value : new Date(value || Date.now());
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * @param {Array<Record<string, unknown>>} vistasRows
 * @param {boolean} eventMode
 * @param {(row: Record<string, unknown>) => boolean} [filterFn]
 */
function aggregatePlatoVistas(vistasRows, eventMode, filterFn) {
  /** @type {Map<string, { plato_id: string, nombre: string, vistas: number }>} */
  const map = new Map();
  for (const raw of vistasRows) {
    if (filterFn && !filterFn(raw)) continue;
    const id = raw?.plato_id != null ? String(raw.plato_id) : '';
    const nombre = String(raw?.plato_nombre || raw?.nombre || 'Plato').trim() || 'Plato';
    const add = eventMode ? 1 : Number(raw?.vistas) || 0;
    if (add <= 0) continue;
    const key = id || nombre.toLowerCase();
    const cur = map.get(key) || { plato_id: id, nombre, vistas: 0 };
    cur.vistas += add;
    if (nombre && nombre !== 'Plato') cur.nombre = nombre;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.vistas - a.vistas);
}

/**
 * @param {Array<{ plato_id: string, vistas: number }>} ranked
 */
function seriesBucket(ranked) {
  /** @type {Record<string, number>} */
  const platos = {};
  let total = 0;
  for (const row of ranked) {
    total += row.vistas;
    if (row.plato_id) platos[row.plato_id] = row.vistas;
  }
  return { total, platos };
}

/**
 * @param {AlertaRow[]} rows
 * @param {Array<{ nombre?: string, plato_nombre?: string, vistas?: number, created_at?: string, plato_id?: string|number }>|null} [vistasRows]
 * @param {{ eventMode?: boolean }} [opts]
 * @returns {MetricsSnapshot}
 */
export function computeMetricsSnapshot(rows, vistasRows = null, opts = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const dayAgo = now - dayMs;
  const weekAgo = now - 7 * dayMs;

  /** @type {number[]} */
  const responseMins = [];
  for (const row of list) {
    if (!row?.atendida || !row.atendida_at || !row.created_at) continue;
    const start = Date.parse(row.created_at);
    const end = Date.parse(row.atendida_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    responseMins.push((end - start) / 60000);
  }

  const avg =
    responseMins.length > 0
      ? responseMins.reduce((a, b) => a + b, 0) / responseMins.length
      : null;

  /** @type {Map<string, number>} */
  const mesaCounts = new Map();
  for (const row of list) {
    const mesa = String(row?.mesa || '').trim() || '—';
    mesaCounts.set(mesa, (mesaCounts.get(mesa) || 0) + 1);
  }
  const mesaSorted = [...mesaCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const mesaMax = mesaSorted[0]?.[1] || 1;

  /**
   * @param {number} since
   */
  function volumeSince(since) {
    let total = 0;
    let mesero = 0;
    let cuenta = 0;
    for (const row of list) {
      const t = Date.parse(row?.created_at || '');
      if (!Number.isFinite(t) || t < since) continue;
      total += 1;
      if (row.tipo === 'cuenta') cuenta += 1;
      else mesero += 1;
    }
    return { total, mesero, cuenta };
  }

  const vistas = Array.isArray(vistasRows) ? vistasRows : [];
  const eventMode = Boolean(
    opts.eventMode ??
      (vistas.length > 0 &&
        vistas.some((v) => v?.created_at) &&
        !vistas.some((v) => Number(v?.vistas) > 0)),
  );
  const platosAll = aggregatePlatoVistas(vistas, eventMode);
  const vistasMax = platosAll[0]?.vistas || 1;
  const totalVistas = platosAll.reduce((acc, row) => acc + row.vistas, 0);
  const withPct = (list) =>
    list.map((p) => ({
      ...p,
      pct: Math.round((p.vistas / vistasMax) * 100),
    }));

  /** @type {Record<string, { total: number, platos: Record<string, number> }>} */
  const months = {};
  if (eventMode) {
    const keys = new Set();
    for (const row of vistas) {
      const key = monthKeyFrom(row?.created_at);
      if (key) keys.add(key);
    }
    const now = new Date();
    for (let i = 0; i < 14; i += 1) {
      keys.add(monthKeyFrom(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }
    for (const key of keys) {
      months[key] = seriesBucket(
        aggregatePlatoVistas(vistas, true, (row) => monthKeyFrom(row?.created_at) === key),
      );
    }
  }

  return {
    tiempoPromedioMinutos: avg == null ? null : Math.round(avg * 10) / 10,
    tiempoPromedioLabel:
      avg == null
        ? '—'
        : avg < 1
          ? `${Math.round(avg * 60)} s`
          : `${(Math.round(avg * 10) / 10).toFixed(1)} min`,
    mesasActivas: mesaSorted.map(([mesa, total]) => ({
      mesa,
      total,
      pct: Math.round((total / mesaMax) * 100),
    })),
    volumen: {
      hoy: volumeSince(dayAgo),
      semana: volumeSince(weekAgo),
    },
    platosMasVistos: withPct(platosAll.slice(0, 10)),
    platosMenosVistos: withPct([...platosAll].sort((a, b) => a.vistas - b.vistas).slice(0, 10)),
    totalVistas,
    eventMode,
    vistasSeries: {
      all: seriesBucket(platosAll),
      months,
    },
    pendientes: list.filter((r) => !r.atendida).length,
    totalAlertas: list.length,
  };
}

/**
 * Snapshot vacío (UI estable sin data).
 * @returns {MetricsSnapshot}
 */
export function emptyMetricsSnapshot() {
  return computeMetricsSnapshot([], []);
}

/**
 * Carga alertas + vistas y calcula snapshot.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ restauranteId?: string | null, days?: number }} [opts]
 */
export async function fetchMetricsSnapshot(client, opts = {}) {
  const days = opts.days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const restauranteId = opts.restauranteId ? String(opts.restauranteId) : null;

  let alertasQ = client
    .from('alertas_mesas')
    .select('id, restaurante_id, mesa, tipo, atendida, atendida_at, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (restauranteId) alertasQ = alertasQ.eq('restaurante_id', restauranteId);

  let { data: alertas, error: alertasErr } = await alertasQ;
  if (alertasErr && /atendida_at|column|schema cache/i.test(alertasErr.message || '')) {
    console.warn('[metrics] atendida_at no disponible; SELECT legacy.', alertasErr.message);
    let legacyQ = client
      .from('alertas_mesas')
      .select('id, restaurante_id, mesa, tipo, atendida, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (restauranteId) legacyQ = legacyQ.eq('restaurante_id', restauranteId);
    const legacy = await legacyQ;
    alertas = legacy.data;
    alertasErr = legacy.error;
  }
  if (alertasErr) {
    console.warn('[metrics] alertas_mesas:', alertasErr.message);
  }

  let vistas = [];
  let eventMode = false;

  let eventQ = client
    .from('plato_vistas')
    .select('plato_id, created_at')
    .order('created_at', { ascending: false })
    .limit(8000);
  if (restauranteId) eventQ = eventQ.eq('restaurante_id', restauranteId);

  const eventRes = await eventQ;
  if (!eventRes.error) {
    eventMode = true;
    vistas = eventRes.data || [];
  } else {
    let vistasQ = client
      .from('plato_vistas')
      .select('plato_nombre, vistas, plato_id')
      .order('vistas', { ascending: false })
      .limit(400);
    if (restauranteId) vistasQ = vistasQ.eq('restaurante_id', restauranteId);
    const { data: vistasData, error: vistasErr } = await vistasQ;
    if (vistasErr) {
      if (!/plato_vistas|column|schema cache/i.test(vistasErr.message || '')) {
        console.warn('[metrics] plato_vistas:', vistasErr.message);
      }
    } else {
      vistas = vistasData || [];
    }
  }

  return computeMetricsSnapshot(alertas || [], vistas, { eventMode });
}
