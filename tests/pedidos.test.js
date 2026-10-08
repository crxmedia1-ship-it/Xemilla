import { describe, expect, it } from 'vitest';
import {
  buildMensajePedido,
  generarCodigoPedido,
  normalizeConfigPedidos,
  normalizePlatoOpciones,
  resolverSeleccion,
  validarDatosPedido,
  waNumero,
} from '../src/lib/pedidos.js';

const grupos = normalizePlatoOpciones([
  {
    id: 'tam',
    nombre: 'Tamaño',
    requerido: true,
    max: 1,
    opciones: [
      { id: 's', nombre: 'Small', precio: 0 },
      { id: 'd', nombre: 'Doble', precio: '2,5' },
    ],
  },
  {
    id: 'ext',
    nombre: 'Extras',
    max: 2,
    opciones: [
      { id: 'q', nombre: 'Queso', precio: 1 },
      { id: 't', nombre: 'Tocineta', precio: 1.5 },
      { id: 'h', nombre: 'Huevo', precio: 0.75 },
    ],
  },
]);

describe('normalizePlatoOpciones', () => {
  it('descarta grupos sin nombre u opciones y basura', () => {
    const out = normalizePlatoOpciones([
      { nombre: '', opciones: [{ nombre: 'x' }] },
      { nombre: 'Vacío', opciones: [] },
      null,
      'texto',
      { nombre: 'Salsa', opciones: [{ nombre: 'BBQ', precio: -3 }, { nombre: '' }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].opciones).toEqual([{ id: 'o1', nombre: 'BBQ', precio: 0 }]);
    expect(out[0].max).toBe(1);
  });

  it('acepta JSON en texto y limita max al número de opciones', () => {
    const out = normalizePlatoOpciones('[{"nombre":"A","max":9,"opciones":[{"nombre":"x"},{"nombre":"y"}]}]');
    expect(out[0].max).toBe(2);
  });

  it('no repite ids', () => {
    const out = normalizePlatoOpciones([
      { id: 'g', nombre: 'A', opciones: [{ id: 'o', nombre: 'x' }, { id: 'o', nombre: 'y' }] },
      { id: 'g', nombre: 'B', opciones: [{ nombre: 'z' }] },
    ]);
    expect(out[0].opciones.map((o) => o.id)).toEqual(['o', 'ox']);
    expect(out.map((g) => g.id)).toEqual(['g', 'gx']);
  });
});

describe('resolverSeleccion', () => {
  it('suma los recargos y arma el detalle', () => {
    const r = resolverSeleccion(grupos, { tam: 'd', ext: ['q', 't'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.extra).toBe(5);
    expect(r.detalle).toEqual([
      { grupo: 'Tamaño', opciones: ['Doble'] },
      { grupo: 'Extras', opciones: ['Queso', 'Tocineta'] },
    ]);
  });

  it('exige los grupos requeridos', () => {
    expect(resolverSeleccion(grupos, {}).ok).toBe(false);
  });

  it('rechaza más opciones que el máximo', () => {
    expect(resolverSeleccion(grupos, { tam: 's', ext: ['q', 't', 'h'] }).ok).toBe(false);
  });

  it('rechaza opciones que no existen (precio manipulado)', () => {
    expect(resolverSeleccion(grupos, { tam: 'gratis' }).ok).toBe(false);
  });
});

describe('normalizeConfigPedidos', () => {
  it('sin configuración activa todos los modos', () => {
    const c = normalizeConfigPedidos(null);
    expect(c.modos).toEqual({ mesa: true, delivery: true, pickup: true });
    expect(c.cedula).toBe('opcional');
    expect(c.metodos_pago).toEqual([]);
  });

  it('nunca deja todos los modos apagados', () => {
    const c = normalizeConfigPedidos({ modos: { mesa: false, delivery: false, pickup: false } });
    expect(c.modos.mesa).toBe(true);
  });

  it('normaliza métodos de pago desconocidos a «otro»', () => {
    const c = normalizeConfigPedidos({ metodos_pago: [{ tipo: 'cripto-raro', datos: 'a\r\nb' }] });
    expect(c.metodos_pago[0]).toMatchObject({ tipo: 'otro', nombre: 'Otro', datos: 'a\nb' });
  });
});

describe('validarDatosPedido', () => {
  const config = normalizeConfigPedidos({
    modos: { mesa: true, delivery: true, pickup: false },
    cedula: 'obligatoria',
    metodos_pago: [{ id: 'pm', tipo: 'pago_movil', datos: '0414' }],
  });

  it('en mesa solo pide el número de mesa', () => {
    const r = validarDatosPedido({ modo: 'mesa', mesa: '7' }, config);
    expect(r.ok).toBe(true);
  });

  it('rechaza un modo apagado', () => {
    expect(validarDatosPedido({ modo: 'pickup' }, config).ok).toBe(false);
  });

  it('delivery exige nombre, teléfono, cédula, dirección y pago', () => {
    const base = {
      modo: 'delivery',
      cliente: { nombre: 'Ana', telefono: '0414-1234567', cedula: 'v12.345.678', direccion: 'Av. 1' },
      metodo_pago: 'pm',
      referencia: '1234',
    };
    const r = validarDatosPedido(base, config);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.cliente.cedula).toBe('V-12345678');
    expect(validarDatosPedido({ ...base, cliente: { ...base.cliente, direccion: '' } }, config).ok).toBe(false);
    expect(validarDatosPedido({ ...base, cliente: { ...base.cliente, cedula: '' } }, config).ok).toBe(false);
    expect(validarDatosPedido({ ...base, metodo_pago: '' }, config).ok).toBe(false);
    expect(validarDatosPedido({ ...base, metodo_pago: 'otro-id' }, config).ok).toBe(false);
  });
});

describe('waNumero', () => {
  it('convierte número local venezolano', () => {
    expect(waNumero('0414-123.45.67')).toBe('584141234567');
    expect(waNumero('+4148601793')).toBe('584148601793');
  });
  it('lee URLs de wa.me y api.whatsapp.com', () => {
    expect(waNumero('https://wa.me/584141234567?text=hola')).toBe('584141234567');
    expect(waNumero('https://api.whatsapp.com/send?phone=584141234567')).toBe('584141234567');
  });
  it('descarta valores inválidos', () => {
    expect(waNumero('abc')).toBe('');
    expect(waNumero('')).toBe('');
  });
});

describe('mensaje de WhatsApp', () => {
  it('incluye código, líneas, total en Bs y datos del cliente', () => {
    const config = normalizeConfigPedidos({ metodos_pago: [{ id: 'z', tipo: 'zelle' }] });
    const r = validarDatosPedido(
      { modo: 'delivery', cliente: { nombre: 'Ana', telefono: '04141234567', direccion: 'Calle 2' }, metodo_pago: 'z', referencia: 'ABC' },
      config,
    );
    if (!r.ok) throw new Error(r.error);
    const msg = buildMensajePedido({
      codigo: 'K7P2',
      restaurante: 'American Grill',
      sucursal: 'La Campiña',
      datos: r.datos,
      lineas: [{ nombre: 'Burger', cantidad: 2, unitario: 10, total: 20, detalle: [{ grupo: 'Tamaño', opciones: ['Doble'] }], nota: 'sin cebolla' }],
      totalUsd: 20,
      tasaBcv: 100,
    });
    expect(msg).toContain('*Pedido #K7P2* — American Grill · La Campiña');
    expect(msg).toContain('2× Burger — $20.00');
    expect(msg).toContain('• Tamaño: Doble');
    expect(msg).toContain('Bs. 2.000,00');
    expect(msg).toContain('💳 Zelle');
    expect(msg).toContain('🔖 Ref. ABC');
  });

  it('genera códigos de 4 caracteres sin ambigüedades', () => {
    const code = generarCodigoPedido();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });
});
