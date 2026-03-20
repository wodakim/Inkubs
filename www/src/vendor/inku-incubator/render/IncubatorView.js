import { createIncubatorTemplate } from './IncubatorTemplate.js';
import { applyPhaseVisuals, pulseAction, setAccentHue, setLiquidLevel } from './IncubatorAnimations.js';

export class IncubatorView {
  constructor({ documentRef, hostElement, stylesheetText, config }) {
    this.documentRef = documentRef;
    this.hostElement = hostElement;
    this.stylesheetText = stylesheetText;
    this.config = config;
    this.shadowRoot = null;
    this.refs = {};
  }

  mount() {
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    const styleTag = this.documentRef.createElement('style');
    styleTag.textContent = this.stylesheetText;
    this.shadowRoot.appendChild(styleTag);

    const template = createIncubatorTemplate(this.documentRef);
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.refs.root = this.shadowRoot.querySelector('.inku-incubator');
    this.refs.title = this.shadowRoot.querySelector('.display-panel__label');
    this.refs.status = this.shadowRoot.querySelector('.js-status');
    this.refs.dpCandidateRow = this.shadowRoot.querySelector('.js-dp-candidate-row');
    this.refs.dpName = this.shadowRoot.querySelector('.js-dp-name');
    this.refs.dpRarity = this.shadowRoot.querySelector('.js-dp-rarity');
    this.refs.dpPattern = this.shadowRoot.querySelector('.js-dp-pattern');
    this.refs.dpPrice = this.shadowRoot.querySelector('.js-dp-price');
    this.refs.dpIdleHint = this.shadowRoot.querySelector('.js-dp-idle-hint');
    this.refs.blinker = this.shadowRoot.querySelector('.js-blinker');
    this.refs.price = null; // moved to display panel only
    this.refs.candidateName = null; // moved to display panel only
    this.refs.diagnosticLabel = null; // removed
    this.refs.candidateBay = this.shadowRoot.querySelector('.js-candidate-bay');
    this.refs.placeholder = this.shadowRoot.querySelector('.js-candidate-placeholder');
    this.refs.buyButtons = Array.from(this.shadowRoot.querySelectorAll('.js-buy-button'));
    this.refs.purgeButton = this.shadowRoot.querySelector('.js-purge-button');
    this.refs.sideMeterFill = this.shadowRoot.querySelector('.js-side-meter-fill');
    this.refs.tubeFrontGlass = this.shadowRoot.querySelector('.tube-front-glass');
    this.refs.storageTrigger = this.shadowRoot.querySelector('.js-storage-trigger');
    this.refs.rarityBadge  = this.shadowRoot.querySelector('.js-rarity-badge');
    this.refs.patternBadge = this.shadowRoot.querySelector('.js-pattern-badge');

    if (this.config.ui.integrationHideActions) {
      this.refs.root.dataset.integrationHideActions = 'true';
    }

    if (this.config.ui.integrationEmbedMode) {
      this.refs.root.dataset.integrationEmbedMode = 'true';
    }

    this.refs.title.textContent = this.config.ui.title;
    const [sideBuyButton] = this.refs.buyButtons;
    if (sideBuyButton) {
      // Side buy button: NO text, only color state (green/red)
      sideBuyButton.textContent = '';
      sideBuyButton.setAttribute('aria-label', this.config.ui.buyButtonLabel);
    }
    this.refs.purgeButton.textContent = this.config.ui.purgeButtonLabel;

    // Start blinker animation
    if (this.refs.blinker) {
      setInterval(() => {
        this.refs.blinker.style.opacity = this.refs.blinker.style.opacity === '0' ? '1' : '0';
      }, 600);
    }

    setAccentHue(this.refs.root, this.config.theme.accentHue);
    setLiquidLevel(this.refs.root, this.config.theme.liquidLevel);
    this.updateState({ phase: 'idle', statusLabel: this.config.ui.statusLabels.idle });
    this.updateCandidate(null);
    this.updatePrice(null);
    this.setEnergyMeterState(this.config.ui.integrationAcquireState || 'blocked');
    this.setEnergyMeter(0.75);
  }

  bindActions({ onBuy, onPurge, onOpenStorage }) {
    this.refs.buyButtons.forEach((button) => {
      button.addEventListener('click', () => {
        pulseAction(button);
        onBuy();
      });
    });

    this.refs.purgeButton.addEventListener('click', () => {
      pulseAction(this.refs.purgeButton);
      onPurge();
    });

    if (typeof onOpenStorage === 'function' && this.refs.storageTrigger) {
      this.refs.storageTrigger.addEventListener('click', () => {
        pulseAction(this.refs.storageTrigger);
        onOpenStorage();
      });
    }
  }

  updateState({ phase, statusLabel }) {
    applyPhaseVisuals(this.refs.root, phase);
    this.refs.status.textContent = statusLabel;
  }

  updateCandidate(candidate) {
    if (this.refs.placeholder) this.refs.placeholder.hidden = Boolean(candidate);
    this.refs.root.classList.toggle('has-candidate', Boolean(candidate));

    // ── Rarity badge ─────────────────────────────────────────────────────
    const tier       = candidate?.metadata?.previewBlueprint?.genome?.rarityTier || 'common';
    const score      = candidate?.metadata?.previewBlueprint?.genome?.rarityScore ?? 0;
    const pattern    = candidate?.metadata?.previewBlueprint?.genome?.colorPattern || 'solid';
    const tierLabels = { common:'Commun', uncommon:'Peu commun', rare:'Rare', epic:'Épique', legendary:'Légendaire' };
    const tierColors = { common:'#94a3b8', uncommon:'#4caf50', rare:'#42a5f5', epic:'#ba68c8', legendary:'#ffb300' };
    const tierHues   = { common:190, uncommon:140, rare:210, epic:280, legendary:38 };

    if (this.refs.rarityBadge) {
      const label = tierLabels[tier] || 'Commun';
      const color = tierColors[tier] || '';
      this.refs.rarityBadge.textContent = candidate ? label : '';
      this.refs.rarityBadge.style.color  = color;
      this.refs.rarityBadge.dataset.tier = tier;
      this.refs.rarityBadge.title        = candidate ? `Score: ${Math.round(score)} / 100` : '';
    }
    if (this.refs.patternBadge) {
      const patternNames = {
        solid:'Uni', radial_glow:'Lueur', gradient_v:'Dégradé ↕', gradient_h:'Dégradé ↔',
        gradient_diag:'Dégradé ↗', duo_tone:'Duo', soft_spots:'Taches', stripe_v:'Rayures',
        galaxy_swirl:'Galaxie', aurora:'Aurore', crystal_facets:'Cristal',
        prismatic:'Prismatique', void_rift:'Rift'
      };
      this.refs.patternBadge.textContent = candidate ? (patternNames[pattern] || pattern) : '';
      this.refs.patternBadge.dataset.pattern = pattern;
    }

    // ── Display panel screen update ──────────────────────────────────────
    if (this.refs.dpCandidateRow) {
      if (candidate) {
        const patternNames = {
          solid:'UNI', radial_glow:'LUEUR', gradient_v:'DÉGRADÉ ↕', gradient_h:'DÉGRADÉ ↔',
          gradient_diag:'DÉGRADÉ ↗', duo_tone:'DUO', soft_spots:'TACHES', stripe_v:'RAYURES',
          galaxy_swirl:'GALAXIE', aurora:'AURORE', crystal_facets:'CRISTAL',
          prismatic:'PRISMATIQUE', void_rift:'RIFT'
        };
        const rarityIcons = { common:'◆', uncommon:'◆◆', rare:'◆◆◆', epic:'★', legendary:'★★' };
        this.refs.dpName.textContent = (candidate.displayName || 'ENTITÉ').toUpperCase();
        this.refs.dpRarity.textContent = `${rarityIcons[tier] || '◆'} ${(tierLabels[tier] || 'Commun').toUpperCase()}`;
        this.refs.dpRarity.style.color = tierColors[tier] || '#94a3b8';
        this.refs.dpPattern.textContent = patternNames[pattern] || pattern.toUpperCase();
        this.refs.dpCandidateRow.hidden = false;
        if (this.refs.dpIdleHint) this.refs.dpIdleHint.hidden = true;
      } else {
        this.refs.dpCandidateRow.hidden = true;
        if (this.refs.dpIdleHint) this.refs.dpIdleHint.hidden = false;
        if (this.refs.dpPrice) this.refs.dpPrice.textContent = '—';
      }
    }

    // ── Shift accent hue based on rarity tier ───────────────────────────
    const hue = tierHues[tier] ?? 190;
    setAccentHue(this.refs.root, hue);
  }

  updatePrice(price) {
    if (this.refs.price) this.refs.price.textContent = Number.isFinite(price) ? `${price.toLocaleString('fr-FR')} C` : '—';
    // Also update display panel price
    if (this.refs.dpPrice) this.refs.dpPrice.textContent = Number.isFinite(price) ? `${price.toLocaleString('fr-FR')} C` : '—';
  }

  setEnergyMeter(ratio) {
    const clamped = Math.max(0, Math.min(1, ratio));
    this.refs.sideMeterFill.style.transform = `scaleY(${clamped})`;
  }

  setEnergyMeterState(state = 'blocked') {
    this.refs.root.dataset.meterState = state;
  }

  clearCandidateBay() {
    this.refs.candidateBay.querySelectorAll('[data-incubator-rendered-candidate="true"]').forEach((node) => node.remove());
  }

  getCandidateBay() {
    return this.refs.candidateBay;
  }

  setButtonsEnabled(isEnabled) {
    const buttons = [...this.refs.buyButtons, this.refs.purgeButton].filter(Boolean);
    buttons.forEach((button) => {
      button.disabled = !isEnabled;
    });
  }

  destroy() {
    this.shadowRoot?.replaceChildren();
    this.shadowRoot = null;
    this.refs = {};
  }
}
