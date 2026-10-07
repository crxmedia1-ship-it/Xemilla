  const CHIP_BASE =
    'menu-chip border px-4 py-2 text-[0.62rem] font-semibold tracking-[0.2em] uppercase active:scale-95';

  const AUTOPLAY_MS = 7200;
  const FADE_MS = 7200;
  const HIGHLIGHT_MS = 1100;
  /** px/s — crucero lento */
  const MARQUEE_BASE_PX_PER_SEC = 26;
  const MARQUEE_VEL_MAX = 920;

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isPhoneMenu = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;

  /**
   * Carrusel continuo vía transform (no scrollLeft — Safari iOS lo ignora
   * dentro de paneles). Arrastra en móvil = boost de velocidad.
   * @param {HTMLElement} track
   */
  function initDestacadosMarquee(track) {
    if (track.dataset.marqueeReady === 'true') return;
    if (prefersReducedMotion()) return;

    const seed = Array.from(track.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        el.classList.contains('menu-featured') &&
        !el.dataset.marqueeClone,
    );
    if (seed.length < 2) return;
    track.dataset.marqueeReady = 'true';

    const rail = document.createElement('div');
    rail.dataset.destacadosRail = '';
    rail.style.display = 'flex';
    rail.style.flexDirection = 'row';
    rail.style.flexWrap = 'nowrap';
    rail.style.alignItems = 'stretch';
    rail.style.gap = '0.75rem';
    rail.style.width = 'max-content';
    rail.style.willChange = 'transform';
    while (track.firstChild) {
      rail.appendChild(track.firstChild);
    }
    const phone = isPhoneMenu();
    const lockCard = (card: HTMLElement) => {
      card.style.flex = '0 0 auto';
      card.style.width = phone ? 'min(82vw, 20rem)' : 'min(16rem, 34vw)';
      card.style.maxWidth = 'none';
    };
    seed.forEach(lockCard);
    seed.forEach((card) => {
      const clone = /** @type {HTMLElement} */ (card.cloneNode(true));
      clone.dataset.marqueeClone = '1';
      clone.setAttribute('aria-hidden', 'true');
      clone.tabIndex = -1;
      lockCard(clone);
      rail.appendChild(clone);
    });
    track.appendChild(rail);

    let loopWidth = 0;
    let offset = 0;
    /** px/s. Positivo = avanza a la izquierda (crucero). */
    let velocity = MARQUEE_BASE_PX_PER_SEC;
    let pointerDown = false;
    let axisLocked = false;
    let visible = true;
    let lastTs = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let lastPointerT = 0;
    let moved = false;

    const apply = () => {
      rail.style.transform = `translate3d(${(-offset).toFixed(2)}px, 0, 0)`;
    };

    const measure = () => {
      const first = seed[0];
      const firstClone = rail.querySelector<HTMLElement>('.menu-featured[data-marquee-clone]');
      if (first && firstClone) {
        loopWidth = Math.max(0, firstClone.offsetLeft - first.offsetLeft);
      } else {
        loopWidth = Math.max(0, rail.scrollWidth / 2);
      }
    };

    const wrapOffset = () => {
      if (loopWidth <= 0) return;
      offset = ((offset % loopWidth) + loopWidth) % loopWidth;
    };

    const easeVelocity = (dt: number) => {
      const k = 1 - Math.exp(-dt * 1.35);
      velocity += (MARQUEE_BASE_PX_PER_SEC - velocity) * k;
      if (Math.abs(velocity - MARQUEE_BASE_PX_PER_SEC) < 0.4) {
        velocity = MARQUEE_BASE_PX_PER_SEC;
      }
    };

    const tick = (ts: number) => {
      if (!lastTs) lastTs = ts;
      const dt = Math.min(0.032, (ts - lastTs) / 1000);
      lastTs = ts;

      if (!document.hidden && visible && !pointerDown && loopWidth > 0) {
        offset += velocity * dt;
        wrapOffset();
        apply();
        easeVelocity(dt);
      }

      window.requestAnimationFrame(tick);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerDown = true;
      axisLocked = false;
      moved = false;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastPointerT = performance.now();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      const now = performance.now();
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      const dt = Math.max(8, now - lastPointerT) / 1000;

      if (!axisLocked) {
        if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          pointerDown = false;
          return;
        }
        axisLocked = true;
        moved = true;
        track.classList.add('is-dragging');
        try {
          track.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }

      offset -= dx;
      wrapOffset();
      apply();
      const inst = -dx / dt;
      velocity = velocity * 0.35 + inst * 0.65;
      velocity = Math.max(-MARQUEE_VEL_MAX, Math.min(MARQUEE_VEL_MAX, velocity));
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      lastPointerT = now;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDown && !axisLocked) return;
      pointerDown = false;
      track.classList.remove('is-dragging');
      try {
        track.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!axisLocked) velocity = MARQUEE_BASE_PX_PER_SEC;
      axisLocked = false;
      measure();
    };

    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove, { passive: true });
    track.addEventListener('pointerup', onPointerUp);
    track.addEventListener('pointercancel', onPointerUp);

    // Evitar click accidental tras drag
    track.addEventListener(
      'click',
      (e) => {
        if (!moved) return;
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      },
      true,
    );

    track.addEventListener(
      'wheel',
      (e) => {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(delta) < 1) return;
        offset += delta;
        wrapOffset();
        apply();
        const kick = Math.max(-MARQUEE_VEL_MAX, Math.min(MARQUEE_VEL_MAX, delta * 18));
        velocity = Math.max(-MARQUEE_VEL_MAX, Math.min(MARQUEE_VEL_MAX, velocity * 0.5 + kick));
      },
      { passive: true },
    );

    const onFilterSync = () => {
      const byId = new Map();
      seed.forEach((card) => {
        byId.set(card.dataset.gotoPlato || '', card.classList.contains('is-alergia-hidden'));
      });
      rail.querySelectorAll<HTMLElement>('.menu-featured[data-marquee-clone]').forEach((clone) => {
        const hide = byId.get(clone.dataset.gotoPlato || '') === true;
        clone.classList.toggle('is-alergia-hidden', hide);
      });
      window.requestAnimationFrame(() => {
        measure();
        wrapOffset();
        apply();
      });
    };
    track.addEventListener('destacados:filter', onFilterSync);

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            measure();
            wrapOffset();
            apply();
          })
        : null;
    ro?.observe(track);
    ro?.observe(rail);

    // Remedir al abrir el panel (init suele correr con menú cerrado)
    const section = track.closest('[data-section], [data-destacados]');
    const panelHost = track.closest('[data-section]') || track.closest('.menu-panel');
    if (panelHost && typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(() => {
        const open =
          panelHost instanceof HTMLElement &&
          (panelHost.dataset.open === 'true' ||
            panelHost.closest('[data-section]')?.getAttribute('data-open') === 'true');
        if (open) {
          visible = true;
          lastTs = 0;
          window.requestAnimationFrame(() => {
            measure();
            apply();
          });
        }
      });
      const observed =
        track.closest('[data-section]') || panelHost;
      if (observed) {
        mo.observe(observed, { attributes: true, attributeFilter: ['data-open', 'class', 'aria-hidden'] });
      }
    }

    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          visible = Boolean(entry?.isIntersecting);
          if (visible) {
            lastTs = 0;
            measure();
            apply();
          }
        },
        { threshold: 0.05 },
      );
      io.observe(section instanceof HTMLElement ? section : track);
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        lastTs = 0;
        measure();
      }
    });

    // Doble rAF: layout estable tras abrir/hidratar
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        measure();
        apply();
        lastTs = 0;
        window.requestAnimationFrame(tick);
      });
    });
  }

  /**
   * @param {HTMLElement} track
   */
  function initDestacadosAutoplay(track) {
    if (track.dataset.autoplayReady === 'true') return;
    if (prefersReducedMotion()) return;
    const cards = Array.from(track.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    if (cards.length < 2) return;
    track.dataset.autoplayReady = 'true';

    let index = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const nearestIndex = () => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      cards.forEach((card, i) => {
        const center = card.offsetLeft + card.offsetWidth / 2;
        const dist = Math.abs(center - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      return best;
    };

    const goTo = (i: number) => {
      index = ((i % cards.length) + cards.length) % cards.length;
      const card = cards[index];
      if (!card) return;
      const left = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
      track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    };

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const start = () => {
      stop();
      timer = setInterval(() => {
        if (document.hidden) return;
        goTo(index + 1);
      }, AUTOPLAY_MS);
    };

    const resetFromUser = () => {
      stop();
      if (resumeTimer) clearTimeout(resumeTimer);
      index = nearestIndex();
      resumeTimer = setTimeout(() => {
        index = nearestIndex();
        start();
      }, 700);
    };

    track.addEventListener('pointerdown', resetFromUser);
    track.addEventListener('touchstart', resetFromUser, { passive: true });
    track.addEventListener('wheel', resetFromUser, { passive: true });

    let scrollDebounce: ReturnType<typeof setTimeout> | null = null;
    track.addEventListener(
      'scroll',
      () => {
        if (scrollDebounce) clearTimeout(scrollDebounce);
        scrollDebounce = setTimeout(() => {
          index = nearestIndex();
        }, 100);
      },
      { passive: true },
    );

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else start();
    });

    start();
  }

  /**
   * @param {HTMLElement} track
   */
  function initDestacadosFade(track) {
    if (track.dataset.fadeReady === 'true') return;
    const cards = Array.from(track.querySelectorAll('.menu-featured')).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    if (!cards.length) return;
    track.dataset.fadeReady = 'true';

    const visibleCards = () =>
      cards.filter((card) => !card.classList.contains('is-alergia-hidden'));

    let index = 0;
    /** @type {ReturnType<typeof setInterval> | null} */
    let timer = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let resumeTimer = null;

    const showAt = (nextIndex: number) => {
      const visible = visibleCards();
      if (!visible.length) return;
      index = ((nextIndex % visible.length) + visible.length) % visible.length;
      const active = visible[index];
      cards.forEach((card) => {
        const on = card === active;
        card.classList.toggle('is-active', on);
        card.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
    };

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const start = () => {
      if (prefersReducedMotion()) return;
      stop();
      timer = setInterval(() => {
        if (document.hidden) return;
        showAt(index + 1);
      }, FADE_MS);
    };

    const pauseFromUser = () => {
      stop();
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(start, 1200);
    };

    track.addEventListener('pointerdown', pauseFromUser);
    track.addEventListener('touchstart', pauseFromUser, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else start();
    });

    showAt(0);
    start();
  }

  /**
   * @param {HTMLElement} panel
   * @param {Element | null} scrollRoot
   */
  function initScrollReveal(panel, scrollRoot) {
    const items = panel.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    if (typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('is-inview'));
      return;
    }

    const rootEl = scrollRoot instanceof Element ? scrollRoot : null;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-inview');
          io.unobserve(entry.target);
        }
      },
      {
        root: rootEl,
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.12,
      },
    );

    items.forEach((el) => io.observe(el));
  }

  /**
   * @param {HTMLElement} target
   */
  function pulsePlatoFocus(target) {
    target.classList.add('is-inview');
    target.classList.remove('is-focus-plato');
    void target.offsetWidth;
    target.classList.add('is-focus-plato');
    setTimeout(() => {
      target.classList.remove('is-focus-plato');
    }, HIGHLIGHT_MS);
  }

  function initMenuPanels() {
    document.querySelectorAll('[data-menu-panel]').forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      if (panel.dataset.ready === 'true') return;
      panel.dataset.ready = 'true';

      const buttons = panel.querySelectorAll('[data-cat-filter]');
      const sections = panel.querySelectorAll('[data-menu-cat]');
      const destacados = panel.querySelector('[data-destacados]');
      const track = panel.querySelector('[data-destacados-track]');
      const sectionEl = panel.closest('[data-section]');
      const scrollRoot =
        sectionEl?.querySelector('.panel-scroll-root') ?? null;
      const isHubNav = panel.dataset.menuNavegacion === 'hub_categories';
      const hubNav = panel.querySelector('[data-menu-hub-nav]');
      const hubTitle = panel.querySelector('[data-menu-hub-title]');
      const hubSection = panel.querySelector('[data-menu-hub]');
      const appRoot = panel.closest('[data-restaurant-app]');
      const restauranteId =
        appRoot instanceof HTMLElement ? appRoot.dataset.restauranteId || '' : '';
      const hubSessionKey = restauranteId
        ? `xemilla:menu-hub-cat:${restauranteId}`
        : 'xemilla:menu-hub-cat';

      const clearHubSession = () => {
        if (typeof sessionStorage === 'undefined') return;
        sessionStorage.removeItem(hubSessionKey);
      };

      const shouldSyncCategoryBg = () => {
        if (typeof window === 'undefined') return true;
        return !window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
      };

      /** @param {'home' | 'detail'} view */
      const setHubView = (view: 'home' | 'detail') => {
        panel.dataset.hubView = view;
        if (hubNav instanceof HTMLElement) {
          hubNav.setAttribute('aria-hidden', view === 'detail' ? 'false' : 'true');
        }
        if (view === 'home' && scrollRoot instanceof HTMLElement) {
          scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };

      /**
       * @param {string} catId
       * @param {string} [catName]
       */
      const openHubCategory = (catId: string, catName = '') => {
        if (!catId) return;
        sections.forEach((section) => {
          if (!(section instanceof HTMLElement)) return;
          const match = section.dataset.menuCat === catId;
          section.classList.toggle('is-hidden', !match);
          section.setAttribute('aria-hidden', match ? 'false' : 'true');
        });
        if (destacados instanceof HTMLElement) {
          destacados.classList.add('is-hidden');
        }
        if (hubTitle instanceof HTMLElement) {
          hubTitle.textContent = catName || catId;
        }
        panel.dataset.menuFilter = catId;
        emitCategory(catId);
        setHubView('detail');
        if (scrollRoot instanceof HTMLElement) {
          scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
        }
        initScrollReveal(panel, scrollRoot);
      };

      const closeHubCategory = () => {
        sections.forEach((section) => {
          if (!(section instanceof HTMLElement)) return;
          section.classList.add('is-hidden');
          section.setAttribute('aria-hidden', 'true');
        });
        if (destacados instanceof HTMLElement) {
          destacados.classList.remove('is-hidden');
        }
        if (hubTitle instanceof HTMLElement) {
          hubTitle.textContent = '';
        }
        panel.dataset.menuFilter = 'hub';
        emitCategory('all', false);
        setHubView('home');
        clearHubSession();
      };

      const paintChips = (activeId: string) => {
        buttons.forEach((btn) => {
          if (!(btn instanceof HTMLElement)) return;
          const active = btn.dataset.catFilter === activeId;
          btn.className = `tab-categoria menu-chip ${CHIP_BASE}`;
          btn.classList.toggle('is-active', active);
        });
      };

      const emitCategory = (id: string, asFilter = true) => {
        if (asFilter) panel.dataset.menuFilter = id;
        document.dispatchEvent(
          new CustomEvent('xemilla:menu-category', { detail: { id } }),
        );
      };

      const filterByCategory = (id: string) => {
        const showAll = id === 'all';
        sections.forEach((section) => {
          if (!(section instanceof HTMLElement)) return;
          const match = showAll || section.dataset.menuCat === id;
          section.classList.toggle('is-hidden', !match);
          section.setAttribute('aria-hidden', match ? 'false' : 'true');
        });
        if (destacados instanceof HTMLElement) {
          destacados.classList.toggle('is-hidden', !showAll);
        }
        paintChips(id);
        emitCategory(id);

        if (panel.dataset.chipsLayout === 'scroll') {
          const activeChip = panel.querySelector(`[data-cat-filter="${id}"]`);
          if (activeChip instanceof HTMLElement) {
            activeChip.scrollIntoView({
              behavior: 'smooth',
              inline: 'center',
              block: 'nearest',
            });
          }
        }
      };

      // Al scrollear con "Todos", cambia el fondo según la categoría visible (solo desktop)
      if (
        typeof IntersectionObserver !== 'undefined' &&
        scrollRoot &&
        !isHubNav &&
        shouldSyncCategoryBg()
      ) {
        /** @type {ReturnType<typeof setTimeout> | null} */
        let catBgTimer = null;
        let lastCatBg = '';
        const catIo = new IntersectionObserver(
          (entries) => {
            const allChip = panel.querySelector('[data-cat-filter="all"]');
            const allActive =
              allChip instanceof HTMLElement && allChip.classList.contains('is-active');
            if (!allActive) return;
            const visible = entries
              .filter((e) => e.isIntersecting)
              .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!visible || !(visible.target instanceof HTMLElement)) return;
            const catId = visible.target.dataset.menuCat || '';
            if (!catId || catId === lastCatBg) return;
            if (catBgTimer) clearTimeout(catBgTimer);
            catBgTimer = setTimeout(() => {
              lastCatBg = catId;
              emitCategory(catId, false);
            }, 120);
          },
          {
            root: scrollRoot instanceof Element ? scrollRoot : null,
            threshold: [0.35, 0.55],
            rootMargin: '-18% 0px -50% 0px',
          },
        );
        sections.forEach((section) => catIo.observe(section));
      }

      /**
       * @param {string} platoId
       * @param {string} catId
       */
      const goToPlato = (platoId, catId) => {
        if (!platoId) return;
        const filterId = catId || 'all';
        if (isHubNav && catId) {
          const hubBtn = panel.querySelector(`[data-hub-cat="${CSS.escape(catId)}"]`);
          const catLabel =
            hubBtn instanceof HTMLElement ? hubBtn.dataset.hubCatName || '' : '';
          openHubCategory(catId, catLabel);
        } else {
          filterByCategory(filterId);
        }

        const target = panel.querySelector(`#plato-${CSS.escape(platoId)}`);
        if (!(target instanceof HTMLElement)) return;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            pulsePlatoFocus(target);
          });
        });
      };

      if (isHubNav) {
        panel.querySelectorAll('[data-hub-cat]').forEach((btn) => {
          btn.addEventListener('click', () => {
            if (!(btn instanceof HTMLElement)) return;
            const id = btn.dataset.hubCat || '';
            const name = btn.dataset.hubCatName || '';
            if (!id) return;
            openHubCategory(id, name);
          });
        });

        panel.querySelector('[data-menu-hub-back]')?.addEventListener('click', () => {
          closeHubCategory();
        });

        panel.addEventListener('xemilla:hub-restore', (e) => {
          const detail = (e as CustomEvent<{ catId?: string; catName?: string }>).detail;
          if (detail?.catId) {
            openHubCategory(detail.catId, detail.catName || '');
          }
        });

        const resetMenuPanel = () => {
          closeHubCategory();
          if (scrollRoot instanceof HTMLElement) {
            scrollRoot.scrollTo({ top: 0, behavior: 'auto' });
          }
        };

        panel.addEventListener('xemilla:hub-reset', () => resetMenuPanel());
        panel.addEventListener('xemilla:menu-reset', () => resetMenuPanel());

        sections.forEach((section) => {
          if (!(section instanceof HTMLElement)) return;
          section.classList.add('is-hidden');
          section.setAttribute('aria-hidden', 'true');
        });
        setHubView('home');
      } else {
        const resetMenuPanel = () => {
          filterByCategory('all');
          if (scrollRoot instanceof HTMLElement) {
            scrollRoot.scrollTo({ top: 0, behavior: 'auto' });
          }
        };

        panel.addEventListener('xemilla:menu-reset', () => resetMenuPanel());

        filterByCategory('all');
      }

      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!(btn instanceof HTMLElement)) return;
          const id = btn.dataset.catFilter;
          if (!id) return;
          filterByCategory(id);

          if (scrollRoot instanceof HTMLElement) {
            scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      });

      panel.querySelectorAll('[data-goto-plato]').forEach((card) => {
        card.addEventListener('click', () => {
          if (!(card instanceof HTMLElement)) return;
          const platoId = card.dataset.gotoPlato || '';
          const catId = card.dataset.gotoCat || '';
          goToPlato(platoId, catId);
        });
      });

      // Delegación: cubre clones del marquee
      panel.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        const card = t.closest('[data-goto-plato]');
        if (!(card instanceof HTMLElement) || !panel.contains(card)) return;
        // Evitar doble fire si ya hay listener directo en originales
        if (!card.dataset.marqueeClone) return;
        e.preventDefault();
        goToPlato(card.dataset.gotoPlato || '', card.dataset.gotoCat || '');
      });

      if (!isHubNav) {
        initScrollReveal(panel, scrollRoot);
      } else if (hubSection) {
        initScrollReveal(panel, scrollRoot);
      }

      if (track instanceof HTMLElement) {
        const mode =
          (destacados instanceof HTMLElement && destacados.dataset.destacadosEstilo) ||
          panel.dataset.destacadosEstilo ||
          'scroll';
        const efecto =
          (destacados instanceof HTMLElement && destacados.dataset.destacadosEfecto) ||
          panel.dataset.destacadosEfecto ||
          'marquee';

        if (mode === 'fade') {
          initDestacadosFade(track);
        } else if (efecto === 'estatico') {
          /* manual only */
        } else if (efecto === 'snap') {
          if (mode === 'carrusel' || (mode === 'scroll' && isPhoneMenu())) {
            initDestacadosAutoplay(track);
          }
        } else if (mode === 'carrusel' || mode === 'scroll') {
          // marquee (default): continuo
          initDestacadosMarquee(track);
        }
      }
    });
  }

  // ── Currency Conversion Engine ─────────────────────────────────────────────

  /**
   * Round to n decimal places using integer math to avoid float drift.
   * e.g. roundTo(10.005, 2) = 10.01 (correct), while toFixed alone may not be.
   */
  function roundTo(n: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round((n + Number.EPSILON) * factor) / factor;
  }

  /** "1.234,56 Bs." — Venezuelan thousand-dot, comma-decimal format */
  function formatBS(amount: number): string {
    const fixed = roundTo(amount, 2).toFixed(2);
    const [intPart, decPart] = fixed.split('.');
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${intFormatted},${decPart} Bs.`;
  }

  /** "1.234,56 €" — Euro comma-decimal format */
  function formatEUR(amount: number): string {
    const fixed = roundTo(amount, 2).toFixed(2);
    const [intPart, decPart] = fixed.split('.');
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${intFormatted},${decPart} €`;
  }

  /** "$1,234.56" — standard US dollar format */
  function formatUSD(amount: number): string {
    const fixed = roundTo(amount, 2).toFixed(2);
    const [intPart, decPart] = fixed.split('.');
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `$${intFormatted}.${decPart}`;
  }

  const CURRENCY_STORAGE_KEY = 'xemilla:divisa';

  function initCurrencyEngine(panel: HTMLElement) {
    const TASA_BCV = 36.5;
    const TASA_EUR = 0.92;

    const switcher = panel.querySelector<HTMLElement>('[data-currency-switcher]');
    if (!switcher) return;

    let usdVes = parseFloat(switcher.dataset.tasaBcv || panel.dataset.tasaBcv || String(TASA_BCV));
    let eurPerUsd = parseFloat(
      switcher.dataset.tasaEurUsd || panel.dataset.tasaEurUsd || String(TASA_EUR),
    );
    if (!Number.isFinite(usdVes) || usdVes <= 0) usdVes = TASA_BCV;
    if (!Number.isFinite(eurPerUsd) || eurPerUsd <= 0) eurPerUsd = TASA_EUR;

    const rateEl = switcher.querySelector<HTMLElement>('[data-currency-rate]');
    const trigger = switcher.querySelector<HTMLButtonElement>('[data-currency-trigger]');
    const triggerLabel = switcher.querySelector<HTMLElement>('[data-currency-trigger-label]');
    const triggerWord = switcher.querySelector<HTMLElement>('[data-currency-trigger-word]');
    const menu = switcher.querySelector<HTMLElement>('[data-currency-menu]');
    let current = 'USD';

    const syncTriggerLabel = (currency: string) => {
      const face = currency === 'BS' ? 'bs' : currency === 'EUR' ? 'eur' : 'usd';
      if (trigger instanceof HTMLButtonElement) trigger.dataset.currencyFace = face;
      if (triggerLabel instanceof HTMLElement) {
        triggerLabel.textContent = currency === 'BS' ? 'Bs' : currency === 'EUR' ? '€' : '$';
        triggerLabel.getAnimations?.().forEach((a) => {
          a.cancel();
          a.play();
        });
      }
      if (triggerWord instanceof HTMLElement) {
        triggerWord.textContent = currency === 'BS' ? 'VES' : currency === 'EUR' ? 'EUR' : 'USD';
      }
    };

    const setMenuOpen = (open: boolean) => {
      switcher.classList.toggle('is-open', open);
      if (menu instanceof HTMLElement) menu.hidden = !open;
      if (trigger instanceof HTMLButtonElement) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    const setRateHint = (currency: string) => {
      if (!rateEl) return;
      if (currency === 'EUR') {
        rateEl.innerHTML = `$1 ≈ <strong>${formatEUR(eurPerUsd)}</strong>`;
      } else if (currency === 'BS') {
        rateEl.innerHTML = `$1 = <strong>${formatBS(usdVes)}</strong>`;
      } else {
        rateEl.innerHTML = `USD · BCV <strong>${formatBS(usdVes)}</strong>`;
      }
    };

    const convertAll = (currency: string) => {
      const spans = panel.querySelectorAll<HTMLElement>('.precio-dinamico');
      spans.forEach((el) => el.classList.add('is-converting'));

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          spans.forEach((el) => {
            const usd = Number.parseFloat(el.dataset.precioUsd ?? '');
            if (!Number.isFinite(usd) || usd < 0) {
              el.classList.remove('is-converting');
              return;
            }
            if (currency === 'BS') {
              el.textContent = formatBS(usd * usdVes);
            } else if (currency === 'EUR') {
              el.textContent = formatEUR(usd * eurPerUsd);
            } else {
              el.textContent = formatUSD(usd);
            }
            el.classList.remove('is-converting');
          });
          setRateHint(currency);
        });
      });
    };

    const selectCurrency = (currency: string) => {
      if (!currency || currency === current) {
        setMenuOpen(false);
        return;
      }
      current = currency;
      syncTriggerLabel(currency);

      switcher.querySelectorAll<HTMLElement>('[data-currency-btn]').forEach((b) => {
        const on = b.dataset.currencyBtn === currency;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      convertAll(currency);
      setMenuOpen(false);
      try {
        localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
      } catch {
        /* almacenamiento bloqueado (modo privado) */
      }
    };

    setRateHint('USD');
    syncTriggerLabel('USD');

    let saved: string | null = null;
    try {
      saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (saved === 'BS' || saved === 'EUR') selectCurrency(saved);

    document.addEventListener('click', (e) => {
      if (!(e.target instanceof Node) || !switcher.contains(e.target)) {
        setMenuOpen(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    });

    void fetch('/api/tasas-cambio')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.ok) return;
        const nextUsd = Number(data.usdVes);
        const nextEurVes = Number(data.eurVes);
        if (Number.isFinite(nextUsd) && nextUsd > 1) usdVes = nextUsd;
        if (Number.isFinite(nextUsd) && Number.isFinite(nextEurVes) && nextEurVes > 1) {
          eurPerUsd = nextUsd / nextEurVes;
        }
        switcher.dataset.tasaBcv = String(usdVes);
        switcher.dataset.tasaEurUsd = String(eurPerUsd);
        panel.dataset.tasaBcv = String(usdVes);
        panel.dataset.tasaEurUsd = String(eurPerUsd);
        convertAll(current);
      })
      .catch(() => {});

    switcher.addEventListener('click', (e) => {
      const target = e.target as Element | null;
      if (!target) return;

      if (target.closest('[data-currency-trigger]')) {
        e.stopPropagation();
        setMenuOpen(!switcher.classList.contains('is-open'));
        return;
      }

      const btn = target.closest<HTMLElement>('[data-currency-btn]');
      if (!btn) return;
      e.stopPropagation();
      selectCurrency(btn.dataset.currencyBtn ?? '');
    });
  }

  function initAlergiaEngine(panel: HTMLElement) {
    const bar = panel.querySelector<HTMLElement>('[data-alergias-filtros]');
    if (!bar) return;

    const pills = bar.querySelectorAll<HTMLElement>('[data-alergia-filtro]');
    const resetBtn = bar.querySelector<HTMLElement>('[data-alergia-reset]');
    const sections = panel.querySelectorAll<HTMLElement>('[data-menu-cat]');
    const featuredSection = panel.querySelector<HTMLElement>('[data-destacados]');
    const emptyEl = panel.querySelector<HTMLElement>('[data-menu-empty-filtros]');

    const ALIAS: Record<string, string> = {
      trigo: 'gluten',
      wheat: 'gluten',
      celiaco: 'gluten',
      celiac: 'gluten',
      huevos: 'huevo',
      egg: 'huevo',
      lacteo: 'lacteos',
      leche: 'lacteos',
      dairy: 'lacteos',
      peanut: 'mani',
      nuts: 'frutos_secos',
      sesame: 'sesamo',
      spicy: 'picante',
      meat: 'carne',
      carnes: 'carne',
      non_vegan: 'no_vegano',
      novegano: 'no_vegano',
    };

    const canon = (raw: string) => {
      const id = String(raw || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[-\s]+/g, '_');
      return ALIAS[id] || id;
    };

    const toIds = (raw: string): Set<string> => {
      return new Set(
        String(raw || '')
          .split(/[,|;]/)
          .map(canon)
          .filter(Boolean),
      );
    };

    const looksAnimal = (nombre: string) =>
      /res\b|jam[oó]n|hamburg|ribeye|steak|pork|belly|carne|pollo|cerdo|chorizo|bacon|lomo|filete|pescado|at[uú]n|salm[oó]n|camar[oó]n|marisco|calamar|pulpo|langost|ternera|cordero|pavo|nugget|alita|costilla|tocino|mortadela|chicharr[oó]n|ib[eé]rico|smash|carpaccio/i.test(
        nombre,
      );

    const GLUTEN_HINT =
      /gluten|\btrigo\b|\bwheat\b|centeno|cebada|espelta|pan\s*rallad|harina\s+de\s+trigo|bread\s*crumb/i;
    const LACTEOS_HINT =
      /\bl[aá]cteo|\bleche\b|mantequilla|queso|crema|yogur|bechamel|dairy|\bbutter\b|\bcheese\b/i;
    const NUTS_HINT =
      /fruto[s]?\s*seco|\bmani\b|\bnuez|\balmendr|cacahuate|pistachio|avellana|\bpeanut|\bwalnut/i;
    const PICANTE_HINT = /picante|ají|aji\b|chile|habanero|cayena|sriracha|spicy/i;

    const textoCubre = (filtroId: string, blob: string) => {
      if (filtroId === 'sin_gluten') return GLUTEN_HINT.test(blob);
      if (filtroId === 'sin_lacteos') return LACTEOS_HINT.test(blob);
      if (filtroId === 'sin_frutos_secos') return NUTS_HINT.test(blob);
      if (filtroId === 'sin_picante') return PICANTE_HINT.test(blob);
      return false;
    };

    const apply = () => {
      const activePills = Array.from(pills).filter(
        (p) => p.getAttribute('aria-pressed') === 'true',
      );
      const hasActive = activePills.length > 0;
      if (resetBtn) resetBtn.classList.toggle('hidden', !hasActive);

      const allItems = panel.querySelectorAll<HTMLElement>(
        '.menu-plato-item, .menu-featured',
      );
      allItems.forEach((item) => {
        const itemAlergias = toIds(item.dataset.alergias ?? '');
        const nombre = item.dataset.platoNombre || '';
        const blob = `${nombre} ${item.dataset.ingredientes || ''}`;
        let hide = false;
        if (hasActive) {
          hide = activePills.some((pill) => {
            const filtroId = pill.dataset.alergiaFiltro || '';
            const hides = toIds(pill.dataset.hidesAny ?? '');
            const hideUnknown = pill.dataset.hideUnknown === 'true';
            const isVegan = filtroId === 'vegano';
            if (hideUnknown && itemAlergias.size === 0) return true;
            if (isVegan && looksAnimal(nombre)) return true;
            for (const id of hides) {
              if (itemAlergias.has(id)) return true;
            }
            if (textoCubre(filtroId, blob)) return true;
            return false;
          });
        }
        item.classList.toggle('is-alergia-hidden', hide);
        item.setAttribute('aria-hidden', hide ? 'true' : 'false');
      });

      sections.forEach((section) => {
        if (section.classList.contains('is-hidden')) return;
        const items = section.querySelectorAll<HTMLElement>('.menu-plato-item');
        const allHidden =
          items.length > 0 &&
          Array.from(items).every((it) => it.classList.contains('is-alergia-hidden'));
        section.classList.toggle('is-alergia-empty', allHidden);
      });

      if (featuredSection) {
        const featuredItems = featuredSection.querySelectorAll<HTMLElement>('.menu-featured');
        const allHidden =
          featuredItems.length > 0 &&
          Array.from(featuredItems).every((it) => it.classList.contains('is-alergia-hidden'));
        featuredSection.classList.toggle('is-alergia-empty', allHidden);
        featuredSection
          .querySelector('[data-destacados-track]')
          ?.dispatchEvent(new Event('destacados:filter'));
      }

      if (emptyEl) {
        const visible = Array.from(allItems).some((item) => {
          if (item.classList.contains('is-alergia-hidden')) return false;
          const section = item.closest('[data-menu-cat], [data-destacados]');
          if (section instanceof HTMLElement && section.classList.contains('is-hidden')) {
            return false;
          }
          return true;
        });
        emptyEl.classList.toggle('hidden', !hasActive || visible);
      }
    };

    bar.addEventListener('click', (e) => {
      const pill = (e.target as Element)?.closest<HTMLElement>('[data-alergia-filtro]');
      if (pill && bar.contains(pill)) {
        const next = pill.getAttribute('aria-pressed') !== 'true';
        pill.setAttribute('aria-pressed', next ? 'true' : 'false');
        apply();
        return;
      }
      const reset = (e.target as Element)?.closest<HTMLElement>('[data-alergia-reset]');
      if (reset) {
        pills.forEach((p) => p.setAttribute('aria-pressed', 'false'));
        apply();
      }
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  function initAllEngines() {
    document.querySelectorAll<HTMLElement>('[data-menu-panel]').forEach((panel) => {
      // Currency engine (idempotent via flag)
      if (panel.dataset.currencyReady !== 'true') {
        panel.dataset.currencyReady = 'true';
        initCurrencyEngine(panel);
      }
      // Allergen engine (idempotent via flag)
      if (panel.dataset.alergiaReady !== 'true') {
        panel.dataset.alergiaReady = 'true';
        initAlergiaEngine(panel);
      }
    });
  }

  function boot() {
    initMenuPanels();
    initAllEngines();
  }

  boot();
  document.addEventListener('astro:page-load', boot);
