export function createIncubatorTemplate(documentRef) {
  const template = documentRef.createElement('template');
  template.innerHTML = `
    <section class="inku-incubator" aria-label="Inkü incubator runtime">
      <div class="ambient-halo" aria-hidden="true"></div>

      <div class="frame">
        <header class="display-panel" part="display-panel">
          <div class="display-panel__glass"></div>
          <div class="display-panel__scanline"></div>
          <div class="display-panel__title js-title"></div>
          <div class="display-panel__status js-status"></div>
        </header>

        <div class="chassis">
          <aside class="aux-panel aux-panel--left" part="aux-panel-left">
            <button class="storage-console-trigger js-storage-trigger" type="button" aria-label="Ouvrir l'archive d'entités"></button>
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
                <span class="storage-console-readout__label">ARCHIVE</span>
                <span class="storage-console-readout__value">ENTITÉS</span>
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
              <div class="purchase-panel">
                <div class="purchase-panel__label js-diagnostic-label"></div>
                <div class="purchase-panel__price js-price">—</div>
                <div class="purchase-panel__candidate js-candidate-name">No candidate loaded</div>
                <div class="purchase-panel__meta">
                  <span class="purchase-panel__rarity-badge js-rarity-badge" aria-live="polite"></span>
                  <span class="purchase-panel__pattern-badge js-pattern-badge"></span>
                </div>
                <div class="purchase-panel__actions">
                  <button class="action-button action-button--primary js-buy-button-secondary" type="button"></button>
                  <button class="action-button action-button--secondary js-purge-button" type="button"></button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  `;

  return template;
}
