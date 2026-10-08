import { escapeHtml } from '../lib/nosotros-layout.js';

/**
 * Selector de sede del panel Menú y diálogo de gestión de sedes.
 *
 * En "Todas las sedes" el toggle Disponible sigue escribiendo platos.disponible
 * (afecta a todas). Con una sede elegida, escribe plato_sucursal solo para esa sede.
 * Mientras hay sede elegida, `data-disponible` de la fila refleja el estado en esa
 * sede y `data-disponible-marca` guarda el de la marca.
 *
 * @param {{
 *   root: HTMLElement | null,
 *   tbody: HTMLElement | null,
 *   signal: AbortSignal,
 *   paintToggle: (btn: Element, on: boolean) => void,
 *   applySearchFilter: () => void,
 *   showToast: (msg: string, tone?: 'ok' | 'error') => void,
 * }} deps
 */
export function initSucursales({ root, tbody, signal, paintToggle, applySearchFilter, showToast }) {
  const block = document.querySelector('[data-sucursal-block]');
  if (!(root instanceof HTMLElement) || !(block instanceof HTMLElement)) {
    return { handleToggle: () => false };
  }

  const restauranteId = String(root.dataset.restauranteId || '');
  const publicSlug = String(root.dataset.slug || '');
  const isSuper = root.dataset.isSuperAdmin === 'true';
  const cupo = Math.max(1, Number(root.dataset.sucursalesCupo) || 1);
  /** @type {Array<{ id: string, slug: string, nombre: string, direccion: string | null, horarios: string | null, whatsapp_num: string | null, coordenadas_maps: string | null, es_principal: boolean, activo: boolean }>} */
  let sucursales = parseJson(root.dataset.sucursales, []);
  /** @type {Record<string, Record<string, string | null>>} */
  const agotados = parseJson(root.dataset.agotadosSucursal, {});
  const storageKey = `xemilla:panel-sede:${restauranteId}`;
  const hint = document.getElementById('sucursal-hint');
  const scroller = document.getElementById('sucursal-scroll');

  /** @type {string} '' = todas las sedes */
  let current = '';

  const sede = (id) => sucursales.find((s) => s.id === id) ?? null;
  const rows = () =>
    tbody ? Array.from(tbody.querySelectorAll('tr[data-plato-id]')).filter((r) => r instanceof HTMLElement) : [];

  function agotadoEn(sucursalId, platoId) {
    const map = agotados[sucursalId];
    if (!map || !(platoId in map)) return false;
    const hasta = map[platoId];
    if (hasta && new Date(hasta).getTime() <= Date.now()) {
      delete map[platoId];
      return false;
    }
    return true;
  }

  function hastaLabel(hasta) {
    if (!hasta) return 'hasta que lo reactives';
    const d = new Date(hasta);
    return `hasta ${d.toLocaleDateString('es', { weekday: 'long' })} ${d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
  }

  /** @param {HTMLElement} row */
  function paintRow(row) {
    const btn = row.querySelector('[data-toggle-disponible]');
    const id = String(row.dataset.platoId || '');
    if (!current) {
      if (row.dataset.disponibleMarca !== undefined) {
        row.dataset.disponible = row.dataset.disponibleMarca;
        delete row.dataset.disponibleMarca;
      }
      delete row.dataset.agotadoMarca;
      if (btn) {
        paintToggle(btn, row.dataset.disponible === 'true');
        btn.setAttribute('title', row.dataset.disponible === 'true' ? 'Disponible en todas las sedes' : 'Agotado en todas las sedes');
      }
      return;
    }
    const marca = row.dataset.disponibleMarca ?? row.dataset.disponible;
    row.dataset.disponibleMarca = marca;
    const marcaOn = marca === 'true';
    const off = agotadoEn(current, id);
    const on = marcaOn && !off;
    row.dataset.disponible = on ? 'true' : 'false';
    row.dataset.agotadoMarca = marcaOn ? 'false' : 'true';
    if (btn) {
      paintToggle(btn, on);
      const nombre = sede(current)?.nombre ?? 'esta sede';
      btn.setAttribute(
        'title',
        !marcaOn
          ? 'Agotado en todas las sedes (cámbialo en "Todas las sedes")'
          : off
            ? `Agotado en ${nombre} ${hastaLabel(agotados[current]?.[id])}`
            : `Disponible en ${nombre}`,
      );
    }
  }

  function paintHint() {
    block.classList.toggle('is-sede', Boolean(current));
    if (!(hint instanceof HTMLElement)) return;
    const s = sede(current);
    hint.textContent = s
      ? `Agotar un plato aquí lo quita solo en ${s.nombre} y vuelve solo mañana a las 5:00. Las demás sedes no cambian.`
      : 'Agotar un plato aquí lo quita del menú de todas las sedes.';
  }

  function select(id) {
    current = sede(id)?.activo ? id : '';
    try {
      localStorage.setItem(storageKey, current);
    } catch {
      /* almacenamiento bloqueado */
    }
    scroller?.querySelectorAll('[data-sucursal-filter]').forEach((pill) => {
      const on = (pill.getAttribute('data-sucursal-filter') || '') === current;
      pill.classList.toggle('is-on', on);
      pill.setAttribute('aria-pressed', String(on));
    });
    rows().forEach(paintRow);
    paintHint();
    applySearchFilter();
  }

  scroller?.addEventListener(
    'click',
    (event) => {
      const pill = event.target instanceof Element ? event.target.closest('[data-sucursal-filter]') : null;
      if (pill) select(pill.getAttribute('data-sucursal-filter') || '');
    },
    { signal },
  );

  /**
   * @param {HTMLElement} row
   * @returns {boolean} true si el toggle lo gestionó la sede
   */
  function handleToggle(row) {
    if (!current) {
      delete row.dataset.disponibleMarca;
      return false;
    }
    const sucursalId = current;
    const id = String(row.dataset.platoId || '');
    if (row.dataset.agotadoMarca === 'true') {
      showToast('Este plato está agotado en todas las sedes. Actívalo desde "Todas las sedes".', 'error');
      return true;
    }
    const wasOff = agotadoEn(sucursalId, id);
    const nextAgotado = !wasOff;
    const map = (agotados[sucursalId] ??= {});
    if (nextAgotado) map[id] = null;
    else delete map[id];
    paintRow(row);
    applySearchFilter();

    fetch('/api/plato-sucursal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sucursal_id: sucursalId, plato_id: Number(id), agotado: nextAgotado, hasta: 'hoy' }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'No se pudo actualizar la sede.');
        if (nextAgotado) map[id] = json.agotado_hasta ?? null;
        if (current === sucursalId) paintRow(row);
        const nombre = sede(sucursalId)?.nombre ?? 'la sede';
        showToast(nextAgotado ? `Agotado en ${nombre} hasta mañana` : `Disponible otra vez en ${nombre}`);
      })
      .catch((err) => {
        if (nextAgotado) delete map[id];
        else map[id] = null;
        if (current === sucursalId) paintRow(row);
        applySearchFilter();
        showToast(err instanceof Error ? err.message : 'Error al actualizar', 'error');
      });
    return true;
  }

  // ── Diálogo de gestión ──
  const dialog = document.getElementById('sucursales-dialog');
  const list = dialog?.querySelector('[data-sucursales-list]');
  const status = dialog?.querySelector('[data-sucursales-status]');

  function setStatus(msg, isError = false) {
    if (!(status instanceof HTMLElement)) return;
    status.textContent = msg;
    status.classList.toggle('is-error', isError);
  }

  async function callApi(body) {
    const res = await fetch('/api/sucursales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'No se pudo guardar.');
    return json;
  }

  function field(label, name, value, { wide = false, placeholder = '' } = {}) {
    return `<label class="${wide ? 'is-wide' : ''}">${label}<input class="sede-input" name="${name}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(placeholder)}" /></label>`;
  }

  function paintCupo() {
    const form = dialog?.querySelector('[data-sucursal-create]');
    const label = dialog?.querySelector('[data-sucursales-cupo-label]');
    if (label) label.textContent = `${sucursales.length} de ${cupo} sedes contratadas`;
    if (!(form instanceof HTMLFormElement)) return;
    const full = sucursales.length >= cupo;
    form.querySelectorAll('input, button').forEach((el) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) el.disabled = full;
    });
    const input = form.querySelector('input[name="nombre"]');
    if (input instanceof HTMLInputElement) {
      input.placeholder = full ? 'Cupo completo · súbelo en Identidad › Gadgets' : 'Nombre (ej. Las Mercedes)';
    }
  }

  function renderList() {
    paintCupo();
    if (!(list instanceof HTMLElement)) return;
    const origin = location.origin;
    list.innerHTML = sucursales
      .map(
        (s) => `
      <details class="sede-card" data-sucursal-id="${escapeHtml(s.id)}">
        <summary class="sede-card__summary">
          <span class="sede-card__name">${escapeHtml(s.nombre)}
            <span class="sede-card__url">${escapeHtml(`${origin}/${publicSlug}/${s.slug}`)}</span>
          </span>
          <span class="sede-card__badge ${s.activo ? '' : 'sede-card__badge--off'}">${s.es_principal ? 'Principal' : s.activo ? 'Activa' : 'Pausada'}</span>
        </summary>
        <form class="sede-card__form" data-sucursal-form>
          ${field('Nombre', 'nombre', s.nombre)}
          ${field('Enlace', 'slug', s.slug)}
          ${field('Dirección', 'direccion', s.direccion, { wide: true, placeholder: s.es_principal ? 'La del perfil del restaurante' : 'Dirección de esta sede' })}
          ${field('Horario', 'horarios', s.horarios, { placeholder: 'Igual que el restaurante' })}
          ${field('WhatsApp', 'whatsapp_num', s.whatsapp_num, { placeholder: 'Igual que el restaurante' })}
          ${field('Enlace de Google Maps', 'coordenadas_maps', s.coordenadas_maps, { wide: true, placeholder: 'https://maps.google.com/…' })}
          <div class="sede-card__actions">
            ${s.es_principal ? '' : `<label class="sede-card__check"><input type="checkbox" name="activo" ${s.activo ? 'checked' : ''} /> Visible para clientes</label>`}
            <a class="sede-block__manage" href="/${escapeHtml(publicSlug)}/${escapeHtml(s.slug)}" target="_blank" rel="noopener">Ver menú</a>
            <span class="is-push"></span>
            ${isSuper && !s.es_principal ? '<button type="button" class="sede-card__danger" data-sucursal-delete>Eliminar</button>' : ''}
            <button type="submit" class="menu-cmd-btn menu-cmd-btn--primary">Guardar</button>
          </div>
        </form>
      </details>`,
      )
      .join('');
  }

  document.querySelectorAll('[data-sucursales-open]').forEach((btn) =>
    btn.addEventListener(
      'click',
      () => {
        if (!(dialog instanceof HTMLDialogElement)) return;
        renderList();
        setStatus('');
        dialog.showModal();
      },
      { signal },
    ),
  );

  dialog?.addEventListener(
    'click',
    async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target === dialog || target.closest('[data-sucursales-close]')) {
        if (dialog instanceof HTMLDialogElement) dialog.close();
        return;
      }
      const del = target.closest('[data-sucursal-delete]');
      const card = del?.closest('[data-sucursal-id]');
      if (!(card instanceof HTMLElement)) return;
      const s = sede(card.dataset.sucursalId);
      if (!s || !confirm(`¿Eliminar la sede "${s.nombre}"? Su enlace y su QR dejarán de funcionar.`)) return;
      try {
        await callApi({ action: 'delete', id: s.id });
        reloadSoon('Sede eliminada.');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Error', true);
      }
    },
    { signal },
  );

  dialog?.addEventListener(
    'submit',
    async (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      event.preventDefault();
      const data = new FormData(form);

      if (form.hasAttribute('data-sucursal-create')) {
        try {
          await callApi({ action: 'create', restaurante_id: restauranteId, nombre: String(data.get('nombre') || '') });
          reloadSoon('Sede creada.');
        } catch (err) {
          setStatus(err instanceof Error ? err.message : 'Error', true);
        }
        return;
      }

      const card = form.closest('[data-sucursal-id]');
      const s = card instanceof HTMLElement ? sede(card.dataset.sucursalId) : null;
      if (!s) return;
      const body = { action: 'update', id: s.id };
      for (const key of ['nombre', 'slug', 'direccion', 'horarios', 'whatsapp_num', 'coordenadas_maps']) {
        body[key] = String(data.get(key) ?? '');
      }
      if (!s.es_principal) body.activo = data.get('activo') === 'on';
      try {
        const json = await callApi(body);
        const activoCambio = json.sucursal.activo !== s.activo;
        sucursales = sucursales.map((x) => (x.id === s.id ? json.sucursal : x));
        if (activoCambio || json.sucursal.nombre !== s.nombre) {
          reloadSoon('Sede guardada.');
          return;
        }
        renderList();
        setStatus(`"${json.sucursal.nombre}" guardada.`);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Error', true);
      }
    },
    { signal },
  );

  function reloadSoon(msg) {
    setStatus(`${msg} Actualizando…`);
    setTimeout(() => location.reload(), 600);
  }

  let saved = '';
  try {
    saved = localStorage.getItem(storageKey) || '';
  } catch {
    /* almacenamiento bloqueado */
  }
  if (saved && sede(saved)?.activo) select(saved);
  else paintHint();

  return { handleToggle };
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
