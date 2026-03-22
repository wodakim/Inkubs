export function createIncubatorTemplate(documentRef, t = (k) => k) {
  const template = documentRef.createElement('template');
  template.innerHTML = `
    <section class="inku-incubator" aria-label="Inkü incubator runtime">
      <div class="ambient-halo" aria-hidden="true"></div>

      <div class="frame">
        <header class="display-panel" part="display-panel">
          <div class="display-panel__crt-overlay" aria-hidden="true"></div>
          <div class="display-panel__glass"></div>
          <div class="display-panel__scanline"></div>
          <div class="display-panel__screen">
            <div class="display-panel__header-row">
              <span class="display-panel__label">INKU-LAB</span>
              <span class="display-panel__blinker js-blinker">▮</span>
            </div>
            <div class="display-panel__status js-status"></div>
            <div class="display-panel__divider"></div>

            <!-- Candidate info block — hidden until a candidate is staged -->
            <div class="display-panel__candidate-row js-dp-candidate-row" hidden>

              <!-- Row 1: Name + Price -->
              <div class="display-panel__top-row">
                <div class="display-panel__candidate-name js-dp-name"></div>
                <div class="display-panel__candidate-price">
                  <span class="display-panel__price-label">${t('incubator.price_label')}</span>
                  <span class="display-panel__price-value js-dp-price">—</span>
                </div>
              </div>

              <!-- Row 2: Rarity + Pattern -->
              <div class="display-panel__candidate-meta">
                <span class="display-panel__candidate-rarity js-dp-rarity"></span>
                <span class="display-panel__candidate-pattern js-dp-pattern"></span>
                <span class="display-panel__candidate-income js-dp-income"></span>
              </div>

              <div class="display-panel__divider"></div>

              <!-- Row 3: Mood / Trait comportemental -->
              <div class="display-panel__info-row">
                <div class="display-panel__info-block">
                  <span class="display-panel__info-label js-dp-trait-label">${t('incubator.dp.trait')}</span>
                  <span class="display-panel__info-value js-dp-trait"></span>
                </div>
                <div class="display-panel__info-block">
                  <span class="display-panel__info-label">${t('incubator.dp.morpho')}</span>
                  <span class="display-panel__info-value js-dp-morpho"></span>
                </div>
              </div>

              <!-- Row 4: Elements (shape + acc + eye + pattern) -->
              <div class="display-panel__elements js-dp-elements"></div>

              <div class="display-panel__divider"></div>

              <!-- Row 5: Stats bars -->
              <div class="display-panel__stats-label">${t('incubator.dp.stats')}</div>
              <div class="display-panel__stats js-dp-stats"></div>

            </div>

            <div class="display-panel__idle-hint js-dp-idle-hint">${t('incubator.no_entity')}</div>
          </div>
        </header>

        <div class="chassis">
          <aside class="aux-panel aux-panel--left" part="aux-panel-left">
            <button class="storage-console-trigger js-storage-trigger" type="button" aria-label="${t('incubator.open_archive_aria')}"></button>
            <div class="console console--radar">
              <div class="radar">
                <div class="radar__ring"></div>
                <div class="radar__cross radar__cross--h"></div>
                <div class="radar__cross radar__cross--v"></div>
                <div class="radar__ping"></div>
              </div>
            </div>
            <div class="console-body">
              <div class="storage-console-readout" aria-hidden="true">
                <span class="storage-console-readout__label">${t('incubator.archive_label')}</span>
                <span class="storage-console-readout__value">${t('incubator.entities_label')}</span>
              </div>
            </div>
          </aside>

          <div class="vessel" part="vessel">
            <div class="cap"></div>
            <div class="glass-column">
              <div class="glass-reflection"></div>
              <div class="scanner-beam"></div>
              <div class="candidate-bay js-candidate-bay">
                <div class="candidate-placeholder js-candidate-placeholder">Awaiting canonical feed</div>
              </div>
              <div class="liquid-layer">
                <div class="liquid-sheen"></div>
                <div class="bubble bubble--1"></div>
                <div class="bubble bubble--2"></div>
                <div class="bubble bubble--3"></div>
                <div class="bubble bubble--4"></div>
                <div class="bubble bubble--5"></div>
                <div class="liquid-depth"></div>
              </div>
              <div class="tube-front-glass" aria-hidden="true">
                <div class="tube-front-glass__spec"></div>
                <div class="tube-front-glass__rim"></div>
              </div>
            </div>
            <div class="base">
              <div class="base__line"></div>
              <div class="base__vent base__vent--lg"></div>
              <div class="base__vent base__vent--sm"></div>
              <div class="base__shadow"></div>
            </div>
          </div>

          <aside class="aux-panel aux-panel--right" part="aux-panel-right">
            <div class="side-module">
              <div class="side-module__meter">
                <div class="side-module__meter-fill js-side-meter-fill"></div>
              </div>
              <button class="side-module__toggle js-buy-button" type="button"></button>
            </div>

            <div class="console console--gauges">
              <div class="gauge-strip">
                <div class="gauge-strip__bar gauge-strip__bar--1"></div>
                <div class="gauge-strip__bar gauge-strip__bar--2"></div>
                <div class="gauge-strip__bar gauge-strip__bar--3"></div>
              </div>
              <div class="console-divider"></div>
            </div>
            <div class="console-body console-body--actions">
              <div class="purchase-panel__meta purchase-panel__meta--slim">
                <span class="purchase-panel__rarity-badge js-rarity-badge" aria-live="polite"></span>
                <span class="purchase-panel__pattern-badge js-pattern-badge"></span>
              </div>
              <div class="purchase-panel__actions">
                <button class="action-button action-button--secondary js-purge-button" type="button"></button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  `;

  return template;
}
