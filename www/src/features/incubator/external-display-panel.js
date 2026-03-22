/**
 * external-display-panel.js
 * Le display panel CRT rendu dans le DOM externe (hors shadow DOM),
 * flottant au-dessus de l'incubateur sans perturber son layout.
 * Respecte le HUD en haut et la barre de navigation en bas.
 */

import { t } from '../../i18n/i18n.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function moodLabel(mood) {
    const MAP = {
        calm:'Calme', joyful:'Joyeux', sleepy:'Somnolent', mischief:'Espiègle',
        grumpy:'Grognon', curious:'Curieux', shy:'Timide', dreamy:'Rêveur',
        smug:'Suffisant', dizzy:'Étourdi', lovesick:'Amoureux', proud:'Fier',
        melancholy:'Mélancolique', frenzied:'Frénétique', enlightened:'Éveillé',
        study:'Studieux',
    };
    return MAP[mood] || mood || '—';
}

function derivePersonalityTrait(stats, mood) {
    const fer = Number(stats.ferocity)  || 0;
    const agi = Number(stats.agility)   || 0;
    const emp = Number(stats.empathy)   || 0;
    const cur = Number(stats.curiosity) || 0;
    const stb = Number(stats.stability) || 0;

    const scores = [
        { label: t('trait.combative') || 'Combatif',   color:'#f87171', icon:'⚔',  val: fer*0.6 + agi*0.4 },
        { label: t('trait.evasive')   || 'Fuyant',     color:'#60a5fa', icon:'💨',  val: agi*0.5 + stb*0.5 },
        { label: t('trait.romantic')  || 'Romantique', color:'#f472b6', icon:'💖',  val: emp*0.7 + (mood==='lovesick'?30:0) },
        { label: t('trait.explorer')  || 'Explorateur',color:'#a78bfa', icon:'🔭',  val: cur*0.6 + agi*0.4 },
        { label: t('trait.guardian')  || 'Gardien',    color:'#34d399', icon:'🛡',  val: stb*0.6 + fer*0.4 },
        { label: t('trait.mystic')    || 'Mystique',   color:'#c084fc', icon:'✦',   val: cur*0.5 + emp*0.5 + (mood==='enlightened'?25:0) },
        { label: t('trait.trickster') || 'Filou',      color:'#fb923c', icon:'🃏',  val: agi*0.4 + fer*0.3 + (mood==='mischief'?25:0) },
        { label: t('trait.gentle')    || 'Doux',       color:'#86efac', icon:'🌿',  val: emp*0.6 + stb*0.4 + (['calm','shy'].includes(mood)?15:0) },
    ];
    return scores.sort((a,b) => b.val - a.val)[0];
}

function buildElementTags(genome) {
    const SHAPE_R  = {round:0,pear:2,dumpling:2,blob:2,teardrop:2,mochi:2,puff:2,wisp:3,jellybean:3,bell:3,comet:3,puddle:3,crystal:3,ribbon:3,lantern:3,crescent:3,star_body:4,diamond:4,twin_lobe:4,fractal:5,aurora_form:5};
    const ACC_R    = {none:0,bow:1,flower:1,sprout:1,halo:1,leaf:1,mushroom:1,antenna:1,feather:1,ribbon_bow:2,mini_crown:2,crystal_tiara:3,rainbow_halo:3,fairy_wings:4,starfall_crown:4,celestial_halo:5};
    const EYE_R    = {dot:0,sparkle:1,heart:1,wide:1,droplet:2,button:2,star_eye:3,twin_spark:3,abyss:4,flame_eye:4,rainbow_iris:5,crystal_eye:5,galaxy_eye:5};
    const PAT_R    = {solid:0,radial_glow:1,gradient_v:2,gradient_h:2,duo_tone:3,soft_spots:3,stripe_v:3,galaxy_swirl:4,aurora:4,crystal_facets:4,prismatic:5,void_rift:5};

    const cls = r => ['common','uncommon','rare','epic','legendary'][Math.min(r,4)];

    const tags = [];
    const { bodyShape, accessory, eyeStyle, colorPattern } = genome;
    if (bodyShape  && bodyShape  !== 'round') tags.push({ label: bodyShape.replace(/_/g,' '),   cls: cls(SHAPE_R[bodyShape]  ?? 0) });
    if (accessory  && accessory  !== 'none')  tags.push({ label: accessory.replace(/_/g,' '),   cls: cls(ACC_R[accessory]    ?? 0) });
    if (eyeStyle   && eyeStyle   !== 'dot')   tags.push({ label: eyeStyle.replace(/_/g,' '),    cls: cls(EYE_R[eyeStyle]     ?? 0) });
    if (colorPattern && colorPattern !== 'solid') tags.push({ label: colorPattern.replace(/_/g,' '), cls: cls(PAT_R[colorPattern] ?? 0) });
    if (tags.length === 0) tags.push({ label: 'standard', cls: 'common' });
    return tags;
}

const TAG_COLORS = {
    common:    { color:'rgba(148,163,184,0.65)', border:'rgba(148,163,184,0.18)', bg:'rgba(148,163,184,0.04)' },
    uncommon:  { color:'#4caf50', border:'rgba(76,175,80,0.28)', bg:'rgba(76,175,80,0.05)' },
    rare:      { color:'#42a5f5', border:'rgba(66,165,245,0.28)', bg:'rgba(66,165,245,0.05)' },
    epic:      { color:'#ba68c8', border:'rgba(186,104,200,0.28)', bg:'rgba(186,104,200,0.05)' },
    legendary: { color:'#ffb300', border:'rgba(255,179,0,0.38)', bg:'rgba(255,179,0,0.07)', shadow:'0 0 5px rgba(255,179,0,0.35)' },
};

// ── CSS injecté une seule fois ───────────────────────────────────────────────
let cssInjected = false;
function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    const style = document.createElement('style');
    style.textContent = `
.labo-dp-overlay {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    width: min(100vw, 448px);
    top: calc(68px + max(0.75rem, env(safe-area-inset-top, 16px)));
    /* z-index 9 = behind content-shell (z-index:10) → panel appears BEHIND incubator */
    z-index: 9;
    pointer-events: none;
    display: flex;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.25s ease;
}
.labo-dp-overlay.is-visible { opacity: 1; }

.labo-dp-panel {
    pointer-events: none;
    width: min(88vw, 320px);
    background: #080d18;
    border: 2px solid #1a2535;
    border-bottom-width: 5px;
    border-radius: 10px 10px 7px 7px;
    padding: 5px;
    box-shadow: 0 10px 28px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.035);
    overflow: hidden;
    font-family: 'Courier New', 'Lucida Console', monospace;
    position: relative;
    /* Fixed height prevents growing when candidate data changes */
    max-height: 210px;
}

/* CRT overlay */
.labo-dp-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 40%);
    pointer-events: none;
    z-index: 10;
}

.labo-dp-screen {
    position: relative;
    z-index: 2;
    padding: 0.45rem 0.65rem 0.5rem;
    border-radius: 5px;
    background: linear-gradient(180deg, #020d08 0%, #010a14 100%);
    border: 1px solid rgba(0,255,100,0.08);
    box-shadow: inset 0 0 20px rgba(0,255,120,0.04), inset 0 2px 8px rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
    gap: 0.18rem;
    overflow: hidden;
}

/* Scanline moving */
.labo-dp-scan {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
}
.labo-dp-scan::before {
    content: '';
    position: absolute;
    left: 0; right: 0;
    height: 3px;
    background: hsla(190,100%,68%,0.2);
    box-shadow: 0 0 8px hsla(190,100%,68%,0.25);
    animation: dpScanline 6s linear infinite;
}
@keyframes dpScanline {
    0%   { top: 0%; }
    100% { top: 100%; }
}

/* CRT repeating lines */
.labo-dp-crt {
    position: absolute;
    inset: 0;
    border-radius: 8px;
    pointer-events: none;
    z-index: 6;
    background-image: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px);
    mix-blend-mode: multiply;
}

/* Header row */
.labo-dp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.2rem;
    border-bottom: 1px solid hsla(190,80%,40%,0.2);
}
.labo-dp-label {
    font-size: 0.56rem;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: hsla(190,70%,55%,0.6);
}
.labo-dp-blinker {
    font-size: 0.56rem;
    color: hsla(190,80%,65%,0.9);
    animation: dpBlink 1.2s step-end infinite;
}
@keyframes dpBlink { 0%,100%{opacity:1} 50%{opacity:0} }

/* Status */
.labo-dp-status {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: hsla(190,90%,72%,0.95);
    text-shadow: 0 0 8px hsla(190,100%,68%,0.45);
}

/* Divider */
.labo-dp-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, hsla(190,60%,40%,0.22), transparent);
    margin: 0;
}

/* Candidate block */
.labo-dp-candidate { display: flex; flex-direction: column; gap: 0.16rem; }

/* Row 1: name + price */
.labo-dp-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.35rem; }
.labo-dp-name {
    flex: 1;
    font-size: 0.88rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(220,255,230,0.97);
    text-shadow: 0 0 10px hsla(190,80%,65%,0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
}
.labo-dp-price-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
    padding-left: 0.35rem;
    border-left: 1px solid hsla(190,40%,35%,0.2);
}
.labo-dp-price-label { font-size: 0.42rem; letter-spacing: 0.18em; color: rgba(148,163,184,0.45); text-transform: uppercase; line-height: 1; }
.labo-dp-price-val { font-size: 0.95rem; font-weight: 900; color: rgba(250,220,100,0.97); text-shadow: 0 0 10px rgba(250,200,50,0.35); white-space: nowrap; line-height: 1.2; }

/* Row 2: rarity + income */
.labo-dp-meta { display: flex; align-items: center; gap: 0.3rem; overflow: hidden; }
.labo-dp-rarity { font-size: 0.65rem; font-weight: 800; letter-spacing: 0.04em; white-space: nowrap; flex-shrink: 0; }
.labo-dp-pattern { font-size: 0.5rem; letter-spacing: 0.06em; color: rgba(148,163,184,0.5); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.labo-dp-income { font-size: 0.55rem; font-weight: 700; letter-spacing: 0.04em; color: rgba(52,211,153,0.82); white-space: nowrap; margin-left: auto; flex-shrink: 0; }

/* Row 3: trait + morpho */
.labo-dp-info { display: flex; gap: 0.5rem; }
.labo-dp-info-block { display: flex; flex-direction: column; gap: 0.04rem; flex: 1; min-width: 0; }
.labo-dp-info-lbl { font-size: 0.44rem; letter-spacing: 0.16em; color: rgba(148,163,184,0.38); text-transform: uppercase; }
.labo-dp-info-val { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: rgba(220,255,230,0.88); }

/* Row 4: element tags */
.labo-dp-tags { display: flex; flex-wrap: wrap; gap: 0.18rem; }
.labo-dp-tag {
    font-size: 0.46rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    padding: 0.1rem 0.32rem;
    border-radius: 2px;
    border: 1px solid;
    white-space: nowrap;
}

/* Stats hidden — too small to read on phone; space used for key info */
.labo-dp-stats-lbl { display: none; }
.labo-dp-stats { display: none; }

/* Idle hint */
.labo-dp-idle { font-size: 0.65rem; letter-spacing: 0.2em; color: hsla(190,40%,45%,0.52); text-align: center; padding: 0.25rem 0; animation: dpIdlePulse 3s ease-in-out infinite; }
@keyframes dpIdlePulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
`;
    document.head.appendChild(style);
}

// ── Factory ──────────────────────────────────────────────────────────────────
export function createExternalDisplayPanel() {
    injectCSS();

    const overlay = document.createElement('div');
    overlay.className = 'labo-dp-overlay';

    const panel = document.createElement('div');
    panel.className = 'labo-dp-panel';

    panel.innerHTML = `
        <div class="labo-dp-crt"></div>
        <div class="labo-dp-scan"></div>
        <div class="labo-dp-screen">
            <div class="labo-dp-header">
                <span class="labo-dp-label">INKU-LAB</span>
                <span class="labo-dp-blinker">▮</span>
            </div>
            <div class="labo-dp-status" data-dp-status>EN ATTENTE...</div>
            <div class="labo-dp-divider"></div>
            <div class="labo-dp-candidate" data-dp-candidate hidden>
                <div class="labo-dp-top">
                    <span class="labo-dp-name" data-dp-name></span>
                    <div class="labo-dp-price-block">
                        <span class="labo-dp-price-label">PRIX</span>
                        <span class="labo-dp-price-val" data-dp-price>—</span>
                    </div>
                </div>
                <div class="labo-dp-meta">
                    <span class="labo-dp-rarity" data-dp-rarity></span>
                    <span class="labo-dp-pattern" data-dp-pattern></span>
                    <span class="labo-dp-income" data-dp-income></span>
                </div>
                <div class="labo-dp-divider"></div>
                <div class="labo-dp-info">
                    <div class="labo-dp-info-block">
                        <span class="labo-dp-info-lbl" data-dp-trait-lbl>TRAIT</span>
                        <span class="labo-dp-info-val" data-dp-trait></span>
                    </div>
                    <div class="labo-dp-info-block">
                        <span class="labo-dp-info-lbl">MORPHO</span>
                        <span class="labo-dp-info-val" data-dp-morpho></span>
                    </div>
                </div>
                <div class="labo-dp-tags" data-dp-tags></div>
                <div class="labo-dp-divider"></div>
                <div class="labo-dp-stats-lbl">STATS</div>
                <div class="labo-dp-stats" data-dp-stats></div>
            </div>
            <div class="labo-dp-idle" data-dp-idle>AUCUNE ENTITÉ</div>
        </div>
    `;

    overlay.appendChild(panel);

    // Refs
    const $ = (sel) => panel.querySelector(sel);
    const refs = {
        status:    $('[data-dp-status]'),
        candidate: $('[data-dp-candidate]'),
        name:      $('[data-dp-name]'),
        price:     $('[data-dp-price]'),
        rarity:    $('[data-dp-rarity]'),
        pattern:   $('[data-dp-pattern]'),
        income:    $('[data-dp-income]'),
        traitLbl:  $('[data-dp-trait-lbl]'),
        trait:     $('[data-dp-trait]'),
        morpho:    $('[data-dp-morpho]'),
        tags:      $('[data-dp-tags]'),
        stats:     $('[data-dp-stats]'),
        idle:      $('[data-dp-idle]'),
    };

    const TIER_COLORS  = { common:'#94a3b8', uncommon:'#4caf50', rare:'#42a5f5', epic:'#ba68c8', legendary:'#ffb300' };
    const TIER_ICONS   = { common:'◆', uncommon:'◆◆', rare:'◆◆◆', epic:'★', legendary:'★★' };
    const TIER_LABELS  = { common:'Commun', uncommon:'Peu commun', rare:'Rare', epic:'Épique', legendary:'Légendaire' };
    const PAT_NAMES    = { solid:'UNI', radial_glow:'LUEUR', gradient_v:'DÉG.↕', gradient_h:'DÉG.↔', gradient_diag:'DÉG.↗', duo_tone:'DUO', soft_spots:'TACHES', stripe_v:'RAYURES', galaxy_swirl:'GALAXIE', aurora:'AURORE', crystal_facets:'CRISTAL', prismatic:'PRISM', void_rift:'RIFT' };
    const STAT_DEFS    = [
        { key:'vitality',  lbl:'VIT', color:'#34d399' },
        { key:'agility',   lbl:'AGI', color:'#60a5fa' },
        { key:'curiosity', lbl:'CUR', color:'#a78bfa' },
        { key:'empathy',   lbl:'EMP', color:'#f472b6' },
        { key:'ferocity',  lbl:'FER', color:'#f87171' },
        { key:'stability', lbl:'STB', color:'#fbbf24' },
    ];

    return {
        /** Monter l'overlay dans le document */
        mount() {
            if (!overlay.isConnected) {
                document.body.appendChild(overlay);
            }
            overlay.classList.add('is-visible');
        },

        /** Masquer sans détruire */
        hide() {
            overlay.classList.remove('is-visible');
        },

        /** Détruire */
        destroy() {
            overlay.remove();
        },

        /** Mettre à jour le statut */
        updateStatus(label) {
            if (refs.status) refs.status.textContent = label || '';
        },

        /** Mettre à jour le candidat affiché */
        updateCandidate(candidate) {
            if (!candidate) {
                refs.candidate.hidden = true;
                refs.idle.hidden = false;
                refs.price.textContent = '—';
                return;
            }

            const genome  = candidate?.metadata?.previewBlueprint?.genome || {};
            const stats   = candidate?.metadata?.previewBlueprint?.stats  || {};
            const tier    = genome.rarityTier    || 'common';
            const pattern = genome.colorPattern  || 'solid';
            const mood    = genome.mood          || '';
            const shape   = genome.bodyShape     || '';

            refs.candidate.hidden = false;
            refs.idle.hidden = true;

            // Name
            refs.name.textContent = (candidate.displayName || 'ENTITÉ').toUpperCase();

            // Rarity + pattern + income
            refs.rarity.textContent = `${TIER_ICONS[tier]||'◆'} ${(TIER_LABELS[tier]||'').toUpperCase()}`;
            refs.rarity.style.color = TIER_COLORS[tier] || '#94a3b8';
            refs.pattern.textContent = PAT_NAMES[pattern] || pattern.toUpperCase();

            // Trait comportemental
            const trait = derivePersonalityTrait(stats, mood);
            refs.traitLbl.textContent = `${trait.icon} TRAIT`;
            refs.trait.textContent = trait.label.toUpperCase();
            refs.trait.style.color = trait.color;

            // Morpho
            refs.morpho.textContent = shape ? shape.replace(/_/g,' ').toUpperCase() : '—';

            // Tags éléments
            refs.tags.innerHTML = '';
            buildElementTags(genome).forEach(({ label, cls }) => {
                const c = TAG_COLORS[cls] || TAG_COLORS.common;
                const tag = document.createElement('span');
                tag.className = 'labo-dp-tag';
                tag.textContent = label;
                tag.style.color = c.color;
                tag.style.borderColor = c.border;
                tag.style.background = c.bg;
                if (c.shadow) tag.style.textShadow = c.shadow;
                refs.tags.appendChild(tag);
            });

            // Stats bars
            refs.stats.innerHTML = '';
            STAT_DEFS.forEach(({ key, lbl, color }) => {
                const val = Math.round(Number(stats[key]) || 0);
                const row = document.createElement('div');
                row.className = 'labo-dp-stat-row';
                row.innerHTML = `
                    <span class="labo-dp-stat-lbl">${lbl}</span>
                    <div class="labo-dp-stat-track">
                        <div class="labo-dp-stat-fill" style="width:${val}%;background:${color};box-shadow:0 0 5px ${color}88;"></div>
                    </div>
                    <span class="labo-dp-stat-val">${val}</span>
                `;
                refs.stats.appendChild(row);
            });

            // Teinte scanline selon rareté
            const HUE = { common:190, uncommon:140, rare:210, epic:280, legendary:38 };
            const hue = HUE[tier] ?? 190;
            panel.style.setProperty('--dp-hue', hue);
        },

        /** Mettre à jour prix + revenu */
        updatePrice(price, incomeRate) {
            if (refs.price) {
                refs.price.textContent = Number.isFinite(price)
                    ? `${price.toLocaleString('fr-FR')} ⬡`
                    : '—';
            }
            if (refs.income && Number.isFinite(incomeRate)) {
                refs.income.textContent = `+${incomeRate.toFixed(1)}/min`;
            }
        },
    };
}
