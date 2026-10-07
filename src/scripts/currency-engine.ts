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

type CurrencyEngineOptions = {
  /** Guarda la divisa elegida para la próxima visita (solo en los menús reales). */
  persist?: boolean;
};

/**
 * Activa el selector de divisas dentro de `panel` y convierte sus `.precio-dinamico`.
 * La tasa BCV del día llega de /api/tasas-cambio.
 */
export function initCurrencyEngine(panel: HTMLElement, { persist = true }: CurrencyEngineOptions = {}) {
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
    if (!persist) return;
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
    if (persist) saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
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
