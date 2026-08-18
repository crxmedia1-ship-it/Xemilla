/**
 * Gadgets operativos (botón flotante) vs experienciales (menú/plato).
 * @typedef {{ wifi?: boolean, llamarMesero?: boolean, dividirCuenta?: boolean, boutique?: boolean, nutricion?: boolean, ar?: boolean, reservas?: boolean }} GadgetFlags
 */

/** @type {ReadonlySet<string>} */
export const GADGET_SERVICIOS_ESTILOS = Object.freeze(new Set(['drawer', 'radial']));

/**
 * @param {unknown} value
 * @returns {'drawer' | 'radial'}
 */
export function normalizeGadgetServiciosEstilo(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  return GADGET_SERVICIOS_ESTILOS.has(raw) ? /** @type {'drawer' | 'radial'} */ (raw) : 'drawer';
}

/**
 * @param {GadgetFlags | null | undefined} gadgets
 * @returns {boolean}
 */
export function hasOperationalGadgets(gadgets) {
  if (!gadgets || typeof gadgets !== 'object') return false;
  return Boolean(
    gadgets.wifi || gadgets.llamarMesero || gadgets.dividirCuenta || gadgets.boutique,
  );
}

/**
 * @param {GadgetFlags | null | undefined} gadgets
 * @returns {Array<{ id: string, label: string, subtitle: string, kind: 'section' | 'boutique', requiresMesa?: boolean }>}
 */
export function buildOperationalGadgetItems(gadgets) {
  if (!hasOperationalGadgets(gadgets)) return [];

  /** @type {Array<{ id: string, label: string, subtitle: string, kind: 'section' | 'boutique', requiresMesa?: boolean }>} */
  const items = [];

  if (gadgets?.wifi) {
    items.push({
      id: 'wifi',
      label: 'Wi‑Fi',
      subtitle: 'Conectar a la red',
      kind: 'section',
    });
  }
  if (gadgets?.llamarMesero) {
    items.push({
      id: 'mesero',
      label: 'Llamar mesonero',
      subtitle: 'Asistencia en mesa',
      kind: 'section',
      requiresMesa: true,
    });
  }
  if (gadgets?.dividirCuenta) {
    items.push({
      id: 'dividir',
      label: 'Dividir cuenta',
      subtitle: 'Pedir o dividir la cuenta',
      kind: 'section',
      requiresMesa: true,
    });
  }
  if (gadgets?.boutique) {
    items.push({
      id: 'boutique',
      label: 'Boutique',
      subtitle: 'Merchandise del local',
      kind: 'boutique',
    });
  }

  return items;
}
