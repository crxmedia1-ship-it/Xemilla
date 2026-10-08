import { describe, expect, it } from 'vitest';
import {
  finDelDiaOperativo,
  isAgotadoVigente,
  slugifySucursal,
} from '../src/lib/sucursales.js';

describe('finDelDiaOperativo', () => {
  it('de día, vuelve mañana a las 05:00 hora de Caracas (09:00 UTC)', () => {
    const now = new Date('2026-10-07T18:30:00Z'); // 14:30 en Caracas
    expect(finDelDiaOperativo(now, 'America/Caracas').toISOString()).toBe(
      '2026-10-08T09:00:00.000Z',
    );
  });

  it('de madrugada, vuelve ese mismo día a las 05:00', () => {
    const now = new Date('2026-10-08T06:00:00Z'); // 02:00 en Caracas
    expect(finDelDiaOperativo(now, 'America/Caracas').toISOString()).toBe(
      '2026-10-08T09:00:00.000Z',
    );
  });

  it('respeta otra zona horaria y cae a Caracas si es inválida', () => {
    const now = new Date('2026-10-07T18:30:00Z');
    expect(finDelDiaOperativo(now, 'Europe/Madrid').toISOString()).toBe(
      '2026-10-08T03:00:00.000Z',
    );
    expect(finDelDiaOperativo(now, 'No/Existe').toISOString()).toBe(
      '2026-10-08T09:00:00.000Z',
    );
  });
});

describe('isAgotadoVigente', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  it('sin fila o no agotado → disponible', () => {
    expect(isAgotadoVigente(null, now)).toBe(false);
    expect(isAgotadoVigente({ agotado: false }, now)).toBe(false);
  });
  it('sin fecha → agotado indefinido', () => {
    expect(isAgotadoVigente({ agotado: true, agotado_hasta: null }, now)).toBe(true);
  });
  it('con fecha → solo hasta que pase', () => {
    expect(isAgotadoVigente({ agotado: true, agotado_hasta: '2026-10-07T13:00:00Z' }, now)).toBe(true);
    expect(isAgotadoVigente({ agotado: true, agotado_hasta: '2026-10-07T11:00:00Z' }, now)).toBe(false);
  });
});

describe('slugifySucursal', () => {
  it('normaliza acentos, espacios y símbolos', () => {
    expect(slugifySucursal('  Altamira Centro ')).toBe('altamira-centro');
    expect(slugifySucursal('Las Mercedes / C.C. Tolón')).toBe('las-mercedes-c-c-tolon');
    expect(slugifySucursal('')).toBe('');
  });
});
