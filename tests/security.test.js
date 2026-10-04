import { describe, expect, it } from 'vitest';
import { jsonForScript } from '../src/lib/safe-json.js';
import { sanitizeCssAvanzado } from '../src/lib/secciones-ui.js';
import { escapeHtml, renderBodyHtml, renderTitleHtml } from '../src/lib/nosotros-layout.js';
import {
  getAssignedRestauranteId,
  getUserAdminRole,
  isSuperAdminUser,
} from '../src/config/superadmin.js';

const XSS = '</script><script>alert(1)</script>';

describe('jsonForScript', () => {
  it('no permite cerrar la etiqueta <script>', () => {
    const out = jsonForScript({ ingredientes: XSS });
    expect(out).not.toContain('<');
    expect(JSON.parse(out).ingredientes).toBe(XSS);
  });

  it('serializa null/undefined sin romper', () => {
    expect(jsonForScript(undefined)).toBe('null');
  });
});

describe('sanitizeCssAvanzado', () => {
  it('elimina cualquier "<" para no cerrar <style>', () => {
    expect(sanitizeCssAvanzado('a{}</style><script>x</script>')).not.toContain('<');
  });

  it('bloquea @import, javascript: y expression()', () => {
    const out = sanitizeCssAvanzado(
      '@import url(https://evil.test/x.css); a{background:url(javascript:alert(1));width:expression(alert(1))}',
    );
    expect(out).not.toMatch(/@import/i);
    expect(out).not.toMatch(/javascript\s*:/i);
    expect(out).not.toMatch(/expression\s*\(/i);
  });

  it('conserva CSS normal', () => {
    const css = '.titulo { color: #fff; background: url(https://res.cloudinary.com/x.jpg); }';
    expect(sanitizeCssAvanzado(css)).toBe(css);
  });
});

describe('textos de Nosotros', () => {
  it('escapeHtml neutraliza etiquetas', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).not.toContain('<img');
  });

  it('el acento no reintroduce HTML', () => {
    const html = renderTitleHtml('<b>Hola</b> mundo', '<b>');
    expect(html).not.toContain('<b>');
    expect(renderBodyHtml(XSS, ['script'])).not.toContain('<script');
  });
});

describe('roles de admin', () => {
  const operativo = {
    email: 'local@example.com',
    app_metadata: { role: 'admin_operativo', restaurante_id: 'rest-1' },
    user_metadata: {},
  };

  it('user_metadata nunca otorga SuperAdmin (lo edita el propio usuario)', () => {
    const atacante = { ...operativo, user_metadata: { role: 'superadmin' } };
    expect(isSuperAdminUser(atacante)).toBe(false);
    expect(getUserAdminRole(atacante)).toBe('admin_operativo');
  });

  it('app_metadata.role = superadmin sí otorga SuperAdmin', () => {
    const user = { email: 'x@example.com', app_metadata: { role: 'superadmin' } };
    expect(isSuperAdminUser(user)).toBe(true);
  });

  it('el restaurante asignado solo sale de app_metadata', () => {
    expect(getAssignedRestauranteId(operativo)).toBe('rest-1');
    const atacante = {
      app_metadata: {},
      user_metadata: { restaurante_id: 'rest-de-otro' },
    };
    expect(getAssignedRestauranteId(atacante)).toBeNull();
  });

  it('sin usuario no hay privilegios', () => {
    expect(isSuperAdminUser(null)).toBe(false);
    expect(getAssignedRestauranteId(null)).toBeNull();
  });
});
