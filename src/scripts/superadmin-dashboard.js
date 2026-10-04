  function initSuperTabs() {
    const tabs = document.querySelectorAll('[data-super-tab]');
    const panels = document.querySelectorAll('[data-super-panel]');
    if (!tabs.length) return;

    /**
     * @param {string} id
     */
    function setTab(id) {
      tabs.forEach((btn) => {
        if (!(btn instanceof HTMLElement)) return;
        const on = btn.dataset.superTab === id;
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.classList.toggle('is-active', on);
      });
      panels.forEach((panel) => {
        if (!(panel instanceof HTMLElement)) return;
        const on = panel.dataset.superPanel === id;
        panel.hidden = !on;
        if (on) {
          panel.classList.remove('admin-fade-in-up');
          void panel.offsetWidth;
          panel.classList.add('admin-fade-in-up');
        }
      });
    }

    tabs.forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      if (btn.dataset.bound === 'true') return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => setTab(btn.dataset.superTab || 'locales'));
    });
  }

  const ACCESS_ACTIVE_CLASSES =
    'inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-black/45 px-2.5 py-1 text-[0.62rem] font-medium tracking-wide text-emerald-300 backdrop-blur-md';
  const DEFAULT_CTA = 'CREAR ACCESO';
  const ACTIVE_CTA = 'ACTUALIZAR CLAVE';

  /**
   * @param {HTMLFormElement} form
   */
  function markAccessActive(form) {
    form.dataset.hasAccess = 'true';
    const restauranteId = form.dataset.restauranteId || '';
    const card =
      form.closest('li.super-hub-card') ||
      document.querySelector(`li.super-hub-card[data-restaurante-id="${restauranteId}"]`);
    const badge = card?.querySelector('[data-access-badge]');
    if (badge instanceof HTMLElement) {
      badge.className = ACCESS_ACTIVE_CLASSES;
      badge.innerHTML =
        '<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true"></span>Acceso Activo';
    }
  }

  /**
   * @param {HTMLElement | null | undefined} panel
   * @param {boolean} open
   */
  function toggleOverlayPanel(panel, open) {
    if (!(panel instanceof HTMLElement)) return;
    if (open) {
      // Close other hub modals first
      document.querySelectorAll('.hub-modal.is-open').forEach((el) => {
        if (el === panel) return;
        if (el instanceof HTMLElement) toggleOverlayPanel(el, false);
      });
      if (!panel.dataset.hubHome && panel.parentElement) {
        panel.dataset.hubHome = 'parked';
        panel.dataset.hubOwner = panel.parentElement.tagName;
      }
      if (panel.parentElement !== document.body) {
        document.body.appendChild(panel);
      }
      panel.hidden = false;
      panel.classList.remove('hidden');
      panel.classList.add('is-open');
      document.documentElement.style.overflow = 'hidden';
    } else {
      panel.hidden = true;
      panel.classList.add('hidden');
      panel.classList.remove('is-open');
      // Restore into original card if possible
      const ownerId = panel.dataset.restauranteHost;
      if (ownerId) {
        const host = document.querySelector(`li.super-hub-card[data-restaurante-id="${ownerId}"]`);
        if (host instanceof HTMLElement) host.appendChild(panel);
      }
      if (!document.querySelector('.hub-modal.is-open')) {
        document.documentElement.style.overflow = '';
      }
    }
  }

  /**
   * @param {File} file
   * @param {string} [slug]
   */
  async function uploadCardMedia(file, slug) {
    const body = new FormData();
    body.append('file', file);
    if (slug) body.append('restaurante_slug', slug);
    body.append('asset_type', 'identity');
    const res = await fetch('/api/upload', { method: 'POST', body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) {
      throw new Error(json.error || 'No se pudo subir la imagen');
    }
    return String(json.url);
  }

  /**
   * @param {HTMLElement} panel
   * @param {HTMLElement} anchor
   */
  function placeFixedMenu(panel, anchor) {
    panel.style.visibility = 'hidden';
    panel.classList.add('is-open');
    panel.style.display = 'flex';
    const rect = anchor.getBoundingClientRect();
    const menuW = Math.max(panel.offsetWidth || 248, 248);
    const menuH = panel.offsetHeight || 320;
    let left = rect.right - menuW;
    let top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuW - 8);
    }
    if (top + menuH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuH - 8);
    }
    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.right = 'auto';
    panel.style.visibility = '';
  }

  /**
   * @param {HTMLDetailsElement} details
   * @param {HTMLElement} panel
   */
  function openCardMenu(details, panel) {
    const summary = details.querySelector('summary');
    if (!(summary instanceof HTMLElement)) return;
    if (!details.dataset.menuId) {
      details.dataset.menuId = `menu-${Math.random().toString(36).slice(2, 9)}`;
    }
    panel.dataset.ownerId = details.dataset.menuId;
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
    placeFixedMenu(panel, summary);
    details.open = true;
  }

  /**
   * @param {HTMLDetailsElement} details
   * @param {HTMLElement | null} panel
   */
  function closeCardMenu(details, panel) {
    if (panel instanceof HTMLElement) {
      panel.classList.remove('is-open');
      panel.style.display = 'none';
      if (panel.parentElement === document.body) {
        details.appendChild(panel);
      }
    }
    details.open = false;
  }

  /**
   * @param {HTMLDetailsElement} details
   */
  function getMenuPanel(details) {
    const ownerId = details.dataset.menuId || '';
    const fromBody =
      ownerId &&
      document.querySelector(`[data-card-menu-panel][data-owner-id="${ownerId}"]`);
    if (fromBody instanceof HTMLElement) return fromBody;
    const local = details.querySelector('[data-card-menu-panel]');
    return local instanceof HTMLElement ? local : null;
  }

  function closeAllCardMenus(except = null) {
    document.querySelectorAll('[data-card-menu]').forEach((el) => {
      if (!(el instanceof HTMLDetailsElement) || el === except) return;
      closeCardMenu(el, getMenuPanel(el));
    });
  }

  function initCardMenus() {
    /**
     * @param {HTMLElement} card
     * @param {boolean} activo
     * @param {HTMLElement} [toggleBtn]
     */
    function paintHubActivo(card, activo, toggleBtn) {
      card.dataset.hubActivo = activo ? 'true' : 'false';
      card.classList.toggle('super-hub-card--paused', !activo);

      let badge = card.querySelector('[data-estado-badge]');
      const badgeHost = card.querySelector('.absolute.left-3.top-3');
      if (!activo) {
        if (!(badge instanceof HTMLElement) && badgeHost instanceof HTMLElement) {
          badge = document.createElement('span');
          badge.setAttribute('data-estado-badge', '');
          badge.className =
            'inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-black/55 px-2.5 py-1 text-[0.62rem] font-medium tracking-wide text-amber-300 backdrop-blur-md';
          badge.innerHTML =
            '<span class="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true"></span>Desactivado';
          badgeHost.prepend(badge);
        }
      } else if (badge instanceof HTMLElement) {
        badge.remove();
      }

      const btn = toggleBtn || card.querySelector('[data-toggle-activo]');
      if (btn instanceof HTMLElement) {
        btn.dataset.activo = activo ? 'true' : 'false';
        const label = btn.querySelector('[data-toggle-activo-label]');
        const hint = btn.querySelector('[data-toggle-activo-hint]');
        if (label) label.textContent = activo ? 'Desactivar local' : 'Reactivar local';
        if (hint) {
          hint.textContent = activo
            ? 'Pausar sin borrar (impago)'
            : 'Volver a publicar la WebApp';
        }
      }
    }

    document.querySelectorAll('[data-card-menu]').forEach((details) => {
      if (!(details instanceof HTMLDetailsElement)) return;
      if (details.dataset.bound === 'true') return;
      details.dataset.bound = 'true';

      const card = details.closest('li');
      const panel = details.querySelector('[data-card-menu-panel]');
      if (!(panel instanceof HTMLElement)) return;

      const credsPanel = card?.querySelector('[data-creds-panel]');
      const fichaPanel = card?.querySelector('[data-ficha-panel]');
      const infoPanel = card?.querySelector('[data-info-panel]');
      const closeCreds = credsPanel?.querySelectorAll('[data-close-creds]');
      const closeFicha = fichaPanel?.querySelectorAll('[data-close-ficha]');
      const closeInfo = infoPanel?.querySelectorAll('[data-close-info]');
      const summary = details.querySelector('summary');

      details.addEventListener('toggle', () => {
        if (details.open) {
          closeAllCardMenus(details);
          openCardMenu(details, panel);
        } else if (panel.classList.contains('is-open')) {
          closeCardMenu(details, panel);
        }
      });

      const bindPanelActions = (root) => {
        if (!(root instanceof HTMLElement)) return;
        root.querySelectorAll('[data-open-creds]').forEach((btn) => {
          if (!(btn instanceof HTMLElement) || btn.dataset.boundAction === 'true') return;
          btn.dataset.boundAction = 'true';
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            closeCardMenu(details, panel);
            toggleOverlayPanel(fichaPanel instanceof HTMLElement ? fichaPanel : null, false);
            toggleOverlayPanel(infoPanel instanceof HTMLElement ? infoPanel : null, false);
            toggleOverlayPanel(credsPanel instanceof HTMLElement ? credsPanel : null, true);
          });
        });
        root.querySelectorAll('[data-open-ficha]').forEach((btn) => {
          if (!(btn instanceof HTMLElement) || btn.dataset.boundAction === 'true') return;
          btn.dataset.boundAction = 'true';
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            closeCardMenu(details, panel);
            toggleOverlayPanel(credsPanel instanceof HTMLElement ? credsPanel : null, false);
            toggleOverlayPanel(infoPanel instanceof HTMLElement ? infoPanel : null, false);
            toggleOverlayPanel(fichaPanel instanceof HTMLElement ? fichaPanel : null, true);
          });
        });
        root.querySelectorAll('[data-open-info]').forEach((btn) => {
          if (!(btn instanceof HTMLElement) || btn.dataset.boundAction === 'true') return;
          btn.dataset.boundAction = 'true';
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            closeCardMenu(details, panel);
            toggleOverlayPanel(credsPanel instanceof HTMLElement ? credsPanel : null, false);
            toggleOverlayPanel(fichaPanel instanceof HTMLElement ? fichaPanel : null, false);
            toggleOverlayPanel(infoPanel instanceof HTMLElement ? infoPanel : null, true);
          });
        });
        root.querySelectorAll('[data-toggle-activo]').forEach((btn) => {
          if (!(btn instanceof HTMLElement) || btn.dataset.boundAction === 'true') return;
          btn.dataset.boundAction = 'true';
          btn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const cardEl = details.closest('li.super-hub-card');
            if (!(cardEl instanceof HTMLElement)) return;
            const id = cardEl.dataset.restauranteId || '';
            const slug = cardEl.dataset.hubSlug || '';
            const currentlyActive = cardEl.dataset.hubActivo !== 'false';
            const nextActivo = !currentlyActive;
            const nombre = slug || 'este local';
            const ok = window.confirm(
              nextActivo
                ? `¿Reactivar «${nombre}»?\nLa WebApp pública volverá a estar disponible.`
                : `¿Desactivar «${nombre}»?\nLa WebApp pública quedará fuera de línea. Los datos se conservan.`,
            );
            if (!ok) return;
            closeCardMenu(details, panel);
            btn.setAttribute('disabled', 'true');
            try {
              const res = await fetch('/api/update-restaurante-estado', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, activo: nextActivo }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(json.error || 'No se pudo actualizar');
              paintHubActivo(cardEl, nextActivo, btn);
            } catch (err) {
              window.alert(err instanceof Error ? err.message : 'Error al actualizar');
            } finally {
              btn.removeAttribute('disabled');
            }
          });
        });
        root.querySelectorAll('[data-delete-restaurante]').forEach((btn) => {
          if (!(btn instanceof HTMLElement) || btn.dataset.boundAction === 'true') return;
          btn.dataset.boundAction = 'true';
          btn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const cardEl = details.closest('li.super-hub-card');
            if (!(cardEl instanceof HTMLElement)) return;
            const id = cardEl.dataset.restauranteId || '';
            const slug = String(cardEl.dataset.hubSlug || '').trim();
            if (!slug) {
              window.alert('Este local no tiene slug; no se puede confirmar la eliminación.');
              return;
            }
            const typed = window.prompt(
              `Esto BORRA el restaurante, su menú y datos de forma permanente.\n\nEscribí el slug para confirmar:\n${slug}`,
              '',
            );
            if (typed == null) return;
            if (String(typed).trim().toLowerCase() !== slug.toLowerCase()) {
              window.alert('Slug incorrecto. Eliminación cancelada.');
              return;
            }
            closeCardMenu(details, panel);
            btn.setAttribute('disabled', 'true');
            try {
              const res = await fetch('/api/delete-restaurante', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, confirm: slug }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(json.error || 'No se pudo eliminar');
              cardEl.remove();
              const countEl = document.querySelector('[data-hub-search-count]');
              const cardsLeft = document.querySelectorAll(
                'li.super-hub-card[data-restaurante-id]',
              ).length;
              if (countEl) {
                countEl.textContent =
                  cardsLeft === 1 ? '1 local' : `${cardsLeft} locales`;
              }
              const emptyEl = document.querySelector('[data-hub-search-empty]');
              if (emptyEl instanceof HTMLElement) {
                emptyEl.hidden = cardsLeft > 0;
              }
            } catch (err) {
              window.alert(err instanceof Error ? err.message : 'Error al eliminar');
            } finally {
              btn.removeAttribute('disabled');
            }
          });
        });
      };

      bindPanelActions(panel);

      panel.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const item = target.closest('[role="menuitem"]');
        if (!(item instanceof HTMLElement)) return;
        if (
          item.hasAttribute('data-open-ficha') ||
          item.hasAttribute('data-open-creds') ||
          item.hasAttribute('data-open-info') ||
          item.hasAttribute('data-toggle-activo') ||
          item.hasAttribute('data-delete-restaurante')
        ) {
          return;
        }
        window.setTimeout(() => closeCardMenu(details, panel), 0);
      });

      closeCreds?.forEach((btn) => {
        btn.addEventListener('click', () => {
          toggleOverlayPanel(credsPanel instanceof HTMLElement ? credsPanel : null, false);
        });
      });

      closeFicha?.forEach((btn) => {
        btn.addEventListener('click', () => {
          toggleOverlayPanel(fichaPanel instanceof HTMLElement ? fichaPanel : null, false);
        });
      });

      closeInfo?.forEach((btn) => {
        btn.addEventListener('click', () => {
          toggleOverlayPanel(infoPanel instanceof HTMLElement ? infoPanel : null, false);
        });
      });

      const reposition = () => {
        if (!details.open || !(summary instanceof HTMLElement)) return;
        if (panel.parentElement !== document.body) return;
        placeFixedMenu(panel, summary);
      };
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
    });

    if (document.documentElement.dataset.cardMenuOutsideBound !== 'true') {
      document.documentElement.dataset.cardMenuOutsideBound = 'true';
      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        document.querySelectorAll('[data-card-menu][open]').forEach((el) => {
          if (!(el instanceof HTMLDetailsElement)) return;
          const panel = getMenuPanel(el);
          const inDetails = el.contains(target);
          const inPanel = panel instanceof HTMLElement && panel.contains(target);
          if (!inDetails && !inPanel) closeCardMenu(el, panel);
        });
      });
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('.hub-modal.is-open').forEach((el) => {
          if (el instanceof HTMLElement) toggleOverlayPanel(el, false);
        });
        closeAllCardMenus();
      });
    }
  }

  function initFichaForms() {
    document.querySelectorAll('[data-ficha-form]').forEach((form) => {
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.bound === 'true') return;
      form.dataset.bound = 'true';

      const restauranteId = form.dataset.restauranteId || '';
      const restauranteSlug = form.dataset.slug || '';
      const logoFile = form.querySelector('[data-ficha-logo-file]');
      const coverFile = form.querySelector('[data-ficha-cover-file]');
      const logoHidden = form.querySelector('[data-ficha-logo-url]');
      const coverHidden = form.querySelector('[data-ficha-cover-url]');
      const logoBgHidden = form.querySelector('[data-ficha-logo-bg]');
      const feedback = form.querySelector('[data-ficha-feedback]');

      /**
       * @param {string} hex
       */
      const applyPlateColor = (hex) => {
        const color = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#111111';
        if (logoBgHidden instanceof HTMLInputElement) logoBgHidden.value = color;
        const logoPreview = form.querySelector('[data-ficha-logo-preview]');
        if (logoPreview instanceof HTMLElement) {
          logoPreview.style.setProperty('--hub-logo-plate', color);
          logoPreview.style.background = color;
        }
        const card = document.querySelector(
          `li.super-hub-card[data-restaurante-id="${restauranteId}"]`,
        );
        const logoZone = card?.querySelector('[data-card-logo-zone]');
        if (logoZone instanceof HTMLElement) {
          logoZone.style.setProperty('--hub-logo-plate', color);
          logoZone.style.background = color;
          logoZone.dataset.logoPlateBg = color;
        }
      };

      /**
       * @param {string} coverUrl
       */
      const refreshPlateFromCover = async (coverUrl) => {
        const sample = window.XemillaImageCrop?.samplePlateColorFromUrl;
        if (typeof sample !== 'function' || !coverUrl) return '#111111';
        try {
          const hex = await sample(coverUrl);
          applyPlateColor(hex);
          return hex;
        } catch {
          return '#111111';
        }
      };

      /**
       * @param {HTMLInputElement | null} fileInput
       * @param {HTMLInputElement | null} hidden
       * @param {'logo' | 'cover'} kind
       */
      const bindUpload = (fileInput, hidden, kind) => {
        if (!(fileInput instanceof HTMLInputElement)) return;
        fileInput.addEventListener('change', () => {
          const file = fileInput.files?.[0];
          fileInput.value = '';
          if (!file) return;

          const runUpload = async (croppedFile, meta) => {
            if (feedback instanceof HTMLElement) {
              feedback.textContent = 'Subiendo…';
              feedback.classList.remove('hidden', 'text-rose-400', 'text-emerald-400');
              feedback.classList.add('text-zinc-400');
            }
            try {
              const url = await uploadCardMedia(croppedFile, restauranteSlug);
              if (hidden instanceof HTMLInputElement) hidden.value = url;

              const preview =
                kind === 'cover'
                  ? form.querySelector('[data-ficha-cover-preview]')
                  : form.querySelector('[data-ficha-logo-preview]');
              if (preview instanceof HTMLElement) {
                const empty = preview.querySelector(
                  kind === 'cover' ? '[data-ficha-cover-empty]' : '[data-ficha-logo-empty]',
                );
                empty?.remove();
                let img = preview.querySelector(
                  kind === 'cover' ? '[data-ficha-cover-img]' : '[data-ficha-logo-img]',
                );
                if (!(img instanceof HTMLImageElement)) {
                  img = document.createElement('img');
                  img.alt = '';
                  if (kind === 'cover') img.dataset.fichaCoverImg = '';
                  else {
                    img.dataset.fichaLogoImg = '';
                    img.className = 'mx-auto max-h-16 w-auto object-contain';
                  }
                  preview.appendChild(img);
                }
                img.src = url;
              }

              if (kind === 'cover') {
                await refreshPlateFromCover(url);
              } else if (meta?.plateBg) {
                applyPlateColor(meta.plateBg);
              } else {
                const coverUrl =
                  coverHidden instanceof HTMLInputElement ? coverHidden.value.trim() : '';
                await refreshPlateFromCover(coverUrl);
              }

              if (feedback instanceof HTMLElement) {
                feedback.textContent = '✓ imagen lista — guardá la ficha';
                feedback.classList.remove('text-zinc-400', 'text-rose-400');
                feedback.classList.add('text-emerald-400');
              }
            } catch (err) {
              if (feedback instanceof HTMLElement) {
                feedback.textContent =
                  err instanceof Error ? err.message : 'Error al subir';
                feedback.classList.remove('text-zinc-400', 'text-emerald-400');
                feedback.classList.add('text-rose-400');
              }
            }
          };

          const cropApi = window.XemillaImageCrop;
          if (cropApi && typeof cropApi.open === 'function') {
            const coverUrl =
              coverHidden instanceof HTMLInputElement ? coverHidden.value.trim() : '';
            const existingBg =
              logoBgHidden instanceof HTMLInputElement ? logoBgHidden.value.trim() : '';
            void cropApi.open({
              file,
              aspect: kind === 'cover' ? 'cover' : 'logo',
              title: kind === 'cover' ? 'Recortar cover' : 'Recortar logo',
              coverUrl: kind === 'logo' ? coverUrl : '',
              background: kind === 'logo' && /^#[0-9A-Fa-f]{6}$/.test(existingBg) ? existingBg : undefined,
              onConfirm: (cropped, meta) => runUpload(cropped, meta),
            });
            return;
          }

          void runUpload(file);
        });
      };

      bindUpload(
        logoFile instanceof HTMLInputElement ? logoFile : null,
        logoHidden instanceof HTMLInputElement ? logoHidden : null,
        'logo',
      );
      bindUpload(
        coverFile instanceof HTMLInputElement ? coverFile : null,
        coverHidden instanceof HTMLInputElement ? coverHidden : null,
        'cover',
      );

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const card = document.querySelector(
          `li.super-hub-card[data-restaurante-id="${restauranteId}"]`,
        );
        const fichaPanel = document.querySelector(
          `[data-ficha-panel][data-restaurante-host="${restauranteId}"]`,
        );
        const nombreInput = form.querySelector('input[name="nombre_comercial"]');
        const phoneInput = form.querySelector('input[name="whatsapp_num"]');
        const submitBtn = form.querySelector('button[type="submit"]');
        if (!(submitBtn instanceof HTMLButtonElement)) return;

        const nombre =
          nombreInput instanceof HTMLInputElement ? nombreInput.value.trim() : '';
        const telefono =
          phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : '';
        const logoUrl =
          logoHidden instanceof HTMLInputElement ? logoHidden.value.trim() : '';
        const coverUrl =
          coverHidden instanceof HTMLInputElement ? coverHidden.value.trim() : '';
        let logoBg =
          logoBgHidden instanceof HTMLInputElement ? logoBgHidden.value.trim() : '';

        if (!nombre) {
          if (feedback instanceof HTMLElement) {
            feedback.textContent = 'El nombre es obligatorio';
            feedback.classList.remove('hidden', 'text-emerald-400');
            feedback.classList.add('text-rose-400');
          }
          return;
        }

        // Si hay cover y la placa sigue en default, muestrear antes de guardar
        if (coverUrl && (!logoBg || logoBg === '#111111')) {
          logoBg = await refreshPlateFromCover(coverUrl);
        }

        submitBtn.disabled = true;
        const prev = submitBtn.textContent;
        submitBtn.textContent = 'Guardando…';

        try {
          /** @type {Record<string, string>} */
          const body = {
            restaurante_id: restauranteId,
            nombre_comercial: nombre,
            whatsapp_num: telefono,
          };
          // Solo enviar media con URL real — nunca '' (evita borrar covers)
          if (logoUrl) body.logo_url = logoUrl;
          if (coverUrl) body.hub_cover_url = coverUrl;
          if (/^#[0-9A-Fa-f]{6}$/.test(logoBg)) body.hub_logo_bg = logoBg;

          const res = await fetch('/api/update-hub-datos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'No se pudo guardar');

          const coverZone = card?.querySelector('[data-card-cover-zone]');
          const logoZone = card?.querySelector('[data-card-logo-zone]');
          const savedCover = String(
            data.restaurante?.hub_cover_url || coverUrl || '',
          ).trim();
          const savedLogo = String(data.restaurante?.logo_url || logoUrl || '').trim();
          const savedBg = String(data.restaurante?.hub_logo_bg || logoBg || '').trim();
          const savedName = String(data.restaurante?.nombre_comercial || nombre);
          if (card instanceof HTMLElement) {
            card.dataset.hubName = `${savedName} ${card.dataset.hubSlug || ''}`.toLowerCase();
          }

          // Actualizar cover solo si hay URL — nunca vaciar el grid
          if (coverZone instanceof HTMLElement && savedCover) {
            const existing = coverZone.querySelector('[data-card-cover-img]');
            const empty = coverZone.querySelector('[data-card-cover-empty]');
            if (existing instanceof HTMLImageElement) {
              existing.src = savedCover;
            } else {
              empty?.remove();
              const img = document.createElement('img');
              img.src = savedCover;
              img.alt = '';
              img.dataset.cardCoverImg = '';
              img.className =
                'h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]';
              coverZone.insertBefore(img, coverZone.firstChild);
            }
          }

          if (logoZone instanceof HTMLElement) {
            if (/^#[0-9A-Fa-f]{6}$/.test(savedBg)) {
              applyPlateColor(savedBg);
            }
            if (savedLogo) {
              logoZone.querySelector('[data-card-logo-empty]')?.remove();
              let img = logoZone.querySelector('[data-card-logo-img]');
              if (!(img instanceof HTMLImageElement)) {
                img = document.createElement('img');
                img.dataset.cardLogoImg = '';
                img.className = 'super-hub-card__logo-img';
                logoZone.appendChild(img);
              }
              img.src = savedLogo;
              img.alt = savedName || '';
            }

            const fichaLogoPreview = form.querySelector('[data-ficha-logo-preview]');
            if (fichaLogoPreview instanceof HTMLElement && savedLogo) {
              fichaLogoPreview.querySelector('[data-ficha-logo-empty]')?.remove();
              let pImg = fichaLogoPreview.querySelector('[data-ficha-logo-img]');
              if (!(pImg instanceof HTMLImageElement)) {
                pImg = document.createElement('img');
                pImg.dataset.fichaLogoImg = '';
                pImg.className = 'mx-auto max-h-16 w-auto object-contain';
                fichaLogoPreview.appendChild(pImg);
              }
              pImg.src = savedLogo;
            }
          }

          if (feedback instanceof HTMLElement) {
            feedback.textContent = '✓ ficha actualizada';
            feedback.classList.remove('hidden', 'text-rose-400');
            feedback.classList.add('text-emerald-400');
          }

          window.setTimeout(() => {
            toggleOverlayPanel(
              fichaPanel instanceof HTMLElement ? fichaPanel : null,
              false,
            );
          }, 700);
        } catch (err) {
          if (feedback instanceof HTMLElement) {
            feedback.textContent =
              err instanceof Error ? err.message : 'Error al guardar';
            feedback.classList.remove('hidden', 'text-emerald-400');
            feedback.classList.add('text-rose-400');
          }
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = prev || 'Guardar ficha';
        }
      });
    });
  }

  /** Placas sin color guardado: muestrear del cover en vivo (no borra covers). */
  async function hydrateLogoPlatesFromCovers() {
    const sample = window.XemillaImageCrop?.samplePlateColorFromUrl;
    if (typeof sample !== 'function') return;
    const cards = document.querySelectorAll('li.super-hub-card[data-restaurante-id]');
    for (const card of cards) {
      if (!(card instanceof HTMLElement)) continue;
      const zone = card.querySelector('[data-card-logo-zone]');
      const coverImg = card.querySelector('[data-card-cover-img]');
      if (!(zone instanceof HTMLElement) || !(coverImg instanceof HTMLImageElement)) continue;
      const stored = String(zone.dataset.logoPlateBg || '').trim();
      if (stored && stored !== '#111111') continue;
      const src = coverImg.currentSrc || coverImg.src;
      if (!src) continue;
      try {
        const hex = await sample(src);
        zone.style.setProperty('--hub-logo-plate', hex);
        zone.style.background = hex;
        zone.dataset.logoPlateBg = hex;
        const host = card.dataset.restauranteId;
        const bgInput = document.querySelector(
          `[data-ficha-form][data-restaurante-id="${host}"] [data-ficha-logo-bg]`,
        );
        if (bgInput instanceof HTMLInputElement) bgInput.value = hex;
        const preview = document.querySelector(
          `[data-ficha-panel][data-restaurante-host="${host}"] [data-ficha-logo-preview]`,
        );
        if (preview instanceof HTMLElement) {
          preview.style.setProperty('--hub-logo-plate', hex);
          preview.style.background = hex;
        }
      } catch {
        /* ignore */
      }
    }
  }

  function initOperativoForms() {
    document.querySelectorAll('[data-operativo-form]').forEach((form) => {
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.bound === 'true') return;
      form.dataset.bound = 'true';

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const restauranteId = form.dataset.restauranteId || '';
        const feedback = form.querySelector('[data-operativo-feedback]');
        const submitBtn = form.querySelector('button[type="submit"]');
        const emailInput = form.querySelector('input[name="email"]');
        const passwordInput = form.querySelector('input[name="password"]');

        if (!(feedback instanceof HTMLElement) || !(submitBtn instanceof HTMLButtonElement)) {
          return;
        }

        const email =
          emailInput instanceof HTMLInputElement ? emailInput.value.trim() : '';
        const password =
          passwordInput instanceof HTMLInputElement ? passwordInput.value : '';

        const idleLabel =
          form.dataset.hasAccess === 'true' ? ACTIVE_CTA : DEFAULT_CTA;

        feedback.classList.add('hidden');
        feedback.textContent = '';
        feedback.classList.remove('text-rose-400', 'text-emerald-400');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando...';

        try {
          const send = (confirmarReasignacion) =>
            fetch('/api/create-admin-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({
                email,
                password,
                restaurante_id: restauranteId,
                confirmar_reasignacion: confirmarReasignacion,
              }),
            });
          let res = await send(false);
          /** @type {{ ok?: boolean, error?: string, code?: string, email?: string, reused?: boolean }} */
          let data = await res.json().catch(() => ({}));

          if (res.status === 409 && data.code === 'REASSIGN_REQUIRED') {
            if (!window.confirm(`${data.error}\n\n¿Continuar?`)) {
              submitBtn.disabled = false;
              submitBtn.textContent = idleLabel;
              return;
            }
            res = await send(true);
            data = await res.json().catch(() => ({}));
          }

          if (!res.ok || !data.ok) {
            feedback.textContent = data.error || 'No se pudo crear el usuario.';
            feedback.classList.add('text-rose-400');
            feedback.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.textContent = idleLabel;
            return;
          }

          feedback.textContent = data.reused
            ? `Actualizado: ${data.email || email} (Admin Operativo).`
            : `Creado: ${data.email || email} (Admin Operativo).`;
          feedback.classList.add('text-emerald-400');
          feedback.classList.remove('hidden');
          submitBtn.textContent = '¡Credenciales Listas!';
          if (passwordInput instanceof HTMLInputElement) passwordInput.value = '';
          markAccessActive(form);
          submitBtn.disabled = false;
          window.setTimeout(() => {
            if (submitBtn.textContent === '¡Credenciales Listas!') {
              submitBtn.textContent = ACTIVE_CTA;
            }
          }, 2500);
        } catch (err) {
          feedback.textContent =
            err instanceof Error ? err.message : 'Error de red al crear credenciales.';
          feedback.classList.add('text-rose-400');
          feedback.classList.remove('hidden');
          submitBtn.disabled = false;
          submitBtn.textContent = idleLabel;
        }
      });
    });
  }

  function initHubSearch() {
    const input = document.querySelector('[data-hub-search]');
    const clearBtn = document.querySelector('[data-hub-search-clear]');
    const countEl = document.querySelector('[data-hub-search-count]');
    const emptyEl = document.querySelector('[data-hub-search-empty]');
    const cards = document.querySelectorAll('[data-hub-name]');
    if (!(input instanceof HTMLInputElement) || !cards.length) return;
    if (input.dataset.bound === 'true') return;
    input.dataset.bound = 'true';

    /**
     * @param {string} value
     */
    function normalize(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }

    function applyFilter() {
      const q = normalize(input.value);
      let visible = 0;

      cards.forEach((card) => {
        if (!(card instanceof HTMLElement)) return;
        const hay = normalize(card.dataset.hubName || '');
        const show = !q || hay.includes(q);
        card.hidden = !show;
        card.style.display = show ? '' : 'none';
        if (show) visible += 1;
      });

      if (clearBtn instanceof HTMLElement) {
        clearBtn.hidden = !q;
      }
      if (countEl) {
        countEl.textContent =
          visible === 1 ? '1 local' : `${visible} locales`;
      }
      if (emptyEl instanceof HTMLElement) {
        emptyEl.hidden = visible > 0;
      }
    }

    input.addEventListener('input', applyFilter);
    clearBtn?.addEventListener('click', () => {
      input.value = '';
      input.focus();
      applyFilter();
    });
  }

  function initNuevoRestModal() {
    const overlay = document.querySelector('[data-nuevo-rest-overlay]');
    if (!(overlay instanceof HTMLElement)) return;
    if (overlay.dataset.bound === 'true') return;
    overlay.dataset.bound = 'true';

    const form = document.getElementById('nuevo-rest-form');
    const slugInput = document.getElementById('slug');
    const nombreInput = document.getElementById('nombre_comercial');
    const submitBtn = document.getElementById('create-submit');
    const card = overlay.querySelector('[data-nuevo-rest-card]');

    /**
     * @param {string | null | undefined} value
     */
    function toSlug(value) {
      return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    /**
     * @param {string} url
     */
    function cloudinaryTrim(url) {
      const raw = String(url || '').trim();
      if (!raw) return '';
      const marker = '/upload/';
      const at = raw.indexOf(marker);
      if (at === -1 || !/cloudinary\.com/i.test(raw)) return raw;
      const after = raw.slice(at + marker.length);
      if (/e_trim/.test(after)) return raw;
      return `${raw.slice(0, at + marker.length)}e_trim/${after}`;
    }

    function openModal() {
      overlay.hidden = false;
      document.documentElement.classList.add('overflow-hidden');
      const focusEl = nombreInput instanceof HTMLInputElement ? nombreInput : null;
      window.setTimeout(() => focusEl?.focus(), 30);
    }

    function closeModal() {
      overlay.hidden = true;
      document.documentElement.classList.remove('overflow-hidden');
      overlay.dataset.openOnLoad = 'false';
    }

    document.querySelectorAll('[data-nuevo-rest-open]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });

    document.querySelectorAll('[data-nuevo-rest-close]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal());
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    if (card instanceof HTMLElement) {
      card.addEventListener('click', (e) => e.stopPropagation());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden) closeModal();
    });

    let slugTouched = Boolean(
      slugInput instanceof HTMLInputElement && slugInput.value.trim(),
    );

    slugInput?.addEventListener('input', () => {
      slugTouched = true;
      if (slugInput instanceof HTMLInputElement) {
        const cleaned = toSlug(slugInput.value);
        if (cleaned !== slugInput.value) slugInput.value = cleaned;
      }
    });

    nombreInput?.addEventListener('input', () => {
      if (!slugTouched && slugInput instanceof HTMLInputElement) {
        slugInput.value = toSlug(
          nombreInput instanceof HTMLInputElement ? nombreInput.value : '',
        );
      }
    });

    /**
     * @param {File} file
     * @returns {Promise<{ url: string }>}
     */
    async function uploadToCloudinary(file) {
      const slugValue =
        slugInput instanceof HTMLInputElement ? slugInput.value.trim() : '';
      const body = new FormData();
      body.append('file', file);
      if (slugValue) body.append('restaurante_slug', slugValue);
      body.append('asset_type', 'identity');
      const res = await fetch('/api/upload', { method: 'POST', body });
      /** @type {{ ok?: boolean, url?: string, secure_url?: string, error?: string }} */
      const data = await res.json().catch(() => ({}));
      const url = String(data.url || data.secure_url || '').trim();
      if (!res.ok || !url) {
        throw new Error(data.error || 'No se pudo subir la imagen');
      }
      return { url };
    }

    /**
     * @param {'logo' | 'portada'} kind
     * @param {boolean} loading
     */
    function setLoading(kind, loading) {
      const el = document.querySelector(`[data-upload-loading="${kind}"]`);
      if (el instanceof HTMLElement) {
        el.classList.toggle('hidden', !loading);
        el.classList.toggle('flex', loading);
      }
    }

    /**
     * @param {'logo' | 'portada'} kind
     * @param {string} url
     */
    function showPreview(kind, url) {
      const placeholder = document.querySelector(`[data-upload-placeholder="${kind}"]`);
      const preview = document.querySelector(`[data-upload-preview="${kind}"]`);
      const img = document.querySelector(`[data-upload-img="${kind}"]`);
      const src = kind === 'logo' ? cloudinaryTrim(url) : url;
      if (img instanceof HTMLImageElement) {
        img.src = src;
        img.hidden = false;
      }
      if (placeholder instanceof HTMLElement) placeholder.hidden = true;
      if (preview instanceof HTMLElement) preview.hidden = false;
    }

    /**
     * @param {'logo' | 'portada'} kind
     * @param {string} message
     * @param {'idle' | 'ok' | 'err'} state
     */
    function setStatus(kind, message, state) {
      const el = document.querySelector(`[data-upload-status="${kind}"]`);
      if (!(el instanceof HTMLElement)) return;
      el.textContent = message;
      el.className =
        state === 'ok'
          ? 'mt-1 min-h-[1rem] text-[10px] text-emerald-600 dark:text-emerald-400'
          : state === 'err'
            ? 'mt-1 min-h-[1rem] text-[10px] text-rose-600 dark:text-rose-400'
            : 'mt-1 min-h-[1rem] text-[10px] text-zinc-400';
    }

    /**
     * @param {'logo' | 'portada'} kind
     */
    function bindUploader(kind) {
      const fileInput = document.getElementById(
        kind === 'logo' ? 'input-logo-file' : 'input-portada-file',
      );
      const trigger = document.querySelector(`[data-upload-trigger="${kind}"]`);
      if (!(fileInput instanceof HTMLInputElement) || !(trigger instanceof HTMLElement)) {
        return;
      }

      trigger.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;

        setLoading(kind, true);
        setStatus(kind, 'Cargando...', 'idle');

        try {
          const { url } = await uploadToCloudinary(file);

          if (kind === 'logo') {
            const hidden = document.getElementById('logo_url');
            if (hidden instanceof HTMLInputElement) hidden.value = url;
          } else {
            const hidden = document.querySelector('[data-portada-hidden]');
            const alias = document.querySelector('[data-portada-alias]');
            if (hidden instanceof HTMLInputElement) hidden.value = url;
            if (alias instanceof HTMLInputElement) alias.value = url;
          }

          showPreview(kind, url);
          setStatus(kind, '✓ Subido', 'ok');
        } catch (err) {
          setStatus(
            kind,
            err instanceof Error ? err.message : 'Error al subir',
            'err',
          );
        } finally {
          setLoading(kind, false);
        }
      });
    }

    bindUploader('logo');
    bindUploader('portada');

    // Prefill previews after validation error
    {
      const logoHidden = document.getElementById('logo_url');
      if (logoHidden instanceof HTMLInputElement && logoHidden.value.trim()) {
        showPreview('logo', logoHidden.value.trim());
      }
      const portadaHidden = document.querySelector('[data-portada-hidden]');
      if (portadaHidden instanceof HTMLInputElement && portadaHidden.value.trim()) {
        showPreview('portada', portadaHidden.value.trim());
      }
    }

    form?.addEventListener('submit', () => {
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando…';
      }
    });

    // ?nuevo=1 or SSR error reopen
    const params = new URLSearchParams(window.location.search);
    if (overlay.dataset.openOnLoad === 'true' || params.get('nuevo') === '1') {
      openModal();
      if (params.get('nuevo') === '1') {
        params.delete('nuevo');
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', next);
      }
    }
  }

  function initSuperNetTimeframe() {
    const panel = document.querySelector('[data-super-panel="metricas"]');
    if (!(panel instanceof HTMLElement)) return;
    if (panel.dataset.tfBound === 'true') return;
    panel.dataset.tfBound = 'true';

    const bar = panel.querySelector('[data-super-timeframe-bar]');
    const monthSelect = panel.querySelector('[data-super-timeframe-select]');
    if (!(bar instanceof HTMLElement)) return;

    /** @type {any} */
    let series = {
      eventMode: false,
      currentMonth: '',
      all: { total: 0, byRest: {}, topPlatoByRest: {}, topPlatos: [], rankingMayor: [], rankingMenor: [] },
      months: {},
    };
    try {
      const raw = panel.getAttribute('data-network-series');
      if (raw) series = JSON.parse(raw);
    } catch {
      /* keep empty */
    }

    const TF_ON =
      'super-tf-on px-3 py-1.5 rounded-xl font-semibold bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs';
    const TF_OFF =
      'px-3 py-1.5 rounded-xl font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors';

    /**
     * @param {number} n
     */
    function formatKpi(n) {
      return (Number(n) || 0).toLocaleString('es-VE');
    }

    /**
     * @param {unknown} value
     */
    function esc(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    /**
     * @param {string | null | undefined} name
     */
    function initials(name) {
      return String(name || '')
        .trim()
        .slice(0, 2)
        .toUpperCase() || '—';
    }

    /**
     * @param {string} url
     */
    function trimLogo(url) {
      const raw = String(url || '').trim();
      if (!raw) return '';
      const marker = '/upload/';
      const at = raw.indexOf(marker);
      if (at === -1 || !/cloudinary\.com/i.test(raw)) return raw;
      const after = raw.slice(at + marker.length);
      if (/e_trim/.test(after)) return raw;
      return `${raw.slice(0, at + marker.length)}e_trim/${after}`;
    }

    /**
     * @param {any} bucket
     * @param {string} periodLabel
     */
    function applyBucket(bucket, periodLabel) {
      const data = bucket || {
        total: 0,
        byRest: {},
        topPlatoByRest: {},
        topPlatos: [],
        rankingMayor: [],
        rankingMenor: [],
      };

      const kpi = panel.querySelector('[data-net-kpi="vistas-webapps"]');
      if (kpi instanceof HTMLElement) kpi.textContent = formatKpi(data.total);

      const col = panel.querySelector('[data-net-visits-col]');
      if (col instanceof HTMLElement) {
        col.textContent = periodLabel === 'General' ? 'Visitas' : `Visitas (${periodLabel})`;
      }
      const hint = panel.querySelector('[data-net-visits-hint]');
      if (hint instanceof HTMLElement) {
        hint.textContent =
          periodLabel === 'General'
            ? 'Visitas · histórico agregado'
            : `Visitas · ${periodLabel}`;
      }
      panel.querySelectorAll('[data-net-period-label]').forEach((el) => {
        el.textContent = periodLabel;
      });

      panel.querySelectorAll('[data-net-row]').forEach((row) => {
        if (!(row instanceof HTMLElement)) return;
        const id = row.getAttribute('data-net-row') || '';
        const visitas = Number(data.byRest?.[id]) || 0;
        const visitasEl = row.querySelector('[data-net-visitas]');
        if (visitasEl instanceof HTMLElement) visitasEl.textContent = formatKpi(visitas);

        const topName = String(data.topPlatoByRest?.[id] || '').trim();
        const platoCell = row.querySelector('[data-net-plato-top]');
        if (platoCell instanceof HTMLElement) {
          if (topName) {
            platoCell.innerHTML = `<span class="text-zinc-700 dark:text-zinc-300">${esc(topName)}</span>`;
          } else {
            platoCell.innerHTML =
              '<span class="super-net-empty text-zinc-300 dark:text-zinc-700 font-mono text-xs">—</span>';
          }
        }
      });

      /**
       * @param {HTMLElement | null} list
       * @param {Array<{ nombre: string, restaurante: string, vistas: number }>} items
       */
      function renderTopPlatos(list, items) {
        if (!(list instanceof HTMLElement)) return;
        const rows = Array.isArray(items) ? items : [];
        if (rows.length === 0) {
          list.innerHTML =
            '<li class="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800/80 px-4 py-6 text-center text-sm text-zinc-500">Sin vistas registradas en el periodo.</li>';
          return;
        }
        const max = Math.max(1, ...rows.map((r) => Number(r.vistas) || 0));
        list.innerHTML = rows
          .map((plato, i) => {
            const vistas = Number(plato.vistas) || 0;
            const pct = Math.round((vistas / max) * 100);
            return `<li class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div class="flex items-center gap-3">
                <span class="w-8 shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-500">#${String(i + 1).padStart(2, '0')}</span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-zinc-900 dark:text-white">${esc(plato.nombre || '—')}</p>
                  <p class="truncate text-[11px] text-zinc-500">${esc(plato.restaurante || '—')}</p>
                </div>
                <span class="shrink-0 font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">${formatKpi(vistas)}</span>
              </div>
              <div class="ml-11 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/80">
                <div class="h-full rounded-full bg-zinc-400/80 dark:bg-zinc-500/60" style="width:${pct}%"></div>
              </div>
            </li>`;
          })
          .join('');
      }

      /**
       * @param {HTMLElement | null} list
       * @param {Array<{ nombre: string, slug: string, visitas: number, logoUrl?: string }>} items
       */
      function renderLocalRank(list, items) {
        if (!(list instanceof HTMLElement)) return;
        const rows = Array.isArray(items) ? items : [];
        if (rows.length === 0) {
          list.innerHTML =
            '<li class="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800/80 px-4 py-6 text-center text-sm text-zinc-500">Sin locales para ranking.</li>';
          return;
        }
        const max = Math.max(1, ...rows.map((r) => Number(r.visitas) || 0));
        list.innerHTML = rows
          .map((local, i) => {
            const vistas = Number(local.visitas) || 0;
            const pct = Math.round((vistas / max) * 100);
            const logo = trimLogo(local.logoUrl || '');
            const media = logo
              ? `<img src="${esc(logo)}" alt="${esc(local.nombre || '')}" class="w-8 h-8 rounded-lg object-contain bg-zinc-50 dark:bg-zinc-950 p-1 border border-zinc-200 dark:border-zinc-800 shrink-0" loading="lazy" decoding="async" />`
              : `<div class="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-mono font-bold text-zinc-500 dark:text-zinc-300 shrink-0">${esc(initials(local.nombre))}</div>`;
            const slug = local.slug ? `/${local.slug}` : '—';
            return `<li class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div class="flex items-center gap-3">
                <span class="w-8 shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-500">#${String(i + 1).padStart(2, '0')}</span>
                ${media}
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-zinc-900 dark:text-white">${esc(local.nombre || '—')}</p>
                  <p class="truncate font-mono text-[11px] text-zinc-500">${esc(slug)}</p>
                </div>
                <span class="shrink-0 font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">${formatKpi(vistas)}</span>
              </div>
              <div class="ml-11 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/80">
                <div class="h-full rounded-full bg-zinc-400/80 dark:bg-zinc-500/60" style="width:${pct}%"></div>
              </div>
            </li>`;
          })
          .join('');
      }

      renderTopPlatos(
        /** @type {HTMLElement | null} */ (panel.querySelector('[data-net-top-platos]')),
        data.topPlatos,
      );
      renderLocalRank(
        /** @type {HTMLElement | null} */ (panel.querySelector('[data-net-rank-mayor]')),
        data.rankingMayor,
      );
      renderLocalRank(
        /** @type {HTMLElement | null} */ (panel.querySelector('[data-net-rank-menor]')),
        data.rankingMenor,
      );
    }

    /**
     * @param {'all' | 'current' | 'month'} mode
     * @param {string} [month]
     */
    function setTimeframe(mode, month = '') {
      bar.querySelectorAll('[data-super-timeframe]').forEach((btn) => {
        if (!(btn instanceof HTMLElement)) return;
        const on =
          mode === 'all'
            ? btn.getAttribute('data-super-timeframe') === 'all'
            : mode === 'current'
              ? btn.getAttribute('data-super-timeframe') === 'current'
              : false;
        btn.className = on ? TF_ON : TF_OFF;
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (monthSelect instanceof HTMLSelectElement) {
        monthSelect.classList.toggle('super-tf-on', mode === 'month');
        if (mode !== 'month') monthSelect.value = '';
      }

      let bucket = series.all;
      let label = 'General';
      if (series.eventMode) {
        if (mode === 'current') {
          bucket = series.months?.[series.currentMonth] || {
            total: 0,
            byRest: {},
            topPlatoByRest: {},
            topPlatos: [],
            rankingMayor: [],
            rankingMenor: [],
          };
          label = 'Este mes';
        } else if (mode === 'month' && month) {
          bucket = series.months?.[month] || {
            total: 0,
            byRest: {},
            topPlatoByRest: {},
            topPlatos: [],
            rankingMayor: [],
            rankingMenor: [],
          };
          const opt =
            monthSelect instanceof HTMLSelectElement
              ? [...monthSelect.options].find((o) => o.value === month)
              : null;
          label = opt?.textContent?.trim() || month;
        }
      }
      applyBucket(bucket, label);
    }

    bar.querySelectorAll('[data-super-timeframe]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-super-timeframe') === 'current' ? 'current' : 'all';
        setTimeframe(mode);
      });
    });

    if (monthSelect instanceof HTMLSelectElement) {
      monthSelect.addEventListener('change', () => {
        const value = monthSelect.value;
        if (!value) {
          setTimeframe('all');
          return;
        }
        setTimeframe('month', value);
      });
    }
  }

  function initSuperHub() {
    initSuperTabs();
    initHubSearch();
    initCardMenus();
    initFichaForms();
    initOperativoForms();
    initNuevoRestModal();
    initSuperNetTimeframe();
    void hydrateLogoPlatesFromCovers();
  }

  initSuperHub();
  document.addEventListener('astro:page-load', initSuperHub);
