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
 *     weekdays: {
 *       all: number[],
 *       months: Record<string, number[]>,
 *     },
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
 * Lun=0 … Dom=6
 * @param {string | Date | number} [value]
 */
function weekdayIndex(value) {
  const d = value instanceof Date ? value : new Date(value || '');
  if (!Number.isFinite(d.getTime())) return -1;
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}

/**
 * @param {Array<Record<string, unknown>>} vistasRows
 * @param {boolean} eventMode
 * @param {(row: Record<string, unknown>) => boolean} [filterFn]
 * @returns {number[]}
 */
function weekdayCounts(vistasRows, eventMode, filterFn) {
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const raw of vistasRows) {
    if (filterFn && !filterFn(raw)) continue;
    const i = weekdayIndex(raw?.created_at);
    if (i < 0) continue;
    days[i] += eventMode ? 1 : Number(raw?.vistas) || 0;
  }
  return days;
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
  /** @type {Record<string, number[]>} */
  const weekdayMonths = {};
  if (eventMode) {
    const keys = new Set();
    for (const row of vistas) {
      const key = monthKeyFrom(row?.created_at);
      if (key) keys.add(key);
    }
    const nowDate = new Date();
    for (let i = 0; i < 14; i += 1) {
      keys.add(monthKeyFrom(new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)));
    }
    for (const key of keys) {
      months[key] = seriesBucket(
        aggregatePlatoVistas(vistas, true, (row) => monthKeyFrom(row?.created_at) === key),
      );
      weekdayMonths[key] = weekdayCounts(vistas, true, (row) => monthKeyFrom(row?.created_at) === key);
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
      weekdays: {
        all: weekdayCounts(vistas, eventMode),
        months: weekdayMonths,
      },
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

/**
 * @typedef {{
 *   id: string,
 *   nombre: string,
 *   slug: string,
 *   logoUrl: string,
 *   visitas30d: number,
 *   platoMasVisto: string,
 *   tasaWhatsapp: number | null,
 *   waClicks: number,
 *   mapsClicks: number,
 *   tieneAcceso: boolean,
 * }} NetworkLocalRow
 */

/**
 * @typedef {{
 *   total: number,
 *   byRest: Record<string, number>,
 *   topPlatoByRest: Record<string, string>,
 *   topPlatos: Array<{ nombre: string, restaurante: string, vistas: number }>,
 *   rankingMayor: Array<{ id: string, nombre: string, slug: string, visitas: number, logoUrl: string }>,
 *   rankingMenor: Array<{ id: string, nombre: string, slug: string, visitas: number, logoUrl: string }>,
 * }} NetworkSeriesBucket
 */

/**
 * @typedef {{
 *   traficoGlobal: number,
 *   vistasWebApps: number,
 *   localesOperativos: number,
 *   localesTotal: number,
 *   catalogoGlobal: number,
 *   conversionRed: number,
 *   porLocal: NetworkLocalRow[],
 *   topPlatos: Array<{ nombre: string, restaurante: string, vistas: number }>,
 *   rankingLocales: Array<{ nombre: string, slug: string, visitas: number, logoUrl: string }>,
 *   rankingMenor: Array<{ nombre: string, slug: string, visitas: number, logoUrl: string }>,
 *   series: {
 *     eventMode: boolean,
 *     currentMonth: string,
 *     all: NetworkSeriesBucket,
 *     months: Record<string, NetworkSeriesBucket>,
 *   },
 *   firstRestaurantAt: string | null,
 * }} NetworkIntelligence
 */

/**
 * @param {string | Date | number} [value]
 */
function monthKeyFromDate(value) {
  return monthKeyFrom(value);
}

/**
 * Agrega un bucket vacío de serie de red.
 * @returns {NetworkSeriesBucket}
 */
function emptyNetworkBucket() {
  return {
    total: 0,
    byRest: {},
    topPlatoByRest: {},
    topPlatos: [],
    rankingMayor: [],
    rankingMenor: [],
  };
}

/**
 * Inteligencia de red SuperAdmin: KPIs + series temporales (General / mes) + rankings.
 * "Vistas Totales WebApps" = tráfico agregado de la red (eventos de visita en WebApps),
 * no el desglose por plato (ese vive en Top Platos / Plato Más Visto).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{
 *   days?: number,
 *   restaurantes?: Array<Record<string, unknown>>,
 *   localesConAcceso?: Set<string>,
 * }} [opts]
 * @returns {Promise<NetworkIntelligence>}
 */
export async function fetchNetworkIntelligence(client, opts = {}) {
  const restaurantes = Array.isArray(opts.restaurantes) ? opts.restaurantes : [];
  const localesConAcceso = opts.localesConAcceso instanceof Set ? opts.localesConAcceso : new Set();

  const now = new Date();
  const currentMonth = monthKeyFromDate(now);

  /** @type {string | null} */
  let firstRestaurantAt = null;
  for (const r of restaurantes) {
    const raw = r?.created_at;
    if (!raw) continue;
    const t = Date.parse(String(raw));
    if (!Number.isFinite(t)) continue;
    if (!firstRestaurantAt || t < Date.parse(firstRestaurantAt)) {
      firstRestaurantAt = new Date(t).toISOString();
    }
  }

  /** @type {Map<string, { nombre: string, restauranteId: string }>} */
  const platoMeta = new Map();
  let catalogoGlobal = 0;

  const { data: platosRows, error: platosErr } = await client
    .from('platos')
    .select('id, nombre, restaurante_id, disponible')
    .limit(8000);

  if (platosErr) {
    console.warn('[metrics/network] platos:', platosErr.message);
  } else {
    for (const p of platosRows || []) {
      const id = p?.id != null ? String(p.id) : '';
      if (id) {
        platoMeta.set(id, {
          nombre: String(p.nombre || 'Plato').trim() || 'Plato',
          restauranteId: String(p.restaurante_id || ''),
        });
      }
      if (p?.disponible !== false) catalogoGlobal += 1;
    }
  }

  /** @type {Array<Record<string, unknown>>} */
  let vistasRows = [];
  let eventMode = false;

  // Sin filtro de 30d: General = histórico agregado de toda la red
  const eventRes = await client
    .from('plato_vistas')
    .select('plato_id, restaurante_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20000);

  if (!eventRes.error) {
    eventMode = true;
    vistasRows = eventRes.data || [];
  } else {
    const legacyRes = await client
      .from('plato_vistas')
      .select('plato_id, restaurante_id, plato_nombre, vistas')
      .order('vistas', { ascending: false })
      .limit(2000);
    if (legacyRes.error) {
      if (!/plato_vistas|column|schema cache/i.test(legacyRes.error.message || '')) {
        console.warn('[metrics/network] plato_vistas:', legacyRes.error.message);
      }
    } else {
      vistasRows = legacyRes.data || [];
    }
  }

  /**
   * @typedef {{
   *   total: number,
   *   byRest: Map<string, number>,
   *   platosByRest: Map<string, Map<string, { nombre: string, vistas: number }>>,
   *   platosGlobal: Map<string, { nombre: string, restauranteId: string, vistas: number }>,
   * }} AccBucket
   */

  /** @returns {AccBucket} */
  function makeAcc() {
    return {
      total: 0,
      byRest: new Map(),
      platosByRest: new Map(),
      platosGlobal: new Map(),
    };
  }

  /**
   * @param {AccBucket} acc
   * @param {Record<string, unknown>} raw
   * @param {number} add
   */
  function pushEvent(acc, raw, add) {
    if (add <= 0) return;
    const restId = String(raw?.restaurante_id || '');
    const platoId = raw?.plato_id != null ? String(raw.plato_id) : '';
    const meta = platoId ? platoMeta.get(platoId) : null;
    const nombre =
      String(raw?.plato_nombre || meta?.nombre || 'Plato').trim() || 'Plato';

    acc.total += add;

    if (restId) {
      acc.byRest.set(restId, (acc.byRest.get(restId) || 0) + add);
      if (!acc.platosByRest.has(restId)) acc.platosByRest.set(restId, new Map());
      const localMap = acc.platosByRest.get(restId);
      const key = platoId || nombre.toLowerCase();
      const cur = localMap.get(key) || { nombre, vistas: 0 };
      cur.vistas += add;
      if (nombre && nombre !== 'Plato') cur.nombre = nombre;
      localMap.set(key, cur);
    }

    const gKey = platoId || `${restId}:${nombre.toLowerCase()}`;
    const gCur = acc.platosGlobal.get(gKey) || {
      nombre,
      restauranteId: restId || meta?.restauranteId || '',
      vistas: 0,
    };
    gCur.vistas += add;
    if (nombre && nombre !== 'Plato') gCur.nombre = nombre;
    if (!gCur.restauranteId && (restId || meta?.restauranteId)) {
      gCur.restauranteId = restId || meta.restauranteId;
    }
    acc.platosGlobal.set(gKey, gCur);
  }

  const allAcc = makeAcc();
  /** @type {Map<string, AccBucket>} */
  const monthAcc = new Map();

  for (const raw of vistasRows) {
    const add = eventMode ? 1 : Number(raw?.vistas) || 0;
    if (add <= 0) continue;
    pushEvent(allAcc, raw, add);

    if (eventMode) {
      const mk = monthKeyFromDate(raw?.created_at);
      if (!mk) continue;
      if (!monthAcc.has(mk)) monthAcc.set(mk, makeAcc());
      pushEvent(monthAcc.get(mk), raw, add);
    }
  }

  /** @type {Map<string, string>} */
  const nombreByRestId = new Map();
  for (const r of restaurantes) {
    nombreByRestId.set(String(r.id), String(r.nombre_comercial || r.slug || 'Local').trim());
  }

  /**
   * @param {AccBucket} acc
   * @returns {NetworkSeriesBucket}
   */
  function finalizeBucket(acc) {
    /** @type {Record<string, number>} */
    const byRest = {};
    for (const [id, n] of acc.byRest) byRest[id] = n;

    /** @type {Record<string, string>} */
    const topPlatoByRest = {};
    for (const [restId, localMap] of acc.platosByRest) {
      const top = [...localMap.values()].sort((a, b) => b.vistas - a.vistas)[0];
      if (top?.nombre) topPlatoByRest[restId] = top.nombre;
    }

    const topPlatos = [...acc.platosGlobal.values()]
      .sort((a, b) => b.vistas - a.vistas)
      .slice(0, 5)
      .map((row) => ({
        nombre: row.nombre,
        restaurante: nombreByRestId.get(row.restauranteId) || '—',
        vistas: row.vistas,
      }));

    const ranked = restaurantes
      .map((r) => {
        const id = String(r.id);
        const logo = String(r.logo_url || '').trim();
        return {
          id,
          nombre: String(r.nombre_comercial || r.slug || 'Local').trim() || 'Local',
          slug: String(r.slug || '').trim(),
          visitas: byRest[id] || 0,
          logoUrl: logo && /^https?:\/\//i.test(logo) ? logo : '',
        };
      })
      .sort((a, b) => b.visitas - a.visitas || a.nombre.localeCompare(b.nombre, 'es'));

    const withTraffic = ranked.filter((row) => row.visitas > 0);
    const rankingMayor = (withTraffic.length > 0 ? withTraffic : ranked).slice(0, 8);
    const rankingMenor = (
      withTraffic.length > 0
        ? [...withTraffic].sort((a, b) => a.visitas - b.visitas || a.nombre.localeCompare(b.nombre, 'es'))
        : [...ranked].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    ).slice(0, 8);

    return {
      total: acc.total,
      byRest,
      topPlatoByRest,
      topPlatos,
      rankingMayor,
      rankingMenor,
    };
  }

  const allBucket = finalizeBucket(allAcc);
  /** @type {Record<string, NetworkSeriesBucket>} */
  const months = {};
  for (const [key, acc] of monthAcc) {
    months[key] = finalizeBucket(acc);
  }
  // Asegurar mes actual presente (aunque vacío) para "Este Mes"
  if (!months[currentMonth]) months[currentMonth] = emptyNetworkBucket();

  // Seed meses vacíos entre primer restaurante y ahora (UI estable)
  if (firstRestaurantAt) {
    const start = new Date(firstRestaurantAt);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= end) {
      const key = monthKeyFromDate(cursor);
      if (key && !months[key]) months[key] = emptyNetworkBucket();
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  /** @type {NetworkLocalRow[]} */
  const porLocal = restaurantes.map((r) => {
    const id = String(r.id);
    const tieneAcceso =
      localesConAcceso.has(id) || localesConAcceso.has(String(r.slug || ''));
    const visitas = allBucket.byRest[id] || 0;
    const waClicks = 0;
    const mapsClicks = 0;
    const tasaWhatsapp =
      visitas > 0 ? Math.round((waClicks / visitas) * 1000) / 10 : null;
    const logo = String(r.logo_url || '').trim();

    return {
      id,
      nombre: String(r.nombre_comercial || r.slug || 'Local').trim() || 'Local',
      slug: String(r.slug || '').trim(),
      logoUrl: logo && /^https?:\/\//i.test(logo) ? logo : '',
      visitas30d: visitas,
      platoMasVisto: allBucket.topPlatoByRest[id] || '—',
      tasaWhatsapp,
      waClicks,
      mapsClicks,
      tieneAcceso,
    };
  });

  porLocal.sort((a, b) => b.visitas30d - a.visitas30d || a.nombre.localeCompare(b.nombre, 'es'));

  const vistasWebApps = allBucket.total;
  const localesOperativos = porLocal.filter((row) => row.tieneAcceso).length;
  const conversionRed = porLocal.reduce(
    (acc, row) => acc + row.waClicks + row.mapsClicks,
    0,
  );

  return {
    traficoGlobal: vistasWebApps,
    vistasWebApps,
    localesOperativos,
    localesTotal: porLocal.length,
    catalogoGlobal,
    conversionRed,
    porLocal,
    topPlatos: allBucket.topPlatos,
    rankingLocales: allBucket.rankingMayor.map((row) => ({
      nombre: row.nombre,
      slug: row.slug,
      visitas: row.visitas,
      logoUrl: row.logoUrl,
    })),
    rankingMenor: allBucket.rankingMenor.map((row) => ({
      nombre: row.nombre,
      slug: row.slug,
      visitas: row.visitas,
      logoUrl: row.logoUrl,
    })),
    series: {
      eventMode,
      currentMonth,
      all: allBucket,
      months,
    },
    firstRestaurantAt,
  };
}
