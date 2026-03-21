/**
 * tutorial-controller.js
 *
 * Orchestre le tutoriel pas-à-pas.
 * Usage :
 *   const tuto = createTutorialController();
 *   tuto.run(() => { /* appelé quand terminé ou ignoré *\/ });
 *
 * Le tutoriel s'affiche en overlay sur document.body.
 * Il est skippable à tout moment via la croix rouge.
 * L'état est persisté (tutorial-state.js) pour reprendre en cas d'interruption.
 */

import { getLang, setLang, applyTranslations } from '../../i18n/i18n.js';
import { TRANSLATIONS } from '../../i18n/translations.js';
import {
    getTutorialState,
    setTutorialStep,
    markLangChosen,
    completeTutorial,
    isTutorialDone,
    detectDeviceLang,
} from './tutorial-state.js';

/* ─── nombre total d'étapes (hors étape 0 langue) ──────────────────── */
const CONTENT_STEPS = 5; // étapes 1-5 (money, buy, storage, prairie, level)
const TOTAL_STEPS   = CONTENT_STEPS; // displayed to user (langue = step 0, invisible)

/* ─── Helpers visuels ────────────────────────────────────────────────── */

/** Crée un anneau pulsant autour d'un élément DOM. Retourne un handle {remove}. */
function spawnBeacon(selector) {
    const target = document.querySelector(selector);
    if (!target) return null;
    const r = target.getBoundingClientRect();
    const size = Math.max(r.width, r.height, 28) + 18;
    const el = document.createElement('div');
    el.className = 'tuto-beacon';
    el.style.left  = `${r.left + r.width  * 0.5}px`;
    el.style.top   = `${r.top  + r.height * 0.5}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;
    document.body.appendChild(el);
    return { remove: () => el.remove() };
}

/** Affiche une flèche animée pointant vers un onglet de nav. */
function spawnNavArrow(navSelector, labelText) {
    const target = document.querySelector(navSelector);
    if (!target) return null;
    const r = target.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'tuto-nav-arrow';
    el.innerHTML = `<div class="tuto-nav-arrow__icon">↓</div><div class="tuto-nav-arrow__label">${labelText}</div>`;
    el.style.left = `${r.left + r.width * 0.5}px`;
    el.style.transform = 'translateX(-50%)';
    document.body.appendChild(el);
    return { remove: () => el.remove() };
}

/** Lit le solde d'Inkübits courant depuis le HUD DOM. */
function readBalance() {
    const el = document.querySelector('[data-currency-value="hexagon"]');
    return parseInt((el?.textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;
}

/* ─── i18n helper local ─────────────────────────────────────────────── */
function tr(key) {
    const lang = getLang();
    const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.fr;
    return dict[key] ?? TRANSLATIONS.fr[key] ?? key;
}

/* ─── Données des étapes de contenu (indices 1..5) ──────────────────── */
// mode: 'sheet' (bottom sheet) | 'bubble' (floating tooltip near target)
// interaction: 'read' (Next button) | 'navigate' (must tap target to advance)
function getStepData(index) {
    const steps = [
        null, // index 0 = langue (cas spécial)
        {
            icon: '⬡',  titleKey: 'tuto.money.title',   bodyKey: 'tuto.money.body',
            targetSelector: '[data-currency-value="hexagon"]',
            mode: 'bubble', interaction: 'read',
        },
        {
            icon: '🧪', titleKey: 'tuto.buy.title',     bodyKey: 'tuto.buy.body',
            targetSelector: '[data-nav-index="2"]',
            navLabelKey: 'tuto.nav.labo',
            showAffordability: true,
            mode: 'sheet', interaction: 'navigate',
        },
        {
            icon: '📦', titleKey: 'tuto.storage.title', bodyKey: 'tuto.storage.body',
            targetSelector: null, // no beacon — user is already in the lab
            mode: 'sheet', interaction: 'read',
        },
        {
            icon: '🌿', titleKey: 'tuto.prairie.title', bodyKey: 'tuto.prairie.body',
            targetSelector: '[data-nav-index="0"]',
            navLabelKey: 'tuto.nav.prairie',
            mode: 'sheet', interaction: 'navigate',
        },
        {
            icon: '⭐', titleKey: 'tuto.level.title',   bodyKey: 'tuto.level.body',
            targetSelector: null, // loupe not yet visible at this point
            mode: 'sheet', interaction: 'read',
        },
    ];
    return steps[index] ?? null;
}

/* ─── Skip toast ─────────────────────────────────────────────────────── */
function showSkipToast() {
    const el = document.createElement('div');
    el.className = 'tuto-skip-toast';
    el.textContent = tr('tuto.skipped_msg');
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 400);
    }, 3200);
}

/* ─── Spotlight interactif sur la cible ──────────────────────────────── */
/** Zone transparente et cliquable posée au-dessus de l'élément cible.
 *  Avance le tutoriel quand l'utilisateur la tape. */
function spawnInteractiveSpotlight(selector, onTap) {
    const target = document.querySelector(selector);
    if (!target) return null;
    const r = target.getBoundingClientRect();
    const pad = 14;
    const el = document.createElement('div');
    el.className = 'tuto-spotlight';
    el.style.left   = `${r.left   - pad}px`;
    el.style.top    = `${r.top    - pad}px`;
    el.style.width  = `${r.width  + pad * 2}px`;
    el.style.height = `${r.height + pad * 2}px`;
    el.style.borderRadius = `${Math.min(r.width, r.height) * 0.4 + pad}px`;
    const handler = (e) => { e.stopPropagation(); el.remove(); onTap(); };
    el.addEventListener('pointerup', handler, { once: true });
    document.body.appendChild(el);
    return { remove: () => el.remove() };
}

/* ─── Styles injectés une seule fois ────────────────────────────────── */
let stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
/* ════════════════════════════════════════════════════════════
   INKU TUTORIAL — Design System
   Dark sci-fi lab aesthetic, touch-first, safe-zone aware
   ════════════════════════════════════════════════════════════ */

/* ── Overlay ──────────────────────────────────────────────── */
.tuto-overlay{
    position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
    display:flex;align-items:flex-end;justify-content:center;
    background:linear-gradient(180deg,rgba(2,8,18,0.6) 0%,rgba(2,8,18,0.82) 55%);
    backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
    animation:tutoFadeIn 0.28s ease;
    touch-action:none;
}
@keyframes tutoFadeIn{from{opacity:0}to{opacity:1}}

/* ── Card slide animations ────────────────────────────────── */
@keyframes tutoSlideUp{
    from{transform:translateY(48px) scale(0.97);opacity:0}
    to{transform:translateY(0) scale(1);opacity:1}
}
@keyframes tutoSlideOut{
    from{transform:translateY(0) scale(1);opacity:1}
    to{transform:translateY(48px) scale(0.96);opacity:0}
}
@keyframes tutoIconBounce{
    0%{transform:scale(0.3);opacity:0}
    60%{transform:scale(1.12);opacity:1}
    80%{transform:scale(0.92)}
    100%{transform:scale(1)}
}
@keyframes tutoIconRing{
    0%{opacity:0.65;transform:scale(1)}
    100%{opacity:0;transform:scale(1.8)}
}
@keyframes tutoBtnShimmer{
    0%{left:-90%}
    100%{left:130%}
}
@keyframes tutoPulseGlow{
    0%,100%{box-shadow:0 4px 18px rgba(52,211,153,0.32),0 0 0 0 rgba(52,211,153,0.3)}
    50%{box-shadow:0 6px 28px rgba(52,211,153,0.52),0 0 0 7px rgba(52,211,153,0)}
}

/* ── Card ─────────────────────────────────────────────────── */
.tuto-card{
    width:100%;max-width:460px;
    /* Dark glass with subtle hex-grid texture */
    background:
        repeating-linear-gradient(
            120deg,
            rgba(52,211,153,0.018) 0px,rgba(52,211,153,0.018) 1px,
            transparent 1px,transparent 22px
        ),
        repeating-linear-gradient(
            60deg,
            rgba(52,211,153,0.018) 0px,rgba(52,211,153,0.018) 1px,
            transparent 1px,transparent 22px
        ),
        linear-gradient(175deg,rgba(6,18,34,0.98) 0%,rgba(2,10,20,0.99) 100%);
    border:1px solid rgba(52,211,153,0.22);
    border-bottom:none;
    border-radius:28px 28px 0 0;
    padding:0 0 calc(20px + env(safe-area-inset-bottom,0px)) 0;
    box-shadow:
        0 -12px 60px rgba(0,0,0,0.7),
        0 0 0 1px rgba(52,211,153,0.06),
        inset 0 1px 0 rgba(52,211,153,0.1);
    animation:tutoSlideUp 0.38s cubic-bezier(0.16,1,0.3,1);
    position:relative;overflow:hidden;
}
/* Accent bar at top */
.tuto-card::before{
    content:'';
    position:absolute;top:0;left:10%;right:10%;height:2px;
    background:linear-gradient(90deg,transparent,rgba(52,211,153,0.7) 30%,rgba(5,150,105,0.9) 70%,transparent);
    border-radius:0 0 4px 4px;
}
/* Glow bleed at top */
.tuto-card::after{
    content:'';
    position:absolute;top:0;left:0;right:0;height:80px;
    background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(52,211,153,0.07),transparent 80%);
    pointer-events:none;
}
/* Exiting animation */
.tuto-card.is-exiting{
    animation:tutoSlideOut 0.22s cubic-bezier(0.4,0,1,1) forwards;
}

/* ── Close button ─────────────────────────────────────────── */
.tuto-card__close{
    position:absolute;top:14px;right:14px;
    width:40px;height:40px;border-radius:50%;z-index:2;
    background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);
    color:rgba(239,68,68,0.85);font-size:1rem;line-height:1;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;touch-action:manipulation;
    transition:background 0.15s,transform 0.12s,border-color 0.15s;
}
.tuto-card__close:active{background:rgba(239,68,68,0.25);transform:scale(0.88);border-color:rgba(239,68,68,0.45);}

/* ── Hero icon zone ───────────────────────────────────────── */
.tuto-card__hero{
    display:flex;justify-content:center;
    padding-top:28px;margin-bottom:16px;
}
.tuto-card__icon-wrap{
    width:76px;height:76px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle,rgba(52,211,153,0.14) 0%,rgba(52,211,153,0.04) 60%,transparent 100%);
    border:1.5px solid rgba(52,211,153,0.28);
    box-shadow:0 0 24px rgba(52,211,153,0.12),inset 0 0 14px rgba(52,211,153,0.06);
    position:relative;
    animation:tutoIconBounce 0.52s cubic-bezier(0.16,1.4,0.4,1) 0.14s both;
}
.tuto-card__icon-wrap::before{
    content:'';
    position:absolute;inset:-8px;border-radius:50%;
    border:1px solid rgba(52,211,153,0.15);
    animation:tutoIconRing 2.2s ease-out 0.3s infinite;
}
.tuto-card__icon-glyph{
    font-size:2.2rem;line-height:1;
    filter:drop-shadow(0 0 10px rgba(52,211,153,0.65));
}

/* ── Content ──────────────────────────────────────────────── */
.tuto-card__content{
    padding:0 22px;
}
.tuto-card__step-label{
    display:flex;align-items:center;gap:8px;
    font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;
    color:rgba(52,211,153,0.5);margin-bottom:8px;font-weight:700;
}
.tuto-card__step-dot{
    width:5px;height:5px;border-radius:50%;
    background:#34d399;
    box-shadow:0 0 6px #34d399;
    animation:tutoPulseGlowDot 1.6s ease-in-out infinite;
    flex-shrink:0;
}
@keyframes tutoPulseGlowDot{
    0%,100%{opacity:1;transform:scale(1)}
    50%{opacity:0.55;transform:scale(0.7)}
}
.tuto-card__title{
    font-size:1.22rem;font-weight:800;color:#e2f8ee;
    margin-bottom:10px;line-height:1.22;
    text-shadow:0 0 24px rgba(52,211,153,0.18);
}
.tuto-card__body{
    font-size:0.84rem;color:rgba(186,220,200,0.82);line-height:1.65;
    margin-bottom:18px;white-space:pre-line;
}
.tuto-card__body strong{color:#34d399;font-weight:700;}
.tuto-card__body em{color:rgba(226,248,238,0.9);font-style:normal;font-weight:600;}

/* ── Affordability pill ───────────────────────────────────── */
.tuto-afford{
    display:inline-flex;align-items:center;gap:7px;
    padding:7px 16px;border-radius:12px;font-size:0.82rem;font-weight:700;
    margin-bottom:16px;letter-spacing:0.02em;
}
.tuto-afford--ok{
    background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.28);
    color:#4ade80;box-shadow:0 0 12px rgba(74,222,128,0.08);
}
.tuto-afford--ko{
    background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.28);
    color:#f87171;
}

/* ── Progress track ───────────────────────────────────────── */
.tuto-progress{
    display:flex;align-items:center;justify-content:center;
    gap:5px;margin-bottom:16px;
}
.tuto-progress__dot{
    height:5px;border-radius:3px;
    background:rgba(52,211,153,0.18);
    transition:width 0.28s cubic-bezier(0.16,1,0.3,1),background 0.22s;
    width:6px;
}
.tuto-progress__dot.is-done{
    background:rgba(52,211,153,0.45);width:6px;
}
.tuto-progress__dot.is-active{
    background:#34d399;width:24px;
    box-shadow:0 0 8px rgba(52,211,153,0.55);
}

/* ── Actions ──────────────────────────────────────────────── */
.tuto-card__actions{
    padding:0 22px 0;
    margin-bottom:4px;
}
.tuto-btn-primary{
    width:100%;min-height:52px;border-radius:16px;
    background:linear-gradient(135deg,#059669 0%,#34d399 100%);
    color:#fff;font-size:0.96rem;font-weight:800;letter-spacing:0.02em;
    border:none;cursor:pointer;touch-action:manipulation;
    position:relative;overflow:hidden;
    box-shadow:0 4px 18px rgba(52,211,153,0.32);
    animation:tutoPulseGlow 2.6s ease-in-out 0.6s infinite;
    transition:opacity 0.12s,transform 0.12s;
}
.tuto-btn-primary::after{
    content:'';
    position:absolute;top:0;width:55%;height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent);
    animation:tutoBtnShimmer 2.8s ease-in-out 1.2s infinite;
}
.tuto-btn-primary:active{opacity:0.82;transform:scale(0.97);}

/* ── Language step ────────────────────────────────────────── */
.tuto-lang-btns{
    display:flex;gap:12px;margin-bottom:4px;
    padding:0 22px;
}
.tuto-lang-btn{
    flex:1;min-height:56px;border-radius:16px;
    background:rgba(52,211,153,0.06);border:1.5px solid rgba(52,211,153,0.2);
    color:#e2f8ee;font-size:1rem;font-weight:700;
    cursor:pointer;touch-action:manipulation;
    transition:background 0.15s,border-color 0.15s,transform 0.12s,box-shadow 0.15s;
}
.tuto-lang-btn:active{background:rgba(52,211,153,0.16);transform:scale(0.97);}
.tuto-lang-btn.is-selected{
    background:rgba(52,211,153,0.14);border-color:#34d399;
    box-shadow:0 0 0 2px rgba(52,211,153,0.14),0 0 16px rgba(52,211,153,0.12);
}

/* ── Beacon spotlight ─────────────────────────────────────── */
.tuto-beacon{
    position:fixed;border-radius:50%;pointer-events:none;z-index:10001;
    border:2.5px solid rgba(52,211,153,0.9);
    animation:tutoBeaconPulse 1.6s ease-out infinite;
    transform:translate(-50%,-50%);
}
@keyframes tutoBeaconPulse{
    0%{box-shadow:0 0 0 0 rgba(52,211,153,0.5),0 0 12px rgba(52,211,153,0.3);opacity:1}
    60%{box-shadow:0 0 0 18px rgba(52,211,153,0),0 0 20px rgba(52,211,153,0);opacity:0.8}
    100%{box-shadow:0 0 0 0 rgba(52,211,153,0),0 0 12px rgba(52,211,153,0.3);opacity:1}
}

/* ── Compact card variant (navigate steps) ────────────────── */
/* Full overlay is kept; only the card style differs */
.tuto-card--compact{
    /* Leave space for the nav bar so spotlight is visible */
    margin-bottom:calc(80px + env(safe-area-inset-bottom,0px));
    border-radius:20px;
    border-bottom:1px solid rgba(52,211,153,0.22);
}

/* ── Interactive spotlight (navigate steps) ───────────────── */
.tuto-spotlight{
    position:fixed;z-index:10002;pointer-events:auto;cursor:pointer;
    border:2.5px solid rgba(52,211,153,0.9);border-radius:50%;
    box-shadow:0 0 0 4px rgba(52,211,153,0.18),0 0 24px rgba(52,211,153,0.35);
    animation:tutoBeaconPulse 1.4s ease-out infinite;
}

/* ── Skip toast ───────────────────────────────────────────── */
.tuto-skip-toast{
    position:fixed;z-index:99999;pointer-events:none;
    bottom:calc(88px + env(safe-area-inset-bottom,0px));
    left:50%;transform:translateX(-50%);
    background:rgba(6,16,30,0.96);
    border:1px solid rgba(52,211,153,0.28);
    border-radius:14px;padding:11px 20px;
    font-size:0.81rem;font-weight:600;color:#e2f8ee;
    text-align:center;max-width:calc(100vw - 48px);
    box-shadow:0 4px 24px rgba(0,0,0,0.55);
    transition:opacity 0.4s;
    white-space:nowrap;
}
`;
    document.head.appendChild(style);
}

/* ─── Transition sortie d'une carte vers la suivante ────────────────── */
function animateCardOut(card, overlay, callback) {
    card.classList.add('is-exiting');
    const done = () => { overlay.remove(); callback?.(); };
    // Use animation end for reliability, with a fallback timeout.
    const onEnd = () => { card.removeEventListener('animationend', onEnd); done(); };
    card.addEventListener('animationend', onEnd);
    setTimeout(done, 280); // safety fallback
}

/* ─── Rendu d'une étape de contenu (indices 1..TOTAL_STEPS) ─────────── */
/**
 * Unique renderer for all content steps.
 *
 * Read steps  (interaction:'read')     → full overlay + hero icon + Next button
 * Navigate steps (interaction:'navigate') → overlay clipped above nav bar +
 *   compact card (no hero) + spotlight on target that advances the tutorial
 */
function renderContentStep(stepIndex, { onNext, onSkip }) {
    const data = getStepData(stepIndex);
    if (!data) return null;

    const isNavigate = data.interaction === 'navigate';
    const isLast     = stepIndex >= TOTAL_STEPS;

    // Beacon only on read steps with a visible non-nav target
    const beacon = data.targetSelector && !isNavigate
        ? spawnBeacon(data.targetSelector) : null;
    let spotlight = null;
    const cleanupHelpers = () => { beacon?.remove(); spotlight?.remove(); };

    // All steps: full-screen overlay. Navigate steps use spotlight (z:10002)
    // above the overlay to expose only the target button — no partial overlay.
    const overlay = document.createElement('div');
    overlay.className = 'tuto-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', tr(data.titleKey));

    const stepLabel = tr('tuto.step_of')
        .replace('{n}', stepIndex).replace('{total}', TOTAL_STEPS);

    // Progress dots
    let progressHtml = '';
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const cls = i === stepIndex ? ' is-active' : i < stepIndex ? ' is-done' : '';
        progressHtml += `<div class="tuto-progress__dot${cls}"></div>`;
    }

    // Affordability pill (step 2)
    let affordHtml = '';
    if (data.showAffordability) {
        const balance = readBalance();
        const ok = balance > 0;
        affordHtml = `<div class="tuto-afford ${ok ? 'tuto-afford--ok' : 'tuto-afford--ko'}">${ok ? '✓' : '✕'} ⬡ ${balance.toLocaleString()} Inkübits</div>`;
    }

    // Navigate steps: no Next button — the spotlight advances automatically
    const actionsHtml = isNavigate
        ? ''
        : `<div class="tuto-card__actions"><button class="tuto-btn-primary">${isLast ? tr('tuto.start') : tr('tuto.next')}</button></div>`;

    // Hero only on read steps
    const heroHtml = isNavigate ? '' : `
    <div class="tuto-card__hero">
        <div class="tuto-card__icon-wrap">
            <span class="tuto-card__icon-glyph">${data.icon}</span>
        </div>
    </div>`;

    overlay.innerHTML = `
<div class="tuto-card${isNavigate ? ' tuto-card--compact' : ''}">
    <button class="tuto-card__close" aria-label="${tr('tuto.skip')}">✕</button>
    ${heroHtml}
    <div class="tuto-card__content">
        <div class="tuto-card__step-label">
            <span class="tuto-card__step-dot"></span>${stepLabel}
        </div>
        <h2 class="tuto-card__title">${data.icon} ${tr(data.titleKey)}</h2>
        ${affordHtml}
        <div class="tuto-card__body">${tr(data.bodyKey)}</div>
    </div>
    <div class="tuto-progress">${progressHtml}</div>
    ${actionsHtml}
    <div style="height:calc(env(safe-area-inset-bottom,0px) + 4px)"></div>
</div>`;

    const card = overlay.querySelector('.tuto-card');
    const doSkip = () => { cleanupHelpers(); overlay.remove(); onSkip?.(); };
    const doNext = () => {
        cleanupHelpers();
        if (isLast) { overlay.remove(); onNext?.(); }
        else { animateCardOut(card, overlay, onNext); }
    };

    overlay.querySelector('.tuto-card__close').addEventListener('click', doSkip, { once: true });

    if (!isNavigate) {
        overlay.querySelector('.tuto-btn-primary')?.addEventListener('click', doNext, { once: true });
    } else {
        // Spawn spotlight after DOM insertion (needs layout for getBoundingClientRect)
        requestAnimationFrame(() => {
            if (!data.targetSelector) return;
            spotlight = spawnInteractiveSpotlight(data.targetSelector, doNext);
        });
    }

    return overlay;
}

/* ─── Rendu de l'étape langue (étape 0) ─────────────────────────────── */
function renderLangStep({ onChose }) {
    const overlay = document.createElement('div');
    overlay.className = 'tuto-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', tr('tuto.lang.title'));

    const currentLang = getLang();

    overlay.innerHTML = `
<div class="tuto-card">
    <div class="tuto-card__hero">
        <div class="tuto-card__icon-wrap">
            <span class="tuto-card__icon-glyph">🌍</span>
        </div>
    </div>
    <div class="tuto-card__content">
        <h2 class="tuto-card__title">${tr('tuto.lang.title')}</h2>
        <div class="tuto-card__body">${tr('tuto.lang.body')}</div>
    </div>
    <div class="tuto-lang-btns">
        <button class="tuto-lang-btn${currentLang === 'fr' ? ' is-selected' : ''}" data-lang="fr">${tr('tuto.lang.fr')}</button>
        <button class="tuto-lang-btn${currentLang === 'en' ? ' is-selected' : ''}" data-lang="en">${tr('tuto.lang.en')}</button>
    </div>
    <div style="height:calc(env(safe-area-inset-bottom,0px))"></div>
</div>`;

    overlay.querySelectorAll('.tuto-lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.dataset.lang;
            setLang(lang);
            markLangChosen();
            overlay.remove();
            onChose?.(lang);
        });
    });

    return overlay;
}

/* ─── Contrôleur principal ───────────────────────────────────────────── */
export function createTutorialController() {
    let active = false;
    let onCompleteCallback = null;

    function finish() {
        active = false;
        completeTutorial();
        onCompleteCallback?.();
    }

    function skip() {
        active = false;
        completeTutorial();
        showSkipToast();
        onCompleteCallback?.();
    }

    /**
     * Lance l'étape de contenu stepIndex (1..TOTAL_STEPS).
     * Dispatche vers renderBubbleStep (mode:'bubble') ou renderContentStep (mode:'sheet').
     */
    function runContentStep(stepIndex) {
        if (!active) return;
        if (stepIndex > TOTAL_STEPS) { finish(); return; }

        setTutorialStep(stepIndex);

        const callbacks = {
            onNext: () => { if (active) runContentStep(stepIndex + 1); },
            onSkip: () => { skip(); },
        };

        const overlay = renderContentStep(stepIndex, callbacks);
        if (overlay) document.body.appendChild(overlay);
    }

    /**
     * Lance le tuto depuis le début.
     * Passe par l'étape langue si la langue n'a pas encore été choisie.
     */
    function run(onComplete) {
        if (isTutorialDone()) { onComplete?.(); return; }
        if (active) return;

        active = true;
        onCompleteCallback = onComplete;
        injectStyles();

        const state = getTutorialState();

        if (!state.langChosen) {
            // Auto-détecter et pré-appliquer la langue avant de montrer le picker.
            const detected = detectDeviceLang();
            setLang(detected);
            applyTranslations(document);

            const overlay = renderLangStep({
                onChose: (lang) => {
                    // Re-apply translations in case language changed
                    applyTranslations(document);
                    // Start from step 1 (or resume)
                    const resumeFrom = Math.max(1, (state.step ?? 0) + 1 > 1 ? state.step + 1 : 1);
                    runContentStep(resumeFrom);
                },
            });
            document.body.appendChild(overlay);
        } else {
            // Langue déjà choisie — reprendre à la dernière étape non terminée.
            const resumeFrom = Math.max(1, (state.step ?? 0) + 1);
            runContentStep(resumeFrom);
        }
    }

    return { run };
}
