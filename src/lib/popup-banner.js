/**
 * Anuncio / pop-up de bienvenida (public.restaurantes.popup_banner JSONB).
 *
 * @typedef {{
 *   enabled: boolean,
 *   image_url: string,
 *   title: string,
 *   description: string,
 *   button_text: string,
 *   action_type: 'whatsapp' | 'category' | 'close',
 *   action_url: string,
 *   duration_preset: 'indefinite' | 'today' | 'weekend' | 'custom' | 'schedule',
 *   expires_at: string | null,
 * }} PopupBanner
 */

const ACTION_TYPES = new Set(['whatsapp', 'category', 'close']);
const DURATION_PRESETS = new Set(['indefinite', 'today', 'weekend', 'custom', 'schedule']);

/**
 * @param {Date} d
 * @returns {string}
 */
function toIso(d) {
  return d.toISOString();
}

/**
 * @param {'indefinite' | 'today' | 'weekend' | 'custom' | 'schedule'} preset
 * @param {string} [customDate] YYYY-MM-DD
 * @param {string} [customTime] HH:mm
 * @returns {string | null}
 */
export function computePopupExpiresAt(preset, customDate = '', customTime = '23:59') {
  const now = new Date();
  if (preset === 'indefinite') return null;
  if (preset === 'today') {
    return toIso(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  }
  if (preset === 'weekend') {
    const end = new Date(now);
    const day = end.getDay();
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    end.setDate(end.getDate() + daysUntilSunday);
    end.setHours(23, 59, 59, 999);
    return toIso(end);
  }
  if (preset === 'custom' || preset === 'schedule') {
    const raw = String(customDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const [y, m, d] = raw.split('-').map(Number);
    const time = String(customTime || '23:59').trim();
    const [hh, mm] = time.split(':').map((n) => Number(n) || 0);
    const end = new Date(y, m - 1, d, hh, mm, 0, 0);
    if (Number.isNaN(end.getTime())) return null;
    return toIso(end);
  }
  return null;
}

/**
 * @param {unknown} raw
 * @returns {PopupBanner}
 */
export function parsePopupBanner(raw) {
  const base = {
    enabled: false,
    image_url: '',
    title: '',
    description: '',
    button_text: '',
    action_type: /** @type {'close'} */ ('close'),
    action_url: '',
    duration_preset: /** @type {'indefinite'} */ ('indefinite'),
    expires_at: /** @type {string | null} */ (null),
  };

  if (!raw || typeof raw !== 'object') return base;

  const obj = /** @type {Record<string, unknown>} */ (raw);
  const actionType = String(obj.action_type || obj.actionType || 'close')
    .trim()
    .toLowerCase();
  const durationPreset = String(obj.duration_preset || obj.durationPreset || 'indefinite')
    .trim()
    .toLowerCase();
  const expiresRaw = obj.expires_at ?? obj.expiresAt;
  const expiresAt =
    expiresRaw == null || expiresRaw === ''
      ? null
      : String(expiresRaw).trim() || null;

  return {
    enabled: obj.enabled === true || obj.enabled === 'true',
    image_url: String(obj.image_url || obj.imageUrl || '').trim(),
    title: String(obj.title || '').trim(),
    description: String(obj.description || '').trim(),
    button_text: String(obj.button_text || obj.buttonText || '').trim(),
    action_type: ACTION_TYPES.has(actionType)
      ? /** @type {PopupBanner['action_type']} */ (actionType)
      : 'close',
    action_url: String(obj.action_url || obj.actionUrl || '').trim(),
    duration_preset: DURATION_PRESETS.has(durationPreset)
      ? /** @type {PopupBanner['duration_preset']} */ (
          durationPreset === 'custom' ? 'schedule' : durationPreset
        )
      : 'indefinite',
    expires_at: expiresAt,
  };
}

/**
 * @param {Record<string, unknown>} body
 * @returns {PopupBanner | null}
 */
export function buildPopupBannerFromBody(body) {
  if (!body || typeof body !== 'object') return null;

  const hasFlat =
    body.popup_enabled !== undefined ||
    body.popup_image_url !== undefined ||
    body.popup_title !== undefined ||
    body.popup_description !== undefined ||
    body.popup_button_text !== undefined ||
    body.popup_action_type !== undefined ||
    body.popup_action_url !== undefined ||
    body.popup_expires_at !== undefined ||
    body.popup_duration_preset !== undefined;

  const nested = body.popup_banner;
  const hasNested = nested !== undefined;

  if (!hasFlat && !hasNested) return null;

  if (hasNested && typeof nested === 'object' && nested !== null) {
    return parsePopupBanner(nested);
  }

  const actionType = String(body.popup_action_type ?? 'close')
    .trim()
    .toLowerCase();
  const durationPreset = String(body.popup_duration_preset ?? 'indefinite')
    .trim()
    .toLowerCase();
  const expiresRaw = body.popup_expires_at;
  const expiresAt =
    expiresRaw == null || expiresRaw === ''
      ? null
      : String(expiresRaw).trim() || null;

  return {
    enabled:
      body.popup_enabled === true ||
      body.popup_enabled === 'true' ||
      body.popup_enabled === 1 ||
      body.popup_enabled === '1',
    image_url: String(body.popup_image_url ?? '').trim(),
    title: String(body.popup_title ?? '').trim(),
    description: String(body.popup_description ?? '').trim(),
    button_text: String(body.popup_button_text ?? '').trim(),
    action_type: ACTION_TYPES.has(actionType)
      ? /** @type {PopupBanner['action_type']} */ (actionType)
      : 'close',
    action_url: String(body.popup_action_url ?? '').trim(),
    duration_preset: DURATION_PRESETS.has(durationPreset)
      ? /** @type {PopupBanner['duration_preset']} */ (
          durationPreset === 'custom' ? 'schedule' : durationPreset
        )
      : 'indefinite',
    expires_at: expiresAt,
  };
}

/**
 * @param {PopupBanner} banner
 * @returns {boolean}
 */
export function popupBannerIsRenderable(banner) {
  if (!banner?.enabled) return false;
  if (!String(banner.image_url || '').trim()) return false;
  if (banner.expires_at) {
    const t = Date.parse(banner.expires_at);
    if (Number.isFinite(t) && t <= Date.now()) return false;
  }
  return true;
}

/**
 * @param {PopupBanner} banner
 * @returns {Record<string, unknown>}
 */
export function serializePopupBanner(banner) {
  const parsed = parsePopupBanner(banner);
  const expiresAt =
    parsed.duration_preset === 'indefinite' ? null : parsed.expires_at;
  return {
    enabled: parsed.enabled,
    image_url: parsed.image_url || null,
    title: parsed.title || null,
    description: parsed.description || null,
    button_text: parsed.button_text || null,
    action_type: parsed.action_type,
    action_url: parsed.action_url || null,
    duration_preset: parsed.duration_preset,
    expires_at: expiresAt,
  };
}
