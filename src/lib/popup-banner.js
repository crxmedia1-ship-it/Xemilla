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
 * }} PopupBanner
 */

const ACTION_TYPES = new Set(['whatsapp', 'category', 'close']);

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
  };

  if (!raw || typeof raw !== 'object') return base;

  const obj = /** @type {Record<string, unknown>} */ (raw);
  const actionType = String(obj.action_type || obj.actionType || 'close')
    .trim()
    .toLowerCase();

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
    body.popup_action_url !== undefined;

  const nested = body.popup_banner;
  const hasNested = nested !== undefined;

  if (!hasFlat && !hasNested) return null;

  if (hasNested && typeof nested === 'object' && nested !== null) {
    return parsePopupBanner(nested);
  }

  const actionType = String(body.popup_action_type ?? 'close')
    .trim()
    .toLowerCase();

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
  };
}

/**
 * @param {PopupBanner} banner
 * @returns {boolean}
 */
export function popupBannerIsRenderable(banner) {
  if (!banner?.enabled) return false;
  return Boolean(String(banner.image_url || '').trim());
}

/**
 * @param {PopupBanner} banner
 * @returns {Record<string, unknown>}
 */
export function serializePopupBanner(banner) {
  const parsed = parsePopupBanner(banner);
  return {
    enabled: parsed.enabled,
    image_url: parsed.image_url || null,
    title: parsed.title || null,
    description: parsed.description || null,
    button_text: parsed.button_text || null,
    action_type: parsed.action_type,
    action_url: parsed.action_url || null,
  };
}
