/**
 * Perfiles de marca (presentación UI).
 * Datos operativos del menú y gadgets vienen de Supabase.
 */

export const brandProfiles = {
  blacksushi: {
    tagline: 'Cocina japonesa contemporánea',
    logoText: 'BLACK\nSUSHI',
    logoLetter: 'B',
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
      texto:
        'En Black Sushi cada corte es un gesto preciso. Fusionamos tradición japonesa con un lenguaje contemporáneo: ingredientes de temporada, técnica limpia y una atmósfera íntima pensada para la noche.',
      highlights: [
        'Ingredientes seleccionados a diario',
        'Barra de nigiri y rolls de autor',
        'Experiencia de mesa íntima',
      ],
    },
    ubicacion: {
      titulo: 'UBICACIÓN Y HORARIOS',
      direccion: 'Av. Principal 128, Zona Gourmet',
      ciudad: 'Caracas, Venezuela',
      mapaLabel: 'Cómo llegar',
      mapaUrl: 'https://maps.google.com',
      horarios: [
        { dia: 'Lun — Jue', horas: '12:00 — 22:30' },
        { dia: 'Vie — Sáb', horas: '12:00 — 00:00' },
        { dia: 'Domingo', horas: '13:00 — 21:00' },
      ],
      telefono: '+58 212 555 0190',
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
      texto:
        'En el corazón de nuestra cocina late una historia: la de una familia que encontró en Italia el lenguaje del fuego lento, el pan recién horneado y la mesa generosa. Sanza es ese recuerdo vuelto presente — ingredientes honestos, manos precisas y hospitalidad sin prisa.',
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
      mapaLabel: 'Abrir en Maps',
      mapaUrl: 'https://maps.google.com',
      horarios: [
        { dia: 'Martes — Jueves', horas: '12:00 — 22:00' },
        { dia: 'Viernes — Sábado', horas: '12:00 — 23:30' },
        { dia: 'Domingo', horas: '12:00 — 17:00' },
      ],
      telefono: '+58 212 555 0244',
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
    texto: 'Bienvenido a la red CRX.',
    highlights: [],
  },
  ubicacion: {
    titulo: 'UBICACIÓN Y HORARIOS',
    direccion: '',
    ciudad: '',
    mapaLabel: 'Cómo llegar',
    mapaUrl: 'https://maps.google.com',
    horarios: [],
    telefono: '',
  },
  wifi: {
    ssid: '',
    password: '',
  },
};

/**
 * @param {string} slug
 */
export function getBrandProfile(slug) {
  return brandProfiles[slug] ?? defaultBrand;
}
