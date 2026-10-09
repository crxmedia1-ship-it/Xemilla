import { describe, expect, it } from 'vitest';
import {
  moverPuntos,
  nivelDeTarjeta,
  reglasDeTarjeta,
  readFidelidadCodigo,
  readFidelidadDiseno,
  readFidelidadReglas,
  readFidelidadTelefono,
  tarjetaPublica,
} from '../src/lib/fidelidad.js';
import { buildWalletPass, leerApplePassToken, leerSerialWallet, walletStatus } from '../src/lib/wallet.js';
import { mensajeWallet } from '../src/lib/wallet-push.js';

describe('tarjeta de fidelidad', () => {
  it('ignora colores inválidos y deja la tarjeta oscura', () => {
    expect(readFidelidadDiseno({ fondo: 'rojo', tinta: '#fff', acento: '#b45309', titulo: '  Club  ' })).toEqual({
      diseno: '',
      fondo: '#1c1917',
      tinta: '#fafaf9',
      acento: '#b45309',
      titulo: 'Club',
      pedido: '',
      catalogo: [],
      puntos: null,
      meta: null,
      premio: '',
      niveles: [],
    });
  });

  it('cambia de plantilla según los canjes', () => {
    const diseno = readFidelidadDiseno({
      fondo: '#111111',
      niveles: [
        { nombre: 'Oro', desde: 3, fondo: '#292017', tinta: '#faf6ef', acento: '#d4a574' },
        { nombre: 'Roto', desde: 0, fondo: 'no' },
        { nombre: 'Plata', desde: 1, fondo: '#3f3f46', tinta: '#ffffff', acento: '#eeeeee' },
      ],
    });
    expect(diseno.niveles.map((nivel) => nivel.nombre)).toEqual(['Plata', 'Oro']);
    expect(nivelDeTarjeta(diseno, 0).nombre).toBe('Inicial');
    expect(nivelDeTarjeta(diseno, 1).fondo).toBe('#3f3f46');
    expect(nivelDeTarjeta(diseno, 4).nombre).toBe('Oro');
    const conPremio = readFidelidadDiseno({
      premio: 'Café',
      meta: 40,
      niveles: [{ nombre: 'Oro', desde: 2, premio: 'Cena', meta: 20, puntos: 5 }],
    });
    expect(reglasDeTarjeta(conPremio, 0, { puntos: 10, meta: 80, premio: 'Un premio' })).toEqual({
      puntos: 10,
      meta: 40,
      premio: 'Café',
    });
    expect(reglasDeTarjeta(conPremio, 2, { puntos: 10, meta: 80, premio: 'Un premio' })).toEqual({
      puntos: 5,
      meta: 20,
      premio: 'Cena',
    });
  });

  it('usa 10 puntos y meta 80 cuando el local no configuró nada', () => {
    expect(readFidelidadReglas({})).toEqual({ puntos: 10, meta: 80, premio: 'Un premio' });
  });

  it('suma una visita y solo canjea al llegar a la meta', () => {
    const reglas = { puntos: 10, meta: 30, premio: 'Postre' };
    expect(moverPuntos(20, reglas, 'visita')).toEqual({ puntos: 30, delta: 10 });
    expect(moverPuntos(20, reglas, 'canje')).toEqual({ error: 'Todavía no llega al premio.' });
    expect(moverPuntos(30, reglas, 'canje')).toEqual({ puntos: 0, delta: -30 });
  });

  it('lee el código del QR o del texto escrito', () => {
    expect(readFidelidadCodigo('xemilla:fidelidad:ab23cd45')).toBe('AB23CD45');
    expect(readFidelidadCodigo('ab23-cd45')).toBe('AB23CD45');
    expect(readFidelidadTelefono('+58 414 123 4567')).toBe('584141234567');
  });

  it('arma el pase y deja la wallet en espera sin claves', () => {
    expect(walletStatus({})).toEqual({ apple: false, google: false, ready: false });
    const pass = buildWalletPass(
      { codigo: 'AB23CD45', nombre: 'Ana', puntos: 10, meta: 80, premio: 'Postre' },
      { nombre: 'Black Sushi', slug: 'black-sushi' },
    );
    expect(pass.apple.barcode.message).toBe('XEMILLA:FIDELIDAD:AB23CD45');
    expect(pass.google.barcode.value).toBe('XEMILLA:FIDELIDAD:AB23CD45');
    expect(pass.apple.backgroundColor).toBe('rgb(28, 25, 23)');
  });

  it('cuenta las visitas que faltan y pinta el pase con el diseño de la carta', () => {
    const reglas = { puntos: 10, meta: 80, premio: 'Postre' };
    expect(tarjetaPublica({ puntos: 24 }, reglas).visitas).toBe(6);
    const pass = buildWalletPass(
      { codigo: 'AB23CD45', nombre: 'Ana', puntos: 24, meta: 80, premio: 'Postre' },
      { nombre: 'Black Sushi', slug: 'black-sushi' },
      { fondo: '#111111', tinta: '#ffffff', acento: '#c4a574', titulo: 'Club' },
    );
    expect(pass.apple.backgroundColor).toBe('rgb(17, 17, 17)');
    expect(pass.apple.foregroundColor).toBe('rgb(255, 255, 255)');
    expect(pass.google.hexBackgroundColor).toBe('#111111');
    expect(pass.apple.storeCard.primaryFields[0].label).toBe('Club');
  });

  it('deja el pase listo para que Wallet avise al teléfono', () => {
    const pass = buildWalletPass(
      { codigo: 'AB23CD45', nombre: 'Ana', puntos: 24, meta: 80, premio: 'Postre' },
      { nombre: 'Black Sushi', slug: 'black-sushi' },
      {},
      {
        webServiceURL: 'https://xemilla.app/api/wallet',
        authenticationToken: 'abc123abc123abc123',
        passTypeIdentifier: 'pass.com.xemilla.fidelidad',
      },
    );
    expect(pass.apple.webServiceURL).toBe('https://xemilla.app/api/wallet');
    expect(pass.apple.authenticationToken).toBe('abc123abc123abc123');
    expect(pass.apple.serialNumber).toBe('black-sushi:AB23CD45');
    expect(pass.google.notifyPreference).toBe('NOTIFY_ON_UPDATE');
    expect(leerSerialWallet(pass.apple.serialNumber)).toEqual({ slug: 'black-sushi', codigo: 'AB23CD45' });
    expect(leerApplePassToken('ApplePass abc123abc123abc123')).toBe('abc123abc123abc123');
    expect(mensajeWallet('Sumó 10 puntos.').messageType).toBe('TEXT_AND_NOTIFY');
  });
});
