import {
  formatBs,
  formatUsd,
  normalizeCantidad,
  resolverSeleccion,
  round2,
  type GrupoOpciones,
} from '../lib/pedidos.js';
import { getStoredMesa } from '../lib/mesa-session.js';

type PlatoCatalogo = { n: string; p: number; img: string; d: string; o: GrupoOpciones[] };
type MetodoCliente = { id: string; tipo: string; nombre: string; datos: string; bs: boolean; referencia: boolean };
type ConfigCliente = { modos: string[]; cedula: string; metodos: MetodoCliente[] };
type ItemCarrito = { k: string; id: string; q: number; s: Record<string, string[]>; n: string };
type LineaVista = ItemCarrito & {
  plato: PlatoCatalogo;
  unitario: number;
  total: number;
  detalle: Array<{ grupo: string; opciones: string[] }>;
};

const CLIENTE_KEY = 'xemilla:cliente';
const TRASH_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function readJson<T>(root: Element, selector: string, fallback: T): T {
  const el = root.querySelector(selector);
  try {
    return el?.textContent ? (JSON.parse(el.textContent) as T) : fallback;
  } catch {
    return fallback;
  }
}

function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function storageSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado / cuota llena */
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function lineKey(id: string, sel: Record<string, string[]>, nota: string) {
  const norm = Object.keys(sel)
    .sort()
    .map((g) => `${g}:${[...sel[g]].sort().join(',')}`)
    .join('|');
  return `${id}#${norm}#${nota.trim().toLowerCase()}`;
}

function initCart(root: HTMLElement) {
  if (root.dataset.cartReady === 'true') return;
  root.dataset.cartReady = 'true';

  const app = root.closest<HTMLElement>('[data-restaurant-app]');
  const catalogo = readJson<Record<string, PlatoCatalogo>>(root, '[data-cart-catalog]', {});
  const config = readJson<ConfigCliente>(root, '[data-cart-config]', { modos: ['mesa'], cedula: 'no', metodos: [] });
  const slug = root.dataset.slug || '';
  const sucursal = root.dataset.sucursal || '';
  const storeKey = `xemilla:carrito:${slug}:${sucursal}`;

  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel as string) as T | null;
  const $$ = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));

  const pill = $('[data-cart-pill]');
  const toast = $('[data-cart-toast]');
  const layerOp = $('[data-cart-layer="opciones"]');
  const layerCart = $('[data-cart-layer="carrito"]');
  const form = $<HTMLFormElement>('[data-cart-form]');

  let items: ItemCarrito[] = storageGet<ItemCarrito[]>(storeKey, []).filter(
    (it) => it && catalogo[String(it.id)] && resolverSeleccion(catalogo[String(it.id)].o, it.s).ok,
  );

  const tasaBcv = () => {
    const menu = app?.querySelector<HTMLElement>('[data-menu-panel]');
    const n = Number(menu?.dataset.tasaBcv || root.dataset.tasaBcv);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  function lineas(): LineaVista[] {
    const out: LineaVista[] = [];
    for (const it of items) {
      const plato = catalogo[it.id];
      if (!plato) continue;
      const sel = resolverSeleccion(plato.o, it.s);
      if (!sel.ok) continue;
      const unitario = round2(plato.p + sel.extra);
      out.push({ ...it, plato, unitario, total: round2(unitario * it.q), detalle: sel.detalle });
    }
    return out;
  }

  const totalUsd = () => round2(lineas().reduce((acc, l) => acc + l.total, 0));
  const totalQty = () => items.reduce((acc, it) => acc + it.q, 0);

  function save() {
    storageSet(storeKey, items);
  }

  // —— Toast / pill ——
  let toastTimer = 0;
  function showToast(text: string) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-on'), 1800);
  }

  function anyLayerOpen() {
    return Boolean(layerOp?.classList.contains('is-open') || layerCart?.classList.contains('is-open'));
  }

  function syncPill(bump = false) {
    if (!pill) return;
    const qty = totalQty();
    const surface = app?.dataset.surface || 'home';
    const visible = qty > 0 && (surface === 'home' || surface === 'menu') && !anyLayerOpen();
    pill.hidden = !visible;
    document.documentElement.classList.toggle('has-cart', qty > 0);
    const count = $('[data-cart-count]');
    const total = $('[data-cart-pill-total]');
    if (count) count.textContent = String(qty);
    if (total) total.textContent = formatUsd(totalUsd());
    if (bump && visible) {
      pill.classList.remove('is-bump');
      void pill.offsetWidth;
      pill.classList.add('is-bump');
    }
  }

  // —— Capas ——
  function setLayer(layer: HTMLElement | null, open: boolean) {
    if (!layer) return;
    layer.classList.toggle('is-open', open);
    layer.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.documentElement.classList.toggle('xcart-lock', anyLayerOpen());
    syncPill();
  }

  // —— Hoja de opciones ——
  let opPlatoId = '';
  let opQty = 1;

  function opSeleccion(): Record<string, string[]> {
    const sel: Record<string, string[]> = {};
    root.querySelectorAll<HTMLInputElement>('[data-op-body] input[data-grupo]:checked').forEach((inp) => {
      const g = inp.dataset.grupo || '';
      (sel[g] ||= []).push(inp.value);
    });
    return sel;
  }

  function syncOpTotal() {
    const plato = catalogo[opPlatoId];
    if (!plato) return;
    let extra = 0;
    for (const g of plato.o) {
      for (const id of opSeleccion()[g.id] || []) extra += g.opciones.find((o) => o.id === id)?.precio || 0;
    }
    const totalEl = $('[data-op-total]');
    const qtyEl = $('[data-op-qty-value]');
    if (totalEl) totalEl.textContent = formatUsd(round2((plato.p + extra) * opQty));
    if (qtyEl) qtyEl.textContent = String(opQty);
    // Con máximo alcanzado, el resto de casillas del grupo se bloquea.
    for (const g of plato.o) {
      if (g.max <= 1) continue;
      const inputs = Array.from(
        root.querySelectorAll<HTMLInputElement>(`[data-op-body] input[data-grupo="${g.id}"]`),
      );
      const full = inputs.filter((i) => i.checked).length >= g.max;
      inputs.forEach((i) => {
        i.disabled = full && !i.checked;
      });
    }
  }

  function openOpciones(id: string) {
    const plato = catalogo[id];
    if (!plato || !layerOp) return;
    opPlatoId = id;
    opQty = 1;
    const title = $('[data-op-title]');
    const desc = $('[data-op-desc]');
    const hero = $('[data-op-hero]');
    const img = $<HTMLImageElement>('[data-op-img]');
    if (title) title.textContent = plato.n;
    if (desc) desc.textContent = plato.d;
    if (hero && img) {
      hero.hidden = !plato.img;
      if (plato.img) img.src = plato.img;
    }
    const body = $('[data-op-body]');
    if (body) {
      body.innerHTML =
        plato.o
          .map((g) => {
            const tipo = g.max > 1 ? 'checkbox' : 'radio';
            const regla = g.max > 1 ? `Elige hasta ${g.max}` : 'Elige 1';
            const ops = g.opciones
              .map(
                (o) => `<label class="xcart-opt">
                  <input type="${tipo}" name="op-${esc(g.id)}" value="${esc(o.id)}" data-grupo="${esc(g.id)}" />
                  <span class="xcart-opt__name">${esc(o.nombre)}</span>
                  <span class="xcart-opt__price">${o.precio > 0 ? `+${formatUsd(o.precio)}` : ''}</span>
                </label>`,
              )
              .join('');
            return `<fieldset class="xcart-group" data-grupo-box="${esc(g.id)}">
              <div class="xcart-group__head">
                <div><div class="xcart-group__name">${esc(g.nombre)}</div><div class="xcart-group__rule">${regla}</div></div>
                <span class="xcart-badge${g.requerido ? ' is-req' : ''}">${g.requerido ? 'Requerido' : 'Opcional'}</span>
              </div>${ops}</fieldset>`;
          })
          .join('');
    }
    const notaInput = $<HTMLInputElement>('[data-op-nota]');
    if (notaInput) notaInput.value = '';
    syncOpTotal();
    setLayer(layerOp, true);
  }

  function addItem(id: string, sel: Record<string, string[]>, qty: number, nota: string) {
    const k = lineKey(id, sel, nota);
    const existing = items.find((it) => it.k === k);
    if (existing) existing.q = normalizeCantidad(existing.q + qty);
    else items.push({ k, id, q: normalizeCantidad(qty), s: sel, n: nota });
    save();
    syncPill(true);
    showToast(`Agregado: ${catalogo[id]?.n || 'plato'}`);
  }

  function submitOpciones() {
    const plato = catalogo[opPlatoId];
    if (!plato) return;
    const raw = opSeleccion();
    const res = resolverSeleccion(plato.o, raw);
    root.querySelectorAll('[data-grupo-box]').forEach((box) => box.classList.remove('is-invalid'));
    if (!res.ok) {
      const missing = plato.o.find((g) => g.requerido && !(raw[g.id] || []).length);
      const box = missing ? root.querySelector(`[data-grupo-box="${missing.id}"]`) : null;
      box?.classList.add('is-invalid');
      box?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(res.error);
      return;
    }
    const nota = ($<HTMLInputElement>('[data-op-nota]')?.value || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    addItem(opPlatoId, res.seleccion, opQty, nota);
    setLayer(layerOp, false);
  }

  function requestAdd(id: string) {
    const plato = catalogo[id];
    if (!plato) return;
    if (plato.o.length) openOpciones(id);
    else addItem(id, {}, 1, '');
  }

  // —— Carrito ——
  function renderCart() {
    const ls = lineas();
    const list = $('[data-cart-list]');
    const empty = $('[data-cart-empty]');
    const summary = $('[data-cart-summary]');
    const qty = totalQty();
    if (summary) summary.textContent = `${qty} ${qty === 1 ? 'producto' : 'productos'}`;
    if (empty) empty.hidden = ls.length > 0;
    if (list) {
      list.innerHTML = ls
        .map((l) => {
          const detalle = [
            ...l.detalle.map((d) => `${esc(d.grupo)}: ${esc(d.opciones.join(', '))}`),
            ...(l.n ? [`Nota: ${esc(l.n)}`] : []),
          ].join('<br />');
          return `<li class="xcart-item${l.plato.img ? '' : ' xcart-item--noimg'}" data-line="${esc(l.k)}">
            ${l.plato.img ? `<img class="xcart-item__img" src="${esc(l.plato.img)}" alt="" loading="lazy" />` : ''}
            <div>
              <p class="xcart-item__name">${esc(l.plato.n)}</p>
              ${detalle ? `<p class="xcart-item__detail">${detalle}</p>` : ''}
              <div class="xcart-item__row">
                <span class="xcart-item__price">${formatUsd(l.total)}</span>
                <span class="xcart-stepper xcart-stepper--sm">
                  <button type="button" data-line-qty="-1" aria-label="${l.q === 1 ? 'Eliminar' : 'Quitar uno'}">${l.q === 1 ? TRASH_SVG : '−'}</button>
                  <span>${l.q}</span>
                  <button type="button" data-line-qty="1" aria-label="Agregar uno">+</button>
                </span>
              </div>
            </div>
          </li>`;
        })
        .join('');
    }
    const usd = totalUsd();
    const tasa = tasaBcv();
    $$('[data-cart-total-usd]').forEach((el) => (el.textContent = formatUsd(usd)));
    $$('[data-cart-total-bs]').forEach((el) => (el.textContent = tasa ? formatBs(usd * tasa) : ''));
    const go = $<HTMLButtonElement>('[data-cart-go="checkout"]');
    if (go) go.disabled = ls.length === 0;
    syncPayCard();
    syncPill();
  }

  function showView(view: 'carrito' | 'checkout' | 'listo') {
    $$('[data-cart-view]').forEach((el) => {
      el.hidden = el.dataset.cartView !== view;
    });
    if (view === 'checkout') prepareCheckout();
  }

  function openCart(view: 'carrito' | 'checkout' = 'carrito') {
    renderCart();
    showView(view);
    setLayer(layerCart, true);
  }

  // —— Checkout ——
  const field = (name: string) => form?.elements.namedItem(name) as HTMLInputElement | RadioNodeList | null;
  const val = (name: string) => {
    const el = field(name);
    return el ? String((el as HTMLInputElement).value ?? '').trim() : '';
  };

  function currentModo() {
    return val('modo') || config.modos[0] || 'mesa';
  }

  function currentMetodo() {
    const id = val('metodo_pago');
    return config.metodos.find((m) => m.id === id) || null;
  }

  function syncModoFields() {
    const modo = currentModo();
    form?.querySelectorAll<HTMLElement>('[data-modos]').forEach((el) => {
      const show = (el.dataset.modos || '').split(' ').includes(modo);
      el.hidden = !show;
      el.classList.toggle('is-required', (el.dataset.requiredModos || '').split(' ').includes(modo));
    });
  }

  function syncPayCard() {
    const card = $('[data-pay-card]');
    if (!card) return;
    const metodo = currentMetodo();
    card.hidden = !metodo;
    if (!metodo) return;
    const usd = totalUsd();
    const tasa = tasaBcv();
    const enBs = metodo.bs && tasa > 0;
    const amount = $('[data-pay-amount]');
    const amountBtn = $('[data-pay-amount-copy]');
    if (amount) amount.textContent = enBs ? formatBs(usd * tasa) : formatUsd(usd);
    if (amountBtn) amountBtn.dataset.copy = enBs ? round2(usd * tasa).toFixed(2).replace('.', ',') : usd.toFixed(2);
    const lines = $('[data-pay-lines]');
    if (lines) {
      lines.innerHTML = metodo.datos
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const idx = line.indexOf(':');
          const value = (idx > -1 ? line.slice(idx + 1) : line).trim();
          return `<li><span class="xcart-pay__text">${esc(line)}</span>${
            value ? `<button type="button" class="xcart-copy" data-copy="${esc(value)}"><span class="xcart-copy__hint">Copiar</span></button>` : ''
          }</li>`;
        })
        .join('');
    }
    const ref = $('[data-pay-ref]');
    if (ref) ref.hidden = !metodo.referencia;
  }

  function prepareCheckout() {
    if (!form) return;
    const mesa = getStoredMesa();
    const modoInputs = form.querySelectorAll<HTMLInputElement>('input[type="radio"][name="modo"]');
    if (modoInputs.length && !Array.from(modoInputs).some((i) => i.checked)) {
      const preferido = mesa && config.modos.includes('mesa') ? 'mesa' : config.modos.find((m) => m !== 'mesa') || config.modos[0];
      modoInputs.forEach((i) => (i.checked = i.value === preferido));
    }
    const mesaInput = field('mesa') as HTMLInputElement | null;
    if (mesaInput && mesa && !mesaInput.value) mesaInput.value = mesa;
    const cliente = storageGet<Record<string, string>>(CLIENTE_KEY, {});
    for (const k of ['nombre', 'telefono', 'cedula', 'direccion']) {
      const el = field(k) as HTMLInputElement | null;
      if (el && !el.value && cliente[k]) el.value = cliente[k];
    }
    syncModoFields();
    syncPayCard();
    setError('');
  }

  function setError(msg: string) {
    const el = $('[data-cart-error]');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
    if (msg) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  let sending = false;
  async function submitPedido() {
    if (sending || !form) return;
    const ls = lineas();
    if (!ls.length) return setError('Tu pedido está vacío');
    const modo = currentModo();
    const cliente = {
      nombre: val('nombre'),
      telefono: modo === 'mesa' ? '' : val('telefono'),
      cedula: modo === 'mesa' ? '' : val('cedula'),
      direccion: modo === 'delivery' ? val('direccion') : '',
    };
    const metodo = currentMetodo();
    const body = {
      slug,
      sucursal,
      modo,
      mesa: modo === 'mesa' ? val('mesa') : '',
      cliente,
      metodo_pago: metodo?.id || '',
      referencia: metodo?.referencia ? val('referencia') : '',
      notas: val('notas'),
      items: ls.map((l) => ({ plato_id: Number(l.id), cantidad: l.q, opciones: l.s, nota: l.n })),
    };

    const btn = $<HTMLButtonElement>('[data-cart-submit]');
    const label = $('[data-cart-submit-label]');
    sending = true;
    if (btn) btn.disabled = true;
    if (label) label.textContent = 'Preparando pedido…';
    setError('');

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'No pudimos enviar el pedido. Intenta de nuevo.');

      storageSet(CLIENTE_KEY, {
        nombre: cliente.nombre,
        telefono: cliente.telefono || storageGet<Record<string, string>>(CLIENTE_KEY, {}).telefono || '',
        cedula: cliente.cedula,
        direccion: cliente.direccion,
      });

      const url = `https://wa.me/${json.whatsapp}?text=${encodeURIComponent(json.mensaje)}`;
      const code = $('[data-done-code]');
      const link = $<HTMLAnchorElement>('[data-done-wa]');
      if (code) code.textContent = `#${json.codigo}`;
      if (link) link.href = url;

      items = [];
      save();
      form.reset();
      showView('listo');
      syncPill();

      const win = window.open(url, '_blank');
      if (win) win.opener = null;
      else window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      sending = false;
      if (btn) btn.disabled = false;
      if (label) label.textContent = 'Enviar pedido por WhatsApp';
    }
  }

  // —— Eventos ——
  root.addEventListener('click', (e) => {
    const t = e.target as Element | null;
    if (!t) return;

    if (t.closest('[data-cart-close]')) {
      const layer = t.closest<HTMLElement>('[data-cart-layer]');
      setLayer(layer, false);
      if (layer === layerCart && !items.length) showView('carrito');
      return;
    }
    if (t.closest('[data-cart-pill]')) return openCart();

    const go = t.closest<HTMLElement>('[data-cart-go]');
    if (go) return showView(go.dataset.cartGo as 'carrito' | 'checkout');

    const opQtyBtn = t.closest<HTMLElement>('[data-op-qty]');
    if (opQtyBtn) {
      opQty = normalizeCantidad(opQty + Number(opQtyBtn.dataset.opQty));
      return syncOpTotal();
    }
    if (t.closest('[data-op-submit]')) return submitOpciones();

    const lineBtn = t.closest<HTMLElement>('[data-line-qty]');
    if (lineBtn) {
      const k = lineBtn.closest<HTMLElement>('[data-line]')?.dataset.line;
      const it = items.find((i) => i.k === k);
      if (it) {
        const next = it.q + Number(lineBtn.dataset.lineQty);
        if (next <= 0) items = items.filter((i) => i !== it);
        else it.q = normalizeCantidad(next);
        save();
        renderCart();
      }
      return;
    }

    const copyBtn = t.closest<HTMLElement>('[data-copy]');
    if (copyBtn) {
      void copyText(copyBtn.dataset.copy || '').then((ok) => showToast(ok ? 'Copiado' : 'No se pudo copiar'));
      return;
    }

    if (t.closest('[data-cart-submit]')) void submitPedido();
  });

  root.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement | null;
    if (!t) return;
    if (t.dataset.grupo) return syncOpTotal();
    if (t.name === 'modo') return syncModoFields();
    if (t.name === 'metodo_pago') syncPayCard();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    void submitPedido();
  });

  // Botones «Agregar» de la carta y del detalle del plato.
  app?.addEventListener('click', (e) => {
    const t = e.target as Element | null;
    const addBtn = t?.closest<HTMLElement>('[data-cart-add]');
    if (addBtn) {
      e.preventDefault();
      e.stopPropagation();
      requestAdd(addBtn.dataset.platoId || '');
      return;
    }
    const detalleAdd = t?.closest<HTMLElement>('[data-detalle-cart-add]');
    if (detalleAdd) {
      e.preventDefault();
      e.stopPropagation();
      const id = detalleAdd.dataset.platoId || '';
      app.querySelector<HTMLElement>('[data-detalle-close]')?.click();
      requestAdd(id);
    }
  });

  // El detalle del plato muestra «Agregar al pedido» del plato abierto.
  app?.addEventListener(
    'click',
    (e) => {
      const t = e.target as Element | null;
      if (!t || t.closest('[data-cart-add]')) return;
      const tapCard = t.closest('.menu-plato-item--grid-tap');
      const det =
        t.closest<HTMLElement>('[data-open-detalle]') ??
        (tapCard && !t.closest('a, button, input, select, textarea')
          ? tapCard.querySelector<HTMLElement>('[data-open-detalle]')
          : null);
      if (!det) return;
      const btn = app.querySelector<HTMLElement>('[data-detalle-cart-add]');
      if (!btn) return;
      const id = det.dataset.platoId || '';
      btn.dataset.platoId = id;
      btn.hidden = !catalogo[id];
    },
    true,
  );

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (layerOp?.classList.contains('is-open')) setLayer(layerOp, false);
    else if (layerCart?.classList.contains('is-open')) setLayer(layerCart, false);
  });

  if (app) {
    new MutationObserver(() => syncPill()).observe(app, {
      attributes: true,
      attributeFilter: ['data-surface'],
    });
  }

  window.addEventListener('storage', (e) => {
    if (e.key !== storeKey) return;
    items = storageGet<ItemCarrito[]>(storeKey, []);
    renderCart();
  });

  syncPill();
}

function initAll() {
  document.querySelectorAll<HTMLElement>('[data-cart-root]').forEach(initCart);
}

initAll();
document.addEventListener('astro:page-load', initAll);
