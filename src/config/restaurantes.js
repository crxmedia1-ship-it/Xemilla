/**
 * Configuración multi-inquilino CRX.
 * Cada slug define marca, copy, menú y gadgets activos.
 */

export const restaurantes = {
  blacksushi: {
    nombre: 'Black Sushi',
    slug: 'blacksushi',
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
    menu: {
      categorias: [
        {
          id: 'entradas',
          nombre: 'Entradas',
          platos: [
            {
              nombre: 'Edamame Sal',
              descripcion: 'Vainas de soja al vapor con sal marina y toque de yuzu.',
              precio: '8',
            },
            {
              nombre: 'Gyoza de Cerdo',
              descripcion: 'Dumplings crocantes, cebollín y salsa tare.',
              precio: '12',
            },
            {
              nombre: 'Tuna Tartare',
              descripcion: 'Atún fresco, aguacate, aji amarillo y chips de wonton.',
              precio: '16',
            },
          ],
        },
        {
          id: 'ensaladas',
          nombre: 'Ensaladas',
          platos: [
            {
              nombre: 'Sunomono',
              descripcion: 'Pepino, wakame y vinagreta ligera de arroz.',
              precio: '9',
            },
            {
              nombre: 'Black Seaweed',
              descripcion: 'Algas mixtas, sésamo tostado y aceite de chile.',
              precio: '11',
            },
          ],
        },
        {
          id: 'fuertes',
          nombre: 'Platos Fuertes',
          platos: [
            {
              nombre: 'Nigiri Selection',
              descripcion: 'Selección del chef: 8 piezas de pescado del día.',
              precio: '28',
            },
            {
              nombre: 'Dragon Black Roll',
              descripcion: 'Anguila, aguacate, tobiko y glaze agridulce.',
              precio: '22',
            },
            {
              nombre: 'Wagyu Tataki',
              descripcion: 'Sellado breve, ponzu, cebollín y trufa ligera.',
              precio: '34',
            },
          ],
        },
        {
          id: 'bebidas',
          nombre: 'Bebidas',
          platos: [
            {
              nombre: 'Sake Junmai',
              descripcion: 'Notas limpias, cuerpo medio. Servido frío.',
              precio: '14',
            },
            {
              nombre: 'Yuzu Spritz',
              descripcion: 'Yuzu, espumante seco y bitter cítrico.',
              precio: '12',
            },
            {
              nombre: 'Té Hojicha',
              descripcion: 'Tostado, aromático, sin azúcar.',
              precio: '6',
            },
          ],
        },
      ],
    },
    gadgets: {
      wifi: true,
      dividirCuenta: false,
    },
    wifi: {
      ssid: 'BlackSushi-Guest',
      password: 'Sushi2026!',
    },
  },

  sanza: {
    nombre: 'Sanza',
    slug: 'sanza',
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
    menu: {
      categorias: [
        {
          id: 'entradas',
          nombre: 'Entradas',
          platos: [
            {
              nombre: 'Burrata & Pomodoro',
              descripcion: 'Burrata cremosa, tomate heirloom, albahaca y aceite novello.',
              precio: '16',
            },
            {
              nombre: 'Carpaccio Sanza',
              descripcion: 'Res fina, rúcula silvestre, parmesano y limón confitado.',
              precio: '18',
            },
            {
              nombre: 'Focaccia del Horno',
              descripcion: 'Masa lenta, romero, flor de sal y aceite de oliva.',
              precio: '9',
            },
          ],
        },
        {
          id: 'ensaladas',
          nombre: 'Ensaladas',
          platos: [
            {
              nombre: 'Insalata di Stagione',
              descripcion: 'Hojas de temporada, semillas tostadas y vinagreta cítrica.',
              precio: '12',
            },
            {
              nombre: 'Panzanella',
              descripcion: 'Pan tostado, tomate, pepino, cebolla morada y alcaparras.',
              precio: '13',
            },
          ],
        },
        {
          id: 'fuertes',
          nombre: 'Platos Fuertes',
          platos: [
            {
              nombre: 'Tagliatelle al Ragù',
              descripcion: 'Pasta fresca, ragù lento de res y parmigiano 24 meses.',
              precio: '24',
            },
            {
              nombre: 'Branzino al Limone',
              descripcion: 'Lubina a la plancha, limón, hierbas y verduras asadas.',
              precio: '29',
            },
            {
              nombre: 'Ossobuco Sanza',
              descripcion: 'Cocción lenta, gremolata y risotto alla milanese.',
              precio: '32',
            },
          ],
        },
        {
          id: 'bebidas',
          nombre: 'Bebidas',
          platos: [
            {
              nombre: 'Negroni House',
              descripcion: 'Gin, vermut rosso y Campari. Equilibrado y seco.',
              precio: '14',
            },
            {
              nombre: 'Vino Della Casa',
              descripcion: 'Copa de tinto o blanco seleccionado por el sommelier.',
              precio: '11',
            },
            {
              nombre: 'Limonata Fresca',
              descripcion: 'Limón, hierbabuena y agua con gas.',
              precio: '7',
            },
          ],
        },
      ],
    },
    gadgets: {
      wifi: false,
      dividirCuenta: true,
    },
    wifi: {
      ssid: 'Sanza-Wifi',
      password: 'SanzaGuest',
    },
  },
};

/**
 * @param {string | undefined} slug
 * @returns {typeof restaurantes[keyof typeof restaurantes] | null}
 */
export function getRestaurante(slug) {
  if (!slug || !(slug in restaurantes)) return null;
  return restaurantes[slug];
}

export const slugs = Object.keys(restaurantes);
