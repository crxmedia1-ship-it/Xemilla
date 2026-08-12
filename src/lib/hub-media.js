/**
 * Media del Hub (cover + placa logo) con fallback en ui_estilo.hub
 * cuando faltan columnas hub_cover_url / hub_logo_bg en Supabase.
 */

/**
 * @param {unknown} row
 */
export function readUiHub(row) {
  const ui = /** @type {Record<string, unknown> | null | undefined} */ (row)?.ui_estilo;
  if (ui && typeof ui === 'object' && !Array.isArray(ui)) {
    const hub = ui.hub;
    if (hub && typeof hub === 'object' && !Array.isArray(hub)) {
      return /** @type {Record<string, unknown>} */ (hub);
    }
  }
  return {};
}

/**
 * @param {string} value
 */
export function isHttpUrl(value) {
  const v = String(value || '').trim();
  return Boolean(v && /^https?:\/\//i.test(v));
}

/**
 * Portada del Hub — columna hub_cover_url o ui_estilo.hub.cover_url.
 * @param {Record<string, unknown>} row
 */
export function resolveHubCoverUrl(row) {
  const direct = String(row?.hub_cover_url || '').trim();
  if (isHttpUrl(direct)) return direct;
  const fromUi = String(readUiHub(row).cover_url || '').trim();
  return isHttpUrl(fromUi) ? fromUi : '';
}

/**
 * Color de placa del logo — columna hub_logo_bg o ui_estilo.hub.logo_bg.
 * @param {Record<string, unknown>} row
 */
export function resolveHubLogoBg(row) {
  const direct = String(row?.hub_logo_bg || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(direct)) return direct;
  const fromUi = String(readUiHub(row).logo_bg || '').trim();
  return /^#[0-9A-Fa-f]{6}$/.test(fromUi) ? fromUi : '#111111';
}

/**
 * Persiste cover/logo_bg en ui_estilo.hub (merge, no pisa el resto).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} restauranteId
 * @param {{ coverUrl?: string | null, logoBg?: string | null }} hubPatch
 */
export async function persistHubInUiEstilo(client, restauranteId, hubPatch) {
  const coverUrl =
    hubPatch.coverUrl !== undefined ? String(hubPatch.coverUrl || '').trim() : undefined;
  const logoBg =
    hubPatch.logoBg !== undefined ? String(hubPatch.logoBg || '').trim() : undefined;

  if (coverUrl === undefined && logoBg === undefined) return;

  try {
    const { data } = await client
      .from('restaurantes')
      .select('ui_estilo')
      .eq('id', restauranteId)
      .maybeSingle();

    const prev =
      data?.ui_estilo && typeof data.ui_estilo === 'object' && !Array.isArray(data.ui_estilo)
        ? /** @type {Record<string, unknown>} */ (data.ui_estilo)
        : {};
    const prevHub =
      prev.hub && typeof prev.hub === 'object' && !Array.isArray(prev.hub)
        ? /** @type {Record<string, unknown>} */ (prev.hub)
        : {};

    /** @type {Record<string, unknown>} */
    const nextHub = { ...prevHub };
    if (coverUrl !== undefined && isHttpUrl(coverUrl)) nextHub.cover_url = coverUrl;
    if (logoBg !== undefined && /^#[0-9A-Fa-f]{6}$/.test(logoBg)) nextHub.logo_bg = logoBg;

    await client
      .from('restaurantes')
      .update({
        ui_estilo: {
          ...prev,
          hub: nextHub,
        },
      })
      .eq('id', restauranteId);
  } catch (err) {
    console.warn(
      '[hub-media] persistHubInUiEstilo:',
      err instanceof Error ? err.message : err,
    );
  }
}
