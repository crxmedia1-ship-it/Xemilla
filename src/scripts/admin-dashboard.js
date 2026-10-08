  import {
    MENU_MACROS,
    macrosPresentIn,
    resolveMacroId,
    subsForMacro,
    subSortIndex,
  } from '../config/menu-macros.js';
  import {
    destacadoPickerHtml,
    destacadoPickerLabel,
    normalizeDestacadoTipo,
  } from '../lib/destacado-tipo.js';
  import { previewMenuBulkText } from '../lib/menu-bulk.js';
  import { initSucursales } from './admin-sucursales.js';
  import {
    cropPlatoImage,
    isCroppableImageFile,
    uploadPlatoMediaFile,
  } from '../lib/plato-image-crop.js';
  import { platoFillUrl } from '../lib/plato-media-url.js';
  import {
    previewHorarioHoy,
    serializeHorarioSemana,
  } from '../lib/horarios-semana.js';
  import { googleMapsEmbedSrc, mapsOpenHref, normalizeMapsStorage } from '../lib/maps-preview.js';

  const MACRO_ID_ORDER = [...MENU_MACROS.map((m) => m.id), 'otros'];
  const PLATOS_COLSPAN = 7;

  /** @type {AbortController | null} */
  let __dashboardAc = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let modalCloseTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let descCloseTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let nombreCloseTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let nuevoCloseTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let nutricionCloseTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let arCloseTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let opsAutoSaveTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let opsToastTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let opsToastHideTimer = null;

  function teardownAdminDashboard() {
    __dashboardAc?.abort();
    __dashboardAc = null;
    if (modalCloseTimer) {
      clearTimeout(modalCloseTimer);
      modalCloseTimer = null;
    }
    if (descCloseTimer) {
      clearTimeout(descCloseTimer);
      descCloseTimer = null;
    }
    if (nombreCloseTimer) {
      clearTimeout(nombreCloseTimer);
      nombreCloseTimer = null;
    }
    if (nuevoCloseTimer) {
      clearTimeout(nuevoCloseTimer);
      nuevoCloseTimer = null;
    }
    if (nutricionCloseTimer) {
      clearTimeout(nutricionCloseTimer);
      nutricionCloseTimer = null;
    }
    if (arCloseTimer) {
      clearTimeout(arCloseTimer);
      arCloseTimer = null;
    }
    if (opsAutoSaveTimer) {
      clearTimeout(opsAutoSaveTimer);
      opsAutoSaveTimer = null;
    }
    if (opsToastTimer) {
      clearTimeout(opsToastTimer);
      opsToastTimer = null;
    }
    if (opsToastHideTimer) {
      clearTimeout(opsToastHideTimer);
      opsToastHideTimer = null;
    }
  }

  function initAdminDashboard() {
    teardownAdminDashboard();

  const ac = new AbortController();
  __dashboardAc = ac;
  const { signal } = ac;

  const root = document.getElementById('dashboard-root');
  const restauranteId = String(root?.dataset.restauranteId || '').trim();
  const restauranteSlug = String(root?.dataset.slug || '').trim();

  // Clear stale context warning
  document.getElementById('menu-context-warning')?.remove();
  if (root && !restauranteId) {
    const warn = document.createElement('div');
    warn.id = 'menu-context-warning';
    warn.className = 'mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200';
    warn.setAttribute('role', 'alert');
    warn.textContent =
      'No hay restaurante activo (falta restaurante_id). Recargá el panel o volvé a entrar desde SuperAdmin.';
    root.prepend(warn);
    console.error('Error en menú:', new Error('restaurante_id ausente en dashboard-root'));
  }

  function requireRestauranteId() {
    if (restauranteId) return true;
    const msg = 'Restaurante no disponible (restaurante_id inválido).';
    console.error('Error en menú:', new Error(msg));
    if (typeof showToast === 'function') showToast(msg, 'error');
    else alert(msg);
    return false;
  }
  const bulkText = document.getElementById('bulk-text');
  const bulkSubmit = document.getElementById('bulk-submit');
  const bulkFeedback = document.getElementById('bulk-feedback');
  const bulkPreview = document.getElementById('bulk-preview');
  const bulkPreviewMeta = document.getElementById('bulk-preview-meta');
  const bulkPreviewSummary = document.getElementById('bulk-preview-summary');
  const bulkPreviewBody = document.getElementById('bulk-preview-body');
  const bulkPreviewErrors = document.getElementById('bulk-preview-errors');
  /** @type {ReturnType<typeof setTimeout> | null} */
  let bulkPreviewTimer = null;
  const tbody = document.getElementById('platos-tbody');
  const emptyEl = document.getElementById('platos-empty');
  const tableWrap = document.getElementById('platos-table-wrap');
  const toolbar = document.getElementById('platos-toolbar');
  const noResults = document.getElementById('platos-no-results');
  const countEl = document.getElementById('platos-count');
  const searchInput = document.getElementById('platos-search');
  const searchMeta = document.getElementById('search-meta');
  const categoryFilters = document.getElementById('category-scroll');
  const macroFilters = document.getElementById('macro-scroll');
  const subcatFilters = document.getElementById('subcat-scroll');
  const PILL_ON = 'is-on';
  const PILL_OFF = '';
  const CAT_PILL_ACTIVE = `cat-filter-pill ${PILL_ON}`;
  const CAT_PILL_INACTIVE = `cat-filter-pill ${PILL_OFF}`;
  const MACRO_PILL_ACTIVE = `macro-filter-pill ${PILL_ON}`;
  const MACRO_PILL_INACTIVE = `macro-filter-pill ${PILL_OFF}`;

  /** Astro scopes page CSS via data-astro-cid; stamp it on JS-created nodes. */
  const ASTRO_SCOPE_ATTR = [
    ...(document.querySelector(
      '#nosotros-bloques-list, [data-nosotros-bloque], #status-scroll, #macro-scroll, .platos-table, #dashboard-root',
    )?.attributes ?? []),
  ]
    .map((a) => a.name)
    .find((n) => n.startsWith('data-astro-cid'));

  /** @param {HTMLElement} el */
  function stampAstroScope(el) {
    if (ASTRO_SCOPE_ATTR && el instanceof HTMLElement) el.setAttribute(ASTRO_SCOPE_ATTR, '');
  }

  /** @param {HTMLElement} rootEl */
  function stampAstroScopeTree(rootEl) {
    if (!(rootEl instanceof HTMLElement)) return;
    stampAstroScope(rootEl);
    rootEl.querySelectorAll('*').forEach((node) => {
      if (node instanceof HTMLElement) stampAstroScope(node);
    });
  }
  const opsTelefonoInput = document.getElementById('hub-telefono');
  const opsHorarioInput = document.getElementById('ops-horario');
  const opsInstagramInput = document.getElementById('ops-instagram');
  const opsFacebookInput = document.getElementById('ops-facebook');
  const opsTiktokInput = document.getElementById('ops-tiktok');
  const opsTripadvisorInput = document.getElementById('ops-tripadvisor');
  const opsWhatsappInput = document.getElementById('ops-whatsapp');
  const opsMapsInput = document.getElementById('ops-maps');
  const hubDatosSave = document.getElementById('hub-datos-save');
  const hubDatosStatus = document.getElementById('hub-datos-status');
  const hubNombreInput = document.getElementById('hub-nombre');
  const hubLogoUrlInput = document.getElementById('hub-logo-url');
  const hubLogoBgInput = document.getElementById('hub-logo-bg');
  const hubCoverUrlInput = document.getElementById('hub-cover-url');
  const hubLogoFileInput = document.getElementById('hub-logo-file');
  const hubCoverFileInput = document.getElementById('hub-cover-file');
  const hubLogoPreview = document.getElementById('hub-logo-preview');
  const hubCoverPreview = document.getElementById('hub-cover-preview');
  const opsContactoStatus = document.getElementById('ops-contacto-status');
  const opsDireccionInput = document.getElementById('ops-direccion');
  const welcomePopupRoot = document.querySelector('[data-welcome-popup="perfil"]');
  const opsContactoCard = document.querySelector('#ops-contacto-card');
  let opsSaveBusy = false;
  let opsNeedsResave = false;

  /**
   * @param {string} msg
   */
  function mostrarToastFlotante(msg) {
    const el = document.getElementById('ops-autosave-toast');
    if (!(el instanceof HTMLElement)) return;
    el.textContent = msg && msg.startsWith('✓') ? msg : `✓ ${msg || 'Guardado'}`;
    el.hidden = false;
    el.dataset.open = 'true';
    el.style.opacity = '1';
    if (opsToastTimer) clearTimeout(opsToastTimer);
    if (opsToastHideTimer) clearTimeout(opsToastHideTimer);
    opsToastTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.dataset.open = 'false';
      opsToastHideTimer = setTimeout(() => {
        el.hidden = true;
      }, 300);
    }, 1800);
  }

  function recolectarDatosOperacion() {
    syncHorarioHidden('perfil');
    const popupPayload = readPopupPayload(
      welcomePopupRoot instanceof HTMLElement ? welcomePopupRoot : null,
    );
    return {
      restaurante_id: restauranteId,
      horario: fieldValue(opsHorarioInput),
      coordenadas_maps: normalizeMapsStorage(fieldValue(opsMapsInput)),
      instagram_url: socialField('perfil', 'instagram'),
      facebook_url: socialField('perfil', 'facebook'),
      tiktok_url: socialField('perfil', 'tiktok'),
      tripadvisor_url: socialField('perfil', 'tripadvisor'),
      whatsapp_url: socialField('perfil', 'whatsapp'),
      telefono_url: socialField('perfil', 'telefono'),
      instagram_activo: socialOn('instagram', 'perfil'),
      facebook_activo: socialOn('facebook', 'perfil'),
      tiktok_activo: socialOn('tiktok', 'perfil'),
      tripadvisor_activo: socialOn('tripadvisor', 'perfil'),
      whatsapp_activo: socialOn('whatsapp', 'perfil'),
      telefono_activo: socialOn('telefono', 'perfil'),
      direccion: fieldValue(opsDireccionInput),
      popup_banner: {
        enabled: Boolean(popupPayload.popup_enabled),
        image_url: popupPayload.popup_image_url || '',
        title: '',
        description: '',
        button_text: '',
        action_type: 'close',
        action_url: '',
        duration_preset: popupPayload.popup_duration_preset || 'indefinite',
        expires_at: popupPayload.popup_expires_at || null,
      },
      ...popupPayload,
    };
  }

  function autoSaveOperacion() {
    if (opsSaveBusy) {
      opsNeedsResave = true;
      return;
    }
    if (opsAutoSaveTimer) clearTimeout(opsAutoSaveTimer);
    opsAutoSaveTimer = setTimeout(() => {
      opsAutoSaveTimer = null;
      void saveOpsContacto({ silent: true });
    }, 600);
  }

  const DISH_ORDER_INPUT_CLASS =
    'w-12 bg-transparent text-white/80 font-mono text-center border-b border-white/10 hover:border-white/30 focus:border-white focus:outline-none transition-colors appearance-none p-1 text-sm';
  const CAMERA_ICON_SVG =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>';

  /** @type {string} */
  let activeMacroFilter = 'todas';
  /** @type {string} */
  let activeCategoryFilter = 'todas';
  let activeStatusFilter = 'todas';
  const statusFilters = document.getElementById('status-scroll');

  const modal = document.getElementById('plato-modal');
  const modalTitle = document.getElementById('plato-modal-title');
  const modalClose = document.getElementById('plato-modal-close');
  const modalPreview = document.getElementById('modal-preview');
  const modalAttach = document.getElementById('modal-attach');
  const modalImg = document.getElementById('plato-modal-img');
  const modalVideo = document.getElementById('plato-modal-video');
  const modalUrl = document.getElementById('modal-url');
  const modalFile = document.getElementById('modal-file');
  const modalAttachError = document.getElementById('modal-attach-error');
  const modalReplaceFile = document.getElementById('modal-replace-file');
  const modalReplaceLabel = document.getElementById('modal-replace-label');
  const modalReplaceBusy = document.getElementById('modal-replace-busy');
  const modalReplaceError = document.getElementById('modal-replace-error');
  const modalAdjustImage = document.getElementById('modal-adjust-image');
  const modalRemoveImage = document.getElementById('modal-remove-image');

  const descModal = document.getElementById('desc-modal');
  const descModalTitle = document.getElementById('desc-modal-title');
  const descModalText = document.getElementById('desc-modal-text');
  const descModalClose = document.getElementById('desc-modal-close');
  const descModalSave = document.getElementById('desc-modal-save');
  const descModalError = document.getElementById('desc-modal-error');
  const nombreModal = document.getElementById('nombre-modal');
  const nombreModalTitle = document.getElementById('nombre-modal-title');
  const nombreModalText = document.getElementById('nombre-modal-text');
  const nombreModalClose = document.getElementById('nombre-modal-close');
  const nombreModalSave = document.getElementById('nombre-modal-save');
  const nombreModalError = document.getElementById('nombre-modal-error');

  const bulkToggle = document.getElementById('bulk-toggle');
  const bulkToggleMobile = document.getElementById('bulk-toggle-mobile');
  const bulkPanel = document.getElementById('bulk-panel');
  const bulkChevron = document.getElementById('bulk-toggle-chevron');

  const nuevoModal = document.getElementById('nuevo-plato-modal');
  const nuevoOpeners = document.querySelectorAll('[data-nuevo-plato-open]');
  const nuevoClose = document.getElementById('nuevo-plato-close');
  const nuevoForm = document.getElementById('nuevo-plato-form');
  const nuevoSubmit = document.getElementById('nuevo-plato-submit');
  const nuevoError = document.getElementById('nuevo-plato-error');
  const npDestacado = document.getElementById('np-destacado');
  const npDestacadoTipo = document.getElementById('np-destacado-tipo');
  const npCategoriasList = document.getElementById('np-categorias-list');

  /** @type {{ id: number, nombre: string }[]} */
  let categoriasCache = [];
  try {
    categoriasCache = JSON.parse(root?.dataset.categorias || '[]');
  } catch {
    categoriasCache = [];
  }

  /** @type {HTMLElement | null} */
  let activeMediaRow = null;
  /** @type {HTMLElement | null} */
  let activeDescRow = null;
  /** @type {HTMLElement | null} */
  let activeNombreRow = null;
  /** @type {HTMLElement | null} */
  let activeNutricionRow = null;

  /**
   * @param {HTMLElement} row
   */
  function getRowNombre(row) {
    const input = row.querySelector('[data-field="nombre"]');
    if (input instanceof HTMLInputElement && String(input.value || '').trim()) {
      return String(input.value).trim();
    }
    const text = row.querySelector('[data-nombre-text]');
    if (text?.textContent) return String(text.textContent).trim();
    return String(row.dataset.nombre || 'Plato').trim() || 'Plato';
  }

  /**
   * @param {HTMLElement} row
   * @param {string} value
   */
  function setRowNombreUi(row, value) {
    const input = row.querySelector('[data-field="nombre"]');
    if (input instanceof HTMLInputElement) {
      input.value = value;
      input.dataset.original = value;
    }
    const text = row.querySelector('[data-nombre-text]');
    const clone = row.querySelector('[data-nombre-clone]');
    if (text) text.textContent = value;
    if (clone) clone.textContent = value;
    const btn = row.querySelector('[data-edit-nombre]');
    if (btn instanceof HTMLElement) {
      btn.setAttribute('aria-label', `Editar nombre: ${value}`);
    }
    row.dataset.nombre = value;
    syncDishNameMarquee(row);
  }

  /**
   * @param {HTMLElement} row
   */
  function syncDishNameMarquee(row) {
    const preview = row.querySelector('[data-nombre-preview]');
    const track = preview?.querySelector('.dish-name-marquee__track');
    if (!(preview instanceof HTMLElement) || !(track instanceof HTMLElement)) return;
    preview.classList.remove('is-overflow');
    // Force layout, then compare text width vs visible width
    requestAnimationFrame(() => {
      const text = track.querySelector('[data-nombre-text]');
      if (!(text instanceof HTMLElement)) return;
      const needs = text.scrollWidth > preview.clientWidth + 2;
      preview.classList.toggle('is-overflow', needs);
      if (needs) {
        const distance = Math.max(40, text.scrollWidth);
        const seconds = Math.min(28, Math.max(12, distance / 18));
        track.style.animationDuration = `${seconds}s`;
      } else {
        track.style.removeProperty('animation-duration');
      }
    });
  }

  function syncAllDishNameMarquees() {
    for (const row of allRows()) {
      if (row instanceof HTMLElement) syncDishNameMarquee(row);
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function setFeedback(message, ok) {
    if (!bulkFeedback) return;
    bulkFeedback.textContent = message;
    bulkFeedback.classList.remove('hidden', 'text-rose-400', 'text-emerald-400');
    bulkFeedback.classList.add(ok ? 'text-emerald-400' : 'text-rose-400');
  }

  function allRows() {
    return [...(tbody?.querySelectorAll('tr[data-plato-id]') ?? [])];
  }

  function refreshSearchIndex(row) {
    if (!(row instanceof HTMLElement)) return;
    const nombre = row.querySelector('[data-field="nombre"]');
    const descBtn = row.querySelector('[data-edit-descripcion]');
    const cat = row.querySelector('[data-categoria]');
    const n = nombre instanceof HTMLInputElement ? nombre.value : '';
    const d =
      descBtn instanceof HTMLElement ? descBtn.dataset.descripcion || '' : '';
    const c = cat?.textContent || '';
    row.dataset.search = `${n} ${c} ${d}`.toLowerCase();
    row.dataset.nombre = n;
    row.dataset.categoria = c.trim();
    row.dataset.categoriaId = resolveCategoriaKey(c.trim());
  }

  /** Prefer category id from cache; fallback to name as stable key. */
  function resolveCategoriaKey(nombre, id) {
    if (id != null && String(id).trim() !== '') return String(id).trim();
    const n = String(nombre || '').trim();
    if (!n) return '';
    const found = categoriasCache.find(
      (c) => String(c?.nombre || '').trim().toLowerCase() === n.toLowerCase(),
    );
    if (found?.id != null && String(found.id).trim() !== '') return String(found.id);
    return n;
  }

  function refreshCount() {
    const rows = allRows();
    const n = rows.length;
    if (countEl) countEl.textContent = String(n);
    emptyEl?.classList.toggle('hidden', n > 0);
    tableWrap?.classList.toggle('hidden', n === 0);
    toolbar?.classList.toggle('hidden', n === 0);
    renumberDishOrderInputs();
    refreshCategoryPills();
    sincronizarVistaTodas();
    applySearchFilter();
    syncAllDishNameMarquees();
  }

  function renumberDishOrderInputs() {
    /** @type {Map<string, number>} */
    const counters = new Map();
    for (const row of allRows()) {
      if (!(row instanceof HTMLElement)) continue;
      const cat = String(row.dataset.categoria || '').trim().toLowerCase();
      const n = (counters.get(cat) || 0) + 1;
      counters.set(cat, n);
      const input = row.querySelector('[data-dish-order]');
      if (input instanceof HTMLInputElement) input.value = String(n);
    }
  }

  /** @param {HTMLElement} row */
  function rowsInSameCategory(row) {
    const cat = String(row.dataset.categoria || '').trim().toLowerCase();
    return allRows().filter((r) => {
      if (!(r instanceof HTMLElement)) return false;
      return String(r.dataset.categoria || '').trim().toLowerCase() === cat;
    });
  }

  const menuOrdenStatus = document.getElementById('menu-orden-status');
  /** @type {ReturnType<typeof setTimeout> | null} */
  let menuOrdenStatusTimer = null;

  /**
   * Subtle success/error feedback for order persistence (non-blocking).
   * @param {'ok' | 'error'} state
   * @param {string} [message]
   * @param {HTMLInputElement[]} [flashInputs]
   */
  function flashMenuOrdenFeedback(state, message, flashInputs) {
    if (menuOrdenStatus) {
      menuOrdenStatus.textContent = message || (state === 'ok' ? 'Guardado' : 'Error al guardar');
      menuOrdenStatus.classList.toggle('text-emerald-400', state === 'ok');
      menuOrdenStatus.classList.toggle('text-rose-400', state === 'error');
      menuOrdenStatus.classList.toggle('text-zinc-500', false);
      menuOrdenStatus.style.opacity = '1';
      if (menuOrdenStatusTimer) clearTimeout(menuOrdenStatusTimer);
      menuOrdenStatusTimer = setTimeout(() => {
        if (!(menuOrdenStatus instanceof HTMLElement)) return;
        menuOrdenStatus.style.opacity = '0';
      }, state === 'ok' ? 1400 : 2800);
    }

    if (Array.isArray(flashInputs)) {
      const cls = state === 'ok' ? 'orden-saved' : 'orden-error';
      for (const input of flashInputs) {
        if (!(input instanceof HTMLInputElement)) continue;
        input.classList.remove('orden-saved', 'orden-error');
        // Force reflow so repeated saves still animate
        void input.offsetWidth;
        input.classList.add(cls);
        setTimeout(() => input.classList.remove(cls), 1200);
      }
    }
  }

  /**
   * Persist category / dish visual order via secure admin API (no service keys in browser).
   * @param {'categorias' | 'platos'} tipo
   * @param {Array<{ id: string|number, orden: number }> | null} [items]
   */
  async function guardarOrdenMenu(tipo, items) {
    if (!restauranteId) return { ok: false, error: 'Sin restaurante' };

    /** @type {Array<{ id: number, orden: number }>} */
    let payloadItems = [];

    if (Array.isArray(items) && items.length > 0) {
      payloadItems = items
        .map((entry) => ({
          id: Number(entry?.id),
          orden: Number(entry?.orden),
        }))
        .filter((e) => Number.isFinite(e.id) && e.id > 0 && Number.isFinite(e.orden) && e.orden >= 0);
    } else if (tipo === 'categorias') {
      let index = 0;
      for (const pill of categoryFilters?.querySelectorAll('[data-cat-filter]') ?? []) {
        if (!(pill instanceof HTMLElement)) continue;
        const filter = String(pill.dataset.catFilter || '').trim();
        if (!filter || filter === 'todas') continue;
        const rawId = String(pill.dataset.categoriaId || '').trim();
        const id = Number(rawId);
        if (!Number.isFinite(id) || id <= 0) continue;
        payloadItems.push({ id, orden: index++ });
      }
    } else if (tipo === 'platos') {
      for (const row of allRows()) {
        if (!(row instanceof HTMLElement)) continue;
        const id = Number(row.dataset.platoId || '');
        if (!Number.isFinite(id) || id <= 0) continue;
        const input = row.querySelector('[data-dish-order]');
        const orden =
          input instanceof HTMLInputElement
            ? Number.parseInt(input.value, 10)
            : NaN;
        if (!Number.isFinite(orden) || orden < 0) continue;
        payloadItems.push({ id, orden });
      }
    }

    if (payloadItems.length === 0) {
      return { ok: false, error: 'Sin ítems para guardar' };
    }

    /** @type {HTMLInputElement[]} */
    const flashInputs =
      tipo === 'platos'
        ? payloadItems
            .map((item) => {
              const row = tbody?.querySelector(`tr[data-plato-id="${item.id}"]`);
              const input = row?.querySelector('[data-dish-order]');
              return input instanceof HTMLInputElement ? input : null;
            })
            .filter(Boolean)
        : [];

    try {
      const res = await fetch('/api/update-menu-orden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          restaurante_id: restauranteId,
          items: payloadItems,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'No se pudo guardar el orden');
      }

      // Keep categoriasCache.orden in sync for future pill rebuilds
      if (tipo === 'categorias') {
        for (const item of payloadItems) {
          const cached = categoriasCache.find((c) => Number(c?.id) === item.id);
          if (cached) cached.orden = item.orden;
        }
        categoriasCache.sort(
          (a, b) =>
            (Number(a?.orden) || 0) - (Number(b?.orden) || 0) ||
            String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'),
        );
      }

      flashMenuOrdenFeedback('ok', 'Guardado', flashInputs);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      flashMenuOrdenFeedback('error', msg, flashInputs);
      return { ok: false, error: msg };
    }
  }

  function setCategoryPillActive(btn, active) {
    if (!(btn instanceof HTMLElement)) return;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.className = active ? CAT_PILL_ACTIVE : CAT_PILL_INACTIVE;
    stampAstroScope(btn);
  }

  function setMacroPillActive(btn, active) {
    if (!(btn instanceof HTMLElement)) return;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.className = active ? MACRO_PILL_ACTIVE : MACRO_PILL_INACTIVE;
    stampAstroScope(btn);
  }

  function setStatusPillActive(btn, active) {
    if (!(btn instanceof HTMLElement)) return;
    const mods = [...btn.classList].filter((c) => c.startsWith('status-filter-pill--')).join(' ');
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.className = `status-filter-pill ${mods} ${active ? PILL_ON : PILL_OFF}`.replace(/\s+/g, ' ').trim();
    stampAstroScope(btn);
  }

  /** @returns {Set<string>} */
  function collectCategoryNames() {
    const names = new Set();
    for (const cat of categoriasCache) {
      const n = String(cat?.nombre || '').trim();
      if (n) names.add(n);
    }
    for (const row of allRows()) {
      if (!(row instanceof HTMLElement)) continue;
      const n = String(row.dataset.categoria || '').trim();
      if (n && n !== '—') names.add(n);
    }
    return names;
  }

  /** @param {string} name */
  function categoryCacheOrden(name) {
    const key = String(name || '').trim().toLowerCase();
    const found = categoriasCache.find(
      (c) => String(c?.nombre || '').trim().toLowerCase() === key,
    );
    return Number(found?.orden);
  }

  /**
   * @param {Iterable<string>} names
   * @param {string[]} priorOrder
   */
  function sortCategoryNames(names, priorOrder) {
    const set = new Set([...names].map((n) => String(n || '').trim()).filter(Boolean));
    const ordered = priorOrder.filter((n) => set.has(n));
    const remaining = [...set].filter((n) => !ordered.includes(n));
    remaining.sort((a, b) => {
      const ma = MACRO_ID_ORDER.indexOf(resolveMacroId(a));
      const mb = MACRO_ID_ORDER.indexOf(resolveMacroId(b));
      const ra = ma < 0 ? 99 : ma;
      const rb = mb < 0 ? 99 : mb;
      if (ra !== rb) return ra - rb;
      const ai = subSortIndex(resolveMacroId(a), a);
      const bi = subSortIndex(resolveMacroId(b), b);
      if (ai !== bi) return ai - bi;
      const oa = categoryCacheOrden(a);
      const ob = categoryCacheOrden(b);
      const na = Number.isFinite(oa) ? oa : 9999;
      const nb = Number.isFinite(ob) ? ob : 9999;
      if (na !== nb) return na - nb;
      return a.localeCompare(b, 'es');
    });
    // Prefer canonical macro blocks even when priorOrder exists
    const combined = [...ordered, ...remaining];
    /** @type {Map<string, string[]>} */
    const byMacro = new Map();
    for (const name of combined) {
      const mid = resolveMacroId(name);
      if (!byMacro.has(mid)) byMacro.set(mid, []);
      const list = byMacro.get(mid);
      if (list && !list.includes(name)) list.push(name);
    }
    /** @type {string[]} */
    const macroSeq = [];
    for (const name of combined) {
      const mid = resolveMacroId(name);
      if (!macroSeq.includes(mid)) macroSeq.push(mid);
    }
    for (const mid of MACRO_ID_ORDER) {
      if (byMacro.has(mid) && !macroSeq.includes(mid)) macroSeq.push(mid);
    }
    /** @type {string[]} */
    const out = [];
    for (const mid of macroSeq) {
      for (const name of byMacro.get(mid) || []) out.push(name);
    }
    return out;
  }

  function refreshCategoryPills() {
    if (!(categoryFilters instanceof HTMLElement)) return;
    const names = collectCategoryNames();

    /** Preserve drag order of existing category pills. */
    /** @type {string[]} */
    const priorOrder = [];
    for (const pill of categoryFilters.querySelectorAll('[data-cat-filter]')) {
      if (!(pill instanceof HTMLElement)) continue;
      const f = String(pill.dataset.catFilter || '').trim();
      if (f && f !== 'todas' && names.has(f) && !priorOrder.includes(f)) {
        priorOrder.push(f);
      }
    }
    const orderedNames = sortCategoryNames(names, priorOrder);

    categoryFilters.innerHTML = '';

    const todas = document.createElement('button');
    todas.type = 'button';
    todas.dataset.catFilter = 'todas';
    todas.draggable = false;
    todas.textContent = 'Todas';
    setCategoryPillActive(todas, activeCategoryFilter === 'todas');
    categoryFilters.appendChild(todas);

    for (const name of orderedNames) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.catFilter = name;
      btn.dataset.categoriaId = resolveCategoriaKey(name);
      btn.draggable = false;
      btn.textContent = name;
      setCategoryPillActive(btn, activeCategoryFilter === name);
      categoryFilters.appendChild(btn);
    }

    if (activeCategoryFilter !== 'todas' && !names.has(activeCategoryFilter)) {
      activeCategoryFilter = 'todas';
      setCategoryPillActive(todas, true);
    }

    refreshMacroPills();
    refreshSubcatPills();
  }

  function refreshMacroPills() {
    if (!(macroFilters instanceof HTMLElement)) return;
    const macros = macrosPresentIn(collectCategoryNames());
    const current = activeMacroFilter;

    macroFilters.innerHTML = '';
    const todas = document.createElement('button');
    todas.type = 'button';
    todas.dataset.macroFilter = 'todas';
    todas.textContent = 'Menú completo';
    setMacroPillActive(todas, current === 'todas');
    macroFilters.appendChild(todas);

    for (const macro of macros) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.macroFilter = macro.id;
      btn.textContent = macro.label;
      setMacroPillActive(btn, current === macro.id);
      macroFilters.appendChild(btn);
    }

    if (current !== 'todas' && !macros.some((m) => m.id === current)) {
      activeMacroFilter = 'todas';
      activeCategoryFilter = 'todas';
      setMacroPillActive(todas, true);
    }
  }

  function refreshSubcatPills() {
    if (!(subcatFilters instanceof HTMLElement)) return;

    if (activeMacroFilter === 'todas') {
      subcatFilters.hidden = true;
      subcatFilters.classList.add('is-empty');
      subcatFilters.innerHTML = '';
      return;
    }

    const names = collectCategoryNames();
    /** @type {string[]} */
    const fromScroll = [];
    for (const pill of categoryFilters?.querySelectorAll('[data-cat-filter]') ?? []) {
      if (!(pill instanceof HTMLElement)) continue;
      const f = String(pill.dataset.catFilter || '').trim();
      if (!f || f === 'todas') continue;
      if (resolveMacroId(f) !== activeMacroFilter) continue;
      if (!fromScroll.includes(f)) fromScroll.push(f);
    }
    const extras = subsForMacro(activeMacroFilter, names).filter((n) => !fromScroll.includes(n));
    const subs = [...fromScroll, ...extras];

    // Una sola sub (ej. Postres → Postres): no hay filtro fino útil
    if (subs.length <= 1) {
      activeCategoryFilter = 'todas';
      subcatFilters.hidden = true;
      subcatFilters.classList.add('is-empty');
      subcatFilters.innerHTML = '';
      return;
    }

    subcatFilters.hidden = false;
    subcatFilters.classList.remove('is-empty');
    subcatFilters.innerHTML = '';

    const todas = document.createElement('button');
    todas.type = 'button';
    todas.dataset.catFilter = 'todas';
    todas.draggable = false;
    todas.textContent = 'Todas';
    setCategoryPillActive(todas, activeCategoryFilter === 'todas');
    subcatFilters.appendChild(todas);

    for (const name of subs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.catFilter = name;
      btn.dataset.categoriaId = resolveCategoriaKey(name);
      btn.draggable = true;
      btn.textContent = name;
      setCategoryPillActive(btn, activeCategoryFilter === name);
      subcatFilters.appendChild(btn);
    }

    if (activeCategoryFilter !== 'todas' && !subs.includes(activeCategoryFilter)) {
      activeCategoryFilter = 'todas';
      setCategoryPillActive(todas, true);
    }
  }

  /** Sync global (hidden) category order after subcat DnD within the active macro. */
  function applySubcatOrderToCategoryScroll() {
    if (!(categoryFilters instanceof HTMLElement) || !(subcatFilters instanceof HTMLElement)) return;
    const macroId = activeMacroFilter;
    if (!macroId || macroId === 'todas') return;

    /** @type {string[]} */
    const newSubOrder = [];
    for (const pill of subcatFilters.querySelectorAll('[data-cat-filter]')) {
      if (!(pill instanceof HTMLElement)) continue;
      const f = String(pill.dataset.catFilter || '').trim();
      if (f && f !== 'todas') newSubOrder.push(f);
    }

    /** @type {Map<string, HTMLElement>} */
    const byName = new Map();
    /** @type {string[]} */
    const prior = [];
    for (const pill of categoryFilters.querySelectorAll('[data-cat-filter]')) {
      if (!(pill instanceof HTMLElement)) continue;
      const f = String(pill.dataset.catFilter || '').trim();
      if (!f || f === 'todas') continue;
      byName.set(f, pill);
      prior.push(f);
    }

    /** @type {Map<string, string[]>} */
    const byMacro = new Map();
    for (const name of prior) {
      const mid = resolveMacroId(name);
      if (!byMacro.has(mid)) byMacro.set(mid, []);
      byMacro.get(mid)?.push(name);
    }
    byMacro.set(macroId, newSubOrder);

    /** @type {string[]} */
    const macroSeq = [];
    for (const name of prior) {
      const mid = resolveMacroId(name);
      if (!macroSeq.includes(mid)) macroSeq.push(mid);
    }
    for (const mid of MACRO_ID_ORDER) {
      if (byMacro.has(mid) && !macroSeq.includes(mid)) macroSeq.push(mid);
    }

    const todas = categoryFilters.querySelector('[data-cat-filter="todas"]');
    categoryFilters.innerHTML = '';
    if (todas instanceof HTMLElement) categoryFilters.appendChild(todas);

    const used = new Set();
    for (const mid of macroSeq) {
      for (const name of byMacro.get(mid) || []) {
        if (used.has(name)) continue;
        used.add(name);
        const pill = byName.get(name);
        if (pill) {
          categoryFilters.appendChild(pill);
          continue;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.catFilter = name;
        btn.dataset.categoriaId = resolveCategoriaKey(name);
        btn.draggable = false;
        btn.textContent = name;
        setCategoryPillActive(btn, activeCategoryFilter === name);
        categoryFilters.appendChild(btn);
      }
    }
  }

  function clearGroupSeparators() {
    if (!(tbody instanceof HTMLElement)) return;
    for (const sep of tbody.querySelectorAll('tr.platos-group-sep')) {
      sep.remove();
    }
  }

  /**
   * Insert elegant subcategory dividers between dish groups.
   * Shown for "Todos" and when a macro is selected (not when a single sub is filtered).
   */
  function rebuildGroupSeparators() {
    if (!(tbody instanceof HTMLElement)) return;
    clearGroupSeparators();

    const showSeps = activeCategoryFilter === 'todas';
    if (!showSeps) return;

    /** @type {string | null} */
    let lastCat = null;
    for (const row of [...tbody.children]) {
      if (!(row instanceof HTMLElement) || !row.matches('tr[data-plato-id]')) continue;
      const cat = String(row.dataset.categoria || '').trim() || 'Sin categoría';
      if (cat === lastCat) continue;
      lastCat = cat;
      const sep = document.createElement('tr');
      sep.className = 'platos-group-sep';
      sep.dataset.groupCategoria = cat;
      sep.setAttribute('aria-hidden', 'true');
      const td = document.createElement('td');
      td.colSpan = PLATOS_COLSPAN;
      const label = document.createElement('span');
      label.className = 'platos-group-sep__label';
      label.textContent = cat;
      td.appendChild(label);
      sep.appendChild(td);
      tbody.insertBefore(sep, row);
    }
    syncGroupSeparatorsVisibility();
  }

  function syncGroupSeparatorsVisibility() {
    if (!(tbody instanceof HTMLElement)) return;
    for (const sep of tbody.querySelectorAll('tr.platos-group-sep')) {
      if (!(sep instanceof HTMLElement)) continue;
      let hasVisible = false;
      let sibling = sep.nextElementSibling;
      while (sibling instanceof HTMLElement) {
        if (sibling.matches('tr.platos-group-sep')) break;
        if (sibling.matches('tr[data-plato-id]') && !sibling.classList.contains('hidden')) {
          hasVisible = true;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
      sep.classList.toggle('hidden', !hasVisible);
    }
  }

  function applySearchFilter() {
    const q = (searchInput instanceof HTMLInputElement ? searchInput.value : '').trim().toLowerCase();
    const macroFilter = String(activeMacroFilter || 'todas').trim().toLowerCase();
    const catFilter = String(activeCategoryFilter || 'todas').trim().toLowerCase();
    const statusFilter = String(activeStatusFilter || 'todas').trim().toLowerCase();
    const rows = allRows();
    let visible = 0;
    for (const row of rows) {
      if (!(row instanceof HTMLElement)) continue;
      const rowCat = String(row.dataset.categoria || '').trim();
      const rowCatKey = rowCat.toLowerCase();
      const rowMacro = resolveMacroId(rowCat);
      const disponible = row.dataset.disponible === 'true';
      const destacado = row.dataset.destacado === 'true';
      const macroMatch = macroFilter === 'todas' || rowMacro === macroFilter;
      const catMatch = catFilter === 'todas' || rowCatKey === catFilter;
      const textMatch = !q || (row.dataset.search || '').includes(q);
      let statusMatch = true;
      if (statusFilter === 'disponibles') statusMatch = disponible;
      else if (statusFilter === 'agotados') statusMatch = !disponible;
      else if (statusFilter === 'destacados') statusMatch = destacado;
      const match = macroMatch && catMatch && textMatch && statusMatch;
      row.classList.toggle('hidden', !match);
      if (match) visible += 1;
    }
    const filtered =
      Boolean(q) ||
      macroFilter !== 'todas' ||
      catFilter !== 'todas' ||
      statusFilter !== 'todas';
    if (searchMeta) {
      searchMeta.textContent = filtered
        ? `${visible} de ${rows.length}`
        : `${rows.length} visibles`;
    }
    const hasRows = rows.length > 0;
    noResults?.classList.toggle('hidden', !(hasRows && visible === 0));
    tableWrap?.classList.toggle('hidden', !hasRows || visible === 0);
    syncGroupSeparatorsVisibility();
  }

  /**
   * Reorder dish rows to match category hierarchy (macro blocks → sub order).
   */
  function sincronizarVistaTodas() {
    if (!(tbody instanceof HTMLElement) || !(categoryFilters instanceof HTMLElement)) return;

    /** @type {string[]} */
    const order = [];
    /** @type {Map<string, number>} */
    const orderIndex = new Map();

    for (const pill of categoryFilters.querySelectorAll('[data-cat-filter]')) {
      if (!(pill instanceof HTMLElement)) continue;
      const filter = String(pill.dataset.catFilter || '').trim();
      if (!filter || filter === 'todas') continue;
      const key = String(pill.dataset.categoriaId || filter).trim();
      if (!key || order.includes(key)) continue;
      const idx = order.length;
      order.push(key);
      orderIndex.set(key.toLowerCase(), idx);
      orderIndex.set(filter.toLowerCase(), idx);
    }
    if (order.length === 0) {
      rebuildGroupSeparators();
      return;
    }

    const rows = allRows().filter((r) => r instanceof HTMLElement);
    if (rows.length === 0) {
      clearGroupSeparators();
      return;
    }

    const sorted = [...rows].sort((a, b) => {
      const aId = String(a.dataset.categoriaId || '').trim().toLowerCase();
      const bId = String(b.dataset.categoriaId || '').trim().toLowerCase();
      const aName = String(a.dataset.categoria || '').trim().toLowerCase();
      const bName = String(b.dataset.categoria || '').trim().toLowerCase();
      const aIdx =
        (aId && orderIndex.has(aId) ? orderIndex.get(aId) : undefined) ??
        (aName && orderIndex.has(aName) ? orderIndex.get(aName) : undefined) ??
        Number.MAX_SAFE_INTEGER;
      const bIdx =
        (bId && orderIndex.has(bId) ? orderIndex.get(bId) : undefined) ??
        (bName && orderIndex.has(bName) ? orderIndex.get(bName) : undefined) ??
        Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });

    clearGroupSeparators();
    for (const row of sorted) {
      tbody.appendChild(row);
    }
    renumberDishOrderInputs();
    rebuildGroupSeparators();
  }

  searchInput?.addEventListener('input', applySearchFilter, { signal });

  statusFilters?.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !(statusFilters instanceof HTMLElement)) return;
      const btn = target.closest('[data-status-filter]');
      if (!(btn instanceof HTMLElement) || !statusFilters.contains(btn)) return;
      const next = String(btn.dataset.statusFilter || 'todas').trim().toLowerCase() || 'todas';
      activeStatusFilter = next;
      for (const pill of statusFilters.querySelectorAll('[data-status-filter]')) {
        if (!(pill instanceof HTMLElement)) continue;
        const on = String(pill.dataset.statusFilter || '').trim().toLowerCase() === next;
        setStatusPillActive(pill, on);
      }
      applySearchFilter();
    },
    { signal },
  );

  macroFilters?.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !(macroFilters instanceof HTMLElement)) return;
      const btn = target.closest('[data-macro-filter]');
      if (!(btn instanceof HTMLElement) || !macroFilters.contains(btn)) return;
      const next = String(btn.dataset.macroFilter || 'todas').trim() || 'todas';
      activeMacroFilter = next;
      activeCategoryFilter = 'todas';
      for (const pill of macroFilters.querySelectorAll('[data-macro-filter]')) {
        if (!(pill instanceof HTMLElement)) continue;
        setMacroPillActive(pill, String(pill.dataset.macroFilter || '') === next);
      }
      refreshSubcatPills();
      rebuildGroupSeparators();
      applySearchFilter();
    },
    { signal },
  );

  /** @type {HTMLElement | null} */
  let draggedCategoryPill = null;
  /** Skip filter click after a successful category drag reorder. */
  let skipNextCategoryClick = false;

  function clearCategoryDragState() {
    if (!(subcatFilters instanceof HTMLElement)) return;
    for (const pill of subcatFilters.querySelectorAll('.cat-filter-pill')) {
      if (!(pill instanceof HTMLElement)) continue;
      pill.classList.remove('is-dragging', 'drag-over');
    }
  }

  subcatFilters?.addEventListener(
    'dragstart',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !(subcatFilters instanceof HTMLElement)) return;
      const pill = target.closest('[data-cat-filter]');
      if (!(pill instanceof HTMLElement) || !subcatFilters.contains(pill)) return;
      const filter = String(pill.dataset.catFilter || '');
      if (!filter || filter === 'todas' || pill.draggable === false) {
        event.preventDefault();
        return;
      }
      draggedCategoryPill = pill;
      skipNextCategoryClick = false;
      pill.classList.add('is-dragging');
      try {
        event.dataTransfer?.setData('text/plain', filter);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      } catch {
        /* ignore */
      }
    },
    { signal },
  );

  subcatFilters?.addEventListener(
    'dragover',
    (event) => {
      if (!(draggedCategoryPill instanceof HTMLElement)) return;
      if (!(subcatFilters instanceof HTMLElement)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const over = target.closest('[data-cat-filter]');
      if (!(over instanceof HTMLElement) || !subcatFilters.contains(over)) return;
      const overFilter = String(over.dataset.catFilter || '');
      if (!overFilter || overFilter === 'todas' || over === draggedCategoryPill) return;
      event.preventDefault();
      try {
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      } catch {
        /* ignore */
      }
      for (const pill of subcatFilters.querySelectorAll('.cat-filter-pill.drag-over')) {
        if (pill instanceof HTMLElement && pill !== over) pill.classList.remove('drag-over');
      }
      over.classList.add('drag-over');
    },
    { signal },
  );

  subcatFilters?.addEventListener(
    'dragleave',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const pill = target.closest('[data-cat-filter]');
      if (pill instanceof HTMLElement) pill.classList.remove('drag-over');
    },
    { signal },
  );

  subcatFilters?.addEventListener(
    'drop',
    (event) => {
      event.preventDefault();
      if (!(draggedCategoryPill instanceof HTMLElement)) return;
      if (!(subcatFilters instanceof HTMLElement)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const dropPill = target.closest('[data-cat-filter]');
      if (!(dropPill instanceof HTMLElement) || !subcatFilters.contains(dropPill)) return;
      const dropFilter = String(dropPill.dataset.catFilter || '');
      if (!dropFilter || dropFilter === 'todas' || dropPill === draggedCategoryPill) {
        clearCategoryDragState();
        return;
      }

      const rect = dropPill.getBoundingClientRect();
      const before = event.clientX < rect.left + rect.width / 2;
      if (before) {
        subcatFilters.insertBefore(draggedCategoryPill, dropPill);
      } else {
        subcatFilters.insertBefore(draggedCategoryPill, dropPill.nextSibling);
      }
      skipNextCategoryClick = true;
      clearCategoryDragState();
      applySubcatOrderToCategoryScroll();
      sincronizarVistaTodas();
      void guardarOrdenMenu('categorias');
    },
    { signal },
  );

  subcatFilters?.addEventListener(
    'dragend',
    () => {
      clearCategoryDragState();
      draggedCategoryPill = null;
    },
    { signal },
  );

  subcatFilters?.addEventListener(
    'click',
    (event) => {
      if (skipNextCategoryClick) {
        skipNextCategoryClick = false;
        event.preventDefault();
        return;
      }
      const target = event.target;
      if (!(target instanceof Element) || !(subcatFilters instanceof HTMLElement)) return;
      const btn = target.closest('[data-cat-filter]');
      if (!(btn instanceof HTMLElement) || !subcatFilters.contains(btn)) return;
      const next = String(btn.dataset.catFilter || 'todas');
      activeCategoryFilter = next;
      for (const pill of subcatFilters.querySelectorAll('[data-cat-filter]')) {
        if (!(pill instanceof HTMLElement)) continue;
        setCategoryPillActive(pill, pill.dataset.catFilter === next);
      }
      rebuildGroupSeparators();
      applySearchFilter();
    },
    { signal },
  );

  // Initial hierarchy: sync host + grouped list
  refreshCategoryPills();
  sincronizarVistaTodas();
  applySearchFilter();

  tbody?.addEventListener(
    'change',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.matches('[data-dish-order]')) return;
      if (!(tbody instanceof HTMLElement)) return;

      const row = target.closest('tr[data-plato-id]');
      if (!(row instanceof HTMLTableRowElement) || !tbody.contains(row)) return;

      const categoryRows = rowsInSameCategory(row);
      const count = categoryRows.length;
      if (count === 0) return;

      let desired = Number.parseInt(target.value, 10);
      if (!Number.isFinite(desired)) {
        renumberDishOrderInputs();
        return;
      }
      desired = Math.min(count, Math.max(1, desired));
      target.value = String(desired);

      const currentIndex = categoryRows.indexOf(row);
      const targetIndex = desired - 1;
      if (currentIndex < 0 || currentIndex === targetIndex) {
        renumberDishOrderInputs();
        return;
      }

      // Optimistic DOM reorder within the same category group
      const ref = categoryRows[targetIndex];
      if (!(ref instanceof HTMLTableRowElement)) {
        renumberDishOrderInputs();
        return;
      }
      if (currentIndex < targetIndex) {
        tbody.insertBefore(row, ref.nextSibling);
      } else {
        tbody.insertBefore(row, ref);
      }

      renumberDishOrderInputs();

      /** @type {Array<{ id: number, orden: number }>} */
      const platoItems = [];
      for (const r of rowsInSameCategory(row)) {
        if (!(r instanceof HTMLElement)) continue;
        const id = Number(r.dataset.platoId || '');
        if (!Number.isFinite(id) || id <= 0) continue;
        const input = r.querySelector('[data-dish-order]');
        const orden =
          input instanceof HTMLInputElement
            ? Number.parseInt(input.value, 10)
            : NaN;
        if (!Number.isFinite(orden) || orden < 0) continue;
        platoItems.push({ id, orden });
      }
      void guardarOrdenMenu('platos', platoItems);
    },
    { signal },
  );

  function collectHorarioSemana(week) {
    /** @type {Record<string, { closed: boolean, open: string, close: string }>} */
    const days = {};
    const root = week instanceof HTMLElement ? week : document.querySelector('[data-hours-week]');
    if (!(root instanceof HTMLElement)) return days;
    root.querySelectorAll('[data-day]').forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      const id = row.dataset.day || '';
      const open = row.querySelector('[data-hours-open]');
      const close = row.querySelector('[data-hours-close]');
      days[id] = {
        closed: row.dataset.closed === 'true',
        open: open instanceof HTMLInputElement ? open.value || '12:00' : '12:00',
        close: close instanceof HTMLInputElement ? close.value || '22:00' : '22:00',
      };
    });
    return days;
  }

  function weekRoot(scope) {
    return document.querySelector(`[data-hours-week="${scope}"]`) ||
      document.querySelector('[data-hours-week]');
  }

  function localOps(scope) {
    const scoped = document.querySelector(`[data-local-ops="${scope}"]`);
    if (scoped) return scoped;
    if (scope === 'perfil') {
      return document.querySelector('#ops-contacto-card[data-ops-contacto], #ops-contacto-card');
    }
    return null;
  }

  function syncHorarioHidden(scope) {
    const week = scope ? weekRoot(scope) : document.querySelector('[data-hours-week="perfil"]') || document.querySelector('[data-hours-week]');
    if (!(week instanceof HTMLElement)) return;
    const days = collectHorarioSemana(week);
    const serialized = serializeHorarioSemana(days);
    const box =
      week.closest('[data-local-ops]') ||
      week.closest('.perfil-group') ||
      week.closest('#ops-contacto-card');
    const hidden =
      box?.querySelector('[data-horario-hidden]') ||
      document.getElementById('ops-horario');
    if (hidden instanceof HTMLInputElement) hidden.value = serialized;
    if (box?.getAttribute('data-local-ops') === 'perfil' || !scope || scope === 'perfil') {
      const badge = document.getElementById('ops-open-badge');
      if (badge) {
        const preview = previewHorarioHoy(days);
        badge.textContent = preview.text;
        badge.classList.toggle('is-open', preview.open);
        badge.classList.toggle('is-closed', !preview.open);
      }
    }
  }

  function setDayClosed(row, closed) {
    if (!(row instanceof HTMLElement)) return;
    row.dataset.closed = closed ? 'true' : 'false';
    row.querySelectorAll('[data-hours-toggle]').forEach((toggle) => {
      if (!(toggle instanceof HTMLElement)) return;
      toggle.setAttribute('aria-checked', String(!closed));
      toggle.classList.toggle('is-on', !closed);
      toggle.classList.toggle('bg-zinc-900', !closed);
      toggle.classList.toggle('dark:bg-white', !closed);
      toggle.title = closed ? 'Cerrado' : 'Abierto';
    });
    row.querySelectorAll('[data-hours-open], [data-hours-close]').forEach((el) => {
      if (el instanceof HTMLInputElement) el.disabled = closed;
    });
  }

  function copyHoursWeek(fromScope, toScope) {
    const from = weekRoot(fromScope);
    const to = weekRoot(toScope);
    if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement) || from === to) return;
    const days = collectHorarioSemana(from);
    to.querySelectorAll('[data-day]').forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      const d = days[row.dataset.day || ''];
      if (!d) return;
      setDayClosed(row, Boolean(d.closed));
      const open = row.querySelector('[data-hours-open]');
      const close = row.querySelector('[data-hours-close]');
      if (open instanceof HTMLInputElement) open.value = d.open;
      if (close instanceof HTMLInputElement) close.value = d.close;
    });
    syncHorarioHidden(toScope);
  }

  function copySocials(fromScope, toScope) {
    const from = localOps(fromScope);
    const to = localOps(toScope);
    if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement) || from === to) return;
    from.querySelectorAll('[data-social]').forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      const id = row.dataset.social || '';
      const dest = to.querySelector(`[data-social="${id}"]`);
      if (!(dest instanceof HTMLElement)) return;
      setSocialOn(dest, row.dataset.on === 'true');
      const srcInput = row.querySelector('input, textarea');
      const destInput = dest.querySelector('input, textarea');
      if (
        (srcInput instanceof HTMLInputElement || srcInput instanceof HTMLTextAreaElement) &&
        (destInput instanceof HTMLInputElement || destInput instanceof HTMLTextAreaElement)
      ) {
        destInput.value = srcInput.value;
      }
    });
  }

  function copyMaps(fromScope, toScope) {
    const from = localOps(fromScope);
    const to = localOps(toScope);
    if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement) || from === to) return;
    const src = from.querySelector('[data-maps-url]');
    const dest = to.querySelector('[data-maps-url]');
    if (
      (src instanceof HTMLInputElement || src instanceof HTMLTextAreaElement) &&
      (dest instanceof HTMLInputElement || dest instanceof HTMLTextAreaElement)
    ) {
      dest.value = src.value;
      refreshMapsPreview(to.querySelector('[data-maps-preview]'));
    }
  }

  function copyDireccion(fromScope, toScope) {
    const from = localOps(fromScope);
    const to = localOps(toScope);
    if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement) || from === to) return;
    const src = from.querySelector('[data-direccion-input]');
    const dest = to.querySelector('[data-direccion-input]');
    if (
      (src instanceof HTMLInputElement || src instanceof HTMLTextAreaElement) &&
      (dest instanceof HTMLInputElement || dest instanceof HTMLTextAreaElement)
    ) {
      dest.value = src.value;
    }
  }

  function syncLocalOps(fromScope) {
    const other = fromScope === 'perfil' ? 'marca' : 'perfil';
    if (!localOps(other)) return;
    copyHoursWeek(fromScope, other);
    copySocials(fromScope, other);
    copyMaps(fromScope, other);
    copyDireccion(fromScope, other);
  }

  /**
   * Identidad (marca) es fuente de verdad al editar ahí.
   * No disparar Ops autosave con snapshot de perfil (pisa cambios de Identidad).
   */
  function persistLocalOpsChange(scope) {
    const s = scope === 'marca' ? 'marca' : 'perfil';
    syncLocalOps(s);
    if (s === 'marca') {
      setMarcaSaveState('dirty');
      scheduleMarcaAutosave();
      return;
    }
    autoSaveOperacion();
  }

  document.querySelectorAll('[data-hours-week]').forEach((week) => {
    week.addEventListener(
      'click',
      (event) => {
        const btn = event.target instanceof Element ? event.target.closest('[data-hours-toggle]') : null;
        if (!btn) return;
        if (btn instanceof HTMLElement && btn.dataset.toggleBound === '1') return;
        const row = btn.closest('[data-day]');
        if (!(row instanceof HTMLElement)) return;
        setDayClosed(row, row.dataset.closed !== 'true');
        const scope = week.getAttribute('data-hours-week') || 'perfil';
        syncHorarioHidden(scope);
        persistLocalOpsChange(scope);
      },
      { signal },
    );
    week.addEventListener(
      'change',
      () => {
        const scope = week.getAttribute('data-hours-week') || '';
        syncHorarioHidden(scope);
        if (scope === 'marca' || scope === 'perfil') {
          persistLocalOpsChange(scope);
        }
      },
      { signal },
    );
  });

  function fieldValue(el) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value.trim();
    }
    return '';
  }

  function socialField(scope, id) {
    const root = localOps(scope);
    if (!(root instanceof HTMLElement)) return '';
    const row = root.querySelector(`[data-social="${id}"]`);
    if (!(row instanceof HTMLElement)) return '';
    const input = row.querySelector('input, textarea');
    return fieldValue(input);
  }

  function socialOn(id, scope = 'perfil') {
    const root = localOps(scope) || document;
    const row = root.querySelector(`[data-social="${id}"]`);
    return row instanceof HTMLElement && row.dataset.on === 'true';
  }

  function setSocialOn(row, on) {
    if (!(row instanceof HTMLElement)) return;
    row.dataset.on = on ? 'true' : 'false';
    const toggle = row.querySelector('[data-social-toggle]');
    if (toggle instanceof HTMLElement) {
      toggle.setAttribute('aria-checked', String(on));
      toggle.classList.toggle('is-on', on);
      toggle.title = on ? 'Visible en la WebApp' : 'Oculta en la WebApp';
    }
    const input = row.querySelector('[data-social-input], input:not([type="hidden"])');
    if (input instanceof HTMLInputElement) {
      input.disabled = !on;
      input.hidden = !on;
    }
  }

  document.addEventListener(
    'click',
    (event) => {
      const t = event.target;
      if (!(t instanceof Element)) return;
      const btn = t.closest('[data-social-toggle]');
      if (!btn) return;
      // Prefer card-local binders (data-toggle-bound); skip to avoid double toggle.
      if (btn instanceof HTMLElement && btn.dataset.toggleBound === '1') return;
      if (!t.closest('[data-local-ops], #ops-contacto-card')) return;
      const row = btn.closest('[data-social]');
      if (!(row instanceof HTMLElement)) return;
      event.preventDefault();
      setSocialOn(row, row.dataset.on !== 'true');
      const scopeRoot = t.closest('[data-local-ops]');
      const scope =
        scopeRoot instanceof HTMLElement ? scopeRoot.getAttribute('data-local-ops') || 'perfil' : 'perfil';
      persistLocalOpsChange(scope);
    },
    { signal },
  );

  document.addEventListener(
    'ops-social-change',
    (event) => {
      const t = event.target;
      const scopeRoot =
        t instanceof Element ? t.closest('[data-local-ops]') : null;
      const scope =
        scopeRoot instanceof HTMLElement
          ? scopeRoot.getAttribute('data-local-ops') || 'perfil'
          : 'perfil';
      persistLocalOpsChange(scope);
    },
    { signal },
  );

  document.addEventListener(
    'ops-hours-change',
    (event) => {
      const t = event.target;
      let scope = 'perfil';
      if (t instanceof Element) {
        const week = t.closest('[data-hours-week]') || t.querySelector?.('[data-hours-week]');
        scope =
          week instanceof HTMLElement ? week.getAttribute('data-hours-week') || 'perfil' : 'perfil';
        syncHorarioHidden(scope);
      }
      persistLocalOpsChange(scope);
    },
    { signal },
  );

  function refreshMapsPreview(preview) {
    const box = preview instanceof HTMLElement
      ? preview
      : document.querySelector('[data-maps-preview]');
    if (!(box instanceof HTMLElement)) return;
    const input = box.querySelector('[data-maps-url]');
    const url =
      input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement
        ? input.value.trim()
        : '';
    const embed = googleMapsEmbedSrc(url);
    const open = mapsOpenHref(url);
    const frame = box.querySelector('.perfil-map__frame');
    const hit = box.querySelector('[data-map-open]');
    if (!(frame instanceof HTMLElement)) return;
    let iframe = box.querySelector('[data-map-embed]');
    let empty = box.querySelector('[data-map-empty]');
    if (embed) {
      if (!(iframe instanceof HTMLIFrameElement)) {
        empty?.remove();
        iframe = document.createElement('iframe');
        iframe.setAttribute('data-map-embed', '');
        iframe.title = 'Mapa del restaurante';
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'no-referrer-when-downgrade';
        iframe.allowFullscreen = true;
        iframe.className = 'h-full w-full border-0';
        frame.prepend(iframe);
      }
      iframe.src = embed;
    } else if (!empty) {
      iframe?.remove();
      empty = document.createElement('span');
      empty.className = 'perfil-map__empty';
      empty.setAttribute('data-map-empty', '');
      empty.textContent = 'Pegá el enlace o el iframe de Google Maps';
      frame.prepend(empty);
    }
    if (hit instanceof HTMLAnchorElement) {
      hit.href = open || '#';
      hit.hidden = !open;
    }
  }

  document.querySelectorAll('[data-maps-url]').forEach((input) => {
    const preview = input.closest('[data-maps-preview]');
    input.addEventListener('change', () => refreshMapsPreview(preview), { signal });
    input.addEventListener(
      'input',
      () => {
        window.clearTimeout(/** @type {any} */ (input)._mapsTimer);
        /** @type {any} */ (input)._mapsTimer = window.setTimeout(
          () => refreshMapsPreview(preview),
          450,
        );
      },
      { signal },
    );
  });

  document.querySelectorAll('[data-maps-preview]').forEach((preview) => {
    if (!(preview instanceof HTMLElement)) return;
    const panel = preview.querySelector('[data-maps-url-panel]');
    const urlInput = preview.querySelector('[data-maps-url]');
    const setOpen = (open) => {
      if (!(panel instanceof HTMLElement)) return;
      panel.hidden = !open;
      if (open && (urlInput instanceof HTMLTextAreaElement || urlInput instanceof HTMLInputElement)) {
        urlInput.focus();
      }
    };
    preview.querySelector('[data-maps-url-toggle]')?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        const open = !(panel instanceof HTMLElement) || panel.hidden;
        setOpen(open);
      },
      { signal },
    );
    preview.querySelector('[data-maps-url-done]')?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        refreshMapsPreview(preview);
        setOpen(false);
      },
      { signal },
    );
  });

  /**
   * @param {HTMLElement | null | undefined} root
   */
  function readPopupPayload(root) {
    if (!(root instanceof HTMLElement)) {
      return {
        popup_enabled: false,
        popup_image_url: '',
        popup_duration_preset: 'indefinite',
        popup_expires_at: '',
      };
    }
    const enabledHidden = root.querySelector('[data-popup-enabled]');
    const enabledToggle = root.querySelector('[data-popup-enabled-toggle]');
    const enabled =
      enabledHidden instanceof HTMLInputElement
        ? enabledHidden.value === 'true'
        : enabledToggle instanceof HTMLElement && enabledToggle.classList.contains('is-on');
    const imageEl = root.querySelector('[data-popup-image-url]');
    const presetEl = root.querySelector('[data-popup-duration-preset]');
    const expiresEl = root.querySelector('[data-popup-expires-at]');
    return {
      popup_enabled: enabled,
      popup_image_url:
        imageEl instanceof HTMLInputElement ? imageEl.value.trim() : '',
      popup_duration_preset:
        presetEl instanceof HTMLInputElement
          ? presetEl.value.trim() || 'indefinite'
          : 'indefinite',
      popup_expires_at:
        expiresEl instanceof HTMLInputElement ? expiresEl.value.trim() : '',
    };
  }

  /**
   * @param {HTMLElement} root
   */
  function syncWelcomePopupUi(root) {
    const body = root.querySelector('[data-popup-body]');
    const empty = root.querySelector('[data-popup-empty]');
    const enabledHidden = root.querySelector('[data-popup-enabled]');
    const enabled =
      enabledHidden instanceof HTMLInputElement && enabledHidden.value === 'true';
    if (body instanceof HTMLElement) body.hidden = !enabled;
    if (empty instanceof HTMLElement) empty.hidden = enabled;
    root.dataset.popupEnabledState = enabled ? 'true' : 'false';
  }

  /**
   * @param {{ silent?: boolean }} [opts]
   */
  async function saveOpsContacto(opts = {}) {
    const silent = Boolean(opts.silent);
    if (!requireRestauranteId()) return false;
    if (opsSaveBusy) {
      opsNeedsResave = true;
      return false;
    }
    opsSaveBusy = true;
    const payload = recolectarDatosOperacion();
    const horario = payload.horario;
    const instagramUrl = payload.instagram_url;
    const facebookUrl = payload.facebook_url;
    const tiktokUrl = payload.tiktok_url;
    const tripadvisorUrl = payload.tripadvisor_url;
    const whatsappUrl = payload.whatsapp_url;
    const coordenadasMaps = payload.coordenadas_maps;
    const direccion = payload.direccion;

    if (opsContactoStatus) {
      opsContactoStatus.textContent = silent ? 'Guardando…' : '';
      opsContactoStatus.className = 'perfil-studio__hint sr-only';
    }

    try {
      const res = await fetch('/api/update-operativo-contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar el perfil');

      const saved = json.restaurante || {};
      if (opsHorarioInput instanceof HTMLInputElement) {
        opsHorarioInput.value = saved.horarios || horario;
      }
      if (opsInstagramInput instanceof HTMLInputElement) {
        opsInstagramInput.value = saved.instagram_url || instagramUrl;
      }
      if (opsFacebookInput instanceof HTMLInputElement) {
        opsFacebookInput.value = saved.facebook_url || facebookUrl;
      }
      if (opsTiktokInput instanceof HTMLInputElement) {
        opsTiktokInput.value = saved.tiktok_url || tiktokUrl;
      }
      if (opsTripadvisorInput instanceof HTMLInputElement) {
        opsTripadvisorInput.value = saved.tripadvisor_url || tripadvisorUrl;
      }
      if (opsWhatsappInput instanceof HTMLInputElement) {
        opsWhatsappInput.value = saved.whatsapp_url || whatsappUrl;
      }
      if (opsMapsInput instanceof HTMLInputElement || opsMapsInput instanceof HTMLTextAreaElement) {
        opsMapsInput.value = saved.coordenadas_maps || coordenadasMaps;
      }
      if (opsDireccionInput instanceof HTMLInputElement && saved.direccion != null) {
        opsDireccionInput.value = saved.direccion || direccion;
      }
      const applyActivo = (id, flag) => {
        const row = localOps('perfil')?.querySelector(`[data-social="${id}"]`);
        if (row instanceof HTMLElement && typeof flag === 'boolean') {
          setSocialOn(row, flag);
        }
      };
      applyActivo('instagram', saved.instagram_activo);
      applyActivo('facebook', saved.facebook_activo);
      applyActivo('tiktok', saved.tiktok_activo);
      applyActivo('tripadvisor', saved.tripadvisor_activo);
      applyActivo('whatsapp', saved.whatsapp_activo);
      refreshMapsPreview(localOps('perfil')?.querySelector('[data-maps-preview]'));
      syncLocalOps('perfil');
      if (opsContactoStatus) {
        opsContactoStatus.textContent = 'Guardado';
      }
      if (silent) {
        mostrarToastFlotante('Cambios guardados');
      } else if (typeof showToast === 'function') {
        showToast('Perfil del restaurante guardado', 'ok');
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      if (opsContactoStatus) {
        opsContactoStatus.textContent = msg;
      }
      console.error('Error al autoguardar:', err);
      if (typeof showToast === 'function') showToast(msg, 'error');
      else if (!silent) alert(msg);
      return false;
    } finally {
      opsSaveBusy = false;
      if (opsNeedsResave) {
        opsNeedsResave = false;
        autoSaveOperacion();
      }
    }
  }

  /**
   * @param {HTMLElement} root
   */
  function initWelcomePopupAdmin(root) {
    const drop = root.querySelector('[data-popup-drop]');
    const fileInput = root.querySelector('[data-popup-file]');
    const changeBtn = root.querySelector('[data-popup-change]');
    const removeBtn = root.querySelector('[data-popup-remove]');
    const imageHidden = root.querySelector('[data-popup-image-url]');

    // Toggle/schedule owned by WelcomePopupCard; persist via auto-save.
    root.addEventListener(
      'ops-popup-change',
      () => {
        syncWelcomePopupUi(root);
      },
      { signal },
    );

    async function uploadPopupImage(file) {
      const bodyFd = new FormData();
      bodyFd.append('file', file);
      bodyFd.append('restaurante_slug', restauranteSlug);
      bodyFd.append('asset_type', 'identity');
      if (restauranteId) bodyFd.append('restaurante_id', restauranteId);
      const res = await fetch('/api/upload', { method: 'POST', body: bodyFd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        throw new Error(json.error || 'No se pudo subir la imagen');
      }
      return String(json.url);
    }

    function applyPopupImage(url) {
      if (imageHidden instanceof HTMLInputElement) imageHidden.value = url;
      if (!(drop instanceof HTMLElement)) return;
      const has = Boolean(url);
      drop.dataset.popupHasImage = has ? 'true' : 'false';
      drop.classList.toggle('has-image', has);
      drop.classList.toggle('border-solid', has);
      drop.classList.toggle('border-dashed', !has);
      drop.classList.toggle('border', has);
      drop.classList.toggle('border-2', !has);
      drop.classList.toggle('border-zinc-200', has);
      drop.classList.toggle('border-zinc-300', !has);
      drop.classList.toggle('bg-zinc-100', has);
      drop.classList.toggle('bg-zinc-50', !has);
      drop.classList.toggle('shadow-sm', has);
      drop.classList.toggle('p-6', !has);

      let img = drop.querySelector('[data-popup-preview-img]');
      drop.querySelector('[data-popup-drop-empty]')?.remove();
      if (url) {
        if (!(img instanceof HTMLImageElement)) {
          img = document.createElement('img');
          img.className = 'absolute inset-0 h-full w-full object-cover';
          img.setAttribute('data-popup-preview-img', '');
          img.alt = 'Flyer promocional';
          drop.prepend(img);
        }
        img.src = url;
      } else {
        img?.remove();
        const empty = document.createElement('div');
        empty.className = 'flex flex-col items-center justify-center';
        empty.setAttribute('data-popup-drop-empty', '');
        empty.innerHTML = `
          <div class="mb-3 rounded-full bg-white p-3 text-zinc-600 shadow-sm transition-transform group-hover:scale-105">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 16V6"></path>
              <path d="m8 10 4-4 4 4"></path>
              <path d="M4 18h16"></path>
            </svg>
          </div>
          <span class="text-xs font-semibold text-zinc-800">Haz clic o arrastra tu flyer</span>
          <span class="mt-1 text-[11px] text-zinc-400">Formato vertical (PNG, JPG o WebP)</span>
        `;
        const actions = drop.querySelector('.welcome-popup-admin__drop-actions');
        if (actions) drop.insertBefore(empty, actions);
        else drop.appendChild(empty);
      }

      const actions = drop.querySelector('.welcome-popup-admin__drop-actions');
      if (actions instanceof HTMLElement) {
        actions.className = has
          ? 'welcome-popup-admin__drop-actions absolute inset-x-0 bottom-0 z-[2] flex flex-wrap items-center justify-center gap-2 p-3 bg-gradient-to-t from-black/55 via-black/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'
          : 'welcome-popup-admin__drop-actions relative mt-0 bg-transparent opacity-0 pointer-events-none flex flex-wrap items-center justify-center gap-2';
      }
      if (changeBtn instanceof HTMLElement) {
        changeBtn.textContent = has ? 'Cambiar imagen' : 'Subir flyer';
      }
      if (removeBtn instanceof HTMLElement) {
        removeBtn.hidden = !has;
      }
    }

    async function handlePopupFiles(files) {
      const file = files?.[0];
      if (!file || !/^image\//i.test(file.type)) return;
      try {
        if (changeBtn instanceof HTMLElement) changeBtn.textContent = 'Subiendo…';
        const url = await uploadPopupImage(file);
        applyPopupImage(url);
        root.dispatchEvent(new CustomEvent('ops-popup-change', { bubbles: true }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo subir';
        if (typeof showToast === 'function') showToast(msg, 'error');
      } finally {
        if (changeBtn instanceof HTMLElement) {
          changeBtn.textContent =
            imageHidden instanceof HTMLInputElement && imageHidden.value
              ? 'Cambiar imagen'
              : 'Subir flyer';
        }
      }
    }

    changeBtn?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (fileInput instanceof HTMLInputElement) fileInput.click();
      },
      { signal },
    );
    removeBtn?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyPopupImage('');
        root.dispatchEvent(new CustomEvent('ops-popup-change', { bubbles: true }));
      },
      { signal },
    );
    drop?.addEventListener(
      'click',
      (e) => {
        if (e.target instanceof HTMLElement && e.target.closest('[data-popup-change], [data-popup-remove]')) {
          return;
        }
        if (fileInput instanceof HTMLInputElement) fileInput.click();
      },
      { signal },
    );
    fileInput?.addEventListener(
      'change',
      () => {
        if (fileInput instanceof HTMLInputElement) {
          void handlePopupFiles(fileInput.files);
          fileInput.value = '';
        }
      },
      { signal },
    );

    if (drop instanceof HTMLElement) {
      ['dragenter', 'dragover'].forEach((type) => {
        drop.addEventListener(
          type,
          (e) => {
            e.preventDefault();
            drop.classList.add('is-dragover');
          },
          { signal },
        );
      });
      ['dragleave', 'drop'].forEach((type) => {
        drop.addEventListener(
          type,
          (e) => {
            e.preventDefault();
            drop.classList.remove('is-dragover');
            if (type === 'drop' && e instanceof DragEvent) {
              void handlePopupFiles(e.dataTransfer?.files);
            }
          },
          { signal },
        );
      });
    }

    syncWelcomePopupUi(root);
  }

  if (welcomePopupRoot instanceof HTMLElement) {
    initWelcomePopupAdmin(welcomePopupRoot);
  }

  document.querySelector('#panel-perfil')?.addEventListener(
    'click',
    async (event) => {
      const btn = event.target instanceof Element ? event.target.closest('[data-copy]') : null;
      if (!(btn instanceof HTMLElement)) return;
      let text = btn.dataset.copy || '';
      if (btn.hasAttribute('data-copy-abs') && text.startsWith('/')) {
        text = `${window.location.origin}${text}`;
      }
      try {
        await navigator.clipboard.writeText(text);
        const prev = btn.textContent;
        btn.textContent = 'Copiado';
        window.setTimeout(() => {
          btn.textContent = prev;
        }, 1400);
      } catch {
        if (typeof showToast === 'function') showToast('No se pudo copiar', 'error');
      }
    },
    { signal },
  );

  opsContactoCard?.addEventListener('input', autoSaveOperacion, { signal });
  opsContactoCard?.addEventListener('change', autoSaveOperacion, { signal });
  opsContactoCard?.addEventListener(
    'ops-popup-change',
    () => {
      autoSaveOperacion();
    },
    { signal },
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState !== 'hidden') return;
      if (opsAutoSaveTimer) {
        clearTimeout(opsAutoSaveTimer);
        opsAutoSaveTimer = null;
        void saveOpsContacto({ silent: true });
      }
    },
    { signal },
  );

  // Operación & Anuncios: auto-save silencioso (igual que Menú).
  document.querySelector('#ops-contacto-card')?.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
    },
    { signal },
  );

  /**
   * @param {File} file
   * @param {'identity' | 'categories' | 'dishes'} [assetType]
   */
  async function uploadHubMedia(file, assetType = 'identity') {
    const body = new FormData();
    body.append('file', file);
    body.append('restaurante_slug', restauranteSlug);
    body.append('asset_type', assetType);
    if (restauranteId) body.append('restaurante_id', restauranteId);
    const res = await fetch('/api/upload', { method: 'POST', body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) {
      throw new Error(json.error || 'No se pudo subir la imagen');
    }
    return String(json.url);
  }

  /**
   * @param {HTMLInputElement | null} fileInput
   * @param {HTMLInputElement | null} hiddenInput
   * @param {HTMLElement | null} preview
   * @param {'logo' | 'cover'} kind
   */
  function bindHubUpload(fileInput, hiddenInput, preview, kind) {
    if (!(fileInput instanceof HTMLInputElement)) return;
    fileInput.addEventListener(
      'change',
      () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;

        /**
         * @param {File} ready
         */
        async function runUpload(ready) {
          try {
            const url = await uploadHubMedia(ready, 'identity');
            if (hiddenInput instanceof HTMLInputElement) hiddenInput.value = url;
            if (preview) {
              preview.innerHTML = '';
              const img = document.createElement('img');
              img.src = url;
              img.alt = '';
              img.className =
                kind === 'logo' ? 'h-full w-full object-contain' : 'h-full w-full object-cover';
              preview.appendChild(img);
            }
            if (
              kind === 'cover' &&
              typeof window.XemillaImageCrop?.samplePlateColorFromUrl === 'function' &&
              hubLogoBgInput instanceof HTMLInputElement
            ) {
              try {
                hubLogoBgInput.value =
                  await window.XemillaImageCrop.samplePlateColorFromUrl(url);
              } catch {
                /* keep */
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error al subir';
            if (typeof showToast === 'function') showToast(msg, 'error');
            else alert(msg);
          }
        }

        const cropApi = window.XemillaImageCrop;
        if (cropApi && typeof cropApi.open === 'function') {
          const coverForSample =
            kind === 'logo' && hubCoverUrlInput instanceof HTMLInputElement
              ? hubCoverUrlInput.value.trim()
              : '';
          void cropApi.open({
            file,
            aspect: kind === 'cover' ? 'cover' : 'logo',
            title: kind === 'cover' ? 'Recortar cover' : 'Recortar logo',
            coverUrl: coverForSample,
            onConfirm: (cropped, meta) => {
              if (meta?.plateBg && hubLogoBgInput instanceof HTMLInputElement) {
                hubLogoBgInput.value = meta.plateBg;
              }
              return runUpload(cropped);
            },
          });
          return;
        }

        void runUpload(file);
      },
      { signal },
    );
  }

  bindHubUpload(
    hubLogoFileInput instanceof HTMLInputElement ? hubLogoFileInput : null,
    hubLogoUrlInput instanceof HTMLInputElement ? hubLogoUrlInput : null,
    hubLogoPreview instanceof HTMLElement ? hubLogoPreview : null,
    'logo',
  );
  bindHubUpload(
    hubCoverFileInput instanceof HTMLInputElement ? hubCoverFileInput : null,
    hubCoverUrlInput instanceof HTMLInputElement ? hubCoverUrlInput : null,
    hubCoverPreview instanceof HTMLElement ? hubCoverPreview : null,
    'cover',
  );

  hubDatosSave?.addEventListener(
    'click',
    async () => {
      if (!(hubDatosSave instanceof HTMLButtonElement)) return;
      if (!requireRestauranteId()) return;

      const nombre =
        hubNombreInput instanceof HTMLInputElement
          ? hubNombreInput.value.trim()
          : '';
      const telefono =
        opsTelefonoInput instanceof HTMLInputElement
          ? opsTelefonoInput.value.trim()
          : '';
      const logoUrl =
        hubLogoUrlInput instanceof HTMLInputElement
          ? hubLogoUrlInput.value.trim()
          : '';
      const coverUrl =
        hubCoverUrlInput instanceof HTMLInputElement
          ? hubCoverUrlInput.value.trim()
          : '';
      let logoBg =
        hubLogoBgInput instanceof HTMLInputElement
          ? hubLogoBgInput.value.trim()
          : '';

      if (!nombre) {
        if (typeof showToast === 'function') showToast('El nombre es obligatorio', 'error');
        return;
      }

      if (
        coverUrl &&
        (!logoBg || logoBg === '#111111') &&
        typeof window.XemillaImageCrop?.samplePlateColorFromUrl === 'function'
      ) {
        try {
          logoBg = await window.XemillaImageCrop.samplePlateColorFromUrl(coverUrl);
          if (hubLogoBgInput instanceof HTMLInputElement) hubLogoBgInput.value = logoBg;
        } catch {
          /* keep */
        }
      }

      hubDatosSave.disabled = true;
      const prevLabel = hubDatosSave.textContent;
      hubDatosSave.textContent = 'Guardando…';
      if (hubDatosStatus) {
        hubDatosStatus.textContent = '';
        hubDatosStatus.className = 'text-[10px] text-zinc-600';
      }

      try {
        /** @type {Record<string, string>} */
        const body = {
          restaurante_id: restauranteId,
          nombre_comercial: nombre,
          whatsapp_num: telefono,
        };
        if (logoUrl) body.logo_url = logoUrl;
        if (coverUrl) body.hub_cover_url = coverUrl;
        if (/^#[0-9A-Fa-f]{6}$/.test(logoBg)) body.hub_logo_bg = logoBg;

        const res = await fetch('/api/update-hub-datos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'No se pudo guardar');

        if (hubNombreInput instanceof HTMLInputElement) {
          hubNombreInput.value =
            json.restaurante?.nombre_comercial || nombre;
        }
        if (opsTelefonoInput instanceof HTMLInputElement) {
          opsTelefonoInput.value =
            json.restaurante?.whatsapp_num ||
            json.restaurante?.whatsapp_url ||
            telefono;
        }
        if (hubLogoUrlInput instanceof HTMLInputElement) {
          hubLogoUrlInput.value = json.restaurante?.logo_url || logoUrl;
        }
        if (hubCoverUrlInput instanceof HTMLInputElement && coverUrl) {
          hubCoverUrlInput.value = json.restaurante?.hub_cover_url || coverUrl;
        }
        if (hubLogoBgInput instanceof HTMLInputElement) {
          hubLogoBgInput.value = json.restaurante?.hub_logo_bg || logoBg;
        }
        if (hubDatosStatus) {
          hubDatosStatus.textContent = '✓ guardado';
          hubDatosStatus.className = 'text-[10px] text-emerald-400';
        }
        if (typeof showToast === 'function') {
          showToast('Datos del local guardados', 'ok');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al guardar';
        if (hubDatosStatus) {
          hubDatosStatus.textContent = msg;
          hubDatosStatus.className = 'text-[10px] text-rose-400';
        }
        if (typeof showToast === 'function') showToast(msg, 'error');
        else alert(msg);
      } finally {
        hubDatosSave.disabled = false;
        hubDatosSave.textContent = prevLabel || 'Guardar datos';
      }
    },
    { signal },
  );

  function isVideoUrl(url) {
    return /\.(mp4|webm|ogg)(\?|$)/i.test(url) || /\/video\/upload\//i.test(url);
  }

  function isCropCancelled(err) {
    return Boolean(err && typeof err === 'object' && 'cancelled' in err);
  }

  function paintToggle(btn, on) {
    btn.setAttribute('aria-checked', String(on));
    btn.classList.toggle('is-on', on);
  }

  /**
   * @param {Element | null} picker
   * @param {string} tipo
   */
  function paintDestacadoTipo(picker, tipo) {
    if (!(picker instanceof HTMLElement)) return;
    picker.querySelectorAll('[data-set-destacado-tipo]').forEach((opt) => {
      const active = opt.getAttribute('data-set-destacado-tipo') === tipo;
      opt.setAttribute('aria-checked', String(active));
      opt.classList.toggle('is-active', active);
    });
  }

  /**
   * @param {Element | null} picker
   * @param {'none' | 'chef' | 'promocion'} value
   */
  function paintDestacadoPicker(picker, value) {
    if (!(picker instanceof HTMLElement)) return;
    picker.dataset.value = value;
    picker.querySelectorAll('[data-set-destacado]').forEach((opt) => {
      const active = opt.getAttribute('data-set-destacado') === value;
      opt.setAttribute('aria-checked', String(active));
      opt.classList.toggle('is-active', active);
    });
    const label = picker.querySelector('[data-destacado-label]');
    if (label) label.textContent = destacadoPickerLabel(value);
  }

  async function updatePlato(id, patch) {
    const res = await fetch('/api/update-plato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'No se pudo actualizar.');
    return json;
  }

  async function deletePlato(id) {
    const res = await fetch('/api/delete-plato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'No se pudo eliminar.');
    return json;
  }

  /**
   * @param {HTMLInputElement} input
   */
  async function saveField(input) {
    const field = input.dataset.field;
    if (!field) return;
    const row = input.closest('tr[data-plato-id]');
    if (!(row instanceof HTMLElement)) return;
    const id = Number(row.dataset.platoId);
    if (!Number.isFinite(id)) return;

    const original = input.dataset.original ?? '';
    let value = input.value;
    /** @type {Record<string, unknown>} */
    const patch = {};

    if (field === 'precio') {
      let precio = Number(String(value).replace(',', '.'));
      if (!Number.isFinite(precio) || precio < 0) precio = 0;
      value = precio.toFixed(2);
      input.value = value;
      if (value === Number(original).toFixed(2)) return;
      patch.precio = precio;
    } else if (field === 'nombre') {
      value = value.trim();
      if (!value) {
        input.value = original;
        return;
      }
      if (value === original) return;
      patch.nombre = value;
    } else {
      return;
    }

    input.classList.remove('is-saved', 'is-error');
    input.disabled = true;
    const savedHint = row.querySelector('[data-field-saved]');

    try {
      await updatePlato(id, patch);
      input.dataset.original = value;
      input.classList.add('is-saved');
      if (field === 'nombre') setRowNombreUi(row, value);
      refreshSearchIndex(row);
      if (savedHint instanceof HTMLElement) {
        savedHint.style.opacity = '1';
        window.setTimeout(() => {
          savedHint.style.opacity = '0';
          input.classList.remove('is-saved');
        }, 900);
      } else {
        window.setTimeout(() => input.classList.remove('is-saved'), 900);
      }
    } catch (err) {
      if (field === 'precio') input.value = Number(original).toFixed(2);
      else input.value = original;
      input.classList.add('is-error');
      window.setTimeout(() => input.classList.remove('is-error'), 1100);
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      input.disabled = false;
    }
  }

  /**
   * @param {HTMLElement | null} overlay
   */
  function openOverlay(overlay) {
    if (!(overlay instanceof HTMLElement)) return;
    overlay.setAttribute('aria-hidden', 'false');
    void overlay.offsetWidth;
    requestAnimationFrame(() => {
      overlay.dataset.open = 'true';
    });
  }

  /**
   * @param {HTMLElement | null} overlay
   * @param {() => void} [after]
   * @param {{ timerRef: 'modal' | 'desc' | 'nombre' | 'nuevo' | 'nutricion' | 'ar' }} opts
   */
  function closeOverlay(overlay, after, opts) {
    if (!(overlay instanceof HTMLElement)) return;
    if (overlay.dataset.open !== 'true') return;
    overlay.dataset.open = 'false';
    overlay.setAttribute('aria-hidden', 'true');

    const clearExisting = () => {
      if (opts.timerRef === 'modal' && modalCloseTimer) {
        clearTimeout(modalCloseTimer);
        modalCloseTimer = null;
      }
      if (opts.timerRef === 'desc' && descCloseTimer) {
        clearTimeout(descCloseTimer);
        descCloseTimer = null;
      }
      if (opts.timerRef === 'nombre' && nombreCloseTimer) {
        clearTimeout(nombreCloseTimer);
        nombreCloseTimer = null;
      }
      if (opts.timerRef === 'nuevo' && nuevoCloseTimer) {
        clearTimeout(nuevoCloseTimer);
        nuevoCloseTimer = null;
      }
      if (opts.timerRef === 'nutricion' && nutricionCloseTimer) {
        clearTimeout(nutricionCloseTimer);
        nutricionCloseTimer = null;
      }
      if (opts.timerRef === 'ar' && arCloseTimer) {
        clearTimeout(arCloseTimer);
        arCloseTimer = null;
      }
    };
    clearExisting();

    const timer = setTimeout(() => {
      after?.();
      if (opts.timerRef === 'modal') modalCloseTimer = null;
      else if (opts.timerRef === 'desc') descCloseTimer = null;
      else if (opts.timerRef === 'nombre') nombreCloseTimer = null;
      else if (opts.timerRef === 'nuevo') nuevoCloseTimer = null;
      else if (opts.timerRef === 'nutricion') nutricionCloseTimer = null;
      else arCloseTimer = null;
    }, 220);

    if (opts.timerRef === 'modal') modalCloseTimer = timer;
    else if (opts.timerRef === 'desc') descCloseTimer = timer;
    else if (opts.timerRef === 'nombre') nombreCloseTimer = timer;
    else if (opts.timerRef === 'nuevo') nuevoCloseTimer = timer;
    else if (opts.timerRef === 'nutricion') nutricionCloseTimer = timer;
    else arCloseTimer = timer;
  }

  function showModalShell() {
    if (modalCloseTimer) {
      clearTimeout(modalCloseTimer);
      modalCloseTimer = null;
    }
    openOverlay(modal);
  }

  function renderPreviewMedia(url, title) {
    if (modalImg instanceof HTMLImageElement) {
      modalImg.classList.add('hidden');
      modalImg.removeAttribute('src');
    }
    if (modalVideo instanceof HTMLVideoElement) {
      modalVideo.classList.add('hidden');
      modalVideo.removeAttribute('src');
      modalVideo.pause();
    }

    if (isVideoUrl(url) && modalVideo instanceof HTMLVideoElement) {
      modalVideo.src = url;
      modalVideo.classList.remove('hidden');
    } else if (modalImg instanceof HTMLImageElement) {
      modalImg.src = platoFillUrl(url, { w: 1200, h: 900 });
      modalImg.alt = title || 'Plato';
      modalImg.classList.remove('hidden');
    }
  }

  const REPLACE_LABEL_HTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
      <path d="M12 16V4"></path>
      <path d="M8 8l4-4 4 4"></path>
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"></path>
    </svg>
    Cambiar archivo
  `;

  function openPreviewModal(row) {
    activeMediaRow = row;
    const url = row.dataset.imagen || '';
    const title = row.dataset.nombre || 'Plato';
    if (modalTitle) modalTitle.textContent = title;
    modalAttach?.classList.add('hidden');
    modalPreview?.classList.remove('hidden');
    modalReplaceError?.classList.add('hidden');
    if (modalReplaceError) modalReplaceError.textContent = '';
    if (modalReplaceFile instanceof HTMLInputElement) {
      modalReplaceFile.value = '';
      modalReplaceFile.disabled = false;
    }
    modalReplaceBusy?.classList.add('hidden');
    modalReplaceBusy?.classList.remove('flex');
    if (modalReplaceLabel) modalReplaceLabel.innerHTML = REPLACE_LABEL_HTML;

    renderPreviewMedia(url, title);
    if (modalAdjustImage instanceof HTMLElement) {
      modalAdjustImage.classList.toggle('hidden', !url || isVideoUrl(url));
    }
    if (modalRemoveImage instanceof HTMLElement) {
      modalRemoveImage.classList.toggle('hidden', !url);
    }
    showModalShell();
  }

  modalReplaceFile?.addEventListener('change', async () => {
    if (!(activeMediaRow instanceof HTMLElement)) return;
    if (!(modalReplaceFile instanceof HTMLInputElement)) return;

    const file = modalReplaceFile.files?.[0];
    if (!file) return;

    const row = activeMediaRow;
    const id = Number(row.dataset.platoId);
    if (!Number.isFinite(id)) return;

    modalReplaceError?.classList.add('hidden');
    if (modalReplaceError) modalReplaceError.textContent = '';
    modalReplaceBusy?.classList.remove('hidden');
    modalReplaceBusy?.classList.add('flex');
    modalReplaceFile.disabled = true;
    if (modalReplaceLabel) modalReplaceLabel.textContent = 'Subiendo…';

    try {
      let ready = file;
      if (isCroppableImageFile(file)) {
        modalReplaceBusy?.classList.add('hidden');
        modalReplaceBusy?.classList.remove('flex');
        try {
          ready = await cropPlatoImage(file);
        } catch (err) {
          if (isCropCancelled(err)) return;
          throw err;
        }
        modalReplaceBusy?.classList.remove('hidden');
        modalReplaceBusy?.classList.add('flex');
      }

      const url = await uploadPlatoMediaFile(ready, restauranteId, restauranteSlug);
      await updatePlato(id, { imagen_url: url });
      setRowMediaUrl(row, url);
      renderPreviewMedia(url, row.dataset.nombre || 'Plato');
      if (modalAdjustImage instanceof HTMLElement) {
        modalAdjustImage.classList.toggle('hidden', isVideoUrl(url));
      }
      if (modalRemoveImage instanceof HTMLElement) {
        modalRemoveImage.classList.toggle('hidden', !url);
      }
    } catch (err) {
      if (modalReplaceError) {
        modalReplaceError.textContent =
          err instanceof Error ? err.message : 'Error al reemplazar media';
        modalReplaceError.classList.remove('hidden');
      }
    } finally {
      modalReplaceBusy?.classList.add('hidden');
      modalReplaceBusy?.classList.remove('flex');
      modalReplaceFile.disabled = false;
      modalReplaceFile.value = '';
      if (modalReplaceLabel) modalReplaceLabel.innerHTML = REPLACE_LABEL_HTML;
    }
  }, { signal });

  modalAdjustImage?.addEventListener('click', async () => {
    if (!(activeMediaRow instanceof HTMLElement)) return;
    const row = activeMediaRow;
    const id = Number(row.dataset.platoId);
    const url = row.dataset.imagen || '';
    if (!Number.isFinite(id) || !url || isVideoUrl(url)) return;

    modalReplaceError?.classList.add('hidden');
    if (modalAdjustImage instanceof HTMLButtonElement) {
      modalAdjustImage.disabled = true;
      modalAdjustImage.textContent = 'Abriendo…';
    }

    try {
      const cropped = await cropPlatoImage(url);
      modalReplaceBusy?.classList.remove('hidden');
      modalReplaceBusy?.classList.add('flex');
      const nextUrl = await uploadPlatoMediaFile(cropped, restauranteId, restauranteSlug);
      await updatePlato(id, { imagen_url: nextUrl });
      setRowMediaUrl(row, nextUrl);
      renderPreviewMedia(nextUrl, row.dataset.nombre || 'Plato');
    } catch (err) {
      if (isCropCancelled(err)) return;
      if (modalReplaceError) {
        modalReplaceError.textContent =
          err instanceof Error ? err.message : 'No se pudo ajustar la imagen';
        modalReplaceError.classList.remove('hidden');
      }
    } finally {
      modalReplaceBusy?.classList.add('hidden');
      modalReplaceBusy?.classList.remove('flex');
      if (modalAdjustImage instanceof HTMLButtonElement) {
        modalAdjustImage.disabled = false;
        modalAdjustImage.textContent = 'Ajustar recorte';
      }
    }
  }, { signal });

  modalRemoveImage?.addEventListener('click', async () => {
    if (!(activeMediaRow instanceof HTMLElement)) return;
    const row = activeMediaRow;
    const id = Number(row.dataset.platoId);
    const url = row.dataset.imagen || '';
    if (!Number.isFinite(id) || !url) return;
    if (!window.confirm('¿Eliminar la foto de este plato?')) return;

    modalReplaceError?.classList.add('hidden');
    if (modalReplaceError) modalReplaceError.textContent = '';
    if (modalRemoveImage instanceof HTMLButtonElement) {
      modalRemoveImage.disabled = true;
      modalRemoveImage.textContent = 'Eliminando…';
    }

    try {
      await updatePlato(id, { imagen_url: '' });
      setRowMediaUrl(row, '');
      openAttachModal(row);
    } catch (err) {
      if (modalReplaceError) {
        modalReplaceError.textContent =
          err instanceof Error ? err.message : 'No se pudo eliminar la foto';
        modalReplaceError.classList.remove('hidden');
      }
    } finally {
      if (modalRemoveImage instanceof HTMLButtonElement) {
        modalRemoveImage.disabled = false;
        modalRemoveImage.textContent = 'Eliminar foto';
      }
    }
  }, { signal });

  const arModal = document.getElementById('ar-modal');
  const arModalTitle = document.getElementById('ar-modal-title');
  const arModalClose = document.getElementById('ar-modal-close');
  const arModalUrl = document.getElementById('ar-modal-url');
  const arModalSave = document.getElementById('ar-modal-save');
  const arModalRemove = document.getElementById('ar-modal-remove');
  const arModalError = document.getElementById('ar-modal-error');
  /** @type {HTMLElement | null} */
  let activeArRow = null;

  function syncArChip(row) {
    const chip = row.querySelector('[data-edit-ar]');
    if (!(chip instanceof HTMLElement)) return;
    const url = String(row.dataset.modelo3dUrl || '').trim();
    chip.classList.toggle('is-on', Boolean(url));
    chip.title = url ? 'Editar modelo AR' : 'Cargar URL de AR';
  }

  function openArEditor(row) {
    if (!(arModal instanceof HTMLElement) || !(row instanceof HTMLElement)) return;
    activeArRow = row;
    if (arModalTitle) arModalTitle.textContent = row.dataset.nombre || 'Plato';
    if (arModalUrl instanceof HTMLInputElement) arModalUrl.value = row.dataset.modelo3dUrl || '';
    if (arModalError instanceof HTMLElement) {
      arModalError.textContent = '';
      arModalError.classList.add('hidden');
    }
    if (arCloseTimer) {
      clearTimeout(arCloseTimer);
      arCloseTimer = null;
    }
    openOverlay(arModal);
    window.setTimeout(() => {
      if (arModalUrl instanceof HTMLInputElement) arModalUrl.focus();
    }, 80);
  }

  function closeArModal() {
    closeOverlay(
      arModal,
      () => {
        activeArRow = null;
      },
      { timerRef: 'ar' },
    );
  }

  arModalClose?.addEventListener('click', closeArModal, { signal });
  arModal?.addEventListener('click', (e) => {
    if (e.target === arModal) closeArModal();
  }, { signal });

  arModalSave?.addEventListener('click', async () => {
    if (!(activeArRow instanceof HTMLElement)) return;
    const row = activeArRow;
    const id = Number(row.dataset.platoId);
    if (!Number.isFinite(id)) return;
    const url = arModalUrl instanceof HTMLInputElement ? arModalUrl.value.trim() : '';
    if (arModalError instanceof HTMLElement) {
      arModalError.textContent = '';
      arModalError.classList.add('hidden');
    }
    if (arModalSave instanceof HTMLButtonElement) {
      arModalSave.disabled = true;
      arModalSave.textContent = 'Guardando…';
    }
    try {
      await updatePlato(id, { modelo_3d_url: url || null });
      row.dataset.modelo3dUrl = url;
      syncArChip(row);
      showToast(url ? 'Modelo 3D guardado' : 'URL 3D eliminada', 'ok');
      closeArModal();
    } catch (err) {
      if (arModalError instanceof HTMLElement) {
        arModalError.textContent = err instanceof Error ? err.message : 'Error al guardar URL 3D';
        arModalError.classList.remove('hidden');
      }
    } finally {
      if (arModalSave instanceof HTMLButtonElement) {
        arModalSave.disabled = false;
        arModalSave.textContent = 'Guardar URL';
      }
    }
  }, { signal });

  arModalRemove?.addEventListener('click', async () => {
    if (!(activeArRow instanceof HTMLElement)) return;
    const row = activeArRow;
    const id = Number(row.dataset.platoId);
    if (!Number.isFinite(id)) return;
    if (arModalUrl instanceof HTMLInputElement) arModalUrl.value = '';
    try {
      await updatePlato(id, { modelo_3d_url: null });
      row.dataset.modelo3dUrl = '';
      syncArChip(row);
      showToast('Modelo 3D eliminado', 'ok');
      closeArModal();
    } catch (err) {
      if (arModalError instanceof HTMLElement) {
        arModalError.textContent = err instanceof Error ? err.message : 'Error al quitar modelo 3D';
        arModalError.classList.remove('hidden');
      }
    }
  }, { signal });

  function openAttachModal(row) {
    activeMediaRow = row;
    if (modalTitle) modalTitle.textContent = row.dataset.nombre || 'Agregar media';
    modalPreview?.classList.add('hidden');
    modalAttach?.classList.remove('hidden');
    if (modalUrl instanceof HTMLInputElement) modalUrl.value = '';
    if (modalFile instanceof HTMLInputElement) modalFile.value = '';
    modalAttachError?.classList.add('hidden');
    if (modalAttachError) modalAttachError.textContent = '';
    showModalShell();
  }

  function closeModal() {
    closeOverlay(
      modal,
      () => {
        activeMediaRow = null;
        if (modalVideo instanceof HTMLVideoElement) {
          modalVideo.pause();
          modalVideo.removeAttribute('src');
        }
        if (modalImg instanceof HTMLImageElement) {
          modalImg.removeAttribute('src');
          modalImg.classList.add('hidden');
        }
        modalPreview?.classList.add('hidden');
        modalAttach?.classList.add('hidden');
        modalReplaceBusy?.classList.add('hidden');
        modalReplaceBusy?.classList.remove('flex');
        if (modalReplaceFile instanceof HTMLInputElement) modalReplaceFile.value = '';
      },
      { timerRef: 'modal' },
    );
  }

  function openDescModal(row) {
    activeDescRow = row;
    const nombre = getRowNombre(row);
    const btn = row.querySelector('[data-edit-descripcion]');
    const current =
      btn instanceof HTMLElement ? btn.dataset.descripcion || '' : '';

    if (descModalTitle) descModalTitle.textContent = nombre;
    if (descModalText instanceof HTMLTextAreaElement) {
      descModalText.value = current;
    }
    descModalError?.classList.add('hidden');
    if (descModalError) descModalError.textContent = '';
    if (descCloseTimer) {
      clearTimeout(descCloseTimer);
      descCloseTimer = null;
    }
    openOverlay(descModal);
    requestAnimationFrame(() => {
      if (descModalText instanceof HTMLTextAreaElement) descModalText.focus();
    });
  }

  function closeDescModal() {
    closeOverlay(
      descModal,
      () => {
        activeDescRow = null;
      },
      { timerRef: 'desc' },
    );
  }

  function openNombreModal(row) {
    activeNombreRow = row;
    const current = getRowNombre(row);
    if (nombreModalTitle) nombreModalTitle.textContent = 'Editar nombre';
    if (nombreModalText instanceof HTMLInputElement) {
      nombreModalText.value = current;
    }
    nombreModalError?.classList.add('hidden');
    if (nombreModalError) nombreModalError.textContent = '';
    if (nombreCloseTimer) {
      clearTimeout(nombreCloseTimer);
      nombreCloseTimer = null;
    }
    openOverlay(nombreModal);
    requestAnimationFrame(() => {
      if (nombreModalText instanceof HTMLInputElement) {
        nombreModalText.focus();
        nombreModalText.select();
      }
    });
  }

  function closeNombreModal() {
    closeOverlay(
      nombreModal,
      () => {
        activeNombreRow = null;
      },
      { timerRef: 'nombre' },
    );
  }

  const nutricionModal = document.getElementById('nutricion-modal');
  const nutricionModalTitle = document.getElementById('nutricion-modal-title');
  const nutricionModalClose = document.getElementById('nutricion-modal-close');
  const nutricionModalSave = document.getElementById('nutricion-modal-save');
  const nutricionModalError = document.getElementById('nutricion-modal-error');
  const nutCalorias = document.getElementById('nut-calorias');
  const nutProteinas = document.getElementById('nut-proteinas');
  const nutCarbs = document.getElementById('nut-carbs');
  const nutGrasas = document.getElementById('nut-grasas');
  const ALERGENO_LABELS = {
    lacteos: 'Lácteos',
    gluten: 'Gluten',
    huevo: 'Huevo',
    soja: 'Soja',
    frutos_secos: 'Frutos secos',
    mariscos: 'Mariscos',
    pescado: 'Pescado',
    picante: 'Picante',
    carne: 'Carne',
    no_vegano: 'No vegano',
  };

  function isNutricionGadgetOn() {
    const sw = document.getElementById('marca-gadget-nutricion');
    if (sw instanceof HTMLInputElement) return sw.checked;
    return root instanceof HTMLElement && root.dataset.gadgetNutricion === 'true';
  }

  function isArGadgetOn() {
    const sw = document.getElementById('marca-gadget-ar');
    if (sw instanceof HTMLInputElement) return sw.checked;
    return root instanceof HTMLElement && root.dataset.gadgetAr === 'true';
  }

  function formatNutricionPreviewFromRow(row) {
    const parts = [];
    const kcal = String(row.dataset.calorias || '').trim();
    if (kcal) parts.push(`${kcal} kcal`);
    /** @type {string[]} */
    let alergias = [];
    try {
      alergias = JSON.parse(row.dataset.alergias || '[]');
    } catch {
      alergias = [];
    }
    if (alergias.length) {
      const labels = alergias
        .map((id) => ALERGENO_LABELS[id] || id)
        .slice(0, 3);
      parts.push(labels.join(', ') + (alergias.length > 3 ? '…' : ''));
    }
    return parts.length ? parts.join(' · ') : 'Sin ficha · clic para editar';
  }

  function syncNutricionPreview(row) {
    const preview = row.querySelector('[data-nutricion-preview]');
    if (!(preview instanceof HTMLElement)) return;
    const text = formatNutricionPreviewFromRow(row);
    preview.textContent = text;
    const filled = String(row.dataset.calorias || '').trim() !== '' || text !== 'Sin ficha · clic para editar';
    preview.classList.toggle('is-filled', filled);
    preview.classList.toggle('is-empty', !filled);
    preview.classList.toggle('italic', !filled);
    preview.classList.toggle('text-zinc-500', filled);
    preview.classList.toggle('text-zinc-600', !filled);
  }

  function applyNutricionToRow(row, plato) {
    if (!(row instanceof HTMLElement) || !plato || typeof plato !== 'object') return;
    row.dataset.calorias = plato.calorias == null ? '' : String(plato.calorias);
    row.dataset.proteinas = plato.proteinas == null ? '' : String(plato.proteinas);
    row.dataset.carbs = plato.carbs == null ? '' : String(plato.carbs);
    row.dataset.grasas = plato.grasas == null ? '' : String(plato.grasas);
    row.dataset.alergias = JSON.stringify(
      Array.isArray(plato.alergias) ? plato.alergias : [],
    );
    row.dataset.ingredientesDetalle = String(plato.ingredientes_detalle || '');
    syncNutricionPreview(row);
  }

  function fillNutricionModalFromRow(row) {
    if (nutricionModalTitle) nutricionModalTitle.textContent = getRowNombre(row);
    if (nutCalorias instanceof HTMLInputElement) nutCalorias.value = row.dataset.calorias || '';
    if (nutProteinas instanceof HTMLInputElement) nutProteinas.value = row.dataset.proteinas || '';
    if (nutCarbs instanceof HTMLInputElement) nutCarbs.value = row.dataset.carbs || '';
    if (nutGrasas instanceof HTMLInputElement) nutGrasas.value = row.dataset.grasas || '';
    /** @type {string[]} */
    let alergias = [];
    try {
      alergias = JSON.parse(row.dataset.alergias || '[]');
    } catch {
      alergias = [];
    }
    const set = new Set(alergias.map((a) => String(a).toLowerCase()));
    nutricionModal?.querySelectorAll('[data-nut-alergeno]').forEach((el) => {
      if (el instanceof HTMLInputElement) el.checked = set.has(el.value);
    });
  }

  async function hydratePlatosNutricion() {
    if (!restauranteId || !isNutricionGadgetOn()) return;
    try {
      const res = await fetch(
        `/api/platos-nutricion?restaurante_id=${encodeURIComponent(restauranteId)}`,
        { credentials: 'same-origin', cache: 'no-store' },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(json.platos)) return;
      for (const plato of json.platos) {
        const row = tbody?.querySelector(`tr[data-plato-id="${plato.id}"]`);
        if (row instanceof HTMLElement) applyNutricionToRow(row, plato);
      }
    } catch {
      /* silent — el modal igual pide ficha viva al abrir */
    }
  }

  function openNutricionModal(row) {
    if (!(nutricionModal instanceof HTMLElement)) return;
    if (!(row instanceof HTMLElement)) return;
    activeNutricionRow = row;
    fillNutricionModalFromRow(row);
    nutricionModalError?.classList.add('hidden');
    if (nutricionModalError) nutricionModalError.textContent = '';
    if (nutricionCloseTimer) {
      clearTimeout(nutricionCloseTimer);
      nutricionCloseTimer = null;
    }
    openOverlay(nutricionModal);
    const id = Number(row.dataset.platoId);
    if (!Number.isFinite(id)) return;
    fetch(`/api/platos-nutricion?id=${id}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then((res) => res.json().catch(() => ({})))
      .then((json) => {
        if (activeNutricionRow !== row || !json?.plato) return;
        applyNutricionToRow(row, json.plato);
        fillNutricionModalFromRow(row);
      })
      .catch(() => {});
    window.setTimeout(() => {
      if (nutCalorias instanceof HTMLInputElement) nutCalorias.focus();
    }, 80);
  }

  function closeNutricionModal() {
    closeOverlay(
      nutricionModal,
      () => {
        activeNutricionRow = null;
      },
      { timerRef: 'nutricion' },
    );
  }

  nutricionModalClose?.addEventListener('click', closeNutricionModal, { signal });
  nutricionModal?.addEventListener('click', (e) => {
    if (e.target === nutricionModal) closeNutricionModal();
  }, { signal });
  nutricionModalSave?.addEventListener('click', async () => {
    if (!(activeNutricionRow instanceof HTMLElement)) return;
    const row = activeNutricionRow;
    const id = Number(row.dataset.platoId);
    if (!Number.isFinite(id)) return;
    const alergias = [...(nutricionModal?.querySelectorAll('[data-nut-alergeno]:checked') ?? [])]
      .map((el) => (el instanceof HTMLInputElement ? el.value : ''))
      .filter(Boolean);
    nutricionModalError?.classList.add('hidden');
    if (nutricionModalSave instanceof HTMLButtonElement) {
      nutricionModalSave.disabled = true;
      nutricionModalSave.textContent = 'Guardando…';
    }
    try {
      await updatePlato(id, {
        calorias: nutCalorias instanceof HTMLInputElement ? nutCalorias.value : null,
        proteinas: nutProteinas instanceof HTMLInputElement ? nutProteinas.value : null,
        carbs: nutCarbs instanceof HTMLInputElement ? nutCarbs.value : null,
        grasas: nutGrasas instanceof HTMLInputElement ? nutGrasas.value : null,
        alergias,
      });
      row.dataset.calorias = nutCalorias instanceof HTMLInputElement ? nutCalorias.value : '';
      row.dataset.proteinas = nutProteinas instanceof HTMLInputElement ? nutProteinas.value : '';
      row.dataset.carbs = nutCarbs instanceof HTMLInputElement ? nutCarbs.value : '';
      row.dataset.grasas = nutGrasas instanceof HTMLInputElement ? nutGrasas.value : '';
      row.dataset.alergias = JSON.stringify(alergias);
      syncNutricionPreview(row);
      const savedHint = row.querySelector('[data-field-saved]');
      if (savedHint instanceof HTMLElement) {
        savedHint.style.opacity = '1';
        window.setTimeout(() => {
          savedHint.style.opacity = '0';
        }, 900);
      }
      closeNutricionModal();
    } catch (err) {
      if (nutricionModalError) {
        nutricionModalError.textContent =
          err instanceof Error ? err.message : 'Error al guardar';
        nutricionModalError.classList.remove('hidden');
      }
    } finally {
      if (nutricionModalSave instanceof HTMLButtonElement) {
        nutricionModalSave.disabled = false;
        nutricionModalSave.textContent = 'Guardar nutrición';
      }
    }
  }, { signal });

  document.getElementById('nutricion-bulk-sync')?.addEventListener('click', async () => {
    const textEl = document.getElementById('nutricion-bulk-text');
    const statusEl = document.getElementById('nutricion-bulk-status');
    const btn = document.getElementById('nutricion-bulk-sync');
    const text = textEl instanceof HTMLTextAreaElement ? textEl.value.trim() : '';
    if (!text) {
      if (statusEl) {
        statusEl.textContent = 'Pegá JSON o lista estructurada.';
        statusEl.className = 'text-[11px] text-rose-400';
      }
      return;
    }
    if (!requireRestauranteId()) return;
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = true;
      btn.textContent = 'Sincronizando…';
    }
    if (statusEl) {
      statusEl.textContent = 'Procesando…';
      statusEl.className = 'text-[11px] text-zinc-500';
    }
    try {
      const res = await fetch('/api/bulk-sync-nutricion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurante_id: restauranteId, text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'No se pudo sincronizar');
      const unmatched = Array.isArray(json.unmatched) ? json.unmatched : [];
      const parts = [`${json.updated || 0} actualizados`];
      if (unmatched.length) parts.push(`${unmatched.length} sin match`);
      if (statusEl) {
        statusEl.textContent = parts.join(' · ');
        statusEl.className = unmatched.length
          ? 'text-[11px] text-amber-400'
          : 'text-[11px] text-emerald-400';
      }
      if (typeof showToast === 'function') {
        showToast(parts.join(' · '), unmatched.length ? 'error' : 'ok');
      }
      const synced = Array.isArray(json.platos) ? json.platos : [];
      for (const plato of synced) {
        const row = tbody?.querySelector(`tr[data-plato-id="${plato.id}"]`);
        if (row instanceof HTMLElement) applyNutricionToRow(row, plato);
      }
      if (synced.length === 0 && json.updated > 0) {
        window.location.reload();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      if (statusEl) {
        statusEl.textContent = msg;
        statusEl.className = 'text-[11px] text-rose-400';
      }
    } finally {
      if (btn instanceof HTMLButtonElement) {
        btn.disabled = false;
        btn.textContent = 'Procesar y Sincronizar';
      }
    }
  }, { signal });

  modalClose?.addEventListener('click', closeModal, { signal });
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  }, { signal });
  descModalClose?.addEventListener('click', closeDescModal, { signal });
  descModal?.addEventListener('click', (e) => {
    if (e.target === descModal) closeDescModal();
  }, { signal });
  nombreModalClose?.addEventListener('click', closeNombreModal, { signal });
  nombreModal?.addEventListener('click', (e) => {
    if (e.target === nombreModal) closeNombreModal();
  }, { signal });
  nombreModalText?.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nombreModalSave?.click();
      }
    },
    { signal },
  );
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (arModal?.dataset.open === 'true') closeArModal();
    else if (nutricionModal?.dataset.open === 'true') closeNutricionModal();
    else if (nombreModal?.dataset.open === 'true') closeNombreModal();
    else if (descModal?.dataset.open === 'true') closeDescModal();
    else if (modal?.dataset.open === 'true') closeModal();
  }, { signal });

  nombreModalSave?.addEventListener('click', async () => {
    if (!(activeNombreRow instanceof HTMLElement)) return;
    const row = activeNombreRow;
    const id = Number(row.dataset.platoId);
    if (!Number.isFinite(id)) return;

    const input = row.querySelector('[data-field="nombre"]');
    const original =
      input instanceof HTMLInputElement ? String(input.dataset.original || '') : getRowNombre(row);
    const value =
      nombreModalText instanceof HTMLInputElement
        ? nombreModalText.value.trim()
        : '';

    if (!value) {
      if (nombreModalError) {
        nombreModalError.textContent = 'El nombre no puede quedar vacío.';
        nombreModalError.classList.remove('hidden');
      }
      return;
    }

    if (value === original) {
      closeNombreModal();
      return;
    }

    nombreModalError?.classList.add('hidden');
    if (nombreModalSave instanceof HTMLButtonElement) {
      nombreModalSave.disabled = true;
      nombreModalSave.textContent = 'Guardando…';
    }

    try {
      await updatePlato(id, { nombre: value });
      setRowNombreUi(row, value);
      refreshSearchIndex(row);
      const savedHint = row.querySelector('[data-field-saved]');
      if (savedHint instanceof HTMLElement) {
        savedHint.style.opacity = '1';
        window.setTimeout(() => {
          savedHint.style.opacity = '0';
        }, 900);
      }
      closeNombreModal();
    } catch (err) {
      if (nombreModalError) {
        nombreModalError.textContent =
          err instanceof Error ? err.message : 'Error al guardar';
        nombreModalError.classList.remove('hidden');
      }
    } finally {
      if (nombreModalSave instanceof HTMLButtonElement) {
        nombreModalSave.disabled = false;
        nombreModalSave.textContent = 'Guardar';
      }
    }
  }, { signal });

  descModalSave?.addEventListener('click', async () => {
    if (!(activeDescRow instanceof HTMLElement)) return;
    const row = activeDescRow;
    const id = Number(row.dataset.platoId);
    if (!Number.isFinite(id)) return;

    const value =
      descModalText instanceof HTMLTextAreaElement
        ? descModalText.value.trim()
        : '';
    const btn = row.querySelector('[data-edit-descripcion]');
    const preview = row.querySelector('[data-descripcion-preview]');
    const prev =
      btn instanceof HTMLElement ? btn.dataset.descripcion || '' : '';

    if (value === prev) {
      closeDescModal();
      return;
    }

    descModalError?.classList.add('hidden');
    if (descModalSave instanceof HTMLButtonElement) {
      descModalSave.disabled = true;
      descModalSave.textContent = 'Guardando…';
    }

    try {
      await updatePlato(id, { descripcion: value });
      if (btn instanceof HTMLElement) btn.dataset.descripcion = value;
      if (preview instanceof HTMLElement) {
        preview.textContent = value || 'Sin descripción · clic para editar';
        preview.classList.toggle('text-zinc-500', Boolean(value));
        preview.classList.toggle('text-zinc-700', !value);
        preview.classList.toggle('italic', !value);
      }
      refreshSearchIndex(row);
      const savedHint = row.querySelector('[data-field-saved]');
      if (savedHint instanceof HTMLElement) {
        savedHint.style.opacity = '1';
        window.setTimeout(() => {
          savedHint.style.opacity = '0';
        }, 900);
      }
      closeDescModal();
    } catch (err) {
      if (descModalError) {
        descModalError.textContent =
          err instanceof Error ? err.message : 'Error al guardar';
        descModalError.classList.remove('hidden');
      }
    } finally {
      if (descModalSave instanceof HTMLButtonElement) {
        descModalSave.disabled = false;
        descModalSave.textContent = 'Guardar';
      }
    }
  }, { signal });

  document.getElementById('modal-attach-save')?.addEventListener('click', async () => {
    if (!(activeMediaRow instanceof HTMLElement)) return;
    const row = activeMediaRow;
    const id = Number(row.dataset.platoId);
    if (!Number.isFinite(id)) return;

    const url = modalUrl instanceof HTMLInputElement ? modalUrl.value.trim() : '';
    const file = modalFile instanceof HTMLInputElement ? modalFile.files?.[0] : null;
    modalAttachError?.classList.add('hidden');
    const saveBtn = document.getElementById('modal-attach-save');
    if (saveBtn instanceof HTMLButtonElement) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando…';
    }

    try {
      let imagenUrl = '';
      if (file) {
        let ready = file;
        if (isCroppableImageFile(file)) {
          try {
            ready = await cropPlatoImage(file);
          } catch (err) {
            if (isCropCancelled(err)) return;
            throw err;
          }
        }
        const uploadedUrl = await uploadPlatoMediaFile(ready, restauranteId, restauranteSlug);
        const json = await updatePlato(id, { imagen_url: uploadedUrl });
        imagenUrl = json.plato?.imagen_url || uploadedUrl;
      } else if (url) {
        const json = await updatePlato(id, { imagen_url: url });
        imagenUrl = json.plato?.imagen_url || url;
      } else {
        throw new Error('Pegá una URL o elegí un archivo.');
      }

      row.dataset.imagen = imagenUrl;
      setRowMediaUrl(row, imagenUrl);
      closeModal();
      if (imagenUrl) openPreviewModal(row);
    } catch (err) {
      if (modalAttachError) {
        modalAttachError.textContent = err instanceof Error ? err.message : 'Error';
        modalAttachError.classList.remove('hidden');
      }
    } finally {
      if (saveBtn instanceof HTMLButtonElement) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar media';
      }
    }
  }, { signal });

  function buildRow(plato) {
    const tr = document.createElement('tr');
    tr.className =
      'platos-row border-b border-white/[0.05] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-neutral-800/50';
    tr.dataset.platoId = String(plato.id);
    tr.dataset.disponible = plato.disponible ? 'true' : 'false';
    tr.dataset.destacado = plato.destacado ? 'true' : 'false';
    tr.dataset.destacadoTipo = normalizeDestacadoTipo(plato.destacado_tipo);
    tr.dataset.imagen = plato.imagen_url || '';
    tr.dataset.nombre = plato.nombre;
    tr.dataset.categoria = plato.categoria_nombre || '';
    tr.dataset.categoriaId = resolveCategoriaKey(
      plato.categoria_nombre,
      plato.categoria_id,
    );
    tr.dataset.calorias = plato.calorias == null ? '' : String(plato.calorias);
    tr.dataset.proteinas = plato.proteinas == null ? '' : String(plato.proteinas);
    tr.dataset.carbs = plato.carbs == null ? '' : String(plato.carbs);
    tr.dataset.grasas = plato.grasas == null ? '' : String(plato.grasas);
    tr.dataset.alergias = JSON.stringify(Array.isArray(plato.alergias) ? plato.alergias : []);
    tr.dataset.ingredientesDetalle = plato.ingredientes_detalle || '';
    tr.dataset.modelo3dUrl = typeof plato.modelo_3d_url === 'string' ? plato.modelo_3d_url : '';
    tr.dataset.search =
      `${plato.nombre} ${plato.categoria_nombre || ''} ${plato.descripcion || ''}`.toLowerCase();
    const precio = Number(plato.precio).toFixed(2);
    const catKey = String(plato.categoria_nombre || '').trim().toLowerCase();
    const sameCatCount = allRows().filter((r) => {
      if (!(r instanceof HTMLElement)) return false;
      return String(r.dataset.categoria || '').trim().toLowerCase() === catKey;
    }).length;
    const orderValue = sameCatCount + 1;
    const mediaCell = plato.imagen_url
      ? `<button type="button" data-ver-plato title="Ver / editar media" class="dish-thumb"><img src="${escapeHtml(platoFillUrl(plato.imagen_url, { w: 480, h: 360 }))}" alt="" class="dish-thumb__img" loading="lazy" /></button>`
      : `<label class="dish-thumb dish-thumb--empty"><input type="file" accept="image/*,video/*,image/gif" data-upload-media class="sr-only" /><span data-upload-label title="Subir media" class="dish-thumb__placeholder">${CAMERA_ICON_SVG}</span></label>`;
    const nutOn = isNutricionGadgetOn();
    const nutHidden = nutOn ? '' : ' hidden';
    const nutAttr = nutOn ? '' : ' hidden';
    const nutPreview = formatNutricionPreviewFromRow(tr);
    const nutFilled = nutPreview !== 'Sin ficha · clic para editar';
    const nutBtn = `<button type="button" data-edit-nutricion data-shows-when-nutricion class="nut-edit-btn${nutHidden}"${nutAttr} title="Editar ficha nutricional"><span class="nut-edit-btn__top"><span class="nut-edit-btn__title">Nutrición</span><span class="nut-edit-btn__go" aria-hidden="true">›</span></span><span data-nutricion-preview class="nut-edit-btn__preview ${nutFilled ? 'is-filled' : 'is-empty'}">${escapeHtml(nutPreview)}</span></button>`;
    const isSuper = root instanceof HTMLElement && root.dataset.isSuperAdmin === 'true';
    const arOn = isArGadgetOn();
    const arUrl = String(tr.dataset.modelo3dUrl || '').trim();
    const arBtn = isSuper
      ? `<button type="button" data-edit-ar data-shows-when-ar class="ar-chip${arUrl ? ' is-on' : ''}${arOn ? '' : ' hidden'}"${arOn ? '' : ' hidden'} title="${arUrl ? 'Editar modelo AR' : 'Cargar URL de AR'}" aria-label="Modelo AR 3D">AR</button>`
      : '';
    const gadgetStack = `<div class="dish-gadget-stack">${nutBtn}</div>`;

    tr.innerHTML = `
      <td class="platos-cell platos-cell--order px-2 py-3.5 text-center" data-label="#">
        <input type="number" min="1" step="1" value="${orderValue}" data-plato-id="${escapeHtml(String(plato.id))}" data-dish-order aria-label="Orden del plato" title="Cambiar orden" class="${DISH_ORDER_INPUT_CLASS}" />
      </td>
      <td class="platos-cell platos-cell--dish px-3 py-3 text-left" data-label="Plato">
        <div class="dish-identity">
          <div class="dish-thumb-slot" data-media-actions>${mediaCell}</div>
          <div class="dish-copy">
          <div class="dish-edit-field">
            <span class="dish-edit-field__label">Nombre</span>
          <div class="dish-name-row">
          <div class="dish-name-stack">
            <button type="button" data-edit-nombre class="dish-name-btn dish-edit-hit" title="Editar nombre" aria-label="Editar nombre: ${escapeHtml(plato.nombre)}">
              <span class="dish-name-marquee" data-nombre-preview>
                <span class="dish-name-marquee__track">
                  <span data-nombre-text>${escapeHtml(plato.nombre)}</span>
                  <span class="dish-name-marquee__clone" aria-hidden="true" data-nombre-clone>${escapeHtml(plato.nombre)}</span>
                </span>
              </span>
            </button>
            <input type="text" value="${escapeHtml(plato.nombre)}" data-field="nombre" data-original="${escapeHtml(plato.nombre)}"
              class="field-inline dish-name-input dish-edit-hit w-full text-[0.9375rem] font-semibold tracking-tight text-white outline-none" aria-label="Nombre del plato" />
          </div>
          ${arBtn}
          </div>
          </div>
          <div class="dish-edit-field">
            <span class="dish-edit-field__label">Descripción</span>
          <button type="button" data-edit-descripcion data-descripcion="${escapeHtml(plato.descripcion || '')}"
            class="dish-edit-hit group text-left" title="Editar descripción">
            <span data-descripcion-preview class="line-clamp-2 text-[12px] leading-snug ${plato.descripcion ? 'text-zinc-500' : 'text-zinc-600 italic'}">${escapeHtml(plato.descripcion || 'Sin descripción · clic para editar')}</span>
          </button>
          </div>
          <span data-field-saved class="h-3 text-[10px] text-emerald-400 opacity-0 transition-opacity">✓ guardado</span>
          </div>
        </div>
        ${gadgetStack}
      </td>
      <td class="platos-cell platos-cell--cat px-2 py-3.5 text-left text-xs text-zinc-400" data-label="Categoría" data-categoria>${escapeHtml(plato.categoria_nombre || '—')}</td>
      <td class="platos-cell platos-cell--precio px-2 py-3.5 text-center" data-label="Precio">
        <div class="inline-flex items-center justify-center gap-1">
          <span class="text-xs text-zinc-600">$</span>
          <input type="number" inputmode="decimal" min="0" step="0.01" value="${precio}" data-field="precio" data-original="${precio}"
            class="field-inline precio-input w-[5.25rem] rounded-lg border border-transparent bg-white/[0.04] px-2 py-1.5 text-right text-sm tabular-nums text-zinc-100 outline-none transition focus:border-white/20 focus:bg-black/50" />
        </div>
      </td>
      <td class="platos-cell platos-cell--destacado px-2 py-3.5 text-center" data-label="Destacado">
        ${destacadoPickerHtml(plato)}
      </td>
      <td class="platos-cell platos-cell--disponible px-2 py-3.5 text-center" data-label="Disponible">
        <button type="button" role="switch" aria-checked="${Boolean(plato.disponible)}" data-toggle-disponible title="Disponible" class="ios-toggle ios-toggle--live ${plato.disponible ? 'is-on' : ''}">
          <span class="ios-toggle__knob" aria-hidden="true"></span>
        </button>
      </td>
      <td class="platos-cell platos-cell--media px-2 py-3.5 text-right" data-label="Acciones">
        <div class="inline-flex items-center justify-end">
          <button type="button" data-delete class="rounded-lg p-2 text-zinc-600 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-rose-500/10 hover:text-rose-400 sm:p-1.5" aria-label="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16"></path><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"></path><path d="M7 7l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12"></path><path d="M10 11v6M14 11v6"></path></svg>
          </button>
        </div>
      </td>
    `;
    return tr;
  }

  bulkSubmit?.addEventListener('click', async () => {
    if (!(bulkSubmit instanceof HTMLButtonElement)) return;
    try {
      if (!requireRestauranteId()) return;
      const text = bulkText instanceof HTMLTextAreaElement ? bulkText.value : '';
      refreshBulkPreview();
      const preview = previewMenuBulkText(text);
      if (preview.rows.length === 0) {
        setFeedback(preview.errors[0] || 'No hay filas válidas para insertar.', false);
        return;
      }
      bulkSubmit.disabled = true;
      bulkSubmit.textContent = 'Procesando…';
      setFeedback(
        `Insertando ${preview.rows.length} plato(s) · ${preview.summary.map((s) => `${s.label} ${s.count}`).join(' · ')}…`,
        true,
      );
      try {
        const res = await fetch('/api/bulk-insert-platos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ restaurante_id: restauranteId, text }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'No se pudo insertar el menú.');
        for (const plato of json.platos ?? []) tbody?.prepend(buildRow(plato));
        refreshCount();
        setFeedback(`Listo: ${json.count} plato(s) insertados.`, true);
        if (bulkText instanceof HTMLTextAreaElement) bulkText.value = '';
        refreshBulkPreview();
      } catch (err) {
        console.error('Error en menú:', err);
        setFeedback(err instanceof Error ? err.message : 'Error al insertar', false);
      } finally {
        bulkSubmit.disabled = false;
        bulkSubmit.textContent = 'Procesar e Insertar Menú Completo';
      }
    } catch (err) {
      console.error('Error en menú:', err);
      setFeedback(err instanceof Error ? err.message : 'Error al insertar', false);
    }
  }, { signal });

  function refreshBulkPreview() {
    if (!(bulkPreview instanceof HTMLElement)) return;
    const text = bulkText instanceof HTMLTextAreaElement ? bulkText.value.trim() : '';
    if (!text) {
      bulkPreview.classList.add('hidden');
      if (bulkPreviewBody) bulkPreviewBody.innerHTML = '';
      if (bulkPreviewSummary) bulkPreviewSummary.innerHTML = '';
      if (bulkPreviewMeta) bulkPreviewMeta.textContent = '';
      if (bulkPreviewErrors) {
        bulkPreviewErrors.textContent = '';
        bulkPreviewErrors.classList.add('hidden');
      }
      return;
    }

    const { rows, errors, summary } = previewMenuBulkText(text);
    if (rows.length === 0 && errors.length === 0) {
      bulkPreview.classList.add('hidden');
      return;
    }

    bulkPreview.classList.remove('hidden');
    if (bulkPreviewMeta) {
      bulkPreviewMeta.textContent =
        rows.length > 0
          ? `${rows.length} plato${rows.length === 1 ? '' : 's'} listo${rows.length === 1 ? '' : 's'} para insertar`
          : 'Sin filas válidas';
    }

    if (bulkPreviewSummary) {
      bulkPreviewSummary.innerHTML = summary
        .map(
          (s) =>
            `<span class="bulk-preview__chip">${escapeHtml(s.label)} <strong>${s.count}</strong></span>`,
        )
        .join('');
    }

    if (bulkPreviewBody) {
      const shown = rows.slice(0, 40);
      bulkPreviewBody.innerHTML = shown
        .map(
          (row) => `<tr>
            <td>${row.line}</td>
            <td>${escapeHtml(row.nombre)}</td>
            <td>${escapeHtml(row.categoria)}</td>
            <td><span class="bulk-preview__macro">${escapeHtml(row.macroLabel)}</span></td>
            <td>$${Number(row.precio).toFixed(2)}</td>
          </tr>`,
        )
        .join('');
      if (rows.length > shown.length) {
        bulkPreviewBody.insertAdjacentHTML(
          'beforeend',
          `<tr><td colspan="5">… y ${rows.length - shown.length} más</td></tr>`,
        );
      }
    }

    if (bulkPreviewErrors) {
      if (errors.length > 0) {
        bulkPreviewErrors.textContent = errors.slice(0, 6).join(' · ');
        bulkPreviewErrors.classList.remove('hidden');
      } else {
        bulkPreviewErrors.textContent = '';
        bulkPreviewErrors.classList.add('hidden');
      }
    }
  }

  bulkText?.addEventListener(
    'input',
    () => {
      if (bulkPreviewTimer) clearTimeout(bulkPreviewTimer);
      bulkPreviewTimer = setTimeout(() => {
        bulkPreviewTimer = null;
        refreshBulkPreview();
      }, 280);
    },
    { signal },
  );

  // ── Bulk panel toggle ──
  function setBulkPanelOpen(open) {
    if (!(bulkPanel instanceof HTMLElement)) return;
    bulkPanel.dataset.open = open ? 'true' : 'false';
    bulkPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    bulkToggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    bulkToggleMobile?.setAttribute('aria-expanded', open ? 'true' : 'false');
    bulkChevron?.classList.toggle('rotate-180', open);
  }

  function toggleBulkPanel() {
    if (!(bulkPanel instanceof HTMLElement)) return;
    const next = bulkPanel.dataset.open !== 'true';
    setBulkPanelOpen(next);
    if (next) setNutricionBulkPanelOpen(false);
  }

  bulkToggle?.addEventListener('click', toggleBulkPanel, { signal });
  bulkToggleMobile?.addEventListener('click', toggleBulkPanel, { signal });

  const nutricionBulkToggle = document.getElementById('nutricion-bulk-toggle');
  const nutricionBulkToggleMobile = document.getElementById('nutricion-bulk-toggle-mobile');
  const nutricionBulkPanel = document.getElementById('nutricion-bulk-panel');

  function setNutricionBulkPanelOpen(open) {
    if (!(nutricionBulkPanel instanceof HTMLElement)) return;
    if (!isNutricionGadgetOn()) open = false;
    nutricionBulkPanel.dataset.open = open ? 'true' : 'false';
    nutricionBulkPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    nutricionBulkToggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    nutricionBulkToggleMobile?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setBulkPanelOpen(false);
  }

  function toggleNutricionBulkPanel() {
    if (!(nutricionBulkPanel instanceof HTMLElement)) return;
    if (!isNutricionGadgetOn()) return;
    setNutricionBulkPanelOpen(nutricionBulkPanel.dataset.open !== 'true');
  }

  nutricionBulkToggle?.addEventListener('click', toggleNutricionBulkPanel, { signal });
  nutricionBulkToggleMobile?.addEventListener('click', toggleNutricionBulkPanel, { signal });

  // ── Nuevo plato modal ──
  function fillCategoriasDatalist() {
    if (!(npCategoriasList instanceof HTMLDataListElement)) return;
    npCategoriasList.innerHTML = '';
    for (const cat of categoriasCache) {
      const opt = document.createElement('option');
      opt.value = cat.nombre;
      npCategoriasList.appendChild(opt);
    }
  }

  function openNuevoPlatoModal() {
    try {
      if (!requireRestauranteId()) return;
      fillCategoriasDatalist();
      if (nuevoForm instanceof HTMLFormElement) nuevoForm.reset();
      if (npDestacado instanceof HTMLElement) {
        npDestacado.setAttribute('aria-checked', 'false');
        npDestacado.classList.remove('is-on');
      }
      if (npDestacadoTipo instanceof HTMLElement) {
        npDestacadoTipo.hidden = true;
        npDestacadoTipo.dataset.value = 'chef';
        paintDestacadoTipo(npDestacadoTipo, 'chef');
      }
      const npCat = document.getElementById('np-categoria');
      if (npCat instanceof HTMLInputElement) {
        // New restaurant / empty menu: auto-select default category
        if (categoriasCache.length === 0) {
          npCat.value = 'General';
          npCat.placeholder = 'General (se creará al guardar)';
        } else if (!npCat.value.trim()) {
          npCat.value = categoriasCache[0]?.nombre || 'General';
        }
      }
      nuevoError?.classList.add('hidden');
      if (nuevoError) nuevoError.textContent = '';
      if (nuevoCloseTimer) {
        clearTimeout(nuevoCloseTimer);
        nuevoCloseTimer = null;
      }
      openOverlay(nuevoModal);
      requestAnimationFrame(() => {
        document.getElementById('np-nombre')?.focus();
      });
    } catch (err) {
      console.error('Error en menú:', err);
      alert(err instanceof Error ? err.message : 'Error al abrir Nuevo Plato');
    }
  }

  function closeNuevoPlatoModal() {
    closeOverlay(nuevoModal, undefined, { timerRef: 'nuevo' });
  }

  npDestacado?.addEventListener('click', () => {
    if (!(npDestacado instanceof HTMLElement)) return;
    const next = npDestacado.getAttribute('aria-checked') !== 'true';
    paintToggle(npDestacado, next);
    if (npDestacadoTipo instanceof HTMLElement) npDestacadoTipo.hidden = !next;
  }, { signal });

  npDestacadoTipo?.addEventListener('click', (event) => {
    if (!(npDestacadoTipo instanceof HTMLElement)) return;
    const opt = event.target instanceof Element ? event.target.closest('[data-set-destacado-tipo]') : null;
    if (!(opt instanceof HTMLElement)) return;
    const tipo = normalizeDestacadoTipo(opt.dataset.setDestacadoTipo);
    npDestacadoTipo.dataset.value = tipo;
    paintDestacadoTipo(npDestacadoTipo, tipo);
  }, { signal });

  nuevoOpeners.forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        try {
          openNuevoPlatoModal();
        } catch (err) {
          console.error('Error en menú:', err);
        }
      },
      { signal },
    );
  });
  nuevoClose?.addEventListener('click', closeNuevoPlatoModal, { signal });
  nuevoModal?.addEventListener('click', (e) => {
    if (e.target === nuevoModal) closeNuevoPlatoModal();
  }, { signal });

  nuevoForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      if (!(nuevoForm instanceof HTMLFormElement)) return;
      if (!(nuevoSubmit instanceof HTMLButtonElement)) return;
      if (!requireRestauranteId()) return;

      const fd = new FormData(nuevoForm);
      const nombre = String(fd.get('nombre') || '').trim();
      const descripcion = String(fd.get('descripcion') || '').trim();
      const categoria = String(fd.get('categoria') || '').trim() || 'General';
      const precio = Number(String(fd.get('precio') || '').replace(',', '.'));
      const destacado =
        npDestacado instanceof HTMLElement &&
        npDestacado.getAttribute('aria-checked') === 'true';
      const fileInput = document.getElementById('np-imagen');
      const file =
        fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : null;

      nuevoError?.classList.add('hidden');
      if (!nombre) {
        if (nuevoError) {
          nuevoError.textContent = 'El nombre es obligatorio.';
          nuevoError.classList.remove('hidden');
        }
        return;
      }
      if (!Number.isFinite(precio) || precio < 0) {
        if (nuevoError) {
          nuevoError.textContent = 'Precio inválido.';
          nuevoError.classList.remove('hidden');
        }
        return;
      }

      nuevoSubmit.disabled = true;
      nuevoSubmit.textContent = 'Creando…';

      try {
        let imagenUrl = null;
        if (file) {
          nuevoSubmit.textContent = 'Subiendo media…';
          const uploadFd = new FormData();
          uploadFd.set('file', file);
          uploadFd.set('restaurante_slug', restauranteSlug);
          uploadFd.set('asset_type', 'dishes');
          if (restauranteId) uploadFd.set('restaurante_id', restauranteId);
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: uploadFd,
          });
          const uploadJson = await uploadRes.json().catch(() => ({}));
          if (!uploadRes.ok) {
            throw new Error(uploadJson.error || 'No se pudo subir la media');
          }
          imagenUrl = uploadJson.url || null;
        }

        nuevoSubmit.textContent = 'Guardando…';
        const alergias = [...nuevoForm.querySelectorAll('input[name="alergias"]:checked')].map(
          (el) => (el instanceof HTMLInputElement ? el.value : ''),
        ).filter(Boolean);
        const res = await fetch('/api/create-plato', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurante_id: restauranteId,
            nombre,
            descripcion: descripcion || null,
            precio,
            destacado,
            destacado_tipo:
              npDestacadoTipo instanceof HTMLElement
                ? normalizeDestacadoTipo(npDestacadoTipo.dataset.value)
                : 'chef',
            categoria,
            imagen_url: imagenUrl,
            calorias: fd.get('calorias') || null,
            proteinas: fd.get('proteinas') || null,
            carbs: fd.get('carbs') || null,
            grasas: fd.get('grasas') || null,
            alergias,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'No se pudo crear el plato');

        const plato = json.plato;
        if (plato) {
          tbody?.prepend(buildRow(plato));
          refreshCount();
          if (
            plato.categoria_nombre &&
            !categoriasCache.some(
              (c) =>
                c.nombre.toLowerCase() ===
                String(plato.categoria_nombre).toLowerCase(),
            )
          ) {
            categoriasCache.push({
              id: plato.categoria_id,
              nombre: plato.categoria_nombre,
            });
          }
        }
        closeNuevoPlatoModal();
        showToast('Plato creado', 'ok');
      } catch (err) {
        console.error('Error en menú:', err);
        if (nuevoError) {
          nuevoError.textContent =
            err instanceof Error ? err.message : 'Error al crear';
          nuevoError.classList.remove('hidden');
        }
        showToast(err instanceof Error ? err.message : 'Error al crear', 'error');
      } finally {
        nuevoSubmit.disabled = false;
        nuevoSubmit.textContent = 'Crear plato';
      }
    } catch (err) {
      console.error('Error en menú:', err);
      alert(err instanceof Error ? err.message : 'Error en menú');
    }
  }, { signal });

  tbody?.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches('[data-field]')) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      target.blur();
    }
  }, { signal });

  tbody?.addEventListener('focusout', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches('[data-field]')) return;
    void saveField(target);
  }, { signal });

  /**
   * @param {HTMLElement} row
   * @param {string} url
   */
  function setRowMediaUrl(row, url) {
    row.dataset.imagen = url;
    const actions = row.querySelector('[data-media-actions]');
    if (!(actions instanceof HTMLElement)) return;

    actions.querySelector('label')?.remove();
    actions.querySelector('[data-ver-plato]')?.remove();

    if (url) {
      const ver = document.createElement('button');
      ver.type = 'button';
      ver.setAttribute('data-ver-plato', '');
      ver.title = 'Ver / editar media';
      ver.className = 'dish-thumb';
      const img = document.createElement('img');
      img.src = platoFillUrl(url, { w: 480, h: 360 });
      img.alt = '';
      img.loading = 'lazy';
      img.className = 'dish-thumb__img';
      ver.appendChild(img);
      actions.appendChild(ver);
    } else {
      const label = document.createElement('label');
      label.className = 'dish-thumb dish-thumb--empty';
      label.innerHTML = `<input type="file" accept="image/*,video/*,image/gif" data-upload-media class="sr-only" /><span data-upload-label title="Subir media" class="dish-thumb__placeholder">${CAMERA_ICON_SVG}</span>`;
      actions.appendChild(label);
    }
  }

  tbody?.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches('[data-upload-media]')) return;

    const row = target.closest('tr[data-plato-id]');
    if (!(row instanceof HTMLElement)) return;
    const id = Number(row.dataset.platoId);
    if (!Number.isFinite(id)) return;

    const file = target.files?.[0];
    if (!file) return;

    const label = row.querySelector('[data-upload-label]');
    const prevHtml = label?.innerHTML || CAMERA_ICON_SVG;
    if (label) label.textContent = '…';
    target.disabled = true;

    try {
      let ready = file;
      if (isCroppableImageFile(file)) {
        if (label) label.textContent = 'Ajustar';
        try {
          ready = await cropPlatoImage(file);
        } catch (err) {
          if (isCropCancelled(err)) {
            if (label) label.innerHTML = prevHtml;
            target.value = '';
            target.disabled = false;
            return;
          }
          throw err;
        }
      }
      if (label) label.textContent = '…';
      const url = await uploadPlatoMediaFile(ready, restauranteId, restauranteSlug);
      await updatePlato(id, { imagen_url: url });
      setRowMediaUrl(row, url);
    } catch (err) {
      if (label) label.innerHTML = prevHtml;
      alert(err instanceof Error ? err.message : 'Error al subir media');
      target.value = '';
      target.disabled = false;
    }
  }, { signal });

  const sucursalesPanel = initSucursales({
    root,
    tbody,
    signal,
    paintToggle,
    applySearchFilter,
    showToast,
  });

  tbody?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const nutBtn = target.closest('[data-edit-nutricion]');
    if (nutBtn) {
      const nutRow = nutBtn.closest('tr[data-plato-id]');
      if (nutRow instanceof HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        openNutricionModal(nutRow);
      }
      return;
    }
    const arBtn = target.closest('[data-edit-ar]');
    if (arBtn) {
      const arRow = arBtn.closest('tr[data-plato-id]');
      if (arRow instanceof HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        openArEditor(arRow);
      }
      return;
    }
    const row = target.closest('tr[data-plato-id]');
    if (!(row instanceof HTMLElement)) return;
    const id = Number(row.dataset.platoId);
    if (!Number.isFinite(id)) return;

    if (target.closest('[data-ver-plato]')) {
      if (row.dataset.imagen) openPreviewModal(row);
      return;
    }

    if (target.closest('[data-edit-nombre]')) {
      openNombreModal(row);
      return;
    }

    if (target.closest('[data-edit-descripcion]')) {
      openDescModal(row);
      return;
    }

    if (target.closest('[data-delete]')) {
      if (
        !window.confirm(
          '¿Estás seguro de que deseas eliminar este plato por completo?',
        )
      ) {
        return;
      }
      try {
        await deletePlato(id);
        row.remove();
        refreshCount();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Error al eliminar');
      }
      return;
    }

    const toggleDisp = target.closest('[data-toggle-disponible]');
    if (toggleDisp instanceof HTMLElement) {
      if (sucursalesPanel.handleToggle(row)) return;
      const next = row.dataset.disponible !== 'true';
      const prev = !next;
      row.dataset.disponible = next ? 'true' : 'false';
      paintToggle(toggleDisp, next);
      try {
        // Boolean explícito → columna platos.disponible (menú público filtra eq true)
        await updatePlato(id, { disponible: Boolean(next) });
        applySearchFilter();
      } catch (err) {
        row.dataset.disponible = prev ? 'true' : 'false';
        paintToggle(toggleDisp, prev);
        alert(err instanceof Error ? err.message : 'Error al actualizar');
      }
      return;
    }

    const destOpt = target.closest('[data-set-destacado]');
    if (destOpt instanceof HTMLElement) {
      const picker = destOpt.closest('[data-destacado-picker]');
      const next = destOpt.dataset.setDestacado === 'none' ? 'none' : normalizeDestacadoTipo(destOpt.dataset.setDestacado);
      const prev = row.dataset.destacado === 'true' ? normalizeDestacadoTipo(row.dataset.destacadoTipo) : 'none';
      if (next === prev) return;
      const apply = (value) => {
        row.dataset.destacado = value === 'none' ? 'false' : 'true';
        if (value !== 'none') row.dataset.destacadoTipo = value;
        paintDestacadoPicker(picker, value);
      };
      apply(next);
      applySearchFilter();
      try {
        await updatePlato(
          id,
          next === 'none' ? { destacado: false } : { destacado: true, destacado_tipo: next },
        );
      } catch (err) {
        apply(prev);
        applySearchFilter();
        alert(err instanceof Error ? err.message : 'Error al actualizar');
      }
    }
  }, { signal });

  // ── Top Nav tabs: menu | metricas | identidad ──
  /**
   * @param {HTMLElement} el
   */
  function playFadeInUp(el) {
    el.classList.remove('admin-fade-in-up');
    void el.offsetWidth;
    el.classList.add('admin-fade-in-up');
  }

  /**
   * Normalize legacy aliases (marca → identidad).
   * @param {string | null} name
   */
  function normalizeTabName(name) {
    const raw = String(name || '').trim().toLowerCase();
    if (raw === 'marca' || raw === 'identidad') return 'identidad';
    if (raw === 'metricas' || raw === 'métricas') return 'metricas';
    if (raw === 'menu' || raw === 'menú') return 'menu';
    if (raw === 'perfil') return 'perfil';
    return raw || 'menu';
  }

  function initAdminTopNavTabs() {
    const root = document.getElementById('dashboard-root');
    const canUseIdentidad =
      root instanceof HTMLElement && root.dataset.isSuperAdmin === 'true';
    const tabButtons = document.querySelectorAll(
      '[data-admin-top-nav] [data-tab-target], [data-admin-bottom-nav] [data-tab-target]',
    );
    const tabPanels = document.querySelectorAll('[data-tab-panel]');
    const fab = document.querySelector('.studio-fab');
    if (!tabButtons.length || !tabPanels.length) return;

    /**
     * @param {string} targetName
     */
    function switchTab(targetName) {
      let id = normalizeTabName(targetName);
      // Operativo: never open Identidad (no tab / no panel); force Menú.
      if (id === 'identidad' && !canUseIdentidad) id = 'menu';
      if (id === 'perfil' && canUseIdentidad) id = 'identidad';

      const allowed = new Set(
        [...tabButtons]
          .filter((b) => b instanceof HTMLElement)
          .map((b) => normalizeTabName(/** @type {HTMLElement} */ (b).getAttribute('data-tab-target'))),
      );
      if (!allowed.has(id)) id = 'menu';

      tabPanels.forEach((panel) => {
        if (!(panel instanceof HTMLElement)) return;
        const panelName = normalizeTabName(panel.getAttribute('data-tab-panel'));
        const isActive = panelName === id;
        if (isActive) {
          panel.classList.remove('hidden');
          panel.hidden = false;
          panel.removeAttribute('hidden');
          if (id === 'identidad') panel.style.overflow = 'visible';
          playFadeInUp(panel);
        } else {
          panel.classList.add('hidden');
          panel.hidden = true;
          panel.setAttribute('hidden', '');
        }
      });

      tabButtons.forEach((btn) => {
        if (!(btn instanceof HTMLElement)) return;
        const isSelected = normalizeTabName(btn.getAttribute('data-tab-target')) === id;
        btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        btn.classList.toggle('active', isSelected);
        btn.classList.toggle('is-active', isSelected);

        const inTopNav = Boolean(btn.closest('[data-admin-top-nav]'));
        if (inTopNav) {
          if (isSelected) {
            btn.classList.add('bg-white/10', 'text-white');
            btn.classList.remove('bg-white', 'text-black', 'text-zinc-950', 'shadow-md', 'text-zinc-400', 'hover:text-white', 'hover:bg-white/5');
          } else {
            btn.classList.remove('bg-white', 'bg-white/10', 'text-black', 'text-white', 'shadow-md', 'text-zinc-950');
            btn.classList.add('text-zinc-400', 'hover:text-white');
          }
        }
      });

      if (fab instanceof HTMLElement) {
        fab.hidden = id !== 'menu';
        fab.style.display = id === 'menu' ? '' : 'none';
      }

      const marcaSaveBtn = document.getElementById('marca-save');
      if (marcaSaveBtn instanceof HTMLButtonElement) {
        marcaSaveBtn.hidden = !(canUseIdentidad && id === 'identidad');
      }

      try {
        sessionStorage.setItem('xemilla-admin-tab', id);
      } catch {
        /* ignore */
      }
    }

    tabButtons.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.getAttribute('data-tab-target');
        if (target) switchTab(target);
      }, { signal });
    });

    // Operativo: always start on Menú. SuperAdmin: restore last tab (Identidad/Gadgets).
    let defaultTab = 'menu';
    if (canUseIdentidad) {
      try {
        defaultTab = sessionStorage.getItem('xemilla-admin-tab') || 'menu';
      } catch {
        defaultTab = 'menu';
      }
      const activeBtn =
        document.querySelector('[data-admin-top-nav] [data-tab-target].active') ||
        document.querySelector('[data-admin-top-nav] [data-tab-target][aria-selected="true"]') ||
        document.querySelector('[data-admin-bottom-nav] [data-tab-target].is-active');
      if (!sessionStorage.getItem('xemilla-admin-tab') && activeBtn instanceof HTMLElement) {
        defaultTab = activeBtn.getAttribute('data-tab-target') || 'menu';
      }
    }
    switchTab(defaultTab);
  }

  /**
   * Bottom dock: Instagram-style compact on scroll down, expand on scroll up.
   */
  function initStudioDockScroll() {
    const dock = document.querySelector('[data-admin-bottom-nav]');
    if (!(dock instanceof HTMLElement)) return;
    if (dock.dataset.scrollBound === '1') return;
    dock.dataset.scrollBound = '1';

    const fab = document.querySelector('.studio-fab');
    let lastY = window.scrollY || 0;
    let compact = false;
    let ticking = false;
    const DOWN_THRESHOLD = 10;
    const UP_THRESHOLD = 6;
    const MIN_Y = 24;

    const setCompact = (next) => {
      if (compact === next) return;
      compact = next;
      dock.classList.toggle('is-compact', compact);
      if (fab instanceof HTMLElement) {
        fab.classList.toggle('is-dock-compact', compact);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (window.matchMedia('(min-width: 1024px)').matches) {
          setCompact(false);
          lastY = window.scrollY || 0;
          return;
        }
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        const delta = y - lastY;
        if (y <= MIN_Y) {
          setCompact(false);
        } else if (delta > DOWN_THRESHOLD) {
          setCompact(true);
        } else if (delta < -UP_THRESHOLD) {
          setCompact(false);
        }
        lastY = y;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true, signal });
    onScroll();
  }

  initAdminTopNavTabs();
  initStudioDockScroll();
  syncAllDishNameMarquees();
  void hydratePlatosNutricion();
  window.addEventListener(
    'resize',
    () => {
      syncAllDishNameMarquees();
    },
    { signal },
  );

  // ── Toast premium ──
  const toastEl = document.getElementById('crx-toast');
  const toastMsg = document.getElementById('crx-toast-msg');
  /** @type {ReturnType<typeof setTimeout> | null} */
  let toastTimer = null;

  /**
   * @param {string} message
   * @param {'ok' | 'error'} [tone]
   */
  function showToast(message, tone = 'ok') {
    if (!(toastEl instanceof HTMLElement) || !(toastMsg instanceof HTMLElement)) return;
    toastMsg.textContent = message;
    toastEl.dataset.tone = tone;
    toastEl.dataset.open = 'true';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.dataset.open = 'false';
    }, 3200);
  }

  // ── Identidad de marca ──
  const marcaForm = document.getElementById('marca-form');

  /** Live logo thumbnail from LOGO URL input */
  function wireLogoPreview() {
    const input = document.querySelector('[data-logo-url-input]');
    const img = document.querySelector('[data-logo-preview-img]');
    const ph = document.querySelector('[data-logo-preview-ph]');
    if (!(input instanceof HTMLInputElement)) return;
    if (!(img instanceof HTMLImageElement)) return;
    if (!(ph instanceof HTMLElement)) return;

    const sync = () => {
      const url = String(input.value || '').trim();
      if (!url) {
        img.hidden = true;
        img.removeAttribute('src');
        ph.hidden = false;
        return;
      }
      img.hidden = false;
      ph.hidden = true;
      if (img.getAttribute('src') !== url) img.setAttribute('src', url);
    };

    img.addEventListener('error', () => {
      img.hidden = true;
      ph.hidden = false;
    }, { signal });
    img.addEventListener('load', () => {
      if (img.getAttribute('src')) {
        img.hidden = false;
        ph.hidden = true;
      }
    }, { signal });

    input.addEventListener('input', sync, { signal });
    input.addEventListener('change', sync, { signal });
    sync();
  }
  wireLogoPreview();
  const marcaSave = document.getElementById('marca-save');
  const marcaFeedback = document.getElementById('marca-feedback');

  /**
   * @param {string} pickerId
   * @param {string} textId
   */
  function wireColorPair(pickerId, textId) {
    const picker = document.getElementById(pickerId);
    const text = document.getElementById(textId);
    if (!(picker instanceof HTMLInputElement) || !(text instanceof HTMLInputElement)) return;

    const syncPickerToText = () => {
      picker.dataset.touched = '1';
      text.value = picker.value;
      text.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const syncTextToPicker = () => {
      let v = text.value.trim();
      if (v && v[0] !== '#') v = `#${v}`;
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
        picker.value =
          v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;
        text.value = picker.value;
      }
    };
    picker.addEventListener('input', syncPickerToText, { signal });
    picker.addEventListener('change', syncPickerToText, { signal });
    text.addEventListener('input', syncTextToPicker, { signal });
    text.addEventListener('change', syncTextToPicker, { signal });
  }

  /** Antes de guardar: si el usuario movió el picker y el hex está vacío, copiar el picker. */
  function flushColorPairsForSave() {
    const pairs = [
      ['marca-fondo-nosotros-valor-picker', 'marca-fondo-nosotros-valor-color'],
      ['marca-nosotros-color-fondo-picker', 'marca-nosotros-color-fondo'],
      ['marca-nosotros-color-titulo-picker', 'marca-nosotros-color-titulo'],
      ['marca-nosotros-color-cuerpo-picker', 'marca-nosotros-color-cuerpo'],
      ['marca-ubicacion-color-titulo-picker', 'marca-ubicacion-color-titulo'],
      ['marca-ubicacion-color-cuerpo-picker', 'marca-ubicacion-color-cuerpo'],
      ['marca-ubicacion-color-acento-picker', 'marca-ubicacion-color-acento'],
      ['marca-fondo-menu-valor-picker', 'marca-fondo-menu-valor-color'],
      ['marca-menu-color-fondo-picker', 'marca-menu-color-fondo'],
      ['marca-menu-color-texto-picker', 'marca-menu-color-texto'],
      ['marca-menu-color-acento-picker', 'marca-menu-color-acento'],
    ];
    for (const [pickerId, textId] of pairs) {
      const picker = document.getElementById(pickerId);
      const text = document.getElementById(textId);
      if (!(picker instanceof HTMLInputElement) || !(text instanceof HTMLInputElement)) continue;
      const raw = text.value.trim();
      if (raw) {
        if (raw[0] !== '#' && /^[0-9a-f]{3,6}$/i.test(raw)) {
          text.value = `#${raw}`;
        }
        continue;
      }
      if (picker.dataset.touched === '1' && picker.value) {
        text.value = picker.value;
      }
    }
  }

  wireColorPair('marca-color-primario-picker', 'marca-color-primario');
  wireColorPair('marca-home-titulo-color-picker', 'marca-home-titulo-color');
  wireColorPair('marca-color-fondo-picker', 'marca-color-fondo');
  wireColorPair('marca-ubicacion-color-titulo-picker', 'marca-ubicacion-color-titulo');
  wireColorPair('marca-ubicacion-color-cuerpo-picker', 'marca-ubicacion-color-cuerpo');
  wireColorPair('marca-ubicacion-color-acento-picker', 'marca-ubicacion-color-acento');
  document.getElementById('marca-ubicacion-color-titulo')?.addEventListener(
    'input',
    () => {
      const titulo = document.getElementById('marca-ubicacion-color-titulo');
      const cuerpo = document.getElementById('marca-ubicacion-color-cuerpo');
      if (titulo instanceof HTMLInputElement && cuerpo instanceof HTMLInputElement) {
        cuerpo.value = titulo.value;
      }
    },
    { signal },
  );
  wireColorPair('marca-fondo-menu-valor-picker', 'marca-fondo-menu-valor-color');
  wireColorPair('marca-menu-color-fondo-picker', 'marca-menu-color-fondo');
  wireColorPair('marca-menu-color-texto-picker', 'marca-menu-color-texto');
  wireColorPair('marca-menu-color-acento-picker', 'marca-menu-color-acento');
  wireColorPair('marca-fondo-nosotros-valor-picker', 'marca-fondo-nosotros-valor-color');
  wireColorPair('marca-fondo-ubicacion-valor-picker', 'marca-fondo-ubicacion-valor-color');
  wireColorPair('marca-nosotros-color-fondo-picker', 'marca-nosotros-color-fondo');
  wireColorPair('marca-nosotros-color-titulo-picker', 'marca-nosotros-color-titulo');
  wireColorPair('marca-nosotros-color-cuerpo-picker', 'marca-nosotros-color-cuerpo');

  // Home layout cards → theme canónico + selección monocroma ultra-lujo
  const STUDIO_LAYOUT_CARD_ACTIVE =
    'studio-layout-card--active bg-emerald-500/10 border-2 border-emerald-500 text-emerald-950 shadow-xs dark:bg-emerald-500/15 dark:border-emerald-400 dark:text-emerald-100';
  const STUDIO_LAYOUT_CARD_IDLE =
    'bg-zinc-50/80 hover:bg-zinc-100 border border-zinc-200/90 text-zinc-600 dark:bg-zinc-900/40 dark:hover:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400';
  const STUDIO_LAYOUT_BADGE_ACTIVE =
    'px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950 shadow-xs';

  const syncStudioLayoutCard = (label, on) => {
    if (!(label instanceof HTMLElement)) return;
    STUDIO_LAYOUT_CARD_ACTIVE.split(/\s+/).forEach((c) => label.classList.toggle(c, on));
    STUDIO_LAYOUT_CARD_IDLE.split(/\s+/).forEach((c) => label.classList.toggle(c, !on));
  };

  const syncStudioLayoutBadge = (badge, on) => {
    if (!(badge instanceof HTMLElement)) return;
    badge.classList.toggle('hidden', !on);
    STUDIO_LAYOUT_BADGE_ACTIVE.split(/\s+/).forEach((c) => badge.classList.toggle(c, on));
  };

  (() => {
    const themeInput = document.querySelector('[data-home-theme-input]');
    const options = document.querySelectorAll('[data-home-layout-option]');
    if (!(themeInput instanceof HTMLInputElement) || !options.length) return;

    const syncLayout = () => {
      const checked = document.querySelector('[data-home-layout-option]:checked');
      if (!(checked instanceof HTMLInputElement)) return;
      themeInput.value = checked.dataset.homeTheme || 'bento';
      options.forEach((el) => {
        const label = el.closest('label');
        if (!(label instanceof HTMLElement)) return;
        const on = el instanceof HTMLInputElement && el.checked;
        syncStudioLayoutCard(label, on);
        syncStudioLayoutBadge(label.querySelector('[data-home-layout-activo]'), on);
      });
    };

    options.forEach((el) => el.addEventListener('change', syncLayout));
    syncLayout();
  })();

  // Logo Home: upload + toggle URL oculta
  (() => {
    const urlInput = document.querySelector('[data-logo-url-input]');
    const fileInput = document.querySelector('[data-home-logo-file]');
    const toggleBtn = document.querySelector('[data-home-logo-url-toggle]');
    if (!(urlInput instanceof HTMLInputElement)) return;

    toggleBtn?.addEventListener('click', () => {
      urlInput.classList.toggle('hidden');
      if (!urlInput.classList.contains('hidden')) {
        urlInput.focus();
        urlInput.select();
      }
    });

    fileInput?.addEventListener('change', async () => {
      if (!(fileInput instanceof HTMLInputElement)) return;
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      try {
        const url =
          typeof uploadHubMedia === 'function'
            ? await uploadHubMedia(file, 'identity')
            : await (async () => {
                const body = new FormData();
                body.append('file', file);
                body.append('restaurante_slug', restauranteSlug);
                body.append('asset_type', 'identity');
                if (restauranteId) body.append('restaurante_id', restauranteId);
                const res = await fetch('/api/upload', { method: 'POST', body });
                const json = await res.json().catch(() => ({}));
                if (!res.ok || !json.url) throw new Error(json.error || 'No se pudo subir el logo');
                return String(json.url);
              })();
        urlInput.value = url;
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        urlInput.classList.add('hidden');
        showToast('Logo actualizado', 'ok');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Error al subir logo', 'error');
      }
    });
  })();

  // Acento Studio → glow de layouts Home
  (() => {
    const accent = document.getElementById('marca-color-primario');
    const root = document.querySelector('[data-marca-home-controls]');
    if (!(accent instanceof HTMLInputElement) || !(root instanceof HTMLElement)) return;
    const sync = () => {
      const v = accent.value.trim();
      if (v) root.style.setProperty('--color-acento', v);
    };
    accent.addEventListener('input', sync);
    accent.addEventListener('change', sync);
    sync();
  })();

  // Texto primario / acento → campos canónicos ocultos
  (() => {
    const titleColor = document.getElementById('marca-home-titulo-color');
    const colorTexto = document.getElementById('marca-color-texto');
    const esloganColor = document.getElementById('marca-home-eslogan-color');
    const menuColor = document.getElementById('marca-home-menu-color');
    const accent = document.getElementById('marca-color-primario');
    const borde = document.getElementById('marca-home-borde-destacado-color');
    const subtexto = document.getElementById('marca-home-subtexto-color');

    const syncText = () => {
      if (!(titleColor instanceof HTMLInputElement)) return;
      const v = titleColor.value.trim();
      if (!v) return;
      if (colorTexto instanceof HTMLInputElement) colorTexto.value = v;
      if (esloganColor instanceof HTMLInputElement) esloganColor.value = v;
      if (menuColor instanceof HTMLInputElement) menuColor.value = v;
    };
    const syncAccent = () => {
      if (!(accent instanceof HTMLInputElement)) return;
      const v = accent.value.trim();
      if (!v) return;
      if (borde instanceof HTMLInputElement) borde.value = v;
      if (subtexto instanceof HTMLInputElement) subtexto.value = v;
    };

    titleColor?.addEventListener('input', syncText);
    titleColor?.addEventListener('change', syncText);
    accent?.addEventListener('input', syncAccent);
    accent?.addEventListener('change', syncAccent);
  })();

  // Sync color sólido del fondo Home
  (() => {
    const tipo = document.getElementById('marca-fondo-home-tipo');
    const valor = document.getElementById('marca-fondo-home-valor');
    const colorText = document.querySelector('[data-home-fondo-color-text]');
    const colorPicker = document.querySelector('[data-home-fondo-color-picker]');
    if (!(tipo instanceof HTMLSelectElement) || !(valor instanceof HTMLTextAreaElement)) return;

    const pushColorToValor = () => {
      if (tipo.value !== 'color') return;
      const hex =
        (colorText instanceof HTMLInputElement && colorText.value.trim()) ||
        (colorPicker instanceof HTMLInputElement && colorPicker.value) ||
        '';
      if (hex) valor.value = hex;
    };

    colorText?.addEventListener('input', pushColorToValor);
    colorPicker?.addEventListener('input', () => {
      if (colorPicker instanceof HTMLInputElement && colorText instanceof HTMLInputElement) {
        colorText.value = colorPicker.value;
      }
      pushColorToValor();
    });
    tipo.addEventListener('change', () => {
      if (tipo.value === 'color') pushColorToValor();
    });
  })();

  const menuFondoTipo = document.getElementById('marca-fondo-menu-tipo');
  const menuFondoColorWrap = document.querySelector('[data-menu-fondo-color]');
  const menuFondoMediaActions = document.querySelector('[data-menu-fondo-media-actions]');
  const menuFondoUrlLabel = document.querySelector('[data-menu-fondo-url-label]');
  const menuFondoColorVal = document.getElementById('marca-fondo-menu-valor-color');
  const menuFondoUrlVal = document.getElementById('marca-fondo-menu-valor-url');
  const menuFondoHidden = document.getElementById('marca-fondo-menu-valor');
  const menuFondoUrlPanel = document.querySelector('[data-menu-fondo-url-panel]');

  const syncMenuFondoPreview = () => {
    const img = document.querySelector('[data-menu-fondo-preview-img]');
    const ph = document.querySelector('[data-menu-fondo-preview-ph]');
    const tipo = menuFondoTipo instanceof HTMLSelectElement ? menuFondoTipo.value : 'color';
    const url =
      menuFondoUrlVal instanceof HTMLInputElement ? menuFondoUrlVal.value.trim() : '';
    const showImg = tipo === 'image' && Boolean(url);
    if (img instanceof HTMLImageElement) {
      if (!showImg) {
        img.hidden = true;
        img.removeAttribute('src');
      } else {
        img.hidden = false;
        if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      }
    }
    if (ph instanceof HTMLElement) ph.hidden = showImg;
  };

  const setMenuFondoUrlPanel = (open) => {
    if (!(menuFondoUrlPanel instanceof HTMLElement)) return;
    menuFondoUrlPanel.hidden = !open;
    if (open && menuFondoUrlVal instanceof HTMLInputElement) {
      menuFondoUrlVal.focus();
      menuFondoUrlVal.select();
    }
  };

  const syncMenuFondoHidden = () => {
    if (!(menuFondoHidden instanceof HTMLInputElement)) return;
    if (!(menuFondoTipo instanceof HTMLSelectElement)) return;
    const isColor = menuFondoTipo.value === 'color';
    const colorVal =
      menuFondoColorVal instanceof HTMLInputElement ? menuFondoColorVal.value.trim() : '';
    const urlVal =
      menuFondoUrlVal instanceof HTMLInputElement ? menuFondoUrlVal.value.trim() : '';
    menuFondoHidden.value = isColor ? colorVal : urlVal;
    syncMenuFondoPreview();
  };

  const syncMenuFondoUi = () => {
    if (!(menuFondoTipo instanceof HTMLSelectElement)) return;
    const tipo = menuFondoTipo.value;
    const isColor = tipo === 'color';
    if (menuFondoColorWrap instanceof HTMLElement) {
      menuFondoColorWrap.hidden = !isColor;
    }
    if (menuFondoMediaActions instanceof HTMLElement) {
      menuFondoMediaActions.hidden = isColor;
    }
    if (menuFondoUrlLabel instanceof HTMLElement) {
      menuFondoUrlLabel.textContent = tipo === 'video' ? 'URL del video' : 'URL de la imagen';
    }
    if (isColor) setMenuFondoUrlPanel(false);
    syncMenuFondoHidden();
  };

  menuFondoTipo?.addEventListener('change', syncMenuFondoUi, { signal });
  menuFondoColorVal?.addEventListener('input', syncMenuFondoHidden, { signal });

  const destacadosEstiloSelect = document.getElementById('marca-menu-destacados-estilo');
  const destacadosEfectoWrap = document.querySelector('[data-destacados-efecto-wrap]');
  const syncDestacadosEfectoUi = () => {
    if (!(destacadosEfectoWrap instanceof HTMLElement)) return;
    const estilo =
      destacadosEstiloSelect instanceof HTMLSelectElement
        ? destacadosEstiloSelect.value
        : 'scroll';
    destacadosEfectoWrap.hidden = estilo === 'fade';
  };
  destacadosEstiloSelect?.addEventListener('change', syncDestacadosEfectoUi, { signal });
  syncDestacadosEfectoUi();

  menuFondoUrlVal?.addEventListener('input', () => {
    syncMenuFondoHidden();
  }, { signal });
  document
    .getElementById('marca-fondo-menu-valor-picker')
    ?.addEventListener(
      'input',
      () => {
        const picker = document.getElementById('marca-fondo-menu-valor-picker');
        if (picker instanceof HTMLInputElement && menuFondoColorVal instanceof HTMLInputElement) {
          menuFondoColorVal.value = picker.value;
        }
        if (menuFondoTipo instanceof HTMLSelectElement && menuFondoTipo.value !== 'color') {
          menuFondoTipo.value = 'color';
          syncMenuFondoUi();
        } else {
          syncMenuFondoHidden();
        }
      },
      { signal },
    );

  document.querySelector('[data-menu-fondo-url-toggle]')?.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      const open = !(menuFondoUrlPanel instanceof HTMLElement) || menuFondoUrlPanel.hidden;
      setMenuFondoUrlPanel(open);
    },
    { signal },
  );
  document.querySelector('[data-menu-fondo-url-done]')?.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      syncMenuFondoHidden();
      setMenuFondoUrlPanel(false);
    },
    { signal },
  );
  document.querySelector('[data-menu-fondo-url-cancel]')?.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      setMenuFondoUrlPanel(false);
    },
    { signal },
  );
  document.querySelector('[data-menu-fondo-file]')?.addEventListener(
    'change',
    async (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement)) return;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      try {
        const url =
          typeof uploadHubMedia === 'function'
            ? await uploadHubMedia(file, 'categories')
            : await (async () => {
                const body = new FormData();
                body.append('file', file);
                body.append('restaurante_slug', restauranteSlug);
                body.append('asset_type', 'categories');
                if (restauranteId) body.append('restaurante_id', restauranteId);
                const res = await fetch('/api/upload', { method: 'POST', body });
                const json = await res.json().catch(() => ({}));
                if (!res.ok || !json.url) throw new Error(json.error || 'No se pudo subir');
                return String(json.url);
              })();
        if (menuFondoTipo instanceof HTMLSelectElement) {
          menuFondoTipo.value = file.type.startsWith('video/') ? 'video' : 'image';
        }
        if (menuFondoUrlVal instanceof HTMLInputElement) menuFondoUrlVal.value = url;
        syncMenuFondoUi();
        setMenuFondoUrlPanel(false);
        showToast('Fondo actualizado', 'ok');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Error al subir fondo', 'error');
      }
    },
    { signal },
  );
  syncMenuFondoUi();

  // Menú layout cards
  (() => {
    const navInput = document.querySelector('[data-menu-navegacion-input]');
    const options = document.querySelectorAll('[data-menu-layout-option]');
    if (!(navInput instanceof HTMLInputElement) || !options.length) return;

    const syncLayout = () => {
      const checked = document.querySelector('[data-menu-layout-option]:checked');
      if (!(checked instanceof HTMLInputElement)) return;
      navInput.value = checked.dataset.menuNavegacion || 'scroll';
      options.forEach((el) => {
        const label = el.closest('label');
        if (!(label instanceof HTMLElement)) return;
        const on = el instanceof HTMLInputElement && el.checked;
        syncStudioLayoutCard(label, on);
        syncStudioLayoutBadge(label.querySelector('[data-menu-layout-activo]'), on);
      });
      if (typeof syncMenuNavegacionUi === 'function') syncMenuNavegacionUi();
    };

    options.forEach((el) => el.addEventListener('change', syncLayout));
    syncLayout();
  })();

  // Ubicación layout cards
  (() => {
    const themeInput = document.querySelector('[data-ubicacion-theme-input]');
    const options = document.querySelectorAll('[data-ubicacion-layout-option]');
    if (!(themeInput instanceof HTMLInputElement) || !options.length) return;

    const syncLayout = () => {
      const checked = document.querySelector('[data-ubicacion-layout-option]:checked');
      if (!(checked instanceof HTMLInputElement)) return;
      themeInput.value = checked.dataset.ubicacionTheme || 'modal';
      options.forEach((el) => {
        const label = el.closest('label');
        if (!(label instanceof HTMLElement)) return;
        const on = el instanceof HTMLInputElement && el.checked;
        syncStudioLayoutCard(label, on);
        syncStudioLayoutBadge(label.querySelector('[data-ubicacion-layout-activo]'), on);
      });
    };

    options.forEach((el) => el.addEventListener('change', syncLayout));
    syncLayout();
  })();

  // Reservas layout cards + paneles dinámicos
  (() => {
    const destinoInput = document.querySelector('[data-reservas-destino-input]');
    const destinoValor = document.querySelector('[data-reservas-destino-valor]');
    const options = document.querySelectorAll('[data-reservas-layout-option]');
    const panels = document.querySelectorAll('[data-reservas-panel]');
    if (!(destinoInput instanceof HTMLInputElement) || !options.length) return;

    const syncDestinoValorFromActivePanel = (layoutId) => {
      if (!(destinoValor instanceof HTMLInputElement)) return;
      const panel = document.querySelector(`[data-reservas-panel="${layoutId}"]`);
      if (!(panel instanceof HTMLElement)) return;
      const field = panel.querySelector('[data-reservas-destino-field]');
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement
      ) {
        destinoValor.value = field.value.trim();
      } else if (layoutId === 'native_modal') {
        destinoValor.value = '';
      }
    };

    const syncLayout = () => {
      const checked = document.querySelector('[data-reservas-layout-option]:checked');
      if (!(checked instanceof HTMLInputElement)) return;
      const layoutId = checked.value || 'whatsapp_concierge';
      destinoInput.value = checked.dataset.reservasDestino || 'whatsapp';
      options.forEach((el) => {
        const label = el.closest('label');
        if (!(label instanceof HTMLElement)) return;
        const on = el instanceof HTMLInputElement && el.checked;
        syncStudioLayoutCard(label, on);
        syncStudioLayoutBadge(label.querySelector('[data-reservas-layout-activo]'), on);
      });
      panels.forEach((panel) => {
        if (!(panel instanceof HTMLElement)) return;
        const show = panel.getAttribute('data-reservas-panel') === layoutId;
        panel.hidden = !show;
      });
      syncDestinoValorFromActivePanel(layoutId);
    };

    options.forEach((el) => el.addEventListener('change', syncLayout));
    document.querySelectorAll('[data-reservas-destino-field]').forEach((field) => {
      field.addEventListener(
        'input',
        () => {
          const checked = document.querySelector('[data-reservas-layout-option]:checked');
          const layoutId =
            checked instanceof HTMLInputElement
              ? checked.value
              : 'whatsapp_concierge';
          syncDestinoValorFromActivePanel(layoutId);
        },
        { signal },
      );
    });
    syncLayout();
  })();

  (() => {
    const accent = document.getElementById('marca-menu-color-acento');
    const root = document.querySelector('[data-marca-menu-controls]');
    if (!(accent instanceof HTMLInputElement) || !(root instanceof HTMLElement)) return;
    const sync = () => {
      const v = accent.value.trim();
      if (v) root.style.setProperty('--color-acento', v);
    };
    accent.addEventListener('input', sync);
    accent.addEventListener('change', sync);
    sync();
  })();

  const nosotrosFondoTipo = document.getElementById('marca-fondo-nosotros-tipo');
  const nosotrosFondoUrlWrap = document.querySelector('[data-nosotros-fondo-url]');
  const nosotrosFondoUrlLabel = document.querySelector('[data-nosotros-fondo-url-label]');
  const nosotrosFondoColorVal = document.getElementById('marca-fondo-nosotros-valor-color');
  const nosotrosFondoUrlVal = document.getElementById('marca-fondo-nosotros-valor-url');
  const nosotrosFondoHidden = document.getElementById('marca-fondo-nosotros-valor');

  const syncNosotrosFondoHidden = () => {
    if (!(nosotrosFondoHidden instanceof HTMLInputElement)) return;
    if (!(nosotrosFondoTipo instanceof HTMLSelectElement)) return;
    const isColor = nosotrosFondoTipo.value === 'color';
    const colorVal =
      nosotrosFondoColorVal instanceof HTMLInputElement ? nosotrosFondoColorVal.value.trim() : '';
    const urlVal =
      nosotrosFondoUrlVal instanceof HTMLInputElement ? nosotrosFondoUrlVal.value.trim() : '';
    nosotrosFondoHidden.value = isColor ? colorVal : urlVal;
  };

  const syncNosotrosFondoUi = () => {
    if (!(nosotrosFondoTipo instanceof HTMLSelectElement)) return;
    const tipo = nosotrosFondoTipo.value;
    if (nosotrosFondoUrlWrap instanceof HTMLElement) {
      nosotrosFondoUrlWrap.hidden = tipo === 'color';
    }
    if (nosotrosFondoUrlLabel instanceof HTMLElement) {
      nosotrosFondoUrlLabel.textContent = tipo === 'video' ? 'URL del video' : 'URL de la imagen';
    }
    syncNosotrosFondoHidden();
  };

  nosotrosFondoTipo?.addEventListener('change', syncNosotrosFondoUi, { signal });
  nosotrosFondoColorVal?.addEventListener('input', syncNosotrosFondoHidden, { signal });
  nosotrosFondoUrlVal?.addEventListener('input', syncNosotrosFondoHidden, { signal });
  document
    .getElementById('marca-fondo-nosotros-valor-picker')
    ?.addEventListener(
      'input',
      () => {
        if (nosotrosFondoColorVal instanceof HTMLInputElement) {
          const picker = document.getElementById('marca-fondo-nosotros-valor-picker');
          if (picker instanceof HTMLInputElement) {
            nosotrosFondoColorVal.value = picker.value;
          }
        }
        if (nosotrosFondoTipo instanceof HTMLSelectElement && nosotrosFondoTipo.value !== 'color') {
          nosotrosFondoTipo.value = 'color';
          syncNosotrosFondoUi();
        } else {
          syncNosotrosFondoHidden();
        }
      },
      { signal },
    );
  syncNosotrosFondoUi();

  // Nosotros layout cards
  (() => {
    const themeInput = document.querySelector('[data-nosotros-theme-input]');
    const options = document.querySelectorAll('[data-nosotros-layout-option]');
    if (!(themeInput instanceof HTMLInputElement) || !options.length) return;

    const syncLayout = () => {
      const checked = document.querySelector('[data-nosotros-layout-option]:checked');
      if (!(checked instanceof HTMLInputElement)) return;
      themeInput.value = checked.dataset.nosotrosTheme || 'editorial';
      options.forEach((el) => {
        const label = el.closest('label');
        if (!(label instanceof HTMLElement)) return;
        const on = el instanceof HTMLInputElement && el.checked;
        syncStudioLayoutCard(label, on);
        syncStudioLayoutBadge(label.querySelector('[data-nosotros-layout-activo]'), on);
      });
    };

    options.forEach((el) => el.addEventListener('change', syncLayout));
    syncLayout();
  })();

  (() => {
    const accent = document.getElementById('marca-color-primario');
    const root = document.querySelector('[data-marca-nosotros-controls]');
    if (!(accent instanceof HTMLInputElement) || !(root instanceof HTMLElement)) return;
    const sync = () => {
      const v = accent.value.trim();
      if (v) root.style.setProperty('--color-acento', v);
    };
    accent.addEventListener('input', sync);
    accent.addEventListener('change', sync);
    sync();
  })();

  const ubicacionFondoTipo = document.getElementById('marca-fondo-ubicacion-tipo');
  const ubicacionFondoColorWrap = document.querySelector('[data-ubicacion-fondo-color]');
  const ubicacionFondoUrlWrap = document.querySelector('[data-ubicacion-fondo-url]');
  const ubicacionFondoUrlLabel = document.querySelector('[data-ubicacion-fondo-url-label]');
  const ubicacionFondoColorVal = document.getElementById('marca-fondo-ubicacion-valor-color');
  const ubicacionFondoUrlVal = document.getElementById('marca-fondo-ubicacion-valor-url');
  const ubicacionFondoHidden = document.getElementById('marca-fondo-ubicacion-valor');

  const syncUbicacionFondoHidden = () => {
    if (!(ubicacionFondoHidden instanceof HTMLInputElement)) return;
    if (!(ubicacionFondoTipo instanceof HTMLSelectElement)) return;
    const isColor = ubicacionFondoTipo.value === 'color';
    const colorVal =
      ubicacionFondoColorVal instanceof HTMLInputElement ? ubicacionFondoColorVal.value.trim() : '';
    const urlVal =
      ubicacionFondoUrlVal instanceof HTMLInputElement ? ubicacionFondoUrlVal.value.trim() : '';
    ubicacionFondoHidden.value = isColor ? colorVal : urlVal;
    const panelFondo = document.getElementById('marca-ubicacion-color-fondo');
    if (panelFondo instanceof HTMLInputElement && isColor) {
      panelFondo.value = colorVal;
    }
  };

  const syncUbicacionFondoUi = () => {
    if (!(ubicacionFondoTipo instanceof HTMLSelectElement)) return;
    const tipo = ubicacionFondoTipo.value;
    if (ubicacionFondoColorWrap instanceof HTMLElement) {
      ubicacionFondoColorWrap.hidden = tipo !== 'color';
    }
    if (ubicacionFondoUrlWrap instanceof HTMLElement) {
      ubicacionFondoUrlWrap.hidden = tipo === 'color';
    }
    if (ubicacionFondoUrlLabel instanceof HTMLElement) {
      ubicacionFondoUrlLabel.textContent = tipo === 'video' ? 'URL del video' : 'URL de la imagen';
    }
    syncUbicacionFondoHidden();
  };

  ubicacionFondoTipo?.addEventListener('change', syncUbicacionFondoUi, { signal });
  ubicacionFondoColorVal?.addEventListener('input', syncUbicacionFondoHidden, { signal });
  ubicacionFondoUrlVal?.addEventListener('input', syncUbicacionFondoHidden, { signal });
  document
    .getElementById('marca-fondo-ubicacion-valor-picker')
    ?.addEventListener(
      'input',
      () => {
        if (ubicacionFondoColorVal instanceof HTMLInputElement) {
          const picker = document.getElementById('marca-fondo-ubicacion-valor-picker');
          if (picker instanceof HTMLInputElement) {
            ubicacionFondoColorVal.value = picker.value;
          }
        }
        syncUbicacionFondoHidden();
      },
      { signal },
    );
  syncUbicacionFondoUi();

  const colorFieldVal = (id) => {
    const el = document.getElementById(id);
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      return String(el.value || '').trim();
    }
    return '';
  };

  const setColorPairValue = (textId, pickerId, value) => {
    const text = document.getElementById(textId);
    const picker = document.getElementById(pickerId);
    let v = String(value || '').trim();
    if (v && v[0] !== '#') v = `#${v}`;
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return;
    const full =
      v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;
    if (text instanceof HTMLInputElement) text.value = full;
    if (picker instanceof HTMLInputElement) picker.value = full;
  };

  const firstHexIn = (raw) => {
    const m = String(raw || '').match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
    return m ? `#${m[1]}` : '';
  };

  document
    .querySelector('[data-copy-home-colors-ubicacion]')
    ?.addEventListener(
      'click',
      () => {
        const titulo =
          colorFieldVal('marca-home-titulo-color') ||
          colorFieldVal('marca-color-texto') ||
          '#ffffff';
        const cuerpo =
          colorFieldVal('marca-home-eslogan-color') ||
          colorFieldVal('marca-home-subtexto-color') ||
          '#d4d4d8';
        const acento =
          colorFieldVal('marca-color-primario') || '#9f1239';
        const homeFondo =
          firstHexIn(colorFieldVal('marca-fondo-home-valor')) || '#0a0a0a';

        setColorPairValue(
          'marca-ubicacion-color-titulo',
          'marca-ubicacion-color-titulo-picker',
          titulo,
        );
        setColorPairValue(
          'marca-ubicacion-color-cuerpo',
          'marca-ubicacion-color-cuerpo-picker',
          cuerpo,
        );
        setColorPairValue(
          'marca-ubicacion-color-acento',
          'marca-ubicacion-color-acento-picker',
          acento,
        );

        if (ubicacionFondoTipo instanceof HTMLSelectElement) {
          ubicacionFondoTipo.value = 'color';
        }
        setColorPairValue(
          'marca-fondo-ubicacion-valor-color',
          'marca-fondo-ubicacion-valor-picker',
          homeFondo,
        );
        syncUbicacionFondoUi();
        checkMarcaDirtyAndAutosave();
      },
      { signal },
    );

  const syncMenuLegacyFields = () => {
    const tituloSel = document.getElementById('marca-menu-fuente-titulo');
    const fontHidden = document.getElementById('marca-menu-font');
    if (tituloSel instanceof HTMLSelectElement && fontHidden instanceof HTMLInputElement) {
      const opt = tituloSel.selectedOptions[0];
      const family = String(opt?.dataset.family || 'Playfair Display').trim();
      fontHidden.value = family;
    }
  };

  const menuFuenteTitulo = document.getElementById('marca-menu-fuente-titulo');
  menuFuenteTitulo?.addEventListener('change', syncMenuLegacyFields, { signal });
  syncMenuLegacyFields();

  /** Actualiza label/placeholder del valor de fondo Home según tipo */
  const fondoHomeTipo = document.getElementById('marca-fondo-home-tipo');
  const fondoHomeValor = document.getElementById('marca-fondo-home-valor');
  const fondoHomeLabel = document.querySelector('[data-fondo-valor-label="home"]');
  const syncFondoHomeValorUi = () => {
    if (!(fondoHomeTipo instanceof HTMLSelectElement)) return;
    if (!(fondoHomeValor instanceof HTMLTextAreaElement)) return;
    const t = fondoHomeTipo.value;
    const meta = {
      color: {
        label: 'Fondo Valor',
        placeholder: '#0a0a0a',
        rows: 2,
      },
      image: {
        label: 'Media URL',
        placeholder: 'https://…/imagen.jpg',
        rows: 2,
      },
      carrusel: {
        label: 'Fondo Valor (URLs)',
        placeholder: 'https://…/foto1.jpg\nhttps://…/foto2.jpg',
        rows: 3,
      },
      video: {
        label: 'Media URL',
        placeholder: 'https://…/video.mp4',
        rows: 2,
      },
    }[t] || {
      label: 'Fondo Valor',
      placeholder: '',
      rows: 2,
    };
    if (fondoHomeLabel) fondoHomeLabel.textContent = meta.label;
    fondoHomeValor.placeholder = meta.placeholder;
    fondoHomeValor.rows = meta.rows;
  };
  fondoHomeTipo?.addEventListener('change', syncFondoHomeValorUi, { signal });
  syncFondoHomeValorUi();

  /** Mostrar slider de opacidad con Filtro Oscuro o Cinemático */
  const overlayEstiloSelect = document.getElementById('marca-home-overlay-estilo');
  const overlayOscuroControls = document.querySelector('[data-overlay-oscuro-controls]');
  const syncOverlayEstiloUi = () => {
    if (!(overlayEstiloSelect instanceof HTMLSelectElement)) return;
    if (!(overlayOscuroControls instanceof HTMLElement)) return;
    const v = overlayEstiloSelect.value;
    overlayOscuroControls.hidden = v !== 'oscuro' && v !== 'cinematico';
  };
  overlayEstiloSelect?.addEventListener('change', syncOverlayEstiloUi, { signal });
  syncOverlayEstiloUi();

  const overlayOpacityRange = document.querySelector('[data-overlay-opacity-range]');
  const overlayOpacityVal = document.getElementById('overlay-opacity-val');
  const syncOverlayOpacityVal = () => {
    if (!(overlayOpacityRange instanceof HTMLInputElement)) return;
    if (overlayOpacityVal instanceof HTMLElement) {
      overlayOpacityVal.textContent = `${overlayOpacityRange.value}%`;
    }
  };
  overlayOpacityRange?.addEventListener('input', syncOverlayOpacityVal, { signal });
  overlayOpacityRange?.addEventListener('change', syncOverlayOpacityVal, { signal });
  syncOverlayOpacityVal();

  // Sync number readouts ↔ range sliders (Escalas sizes + overlay)
  const pxSliderRoot = marcaForm instanceof HTMLElement ? marcaForm : document;
  pxSliderRoot.querySelectorAll('[data-px-slider-for]').forEach((slider) => {
    if (!(slider instanceof HTMLInputElement)) return;
    const inputId = slider.dataset.pxSliderFor;
    if (!inputId?.startsWith('marca-home-')) return;
    const numberInput = document.getElementById(inputId);
    if (!(numberInput instanceof HTMLInputElement)) return;

    const readBounds = () => {
      const min = Number(numberInput.min);
      const max = Number(numberInput.max);
      return {
        min: Number.isFinite(min) ? min : Number(slider.min) || 0,
        max: Number.isFinite(max) ? max : Number(slider.max) || 9999,
      };
    };

    const syncPxDisplay = (value) => {
      document.querySelectorAll(`[data-px-value-for="${inputId}"]`).forEach((el) => {
        if (el instanceof HTMLElement) el.textContent = String(value);
      });
    };

    const clamp = () => {
      const { min, max } = readBounds();
      let n = Math.round(Number(numberInput.value));
      if (!Number.isFinite(n)) n = min;
      n = Math.min(max, Math.max(min, n));
      numberInput.value = String(n);
      slider.min = String(min);
      slider.max = String(max);
      slider.value = String(n);
      syncPxDisplay(n);
    };

    slider.addEventListener('input', () => {
      numberInput.value = slider.value;
      syncPxDisplay(slider.value);
    }, { signal });
    numberInput.addEventListener('input', () => {
      const raw = String(numberInput.value || '').trim();
      if (raw === '' || raw === '-' || raw === '+') return;
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      const { min, max } = readBounds();
      const clamped = Math.min(max, Math.max(min, Math.round(n)));
      slider.value = String(clamped);
      syncPxDisplay(clamped);
    }, { signal });
    numberInput.addEventListener('change', clamp, { signal });
    numberInput.addEventListener('blur', clamp, { signal });
    clamp();
  });

  // Sub-tabs Identidad de Marca
  const marcaSubtabs = document.querySelectorAll('[data-marca-subtab]');
  const marcaPanels = document.querySelectorAll('[data-marca-panel]');

  /**
   * @param {string} id
   */
  function setMarcaSubtab(id) {
    const subOn =
      'marca-subtab shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all bg-white/10 text-white';
    const subOff =
      'marca-subtab shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all text-zinc-400 hover:bg-white/5 hover:text-white';
    marcaSubtabs.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const active = btn.dataset.marcaSubtab === id;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.className = active ? subOn : subOff;
    });
    marcaPanels.forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      const active = panel.dataset.marcaPanel === id;
      panel.hidden = !active;
      if (active) {
        panel.style.overflow = 'visible';
        playFadeInUp(panel);
      }
    });
    try {
      sessionStorage.setItem('xemilla-admin-marca-subtab', id);
    } catch {
      /* ignore */
    }
  }

  marcaSubtabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!(btn instanceof HTMLElement)) return;
      setMarcaSubtab(btn.dataset.marcaSubtab || 'home');
    }, { signal });
  });
  try {
    const savedSub = sessionStorage.getItem('xemilla-admin-marca-subtab');
    const subId = savedSub === 'perfil' ? 'ubicacion' : savedSub;
    if (subId && [...marcaSubtabs].some((b) => b instanceof HTMLElement && b.dataset.marcaSubtab === subId)) {
      setMarcaSubtab(subId);
    }
  } catch {
    /* ignore */
  }

  // Bloques editoriales Nosotros (add / remove)
  const bloquesList = document.getElementById('nosotros-bloques-list');
  const addBloqueBtn = document.getElementById('nosotros-add-bloque');
  const fieldClassJs =
    'w-full rounded-xl px-3.5 py-2 text-xs sm:text-sm outline-none transition-all bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-white dark:placeholder:text-zinc-600 focus:dark:border-zinc-600';
  const labelClassJs = 'text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-zinc-500';

  function renumberBloques() {
    if (!(bloquesList instanceof HTMLElement)) return;
    bloquesList.querySelectorAll('[data-nosotros-bloque]').forEach((el, i) => {
      const title = el.querySelector('.nosotros-bloque__kicker');
      if (title instanceof HTMLElement) {
        title.textContent = `Bloque ${i + 1}`;
      }
    });
  }

  function setBloqueUrlPanel(card, open) {
    if (!(card instanceof HTMLElement)) return;
    const panel = card.querySelector('[data-bloque-media-url-panel]');
    if (!(panel instanceof HTMLElement)) return;
    panel.hidden = !open;
    if (open) {
      const input = panel.querySelector('[data-bloque-media-url]');
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    }
  }

  function syncBloqueMediaPreview(card) {
    if (!(card instanceof HTMLElement)) return;
    const primary = card.querySelector('input[data-bloque-media-url]');
    const img = card.querySelector('[data-bloque-media-preview-img]');
    const ph = card.querySelector('[data-bloque-media-preview-ph]');
    if (!(primary instanceof HTMLInputElement)) return;
    const url = primary.value.trim();
    if (img instanceof HTMLImageElement) {
      if (!url) {
        img.hidden = true;
        img.removeAttribute('src');
      } else {
        img.hidden = false;
        if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      }
    }
    if (ph instanceof HTMLElement) ph.hidden = Boolean(url);
  }

  function autoResizeTextarea(ta) {
    if (!(ta instanceof HTMLTextAreaElement)) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight, 110)}px`;
  }

  function wireBloqueCard(card) {
    if (!(card instanceof HTMLElement)) return;
    card.querySelectorAll('textarea[data-auto-resize], textarea[data-bloque-texto]').forEach((ta) => {
      if (!(ta instanceof HTMLTextAreaElement)) return;
      autoResizeTextarea(ta);
      ta.addEventListener('input', () => autoResizeTextarea(ta), { signal });
    });
    const primary = card.querySelector('input[data-bloque-media-url]');
    primary?.addEventListener('input', () => syncBloqueMediaPreview(card), { signal });
    syncBloqueMediaPreview(card);
  }

  function createBloqueEl(index = 1) {
    const wrap = document.createElement('div');
    wrap.className =
      'nosotros-bloque rounded-xl border border-white/15 bg-transparent p-3.5 space-y-3';
    wrap.dataset.nosotrosBloque = '';
    wrap.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <p class="nosotros-bloque__kicker text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-neutral-400">Bloque ${index}</p>
        <button type="button" class="inline-flex items-center justify-center rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500" data-remove-bloque aria-label="Eliminar bloque" title="Eliminar bloque">
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M4 7h16" stroke-linecap="round" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke-linecap="round" /><path d="M6.5 7l.8 12.2A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7" stroke-linecap="round" stroke-linejoin="round" /><path d="M10 11v6M14 11v6" stroke-linecap="round" /></svg>
        </button>
      </div>
      <div class="relative flex items-center gap-4 rounded-xl border border-white/12 bg-transparent px-3 py-3">
        <div class="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white/[0.03]" data-bloque-media-preview aria-hidden="true">
          <img class="size-full object-cover" data-bloque-media-preview-img alt="" hidden />
          <span class="flex h-full w-full items-center justify-center text-neutral-400" data-bloque-media-preview-ph>
            <svg class="h-6 w-6 shrink-0 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4.5 7.5h2.2l1.1-1.8h8.4l1.1 1.8h2.2A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V9a1.5 1.5 0 0 1 1.5-1.5Z" stroke-linejoin="round" /><circle cx="12" cy="13.25" r="3.25" /></svg>
          </span>
        </div>
        <div class="min-w-0 flex-1 space-y-2">
          <p class="text-[0.7rem] font-medium text-zinc-200">Imagen del bloque</p>
          <div class="flex flex-wrap gap-2">
            <label class="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white transition hover:border-white/30 hover:bg-white/[0.06]">
              Cambiar
              <input type="file" accept="image/*,video/*" class="sr-only" data-bloque-media-file />
            </label>
            <button type="button" class="rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-zinc-400 transition hover:border-white/30 hover:text-zinc-200" data-bloque-media-url-toggle>URL</button>
          </div>
        </div>
        <div class="absolute inset-x-3 top-[calc(100%-0.35rem)] z-20 rounded-xl border border-white/15 bg-zinc-950/95 p-3 shadow-xl backdrop-blur-md" data-bloque-media-url-panel hidden>
          <div class="block space-y-1.5">
            <span class="${labelClassJs}">Pegar URL de imagen</span>
            <input type="url" inputmode="url" data-bloque-media data-bloque-media-url placeholder="https://…" autocomplete="off" class="${fieldClassJs}" />
          </div>
          <div class="mt-2 flex justify-end gap-2">
            <button type="button" class="rounded-lg px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-neutral-400 transition hover:text-zinc-200" data-bloque-media-url-cancel>Cerrar</button>
            <button type="button" class="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-white/10" data-bloque-media-url-done>Listo</button>
          </div>
        </div>
        <div class="sr-only" data-bloque-media-list aria-hidden="true"></div>
      </div>
      <div class="block space-y-1.5">
        <label class="${labelClassJs}" for="bloque-titulo-new-${index}">Título</label>
        <input type="text" id="bloque-titulo-new-${index}" data-bloque-titulo placeholder="Título del bloque" autocomplete="off" spellcheck="true" class="${fieldClassJs}" />
      </div>
      <label class="block space-y-1.5">
        <span class="${labelClassJs}">Alineación</span>
        <select data-bloque-alineacion class="${fieldClassJs}">
          <option value="izquierda">Izquierda</option>
          <option value="derecha" selected>Derecha</option>
          <option value="centro">Centro</option>
        </select>
      </label>
      <label class="block space-y-1.5">
        <span class="${labelClassJs}">Texto</span>
        <textarea data-bloque-texto rows="4" class="${fieldClassJs} min-h-[110px] resize-y px-3 py-2.5 text-[0.8rem] leading-relaxed" data-auto-resize></textarea>
      </label>
    `;
    stampAstroScopeTree(wrap);
    wireBloqueCard(wrap);
    return wrap;
  }

  function collectMediaUrls(card) {
    /** @type {string[]} */
    const out = [];
    if (!(card instanceof HTMLElement)) return out;
    const primary = card.querySelector('input[data-bloque-media-url]');
    if (primary instanceof HTMLInputElement) {
      const url = primary.value.trim();
      if (url) out.push(url);
    }
    card.querySelectorAll('input[data-bloque-media]').forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      if (input.matches('[data-bloque-media-url]')) return;
      const url = input.value.trim();
      if (!url || out.length >= 3) return;
      out.push(url);
    });
    return out;
  }

  function normalizeAlineacionClient(value) {
    const a = String(value || '').trim().toLowerCase();
    if (a === 'centro' || a === 'center') return 'centro';
    if (a === 'izquierda' || a === 'left' || a === 'inversa') return 'izquierda';
    return 'derecha';
  }

  function collectNosotrosBloques() {
    const list =
      document.getElementById('nosotros-bloques-list') ||
      (bloquesList instanceof HTMLElement ? bloquesList : null);
    if (!(list instanceof HTMLElement)) return [];

    const cards = Array.from(list.querySelectorAll('[data-nosotros-bloque]'));
    const seen = new Set();

    return cards
      .map((el) => {
        if (!(el instanceof HTMLElement) || seen.has(el)) return null;
        seen.add(el);
        const tituloRaw =
          /** @type {HTMLInputElement | null} */ (el.querySelector('[data-bloque-titulo]'))
            ?.value || '';
        const texto =
          /** @type {HTMLTextAreaElement | null} */ (el.querySelector('[data-bloque-texto]'))
            ?.value || '';
        const media = collectMediaUrls(el);
        let titulo = String(tituloRaw).trim();
        // Si el título quedó contaminado con una URL, muévela a media
        if (/^https?:\/\//i.test(titulo) || /res\.cloudinary\.com/i.test(titulo)) {
          if (titulo && media.length < 3 && !media.includes(titulo)) media.unshift(titulo);
          titulo = '';
        }
        const alineacion = normalizeAlineacionClient(
          /** @type {HTMLSelectElement | null} */ (el.querySelector('[data-bloque-alineacion]'))
            ?.value || 'derecha',
        );
        return {
          titulo,
          texto: texto.trim(),
          media_url: media[0] || '',
          media,
          alineacion,
        };
      })
      .filter((b) => b && (b.titulo || b.texto || (b.media && b.media.length > 0)));
  }

  /** @type {string} */
  let marcaSnapshotBaseline = '';
  /** @type {string} */
  let marcaLastSavedSnapshot = '';

  function collectMarcaSnapshot() {
    if (!(marcaForm instanceof HTMLFormElement)) return '';
    /** @type {string[]} */
    const parts = [];
    marcaForm.querySelectorAll('input, textarea, select').forEach((el) => {
      if (el instanceof HTMLInputElement) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          parts.push(`${el.name || el.id || 'cb'}:${el.checked}`);
        } else if (el.type !== 'file') {
          parts.push(`${el.name || el.id || 'in'}:${el.value}`);
        }
      } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        parts.push(`${el.name || el.id || 'fld'}:${el.value}`);
      }
    });
    parts.push(`bloques:${JSON.stringify(collectNosotrosBloques())}`);
    return parts.join('\n');
  }

  /** @param {'idle' | 'dirty' | 'saved'} state */
  function setMarcaSaveState(state, btn = marcaSave) {
    if (!(btn instanceof HTMLButtonElement)) return;
    btn.dataset.saveState = state;
    if (btn.disabled) return;
    const label = state === 'saved' ? 'Guardado' : 'Guardar';
    const desktop = btn.querySelector('.marca-save-label');
    if (desktop instanceof HTMLElement) {
      desktop.textContent = label;
    } else {
      // Fallback si el markup viejo ya fue aplanado
      btn.replaceChildren();
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'size-4 sm:hidden');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.8');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML =
        '<path d="M5 5h11l3 3v11H5V5z"></path><path d="M8 5v4h8V5"></path><path d="M8 19v-6h8v6"></path>';
      const span = document.createElement('span');
      span.className = 'marca-save-label hidden sm:inline';
      span.textContent = label;
      btn.append(svg, span);
    }
    btn.setAttribute('aria-label', label === 'Guardado' ? 'Cambios guardados' : 'Guardar cambios');
  }

  function checkMarcaDirty() {
    if (!(marcaSave instanceof HTMLButtonElement)) return;
    const current = collectMarcaSnapshot();
    if (current !== marcaSnapshotBaseline) {
      setMarcaSaveState('dirty');
      return;
    }
    setMarcaSaveState(
      marcaLastSavedSnapshot && marcaLastSavedSnapshot === marcaSnapshotBaseline
        ? 'saved'
        : 'idle',
    );
  }

  function markMarcaSaved() {
    marcaSnapshotBaseline = collectMarcaSnapshot();
    marcaLastSavedSnapshot = marcaSnapshotBaseline;
    setMarcaSaveState('saved');
  }

  function initMarcaSaveState() {
    marcaSnapshotBaseline = collectMarcaSnapshot();
    marcaLastSavedSnapshot = '';
    setMarcaSaveState('idle');
  }

  /** @type {ReturnType<typeof setTimeout> | null} */
  let marcaAutosaveTimer = null;
  let marcaAutosaveBusy = false;
  let marcaAutosaveQueued = false;

  function scheduleMarcaAutosave() {
    if (!(marcaSave instanceof HTMLButtonElement)) return;
    if (marcaSave.hidden) return;
    if (marcaAutosaveTimer) clearTimeout(marcaAutosaveTimer);
    marcaAutosaveTimer = setTimeout(() => {
      void flushMarcaAutosave();
    }, 1100);
  }

  async function flushMarcaAutosave() {
    if (marcaAutosaveBusy) {
      marcaAutosaveQueued = true;
      return;
    }
    if (!(marcaSave instanceof HTMLButtonElement) || marcaSave.hidden) return;
    if (marcaSave.dataset.saveState !== 'dirty') return;
    marcaAutosaveBusy = true;
    try {
      await saveIdentidadMarca({ silent: true });
    } finally {
      marcaAutosaveBusy = false;
      if (marcaAutosaveQueued) {
        marcaAutosaveQueued = false;
        scheduleMarcaAutosave();
      }
    }
  }

  function checkMarcaDirtyAndAutosave() {
    checkMarcaDirty();
    if (marcaSave instanceof HTMLButtonElement && marcaSave.dataset.saveState === 'dirty') {
      scheduleMarcaAutosave();
    }
  }

  marcaForm?.addEventListener('input', checkMarcaDirtyAndAutosave, { signal });
  marcaForm?.addEventListener('change', checkMarcaDirtyAndAutosave, { signal });
  requestAnimationFrame(() => initMarcaSaveState());

  function collectCategoriasFondos() {
    const navEl = document.getElementById('marca-menu-navegacion');
    const navValue =
      navEl instanceof HTMLInputElement || navEl instanceof HTMLSelectElement
        ? navEl.value
        : '';
    const hubNav = navValue === 'hub_categories';
    const selector = hubNav ? '[data-cat-hub-portal]' : '[data-cat-fondo]';
    return Array.from(document.querySelectorAll(selector))
      .map((el) => {
        if (!(el instanceof HTMLElement)) return null;
        const id = el.dataset.catId;
        const bg_type_raw =
          /** @type {HTMLSelectElement | null} */ (el.querySelector('[data-cat-bg-type]'))
            ?.value || 'color';
        const bg_type =
          bg_type_raw === 'image' ? 'image' : bg_type_raw === 'video' ? 'video' : 'color';
        let bg_valor = '';
        if (bg_type === 'image' || bg_type === 'video') {
          bg_valor =
            /** @type {HTMLInputElement | null} */ (
              el.querySelector('[data-cat-bg-valor-url]')
            )?.value?.trim() || '';
        } else {
          bg_valor =
            /** @type {HTMLInputElement | null} */ (
              el.querySelector('[data-cat-bg-valor-color]')
            )?.value?.trim() ||
            /** @type {HTMLInputElement | null} */ (
              el.querySelector('[data-cat-bg-color-picker]')
            )?.value?.trim() ||
            '';
        }
        return { id, bg_type, bg_valor };
      })
      .filter(Boolean);
  }

  function syncCatBgPreview(row) {
    if (!(row instanceof HTMLElement)) return;
    const type =
      /** @type {HTMLSelectElement | null} */ (row.querySelector('[data-cat-bg-type]'))?.value ||
      'color';
    const url =
      /** @type {HTMLInputElement | null} */ (row.querySelector('[data-cat-bg-valor-url]'))
        ?.value?.trim() || '';
    const img = row.querySelector('[data-cat-bg-preview-img]');
    const ph = row.querySelector('[data-cat-bg-preview-ph]');
    const showImg = type === 'image' && Boolean(url);
    if (img instanceof HTMLImageElement) {
      if (!showImg) {
        img.hidden = true;
        img.removeAttribute('src');
      } else {
        img.hidden = false;
        if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      }
    }
    if (ph instanceof HTMLElement) ph.hidden = showImg;
  }

  function syncHubPortalCatFields(row) {
    if (!(row instanceof HTMLElement)) return;
    const type =
      /** @type {HTMLSelectElement | null} */ (row.querySelector('[data-cat-bg-type]'))?.value ||
      'color';
    const colorRow = row.querySelector('[data-cat-bg-color-row]');
    const mediaRow = row.querySelector('[data-cat-bg-media-row]');
    const mediaLabel = row.querySelector('[data-cat-bg-media-label]');
    const urlPanel = row.querySelector('[data-cat-bg-url-panel]');
    if (colorRow instanceof HTMLElement) colorRow.hidden = type !== 'color';
    if (mediaRow instanceof HTMLElement) mediaRow.hidden = type === 'color';
    if (mediaLabel instanceof HTMLElement) {
      mediaLabel.textContent =
        type === 'video' ? 'URL video' : type === 'image' ? 'URL imagen' : 'URL';
    }
    if (type === 'color' && urlPanel instanceof HTMLElement) {
      urlPanel.hidden = true;
      urlPanel.classList.add('hidden');
    }
    syncCatBgPreview(row);
  }

  function wireCatBgRow(row) {
    if (!(row instanceof HTMLElement)) return;
    syncHubPortalCatFields(row);

    const typeSelect = row.querySelector('[data-cat-bg-type]');
    typeSelect?.addEventListener(
      'change',
      () => {
        syncHubPortalCatFields(row);
      },
      { signal },
    );

    const picker = row.querySelector('[data-cat-bg-color-picker]');
    const hex = row.querySelector('[data-cat-bg-valor-color]');
    if (picker instanceof HTMLInputElement && hex instanceof HTMLInputElement) {
      picker.addEventListener(
        'input',
        () => {
          picker.dataset.touched = '1';
          hex.value = picker.value;
        },
        { signal },
      );
      hex.addEventListener(
        'input',
        () => {
          let v = hex.value.trim();
          if (v && v[0] !== '#') v = `#${v}`;
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
            picker.value =
              v.length === 4
                ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
                : v;
            hex.value = picker.value;
          }
        },
        { signal },
      );
    }

    const urlInput = row.querySelector('[data-cat-bg-valor-url]');
    const urlPanel = row.querySelector('[data-cat-bg-url-panel]');
    const setUrlPanel = (open) => {
      if (!(urlPanel instanceof HTMLElement)) return;
      urlPanel.hidden = !open;
      urlPanel.classList.toggle('hidden', !open);
      if (open && urlInput instanceof HTMLInputElement) {
        urlInput.focus();
        urlInput.select();
      }
    };

    row.querySelector('[data-cat-bg-url-toggle]')?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        const open = !(urlPanel instanceof HTMLElement) || urlPanel.hidden;
        setUrlPanel(open);
      },
      { signal },
    );
    row.querySelector('[data-cat-bg-url-done]')?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        syncCatBgPreview(row);
        setUrlPanel(false);
      },
      { signal },
    );
    row.querySelector('[data-cat-bg-url-cancel]')?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        setUrlPanel(false);
      },
      { signal },
    );
    urlInput?.addEventListener('input', () => syncCatBgPreview(row), { signal });

    row.querySelector('[data-cat-bg-file]')?.addEventListener(
      'change',
      async (e) => {
        const input = e.target;
        if (!(input instanceof HTMLInputElement)) return;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        try {
          const url =
            typeof uploadHubMedia === 'function'
              ? await uploadHubMedia(file, 'categories')
              : await (async () => {
                  const body = new FormData();
                  body.append('file', file);
                  body.append('restaurante_slug', restauranteSlug);
                  body.append('asset_type', 'categories');
                  if (restauranteId) body.append('restaurante_id', restauranteId);
                  const res = await fetch('/api/upload', { method: 'POST', body });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok || !json.url) throw new Error(json.error || 'No se pudo subir');
                  return String(json.url);
                })();
          const tipo = row.querySelector('[data-cat-bg-type]');
          if (tipo instanceof HTMLSelectElement) {
            tipo.value = file.type.startsWith('video/') ? 'video' : 'image';
          }
          if (urlInput instanceof HTMLInputElement) urlInput.value = url;
          syncHubPortalCatFields(row);
          setUrlPanel(false);
          showToast('Fondo actualizado', 'ok');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Error al subir fondo', 'error');
        }
      },
      { signal },
    );
  }

  function syncMenuNavegacionUi() {
    const nav = document.getElementById('marca-menu-navegacion');
    const hubWrap = document.getElementById('categorias-hub-portal-wrap');
    const navValue =
      nav instanceof HTMLInputElement || nav instanceof HTMLSelectElement
        ? nav.value
        : '';
    const isHub = navValue === 'hub_categories';
    if (hubWrap instanceof HTMLElement) {
      hubWrap.hidden = !isHub;
      hubWrap.classList.toggle('hidden', !isHub);
      hubWrap.setAttribute('aria-hidden', isHub ? 'false' : 'true');
    }
  }

  function collectBoutiqueProductos() {
    return Array.from(document.querySelectorAll('[data-boutique-row]')).map((row, index) => {
      if (!(row instanceof HTMLElement)) {
        return { id: `item-${index + 1}`, nombre: 'Producto', precio: 0, imagen_url: '', activo: false };
      }
      const id =
        /** @type {HTMLInputElement | null} */ (row.querySelector('[data-boutique-id]'))?.value ||
        `item-${index + 1}`;
      const nombre =
        /** @type {HTMLInputElement | null} */ (row.querySelector('[data-boutique-nombre]'))
          ?.value || 'Producto';
      const precioRaw = Number(
        /** @type {HTMLInputElement | null} */ (row.querySelector('[data-boutique-precio]'))
          ?.value || 0,
      );
      const imagen_url =
        /** @type {HTMLInputElement | null} */ (row.querySelector('[data-boutique-imagen]'))
          ?.value || '';
      const activo = Boolean(
        /** @type {HTMLInputElement | null} */ (row.querySelector('[data-boutique-activo]'))
          ?.checked,
      );
      return {
        id,
        nombre,
        precio: Number.isFinite(precioRaw) ? precioRaw : 0,
        imagen_url,
        activo,
      };
    });
  }

  addBloqueBtn?.addEventListener('click', () => {
    if (!(bloquesList instanceof HTMLElement)) return;
    const n = bloquesList.querySelectorAll('[data-nosotros-bloque]').length + 1;
    bloquesList.appendChild(createBloqueEl(n));
    checkMarcaDirtyAndAutosave();
  }, { signal });

  bloquesList?.querySelectorAll('[data-nosotros-bloque]').forEach((card) => {
    if (card instanceof HTMLElement) wireBloqueCard(card);
  });

  bloquesList?.addEventListener('click', (event) => {
    const rawTarget = event.target;
    const target =
      rawTarget instanceof Element
        ? rawTarget
        : rawTarget instanceof Node
          ? rawTarget.parentElement
          : null;
    if (!(target instanceof Element)) return;

    const urlToggle = target.closest('[data-bloque-media-url-toggle]');
    if (urlToggle) {
      event.preventDefault();
      const card = urlToggle.closest('[data-nosotros-bloque]');
      if (!(card instanceof HTMLElement)) return;
      const panel = card.querySelector('[data-bloque-media-url-panel]');
      const isOpen = panel instanceof HTMLElement && !panel.hidden;
      setBloqueUrlPanel(card, !isOpen);
      return;
    }

    const urlDone = target.closest('[data-bloque-media-url-done]');
    if (urlDone) {
      event.preventDefault();
      const card = urlDone.closest('[data-nosotros-bloque]');
      if (!(card instanceof HTMLElement)) return;
      syncBloqueMediaPreview(card);
      setBloqueUrlPanel(card, false);
      checkMarcaDirtyAndAutosave();
      return;
    }

    const urlCancel = target.closest('[data-bloque-media-url-cancel]');
    if (urlCancel) {
      event.preventDefault();
      const card = urlCancel.closest('[data-nosotros-bloque]');
      if (card instanceof HTMLElement) setBloqueUrlPanel(card, false);
      return;
    }

    const btn = target.closest('[data-remove-bloque]');
    if (!btn) return;
    const card = btn.closest('[data-nosotros-bloque]');
    if (!(card instanceof HTMLElement) || !(bloquesList instanceof HTMLElement)) return;
    if (bloquesList.querySelectorAll('[data-nosotros-bloque]').length <= 1) {
      card.querySelectorAll('input, textarea').forEach((input) => {
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
          if (input.type !== 'file') input.value = '';
        }
      });
      const sel = card.querySelector('[data-bloque-alineacion]');
      if (sel instanceof HTMLSelectElement) sel.value = 'derecha';
      syncBloqueMediaPreview(card);
      setBloqueUrlPanel(card, false);
      checkMarcaDirtyAndAutosave();
      return;
    }
    card.remove();
    renumberBloques();
    checkMarcaDirtyAndAutosave();
  }, { signal });

  bloquesList?.addEventListener('change', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'file') return;
    if (!target.matches('[data-bloque-media-file]')) return;
    const card = target.closest('[data-nosotros-bloque]');
    const file = target.files?.[0];
    target.value = '';
    if (!file || !(card instanceof HTMLElement)) return;
    try {
      const url =
        typeof uploadHubMedia === 'function'
          ? await uploadHubMedia(file, 'identity')
          : await (async () => {
              const body = new FormData();
              body.append('file', file);
              body.append('restaurante_slug', restauranteSlug);
              body.append('asset_type', 'identity');
              if (restauranteId) body.append('restaurante_id', restauranteId);
              const res = await fetch('/api/upload', { method: 'POST', body });
              const json = await res.json().catch(() => ({}));
              if (!res.ok || !json.url) throw new Error(json.error || 'No se pudo subir');
              return String(json.url);
            })();
      const primary = card.querySelector('input[data-bloque-media-url]');
      if (primary instanceof HTMLInputElement) {
        primary.value = url;
        primary.dispatchEvent(new Event('input', { bubbles: true }));
      }
      syncBloqueMediaPreview(card);
      setBloqueUrlPanel(card, false);
      checkMarcaDirtyAndAutosave();
      showToast('Media actualizada', 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al subir media', 'error');
    }
  }, { signal });

  const syncOperationalGadgetsUi = () => {
    const wifi = document.getElementById('marca-gadget-wifi');
    const boutique = document.getElementById('marca-gadget-boutique');
    const on =
      (wifi instanceof HTMLInputElement && wifi.checked) ||
      (boutique instanceof HTMLInputElement && boutique.checked);
    document.querySelectorAll('[data-shows-when-operational-gadgets]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.classList.toggle('hidden', !on);
      el.hidden = !on;
    });
  };

  // Sync visual ios-toggle + tarjetas gadget (switches reales del catálogo)
  document.querySelectorAll('[data-marca-gadget]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    const isGadgetSwitch = input.hasAttribute('data-gadget-switch');
    const ui = document.querySelector(`[data-marca-toggle-ui][data-for="${input.id}"]`);
    const card = isGadgetSwitch ? input.closest('[data-gadget-card]') : null;
    const config = card?.querySelector('[data-gadget-config]');

    const sync = () => {
      const on = input.checked;
      if (ui instanceof HTMLElement) ui.classList.toggle('is-on', on);
      input.setAttribute('aria-checked', on ? 'true' : 'false');

      if (card instanceof HTMLElement) {
        card.classList.toggle('gadget-card--on', on);
        card.classList.toggle('is-active', on);
      }

      if (config instanceof HTMLElement) {
        config.classList.toggle('is-open', on);
        config.setAttribute('aria-hidden', on ? 'false' : 'true');
      }

      if (isGadgetSwitch) {
        if (
          input.id === 'marca-gadget-wifi' ||
          input.id === 'marca-gadget-boutique'
        ) {
          syncOperationalGadgetsUi();
        }
      }

      if (input.id === 'marca-menu-fondos-cinematicos') {
        const wrap = document.getElementById('categorias-fondos-wrap');
        const fondoGeneral = document.getElementById('menu-fondo-general');
        if (wrap instanceof HTMLElement) {
          wrap.hidden = !on;
          wrap.classList.toggle('hidden', !on);
          wrap.classList.remove('opacity-50', 'pointer-events-none');
          wrap.setAttribute('aria-hidden', on ? 'false' : 'true');
        }
        if (fondoGeneral instanceof HTMLElement) fondoGeneral.hidden = on;
      }

      if (input.id === 'marca-gadget-nutricion') {
        document.querySelectorAll('[data-shows-when-nutricion]').forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          el.classList.toggle('hidden', !on);
          el.hidden = !on;
        });
        if (root instanceof HTMLElement) root.dataset.gadgetNutricion = on ? 'true' : 'false';
        if (!on) setNutricionBulkPanelOpen(false);
      }

      if (input.id === 'marca-gadget-ar') {
        if (root instanceof HTMLElement) root.dataset.gadgetAr = on ? 'true' : 'false';
        document.querySelectorAll('[data-shows-when-ar]').forEach((el) => {
          if (!(el instanceof HTMLElement)) return;
          el.classList.toggle('hidden', !on);
          el.hidden = !on;
        });
      }
    };

    input.addEventListener('click', (e) => e.stopPropagation(), { signal });
    input.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter') e.preventDefault();
      },
      { signal },
    );
    input.addEventListener('change', sync, { signal });
    sync();
  });

  syncOperationalGadgetsUi();

  document.querySelectorAll('[data-gadget-config-inner]').forEach((panel) => {
    panel.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
      },
      { signal },
    );
  });

  const menuNavSelect = document.getElementById('marca-menu-navegacion');
  menuNavSelect?.addEventListener('change', syncMenuNavegacionUi, { signal });
  syncMenuNavegacionUi();

  document.querySelectorAll('[data-cat-hub-portal], [data-cat-fondo]').forEach((row) => {
    wireCatBgRow(row);
  });

  // QR Panel gestionado por bloque standalone astro:page-load (ver más abajo)

  async function saveIdentidadMarca(opts = {}) {
    const silent = Boolean(opts?.silent);
    const saveBtn =
      document.getElementById('marca-save') instanceof HTMLButtonElement
        ? /** @type {HTMLButtonElement} */ (document.getElementById('marca-save'))
        : marcaSave instanceof HTMLButtonElement
          ? marcaSave
          : null;

    if (!saveBtn) {
      if (!silent) showToast('Botón Guardar no disponible', 'error');
      return false;
    }
    if (!restauranteId) {
      if (!silent) showToast('Restaurante no disponible', 'error');
      return false;
    }

    const val = (id) => {
      const el = document.getElementById(id);
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        return el.value;
      }
      return '';
    };

    const checked = (id) => {
      const el = document.getElementById(id);
      return el instanceof HTMLInputElement ? el.checked : false;
    };

    if (typeof flushColorPairsForSave === 'function') flushColorPairsForSave();
    if (typeof syncMenuFondoHidden === 'function') syncMenuFondoHidden();
    if (typeof syncNosotrosFondoHidden === 'function') syncNosotrosFondoHidden();
    if (typeof syncUbicacionFondoHidden === 'function') syncUbicacionFondoHidden();
    if (typeof syncMenuLegacyFields === 'function') syncMenuLegacyFields();
    // Marca es la fuente al guardar Identidad — no pisar con perfil.
    // Tras éxito syncLocalOps('marca') alinea Ops.

    const nosotrosBloquesPayload = collectNosotrosBloques();
    const nosotrosLayoutEl = document.querySelector('[data-nosotros-layout-option]:checked');
    const nosotrosLayoutPayload =
      nosotrosLayoutEl instanceof HTMLInputElement
        ? nosotrosLayoutEl.value
        : 'editorial';
    const nosotrosThemePayload = val('marca-nosotros-theme') || 'editorial';

    const fondoHomeTipo = val('marca-fondo-home-tipo') || 'color';
    const fondoHomeValor = val('marca-fondo-home-valor');
    const colorFondoHex =
      fondoHomeTipo === 'color'
        ? fondoHomeValor
        : val('marca-color-fondo') || '#0a0a0a';

    if (!silent) {
      saveBtn.disabled = true;
      const labelEl = saveBtn.querySelector('.marca-save-label');
      if (labelEl instanceof HTMLElement) labelEl.textContent = 'Guardando…';
      else saveBtn.setAttribute('aria-label', 'Guardando…');
      showToast('Guardando identidad…', 'ok');
    } else {
      saveBtn.dataset.saveState = 'dirty';
      saveBtn.setAttribute('aria-label', 'Guardando…');
    }
    if (marcaFeedback) {
      marcaFeedback.classList.add('hidden');
      marcaFeedback.textContent = '';
    }

    try {
      const res = await fetch('/api/update-marca', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          restaurante_id: restauranteId,
          logo_url: val('marca-logo-url'),
          nombre_comercial: val('marca-nombre-comercial'),
          tagline_superior: val('marca-tagline-superior'),
          eslogan: val('marca-eslogan'),
          home_eslogan: val('marca-eslogan'),
          color_primario: val('marca-color-primario'),
          color_texto: val('marca-color-texto'),
          color_fondo: colorFondoHex,
          color_fondo_hint: val('marca-color-fondo'),
          estilo_adn: 'elegant',
          tipografia_combo: val('marca-tipografia-combo') || 'luxe-editorial',
          tipo_letra: val('marca-tipografia-combo') || 'luxe-editorial',
          custom_css: val('marca-css-avanzado'),
          css_avanzado: val('marca-css-avanzado'),
          share_image_url: val('marca-share-image-url'),
          app_icon_url: val('marca-app-icon-url'),
          home_titulo_size: Number(val('marca-home-titulo-size')) || 28,
          home_logo_size: Number(val('marca-home-logo-size')) || 160,
          home_eslogan_size: Number(val('marca-home-eslogan-size')) || 14,
          home_menu_size: Number(val('marca-home-menu-size')) || 16,
          logo_size: Number(val('marca-home-logo-size')) || 160,
          titulo_size: Number(val('marca-home-titulo-size')) || 28,
          eslogan_size: Number(val('marca-home-eslogan-size')) || 14,
          menu_size: Number(val('marca-home-menu-size')) || 16,
          home_tracking: val('marca-home-tracking'),
          home_subtitulo_color: val('marca-home-eslogan-color'),
          home_titulo_color: val('marca-home-titulo-color'),
          home_eslogan_color: val('marca-home-eslogan-color'),
          home_menu_color: val('marca-home-menu-color'),
          home_subtexto_color: val('marca-home-subtexto-color'),
          home_borde_destacado_color: val('marca-home-borde-destacado-color'),
          home_overlay_opacity: Number(val('marca-home-overlay-opacity')) || 40,
          home_overlay_estilo: val('marca-home-overlay-estilo') || 'oscuro',
          home_fondo_animacion: val('marca-home-fondo-animacion') || 'in',
          home_layout:
            document.querySelector('[data-home-layout-option]:checked')?.value ||
            val('marca-home-theme') ||
            'grand-editorial',
          home_estilo_navegacion: document.getElementById('marca-home-nav')?.value || 'frontal',
          home_efecto_entrada: val('marca-home-efecto-entrada') || 'ninguno',
          home_gadget_servicios_estilo:
            val('marca-home-gadget-servicios-estilo') || 'drawer',
          overlay_opacity: Number(val('marca-home-overlay-opacity')) || 40,
          overlay_estilo: val('marca-home-overlay-estilo') || 'oscuro',
          fondo_animacion: val('marca-home-fondo-animacion') || 'in',
          estilo_navegacion: document.getElementById('marca-home-nav')?.value || 'frontal',
          efecto_entrada: val('marca-home-efecto-entrada') || 'ninguno',
          gadget_servicios_estilo:
            val('marca-home-gadget-servicios-estilo') || 'drawer',
          fondo_tipo: fondoHomeTipo,
          fondo_valor: fondoHomeValor,
          titulo_color: val('marca-home-titulo-color'),
          eslogan_color: val('marca-home-eslogan-color'),
          menu_color: val('marca-home-menu-color'),
          subtexto_color: val('marca-home-subtexto-color') || val('marca-color-primario'),
          borde_destacado_color: val('marca-home-borde-destacado-color'),
          nosotros_color_fondo: val('marca-nosotros-color-fondo'),
          nosotros_color_titulo: val('marca-nosotros-color-titulo'),
          nosotros_color_cuerpo: val('marca-nosotros-color-cuerpo'),
          nosotros_contenedor_estilo: val('marca-nosotros-contenedor-estilo') || 'vidrio',
          nosotros_fuente_titulo: val('marca-nosotros-fuente-titulo') || 'cinzel',
          nosotros_fuente_cuerpo: val('marca-nosotros-fuente-cuerpo') || 'plus-jakarta',
          fondo_home_tipo: fondoHomeTipo,
          fondo_home_valor: fondoHomeValor,
          fondo_nosotros_tipo: val('marca-fondo-nosotros-tipo'),
          fondo_nosotros_valor: val('marca-fondo-nosotros-valor'),
          fondo_menu_tipo: val('marca-fondo-menu-tipo'),
          fondo_menu_valor: val('marca-fondo-menu-valor'),
          menu_fondos_cinematicos: checked('marca-menu-fondos-cinematicos'),
          menu_font: val('marca-menu-font'),
          menu_color_fondo: val('marca-menu-color-fondo'),
          menu_color_texto: val('marca-menu-color-texto'),
          menu_color_acento: val('marca-menu-color-acento'),
          menu_chips_layout: val('marca-menu-chips-layout') || 'scroll',
          menu_chips_estilo: val('marca-menu-chips-estilo') || 'pildora',
          menu_platos_layout: val('marca-menu-platos-layout') || 'grid',
          menu_estilo_tarjetas: val('marca-menu-estilo-tarjetas') || 'cristal',
          menu_destacados_estilo: val('marca-menu-destacados-estilo') || 'scroll',
          menu_destacados_efecto: val('marca-menu-destacados-efecto') || 'marquee',
          menu_layout:
            document.querySelector('[data-menu-layout-option]:checked') instanceof HTMLInputElement
              ? /** @type {HTMLInputElement} */ (
                  document.querySelector('[data-menu-layout-option]:checked')
                ).value
              : 'classic_grid',
          menu_navegacion: val('marca-menu-navegacion') || 'scroll',
          menu_fuente_titulo: val('marca-menu-fuente-titulo'),
          menu_fuente_cuerpo: val('marca-menu-fuente-cuerpo'),
          ubicacion_color_fondo: val('marca-ubicacion-color-fondo') || val('marca-fondo-ubicacion-valor'),
          ubicacion_color_titulo: val('marca-ubicacion-color-titulo'),
          ubicacion_color_cuerpo: val('marca-ubicacion-color-cuerpo') || val('marca-ubicacion-color-titulo'),
          ubicacion_color_acento: val('marca-ubicacion-color-acento'),
          ubicacion_color_boton: val('marca-ubicacion-color-acento'),
          ubicacion_grid_estilo: val('marca-ubicacion-grid-estilo') || 'vidrio',
          ubicacion_fuente_titulo: val('marca-ubicacion-fuente-titulo'),
          ubicacion_fuente_cuerpo: val('marca-ubicacion-fuente-cuerpo'),
          ubicacion_layout:
            document.querySelector('[data-ubicacion-layout-option]:checked') instanceof HTMLInputElement
              ? /** @type {HTMLInputElement} */ (
                  document.querySelector('[data-ubicacion-layout-option]:checked')
                ).value
              : 'modal_drawer',
          ubicacion_theme: val('marca-ubicacion-theme') || 'modal',
          fondo_ubicacion_tipo: val('marca-fondo-ubicacion-tipo'),
          fondo_ubicacion_valor: val('marca-fondo-ubicacion-valor'),
          nosotros_bloques: nosotrosBloquesPayload,
          nosotros_layout: nosotrosLayoutPayload,
          nosotros_theme: nosotrosThemePayload,
          direccion: val('marca-direccion'),
          coordenadas_maps: normalizeMapsStorage(val('marca-coordenadas')),
          redes_instagram: socialField('marca', 'instagram'),
          redes_facebook: socialField('marca', 'facebook'),
          redes_tiktok: socialField('marca', 'tiktok'),
          redes_tripadvisor: socialField('marca', 'tripadvisor'),
          redes_whatsapp: socialField('marca', 'whatsapp'),
          redes_telefono: socialField('marca', 'telefono'),
          redes_instagram_activo: socialOn('instagram', 'marca'),
          redes_facebook_activo: socialOn('facebook', 'marca'),
          redes_tiktok_activo: socialOn('tiktok', 'marca'),
          redes_tripadvisor_activo: socialOn('tripadvisor', 'marca'),
          redes_whatsapp_activo: socialOn('whatsapp', 'marca'),
          redes_telefono_activo: socialOn('telefono', 'marca'),
          instagram_url: socialField('marca', 'instagram'),
          horarios: (() => {
            syncHorarioHidden('marca');
            return val('marca-horarios');
          })(),
          categorias_fondos: collectCategoriasFondos(),
          gadget_reservas: checked('marca-gadget-reservas'),
          reservas_label: val('marca-reservas-label'),
          reservas_subtitulo: val('marca-reservas-subtitulo'),
          reservas_incluye_delivery: checked('marca-reservas-incluye-delivery'),
          reservas_layout:
            document.querySelector('[data-reservas-layout-option]:checked') instanceof HTMLInputElement
              ? /** @type {HTMLInputElement} */ (
                  document.querySelector('[data-reservas-layout-option]:checked')
                ).value
              : 'whatsapp_concierge',
          reservas_destino_tipo: val('marca-reservas-destino-tipo'),
          reservas_destino_valor: (() => {
            const checked = document.querySelector('[data-reservas-layout-option]:checked');
            const layoutId =
              checked instanceof HTMLInputElement
                ? checked.value
                : 'whatsapp_concierge';
            const panel = document.querySelector(`[data-reservas-panel="${layoutId}"]`);
            const field = panel?.querySelector('[data-reservas-destino-field]');
            if (
              field instanceof HTMLInputElement ||
              field instanceof HTMLTextAreaElement
            ) {
              return field.value.trim();
            }
            return val('marca-reservas-destino-valor');
          })(),
          reservas_boton_ubicacion: val('marca-reservas-boton-ubicacion') || 'flotante',
          reservas_efecto_visual: val('marca-reservas-efecto-visual') || 'estatico',
          reservas_mensaje_whatsapp: val('marca-reservas-mensaje-whatsapp'),
          reservas_plataforma_externa: val('marca-reservas-plataforma-externa') || 'custom',
          reservas_politica: val('marca-reservas-politica'),
          reservas_confirmacion_nativa: val('marca-reservas-confirmacion-nativa') || 'ninguna',
          gadget_wifi: checked('marca-gadget-wifi'),
          gadget_wifi_ssid: val('marca-wifi-ssid'),
          gadget_wifi_clave: val('marca-wifi-password'),
          wifi_ssid: val('marca-wifi-ssid'),
          wifi_password: val('marca-wifi-password'),
          gadget_boutique: checked('marca-gadget-boutique'),
          gadget_nutricion: checked('marca-gadget-nutricion'),
          gadget_ar: checked('marca-gadget-ar'),
          gadget_sucursales: checked('marca-gadget-sucursales'),
          sucursales_cupo: Number(val('marca-sucursales-cupo')) || 1,
          gadget_ar_modo_vista: 'rotacion_360',
          gadget_ar_intensidad: '70',
          gadget_nut_filtro_gluten_free: checked('marca-gadget-nut-gluten'),
          gadget_nut_filtro_vegano: checked('marca-gadget-nut-vegano'),
          gadget_nut_filtro_frutos_secos: checked('marca-gadget-nut-frutos'),
          gadget_nut_filtro_calorias: checked('marca-gadget-nut-calorias'),
          boutique_titulo: val('marca-boutique-titulo') || 'Boutique',
          boutique_catalogo_url: val('marca-boutique-catalogo-url'),
          boutique_productos: collectBoutiqueProductos(),
          home_theme: val('marca-home-theme') || 'editorial',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `No se pudo guardar (${res.status})`);

      if (root instanceof HTMLElement) {
        root.dataset.gadgetNutricion = checked('marca-gadget-nutricion') ? 'true' : 'false';
        root.dataset.gadgetAr = checked('marca-gadget-ar') ? 'true' : 'false';
      }
      document.querySelectorAll('[data-shows-when-ar]').forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const on = checked('marca-gadget-ar');
        el.classList.toggle('hidden', !on);
        el.hidden = !on;
      });

      const themeOk = String(json.nosotros_theme || nosotrosThemePayload || 'editorial');
      const bloquesOk =
        Number(json.nosotros_bloques_count ?? nosotrosBloquesPayload.length) || 0;
      const mediaOk = nosotrosBloquesPayload.reduce(
        (n, b) => n + (Array.isArray(b.media) ? b.media.length : 0),
        0,
      );
      if (!silent) {
        showToast(
          json.message ||
            `Identidad guardada · Nosotros: ${themeOk} · ${bloquesOk} bloque${bloquesOk === 1 ? '' : 's'} · ${mediaOk} media`,
          'ok',
        );
      } else {
        const opsToast = document.getElementById('ops-autosave-toast');
        if (opsToast instanceof HTMLElement) {
          opsToast.textContent = 'Identidad guardada';
          opsToast.dataset.state = 'ok';
          opsToast.hidden = false;
          window.clearTimeout(Number(opsToast.dataset.hideTimer || 0));
          const t = window.setTimeout(() => {
            opsToast.hidden = true;
          }, 1600);
          opsToast.dataset.hideTimer = String(t);
        }
      }
      markMarcaSaved();
      syncLocalOps('marca');
      if (
        root instanceof HTMLElement &&
        document.getElementById('marca-gadget-sucursales') &&
        (root.dataset.gadgetSucursales !== String(checked('marca-gadget-sucursales')) ||
          root.dataset.sucursalesCupo !== String(Number(val('marca-sucursales-cupo')) || 1))
      ) {
        window.setTimeout(() => window.location.reload(), 900);
      }
      return true;
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Error al guardar';
      if (
        err instanceof TypeError ||
        /failed to fetch|networkerror|load failed/i.test(msg)
      ) {
        msg =
          'No se pudo conectar con /api/update-marca. Revisá que el servidor esté activo y que la respuesta sea JSON.';
      }
      console.error('[identidad] GUARDAR falló', err);
      if (marcaFeedback) {
        marcaFeedback.textContent = msg;
        marcaFeedback.classList.remove('hidden');
        marcaFeedback.classList.add('text-rose-400');
      }
      showToast(msg, 'error');
      return false;
    } finally {
      saveBtn.disabled = false;
      setMarcaSaveState(saveBtn.dataset.saveState || 'idle', saveBtn);
    }
  }

  marcaSave?.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      void saveIdentidadMarca();
    },
    { signal },
  );

  marcaForm?.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      void saveIdentidadMarca();
    },
    { signal },
  );

  }

  document.addEventListener('astro:page-load', () => {
    try {
      initAdminDashboard();
    } catch (err) {
      console.error('Error en menú:', err);
    }
  });
  document.addEventListener('astro:before-preparation', teardownAdminDashboard);

  // Primera carga: módulos deferred pueden registrarse después del primer astro:page-load
  try {
    initAdminDashboard();
  } catch (err) {
    console.error('Error en menú (boot):', err);
  }

  // ── QR Panel standalone — supervivencia ViewTransitions ──────────
  // Bloque completamente independiente con su propio AbortController

  /** @type {AbortController | null} */
  let __qrPanelAc = null;

  function teardownQrPanel() {
    __qrPanelAc?.abort();
    __qrPanelAc = null;
  }

  function initQrPanel() {
    teardownQrPanel();

    const panel = document.querySelector('[data-marca-panel="qr"]');
    if (!(panel instanceof HTMLElement)) return;

    const ac = new AbortController();
    __qrPanelAc = ac;
    const { signal } = ac;

    const root = document.getElementById('dashboard-root');
    const styleBtns = panel.querySelectorAll('[data-qr-style]');
    const logoToggle = document.getElementById('qr-include-logo');
    const logoWrap = document.getElementById('qr-preview-logo-wrap');
    const logoPreview = document.getElementById('qr-preview-logo');
    const previewImg = document.getElementById('qr-preview-img');
    const copyBtn = document.getElementById('qr-copy-link');
    const urlInput = document.getElementById('qr-public-url');
    const dlSvg = document.getElementById('qr-download-svg');
    const dlPng = document.getElementById('qr-download-png');
    const errorMsg = document.getElementById('qr-error-msg');
    const statusMsg = document.getElementById('qr-status-msg');
    const brandInput = document.getElementById('marca-color-primario');
    const logoUrlInput = document.getElementById('marca-logo-url');

    /** Ratio seguro para ECC H (22–24%). */
    const QR_LOGO_RATIO = 0.23;
    /** Padding interno relativo al cuadrado del logo (~p-1.5). */
    const QR_LOGO_PAD_RATIO = 0.14;

    let qrStyle = 'standard';

    function getSlug() {
      return String(panel.dataset.qrSlug || root?.dataset?.slug || '').trim();
    }
    function getPublicUrl() {
      const s = getSlug();
      return s ? `https://xemilla.app/${s}` : '';
    }
    function getBrandColor() {
      if (brandInput instanceof HTMLInputElement && brandInput.value.trim())
        return brandInput.value.trim();
      return String(panel.dataset.qrBrand || '#9f1239').trim() || '#9f1239';
    }
    /** Logo principal de Identidad (`logo_url`), nunca app_icon / favicon. */
    function getLogoUrl() {
      if (logoUrlInput instanceof HTMLInputElement && logoUrlInput.value.trim()) {
        return logoUrlInput.value.trim();
      }
      return String(panel.dataset.qrLogo || '').trim();
    }
    function hexForApi(hex) {
      return String(hex || '000000').replace(/^#/, '').replace(/[^0-9a-f]/gi, '').slice(0, 6) || '000000';
    }
    function buildQrUrl({ format = 'png', size = 480 } = {}) {
      const data = getPublicUrl();
      if (!data) return '';
      const color = qrStyle === 'brand' ? hexForApi(getBrandColor()) : '000000';
      const p = new URLSearchParams({
        size: `${size}x${size}`,
        margin: '12',
        ecc: 'H',
        color,
        bgcolor: 'ffffff',
        format,
        data,
      });
      return `https://api.qrserver.com/v1/create-qr-code/?${p}`;
    }
    function showError(msg) {
      if (!(errorMsg instanceof HTMLElement)) return;
      errorMsg.textContent = msg;
      errorMsg.classList.toggle('hidden', !msg);
    }
    function showStatus(msg) {
      if (!(statusMsg instanceof HTMLElement)) return;
      statusMsg.textContent = msg || '';
      statusMsg.classList.toggle('hidden', !msg);
      if (msg) setTimeout(() => showStatus(''), 2600);
    }
    function setLogoOverlayVisible(show) {
      if (!(logoWrap instanceof HTMLElement)) return;
      logoWrap.hidden = !show;
      logoWrap.classList.toggle('hidden', !show);
      logoWrap.setAttribute('aria-hidden', show ? 'false' : 'true');
      if (!show && logoPreview instanceof HTMLImageElement) {
        logoPreview.removeAttribute('src');
      }
    }
    function syncLogoToggleEnabled() {
      const hasLogo = Boolean(getLogoUrl());
      if (logoToggle instanceof HTMLInputElement) {
        logoToggle.disabled = !hasLogo;
        if (!hasLogo && logoToggle.checked) {
          logoToggle.checked = false;
          logoToggle.setAttribute('aria-checked', 'false');
        }
      }
      const label = logoToggle?.closest('label');
      if (label instanceof HTMLElement) {
        label.classList.toggle('opacity-60', !hasLogo);
        label.title = hasLogo
          ? 'Incluir logo central'
          : 'Subí un logo en Identidad para activar esta opción';
      }
    }
    function refreshPreview() {
      if (!(previewImg instanceof HTMLImageElement)) return;
      const url = buildQrUrl({ format: 'png', size: 480 });
      if (url) {
        previewImg.src = url;
        previewImg.dataset.qrPreviewMode = 'standard';
        previewImg.classList.remove('hidden');
      }
      syncLogoToggleEnabled();
      const includeLogo = logoToggle instanceof HTMLInputElement && logoToggle.checked;
      const logo = getLogoUrl();
      const showLogo = Boolean(includeLogo && logo);
      if (!(logoPreview instanceof HTMLImageElement)) {
        setLogoOverlayVisible(false);
        return;
      }
      if (!showLogo) {
        setLogoOverlayVisible(false);
        if (logoToggle instanceof HTMLInputElement)
          logoToggle.setAttribute('aria-checked', 'false');
        return;
      }
      logoPreview.onload = () => setLogoOverlayVisible(true);
      logoPreview.onerror = () => setLogoOverlayVisible(false);
      if (logoPreview.src !== logo) logoPreview.src = logo;
      else setLogoOverlayVisible(true);
      if (logoToggle instanceof HTMLInputElement)
        logoToggle.setAttribute('aria-checked', 'true');
    }
    function setStyle(next) {
      qrStyle = next === 'brand' ? 'brand' : 'standard';
      styleBtns.forEach((btn) => {
        if (btn instanceof HTMLElement)
          btn.setAttribute('aria-pressed', btn.dataset.qrStyle === qrStyle ? 'true' : 'false');
      });
      refreshPreview();
    }

    async function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
        img.src = src;
      });
    }
    function triggerDownload(blob, filename) {
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1500);
    }
    /** Dibuja placa blanca + logo al 23% centrado (mismo criterio preview / export). */
    function drawCenteredLogo(ctx, size, logoImg) {
      const box = Math.round(size * QR_LOGO_RATIO);
      const pad = Math.max(4, Math.round(box * QR_LOGO_PAD_RATIO));
      const boxX = (size - box) / 2;
      const boxY = (size - box) / 2;
      const inner = Math.max(1, box - pad * 2);
      const sc = Math.min(inner / logoImg.naturalWidth, inner / logoImg.naturalHeight);
      const drawW = Math.max(1, Math.min(inner, Math.round(logoImg.naturalWidth * sc)));
      const drawH = Math.max(1, Math.min(inner, Math.round(logoImg.naturalHeight * sc)));
      const r = Math.max(8, Math.round(box * 0.16));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(boxX + r, boxY);
      ctx.arcTo(boxX + box, boxY, boxX + box, boxY + box, r);
      ctx.arcTo(boxX + box, boxY + box, boxX, boxY + box, r);
      ctx.arcTo(boxX, boxY + box, boxX, boxY, r);
      ctx.arcTo(boxX, boxY, boxX + box, boxY, r);
      ctx.closePath();
      ctx.fill();
      ctx.drawImage(logoImg, boxX + (box - drawW) / 2, boxY + (box - drawH) / 2, drawW, drawH);
      return { box, boxX, boxY, pad, drawW, drawH };
    }
    async function composeQrCanvas(size = 1024) {
      const pngUrl = buildQrUrl({ format: 'png', size });
      if (!pngUrl) throw new Error('Guarda un slug para generar el QR');
      const qrImg = await loadImage(pngUrl);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas no disponible');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(qrImg, 0, 0, size, size);
      const includeLogo = logoToggle instanceof HTMLInputElement && logoToggle.checked;
      const logoUrl = getLogoUrl();
      if (includeLogo && logoUrl) {
        const logo = await loadImage(logoUrl);
        drawCenteredLogo(ctx, size, logo);
      }
      return canvas;
    }
    function canvasToDataUrl(canvas) {
      return canvas.toDataURL('image/png');
    }

    styleBtns.forEach((btn) =>
      btn.addEventListener('click', () => setStyle(btn.getAttribute('data-qr-style') || 'standard'), { signal }),
    );
    logoToggle?.addEventListener('change', refreshPreview, { signal });
    brandInput?.addEventListener(
      'input',
      () => {
        if (qrStyle === 'brand') refreshPreview();
      },
      { signal },
    );
    logoUrlInput?.addEventListener(
      'input',
      () => {
        if (logoUrlInput instanceof HTMLInputElement) {
          panel.dataset.qrLogo = logoUrlInput.value.trim();
        }
        refreshPreview();
      },
      { signal },
    );
    copyBtn?.addEventListener(
      'click',
      async () => {
        const url = getPublicUrl();
        if (!url) {
          showError('No hay slug público para copiar');
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          showError('');
          showStatus('Enlace copiado');
          if (copyBtn instanceof HTMLButtonElement) {
            const prev = copyBtn.textContent;
            copyBtn.textContent = '¡Copiado!';
            setTimeout(() => {
              copyBtn.textContent = prev || 'Copiar';
            }, 1600);
          }
        } catch {
          if (urlInput instanceof HTMLInputElement) {
            urlInput.select();
            document.execCommand('copy');
            showStatus('Enlace copiado');
          }
        }
      },
      { signal },
    );

    dlSvg?.addEventListener(
      'click',
      async () => {
        const slug = getSlug();
        if (!slug) {
          showError('Guarda un slug para descargar el QR');
          return;
        }
        showError('');
        try {
          const includeLogo = logoToggle instanceof HTMLInputElement && logoToggle.checked && getLogoUrl();
          if (!includeLogo) {
            const svgUrl = buildQrUrl({ format: 'svg', size: 1024 });
            if (!svgUrl) throw new Error('No se pudo generar el SVG');
            const res = await fetch(svgUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            triggerDownload(await res.blob(), `qr-${slug}.svg`);
            showStatus('SVG descargado');
            return;
          }
          // Con logo: SVG compuesto (QR + placa 23%) para mantener el mismo criterio visual.
          const canvas = await composeQrCanvas(1024);
          const dataUrl = canvasToDataUrl(canvas);
          const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 1024 1024">
  <image width="1024" height="1024" href="${dataUrl}" xlink:href="${dataUrl}"/>
</svg>`;
          triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `qr-${slug}.svg`);
          showStatus('SVG descargado');
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Error al descargar SVG');
        }
      },
      { signal },
    );

    dlPng?.addEventListener(
      'click',
      async () => {
        const slug = getSlug();
        if (!slug) {
          showError('Guarda un slug para descargar el QR');
          return;
        }
        showError('');
        try {
          const canvas = await composeQrCanvas(1024);
          const blob = await new Promise((res, rej) =>
            canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo exportar PNG'))), 'image/png'),
          );
          triggerDownload(blob, `qr-${slug}.png`);
          showStatus('PNG descargado');
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Error al descargar PNG');
        }
      },
      { signal },
    );

    refreshPreview();
  }

  document.addEventListener('astro:page-load', () => {
    try { initQrPanel(); } catch (err) { console.error('[qrPanel] astro:page-load error:', err); }
  });
  document.addEventListener('astro:before-preparation', teardownQrPanel);

  // Carga inicial (antes del primer astro:page-load)
  try { initQrPanel(); } catch (err) { console.error('[qrPanel] boot error:', err); }
  // ── /QR Panel standalone ─────────────────────────────────────────
