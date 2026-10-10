import { formatVentaMonto } from '../lib/ventas.js';

  function initSuperTabs() {
    const tabs = document.querySelectorAll('[data-super-tab]');
    const panels = document.querySelectorAll('[data-super-panel]');
    if (!tabs.length) return;

    /**
     * @param {string} id
     */
    function setTab(id) {
      const nav = document.querySelector('.super-admin-dash .super-until-hero__links');
      if (nav instanceof HTMLElement) nav.dataset.on = id;
      tabs.forEach((btn) => {
        if (!(btn instanceof HTMLElement)) return;
        const on = btn.dataset.superTab === id;
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.classList.toggle('is-active', on);
      });
      panels.forEach((panel) => {
        if (!(panel instanceof HTMLElement)) return;
        const on = panel.dataset.superPanel === id;
        panel.hidden = !on;
        if (on) {
          panel.classList.remove('admin-fade-in-up');
          void panel.offsetWidth;
          panel.classList.add('admin-fade-in-up');
        }
      });
    }

    tabs.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => setTab(btn.dataset.superTab || 'locales'));
    });
  }

  function initPropViews() {
    const root = document.querySelector('[data-super-panel="propuestas"]');
    if (!(root instanceof HTMLElement) || root.dataset.viewsBound === 'true') return;
    root.dataset.viewsBound = 'true';
    const buttons = [...root.querySelectorAll('[data-prop-view]')];
    const panes = [...root.querySelectorAll('[data-prop-pane]')];

    const show = (id) => {
      const sw = root.querySelector('.super-props__switch');
      if (sw instanceof HTMLElement) sw.dataset.on = id;
      buttons.forEach((btn) => {
        if (!(btn instanceof HTMLElement)) return;
        btn.setAttribute('aria-selected', btn.dataset.propView === id ? 'true' : 'false');
      });
      panes.forEach((pane) => {
        if (!(pane instanceof HTMLElement)) return;
        pane.hidden = pane.dataset.propPane !== id;
      });
    };

    root.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const edit = target.closest('[data-prop-edit]');
      if (edit instanceof HTMLButtonElement && root.contains(edit)) {
        show('armar');
        const form = document.getElementById('propuesta-form');
        if (!(form instanceof HTMLFormElement)) return;
        const nombre = form.querySelector('[data-prop-nombre]');
        if (nombre instanceof HTMLInputElement) {
          nombre.value = edit.dataset.propNombre || '';
          nombre.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const sin = edit.dataset.propSin === 'true';
        const mode = form.querySelector(`[data-prop-price-mode][value="${sin ? 'consultar' : 'con'}"]`);
        if (mode instanceof HTMLInputElement) {
          mode.checked = true;
          mode.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const setWheel = (field, value) => {
          const input = form.querySelector(`input[name="${field}"]`);
          if (!(input instanceof HTMLInputElement)) return;
          input.value = value || '0';
          input.closest('.super-prop-wheel')?.querySelector('[data-wheel]')?.dispatchEvent(new Event('wheel-show'));
        };
        if (!sin) {
          setWheel('setup', edit.dataset.propSetup || '');
          setWheel('anual', edit.dataset.propAnual || '');
        }
        const logo = edit.dataset.propLogo || '';
        const logoInput = form.querySelector('[data-prop-logo]');
        if (logoInput instanceof HTMLInputElement) logoInput.value = logo;
        const logoMode = form.querySelector(`[data-prop-logo-mode][value="${logo ? 'con' : 'sin'}"]`);
        if (logoMode instanceof HTMLInputElement) {
          logoMode.checked = true;
          logoMode.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const mark = form.querySelector('[data-prop-logo-mark]');
        if (mark instanceof HTMLElement) {
          mark.style.backgroundImage = logo ? `url("${logo.replace(/"/g, '')}")` : '';
          mark.style.backgroundSize = logo ? 'cover' : '';
          mark.textContent = '';
        }
        const drop = form.querySelector('[data-prop-drop]');
        if (drop instanceof HTMLElement) drop.dataset.filled = logo ? 'true' : 'false';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const go = target.closest('[data-prop-view], [data-prop-view-go]');
      if (!(go instanceof HTMLElement) || !root.contains(go)) return;
      const id = go.dataset.propView || go.dataset.propViewGo || '';
      if (!id) return;
      show(id);
    });
  }

  const DEFAULT_CTA = 'AGREGAR USUARIO';
  const ACTIVE_CTA = 'AGREGAR USUARIO';

  /** @param {unknown} value */
  function escUser(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  /** @param {string | null} iso */
  function ultimoIngresoLabel(iso) {
    if (!iso) return 'Nunca ha entrado';
    const d = new Date(iso);
    const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (dias <= 0) return 'Entró hoy';
    if (dias === 1) return 'Entró ayer';
    if (dias < 30) return `Entró hace ${dias} días`;
    return `Entró el ${d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  /**
   * @param {string} restauranteId
   * @param {boolean} hasActive
   */
  function paintAccessBadge(restauranteId, hasActive) {
    const html = `<span class="super-hub-card__dot" aria-hidden="true"></span>${hasActive ? 'Acceso activo' : 'Sin acceso'}`;
    document
      .querySelectorAll(`[data-restaurante-id="${restauranteId}"] [data-access-badge]`)
      .forEach((badge) => {
        if (!(badge instanceof HTMLElement)) return;
        badge.className = `super-hub-card__state${hasActive ? ' super-hub-card__state--on' : ''}`;
        badge.innerHTML = html;
      });
  }

  /**
   * Lista de usuarios del local dentro del modal "Usuarios".
   * @param {Element | null | undefined} list
   */
  async function loadUsuarios(list) {
    if (!(list instanceof HTMLElement)) return;
    const restauranteId = list.dataset.restauranteId || '';
    if (!list.querySelector('.hub-user')) {
      list.innerHTML = '<p class="hub-users__empty">Cargando usuarios…</p>';
    }
    try {
      const res = await fetch(`/api/restaurante-usuarios?restaurante_id=${encodeURIComponent(restauranteId)}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar la lista.');
      /** @type {Array<{ id: string, email: string, rol: string, sede: string | null, suspendido: boolean, ultimo_ingreso: string | null }>} */
      const usuarios = data.usuarios || [];
      paintAccessBadge(restauranteId, usuarios.some((u) => !u.suspendido));
      paintRolePicker(list, Boolean(data.gadget_sucursales), data.sedes || []);
      const count = list.closest('.hub-modal__dialog')?.querySelector('[data-usuarios-count]');
      if (count instanceof HTMLElement) {
        count.hidden = usuarios.length === 0;
        count.textContent = String(usuarios.length);
      }
      if (!usuarios.length) {
        list.innerHTML = '<p class="hub-users__empty">Este local todavía no tiene usuarios. Agrega el primero abajo.</p>';
        return;
      }
      list.innerHTML = usuarios
        .map((u) => {
          const gerente = u.rol === 'gerente';
          const rol = gerente ? `Gerente · ${escUser(u.sede || 'Sede')}` : 'Admin';
          const compact = Boolean(list.closest('[data-access-local]'));
          if (compact) {
            return `
          <div class="hub-user${u.suspendido ? ' is-suspended' : ''}" data-user-id="${escUser(u.id)}" data-user-email="${escUser(u.email)}">
            <div class="hub-user__info">
              <p class="hub-user__email">${escUser(u.email)}</p>
              <p class="hub-user__meta">
                <em class="hub-user__pill${gerente ? ' is-gerente' : ''}">${rol}</em>
                <em class="hub-user__state"><b aria-hidden="true"></b>${u.suspendido ? 'Suspendido' : 'Activo'}</em>
              </p>
            </div>
            <div class="hub-user__actions">
              <button type="button" class="hub-user__btn hub-user__btn--key" data-user-action="password" aria-label="Editar clave"><svg class="hub-user__lock" viewBox="0 0 16 16" aria-hidden="true"><path class="hub-user__lock-shackle" d="M5 7.2V5.1a3 3 0 0 1 6 0V7.2"/><rect x="3.15" y="7.1" width="9.7" height="6.15" rx="1.45"/></svg>Clave</button>
              <button type="button" class="hub-user__btn hub-user__btn--danger" data-user-action="delete">Eliminar</button>
            </div>
            <div class="hub-user__panel" data-user-panel hidden></div>
          </div>`;
          }
          const inicial = escUser((u.email || '?').charAt(0).toUpperCase());
          return `
          <div class="hub-user${u.suspendido ? ' is-suspended' : ''}" data-user-id="${escUser(u.id)}" data-user-email="${escUser(u.email)}">
            <i class="hub-user__avatar${gerente ? ' is-gerente' : ''}" aria-hidden="true">${inicial}</i>
            <div class="hub-user__info">
              <p class="hub-user__email">${escUser(u.email)}</p>
              <p class="hub-user__meta">
                <em class="hub-user__pill${gerente ? ' is-gerente' : ''}">${rol}</em>
                <em class="hub-user__state"><b aria-hidden="true"></b>${u.suspendido ? 'Suspendido' : 'Activo'}</em>
                <em class="hub-user__seen">${escUser(ultimoIngresoLabel(u.ultimo_ingreso))}</em>
              </p>
            </div>
            <div class="hub-user__actions">
              <button type="button" class="hub-user__btn" data-user-action="${u.suspendido ? 'activate' : 'suspend'}">${u.suspendido ? 'Activar' : 'Suspender'}</button>
              <button type="button" class="hub-user__btn" data-user-action="password">Clave</button>
              <button type="button" class="hub-user__btn hub-user__btn--danger" data-user-action="delete">Eliminar</button>
            </div>
            <div class="hub-user__panel" data-user-panel hidden></div>
          </div>`;
        })
        .join('');
    } catch (err) {
      list.innerHTML = `<p class="hub-users__empty is-error">${escUser(err instanceof Error ? err.message : 'Error')}</p>`;
    }
  }

  /**
   * Rol "Gerente de sede" solo con el gadget Sucursales y al menos una sede activa.
   * @param {HTMLElement} list
   * @param {boolean} gadget
   * @param {Array<{ id: string, nombre: string, es_principal: boolean }>} sedes
   */
  function paintRolePicker(list, gadget, sedes) {
    const form = list.closest('.hub-modal__dialog')?.querySelector('[data-operativo-form]');
    if (!(form instanceof HTMLFormElement)) return;
    const opt = form.querySelector('[data-role-gerente]');
    const radio = opt?.querySelector('input');
    const hint = form.querySelector('[data-role-gerente-hint]');
    const select = form.querySelector('[data-sede-select]');
    const available = gadget && sedes.length > 0;
    if (radio instanceof HTMLInputElement) {
      radio.disabled = !available;
      if (!available && radio.checked) {
        const admin = form.querySelector('input[name="rol"][value="admin"]');
        if (admin instanceof HTMLInputElement) admin.checked = true;
      }
    }
    opt?.classList.toggle('is-disabled', !available);
    if (hint) hint.textContent = available ? 'Solo agota platos en su sede' : 'Requiere el gadget Sucursales';
    if (select instanceof HTMLSelectElement) {
      const prev = select.value;
      select.innerHTML = sedes
        .map((s) => `<option value="${escUser(s.id)}" data-nombre="${escUser(s.nombre)}">${escUser(s.nombre)}${s.es_principal ? ' (principal)' : ''}</option>`)
        .join('');
      if (sedes.some((s) => s.id === prev)) select.value = prev;
    }
    syncRoleFields(form);
  }

  /** @param {HTMLFormElement} form */
  function syncRoleFields(form) {
    const gerente = form.querySelector('input[name="rol"]:checked')?.getAttribute('value') === 'gerente';
    const field = form.querySelector('[data-sede-field]');
    if (field instanceof HTMLElement) field.hidden = !gerente;
  }

  function generarClave() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return Array.from(bytes, (n) => chars[n % chars.length]).join('');
  }

  function initAccessBoard() {
    document.querySelectorAll('[data-access-local]').forEach((el) => {
      if (!(el instanceof HTMLDetailsElement) || el.dataset.bound === 'true') return;
      el.dataset.bound = 'true';
      el.addEventListener('toggle', () => {
        if (!el.open) return;
        document.querySelectorAll('[data-access-local]').forEach((other) => {
          if (other !== el && other instanceof HTMLDetailsElement && other.open) other.open = false;
        });
        void loadUsuarios(el.querySelector('[data-usuarios-list]'));
      });
    });
  }

  function initUsuarios() {
    if (document.documentElement.dataset.hubUsersBound === 'true') return;
    document.documentElement.dataset.hubUsersBound = 'true';
    document.addEventListener('change', (event) => {
      const radio = event.target;
      if (!(radio instanceof HTMLInputElement) || radio.name !== 'rol') return;
      const form = radio.closest('[data-operativo-form]');
      if (form instanceof HTMLFormElement) syncRoleFields(form);
    });
    document.addEventListener('click', (event) => {
      const gen = event.target instanceof Element ? event.target.closest('[data-gen-pass]') : null;
      if (!(gen instanceof HTMLButtonElement)) return;
      event.preventDefault();
      const input = gen.parentElement?.querySelector('input[name="password"]');
      if (input instanceof HTMLInputElement) {
        input.value = generarClave();
        input.select();
      }
    });
    document.addEventListener('click', async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const row = target?.closest('[data-user-id]');
      const list = target?.closest('[data-usuarios-list]');
      if (!(row instanceof HTMLElement) || !(list instanceof HTMLElement)) return;
      const panel = row.querySelector('[data-user-panel]');
      if (!(panel instanceof HTMLElement)) return;
      const email = escUser(row.dataset.userEmail || '');

      if (target?.closest('[data-user-cancel]')) {
        closeUserPanel(row);
        return;
      }

      const confirmBtn = target?.closest('[data-user-confirm]');
      if (confirmBtn instanceof HTMLButtonElement) {
        await runUserAction(row, list, panel, confirmBtn.dataset.userConfirm || '');
        return;
      }

      const btn = target?.closest('[data-user-action]');
      if (!(btn instanceof HTMLButtonElement)) return;
      const action = btn.dataset.userAction || '';
      const wasOpen = !panel.hidden && panel.dataset.action === action;
      list.querySelectorAll('[data-user-id]').forEach((r) => {
        if (r instanceof HTMLElement) closeUserPanel(r);
      });
      if (wasOpen) return;

      if (action === 'activate') {
        panel.hidden = false;
        panel.innerHTML = '<p class="hub-user__panel-msg" data-panel-msg></p>';
        await runUserAction(row, list, panel, action);
        return;
      }

      panel.dataset.action = action;
      btn.classList.add('is-on');
      if (action === 'password') {
        panel.innerHTML = `
          <p class="hub-user__panel-title">Nueva clave para ${email}</p>
          <div class="hub-user__panel-row">
            <div class="hub-pass">
              <input type="text" name="password" minlength="8" autocomplete="new-password" spellcheck="false" placeholder="Mín. 8 caracteres" />
              <button type="button" class="hub-pass__gen" data-gen-pass>Generar</button>
            </div>
            <button type="button" class="hub-user__cta" data-user-confirm="password">Guardar clave</button>
            <button type="button" class="hub-user__btn" data-user-cancel>Cancelar</button>
          </div>
          <p class="hub-user__panel-msg" data-panel-msg></p>`;
      } else {
        const copy =
          action === 'delete'
            ? { text: `¿Eliminar a ${email}? Su cuenta se borra y deja de poder entrar.`, cta: 'Sí, eliminar', danger: true }
            : { text: `¿Suspender a ${email}? No podrá entrar hasta que lo actives.`, cta: 'Sí, suspender', danger: false };
        panel.innerHTML = `
          <p class="hub-user__panel-title">${copy.text}</p>
          <div class="hub-user__panel-row">
            <button type="button" class="hub-user__cta${copy.danger ? ' is-danger' : ''}" data-user-confirm="${action}">${copy.cta}</button>
            <button type="button" class="hub-user__btn" data-user-cancel>Cancelar</button>
          </div>
          <p class="hub-user__panel-msg" data-panel-msg></p>`;
      }
      panel.hidden = false;
      const input = panel.querySelector('input');
      if (input instanceof HTMLInputElement) input.focus();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.closest('[data-user-panel]')) return;
      event.preventDefault();
      input.closest('[data-user-panel]')?.querySelector('[data-user-confirm]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });
  }

  /**
   * @param {HTMLElement} row
   * @param {HTMLElement} list
   * @param {HTMLElement} panel
   * @param {string} action
   */
  async function runUserAction(row, list, panel, action) {
    const email = escUser(row.dataset.userEmail || '');
    /** @type {Record<string, unknown>} */
    const body = { action, user_id: row.dataset.userId, restaurante_id: list.dataset.restauranteId };
    if (action === 'password') {
      const input = panel.querySelector('input[name="password"]');
      const password = input instanceof HTMLInputElement ? input.value.trim() : '';
      if (password.length < 8) {
        setPanelMsg(panel, 'La clave debe tener al menos 8 caracteres.', true);
        if (input instanceof HTMLInputElement) input.focus();
        return;
      }
      body.password = password;
    }
    const controls = () => panel.querySelectorAll('button, input');
    controls().forEach((el) => {
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) el.disabled = true;
    });
    setPanelMsg(panel, 'Guardando…');
    try {
      const res = await fetch('/api/restaurante-usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo completar la acción.');
      if (action === 'password') {
        panel.innerHTML = `<p class="hub-user__panel-msg is-ok">Clave cambiada. ${email} ya entra con <strong>${escUser(body.password)}</strong> (la anterior dejó de funcionar).</p>
          <div class="hub-user__panel-row"><button type="button" class="hub-user__btn" data-user-cancel>Listo</button></div>`;
        return;
      }
      await loadUsuarios(list);
    } catch (err) {
      controls().forEach((el) => {
        if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) el.disabled = false;
      });
      setPanelMsg(panel, err instanceof Error ? err.message : 'Error', true);
    }
  }

  /** @param {HTMLElement} row */
  function closeUserPanel(row) {
    const panel = row.querySelector('[data-user-panel]');
    if (panel instanceof HTMLElement) {
      panel.hidden = true;
      panel.innerHTML = '';
      delete panel.dataset.action;
    }
    row.querySelectorAll('[data-user-action].is-on').forEach((b) => b.classList.remove('is-on'));
  }

  /**
   * @param {HTMLElement} panel
   * @param {string} msg
   * @param {boolean} [isError]
   */
  function setPanelMsg(panel, msg, isError = false) {
    const el = panel.querySelector('[data-panel-msg]');
    if (!(el instanceof HTMLElement)) return;
    el.textContent = msg;
    el.classList.toggle('is-error', isError);
  }

  /**
   * @param {HTMLFormElement} form
   */
  function markAccessActive(form) {
    form.dataset.hasAccess = 'true';
    const restauranteId = form.dataset.restauranteId || '';
    const card =
      form.closest('li.super-hub-card') ||
      document.querySelector(`li.super-hub-card[data-restaurante-id="${restauranteId}"]`);
    const badge = card?.querySelector('[data-access-badge]');
    if (badge instanceof HTMLElement) {
      badge.className = 'super-hub-card__state super-hub-card__state--on';
      badge.innerHTML =
        '<span class="super-hub-card__dot" aria-hidden="true"></span>Acceso activo';
    }
  }

  /**
   * @param {HTMLElement | null | undefined} panel
   * @param {boolean} open
   */
  function toggleOverlayPanel(panel, open) {
    if (!(panel instanceof HTMLElement)) return;
    if (open) {
      // Close other hub modals first
      document.querySelectorAll('.hub-modal.is-open').forEach((el) => {
        if (el === panel) return;
        if (el instanceof HTMLElement) toggleOverlayPanel(el, false);
      });
      if (!panel.dataset.hubHome && panel.parentElement) {
        panel.dataset.hubHome = 'parked';
        panel.dataset.hubOwner = panel.parentElement.tagName;
      }
      if (panel.parentElement !== document.body) {
        document.body.appendChild(panel);
      }
      panel.hidden = false;
      panel.classList.remove('hidden');
      panel.classList.add('is-open');
      document.documentElement.style.overflow = 'hidden';
    } else {
      panel.hidden = true;
      panel.classList.add('hidden');
      panel.classList.remove('is-open');
      // Restore into original card if possible
      const ownerId = panel.dataset.restauranteHost;
      if (ownerId) {
        const host = document.querySelector(`li.super-hub-card[data-restaurante-id="${ownerId}"]`);
        if (host instanceof HTMLElement) host.appendChild(panel);
      }
      if (!document.querySelector('.hub-modal.is-open')) {
        document.documentElement.style.overflow = '';
      }
    }
  }

  /**
   * @param {File} file
   * @param {string} [slug]
   */
  async function uploadCardMedia(file, slug) {
    const body = new FormData();
    body.append('file', file);
    if (slug) body.append('restaurante_slug', slug);
    body.append('asset_type', 'identity');
    const res = await fetch('/api/upload', { method: 'POST', body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) {
      throw new Error(json.error || 'No se pudo subir la imagen');
    }
    return String(json.url);
  }

  /**
   * @param {HTMLElement} panel
   * @param {HTMLElement} anchor
   */
  function placeFixedMenu(panel, anchor) {
    panel.style.visibility = 'hidden';
    panel.classList.add('is-open');
    panel.style.display = 'flex';
    const rect = anchor.getBoundingClientRect();
    const menuW = Math.max(panel.offsetWidth || 248, 248);
    const menuH = panel.offsetHeight || 320;
    let left = rect.right - menuW;
    let top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuW - 8);
    }
    if (top + menuH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuH - 8);
    }
    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.right = 'auto';
    panel.style.visibility = '';
  }

  /**
   * @param {HTMLDetailsElement} details
   * @param {HTMLElement} panel
   */
  function openCardMenu(details, panel) {
    const summary = details.querySelector('summary');
    if (!(summary instanceof HTMLElement)) return;
    if (!details.dataset.menuId) {
      details.dataset.menuId = `menu-${Math.random().toString(36).slice(2, 9)}`;
    }
    panel.dataset.ownerId = details.dataset.menuId;
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
    placeFixedMenu(panel, summary);
    details.open = true;
  }

  /**
   * @param {HTMLDetailsElement} details
   * @param {HTMLElement | null} panel
   */
  function closeCardMenu(details, panel) {
    if (panel instanceof HTMLElement) {
      panel.classList.remove('is-open');
      panel.style.display = 'none';
      if (panel.parentElement === document.body) {
        details.appendChild(panel);
      }
    }
    details.open = false;
  }

  /**
   * @param {HTMLDetailsElement} details
   */
  function getMenuPanel(details) {
    const ownerId = details.dataset.menuId || '';
    const fromBody =
      ownerId &&
      document.querySelector(`[data-card-menu-panel][data-owner-id="${ownerId}"]`);
    if (fromBody instanceof HTMLElement) return fromBody;
    const local = details.querySelector('[data-card-menu-panel]');
    return local instanceof HTMLElement ? local : null;
  }

  function closeAllCardMenus(except = null) {
    document.querySelectorAll('[data-card-menu]').forEach((el) => {
      if (!(el instanceof HTMLDetailsElement) || el === except) return;
      closeCardMenu(el, getMenuPanel(el));
    });
  }

  function initCardMenus() {
    /**
     * @param {HTMLElement} card
     * @param {boolean} activo
     * @param {HTMLElement} [toggleBtn]
     */
    function paintHubActivo(card, activo, toggleBtn) {
      card.dataset.hubActivo = activo ? 'true' : 'false';
      card.classList.toggle('super-hub-card--paused', !activo);

      let badge = card.querySelector('[data-estado-badge]');
      const badgeHost = card.querySelector('[data-estado-host]');
      if (!activo) {
        if (!(badge instanceof HTMLElement) && badgeHost instanceof HTMLElement) {
          badge = document.createElement('span');
          badge.setAttribute('data-estado-badge', '');
          badge.className = 'super-hub-card__state super-hub-card__state--paused';
          badge.innerHTML =
            '<span class="super-hub-card__dot" aria-hidden="true"></span>Desactivado';
          badgeHost.prepend(badge);
        }
      } else if (badge instanceof HTMLElement) {
        badge.remove();
      }

      const btn = toggleBtn || card.querySelector('[data-toggle-activo]');
      if (btn instanceof HTMLElement) {
        btn.dataset.activo = activo ? 'true' : 'false';
        const label = btn.querySelector('[data-toggle-activo-label]');
        const hint = btn.querySelector('[data-toggle-activo-hint]');
        if (label) label.textContent = activo ? 'Desactivar local' : 'Reactivar local';
        if (hint) {
          hint.textContent = activo
            ? 'Pausar sin borrar (impago)'
            : 'Volver a publicar la WebApp';
        }
      }
    }

    document.querySelectorAll('[data-card-menu]').forEach((details) => {
      if (!(details instanceof HTMLDetailsElement)) return;
      if (details.dataset.bound === 'true') return;
      details.dataset.bound = 'true';

      const card = details.closest('li');
      const panel = details.querySelector('[data-card-menu-panel]');
      if (!(panel instanceof HTMLElement)) return;

      const credsPanel = card?.querySelector('[data-creds-panel]');
      const fichaPanel = card?.querySelector('[data-ficha-panel]');
      const infoPanel = card?.querySelector('[data-info-panel]');
      const ventasPanel = card?.querySelector('[data-ventas-panel]');
      const closeCreds = credsPanel?.querySelectorAll('[data-close-creds]');
      const closeFicha = fichaPanel?.querySelectorAll('[data-close-ficha]');
      const closeInfo = infoPanel?.querySelectorAll('[data-close-info]');
      const closeVentas = ventasPanel?.querySelectorAll('[data-close-ventas]');
      const summary = details.querySelector('summary');

      details.addEventListener('toggle', () => {
        if (details.open) {
          closeAllCardMenus(details);
          openCardMenu(details, panel);
        } else if (panel.classList.contains('is-open')) {
          closeCardMenu(details, panel);
        }
      });

      const bindPanelActions = (root) => {
        if (!(root instanceof HTMLElement)) return;
        root.querySelectorAll('[data-open-ventas]').forEach((btn) => {
          if (!(btn instanceof HTMLElement) || btn.dataset.boundAction === 'true') return;
          btn.dataset.boundAction = 'true';
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            closeCardMenu(details, panel);
            toggleOverlayPanel(credsPanel instanceof HTMLElement ? credsPanel : null, false);
            toggleOverlayPanel(fichaPanel instanceof HTMLElement ? fichaPanel : null, false);
            toggleOverlayPanel(infoPanel instanceof HTMLElement ? infoPanel : null, false);
            toggleOverlayPanel(ventasPanel instanceof HTMLElement ? ventasPanel : null, true);
          });
        });
        root.querySelectorAll('[data-open-creds]').forEach((btn) => {
          if (!(btn instanceof HTMLElement) || btn.dataset.boundAction === 'true') return;
          btn.dataset.boundAction = 'true';
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            closeCardMenu(details, panel);
            toggleOverlayPanel(fichaPanel instanceof HTMLElement ? fichaPanel : null, false);
            toggleOverlayPanel(infoPanel instanceof HTMLElement ? infoPanel : null, false);
            toggleOverlayPanel(ventasPanel instanceof HTMLElement ? ventasPanel : null, false);
            toggleOverlayPanel(credsPanel instanceof HTMLElement ? credsPanel : null, true);
            void loadUsuarios(credsPanel?.querySelector('[data-usuarios-list]'));
          });
        });
        root.querySelectorAll('[data-open-ficha]').forEach((btn) => {
          if (!(btn instanceof HTMLElement) || btn.dataset.boundAction === 'true') return;
          btn.dataset.boundAction = 'true';
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            closeCardMenu(details, panel);
            toggleOverlayPanel(credsPanel instanceof HTMLElement ? credsPanel : null, false);
            toggleOverlayPanel(infoPanel instanceof HTMLElement ? infoPanel : null, false);
            toggleOverlayPanel(ventasPanel instanceof HTMLElement ? ventasPanel : null, false);
            toggleOverlayPanel(fichaPanel instanceof HTMLElement ? fichaPanel : null, true);
          });
        });
        root.querySelectorAll('[data-open-info]').forEach((btn) => {
          if (!(btn instanceof HTMLElement) || btn.dataset.boundAction === 'true') return;
          btn.dataset.boundAction = 'true';
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            closeCardMenu(details, panel);
            toggleOverlayPanel(credsPanel instanceof HTMLElement ? credsPanel : null, false);
            toggleOverlayPanel(fichaPanel instanceof HTMLElement ? fichaPanel : null, false);
            toggleOverlayPanel(ventasPanel instanceof HTMLElement ? ventasPanel : null, false);
            toggleOverlayPanel(infoPanel instanceof HTMLElement ? infoPanel : null, true);
          });
        });
        root.querySelectorAll('[data-toggle-activo]').forEach((btn) => {
          if (!(btn instanceof HTMLElement) || btn.dataset.boundAction === 'true') return;
          btn.dataset.boundAction = 'true';
          btn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const cardEl = details.closest('li.super-hub-card');
            if (!(cardEl instanceof HTMLElement)) return;
            const id = cardEl.dataset.restauranteId || '';
            const slug = cardEl.dataset.hubSlug || '';
            const currentlyActive = cardEl.dataset.hubActivo !== 'false';
            const nextActivo = !currentlyActive;
            const nombre = slug || 'este local';
            const ok = window.confirm(
              nextActivo
                ? `¿Reactivar «${nombre}»?\nLa WebApp pública volverá a estar disponible.`
                : `¿Desactivar «${nombre}»?\nLa WebApp pública quedará fuera de línea. Los datos se conservan.`,
            );
            if (!ok) return;
            closeCardMenu(details, panel);
            btn.setAttribute('disabled', 'true');
            try {
              const res = await fetch('/api/update-restaurante-estado', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, activo: nextActivo }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(json.error || 'No se pudo actualizar');
              paintHubActivo(cardEl, nextActivo, btn);
            } catch (err) {
              window.alert(err instanceof Error ? err.message : 'Error al actualizar');
            } finally {
              btn.removeAttribute('disabled');
            }
          });
        });
        root.querySelectorAll('[data-delete-restaurante]').forEach((btn) => {
          if (!(btn instanceof HTMLElement) || btn.dataset.boundAction === 'true') return;
          btn.dataset.boundAction = 'true';
          btn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const cardEl = details.closest('li.super-hub-card');
            if (!(cardEl instanceof HTMLElement)) return;
            const id = cardEl.dataset.restauranteId || '';
            const slug = String(cardEl.dataset.hubSlug || '').trim();
            if (!slug) {
              window.alert('Este local no tiene slug; no se puede confirmar la eliminación.');
              return;
            }
            const typed = window.prompt(
              `Esto BORRA el restaurante, su menú y datos de forma permanente.\n\nEscribí el slug para confirmar:\n${slug}`,
              '',
            );
            if (typed == null) return;
            if (String(typed).trim().toLowerCase() !== slug.toLowerCase()) {
              window.alert('Slug incorrecto. Eliminación cancelada.');
              return;
            }
            closeCardMenu(details, panel);
            btn.setAttribute('disabled', 'true');
            try {
              const res = await fetch('/api/delete-restaurante', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, confirm: slug }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(json.error || 'No se pudo eliminar');
              cardEl.remove();
              const countEl = document.querySelector('[data-hub-search-count]');
              const cardsLeft = document.querySelectorAll(
                'li.super-hub-card[data-restaurante-id]',
              ).length;
              if (countEl) {
                countEl.textContent =
                  cardsLeft === 1 ? '1 local' : `${cardsLeft} locales`;
              }
              const emptyEl = document.querySelector('[data-hub-search-empty]');
              if (emptyEl instanceof HTMLElement) {
                emptyEl.hidden = cardsLeft > 0;
              }
            } catch (err) {
              window.alert(err instanceof Error ? err.message : 'Error al eliminar');
            } finally {
              btn.removeAttribute('disabled');
            }
          });
        });
      };

      bindPanelActions(panel);

      panel.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const item = target.closest('[role="menuitem"]');
        if (!(item instanceof HTMLElement)) return;
        if (
          item.hasAttribute('data-open-ficha') ||
          item.hasAttribute('data-open-creds') ||
          item.hasAttribute('data-open-info') ||
          item.hasAttribute('data-open-ventas') ||
          item.hasAttribute('data-toggle-activo') ||
          item.hasAttribute('data-delete-restaurante')
        ) {
          return;
        }
        window.setTimeout(() => closeCardMenu(details, panel), 0);
      });

      closeCreds?.forEach((btn) => {
        btn.addEventListener('click', () => {
          toggleOverlayPanel(credsPanel instanceof HTMLElement ? credsPanel : null, false);
        });
      });

      closeFicha?.forEach((btn) => {
        btn.addEventListener('click', () => {
          toggleOverlayPanel(fichaPanel instanceof HTMLElement ? fichaPanel : null, false);
        });
      });

      closeInfo?.forEach((btn) => {
        btn.addEventListener('click', () => {
          toggleOverlayPanel(infoPanel instanceof HTMLElement ? infoPanel : null, false);
        });
      });

      closeVentas?.forEach((btn) => {
        btn.addEventListener('click', () => {
          toggleOverlayPanel(ventasPanel instanceof HTMLElement ? ventasPanel : null, false);
        });
      });

      const paintVentasHint = () => {
        if (!(ventasPanel instanceof HTMLElement)) return;
        const sums = { usd: 0, bs: 0 };
        ventasPanel.querySelectorAll('[data-venta-id]').forEach((row) => {
          if (!(row instanceof HTMLElement)) return;
          const moneda = row.dataset.moneda === 'bs' ? 'bs' : 'usd';
          sums[moneda] += Number(row.dataset.monto) || 0;
        });
        const parts = [];
        if (sums.usd > 0) parts.push(formatVentaMonto(sums.usd, 'usd'));
        if (sums.bs > 0) parts.push(formatVentaMonto(sums.bs, 'bs'));
        const hint = panel.querySelector('[data-ventas-hint]');
        if (hint) hint.textContent = parts.join(' · ') || 'Todavía nada';
        const empty = ventasPanel.querySelector('[data-ventas-empty]');
        if (empty instanceof HTMLElement) empty.hidden = ventasPanel.querySelector('[data-venta-id]') instanceof HTMLElement;
      };

      const ventasForm = ventasPanel?.querySelector('[data-ventas-form]');
      ventasForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!(ventasForm instanceof HTMLFormElement) || !(ventasPanel instanceof HTMLElement)) return;
        const status = ventasPanel.querySelector('[data-ventas-status]');
        const submit = ventasForm.querySelector('[type="submit"]');
        if (submit instanceof HTMLButtonElement) submit.disabled = true;
        if (status) status.textContent = '';
        const data = new FormData(ventasForm);
        try {
          const res = await fetch('/api/restaurante-ventas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restauranteId: ventasForm.dataset.restauranteId || '',
              producto: data.get('producto'),
              monto: data.get('monto'),
              moneda: data.get('moneda'),
            }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload.error || 'No se pudo guardar');
          const venta = payload.venta || {};
          const list = ventasPanel.querySelector('[data-ventas-list]');
          const item = document.createElement('li');
          item.dataset.ventaId = String(venta.id || '');
          item.dataset.monto = String(venta.monto ?? '');
          item.dataset.moneda = String(venta.moneda || 'usd');
          const name = document.createElement('span');
          name.textContent = String(venta.label || '');
          const amount = document.createElement('b');
          amount.textContent = String(venta.texto || '');
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.dataset.ventaRemove = '';
          remove.setAttribute('aria-label', `Quitar ${venta.label || 'venta'}`);
          remove.textContent = 'Quitar';
          item.append(name, amount, remove);
          list?.prepend(item);
          const monto = ventasForm.querySelector('[name="monto"]');
          const producto = ventasForm.querySelector('[name="producto"]');
          if (monto instanceof HTMLInputElement) monto.value = '';
          if (producto instanceof HTMLSelectElement) producto.value = '';
          paintVentasHint();
        } catch (err) {
          if (status) status.textContent = err instanceof Error ? err.message : 'No se pudo guardar';
        } finally {
          if (submit instanceof HTMLButtonElement) submit.disabled = false;
        }
      });

      ventasPanel?.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof Element) || !(ventasPanel instanceof HTMLElement)) return;
        const remove = target.closest('[data-venta-remove]');
        if (!(remove instanceof HTMLButtonElement)) return;
        const row = remove.closest('[data-venta-id]');
        if (!(row instanceof HTMLElement) || !row.dataset.ventaId) return;
        remove.disabled = true;
        try {
          const res = await fetch('/api/restaurante-ventas', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: row.dataset.ventaId }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload.error || 'No se pudo quitar');
          row.remove();
          paintVentasHint();
        } catch (err) {
          remove.disabled = false;
          const status = ventasPanel.querySelector('[data-ventas-status]');
          if (status) status.textContent = err instanceof Error ? err.message : 'No se pudo quitar';
        }
      });

      const reposition = () => {
        if (!details.open || !(summary instanceof HTMLElement)) return;
        if (panel.parentElement !== document.body) return;
        placeFixedMenu(panel, summary);
      };
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
    });

    if (document.documentElement.dataset.cardMenuOutsideBound !== 'true') {
      document.documentElement.dataset.cardMenuOutsideBound = 'true';
      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        document.querySelectorAll('[data-card-menu][open]').forEach((el) => {
          if (!(el instanceof HTMLDetailsElement)) return;
          const panel = getMenuPanel(el);
          const inDetails = el.contains(target);
          const inPanel = panel instanceof HTMLElement && panel.contains(target);
          if (!inDetails && !inPanel) closeCardMenu(el, panel);
        });
      });
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('.hub-modal.is-open').forEach((el) => {
          if (el instanceof HTMLElement) toggleOverlayPanel(el, false);
        });
        closeAllCardMenus();
      });
    }
  }

  function initFichaForms() {
    document.querySelectorAll('[data-ficha-form]').forEach((form) => {
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.bound === 'true') return;
      form.dataset.bound = 'true';

      const restauranteId = form.dataset.restauranteId || '';
      const restauranteSlug = form.dataset.slug || '';
      const logoFile = form.querySelector('[data-ficha-logo-file]');
      const logoHidden = form.querySelector('[data-ficha-logo-url]');
      const tarjetaInput = form.querySelector('[data-ficha-tarjeta]');
      const stage = form.querySelector('[data-ficha-stage]');
      const feedback = form.querySelector('[data-ficha-feedback]');

      form.querySelectorAll('[data-ficha-color]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-ficha-color') || '';
          if (!id) return;
          if (tarjetaInput instanceof HTMLInputElement) tarjetaInput.value = id;
          if (stage instanceof HTMLElement) stage.dataset.tarjeta = id;
          form.querySelectorAll('[data-ficha-color]').forEach((other) => {
            const on = other === btn;
            other.classList.toggle('is-on', on);
            if (other instanceof HTMLElement) other.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        });
      });

      if (logoFile instanceof HTMLInputElement) {
        logoFile.addEventListener('change', () => {
          const file = logoFile.files?.[0];
          logoFile.value = '';
          if (!file) return;

          const runUpload = async (croppedFile) => {
            if (feedback instanceof HTMLElement) {
              feedback.textContent = 'Subiendo…';
              feedback.classList.remove('hidden', 'text-rose-400', 'text-emerald-400');
              feedback.classList.add('text-zinc-400');
            }
            try {
              const url = await uploadCardMedia(croppedFile, restauranteSlug);
              if (logoHidden instanceof HTMLInputElement) logoHidden.value = url;

              const preview = form.querySelector('[data-ficha-logo-preview]');
              if (preview instanceof HTMLElement) {
                preview.querySelector('[data-ficha-logo-empty]')?.remove();
                let img = preview.querySelector('[data-ficha-logo-img]');
                if (!(img instanceof HTMLImageElement)) {
                  img = document.createElement('img');
                  img.alt = '';
                  img.dataset.fichaLogoImg = '';
                  img.className = 'hub-ficha-stage__img';
                  preview.appendChild(img);
                }
                img.src = url;
              }

              if (feedback instanceof HTMLElement) {
                feedback.textContent = '✓ imagen lista — guardá la ficha';
                feedback.classList.remove('text-zinc-400', 'text-rose-400');
                feedback.classList.add('text-emerald-400');
              }
            } catch (err) {
              if (feedback instanceof HTMLElement) {
                feedback.textContent =
                  err instanceof Error ? err.message : 'Error al subir';
                feedback.classList.remove('text-zinc-400', 'text-emerald-400');
                feedback.classList.add('text-rose-400');
              }
            }
          };

          const cropApi = window.XemillaImageCrop;
          if (cropApi && typeof cropApi.open === 'function') {
            void cropApi.open({
              file,
              aspect: 'logo',
              title: 'Recortar logo',
              onConfirm: (cropped) => runUpload(cropped),
            });
            return;
          }

          void runUpload(file);
        });
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const card = document.querySelector(
          `li.super-hub-card[data-restaurante-id="${restauranteId}"]`,
        );
        const fichaPanel = document.querySelector(
          `[data-ficha-panel][data-restaurante-host="${restauranteId}"]`,
        );
        const nombreInput = form.querySelector('input[name="nombre_comercial"]');
        const phoneInput = form.querySelector('input[name="whatsapp_num"]');
        const submitBtn = form.querySelector('button[type="submit"]');
        if (!(submitBtn instanceof HTMLButtonElement)) return;

        const nombre =
          nombreInput instanceof HTMLInputElement ? nombreInput.value.trim() : '';
        const telefono =
          phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : '';
        const logoUrl =
          logoHidden instanceof HTMLInputElement ? logoHidden.value.trim() : '';
        const tarjeta =
          tarjetaInput instanceof HTMLInputElement ? tarjetaInput.value.trim() : '';

        if (!nombre) {
          if (feedback instanceof HTMLElement) {
            feedback.textContent = 'El nombre es obligatorio';
            feedback.classList.remove('hidden', 'text-emerald-400');
            feedback.classList.add('text-rose-400');
          }
          return;
        }

        submitBtn.disabled = true;
        const prev = submitBtn.textContent;
        submitBtn.textContent = 'Guardando…';

        try {
          /** @type {Record<string, string>} */
          const body = {
            restaurante_id: restauranteId,
            nombre_comercial: nombre,
            whatsapp_num: telefono,
          };
          if (logoUrl) body.logo_url = logoUrl;
          if (tarjeta) body.tarjeta = tarjeta;

          const res = await fetch('/api/update-hub-datos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'No se pudo guardar');

          const logoZone = card?.querySelector('[data-card-logo-zone]');
          const savedLogo = String(data.restaurante?.logo_url || logoUrl || '').trim();
          const savedName = String(data.restaurante?.nombre_comercial || nombre);
          const savedTarjeta = String(data.restaurante?.tarjeta || tarjeta || '').trim();
          if (card instanceof HTMLElement) {
            card.dataset.hubName = `${savedName} ${card.dataset.hubSlug || ''}`.toLowerCase();
          }
          const face = card?.querySelector('.super-hub-card__face');
          if (face instanceof HTMLElement && savedTarjeta) face.dataset.tarjeta = savedTarjeta;

          if (logoZone instanceof HTMLElement) {
            if (savedLogo) {
              logoZone.querySelector('[data-card-logo-empty]')?.remove();
              let img = logoZone.querySelector('[data-card-logo-img]');
              if (!(img instanceof HTMLImageElement)) {
                img = document.createElement('img');
                img.dataset.cardLogoImg = '';
                img.className = 'super-hub-card__logo-img';
                logoZone.appendChild(img);
              }
              img.src = savedLogo;
              img.alt = savedName || '';
            }

            const fichaLogoPreview = form.querySelector('[data-ficha-logo-preview]');
            if (fichaLogoPreview instanceof HTMLElement && savedLogo) {
              fichaLogoPreview.querySelector('[data-ficha-logo-empty]')?.remove();
              let pImg = fichaLogoPreview.querySelector('[data-ficha-logo-img]');
              if (!(pImg instanceof HTMLImageElement)) {
                pImg = document.createElement('img');
                pImg.dataset.fichaLogoImg = '';
                pImg.className = 'hub-ficha-stage__img';
                fichaLogoPreview.appendChild(pImg);
              }
              pImg.src = savedLogo;
            }
          }

          if (feedback instanceof HTMLElement) {
            feedback.textContent = '✓ ficha actualizada';
            feedback.classList.remove('hidden', 'text-rose-400');
            feedback.classList.add('text-emerald-400');
          }

          window.setTimeout(() => {
            toggleOverlayPanel(
              fichaPanel instanceof HTMLElement ? fichaPanel : null,
              false,
            );
          }, 700);
        } catch (err) {
          if (feedback instanceof HTMLElement) {
            feedback.textContent =
              err instanceof Error ? err.message : 'Error al guardar';
            feedback.classList.remove('hidden', 'text-emerald-400');
            feedback.classList.add('text-rose-400');
          }
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = prev || 'Guardar ficha';
        }
      });
    });
  }

  /** Placas sin color guardado: muestrear del cover en vivo (no borra covers). */
  async function hydrateLogoPlatesFromCovers() {
    const sample = window.XemillaImageCrop?.samplePlateColorFromUrl;
    if (typeof sample !== 'function') return;
    const cards = document.querySelectorAll('li.super-hub-card[data-restaurante-id]');
    for (const card of cards) {
      if (!(card instanceof HTMLElement)) continue;
      const zone = card.querySelector('[data-card-logo-zone]');
      const coverImg = card.querySelector('[data-card-cover-img]');
      if (!(zone instanceof HTMLElement) || !(coverImg instanceof HTMLImageElement)) continue;
      const stored = String(zone.dataset.logoPlateBg || '').trim();
      if (stored && stored !== '#111111') continue;
      const src = coverImg.currentSrc || coverImg.src;
      if (!src) continue;
      try {
        const hex = await sample(src);
        zone.style.setProperty('--hub-logo-plate', hex);
        zone.style.background = hex;
        zone.dataset.logoPlateBg = hex;
        const host = card.dataset.restauranteId;
        const bgInput = document.querySelector(
          `[data-ficha-form][data-restaurante-id="${host}"] [data-ficha-logo-bg]`,
        );
        if (bgInput instanceof HTMLInputElement) bgInput.value = hex;
        const preview = document.querySelector(
          `[data-ficha-panel][data-restaurante-host="${host}"] [data-ficha-logo-preview]`,
        );
        if (preview instanceof HTMLElement) {
          preview.style.setProperty('--hub-logo-plate', hex);
          preview.style.background = hex;
        }
      } catch {
        /* ignore */
      }
    }
  }

  function initOperativoForms() {
    document.querySelectorAll('[data-operativo-form]').forEach((form) => {
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.bound === 'true') return;
      form.dataset.bound = 'true';

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const restauranteId = form.dataset.restauranteId || '';
        const feedback = form.querySelector('[data-operativo-feedback]');
        const submitBtn = form.querySelector('button[type="submit"]');
        const emailInput = form.querySelector('input[name="email"]');
        const passwordInput = form.querySelector('input[name="password"]');

        if (!(feedback instanceof HTMLElement) || !(submitBtn instanceof HTMLButtonElement)) {
          return;
        }

        const email =
          emailInput instanceof HTMLInputElement ? emailInput.value.trim() : '';
        const password =
          passwordInput instanceof HTMLInputElement ? passwordInput.value : '';

        const idleLabel = form.dataset.cta || (form.dataset.hasAccess === 'true' ? ACTIVE_CTA : DEFAULT_CTA);

        feedback.classList.add('hidden');
        feedback.textContent = '';
        feedback.classList.remove('text-rose-400', 'text-emerald-400');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando...';

        const rolGerente =
          form.querySelector('input[name="rol"]:checked')?.getAttribute('value') === 'gerente';
        const sedeSelect = form.querySelector('[data-sede-select]');
        const sucursalId = sedeSelect instanceof HTMLSelectElement ? sedeSelect.value : '';

        try {
          const send = (confirmarReasignacion) =>
            rolGerente
              ? fetch('/api/sucursal-gerentes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                  body: JSON.stringify({ action: 'create', sucursal_id: sucursalId, email, password }),
                })
              : fetch('/api/create-admin-user', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                  body: JSON.stringify({
                    email,
                    password,
                    restaurante_id: restauranteId,
                    confirmar_reasignacion: confirmarReasignacion,
                  }),
                });
          const reasignar = form.dataset.reassignEmail === email.toLowerCase();
          delete form.dataset.reassignEmail;
          const res = await send(reasignar);
          /** @type {{ ok?: boolean, error?: string, code?: string, email?: string, reused?: boolean }} */
          const data = await res.json().catch(() => ({}));

          if (res.status === 409 && data.code === 'REASSIGN_REQUIRED') {
            form.dataset.reassignEmail = email.toLowerCase();
            feedback.textContent = `${data.error} Pulsa de nuevo para confirmar.`;
            feedback.classList.add('text-rose-400');
            feedback.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = 'CONFIRMAR REASIGNACIÓN';
            return;
          }

          if (!res.ok || !data.ok) {
            feedback.textContent = data.error || 'No se pudo crear el usuario.';
            feedback.classList.add('text-rose-400');
            feedback.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = idleLabel;
            return;
          }

          const sedeNombre =
            sedeSelect instanceof HTMLSelectElement ? sedeSelect.selectedOptions[0]?.dataset.nombre || '' : '';
          feedback.textContent = `Listo: ${data.email || email} entra como ${
            rolGerente ? `gerente de ${sedeNombre}` : 'admin del local'
          } con la clave ${password}. Compártela con el usuario.`;
          feedback.classList.add('text-emerald-400');
          feedback.classList.remove('hidden');
          submitBtn.textContent = '¡Usuario agregado!';
          if (passwordInput instanceof HTMLInputElement) passwordInput.value = '';
          if (emailInput instanceof HTMLInputElement) emailInput.value = '';
          markAccessActive(form);
          void loadUsuarios(form.closest('.hub-modal, [data-access-local]')?.querySelector('[data-usuarios-list]'));
          submitBtn.disabled = false;
          window.setTimeout(() => {
            if (submitBtn.textContent === '¡Usuario agregado!') {
              submitBtn.textContent = form.dataset.cta || ACTIVE_CTA;
            }
          }, 2500);
        } catch (err) {
          feedback.textContent =
            err instanceof Error ? err.message : 'Error de red al crear credenciales.';
          feedback.classList.add('text-rose-400');
          feedback.classList.remove('hidden');
          submitBtn.disabled = false;
          submitBtn.textContent = idleLabel;
        }
      });
    });
  }

  function initHubSearch() {
    const input = document.querySelector('[data-hub-search]');
    const clearBtn = document.querySelector('[data-hub-search-clear]');
    const countEl = document.querySelector('[data-hub-search-count]');
    const emptyEl = document.querySelector('[data-hub-search-empty]');
    const cards = document.querySelectorAll('[data-hub-name]');
    if (!(input instanceof HTMLInputElement) || !cards.length) return;
    if (input.dataset.bound === 'true') return;
    input.dataset.bound = 'true';

    /**
     * @param {string} value
     */
    function normalize(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }

    function applyFilter() {
      const q = normalize(input.value);
      let visible = 0;

      cards.forEach((card) => {
        if (!(card instanceof HTMLElement)) return;
        const hay = normalize(card.dataset.hubName || '');
        const show = !q || hay.includes(q);
        card.hidden = !show;
        card.style.display = show ? '' : 'none';
        if (show) visible += 1;
      });

      if (clearBtn instanceof HTMLElement) {
        clearBtn.hidden = !q;
      }
      if (countEl) {
        countEl.textContent =
          visible === 1 ? '1 local' : `${visible} locales`;
      }
      if (emptyEl instanceof HTMLElement) {
        emptyEl.hidden = visible > 0;
      }
    }

    input.addEventListener('input', applyFilter);
    clearBtn?.addEventListener('click', () => {
      input.value = '';
      input.focus();
      applyFilter();
    });
  }

  function initAccessSearch() {
    const input = document.querySelector('[data-access-search]');
    const clearBtn = document.querySelector('[data-access-search-clear]');
    const countEl = document.querySelector('[data-access-search-count]');
    const emptyEl = document.querySelector('[data-access-search-empty]');
    const rows = document.querySelectorAll('[data-access-name]');
    if (!(input instanceof HTMLInputElement) || !rows.length) return;
    if (input.dataset.bound === 'true') return;
    input.dataset.bound = 'true';

    /**
     * @param {string} value
     */
    function normalize(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }

    function applyFilter() {
      const q = normalize(input.value);
      let visible = 0;
      rows.forEach((row) => {
        if (!(row instanceof HTMLElement)) return;
        const show = !q || normalize(row.dataset.accessName || '').includes(q);
        row.hidden = !show;
        if (show) visible += 1;
      });
      if (clearBtn instanceof HTMLElement) clearBtn.hidden = !q;
      if (countEl) {
        countEl.textContent = visible === 1 ? '1 restaurante' : `${visible} restaurantes`;
      }
      if (emptyEl instanceof HTMLElement) emptyEl.hidden = visible > 0;
    }

    input.addEventListener('input', applyFilter);
    clearBtn?.addEventListener('click', () => {
      input.value = '';
      input.focus();
      applyFilter();
    });
  }

  function initNuevoRestModal() {
    const overlay = document.querySelector('[data-nuevo-rest-overlay]');
    if (!(overlay instanceof HTMLElement)) return;
    if (overlay.dataset.bound === 'true') return;
    overlay.dataset.bound = 'true';

    const form = document.getElementById('nuevo-rest-form');
    const slugInput = document.getElementById('slug');
    const nombreInput = document.getElementById('nombre_comercial');
    const submitBtn = document.getElementById('create-submit');
    const card = overlay.querySelector('[data-nuevo-rest-card]');

    /**
     * @param {string | null | undefined} value
     */
    function toSlug(value) {
      return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    /**
     * @param {string} url
     */
    function cloudinaryTrim(url) {
      const raw = String(url || '').trim();
      if (!raw) return '';
      const marker = '/upload/';
      const at = raw.indexOf(marker);
      if (at === -1 || !/cloudinary\.com/i.test(raw)) return raw;
      const after = raw.slice(at + marker.length);
      if (/e_trim/.test(after)) return raw;
      return `${raw.slice(0, at + marker.length)}e_trim/${after}`;
    }

    function openModal() {
      overlay.hidden = false;
      document.documentElement.classList.add('overflow-hidden');
      const focusEl = nombreInput instanceof HTMLInputElement ? nombreInput : null;
      window.setTimeout(() => focusEl?.focus(), 30);
    }

    function closeModal() {
      overlay.hidden = true;
      document.documentElement.classList.remove('overflow-hidden');
      overlay.dataset.openOnLoad = 'false';
    }

    document.querySelectorAll('[data-nuevo-rest-open]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });

    document.querySelectorAll('[data-nuevo-rest-close]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal());
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    if (card instanceof HTMLElement) {
      card.addEventListener('click', (e) => e.stopPropagation());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden) closeModal();
    });

    let slugTouched = Boolean(
      slugInput instanceof HTMLInputElement && slugInput.value.trim(),
    );

    slugInput?.addEventListener('input', () => {
      slugTouched = true;
      if (slugInput instanceof HTMLInputElement) {
        const cleaned = toSlug(slugInput.value);
        if (cleaned !== slugInput.value) slugInput.value = cleaned;
      }
    });

    nombreInput?.addEventListener('input', () => {
      if (!slugTouched && slugInput instanceof HTMLInputElement) {
        slugInput.value = toSlug(
          nombreInput instanceof HTMLInputElement ? nombreInput.value : '',
        );
      }
    });

    /**
     * @param {File} file
     * @returns {Promise<{ url: string }>}
     */
    async function uploadToCloudinary(file) {
      const slugValue =
        slugInput instanceof HTMLInputElement ? slugInput.value.trim() : '';
      const body = new FormData();
      body.append('file', file);
      if (slugValue) body.append('restaurante_slug', slugValue);
      body.append('asset_type', 'identity');
      const res = await fetch('/api/upload', { method: 'POST', body });
      /** @type {{ ok?: boolean, url?: string, secure_url?: string, error?: string }} */
      const data = await res.json().catch(() => ({}));
      const url = String(data.url || data.secure_url || '').trim();
      if (!res.ok || !url) {
        throw new Error(data.error || 'No se pudo subir la imagen');
      }
      return { url };
    }

    /**
     * @param {'logo' | 'portada'} kind
     * @param {boolean} loading
     */
    function setLoading(kind, loading) {
      const el = document.querySelector(`[data-upload-loading="${kind}"]`);
      if (el instanceof HTMLElement) {
        el.classList.toggle('hidden', !loading);
        el.classList.toggle('flex', loading);
      }
    }

    /**
     * @param {'logo' | 'portada'} kind
     * @param {string} url
     */
    function showPreview(kind, url) {
      const placeholder = document.querySelector(`[data-upload-placeholder="${kind}"]`);
      const preview = document.querySelector(`[data-upload-preview="${kind}"]`);
      const img = document.querySelector(`[data-upload-img="${kind}"]`);
      const src = kind === 'logo' ? cloudinaryTrim(url) : url;
      if (img instanceof HTMLImageElement) {
        img.src = src;
        img.hidden = false;
      }
      if (placeholder instanceof HTMLElement) placeholder.hidden = true;
      if (preview instanceof HTMLElement) preview.hidden = false;
    }

    /**
     * @param {'logo' | 'portada'} kind
     * @param {string} message
     * @param {'idle' | 'ok' | 'err'} state
     */
    function setStatus(kind, message, state) {
      const el = document.querySelector(`[data-upload-status="${kind}"]`);
      if (!(el instanceof HTMLElement)) return;
      el.textContent = message;
      el.className =
        state === 'ok'
          ? 'mt-1 min-h-[1rem] text-[10px] text-emerald-600 dark:text-emerald-400'
          : state === 'err'
            ? 'mt-1 min-h-[1rem] text-[10px] text-rose-600 dark:text-rose-400'
            : 'mt-1 min-h-[1rem] text-[10px] text-zinc-400';
    }

    /**
     * @param {'logo' | 'portada'} kind
     */
    function bindUploader(kind) {
      const fileInput = document.getElementById(
        kind === 'logo' ? 'input-logo-file' : 'input-portada-file',
      );
      const trigger = document.querySelector(`[data-upload-trigger="${kind}"]`);
      if (!(fileInput instanceof HTMLInputElement) || !(trigger instanceof HTMLElement)) {
        return;
      }

      trigger.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;

        setLoading(kind, true);
        setStatus(kind, 'Cargando...', 'idle');

        try {
          const { url } = await uploadToCloudinary(file);

          if (kind === 'logo') {
            const hidden = document.getElementById('logo_url');
            if (hidden instanceof HTMLInputElement) hidden.value = url;
          } else {
            const hidden = document.querySelector('[data-portada-hidden]');
            const alias = document.querySelector('[data-portada-alias]');
            if (hidden instanceof HTMLInputElement) hidden.value = url;
            if (alias instanceof HTMLInputElement) alias.value = url;
          }

          showPreview(kind, url);
          setStatus(kind, '✓ Subido', 'ok');
        } catch (err) {
          setStatus(
            kind,
            err instanceof Error ? err.message : 'Error al subir',
            'err',
          );
        } finally {
          setLoading(kind, false);
        }
      });
    }

    bindUploader('logo');

    // Prefill previews after validation error
    {
      const logoHidden = document.getElementById('logo_url');
      if (logoHidden instanceof HTMLInputElement && logoHidden.value.trim()) {
        showPreview('logo', logoHidden.value.trim());
      }
    }

    form?.addEventListener('submit', () => {
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando…';
      }
    });

    // ?nuevo=1 or SSR error reopen
    const params = new URLSearchParams(window.location.search);
    if (overlay.dataset.openOnLoad === 'true' || params.get('nuevo') === '1') {
      openModal();
      if (params.get('nuevo') === '1') {
        params.delete('nuevo');
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', next);
      }
    }
  }

  function initSuperNetTimeframe() {
    const panel = document.querySelector('[data-super-panel="metricas"]');
    if (!(panel instanceof HTMLElement)) return;
    if (panel.dataset.tfBound === 'true') return;
    panel.dataset.tfBound = 'true';

    const bar = panel.querySelector('[data-super-timeframe-bar]');
    const monthSelect = panel.querySelector('[data-super-timeframe-select]');
    if (!(bar instanceof HTMLElement)) return;

    /** @type {any} */
    let series = {
      eventMode: false,
      currentMonth: '',
      all: { total: 0, byRest: {}, topPlatoByRest: {}, topPlatos: [], rankingMayor: [], rankingMenor: [] },
      months: {},
    };
    try {
      const raw = panel.getAttribute('data-network-series');
      if (raw) series = JSON.parse(raw);
    } catch {
      /* keep empty */
    }

    const TF_ON =
      'super-tf-on px-3 py-1.5 rounded-xl font-semibold bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs';
    const TF_OFF =
      'px-3 py-1.5 rounded-xl font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors';

    /**
     * @param {number} n
     */
    function formatKpi(n) {
      return (Number(n) || 0).toLocaleString('es-VE');
    }

    /**
     * @param {unknown} value
     */
    function esc(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    /**
     * @param {string | null | undefined} name
     */
    function initials(name) {
      return String(name || '')
        .trim()
        .slice(0, 2)
        .toUpperCase() || '—';
    }

    /**
     * @param {string} url
     */
    function trimLogo(url) {
      const raw = String(url || '').trim();
      if (!raw) return '';
      const marker = '/upload/';
      const at = raw.indexOf(marker);
      if (at === -1 || !/cloudinary\.com/i.test(raw)) return raw;
      const after = raw.slice(at + marker.length);
      if (/e_trim/.test(after)) return raw;
      return `${raw.slice(0, at + marker.length)}e_trim/${after}`;
    }

    /**
     * @param {any} bucket
     * @param {string} periodLabel
     */
    function applyBucket(bucket, periodLabel) {
      const data = bucket || {
        total: 0,
        byRest: {},
        topPlatoByRest: {},
        topPlatos: [],
        rankingMayor: [],
        rankingMenor: [],
      };

      const kpi = panel.querySelector('[data-net-kpi="vistas-webapps"]');
      if (kpi instanceof HTMLElement) kpi.textContent = formatKpi(data.total);

      const col = panel.querySelector('[data-net-visits-col]');
      if (col instanceof HTMLElement) {
        col.textContent = periodLabel === 'General' ? 'Visitas' : `Visitas (${periodLabel})`;
      }
      const hint = panel.querySelector('[data-net-visits-hint]');
      if (hint instanceof HTMLElement) {
        hint.textContent =
          periodLabel === 'General'
            ? 'Visitas · histórico agregado'
            : `Visitas · ${periodLabel}`;
      }
      panel.querySelectorAll('[data-net-period-label]').forEach((el) => {
        el.textContent = periodLabel;
      });

      panel.querySelectorAll('[data-net-row]').forEach((row) => {
        if (!(row instanceof HTMLElement)) return;
        const id = row.getAttribute('data-net-row') || '';
        const visitas = Number(data.byRest?.[id]) || 0;
        const visitasEl = row.querySelector('[data-net-visitas]');
        if (visitasEl instanceof HTMLElement) visitasEl.textContent = formatKpi(visitas);

        const topName = String(data.topPlatoByRest?.[id] || '').trim();
        const platoCell = row.querySelector('[data-net-plato-top]');
        if (platoCell instanceof HTMLElement) {
          if (topName) {
            platoCell.innerHTML = `<span class="text-zinc-700 dark:text-zinc-300">${esc(topName)}</span>`;
          } else {
            platoCell.innerHTML =
              '<span class="super-net-empty text-zinc-300 dark:text-zinc-700 font-mono text-xs">—</span>';
          }
        }
      });

      /**
       * @param {HTMLElement | null} list
       * @param {Array<{ nombre: string, restaurante: string, vistas: number }>} items
       */
      function renderTopPlatos(list, items) {
        if (!(list instanceof HTMLElement)) return;
        const rows = Array.isArray(items) ? items : [];
        if (rows.length === 0) {
          list.innerHTML =
            '<li class="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800/80 px-4 py-6 text-center text-sm text-zinc-500">Sin vistas registradas en el periodo.</li>';
          return;
        }
        const max = Math.max(1, ...rows.map((r) => Number(r.vistas) || 0));
        list.innerHTML = rows
          .map((plato, i) => {
            const vistas = Number(plato.vistas) || 0;
            const pct = Math.round((vistas / max) * 100);
            return `<li class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div class="flex items-center gap-3">
                <span class="w-8 shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-500">#${String(i + 1).padStart(2, '0')}</span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-zinc-900 dark:text-white">${esc(plato.nombre || '—')}</p>
                  <p class="truncate text-[11px] text-zinc-500">${esc(plato.restaurante || '—')}</p>
                </div>
                <span class="shrink-0 font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">${formatKpi(vistas)}</span>
              </div>
              <div class="ml-11 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/80">
                <div class="h-full rounded-full bg-zinc-400/80 dark:bg-zinc-500/60" style="width:${pct}%"></div>
              </div>
            </li>`;
          })
          .join('');
      }

      /**
       * @param {HTMLElement | null} list
       * @param {Array<{ nombre: string, slug: string, visitas: number, logoUrl?: string }>} items
       */
      function renderLocalRank(list, items) {
        if (!(list instanceof HTMLElement)) return;
        const rows = Array.isArray(items) ? items : [];
        if (rows.length === 0) {
          list.innerHTML =
            '<li class="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800/80 px-4 py-6 text-center text-sm text-zinc-500">Sin locales para ranking.</li>';
          return;
        }
        const max = Math.max(1, ...rows.map((r) => Number(r.visitas) || 0));
        list.innerHTML = rows
          .map((local, i) => {
            const vistas = Number(local.visitas) || 0;
            const pct = Math.round((vistas / max) * 100);
            const logo = trimLogo(local.logoUrl || '');
            const media = logo
              ? `<img src="${esc(logo)}" alt="${esc(local.nombre || '')}" class="w-8 h-8 rounded-lg object-contain bg-zinc-50 dark:bg-zinc-950 p-1 border border-zinc-200 dark:border-zinc-800 shrink-0" loading="lazy" decoding="async" />`
              : `<div class="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-mono font-bold text-zinc-500 dark:text-zinc-300 shrink-0">${esc(initials(local.nombre))}</div>`;
            const slug = local.slug ? `/${local.slug}` : '—';
            return `<li class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div class="flex items-center gap-3">
                <span class="w-8 shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-500">#${String(i + 1).padStart(2, '0')}</span>
                ${media}
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-zinc-900 dark:text-white">${esc(local.nombre || '—')}</p>
                  <p class="truncate font-mono text-[11px] text-zinc-500">${esc(slug)}</p>
                </div>
                <span class="shrink-0 font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">${formatKpi(vistas)}</span>
              </div>
              <div class="ml-11 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/80">
                <div class="h-full rounded-full bg-zinc-400/80 dark:bg-zinc-500/60" style="width:${pct}%"></div>
              </div>
            </li>`;
          })
          .join('');
      }

      renderTopPlatos(
        /** @type {HTMLElement | null} */ (panel.querySelector('[data-net-top-platos]')),
        data.topPlatos,
      );
      renderLocalRank(
        /** @type {HTMLElement | null} */ (panel.querySelector('[data-net-rank-mayor]')),
        data.rankingMayor,
      );
      renderLocalRank(
        /** @type {HTMLElement | null} */ (panel.querySelector('[data-net-rank-menor]')),
        data.rankingMenor,
      );
    }

    /**
     * @param {'all' | 'current' | 'month'} mode
     * @param {string} [month]
     */
    function setTimeframe(mode, month = '') {
      bar.querySelectorAll('[data-super-timeframe]').forEach((btn) => {
        if (!(btn instanceof HTMLElement)) return;
        const on =
          mode === 'all'
            ? btn.getAttribute('data-super-timeframe') === 'all'
            : mode === 'current'
              ? btn.getAttribute('data-super-timeframe') === 'current'
              : false;
        btn.className = on ? TF_ON : TF_OFF;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (monthSelect instanceof HTMLSelectElement) {
        monthSelect.classList.toggle('super-tf-on', mode === 'month');
        if (mode !== 'month') monthSelect.value = '';
      }

      let bucket = series.all;
      let label = 'General';
      if (series.eventMode) {
        if (mode === 'current') {
          bucket = series.months?.[series.currentMonth] || {
            total: 0,
            byRest: {},
            topPlatoByRest: {},
            topPlatos: [],
            rankingMayor: [],
            rankingMenor: [],
          };
          label = 'Este mes';
        } else if (mode === 'month' && month) {
          bucket = series.months?.[month] || {
            total: 0,
            byRest: {},
            topPlatoByRest: {},
            topPlatos: [],
            rankingMayor: [],
            rankingMenor: [],
          };
          const opt =
            monthSelect instanceof HTMLSelectElement
              ? [...monthSelect.options].find((o) => o.value === month)
              : null;
          label = opt?.textContent?.trim() || month;
        }
      }
      applyBucket(bucket, label);
    }

    bar.querySelectorAll('[data-super-timeframe]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-super-timeframe') === 'current' ? 'current' : 'all';
        setTimeframe(mode);
      });
    });

    if (monthSelect instanceof HTMLSelectElement) {
      monthSelect.addEventListener('change', () => {
        const value = monthSelect.value;
        if (!value) {
          setTimeframe('all');
          return;
        }
        setTimeframe('month', value);
      });
    }
  }

  function initPropuestas() {
    const form = document.getElementById('propuesta-form');
    if (!(form instanceof HTMLFormElement) || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    const statusEl = form.querySelector('[data-prop-status]');
    const logoInput = form.querySelector('[data-prop-logo]');
    const logoFile = form.querySelector('[data-prop-logo-file]');
    const logoClear = form.querySelector('[data-prop-logo-clear]');
    const logoMark = form.querySelector('[data-prop-logo-mark]');
    const logoField = form.querySelector('[data-prop-logo-field]');
    const drop = form.querySelector('[data-prop-drop]');
    const dropTitle = form.querySelector('[data-prop-drop-title]');
    const dropSub = form.querySelector('[data-prop-drop-sub]');
    const nombreInput = form.querySelector('[data-prop-nombre]');
    const amounts = form.querySelector('[data-prop-amounts]');
    const result = document.querySelector('[data-prop-result]');
    const resultLink = document.querySelector('[data-prop-result-link]');
    const DROP_SUB = dropSub?.textContent || '';

    const setStatus = (text) => {
      if (statusEl) statusEl.textContent = text;
    };

    const sinLogo = () =>
      form.querySelector('[data-prop-logo-mode]:checked')?.getAttribute('value') === 'sin';

    const proposalGap = () => {
      const nombre = nombreInput instanceof HTMLInputElement ? nombreInput.value.trim() : '';
      if (!nombre) return { message: 'Falta el nombre', field: nombreInput };
      if (!sinLogo()) {
        const logo = logoInput instanceof HTMLInputElement ? logoInput.value.trim() : '';
        if (!logo) return { message: 'Falta el logo', field: form.querySelector('[data-prop-logo-file]') };
      }
      const demo = form.querySelector('[data-prop-carta]');
      if (!(demo instanceof HTMLSelectElement) || !demo.value) return { message: 'Falta el demo', field: demo };
      return null;
    };

    const showProposalGap = (gap, label) => {
      if (!gap) return;
      if (label) label.textContent = gap.message;
      const field = gap.field;
      if (field instanceof HTMLElement) {
        field.focus();
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    const syncLogoMode = () => {
      const off = sinLogo();
      if (logoField instanceof HTMLElement) logoField.dataset.sinLogo = off ? 'true' : 'false';
      if (off && logoInput instanceof HTMLInputElement) logoInput.value = '';
      if (off) {
        if (logoMark instanceof HTMLElement) {
          logoMark.style.backgroundImage = '';
          logoMark.style.backgroundSize = '';
          logoMark.textContent = '';
        }
        if (drop instanceof HTMLElement) drop.dataset.filled = 'false';
        if (dropTitle) dropTitle.textContent = 'Añadir foto';
        if (dropSub) dropSub.textContent = DROP_SUB;
        if (logoClear instanceof HTMLElement) logoClear.hidden = true;
      }
    };

    const paintLogo = (url, fileName = '') => {
      if (url) {
        const con = form.querySelector('[data-prop-logo-mode][value="con"]');
        if (con instanceof HTMLInputElement) con.checked = true;
      }
      if (logoMark instanceof HTMLElement) {
        logoMark.style.backgroundImage = url ? `url("${url}")` : '';
        logoMark.style.backgroundSize = url ? 'cover' : '';
        logoMark.textContent = '';
      }
      if (drop instanceof HTMLElement) drop.dataset.filled = url ? 'true' : 'false';
      if (dropTitle) dropTitle.textContent = url ? 'Cambiar foto' : 'Añadir foto';
      if (dropSub) dropSub.textContent = url ? fileName || 'Foto lista' : DROP_SUB;
      if (logoClear instanceof HTMLElement) logoClear.hidden = !url;
      syncLogoMode();
    };

    /** @param {File | null | undefined} file */
    const uploadLogo = async (file) => {
      if (!file || !(logoInput instanceof HTMLInputElement)) return;
      if (!file.type.startsWith('image/')) {
        setStatus('El logo tiene que ser una imagen.');
        return;
      }
      setStatus('Subiendo logo…');
      if (drop instanceof HTMLElement) drop.dataset.busy = 'true';
      const body = new FormData();
      body.set('file', file);
      body.set('restaurante_slug', 'propuestas');
      body.set('asset_type', 'logo');
      try {
        const response = await fetch('/api/upload', { method: 'POST', body });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.url) {
          setStatus(payload.error || 'No se pudo subir el logo.');
          return;
        }
        logoInput.value = payload.url;
        paintLogo(payload.url, file.name);
        setStatus('');
      } catch {
        setStatus('No se pudo subir el logo.');
      } finally {
        if (drop instanceof HTMLElement) delete drop.dataset.busy;
        if (logoFile instanceof HTMLInputElement) logoFile.value = '';
      }
    };

    logoFile?.addEventListener('change', () => {
      if (logoFile instanceof HTMLInputElement) uploadLogo(logoFile.files?.[0]);
    });

    if (drop instanceof HTMLElement) {
      ['dragenter', 'dragover'].forEach((type) =>
        drop.addEventListener(type, (event) => {
          event.preventDefault();
          drop.dataset.over = 'true';
        }),
      );
      ['dragleave', 'drop'].forEach((type) =>
        drop.addEventListener(type, () => delete drop.dataset.over),
      );
      drop.addEventListener('drop', (event) => {
        event.preventDefault();
        uploadLogo(event.dataTransfer?.files?.[0]);
      });
    }

    logoClear?.addEventListener('click', () => {
      if (logoInput instanceof HTMLInputElement) logoInput.value = '';
      paintLogo('');
    });

    form.querySelectorAll('[data-prop-logo-mode]').forEach((radio) => {
      radio.addEventListener('change', syncLogoMode);
    });
    syncLogoMode();

    /** Misma regla que la propuesta: «Black Sushi» → blacksushi.com */
    const domainFromName = (name) =>
      name
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');

    nombreInput?.addEventListener('input', () => {
      if (!(nombreInput instanceof HTMLInputElement)) return;
      const base = domainFromName(nombreInput.value);
      form.dataset.propDomain = base ? `${base}.com` : '';
    });

    const isSinPrecio = () =>
      form.querySelector('[data-prop-price-mode]:checked')?.getAttribute('value') === 'consultar';

    /** @param {ParentNode} row */
    const syncAddonRow = (row, focusPrice = false) => {
      const controls = row.querySelector(':scope > .super-prop-addon__controls');
      const mode = controls?.querySelector('[data-adicional-mode]');
      const money = controls?.querySelector('[data-adicional-money]');
      const input = controls?.querySelector('[data-adicional], [data-pieza], [data-paquete]');
      if (!(mode instanceof HTMLSelectElement) || !(money instanceof HTMLElement) || !(input instanceof HTMLInputElement)) return;
      const packsParent = row instanceof HTMLElement && row.hasAttribute('data-addon-packages');
      const piecesParent = row instanceof HTMLElement && row.hasAttribute('data-addon-pieces');
      const iaParent = row instanceof HTMLElement && row.hasAttribute('data-addon-ia');
      const priced = mode.value === 'precio';
      if (packsParent || piecesParent || iaParent) {
        money.hidden = true;
        input.disabled = true;
        if (packsParent) {
          if (priced) row.dataset.packsOn = 'true';
          else delete row.dataset.packsOn;
        }
        if (piecesParent) {
          if (priced) row.dataset.detailOn = 'true';
          else delete row.dataset.detailOn;
        }
        if (iaParent) {
          if (priced) row.dataset.iaOn = 'true';
          else delete row.dataset.iaOn;
        }
      } else {
        money.hidden = !priced;
        input.disabled = !priced;
      }
      mode.dataset.priced = priced ? 'true' : 'false';
      if (row instanceof HTMLElement && !packsParent && !piecesParent) {
        if (priced) row.dataset.priced = 'true';
        else delete row.dataset.priced;
        const bill = iaParent
          ? row.querySelector(':scope > .super-prop-ia [data-adicional-factura]')
          : controls?.querySelector('[data-adicional-factura]');
        const billLabel = bill?.closest('label');
        if (bill instanceof HTMLInputElement && billLabel instanceof HTMLElement) {
          billLabel.dataset.on = bill.checked ? 'true' : 'false';
        }
      }
      if (focusPrice && !packsParent && !piecesParent) {
        const factura = iaParent
          ? row.querySelector(':scope > .super-prop-ia [data-adicional-factura]')
          : controls?.querySelector('[data-adicional-factura]');
        if (factura instanceof HTMLInputElement && !priced) factura.checked = false;
        if (priced && iaParent) {
          row.querySelectorAll('[data-wheel]').forEach((drum) => {
            if (drum instanceof HTMLElement) drum.dispatchEvent(new Event('wheel-show'));
          });
          const drum = row.querySelector('[data-wheel]');
          if (drum instanceof HTMLElement) drum.focus({ preventScroll: true });
        } else if (priced) {
          const drum = money.querySelector('[data-wheel]');
          if (drum instanceof HTMLElement) {
            drum.dispatchEvent(new Event('wheel-show'));
            drum.focus({ preventScroll: true });
          } else input.focus({ preventScroll: true });
        }
      }
      if (focusPrice && priced && row instanceof HTMLElement && window.matchMedia('(max-width: 760px)').matches) {
        const revealed =
          (packsParent && row.querySelector(':scope > .super-prop-packages')) ||
          (piecesParent && row.querySelector(':scope > .super-prop-pieces')) ||
          (iaParent && row.querySelector(':scope > .super-prop-ia')) ||
          row.querySelector(':scope > .super-prop-addon__controls .super-prop-money') ||
          row;
        requestAnimationFrame(() => {
          if (revealed instanceof HTMLElement) {
            revealed.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }
        });
      }
      row.querySelectorAll('.super-prop-quiz__choices').forEach((wrap) => {
        const select = wrap.parentElement?.querySelector('[data-adicional-mode]');
        if (!(select instanceof HTMLSelectElement)) return;
        wrap.querySelectorAll('[data-quiz-value]').forEach((button) => {
          button.setAttribute('aria-pressed', button.getAttribute('data-quiz-value') === select.value ? 'true' : 'false');
        });
      });
    };

    document.querySelectorAll('[data-addon-row]').forEach((row) => syncAddonRow(row));

    const quizList = form.querySelector('.super-prop-addon-list');
    if (quizList instanceof HTMLElement && quizList.dataset.stepsBound !== 'true') {
      const steps = [...quizList.querySelectorAll(':scope > .super-prop-addon')];
      if (steps.length > 1) {
        quizList.dataset.stepsBound = 'true';
        quizList.classList.add('is-stepped', 'is-quiz');
        quizList.querySelectorAll('[data-adicional-mode]').forEach((mode) => {
          if (!(mode instanceof HTMLSelectElement) || mode.dataset.quizChoices === 'true') return;
          if (mode.closest('[data-prop-pack]') || mode.closest('[data-piece-row]')) return;
          mode.dataset.quizChoices = 'true';
          const wrap = document.createElement('div');
          wrap.className = 'super-prop-quiz__choices';
          wrap.setAttribute('role', 'group');
          wrap.setAttribute('aria-label', mode.getAttribute('aria-label') || 'Precio');
          [
            ['', 'A consultar'],
            ['precio', 'Con precio'],
          ].forEach(([value, label]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'super-prop-quiz__choice';
            button.dataset.quizValue = value;
            button.textContent = label;
            button.addEventListener('click', () => {
              mode.value = value;
              mode.dispatchEvent(new Event('change', { bubbles: true }));
            });
            wrap.append(button);
          });
          mode.after(wrap);
          const caption = document.createElement('p');
          caption.className = 'super-prop-quiz__caption';
          caption.textContent = 'Precio';
          wrap.before(caption);
        });
        steps.forEach((step) => syncAddonRow(step));

        const shell = document.createElement('div');
        shell.className = 'super-prop-quiz';
        const kicker = document.createElement('p');
        kicker.className = 'super-prop-quiz__kicker';
        const nav = document.createElement('div');
        nav.className = 'super-prop-quiz__nav';
        const dots = document.createElement('div');
        dots.className = 'super-prop-quiz__dots';
        dots.setAttribute('aria-hidden', 'true');
        steps.forEach(() => {
          const dot = document.createElement('span');
          dots.append(dot);
        });
        nav.innerHTML = '<button type="button" data-step-prev>Anterior</button>';
        nav.append(dots);
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.dataset.stepNext = '';
        nextBtn.textContent = 'Siguiente';
        nav.append(nextBtn);
        let index = 0;
        const actions = form.querySelector('[data-prop-actions]');

        const revealLink = () => {
          if (!(actions instanceof HTMLElement)) return;
          const gap = proposalGap();
          if (gap) {
            showProposalGap(gap, nextBtn);
            window.setTimeout(() => {
              nextBtn.textContent = 'Listo';
            }, 1400);
            return;
          }
          actions.hidden = false;
          actions.classList.remove('is-ready');
          void actions.offsetWidth;
          actions.classList.add('is-ready');
          actions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };

        const show = (next) => {
          index = Math.max(0, Math.min(steps.length - 1, next));
          steps.forEach((step, n) => {
            if (!(step instanceof HTMLElement)) return;
            step.hidden = n !== index;
            step.classList.toggle('is-enter', n === index);
          });
          kicker.textContent = `${index + 1} de ${steps.length}`;
          steps[index]?.querySelectorAll('[data-wheel]').forEach((drum) => {
            drum.dispatchEvent(new Event('wheel-show'));
          });
          dots.querySelectorAll('span').forEach((dot, n) => {
            dot.dataset.on = n === index ? 'true' : 'false';
          });
          const prev = nav.querySelector('[data-step-prev]');
          if (prev instanceof HTMLButtonElement) prev.disabled = index === 0;
          nextBtn.textContent = index === steps.length - 1 ? 'Listo' : 'Siguiente';
        };

        nav.querySelector('[data-step-prev]')?.addEventListener('click', () => show(index - 1));
        nextBtn.addEventListener('click', () => {
          if (index === steps.length - 1) {
            revealLink();
            return;
          }
          show(index + 1);
        });

        const mountPriceWheel = (money, label) => {
          if (!(money instanceof HTMLElement) || money.querySelector('[data-wheel]')) return;
          const field = money.querySelector('input');
          if (!(field instanceof HTMLInputElement)) return;
          money.classList.add('is-picker');
          field.dataset.wheelInput = '';
          const wheel = document.createElement('div');
          wheel.className = 'super-prop-wheel super-prop-wheel--addon';
          const now = field.value || '0';
          const safeLabel = String(label || 'Precio').replace(/"/g, '');
          wheel.innerHTML =
            '<div class="super-prop-wheel__frame"><span class="super-prop-wheel__lens" aria-hidden="true"></span><div class="super-prop-wheel__drum" data-wheel role="spinbutton" tabindex="0" aria-label="' +
            safeLabel +
            '" aria-valuemin="0" aria-valuemax="5000" aria-valuenow="' +
            now +
            '"><div class="super-prop-wheel__track" data-wheel-track></div></div></div><p class="super-prop-wheel__unit">$</p>';
          money.querySelector('em')?.remove();
          money.append(wheel);
          wheel.append(field);
        };

        quizList.querySelectorAll(':scope > .super-prop-addon:not([data-addon-packages]):not([data-addon-pieces]):not([data-addon-ia]) > .super-prop-addon__controls > .super-prop-money').forEach((money) => {
          const bill = money.parentElement?.querySelector(':scope > label.super-prop-factura');
          mountPriceWheel(money, 'Precio');
          if (!(money instanceof HTMLElement)) return;
          const unit = money.querySelector('.super-prop-wheel__unit');
          if (unit) money.append(unit);
          if (bill instanceof HTMLElement) money.append(bill);
        });
        quizList.querySelectorAll('[data-addon-ia] .super-prop-ia .super-prop-money').forEach((money) => {
          const label = money.parentElement?.querySelector(':scope > span')?.textContent?.trim() || 'Precio';
          mountPriceWheel(money, label);
          money.querySelector('[data-wheel]')?.setAttribute('data-wheel-step', '25');
        });

        quizList.before(shell);
        shell.append(kicker, quizList, nav);
        show(0);
      }
    }

    const bindPackChoices = (row) => {
      const mode = row.querySelector(':scope > .super-prop-addon__controls [data-adicional-mode]');
      const wrap = row.querySelector(':scope > .super-prop-addon__controls .super-prop-quiz__choices');
      if (!(mode instanceof HTMLSelectElement) || !(wrap instanceof HTMLElement) || wrap.dataset.bound === 'true') return;
      wrap.dataset.bound = 'true';
      wrap.querySelectorAll('[data-quiz-value]').forEach((button) => {
        button.addEventListener('click', () => {
          mode.value = button.getAttribute('data-quiz-value') || '';
          mode.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    };

    document.querySelectorAll('[data-prop-packs]').forEach((stage) => {
      if (!(stage instanceof HTMLElement) || stage.dataset.bound === 'true') return;
      stage.dataset.bound = 'true';
      const packs = () => [...stage.querySelectorAll(':scope > [data-prop-pack]')];
      const add = stage.querySelector('[data-prop-pack-add]');
      const dots = document.createElement('div');
      dots.className = 'super-prop-pack-dots';
      dots.setAttribute('aria-hidden', 'true');
      const tools = document.createElement('div');
      tools.className = 'super-prop-pack-tools';
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'super-prop-pack-back';
      back.textContent = 'Atrás';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'super-prop-pack-remove';
      remove.textContent = 'Borrar';
      tools.append(back, remove);
      if (add) {
        add.before(dots);
        add.before(tools);
      } else {
        stage.append(dots, tools);
      }
      let index = 0;

      const showPack = (next) => {
        const rows = packs();
        index = Math.max(0, Math.min(rows.length - 1, next));
        rows.forEach((row, n) => row.classList.toggle('is-on', n === index));
        back.hidden = index === 0;
        remove.hidden = rows.length < 2;
        dots.replaceChildren();
        if (rows.length < 2) return;
        rows.forEach((row, n) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.dataset.on = n === index ? 'true' : 'false';
          dot.textContent = String(n + 1);
          dot.setAttribute('aria-label', row.querySelector('[data-prop-pack-name]')?.textContent?.trim() || `Paquete ${n + 1}`);
          dot.addEventListener('click', () => showPack(n));
          dots.append(dot);
        });
      };

      packs().forEach((row) => bindPackChoices(row));

      stage.addEventListener('click', (event) => {
        const step = event.target instanceof Element ? event.target.closest('[data-prop-pack-qty-step]') : null;
        if (!(step instanceof HTMLButtonElement) || !stage.contains(step)) return;
        const field = step.parentElement?.querySelector('[data-paquete-platos]');
        if (!(field instanceof HTMLInputElement)) return;
        const delta = Number(step.dataset.propPackQtyStep) || 0;
        const next = Math.max(1, Math.min(40, (Number(field.value) || 1) + delta));
        field.value = String(next);
      });

      add?.addEventListener('click', () => {
        const rows = packs();
        const source = rows[0];
        if (!(source instanceof HTMLElement)) return;
        const nextId = String(
          rows.reduce((max, row) => {
            const id = Number(row.querySelector('[data-paquete]')?.dataset.paquete) || 0;
            return Math.max(max, id);
          }, 0) + 1,
        );
        const copy = source.cloneNode(true);
        if (!(copy instanceof HTMLElement)) return;
        copy.classList.remove('is-on');
        const name = copy.querySelector('[data-prop-pack-name]');
        if (name) name.textContent = `Paquete ${nextId}`;
        const platos = copy.querySelector('[data-paquete-platos]');
        if (platos instanceof HTMLInputElement) {
          platos.dataset.paquetePlatos = nextId;
          platos.value = '1';
          platos.setAttribute('aria-label', `Platos de Paquete ${nextId}`);
        }
        const input = copy.querySelector('[data-paquete]');
        if (input instanceof HTMLInputElement) {
          input.dataset.paquete = nextId;
          input.value = '';
          input.disabled = false;
        }
        const check = copy.querySelector('[data-adicional-factura]');
        if (check instanceof HTMLInputElement) {
          check.dataset.adicionalFactura = nextId;
          check.checked = false;
        }
        const mode = copy.querySelector('[data-adicional-mode]');
        if (mode instanceof HTMLSelectElement) {
          mode.value = 'precio';
          mode.setAttribute('aria-label', `Precio de Paquete ${nextId}`);
        }
        const money = copy.querySelector('[data-adicional-money]');
        if (money instanceof HTMLElement) money.hidden = false;
        copy.querySelector('.super-prop-quiz__choices')?.removeAttribute('data-bound');
        dots.before(copy);
        bindPackChoices(copy);
        syncAddonRow(copy);
        showPack(packs().length - 1);
      });

      back.addEventListener('click', () => showPack(index - 1));
      remove.addEventListener('click', () => {
        const rows = packs();
        if (rows.length < 2) return;
        rows[index]?.remove();
        showPack(Math.min(index, packs().length - 1));
      });

      showPack(0);
    });

    document.querySelectorAll('.super-prop-addon-list').forEach((list) => {
      if (!(list instanceof HTMLElement) || list.dataset.stepsBound === 'true') return;
      if (list.closest('#propuesta-form')) return;
      const steps = [...list.querySelectorAll(':scope > .super-prop-addon')];
      if (steps.length < 2) return;
      list.dataset.stepsBound = 'true';
      list.classList.add('is-stepped');

      const picks = document.createElement('div');
      picks.className = 'super-prop-steps';
      const nav = document.createElement('div');
      nav.className = 'super-prop-steps__nav';
      nav.innerHTML =
        '<button type="button" data-step-prev>Anterior</button><p data-step-count></p><button type="button" data-step-next>Siguiente</button>';
      let index = 0;

      const show = (next) => {
        index = Math.max(0, Math.min(steps.length - 1, next));
        steps.forEach((step, n) => {
          if (step instanceof HTMLElement) step.hidden = n !== index;
        });
        picks.querySelectorAll('button').forEach((button, n) => {
          if (n === index) button.setAttribute('aria-current', 'step');
          else button.removeAttribute('aria-current');
        });
        const count = nav.querySelector('[data-step-count]');
        if (count) count.textContent = `${index + 1} de ${steps.length}`;
        const prev = nav.querySelector('[data-step-prev]');
        const nextBtn = nav.querySelector('[data-step-next]');
        if (prev instanceof HTMLButtonElement) prev.disabled = index === 0;
        if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = index === steps.length - 1;
      };

      steps.forEach((step, n) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'super-prop-steps__pick';
        button.textContent = step.querySelector(':scope > .super-prop-addon__name')?.textContent?.trim() || '';
        button.addEventListener('click', () => show(n));
        picks.append(button);
      });

      nav.querySelector('[data-step-prev]')?.addEventListener('click', () => show(index - 1));
      nav.querySelector('[data-step-next]')?.addEventListener('click', () => show(index + 1));
      list.before(picks);
      list.after(nav);
      show(0);
    });
    if (document.documentElement.dataset.addonModesBound !== 'true') {
      document.documentElement.dataset.addonModesBound = 'true';
      document.addEventListener('change', (event) => {
        const mode = event.target;
        if (mode instanceof HTMLInputElement && mode.matches('[data-adicional-factura]')) {
          const billLabel = mode.closest('label');
          if (billLabel instanceof HTMLElement) billLabel.dataset.on = mode.checked ? 'true' : 'false';
        }
        if (!(mode instanceof HTMLSelectElement) || !mode.matches('[data-adicional-mode]')) return;
        const row = mode.closest('[data-addon-row]');
        if (row) syncAddonRow(row, true);
      });
    }

    /** @param {ParentNode} root */
    const readAdicionales = (root) => {
      /** @type {Record<string, string | string[]>} */
      const adicionales = {};
      /** @type {string[]} */
      const factura = [];
      /** @type {Record<string, string>} */
      const piezas = {};
      /** @type {string[]} */
      const piezasFactura = [];
      /** @type {Record<string, string>} */
      const paquetes = {};
      /** @type {Record<string, string>} */
      const paquetesPlatos = {};
      /** @type {string[]} */
      const paquetesFactura = [];
      root.querySelectorAll('[data-addon-row]').forEach((row) => {
        if (row instanceof HTMLElement && row.hasAttribute('data-addon-ia')) return;
        const input = row.querySelector(':scope > .super-prop-addon__controls [data-adicional], :scope > .super-prop-addon__controls [data-pieza], :scope > .super-prop-addon__controls [data-paquete]');
        const check = row.querySelector(':scope > .super-prop-addon__controls [data-adicional-factura]');
        if (!(input instanceof HTMLInputElement)) return;
        const paquete = input.dataset.paquete || '';
        if (paquete) {
          const parent = row.closest('[data-addon-packages]');
          const parentMode = parent?.querySelector(':scope > .super-prop-addon__controls [data-adicional-mode]');
          if (!(parentMode instanceof HTMLSelectElement) || parentMode.value !== 'precio') return;
          if (!input.disabled && Number(input.value) > 0) paquetes[paquete] = input.value;
          const bill = check instanceof HTMLInputElement ? check : null;
          const billLabel = bill?.closest('label');
          const billVisible =
            billLabel instanceof HTMLElement && getComputedStyle(billLabel).display !== 'none';
          if (bill?.checked || (paquetes[paquete] && !billVisible)) paquetesFactura.push(paquete);
          const platos = row.querySelector('[data-paquete-platos]');
          if (platos instanceof HTMLInputElement) {
            const n = Math.max(1, Math.min(40, Math.round(Number(platos.value) || 1)));
            paquetesPlatos[paquete] = String(n);
          }
          return;
        }
        const pieza = input.dataset.pieza || '';
        if (pieza) {
          const parent = row.closest('[data-addon-pieces]');
          const parentMode = parent?.querySelector(':scope > .super-prop-addon__controls [data-adicional-mode]');
          if (parentMode instanceof HTMLSelectElement && parentMode.value !== 'precio') return;
          if (!input.disabled && input.value.trim() && Number(input.value) > 0) piezas[pieza] = input.value.trim();
          if (check instanceof HTMLInputElement && check.checked) piezasFactura.push(pieza);
          return;
        }
        const id = input.dataset.adicional || '';
        if (!id) return;
        if (!input.disabled && Number(input.value) > 0) adicionales[id] = input.value;
        if (check instanceof HTMLInputElement && check.checked) factura.push(id);
      });
      const iaRow = root.querySelector('[data-addon-ia]');
      const iaMode = iaRow?.querySelector(':scope > .super-prop-addon__controls [data-adicional-mode]');
      if (iaRow instanceof HTMLElement && iaMode instanceof HTMLSelectElement && iaMode.value === 'precio') {
        const instalacion = iaRow.querySelector('[data-ia-instalacion]');
        const mensual = iaRow.querySelector('[data-ia-mensual]');
        if (instalacion instanceof HTMLInputElement && Number(instalacion.value) > 0) adicionales.ia = instalacion.value;
        if (mensual instanceof HTMLInputElement && Number(mensual.value) > 0) adicionales.iaMensual = mensual.value.trim();
        const iaFactura = iaRow.querySelector(':scope > .super-prop-ia [data-adicional-factura]');
        if (iaFactura instanceof HTMLInputElement && iaFactura.checked) factura.push('ia');
      }
      adicionales.factura = factura;
      const qrMode = root.querySelector('[data-addon-pieces] > .super-prop-addon__controls [data-adicional-mode]');
      if (!(qrMode instanceof HTMLSelectElement) || qrMode.value === 'precio') {
        adicionales.piezas = piezas;
        adicionales.piezasFactura = piezasFactura;
      }
      const arMode = root.querySelector('[data-addon-packages] > .super-prop-addon__controls [data-adicional-mode]');
      if (arMode instanceof HTMLSelectElement && arMode.value === 'precio') {
        adicionales.paquetes = paquetes;
        adicionales.paquetesPlatos = paquetesPlatos;
        adicionales.paquetesOrden = [...root.querySelectorAll('[data-paquete]')].map((input) =>
          input instanceof HTMLInputElement ? input.dataset.paquete || '' : '',
        ).filter(Boolean);
        adicionales.paquetesFactura = paquetesFactura;
      }
      return adicionales;
    };

    const WHEEL_STEP = 50;
    const WHEEL_MAX = 5000;
    const WHEEL_ROW = 44;

    form.querySelectorAll('[data-wheel]').forEach((drum) => {
      if (!(drum instanceof HTMLElement)) return;
      const track = drum.querySelector('[data-wheel-track]');
      const input = drum.closest('.super-prop-wheel')?.querySelector('[data-wheel-input]');
      if (!(track instanceof HTMLElement) || !(input instanceof HTMLInputElement)) return;
      const blocked = () => drum.closest('[data-prop-amounts]')?.getAttribute('data-off') === 'true';

      const start = Math.max(0, Math.round(Number(input.value) || 0));
      const marked = Number(drum.dataset.wheelStep);
      const step = Number.isFinite(marked) && marked > 0
        ? marked
        : drum.closest('[data-prop-amounts]') ? 25 : WHEEL_STEP;
      const values = [];
      for (let n = 0; n <= WHEEL_MAX; n += step) values.push(n);
      if (!values.includes(start)) {
        values.push(start);
        values.sort((a, b) => a - b);
      }

      const padTop = document.createElement('div');
      padTop.className = 'super-prop-wheel__pad';
      const padBottom = document.createElement('div');
      padBottom.className = 'super-prop-wheel__pad';
      track.append(padTop);
      /** @type {HTMLButtonElement[]} */
      const items = values.map((n) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'super-prop-wheel__n';
        item.dataset.value = String(n);
        item.textContent = String(n);
        item.tabIndex = -1;
        item.setAttribute('aria-hidden', 'true');
        track.append(item);
        return item;
      });
      track.append(padBottom);

      const fitPads = () => {
        const pad = Math.max(0, (drum.clientHeight - WHEEL_ROW) / 2);
        padTop.style.height = `${pad}px`;
        padBottom.style.height = `${pad}px`;
      };

      const indexFromScroll = () =>
        Math.max(0, Math.min(values.length - 1, Math.round(drum.scrollTop / WHEEL_ROW)));

      const paint = () => {
        const pos = drum.scrollTop / WHEEL_ROW;
        items.forEach((node, i) => {
          const dist = i - pos;
          const away = Math.abs(dist);
          const scale = Math.max(0.78, 1.16 - away * 0.24);
          const tilt = Math.max(-46, Math.min(46, dist * 24));
          node.style.transform = `perspective(140px) rotateX(${tilt}deg) scale(${scale})`;
          node.style.opacity = String(Math.max(0.22, 1 - away * 0.42));
          node.classList.toggle('is-on', away < 0.35);
        });
      };

      const commit = (index) => {
        const value = values[index];
        input.value = String(value);
        drum.setAttribute('aria-valuenow', String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };

      const goTo = (index, smooth) => {
        const next = Math.max(0, Math.min(values.length - 1, index));
        drum.scrollTo({ top: next * WHEEL_ROW, behavior: smooth ? 'smooth' : 'auto' });
        commit(next);
        paint();
      };

      let snapTimer = 0;
      let snapping = false;
      drum.addEventListener(
        'scroll',
        () => {
          paint();
          if (snapping) return;
          window.clearTimeout(snapTimer);
          snapTimer = window.setTimeout(() => {
            const index = indexFromScroll();
            const top = index * WHEEL_ROW;
            commit(index);
            if (Math.abs(drum.scrollTop - top) > 0.5) {
              snapping = true;
              drum.scrollTo({ top, behavior: 'auto' });
              window.setTimeout(() => {
                snapping = false;
                paint();
              }, 40);
            }
          }, 70);
        },
        { passive: true },
      );

      track.addEventListener('click', (event) => {
        const item = event.target instanceof Element ? event.target.closest('[data-value]') : null;
        if (!(item instanceof HTMLElement) || blocked()) return;
        const index = values.indexOf(Number(item.dataset.value));
        if (index >= 0) goTo(index, true);
      });

      drum.addEventListener('keydown', (event) => {
        if (blocked()) return;
        const current = indexFromScroll();
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          event.preventDefault();
          goTo(current - 1, true);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          event.preventDefault();
          goTo(current + 1, true);
        }
      });

      const place = () => {
        fitPads();
        const current = Math.max(0, Math.round(Number(input.value) || start));
        const index = Math.max(0, values.indexOf(current));
        drum.scrollTop = (index < 0 ? 0 : index) * WHEEL_ROW;
        commit(index < 0 ? 0 : index);
        paint();
      };
      drum.addEventListener('wheel-show', () => requestAnimationFrame(place));
      place();
      requestAnimationFrame(place);
    });

    /** @type {{ usdVes: number, eurVes: number }} */
    const fx = { usdVes: 0, eurVes: 0 };
    const fxView = () => form.querySelector('[data-prop-fx-view][aria-pressed="true"]')?.getAttribute('data-prop-fx-view') || '';

    const formatMoney = (amount) => {
      const [ints, decs] = Number(amount).toFixed(2).split('.');
      return `${ints.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decs}`;
    };

    const formatFx = (usd, code) => {
      const n = Number(usd);
      if (!Number.isFinite(n) || !(fx.usdVes > 0)) return '';
      const bs = `${formatMoney(n * fx.usdVes)} Bs`;
      if (code === 'bs') return bs;
      if (code === 'eur' && fx.eurVes > 0) return `${formatMoney((n * fx.usdVes) / fx.eurVes)} €\n${bs}`;
      return '';
    };

    const paintFx = () => {
      const code = fxView();
      form.querySelectorAll('[data-prop-fx-preview]').forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const name = node.dataset.propFxPreview === 'anual' ? 'anual' : 'setup';
        const input = form.querySelector(`[name="${name}"]`);
        const text = formatFx(input instanceof HTMLInputElement ? input.value : '', code);
        node.hidden = !text;
        node.textContent = text;
      });
    };

    form.querySelectorAll('[data-prop-fx-view]').forEach((button) => {
      button.addEventListener('click', () => {
        const on = button.getAttribute('aria-pressed') === 'true';
        form.querySelectorAll('[data-prop-fx-view]').forEach((other) => other.setAttribute('aria-pressed', 'false'));
        if (!on) button.setAttribute('aria-pressed', 'true');
        paintFx();
      });
    });
    amounts?.addEventListener('input', (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.matches('[data-wheel-input]')) paintFx();
    });

    fetch('/api/tasas-cambio')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const usdVes = Number(payload?.usdVes);
        const eurVes = Number(payload?.eurVes);
        if (!(usdVes > 1) || !(eurVes > 1)) {
          form.querySelectorAll('[data-prop-fx-rate]').forEach((node) => {
            node.textContent = '—';
          });
          return;
        }
        fx.usdVes = usdVes;
        fx.eurVes = eurVes;
        const rate = (amount) => {
          const [ints, decs] = amount.toFixed(2).split('.');
          return `${ints.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decs}`;
        };
        const bcv = form.querySelector('[data-prop-fx-rate="bs"]');
        const euro = form.querySelector('[data-prop-fx-rate="eur"]');
        if (bcv) bcv.textContent = rate(usdVes);
        if (euro) euro.textContent = `${rate(usdVes / eurVes)} €`;
        paintFx();
      })
      .catch(() => {
        form.querySelectorAll('[data-prop-fx-rate]').forEach((node) => {
          node.textContent = '—';
        });
      });

    const syncPriceMode = () => {
      if (!(amounts instanceof HTMLElement)) return;
      const off = isSinPrecio();
      amounts.dataset.off = off ? 'true' : 'false';
      amounts.querySelectorAll('input').forEach((input) => {
        input.disabled = off;
      });
      amounts.querySelectorAll('[data-wheel]').forEach((drum) => {
        if (drum instanceof HTMLElement) drum.tabIndex = off ? -1 : 0;
      });
    };

    form.querySelectorAll('[data-prop-price-mode]').forEach((radio) =>
      radio.addEventListener('change', syncPriceMode),
    );
    syncPriceMode();

    const copyText = async (value, button) => {
      try {
        await navigator.clipboard.writeText(value);
        if (button instanceof HTMLButtonElement) {
          const prev = button.textContent;
          button.textContent = 'Copiado';
          window.setTimeout(() => {
            button.textContent = prev;
          }, 1400);
        }
      } catch {
        setStatus('No se pudo copiar. Seleccioná el enlace a mano.');
      }
    };

    if (document.documentElement.dataset.propClicksBound !== 'true') {
      document.documentElement.dataset.propClicksBound = 'true';
      document.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const copyBtn = target.closest('[data-prop-copy]');
        if (copyBtn instanceof HTMLButtonElement && copyBtn.dataset.propCopy) {
          event.preventDefault();
          const href = new URL(copyBtn.dataset.propCopy, window.location.origin).href;
          try {
            await navigator.clipboard.writeText(href);
            const prev = copyBtn.textContent;
            copyBtn.textContent = 'Copiado';
            window.setTimeout(() => {
              copyBtn.textContent = prev;
            }, 1400);
          } catch {
            const status = document.querySelector('[data-prop-status]');
            if (status) status.textContent = 'No se pudo copiar. Seleccioná el enlace a mano.';
          }
          return;
        }
      });
    }

    result?.querySelector('[data-prop-copy]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const href = resultLink instanceof HTMLAnchorElement ? resultLink.href : '';
      if (href) await copyText(href, button instanceof HTMLButtonElement ? button : null);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.dataset.creating === 'true') return;
      const slide = form.querySelector('[data-prop-slide]');
      const gap = proposalGap();
      if (gap) {
        showProposalGap(gap, null);
        setStatus(gap.message);
        slide?.dispatchEvent(new Event('slide-reset'));
        return;
      }
      form.dataset.creating = 'true';
      setStatus('Creando propuesta…');
      const data = new FormData(form);
      try {
        const response = await fetch('/api/propuestas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: String(data.get('nombre') || ''),
            setup: String(data.get('setup') || ''),
            anual: String(data.get('anual') || ''),
            sinPrecio: isSinPrecio(),
            logoUrl: sinLogo() ? '' : String(data.get('logo') || ''),
            mundo: String(data.get('mundo') || ''),
            adicionales: {
              ...readAdicionales(form),
              moneda: 'usd',
              ...((() => {
                const carta = String(data.get('carta_demo') || '').trim().toLowerCase();
                return carta && carta !== 'sin' ? { cartaDemo: carta } : {};
              })()),
            },
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.href) {
          setStatus(payload.error || 'No se pudo crear la propuesta.');
          delete form.dataset.creating;
          slide?.dispatchEvent(new Event('slide-reset'));
          return;
        }
        const href = new URL(payload.href, window.location.origin).href;
        if (result instanceof HTMLElement) {
          result.hidden = false;
          result.dataset.id = String(payload.id || '');
        }
        if (resultLink instanceof HTMLAnchorElement) {
          resultLink.href = href;
          resultLink.textContent = 'Entrar';
        }
        setStatus('');
        result?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {
        setStatus('No se pudo crear la propuesta.');
        delete form.dataset.creating;
        slide?.dispatchEvent(new Event('slide-reset'));
      }
    });

    const propSlide = form.querySelector('[data-prop-slide]');
    const propKnob = propSlide?.querySelector('[data-prop-slide-knob]');
    if (propSlide instanceof HTMLElement && propKnob instanceof HTMLButtonElement) {
      const measure = () => {
        const pad = parseFloat(getComputedStyle(propSlide).paddingLeft) || 0;
        const travel = Math.max(0, propSlide.clientWidth - propKnob.offsetWidth - pad * 2);
        propSlide.style.setProperty('--travel', `${travel}px`);
        return travel;
      };
      let travel = 0;
      let dragging = false;
      let origin = 0;
      let originP = 0;
      const progress = () => Number.parseFloat(propSlide.style.getPropertyValue('--p')) || 0;
      const setProgress = (value) => {
        const next = Math.min(1, Math.max(0, value));
        propSlide.style.setProperty('--p', String(next));
        return next;
      };
      const resetSlide = () => {
        propSlide.classList.remove('is-dragging', 'is-done');
        setProgress(0);
      };
      propSlide.addEventListener('slide-reset', resetSlide);
      const finish = () => {
        if (propSlide.classList.contains('is-done') || form.dataset.creating === 'true') return;
        propSlide.classList.remove('is-dragging');
        setProgress(1);
        propSlide.classList.add('is-done');
        form.requestSubmit();
      };
      const release = (value) => {
        propSlide.classList.remove('is-dragging');
        dragging = false;
        if (value >= 0.86) finish();
        else setProgress(0);
      };
      propKnob.addEventListener('pointerdown', (event) => {
        if (propSlide.classList.contains('is-done') || form.dataset.creating === 'true') return;
        travel = measure();
        if (travel < 1) return;
        dragging = true;
        origin = event.clientX;
        originP = progress();
        propSlide.classList.add('is-dragging');
        propKnob.setPointerCapture(event.pointerId);
      });
      propKnob.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        setProgress(originP + (event.clientX - origin) / travel);
      });
      propKnob.addEventListener('pointerup', () => {
        if (!dragging) return;
        release(progress());
      });
      propKnob.addEventListener('pointercancel', () => {
        if (!dragging) return;
        release(0);
      });
      propKnob.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        finish();
      });
    }
  }

  const LOGO_INK_SELECTOR = '[data-card-logo-img], [data-ficha-logo-img]';

  /**
   * Un logo claro con fondo transparente se pierde en el papel de la comanda:
   * lo marcamos para imprimirlo en tinta oscura.
   * @param {Element | null} img
   */
  function inkLightLogo(img) {
    if (!(img instanceof HTMLImageElement) || !img.currentSrc) return;
    if (img.naturalWidth && img.naturalHeight) {
      img.classList.toggle('is-square-logo', img.naturalWidth / img.naturalHeight < 1.5);
    }
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(probe, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let clear = 0;
        let ink = 0;
        let lum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] / 255;
          if (a < 0.1) {
            clear += 1;
            continue;
          }
          ink += a;
          lum += (a * (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2])) / 255;
        }
        const light = clear / (data.length / 4) > 0.2 && ink > 0 && lum / ink > 0.7;
        img.classList.toggle('is-light-logo', light);
      } catch {
        /* Sin CORS no se puede leer: el logo queda como viene. */
      }
    };
    probe.src = img.currentSrc;
  }

  let logoInkBound = false;
  function initLogoInk() {
    if (!logoInkBound) {
      logoInkBound = true;
      document.addEventListener(
        'load',
        (e) => {
          const t = e.target;
          if (t instanceof HTMLImageElement && t.matches(LOGO_INK_SELECTOR)) inkLightLogo(t);
        },
        true,
      );
    }
    document.querySelectorAll(LOGO_INK_SELECTOR).forEach((img) => {
      if (img instanceof HTMLImageElement && img.complete) inkLightLogo(img);
    });
  }

  function initSuperHub() {
    initLogoInk();
    initSuperTabs();
    initPropViews();
    initHubSearch();
    initAccessSearch();
    initCardMenus();
    initFichaForms();
    initOperativoForms();
    initUsuarios();
    initAccessBoard();
    initNuevoRestModal();
    initSuperNetTimeframe();
    initPropuestas();
    void hydrateLogoPlatesFromCovers();
  }

  initSuperHub();
  document.addEventListener('astro:page-load', initSuperHub);
