/**
 * Pase de Apple Wallet y Google Wallet.
 * El pase se arma siempre. La firma espera estas variables:
 * Apple: APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT_BASE64, APPLE_PASS_CERT_PASSWORD
 * Google: GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_JSON
 */

/**
 * @param {Record<string, string | undefined>} [env]
 */
export function walletStatus(env = import.meta.env) {
  const apple = Boolean(
    env.APPLE_PASS_TYPE_ID &&
      env.APPLE_TEAM_ID &&
      env.APPLE_PASS_CERT_BASE64 &&
      env.APPLE_PASS_CERT_PASSWORD,
  );
  const google = Boolean(env.GOOGLE_WALLET_ISSUER_ID && env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON);
  return { apple, google, ready: apple || google };
}

/**
 * @param {string} hex
 */
function appleColor(hex) {
  const raw = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return 'rgb(28, 25, 23)';
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * El pase usa los mismos colores que la tarjeta de la carta.
 * webServiceURL y authenticationToken son lo que permite el aviso push.
 * @param {{ codigo: string, nombre: string, puntos: number, meta: number, premio: string }} card
 * @param {{ nombre: string, slug: string }} local
 * @param {{ fondo?: string, tinta?: string, acento?: string, titulo?: string }} [diseno]
 * @param {{ webServiceURL?: string, authenticationToken?: string, passTypeIdentifier?: string }} [aviso]
 */
export function buildWalletPass(card, local, diseno = {}, aviso = {}) {
  const title = String(diseno.titulo || '').trim() || local.nombre || 'Xemilla';
  const fondo = diseno.fondo || '#1c1917';
  const tinta = diseno.tinta || '#fafaf9';
  const acento = diseno.acento || '#d6d3d1';
  const serialNumber = `${local.slug}:${card.codigo}`;
  return {
    apple: {
      formatVersion: 1,
      passTypeIdentifier: aviso.passTypeIdentifier || 'pending',
      organizationName: 'Xemilla',
      description: `Tarjeta de ${local.nombre || title}`,
      serialNumber,
      ...(aviso.webServiceURL && aviso.authenticationToken
        ? { webServiceURL: aviso.webServiceURL, authenticationToken: aviso.authenticationToken }
        : {}),
      backgroundColor: appleColor(fondo),
      foregroundColor: appleColor(tinta),
      labelColor: appleColor(acento),
      storeCard: {
        headerFields: [{ key: 'puntos', label: 'PUNTOS', value: card.puntos }],
        primaryFields: [{ key: 'nombre', label: title, value: card.nombre || 'Invitado' }],
        secondaryFields: [{ key: 'premio', label: 'PREMIO', value: card.premio }],
        auxiliaryFields: [{ key: 'meta', label: 'META', value: `${card.puntos} / ${card.meta}` }],
      },
      barcode: {
        format: 'PKBarcodeFormatQR',
        message: `XEMILLA:FIDELIDAD:${card.codigo}`,
        messageEncoding: 'iso-8859-1',
      },
    },
    google: {
      id: `${local.slug}.${card.codigo}`,
      hexBackgroundColor: fondo,
      cardTitle: title,
      header: card.nombre || 'Invitado',
      subheader: `${card.puntos} puntos`,
      textModules: [
        { header: 'Premio', body: card.premio },
        { header: 'Meta', body: `${card.meta} puntos` },
      ],
      barcode: { type: 'QR_CODE', value: `XEMILLA:FIDELIDAD:${card.codigo}` },
      notifyPreference: 'NOTIFY_ON_UPDATE',
    },
  };
}

/**
 * @param {string} serial
 */
export function leerSerialWallet(serial) {
  const raw = String(serial || '');
  const cut = raw.lastIndexOf(':');
  if (cut < 1) return null;
  const slug = raw.slice(0, cut);
  const codigo = raw.slice(cut + 1);
  if (!slug || !/^[A-Z2-9]{8}$/.test(codigo)) return null;
  return { slug, codigo };
}

/**
 * @param {string | null} header
 */
export function leerApplePassToken(header) {
  const match = String(header || '').match(/^ApplePass\s+(\S+)$/);
  return match?.[1] || '';
}

export function nuevoWalletToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
}
