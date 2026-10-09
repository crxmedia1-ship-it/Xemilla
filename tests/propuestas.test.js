import { describe, expect, it } from 'vitest';
import { readPropuestaAdicionales } from '../src/lib/propuestas.js';

describe('readPropuestaAdicionales', () => {
  it('guarda solo montos de los adicionales conocidos', () => {
    expect(
      readPropuestaAdicionales({
        ar: '150',
        nutri: '',
        qr: '80 USD',
        shop: '12,5',
        otro: '999',
      }),
    ).toEqual({
      ar: '150',
      qr: '80',
      shop: '12,5',
    });
  });

  it('un valor vacío deja el adicional a consultar', () => {
    expect(readPropuestaAdicionales(null)).toEqual({});
    expect(readPropuestaAdicionales({ loyalty: '   ' })).toEqual({});
  });
});
