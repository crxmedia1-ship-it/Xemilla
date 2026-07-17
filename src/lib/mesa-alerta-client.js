/**
 * Cliente compartido: alertas de mesa (mesero / cuenta) en la WebApp.
 * Evita listeners duplicados y usa sessionStorage de mesa.
 */
import { getStoredMesa, syncMesaSession } from './mesa-session.js';

/**
 * @param {HTMLElement} root
 * @param {{ defaultLabel?: string }} [opts]
 */
export function initMesaAlertaRoot(root, opts = {}) {
  if (!(root instanceof HTMLElement)) return;
  if (root.dataset.ready === 'true') return;
  root.dataset.ready = 'true';

  const defaultLabel = opts.defaultLabel || 'Solicitar atención';
  const input = root.querySelector('[data-mesa-input]');
  const display = root.querySelector('[data-mesa-display]');
  const btn = root.querySelector('[data-mesa-enviar]');
  const status = root.querySelector('[data-mesa-status]');
  const tipo = root.dataset.alertaTipo || 'mesero';
  const restauranteId = root.dataset.restauranteId || '';

  function paintMesa() {
    const mesa = syncMesaSession() || getStoredMesa();
    if (input instanceof HTMLInputElement) input.value = mesa;
    if (display) display.textContent = mesa ? `Mesa ${mesa}` : 'Sin mesa asignada';
    if (btn instanceof HTMLButtonElement) btn.disabled = !mesa;
  }

  paintMesa();

  /**
   * @param {string} message
   * @param {boolean} [ok]
   */
  function setStatus(message, ok = true) {
    if (!(status instanceof HTMLElement)) return;
    status.textContent = message;
    status.classList.remove('hidden', 'text-emerald-400', 'text-rose-400');
    status.classList.add(ok ? 'text-emerald-400' : 'text-rose-400');
  }

  async function enviar() {
    if (!(btn instanceof HTMLButtonElement)) return;
    const mesa = getStoredMesa();
    if (!mesa) {
      setStatus('Escanea el QR de tu mesa para usar este servicio', false);
      return;
    }
    if (!restauranteId) {
      setStatus('Restaurante no configurado', false);
      return;
    }

    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Enviando…';
    setStatus('Avisando al equipo…', true);

    try {
      const res = await fetch('/api/alerta-mesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurante_id: restauranteId,
          mesa,
          tipo,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'No se pudo enviar');
      setStatus(json.message || 'Solicitud enviada', true);
      btn.textContent = 'Enviado ✓';
      setTimeout(() => {
        btn.textContent = prev || defaultLabel;
        btn.disabled = false;
      }, 2200);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Error al enviar', false);
      btn.textContent = prev || defaultLabel;
      btn.disabled = false;
    }
  }

  btn?.addEventListener('click', () => {
    void enviar();
  });

  // Un solo listener document-level; cada root se registra en un Set
  registerMesaPanelListener(root, paintMesa);
}

/** @type {WeakMap<HTMLElement, () => void> | null} */
let mesaPanelHandlers = null;
/** @type {boolean} */
let mesaPanelListenerBound = false;

/**
 * @param {HTMLElement} root
 * @param {() => void} paint
 */
function registerMesaPanelListener(root, paint) {
  if (!mesaPanelHandlers) mesaPanelHandlers = new WeakMap();
  if (!mesaPanelListenerBound) {
    mesaPanelListenerBound = true;
    document.addEventListener('xemilla:mesa-panel-open', () => {
      document.querySelectorAll('[data-mesa-alerta]').forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const fn = mesaPanelHandlers?.get(el);
        if (fn) {
          try {
            fn();
          } catch {
            /* ignore */
          }
        }
      });
    });
  }
  mesaPanelHandlers.set(root, paint);
}

/**
 * @param {string} [selector]
 * @param {{ defaultLabel?: string }} [opts]
 */
export function initAllMesaAlertas(selector = '[data-mesa-alerta]', opts = {}) {
  document.querySelectorAll(selector).forEach((el) => {
    if (el instanceof HTMLElement) initMesaAlertaRoot(el, opts);
  });
}
