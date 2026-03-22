import { createIncubatorTemplate } from './IncubatorTemplate.js';
import { applyPhaseVisuals, pulseAction, setAccentHue, setLiquidLevel } from './IncubatorAnimations.js';
import { t } from '../../../i18n/i18n.js';

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

    const template = createIncubatorTemplate(this.documentRef, t);
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
    this.refs.dpIncome = this.shadowRoot.querySelector('.js-dp-income');
    this.refs.dpTrait = this.shadowRoot.querySelector('.js-dp-trait');
    this.refs.dpTraitLabel = this.shadowRoot.querySelector('.js-dp-trait-label');
    this.refs.dpMorpho = this.shadowRoot.querySelector('.js-dp-morpho');
    this.refs.dpElements = this.shadowRoot.querySelector('.js-dp-elements');
    this.refs.dpStats = this.shadowRoot.querySelector('.js-dp-stats');
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

    const genome   = candidate?.metadata?.previewBlueprint?.genome || {};
    const stats    = candidate?.metadata?.previewBlueprint?.stats  || {};
    const tier     = genome.rarityTier || 'common';
    const score    = genome.rarityScore ?? 0;
    const pattern  = genome.colorPattern || 'solid';
    const mood     = genome.mood || '';
    const shape    = genome.bodyShape || '';
    const accessory = genome.accessory || 'none';
    const eyeStyle  = genome.eyeStyle || '';

    const tierLabels = {
      common:    t('rarity.common'),
      uncommon:  t('rarity.uncommon'),
      rare:      t('rarity.rare'),
      epic:      t('rarity.epic'),
      legendary: t('rarity.legendary'),
    };
    const tierColors = { common:'#94a3b8', uncommon:'#4caf50', rare:'#42a5f5', epic:'#ba68c8', legendary:'#ffb300' };
    const tierHues   = { common:190, uncommon:140, rare:210, epic:280, legendary:38 };
    const rarityIcons = { common:'◆', uncommon:'◆◆', rare:'◆◆◆', epic:'★', legendary:'★★' };

    const patternNames = {
      solid:'UNI', radial_glow:'LUEUR', gradient_v:'DÉG.↕', gradient_h:'DÉG.↔',
      gradient_diag:'DÉG.↗', duo_tone:'DUO', soft_spots:'TACHES', stripe_v:'RAYURES',
      galaxy_swirl:'GALAXIE', aurora:'AURORE', crystal_facets:'CRISTAL',
      prismatic:'PRISM', void_rift:'RIFT',
    };

    // ── Rarity badge (side panel) ────────────────────────────────────────
    if (this.refs.rarityBadge) {
      const label = tierLabels[tier] || t('rarity.common');
      const color = tierColors[tier] || '';
      this.refs.rarityBadge.textContent = candidate ? label : '';
      this.refs.rarityBadge.style.color  = color;
      this.refs.rarityBadge.dataset.tier = tier;
      this.refs.rarityBadge.title        = candidate ? `Score: ${Math.round(score)} / 100` : '';
    }
    if (this.refs.patternBadge) {
      this.refs.patternBadge.textContent = candidate ? (patternNames[pattern] || pattern) : '';
      this.refs.patternBadge.dataset.pattern = pattern;
    }

    // ── Display panel ────────────────────────────────────────────────────
    if (!this.refs.dpCandidateRow) return;

    if (!candidate) {
      this.refs.dpCandidateRow.hidden = true;
      if (this.refs.dpIdleHint) this.refs.dpIdleHint.hidden = false;
      if (this.refs.dpPrice) this.refs.dpPrice.textContent = '—';
      setAccentHue(this.refs.root, tierHues.common);
      return;
    }

    this.refs.dpCandidateRow.hidden = false;
    if (this.refs.dpIdleHint) this.refs.dpIdleHint.hidden = true;

    // Name
    if (this.refs.dpName) {
      this.refs.dpName.textContent = (candidate.displayName || t('incubator.entity_fallback')).toUpperCase();
    }

    // Rarity + pattern + income on same line
    if (this.refs.dpRarity) {
      this.refs.dpRarity.textContent = `${rarityIcons[tier] || '◆'} ${(tierLabels[tier] || '').toUpperCase()}`;
      this.refs.dpRarity.style.color = tierColors[tier] || '#94a3b8';
    }
    if (this.refs.dpPattern) {
      this.refs.dpPattern.textContent = patternNames[pattern] || pattern.toUpperCase();
    }

    // ── Trait comportemental dérivé des stats ───────────────────────────
    const traitData = this._derivePersonalityTrait(stats, mood);
    if (this.refs.dpTrait) {
      this.refs.dpTrait.textContent = traitData.label;
      this.refs.dpTrait.style.color = traitData.color;
    }
    if (this.refs.dpTraitLabel) {
      this.refs.dpTraitLabel.textContent = traitData.icon + ' ' + t('incubator.dp.trait');
    }

    // ── Morpho (forme dominante) ────────────────────────────────────────
    if (this.refs.dpMorpho) {
      const shapeLabel = shape ? shape.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : '—';
      this.refs.dpMorpho.textContent = shapeLabel;
    }

    // ── Éléments visuels (tags) ─────────────────────────────────────────
    if (this.refs.dpElements) {
      this.refs.dpElements.innerHTML = '';
      const elements = this._buildElementTags({ shape, accessory, eyeStyle, pattern, mood });
      elements.forEach(({ label, rarity }) => {
        const tag = document.createElement('span');
        tag.className = `dp-element-tag dp-element-tag--${rarity}`;
        tag.textContent = label;
        this.refs.dpElements.appendChild(tag);
      });
    }

    // ── Stats bars ──────────────────────────────────────────────────────
    if (this.refs.dpStats) {
      this.refs.dpStats.innerHTML = '';
      const statDefs = [
        { key: 'vitality',  label: 'VIT', color: '#34d399' },
        { key: 'agility',   label: 'AGI', color: '#60a5fa' },
        { key: 'curiosity', label: 'CUR', color: '#a78bfa' },
        { key: 'empathy',   label: 'EMP', color: '#f472b6' },
        { key: 'ferocity',  label: 'FER', color: '#f87171' },
        { key: 'stability', label: 'STB', color: '#fbbf24' },
      ];
      statDefs.forEach(({ key, label, color }) => {
        const val = Number(stats[key]) || 0;
        const pct = Math.round(val);
        const row = document.createElement('div');
        row.className = 'dp-stat-row';
        row.innerHTML = `
          <span class="dp-stat-label">${label}</span>
          <div class="dp-stat-bar-track">
            <div class="dp-stat-bar-fill" style="width:${pct}%;background:${color};box-shadow:0 0 6px ${color}88;"></div>
          </div>
          <span class="dp-stat-val">${pct}</span>
        `;
        this.refs.dpStats.appendChild(row);
      });
    }

    // ── Accent hue ───────────────────────────────────────────────────────
    setAccentHue(this.refs.root, tierHues[tier] ?? 190);
  }

  /** Dérive un trait de personnalité à partir des stats + mood. */
  _derivePersonalityTrait(stats, mood) {
    const fer = Number(stats.ferocity)  || 0;
    const agi = Number(stats.agility)   || 0;
    const emp = Number(stats.empathy)   || 0;
    const cur = Number(stats.curiosity) || 0;
    const stb = Number(stats.stability) || 0;

    const combativeScore = fer * 0.6 + agi * 0.4;
    const evasiveScore   = agi * 0.5 + stb * 0.5;
    const romanticScore  = emp * 0.7 + (mood === 'lovesick' ? 30 : 0);
    const explorerScore  = cur * 0.6 + agi * 0.4;
    const guardianScore  = stb * 0.6 + fer * 0.4;
    const mysticScore    = cur * 0.5 + emp * 0.5 + (mood === 'enlightened' ? 25 : 0);
    const tricksterScore = agi * 0.4 + fer * 0.3 + (mood === 'mischief' ? 25 : 0);
    const gentleScore    = emp * 0.6 + stb * 0.4 + (mood === 'calm' || mood === 'shy' ? 15 : 0);

    const scores = [
      { key:'combative', val:combativeScore, label:t('trait.combative'), color:'#f87171', icon:'⚔' },
      { key:'evasive',   val:evasiveScore,   label:t('trait.evasive'),   color:'#60a5fa', icon:'💨' },
      { key:'romantic',  val:romanticScore,  label:t('trait.romantic'),  color:'#f472b6', icon:'💖' },
      { key:'explorer',  val:explorerScore,  label:t('trait.explorer'),  color:'#a78bfa', icon:'🔭' },
      { key:'guardian',  val:guardianScore,  label:t('trait.guardian'),  color:'#34d399', icon:'🛡' },
      { key:'mystic',    val:mysticScore,    label:t('trait.mystic'),    color:'#c084fc', icon:'✦' },
      { key:'trickster', val:tricksterScore, label:t('trait.trickster'), color:'#fb923c', icon:'🃏' },
      { key:'gentle',    val:gentleScore,    label:t('trait.gentle'),    color:'#86efac', icon:'🌿' },
    ];
    scores.sort((a, b) => b.val - a.val);
    return scores[0];
  }

  /** Construit les tags d'éléments avec leur niveau de rareté. */
  _buildElementTags({ shape, accessory, eyeStyle, pattern, mood }) {
    const SHAPE_RARITY = {
      round:0,pear:1,dumpling:1,blob:1,teardrop:1,mochi:1,puff:2,wisp:2,jellybean:2,
      bell:2,comet:2,puddle:2,crystal:3,ribbon:3,lantern:3,crescent:3,star_body:4,
      diamond:4,twin_lobe:4,fractal:5,aurora_form:5,
    };
    const ACC_RARITY = {
      none:0,bow:1,flower:1,sprout:1,star_pin:1,halo:1,clover:1,leaf:1,mushroom:1,
      antenna:1,feather:1,shell_pin:1,horns:1,crown:1,spikes:1,bone_pin:1,broken_halo:1,
      ribbon_bow:2,mini_crown:2,candy_pin:2,cloud_puff:2,cherry_clip:2,twig:2,
      bandana:2,monocle_top:2,lantern_float:2,beret:2,cat_ears:2,bunny_ears:2,
      dog_ears:2,thorn_ring:2,skull_pin:2,iron_mask:2,fox_ears:2,witch_hat:2,
      crystal_tiara:3,rainbow_halo:3,petal_wreath:3,ancient_rune:3,gem_cluster:3,
      wind_streamer:3,dragon_wings:3,ninja_headband:2,katana:3,oni_horns:2,
      demon_wings:3,void_crown:3,shadow_cloak:3,
      fairy_wings:4,starfall_crown:4,spirit_orbs:4,eldritch_eye:4,
      celestial_halo:5,
    };
    const EYE_RARITY = {
      dot:0,sparkle:1,big_round:1,sleepy:1,happy_arc:1,wide:1,slit:1,angry_arc:1,
      heart:1,wink:1,half_lid:1,tired:1,
      droplet:2,button:2,uneven:2,void:2,monocle:2,shiny_round:2,cat_slit:2,mascara:2,
      star_eye:3,twin_spark:3,square:3,cross:3,number_3:3,sus:3,
      X_eye:3,spiral:3,dollar:3,triangle_eye:3,pupil_star:3,
      abyss:4,flame_eye:4,tearful:4,glowing:4,omega:4,loading:4,
      rainbow_iris:5,crystal_eye:5,bleeding_eye:5,galaxy_eye:5,
    };
    const PAT_RARITY = {
      solid:0,radial_glow:1,gradient_v:2,gradient_h:2,gradient_diag:2,
      duo_tone:3,soft_spots:3,stripe_v:3,
      galaxy_swirl:4,aurora:4,crystal_facets:4,
      prismatic:5,void_rift:5,
    };

    const rarityClass = (r) => {
      if (r >= 5) return 'legendary';
      if (r >= 4) return 'epic';
      if (r >= 3) return 'rare';
      if (r >= 2) return 'uncommon';
      return 'common';
    };

    const tags = [];
    if (shape && shape !== 'round') {
      tags.push({ label: shape.replace(/_/g,' '), rarity: rarityClass(SHAPE_RARITY[shape] ?? 0) });
    }
    if (accessory && accessory !== 'none') {
      tags.push({ label: accessory.replace(/_/g,' '), rarity: rarityClass(ACC_RARITY[accessory] ?? 0) });
    }
    if (eyeStyle && eyeStyle !== 'dot') {
      tags.push({ label: eyeStyle.replace(/_/g,' '), rarity: rarityClass(EYE_RARITY[eyeStyle] ?? 0) });
    }
    if (pattern && pattern !== 'solid') {
      tags.push({ label: pattern.replace(/_/g,' '), rarity: rarityClass(PAT_RARITY[pattern] ?? 0) });
    }
    if (tags.length === 0) {
      tags.push({ label: 'standard', rarity: 'common' });
    }
    return tags;
  }

  updatePrice(price, incomeRate) {
    if (this.refs.price) this.refs.price.textContent = Number.isFinite(price) ? `${price.toLocaleString('fr-FR')} ⬡` : '—';
    if (this.refs.dpPrice) this.refs.dpPrice.textContent = Number.isFinite(price) ? `${price.toLocaleString('fr-FR')} ⬡` : '—';
    if (this.refs.dpIncome && Number.isFinite(incomeRate)) {
      this.refs.dpIncome.textContent = `+${incomeRate.toFixed(1)}/min`;
    }
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
