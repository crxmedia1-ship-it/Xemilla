  import { refreshUbicacionLiveStatus } from '../lib/ubicacion-live-client.js';
  import { syncMesaSession, hasValidMesaSession, getStoredMesa } from '../lib/mesa-session.js';

  const OPEN_CLASSES = ['opacity-100', 'pointer-events-auto'];
  const CLOSED_CLASSES = ['translate-y-full', 'opacity-0', 'pointer-events-none'];

  // Persist ?mesa= ASAP (también si el hub aún no montó el gate)
  syncMesaSession();

  /**
   * Sync mesa query param state for white-label session continuity.
   */
  function applyMesaGate() {
    const mesa = syncMesaSession();
    const unlocked = Boolean(mesa);

    document.documentElement.dataset.mesaAsignada = unlocked ? 'true' : 'false';
    if (mesa) {
      document.documentElement.dataset.mesa = mesa;
    } else {
      delete document.documentElement.dataset.mesa;
    }
  }

  applyMesaGate();
  document.addEventListener('astro:page-load', applyMesaGate);

  function isVideoUrl(url: string) {
    return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url) || /\/video\/upload\//i.test(url);
  }

  function setPanelOpen(panel: HTMLElement, open: boolean) {
    panel.dataset.open = open ? 'true' : 'false';
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    panel.classList.remove(...(open ? CLOSED_CLASSES : OPEN_CLASSES));
    panel.classList.add(...(open ? OPEN_CLASSES : CLOSED_CLASSES));
  }

  /** Superficie activa: el FAB Wi‑Fi/servicios solo vive en home. */
  function syncAppSurface(app: HTMLElement) {
    let surface = 'home';
    if (app.querySelector('[data-boutique-modal].is-open')) {
      surface = 'boutique';
    } else if (app.querySelector('[data-ubicacion-drawer].is-open')) {
      surface = 'ubicacion';
    } else if (app.querySelector('[data-app-nav-overlay].is-open')) {
      surface = 'nav';
    } else if (app.querySelector('[data-detalle-modal].is-open, [data-detalle-modal][aria-hidden="false"]')) {
      surface = 'detalle';
    } else {
      const openPanel = app.querySelector('[data-section][data-open="true"]');
      if (openPanel instanceof HTMLElement) {
        surface = openPanel.dataset.section || 'section';
      }
    }
    app.dataset.surface = surface;

    const floating = app.querySelector('[data-gadget-floating]');
    if (floating instanceof HTMLElement) {
      const onHome = surface === 'home';
      floating.hidden = !onHome;
      floating.setAttribute('aria-hidden', onHome ? 'false' : 'true');
      floating.classList.toggle('is-away-from-home', !onHome);
    }
  }

  function openUbicacionDrawer(app: HTMLElement) {
    const drawer = app.querySelector('[data-ubicacion-drawer]');
    if (!(drawer instanceof HTMLElement)) return;
    closeDetalle(app);
    closeBoutique(app);
    app.querySelectorAll('[data-section]').forEach((el) => {
      if (el instanceof HTMLElement) setPanelOpen(el, false);
    });
    const sheet = drawer.querySelector('.ubicacion-drawer');
    if (sheet instanceof HTMLElement) {
      sheet.style.transform = '';
      sheet.style.transition = '';
    }
    drawer.classList.add('is-open');
    drawer.dataset.open = 'true';
    drawer.setAttribute('aria-hidden', 'false');
    app.classList.add('has-drawer-open');
    document.documentElement.classList.add('drawer-open');
    const panel = drawer.querySelector('[data-ubicacion-panel]');
    if (panel instanceof HTMLElement) refreshUbicacionLiveStatus(panel);
    document.documentElement.style.overflow = 'hidden';
    syncAppSurface(app);
  }

  function closeUbicacionDrawer(app: HTMLElement) {
    const drawer = app.querySelector('[data-ubicacion-drawer]');
    if (!(drawer instanceof HTMLElement)) return;
    const sheet = drawer.querySelector('.ubicacion-drawer');
    if (sheet instanceof HTMLElement) {
      sheet.style.transform = '';
      sheet.style.transition = '';
    }
    drawer.classList.remove('is-open');
    drawer.dataset.open = 'false';
    drawer.setAttribute('aria-hidden', 'true');
    app.classList.remove('has-drawer-open');
    document.documentElement.classList.remove('drawer-open');
    syncAppSurface(app);
  }

  function setAppTabsActive(app: HTMLElement, id: string | null) {
    app.querySelectorAll('[data-app-tab]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.dataset.active = id && el.dataset.appTab === id ? 'true' : 'false';
    });
  }

  function hubSessionKey(app: HTMLElement) {
    const id = app.dataset.restauranteId || '';
    return id ? `xemilla:menu-hub-cat:${id}` : 'xemilla:menu-hub-cat';
  }

  function persistMenuHubOnClose(app: HTMLElement) {
    const menuPanel = app.querySelector('[data-menu-panel]');
    if (!(menuPanel instanceof HTMLElement)) return;
    if (menuPanel.dataset.menuNavegacion !== 'hub_categories') return;

    const key = hubSessionKey(app);
    if (menuPanel.dataset.hubView === 'detail') {
      const catId = menuPanel.dataset.menuFilter || '';
      const titleEl = menuPanel.querySelector('[data-menu-hub-title]');
      const title = titleEl instanceof HTMLElement ? titleEl.textContent?.trim() || '' : '';
      if (catId && catId !== 'hub' && catId !== 'all') {
        sessionStorage.setItem(key, JSON.stringify({ catId, catName: title }));
        return;
      }
    }
    sessionStorage.removeItem(key);
  }

  function restoreMenuHubState(app: HTMLElement) {
    const menuPanel = app.querySelector('[data-menu-panel]');
    if (!(menuPanel instanceof HTMLElement)) return;
    if (menuPanel.dataset.menuNavegacion !== 'hub_categories') return;

    let saved: { catId?: string; catName?: string } | null = null;
    try {
      const raw = sessionStorage.getItem(hubSessionKey(app));
      saved = raw ? JSON.parse(raw) : null;
    } catch {
      saved = null;
    }

    if (saved?.catId) {
      menuPanel.dispatchEvent(
        new CustomEvent('xemilla:hub-restore', {
          detail: saved,
          bubbles: false,
        }),
      );
    } else {
      menuPanel.dispatchEvent(new CustomEvent('xemilla:hub-reset', { bubbles: false }));
    }
  }

  function closeAppNavOverlay(app: HTMLElement) {
    const overlay = app.querySelector('[data-app-nav-overlay]');
    const burger = app.querySelector('[data-app-nav-burger]');
    if (overlay instanceof HTMLElement) {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (burger instanceof HTMLElement) {
      burger.setAttribute('aria-expanded', 'false');
    }
    // No forzar overflow aquí: openSection puede mantener el lock del panel
  }

  function openSection(app: HTMLElement, id: string) {
    // Mantener ?mesa= en sessionStorage antes de cualquier navegación interna
    syncMesaSession();
    applyMesaGate();
    closeAppNavOverlay(app);

    // Ubicación: modal = drawer; split/minimal = OverlayPanel
    if (id === 'ubicacion') {
      const ubiTheme = String(app.dataset.ubicacionTheme || 'modal')
        .trim()
        .toLowerCase();
      if (ubiTheme === 'modal') {
        const home = app.querySelector('[data-linktree-home]');
        openUbicacionDrawer(app);
        home?.classList.add('scale-[0.98]', 'opacity-40');
        setAppTabsActive(app, 'ubicacion');
        return;
      }
    }

    const home = app.querySelector('[data-linktree-home]');
    const panel = app.querySelector(`[data-section="${id}"]`);
    if (!(panel instanceof HTMLElement)) return;

    closeUbicacionDrawer(app);
    app.querySelectorAll('[data-section]').forEach((el) => {
      if (el instanceof HTMLElement) setPanelOpen(el, false);
    });

    setPanelOpen(panel, true);
    home?.classList.add('scale-[0.98]', 'opacity-40');
    document.documentElement.style.overflow = 'hidden';
    setAppTabsActive(app, id === 'menu' || id === 'nosotros' || id === 'ubicacion' ? id : null);
    syncAppSurface(app);

    if (id === 'wifi') {
      document.dispatchEvent(new CustomEvent('xemilla:wifi-open'));
    }

    if (id === 'menu') {
      requestAnimationFrame(() => restoreMenuHubState(app));
    }
  }

  function resetMenuState(app: HTMLElement) {
    const menuPanel = app.querySelector('[data-menu-panel]');
    if (!(menuPanel instanceof HTMLElement)) return;
    try {
      sessionStorage.removeItem(hubSessionKey(app));
    } catch {
      /* ignore */
    }
    menuPanel.dispatchEvent(new CustomEvent('xemilla:menu-reset', { bubbles: false }));
  }

  function closeSections(app: HTMLElement, opts: { skipPersistHub?: boolean } = {}) {
    if (!opts.skipPersistHub) {
      persistMenuHubOnClose(app);
    }
    const home = app.querySelector('[data-linktree-home]');
    closeUbicacionDrawer(app);
    closeAppNavOverlay(app);
    app.querySelectorAll('[data-section]').forEach((el) => {
      if (el instanceof HTMLElement) setPanelOpen(el, false);
    });
    home?.classList.remove('scale-[0.98]', 'opacity-40');
    document.documentElement.style.overflow = '';
    setAppTabsActive(app, null);
    syncAppSurface(app);
  }

  const ALERGENO_META: Record<string, { label: string; emoji: string }> = {
    gluten: { label: 'Gluten', emoji: '🌾' },
    lacteos: { label: 'Lácteos', emoji: '🥛' },
    huevo: { label: 'Huevo', emoji: '🥚' },
    mani: { label: 'Maní', emoji: '🥜' },
    frutos_secos: { label: 'Frutos secos', emoji: '🌰' },
    mariscos: { label: 'Mariscos', emoji: '🦐' },
    pescado: { label: 'Pescado', emoji: '🐟' },
    soja: { label: 'Soja', emoji: '🫘' },
    sesamo: { label: 'Sésamo', emoji: '⚪' },
    picante: { label: 'Picante', emoji: '🌶️' },
    carne: { label: 'Carne', emoji: '🥩' },
    no_vegano: { label: 'No vegano', emoji: '🚫' },
  };

  function renderAlergenoBadges(host: HTMLElement, raw: string) {
    host.replaceChildren();
    const ids = String(raw || '')
      .split(/[,|;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const labelEl = host.previousElementSibling;
    if (ids.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'alergeno-badge alergeno-badge--empty';
      empty.textContent = 'Sin alérgenos declarados';
      host.appendChild(empty);
      if (labelEl instanceof HTMLElement) {
        labelEl.textContent = 'Alérgenos';
        labelEl.hidden = false;
      }
      return;
    }
    if (labelEl instanceof HTMLElement) {
      labelEl.textContent = 'Contiene';
      labelEl.hidden = false;
    }
    for (const id of ids) {
      const meta = ALERGENO_META[id] || { label: id, emoji: '⚠️' };
      const badge = document.createElement('span');
      badge.className = 'alergeno-badge';
      badge.dataset.alergeno = id;
      const emoji = document.createElement('span');
      emoji.className = 'alergeno-badge__emoji';
      emoji.setAttribute('aria-hidden', 'true');
      emoji.textContent = meta.emoji;
      const label = document.createElement('span');
      label.className = 'alergeno-badge__label';
      label.textContent = meta.label;
      badge.append(emoji, label);
      host.appendChild(badge);
    }
  }

  function clearDetalleMedia(app: HTMLElement) {
    const imgEl = app.querySelector('[data-detalle-img]');
    const videoEl = app.querySelector('[data-detalle-video]');
    const mediaStdEl = app.querySelector('[data-detalle-media-std]');
    if (imgEl instanceof HTMLImageElement) {
      imgEl.classList.add('hidden');
      imgEl.removeAttribute('src');
      imgEl.alt = '';
    }
    if (mediaStdEl instanceof HTMLElement) {
      mediaStdEl.style.removeProperty('--detalle-img-bg');
    }
    if (videoEl instanceof HTMLVideoElement) {
      videoEl.pause();
      videoEl.classList.add('hidden');
      videoEl.removeAttribute('src');
      videoEl.load();
    }
    hideDetalleArViewer(app);
    const arBtn = app.querySelector('[data-detalle-ar-btn]');
    const arViewer = app.querySelector('[data-detalle-ar-viewer]');
    const safariHint = app.querySelector('[data-detalle-ar-safari]');
    if (arBtn instanceof HTMLElement) arBtn.classList.add('hidden');
    if (arViewer instanceof HTMLElement) {
      arViewer.classList.add('hidden', 'is-preload');
      arViewer.removeAttribute('src');
      arViewer.removeAttribute('scale');
    }
    if (safariHint instanceof HTMLElement) safariHint.classList.add('hidden');
    if (mediaStdEl instanceof HTMLElement) mediaStdEl.classList.remove('hidden');
    const descEl = app.querySelector('[data-detalle-desc]');
    if (descEl instanceof HTMLElement) {
      descEl.textContent = '';
      descEl.classList.add('hidden');
    }
    const nutEl = app.querySelector('[data-detalle-nutricion]');
    if (nutEl instanceof HTMLElement) {
      nutEl.classList.add('hidden');
    }
    const badges = app.querySelector('[data-detalle-alergias-badges]');
    if (badges instanceof HTMLElement) badges.innerHTML = '';
  }

  function closeDetalle(app: HTMLElement) {
    const modal = app.querySelector('[data-detalle-modal]');
    if (!(modal instanceof HTMLElement)) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    clearDetalleMedia(app);
    const anySectionOpen = Array.from(app.querySelectorAll('[data-section]')).some(
      (el) => el instanceof HTMLElement && el.dataset.open === 'true',
    );
    const drawerOpen = app.querySelector('[data-ubicacion-drawer].is-open');
    const boutiqueOpen = app.querySelector('[data-boutique-modal].is-open');
    if (!anySectionOpen && !drawerOpen && !boutiqueOpen) {
      document.documentElement.style.overflow = '';
    }
    syncAppSurface(app);
  }

  function openBoutique(app: HTMLElement) {
    const modal = app.querySelector('[data-boutique-modal]');
    if (!(modal instanceof HTMLElement)) return;
    closeDetalle(app);
    closeUbicacionDrawer(app);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    syncAppSurface(app);
  }

  function closeBoutique(app: HTMLElement) {
    const modal = app.querySelector('[data-boutique-modal]');
    if (!(modal instanceof HTMLElement)) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    const anySectionOpen = Array.from(app.querySelectorAll('[data-section]')).some(
      (el) => el instanceof HTMLElement && el.dataset.open === 'true',
    );
    const drawerOpen = app.querySelector('[data-ubicacion-drawer].is-open');
    if (!anySectionOpen && !drawerOpen) {
      document.documentElement.style.overflow = '';
    }
    syncAppSurface(app);
  }

  function macroText(val) {
    if (val == null || val === '') return '—';
    return String(val);
  }

  /** @type {Map<string, {
   *   calorias?: string | number | null,
   *   proteinas?: string | number | null,
   *   carbs?: string | number | null,
   *   grasas?: string | number | null,
   *   alergias?: string[] | string,
   *   ingredientes?: string,
   *   ingredientes_detalle?: string,
   * }>} */
  const nutCache = new Map();

  function readEmbeddedNutricion(app) {
    const el = app.querySelector('[data-menu-nutricion-json]');
    if (!el) return;
    try {
      const parsed = JSON.parse(el.textContent || '{}');
      if (!parsed || typeof parsed !== 'object') return;
      for (const [id, row] of Object.entries(parsed)) {
        nutCache.set(String(id), row);
      }
    } catch {
      /* ignore */
    }
  }

  function mergeNutricion(id, fallback) {
    const live = id ? nutCache.get(String(id)) : null;
    const alergiasLive = Array.isArray(live?.alergias)
      ? live.alergias.join(',')
      : String(live?.alergias || '');
    return {
      calorias: macroText(live?.calorias ?? fallback?.calorias),
      proteinas: macroText(live?.proteinas ?? fallback?.proteinas),
      carbs: macroText(live?.carbs ?? fallback?.carbs),
      grasas: macroText(live?.grasas ?? fallback?.grasas),
      alergias: alergiasLive || fallback?.alergias || '',
      ingredientes:
        String(live?.ingredientes || live?.ingredientes_detalle || fallback?.ingredientes || '').trim(),
    };
  }

  async function hydrateWebappNutricion(app) {
    if (app.dataset.showNutricion !== 'true') return;
    readEmbeddedNutricion(app);
    const restauranteId = app.dataset.restauranteId || '';
    if (!restauranteId) return;
    try {
      const res = await fetch(
        `/api/platos-nutricion?restaurante_id=${encodeURIComponent(restauranteId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(json.platos)) return;
      for (const plato of json.platos) {
        nutCache.set(String(plato.id), plato);
        const row = app.querySelector(`[data-plato-id="${plato.id}"]`);
        if (row instanceof HTMLElement) {
          row.dataset.alergias = Array.isArray(plato.alergias) ? plato.alergias.join(',') : '';
          row.dataset.ingredientes = plato.ingredientes_detalle || '';
        }
        const btn = app.querySelector(`[data-open-detalle][data-plato-id="${plato.id}"]`);
        if (btn instanceof HTMLElement) {
          if (plato.calorias != null) btn.dataset.platoCalorias = String(plato.calorias);
          if (plato.proteinas != null) btn.dataset.platoProteinas = String(plato.proteinas);
          if (plato.carbs != null) btn.dataset.platoCarbs = String(plato.carbs);
          if (plato.grasas != null) btn.dataset.platoGrasas = String(plato.grasas);
          btn.dataset.platoAlergias = Array.isArray(plato.alergias) ? plato.alergias.join(',') : '';
          btn.dataset.platoIngredientes = plato.ingredientes_detalle || '';
          btn.dataset.platoHasNut = 'true';
        }
      }
    } catch {
      /* silencioso */
    }
  }

  function openDetalle(
    app: HTMLElement,
    url: string,
    title: string,
    platoId?: string,
    platoNombre?: string,
    meta?: {
      desc?: string;
      hasNut?: boolean;
      calorias?: string;
      proteinas?: string;
      carbs?: string;
      grasas?: string;
      alergias?: string;
      ingredientes?: string;
      modelo3dUrl?: string;
    },
  ) {
    const modal = app.querySelector('[data-detalle-modal]');
    const titleEl = app.querySelector('[data-detalle-title]');
    const imgEl = app.querySelector('[data-detalle-img]');
    const videoEl = app.querySelector('[data-detalle-video]');
    if (!(modal instanceof HTMLElement)) return;
    // AR only when the gadget is on AND this dish has a 3D URL
    const hasArContent =
      app.dataset.showAr === 'true' && Boolean(meta?.modelo3dUrl?.trim());
    if (!url && !meta?.hasNut && !hasArContent) return;

    clearDetalleMedia(app);
    if (titleEl) titleEl.textContent = title || 'Plato';

    const descEl = app.querySelector('[data-detalle-desc]');
    const desc = String(meta?.desc || '').trim();
    if (descEl instanceof HTMLElement) {
      if (desc) {
        descEl.textContent = desc;
        descEl.classList.remove('hidden');
      } else {
        descEl.classList.add('hidden');
      }
    }

    const nutEl = app.querySelector('[data-detalle-nutricion]');
    if (nutEl instanceof HTMLElement && app.dataset.showNutricion === 'true') {
      const merged = mergeNutricion(platoId, meta);
      const setMacro = (sel: string, val?: string) => {
        const el = app.querySelector(sel);
        if (el) el.textContent = val && val !== '' ? val : '—';
      };
      setMacro('[data-detalle-kcal]', merged.calorias === '—' ? '' : merged.calorias);
      setMacro('[data-detalle-prot]', merged.proteinas === '—' ? '' : merged.proteinas);
      setMacro('[data-detalle-carbs]', merged.carbs === '—' ? '' : merged.carbs);
      setMacro('[data-detalle-grasas]', merged.grasas === '—' ? '' : merged.grasas);

      const badges = app.querySelector('[data-detalle-alergias-badges]');
      if (badges instanceof HTMLElement) {
        renderAlergenoBadges(badges, merged.alergias || '');
      }

      nutEl.classList.remove('hidden');

      if (platoId) {
        void fetch(`/api/platos-nutricion?id=${encodeURIComponent(platoId)}`, {
          cache: 'no-store',
        })
          .then((res) => res.json().catch(() => ({})))
          .then((json) => {
            if (!json?.plato) return;
            nutCache.set(String(json.plato.id), json.plato);
            const fresh = mergeNutricion(platoId, meta);
            setMacro('[data-detalle-kcal]', fresh.calorias === '—' ? '' : fresh.calorias);
            setMacro('[data-detalle-prot]', fresh.proteinas === '—' ? '' : fresh.proteinas);
            setMacro('[data-detalle-carbs]', fresh.carbs === '—' ? '' : fresh.carbs);
            setMacro('[data-detalle-grasas]', fresh.grasas === '—' ? '' : fresh.grasas);
            if (badges instanceof HTMLElement) {
              renderAlergenoBadges(badges, fresh.alergias || '');
            }
          })
          .catch(() => {});
      }
    }

    const showAr = app.dataset.showAr === 'true';
    const modelo3dUrl = String(meta?.modelo3dUrl || '').trim();
    const arBtn = app.querySelector('[data-detalle-ar-btn]');
    const arViewer = app.querySelector('[data-detalle-ar-viewer]');
    const safariHint = app.querySelector('[data-detalle-ar-safari]');
    const mediaStdEl = app.querySelector('[data-detalle-media-std]');
    if (mediaStdEl instanceof HTMLElement) mediaStdEl.classList.remove('hidden');

    if (showAr && modelo3dUrl && arBtn instanceof HTMLElement && arViewer instanceof HTMLElement) {
      ensureModelViewerLoaded();
      app.dataset.detalleArSrc = modelo3dUrl;
      arBtn.classList.remove('hidden');
      arViewer.classList.remove('hidden');
      arViewer.classList.add('is-preload');
      arViewer.setAttribute('alt', title || 'Modelo 3D');
      arViewer.setAttribute('src', modelo3dUrl);
      bindDishScale(arViewer);
      if (safariHint instanceof HTMLElement) {
        safariHint.classList.toggle('hidden', !isIosThirdPartyBrowser());
      }
    } else {
      app.dataset.detalleArSrc = '';
      if (arBtn instanceof HTMLElement) arBtn.classList.add('hidden');
      if (arViewer instanceof HTMLElement) {
        arViewer.classList.add('hidden', 'is-preload');
        arViewer.removeAttribute('src');
      }
      if (safariHint instanceof HTMLElement) safariHint.classList.add('hidden');
    }

    if (isVideoUrl(url) && videoEl instanceof HTMLVideoElement) {
      videoEl.src = url;
      videoEl.muted = true;
      videoEl.loop = true;
      videoEl.playsInline = true;
      videoEl.classList.remove('hidden');
      void videoEl.play().catch(() => {
        /* autoplay bloqueado — silencioso */
      });
    } else if (url && imgEl instanceof HTMLImageElement) {
      imgEl.src = url;
      imgEl.alt = title || 'Plato';
      imgEl.classList.remove('hidden');
      if (mediaStdEl instanceof HTMLElement) {
        mediaStdEl.style.setProperty('--detalle-img-bg', `url("${url.replace(/"/g, '%22')}")`);
      }
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    syncAppSurface(app);

    // Analytics en background — no await, no bloquea UX
    const restauranteId = app.dataset.restauranteId || '';
    const idNum = Number(platoId);
    if (restauranteId && Number.isFinite(idNum) && idNum > 0) {
      void fetch('/api/registro-vista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurante_id: restauranteId,
          plato_id: idNum,
          plato_nombre: platoNombre || title || '',
        }),
        keepalive: true,
      }).catch(() => {
        /* silencioso */
      });
    }
  }

  function hideDetalleArViewer(app: HTMLElement) {
    const screen = app.querySelector('[data-ar-screen]');
    const stage = app.querySelector('[data-ar-screen-stage]');
    if (stage instanceof HTMLElement) stage.innerHTML = '';
    if (screen instanceof HTMLElement) {
      screen.classList.remove('is-open');
      screen.setAttribute('aria-hidden', 'true');
    }
  }

  function isAndroidUa() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function isIosUa() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isIosThirdPartyBrowser() {
    const ua = navigator.userAgent || '';
    return isIosUa() &&
      /CriOS\/|EdgiOS\/|FxiOS\/|GSA\/|DuckDuckGo\/|Instagram|FBAN|FBAV|Line\/|WhatsApp/i.test(ua);
  }

  function sceneViewerHref(glbUrl: string, title: string) {
    const file = encodeURIComponent(glbUrl);
    const name = encodeURIComponent(title || 'Plato');
    return `https://arvr.google.com/scene-viewer/1.0?file=${file}&mode=ar_preferred&title=${name}`;
  }

  function openSceneViewerAr(glbUrl: string, title: string) {
    const web = sceneViewerHref(glbUrl, title);
    const file = encodeURIComponent(glbUrl);
    const name = encodeURIComponent(title || 'Plato');
    const intent =
      `intent://arvr.google.com/scene-viewer/1.0?file=${file}&mode=ar_preferred&title=${name}#Intent;` +
      `scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${encodeURIComponent(web)};end;`;
    window.location.href = intent;
  }

  const DISH_AR_METERS = 0.16;

  function fitDishScale(viewer: HTMLElement) {
    const mv = viewer as HTMLElement & {
      getDimensions?: () => { x: number; y: number; z: number };
      scale?: string;
    };
    const dim = typeof mv.getDimensions === 'function' ? mv.getDimensions() : null;
    if (!dim) return;
    const max = Math.max(Number(dim.x) || 0, Number(dim.y) || 0, Number(dim.z) || 0);
    if (!(max > 0)) return;
    const s = DISH_AR_METERS / max;
    if (s >= 0.999) return;
    const value = `${s} ${s} ${s}`;
    mv.scale = value;
    viewer.setAttribute('scale', value);
  }

  function bindDishScale(viewer: HTMLElement) {
    const onLoad = () => fitDishScale(viewer);
    viewer.addEventListener('load', onLoad, { once: true });
    const mv = viewer as HTMLElement & { loaded?: boolean };
    if (mv.loaded) onLoad();
  }

  function launchDetalleAr(app: HTMLElement) {
    if (app.dataset.showAr !== 'true') return;
    const viewer = app.querySelector('[data-detalle-ar-viewer]') as
      | (HTMLElement & { activateAR?: () => Promise<void>; canActivateAR?: boolean })
      | null;
    if (!viewer) return;
    fitDishScale(viewer);

    if (isIosUa() || isAndroidUa()) {
      if (typeof viewer.activateAR === 'function') {
        void viewer.activateAR().catch(() => {
          const src = String(app.dataset.detalleArSrc || '').trim();
          if (src && isAndroidUa()) openSceneViewerAr(src, 'Plato');
        });
      }
      return;
    }

    viewer.classList.remove('is-preload', 'hidden');
  }

  function initRestaurantApps() {
    document.querySelectorAll('[data-restaurant-app]').forEach((root) => {
      if (!(root instanceof HTMLElement)) return;
      if (root.dataset.navReady === 'true') return;
      if (root.dataset.showAr === 'true') ensureModelViewerLoaded();
      root.dataset.navReady = 'true';
      void hydrateWebappNutricion(root);

      const arLaunchBtn = root.querySelector('[data-detalle-ar-btn]');
      if (arLaunchBtn instanceof HTMLElement) {
        arLaunchBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          launchDetalleAr(root);
        });
      }

      // Hamburguesa Alchemist — overlay fullscreen
      const burger = root.querySelector('[data-app-nav-burger]');
      const overlay = root.querySelector('[data-app-nav-overlay]');
      const closeNav = root.querySelector('[data-app-nav-close]');
      if (burger instanceof HTMLElement && overlay instanceof HTMLElement) {
        const setOpen = (open: boolean) => {
          overlay.classList.toggle('is-open', open);
          overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
          burger.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (open) {
            document.documentElement.style.overflow = 'hidden';
          } else {
            const anyOpen = Array.from(root.querySelectorAll('[data-section]')).some(
              (el) => el instanceof HTMLElement && el.dataset.open === 'true',
            );
            const drawerOpen = root.querySelector('[data-ubicacion-drawer].is-open');
            if (!anyOpen && !drawerOpen) {
              document.documentElement.style.overflow = '';
            }
          }
          document.documentElement.classList.remove('overflow-hidden');
          syncAppSurface(root);
        };
        burger.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        });
        closeNav?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        });
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) setOpen(false);
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
            setOpen(false);
          }
        });
      }

      root.addEventListener('xemilla:open-menu-category', (event) => {
        const detail = (event as CustomEvent<{ catId?: string; catName?: string }>).detail;
        if (!detail?.catId) return;
        openSection(root, 'menu');
        window.setTimeout(() => {
          const menuPanel = root.querySelector('[data-menu-panel]');
          if (!(menuPanel instanceof HTMLElement)) return;
          menuPanel.dispatchEvent(
            new CustomEvent('xemilla:hub-restore', {
              detail: { catId: detail.catId, catName: detail.catName || '' },
            }),
          );
          menuPanel.dispatchEvent(
            new CustomEvent('xemilla:menu-category', { detail: { id: detail.catId } }),
          );
        }, 120);
      });

      // Delegación: Home / Editorial / nav (incl. UBICACIÓN)
      root.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const openBtn = target.closest('[data-open-section]');
        if (openBtn instanceof HTMLElement && root.contains(openBtn)) {
          const id = openBtn.dataset.openSection?.trim();
          if (id) {
            event.preventDefault();
            openSection(root, id);
            return;
          }
        }

        if (target.closest('[data-open-boutique]') && root.contains(target.closest('[data-open-boutique]'))) {
          closeAppNavOverlay(root);
          openBoutique(root);
          return;
        }

        if (target.closest('[data-close-section]')) {
          const resetOnClose = target.closest('[data-menu-reset-on-close]');
          if (resetOnClose) {
            resetMenuState(root);
          }
          closeDetalle(root);
          closeBoutique(root);
          closeSections(root, { skipPersistHub: Boolean(resetOnClose) });
          return;
        }

        const tapCard = target.closest('.menu-plato-item--grid-tap');
        const detalleBtn =
          target.closest('[data-open-detalle]') ??
          (tapCard && !target.closest('a, button, input, select, textarea')
            ? tapCard.querySelector('[data-open-detalle]')
            : null);
        if (detalleBtn instanceof HTMLElement) {
          const url = detalleBtn.dataset.mediaUrl?.trim() || '';
          const title = detalleBtn.dataset.mediaTitle || 'Plato';
          const platoId = detalleBtn.dataset.platoId || '';
          const platoNombre = detalleBtn.dataset.platoNombre || title;
          const modelo3dUrl = detalleBtn.dataset.platoModelo3dUrl?.trim() || '';
          const hasAr = root.dataset.showAr === 'true' && Boolean(modelo3dUrl);
          if (url || detalleBtn.dataset.platoHasNut === 'true' || hasAr) {
            openDetalle(root, url, title, platoId, platoNombre, {
              desc: detalleBtn.dataset.platoDesc || '',
              hasNut: detalleBtn.dataset.platoHasNut === 'true',
              calorias: detalleBtn.dataset.platoCalorias || '',
              proteinas: detalleBtn.dataset.platoProteinas || '',
              carbs: detalleBtn.dataset.platoCarbs || '',
              grasas: detalleBtn.dataset.platoGrasas || '',
              alergias: detalleBtn.dataset.platoAlergias || '',
              ingredientes: detalleBtn.dataset.platoIngredientes || '',
              modelo3dUrl,
            });
          }
          return;
        }

        if (target.closest('[data-ar-back]')) {
          event.preventDefault();
          event.stopPropagation();
          hideDetalleArViewer(root);
          return;
        }

        const arChipBtn = target.closest('[data-detalle-ar-btn]');
        if (arChipBtn instanceof HTMLElement && root.contains(arChipBtn)) {
          event.preventDefault();
          event.stopPropagation();
          launchDetalleAr(root);
          return;
        }

        if (
          target.closest('[data-detalle-close]') ||
          target.closest('[data-detalle-backdrop]')
        ) {
          closeDetalle(root);
          return;
        }

        if (
          target.closest('[data-ubicacion-drawer-close]') ||
          target.closest('[data-ubicacion-drawer-backdrop]')
        ) {
          closeSections(root);
          return;
        }

        if (
          target.closest('[data-boutique-close]') ||
          target.closest('[data-boutique-backdrop]')
        ) {
          closeBoutique(root);
        }
      });

      syncAppSurface(root);
    });
  }

  function ensureModelViewerLoaded() {
    if (typeof customElements === 'undefined') return;
    if (customElements.get('model-viewer')) return;
    if (document.querySelector('script[data-model-viewer]')) return;
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';
    s.setAttribute('data-model-viewer', 'true');
    document.head.appendChild(s);
  }

  initRestaurantApps();
  document.addEventListener('astro:page-load', initRestaurantApps);
