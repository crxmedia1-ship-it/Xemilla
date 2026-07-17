/**
 * Perfiles de marca (presentación UI).
 * Datos operativos del menú y gadgets vienen de Supabase.
 */

export const brandProfiles = {
  blacksushi: {
    tagline: 'Cocina japonesa contemporánea',
    logoText: 'BLACK\nSUSHI',
    logoLetter: 'B',
    /**
     * Tokens estéticos locales (fuente de verdad mientras Supabase
     * no tenga color_primario / estilo_adn / etc.).
     */
    tema: {
      color_primario: '#9f1239',
      color_fondo: '#0a0a0a',
      color_texto: '#ffffff',
      estilo_adn: 'elegant',
      tipo_letra: 'Syne, ui-sans-serif, system-ui, sans-serif',
    },
    estilos: {
      primaryColor: 'bg-zinc-950',
      surfaceColor: 'bg-zinc-950',
      panelColor: 'bg-zinc-950',
      accentColor: 'bg-white',
      accentText: 'text-white',
      textColor: 'text-white',
      mutedColor: 'text-zinc-400',
      softColor: 'text-zinc-500',
      cardColor: 'bg-zinc-900/80',
      borderColor: 'border-zinc-800',
      buttonClass: 'btn-premium',
      buttonGhost:
        'border border-white/15 bg-white/5 text-white/90 shadow-inner backdrop-blur-md hover:bg-white/10 active:scale-95',
      chipIdle: 'border border-white/15 text-zinc-400 bg-white/5 backdrop-blur-md',
      chipActive: 'border border-bs-ember/60 bg-bs-ember text-white shadow-inner',
      priceColor: 'text-white font-blacksushi-display',
      fontClass: 'font-blacksushi',
      displayClass: 'font-blacksushi-display',
      logoClass: 'tracking-[0.35em] uppercase',
    },
    nosotros: {
      titulo: 'NOSOTROS',
      bloques: [
        {
          subtitulo: 'NUESTRA FILOSOFÍA',
          titulo: 'PASIÓN POR EL DETALLE',
          tituloAcento: 'DETALLE',
          caption: '01. The Expertise',
          imagen:
            'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80',
          contenido:
            'En la cocina de BLACK SUSHI fusionamos el respeto absoluto por las técnicas tradicionales japonesas con la frescura y audacia de la gastronomía contemporánea. Cada pieza es una obra esculpida a la perfección.',
          acentos: ['BLACK SUSHI'],
        },
        {
          subtitulo: 'EL ESPACIO',
          titulo: 'EXPERIENCIA INMERSIVA',
          tituloAcento: 'INMERSIVA',
          caption: '02. The Room',
          imagen:
            'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=800&q=80',
          contenido:
            'Nuestro salón está diseñado bajo un concepto minimalista y oscuro, donde la iluminación dirigida y los acabados en piedra crean una atmósfera íntima, ideal para disfrutar de una velada multisensorial.',
          acentos: [],
        },
      ],
      texto:
        'En la cocina de BLACK SUSHI fusionamos el respeto absoluto por las técnicas tradicionales japonesas con la frescura y audacia de la gastronomía contemporánea.',
      highlights: ['NUESTRA FILOSOFÍA', 'EL ESPACIO'],
    },
    ubicacion: {
      titulo: 'UBICACIÓN Y HORARIOS',
      direccion: 'Chuao, Caracas. Venezuela.',
      ciudad: '',
      mapaLabel: 'Abrir Google Maps',
      mapaUrl: 'https://maps.google.com',
      coordenadas_maps: 'https://maps.google.com',
      /** Carrd: string multilínea → se normaliza a filas { dia, horas } */
      horarios:
        'LUN - MIE: 12:00 - 21:00\nJUE - SAB: 12:00 - 22:30\nDOMINGO: 12:00 - 20:00',
      telefono: '+584148706285',
      email: 'hola@blacksushi.com',
      instagram: 'https://instagram.com/blacksushi',
      whatsapp: '+584148706285',
    },
    wifi: {
      ssid: 'BlackSushi-Guest',
      password: 'Sushi2026!',
    },
  },

  sanza: {
    tagline: 'Cucina italiana · anima locale',
    logoText: 'SANZA',
    logoLetter: 'S',
    estilos: {
      primaryColor: 'bg-cream',
      surfaceColor: 'bg-cream',
      panelColor: 'bg-cream',
      accentColor: 'bg-sanza-ink',
      accentText: 'text-sanza-ink',
      textColor: 'text-sanza-ink',
      mutedColor: 'text-sanza-muted',
      softColor: 'text-sanza-soft',
      cardColor: 'bg-cream-elevated',
      borderColor: 'border-sanza-line',
      buttonClass: 'btn-premium',
      buttonGhost:
        'border border-sanza-gold/40 bg-white/40 text-sanza-ink shadow-inner backdrop-blur-md hover:bg-white/70 active:scale-95',
      chipIdle: 'border border-sanza-gold/35 text-sanza-muted bg-white/35 backdrop-blur-md',
      chipActive: 'border border-sanza-gold bg-sanza-ink text-cream shadow-inner',
      priceColor: 'text-sanza-ink font-sanza-display',
      fontClass: 'font-sanza',
      displayClass: 'font-sanza-display',
      logoClass: 'tracking-[0.28em] uppercase',
    },
    nosotros: {
      titulo: 'NOSOTROS',
      bloques: [
        {
          subtitulo: 'Origen',
          titulo: 'Mesa larga, tiempo propio',
          tituloAcento: 'propio',
          caption: '01. The Table',
          imagen:
            'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
          texto:
            'En el corazón de nuestra cocina late una historia: la de una familia que encontró en Italia el lenguaje del fuego lento, el pan recién horneado y la mesa generosa.',
          acentos: ['Italia'],
        },
        {
          subtitulo: 'El espacio',
          titulo: 'Hospitalidad sin prisa',
          tituloAcento: 'prisa',
          caption: '02. The Room',
          imagen:
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
          texto:
            'Sanza es ese recuerdo vuelto presente — ingredientes honestos, manos precisas y una sala pensada para quedarse.',
          acentos: ['Sanza'],
        },
      ],
      texto:
        'En el corazón de nuestra cocina late una historia: la de una familia que encontró en Italia el lenguaje del fuego lento.',
      highlights: [
        'Recetas de autor con alma italiana',
        'Producto local y de temporada',
        'Mesa larga, tiempo propio',
      ],
    },
    ubicacion: {
      titulo: 'UBICACIÓN Y HORARIOS',
      direccion: 'Calle Los Palos Grandes 45',
      ciudad: 'Caracas, Venezuela',
      mapaLabel: 'Abrir Google Maps',
      mapaUrl: 'https://maps.google.com',
      horarios: [
        { dia: 'Martes — Jueves', horas: '12:00 — 22:00' },
        { dia: 'Viernes — Sábado', horas: '12:00 — 23:30' },
        { dia: 'Domingo', horas: '12:00 — 17:00' },
      ],
      telefono: '+58 212 555 0244',
      email: 'ciao@sanza.com',
      instagram: 'https://instagram.com/sanza',
      whatsapp: '+582125550244',
    },
    wifi: {
      ssid: 'Sanza-Wifi',
      password: 'SanzaGuest',
    },
  },
};

const defaultBrand = {
  tagline: 'Experiencia CRX',
  logoText: 'CRX',
  logoLetter: 'C',
  estilos: brandProfiles.blacksushi.estilos,
  nosotros: {
    titulo: 'NOSOTROS',
    bloques: [],
    texto: 'Bienvenido a la red CRX.',
    highlights: [],
  },
  ubicacion: {
    titulo: 'UBICACIÓN Y HORARIOS',
    direccion: '',
    ciudad: '',
    mapaLabel: 'Abrir Google Maps',
    mapaUrl: 'https://maps.google.com',
    horarios: [],
    telefono: '',
    email: '',
    instagram: '',
    whatsapp: '',
  },
  wifi: {
    ssid: '',
    password: '',
  },
};

/**
 * Normaliza slug de URL → clave de brandProfiles.
 * Ej: black-sushi / Black_Sushi → blacksushi
 * @param {string} slug
 */
export function normalizeBrandSlug(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, '');
}

/**
 * Carrd string → filas para UbicacionPanel / live status.
 * @param {unknown} horarios
 * @returns {Array<{ dia: string, horas: string }>}
 */
export function normalizeHorarios(horarios) {
  if (Array.isArray(horarios)) {
    return horarios
      .map((h) => {
        if (!h || typeof h !== 'object') return null;
        const dia = String(/** @type {{ dia?: unknown }} */ (h).dia ?? '').trim();
        const horas = String(/** @type {{ horas?: unknown }} */ (h).horas ?? '').trim();
        if (!dia && !horas) return null;
        return { dia, horas };
      })
      .filter(Boolean);
  }

  if (typeof horarios !== 'string' || !horarios.trim()) return [];

  return horarios
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return { dia: '', horas: line };
      return {
        dia: line.slice(0, idx).trim(),
        horas: line.slice(idx + 1).trim(),
      };
    });
}

/**
 * @param {unknown} bloques
 */
function normalizeBloques(bloques) {
  if (!Array.isArray(bloques)) return [];
  return bloques.map((b) => {
    if (!b || typeof b !== 'object') return b;
    const texto =
      typeof b.texto === 'string' && b.texto.trim()
        ? b.texto
        : typeof b.contenido === 'string'
          ? b.contenido
          : '';
    return { ...b, texto };
  });
}

/**
 * @param {string} slug
 * @returns {boolean}
 */
export function hasLocalBrandProfile(slug) {
  const key = normalizeBrandSlug(slug);
  return Object.prototype.hasOwnProperty.call(brandProfiles, key);
}

/**
 * @param {string} slug
 */
export function getBrandProfile(slug) {
  const key = normalizeBrandSlug(slug);
  const raw = brandProfiles[key] ?? defaultBrand;
  const ubicacion = raw.ubicacion ?? defaultBrand.ubicacion;
  const mapaUrl = ubicacion.coordenadas_maps || ubicacion.mapaUrl || 'https://maps.google.com';

  return {
    ...raw,
    nosotros: {
      ...raw.nosotros,
      bloques: normalizeBloques(raw.nosotros?.bloques),
    },
    ubicacion: {
      ...ubicacion,
      mapaUrl,
      // Mantener string Carrd o array según fuente; no forzar siempre a filas
      horarios: ubicacion.horarios,
    },
  };
}
