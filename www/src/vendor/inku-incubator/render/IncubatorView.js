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
    this.refs.title = this.shadowRoot.querySelector('.js-title');
    this.refs.status = this.shadowRoot.querySelector('.js-status');
    this.refs.price = this.shadowRoot.querySelector('.js-price');
    this.refs.candidateName = this.shadowRoot.querySelector('.js-candidate-name');
    this.refs.diagnosticLabel = this.shadowRoot.querySelector('.js-diagnostic-label');
    this.refs.candidateBay = this.shadowRoot.querySelector('.js-candidate-bay');
    this.refs.placeholder = this.shadowRoot.querySelector('.js-candidate-placeholder');
    this.refs.buyButtons = Array.from(this.shadowRoot.querySelectorAll('.js-buy-button, .js-buy-button-secondary'));
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
    this.refs.diagnosticLabel.textContent = this.config.ui.diagnosticLabel;
    const [sideBuyButton, ...secondaryBuyButtons] = this.refs.buyButtons;
    if (sideBuyButton) {
      sideBuyButton.textContent = this.config.ui.integrationEmbedMode ? '' : this.config.ui.buyButtonLabel;
      sideBuyButton.setAttribute('aria-label', this.config.ui.buyButtonLabel);
    }
    secondaryBuyButtons.forEach((button) => {
      button.textContent = this.config.ui.buyButtonLabel;
    });
    this.refs.purgeButton.textContent = this.config.ui.purgeButtonLabel;

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
    this.refs.candidateName.textContent = candidate ? candidate.displayName : 'No candidate loaded';
    this.refs.placeholder.hidden = Boolean(candidate);
    this.refs.root.classList.toggle('has-candidate', Boolean(candidate));

    // ── Rarity badge ─────────────────────────────────────────────────────
    const tier       = candidate?.metadata?.previewBlueprint?.genome?.rarityTier || 'common';
    const score      = candidate?.metadata?.previewBlueprint?.genome?.rarityScore ?? 0;
    const pattern    = candidate?.metadata?.previewBlueprint?.genome?.colorPattern || 'solid';
    const tierLabels = { common:'Commun', uncommon:'Peu commun', rare:'Rare', epic:'Épique', legendary:'Légendaire' };
    const tierColors = { common:'', uncommon:'#4caf50', rare:'#42a5f5', epic:'#ba68c8', legendary:'#ffb300' };
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

    // ── Shift accent hue based on rarity tier ───────────────────────────
    const hue = tierHues[tier] ?? 190;
    setAccentHue(this.refs.root, hue);
  }

  updatePrice(price) {
    this.refs.price.textContent = Number.isFinite(price) ? `${price.toLocaleString('fr-FR')} C` : '—';
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
    const buttons = [...this.refs.buyButtons, this.refs.purgeButton];
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
