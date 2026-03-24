/**
 * tutorial-controller.js — v4 bulletproof
 *
 * Règles absolues :
 *  - Une seule carte à l'écran à tout moment (guard + cleanup avant création)
 *  - Un seul beacon/spotlight actif à la fois (ref unique _activeOverlay)
 *  - animateCardOut : un seul chemin de sortie, pas de double-fire
 *  - Aucun appel re-entrant : le flag _busy bloque les clics pendant la transition
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

/* ─── Constantes ─────────────────────────────────────────────────────── */
const TOTAL_STEPS = 5;

/* ─── i18n ───────────────────────────────────────────────────────────── */
function tr(key) {
    const lang = getLang();
    const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.fr;
    return dict[key] ?? TRANSLATIONS.fr[key] ?? key;
}

/* ─── Étapes ─────────────────────────────────────────────────────────── */
function getStepData(index) {
    const steps = [
        null,
        {
            icon: '⬡',
            titleKey: 'tuto.money.title',
            bodyKey:  'tuto.money.body',
            targetSelector: '[data-currency="hexagon"]',
            interaction: 'read',
        },
        {
            icon: '🧪',
            titleKey: 'tuto.buy.title',
            bodyKey:  'tuto.buy.body',
            targetSelector: '[data-nav-index="2"]',
            interaction: 'navigate',
            showAffordability: true,
            tapLabelKey: 'tuto.nav.labo',
        },
        {
            icon: '📦',
            titleKey: 'tuto.storage.title',
            bodyKey:  'tuto.storage.body',
            targetSelector: null,
            interaction: 'read',
        },
        {
            icon: '🌿',
            titleKey: 'tuto.prairie.title',
            bodyKey:  'tuto.prairie.body',
            targetSelector: '[data-nav-index="0"]',
            interaction: 'navigate',
            tapLabelKey: 'tuto.nav.prairie',
        },
        {
            icon: '⭐',
            titleKey: 'tuto.level.title',
            bodyKey:  'tuto.level.body',
            targetSelector: null,
            interaction: 'read',
        },
    ];
    return steps[index] ?? null;
}

/* ─── Solde ──────────────────────────────────────────────────────────── */
function readBalance() {
    const el = document.querySelector('[data-currency-value="hexagon"]');
    return parseInt((el?.textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;
}

/* ─── État global unique ─────────────────────────────────────────────── */
let _activeCard    = null;
let _activeOverlay = null;
let _busy          = false;

function _destroyActive() {
    _activeCard?.remove();
    _activeCard = null;
    _activeOverlay?.remove();
    _activeOverlay = null;
    _busy = false;
}

/* ─── Beacon décoratif ───────────────────────────────────────────────── */
function _spawnBeacon(selector) {
    const target = document.querySelector(selector);
    if (!target) return null;
    const r    = target.getBoundingClientRect();
    const size = Math.max(r.width, r.height, 28) + 20;
    const el   = document.createElement('div');
    el.className = 'tuto-beacon';
    el.style.cssText = `left:${r.left + r.width * 0.5}px;top:${r.top + r.height * 0.5}px;width:${size}px;height:${size}px;`;
    document.body.appendChild(el);
    return { remove: () => el.remove() };
}

/* ─── Spotlight interactif ───────────────────────────────────────────── */
function _spawnSpotlight(selector, onTap) {
    const target = document.querySelector(selector);
    if (!target) return null;
    const r   = target.getBoundingClientRect();
    const pad = 10;
    const el  = document.createElement('div');
    el.className = 'tuto-spotlight';
    el.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;border-radius:${Math.min(r.width, r.height) * 0.5 + pad}px;`;
    el.addEventListener('pointerup', (e) => { e.stopPropagation(); onTap(); }, { once: true });
    document.body.appendChild(el);
    return { remove: () => el.remove() };
}

/* ─── Skip toast ─────────────────────────────────────────────────────── */
function _showSkipToast() {
    const el = document.createElement('div');
    el.className = 'tuto-skip-toast';
    el.textContent = tr('tuto.skipped_msg');
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 3000);
}

/* ─── Styles (injectés une seule fois) ───────────────────────────────── */
let _stylesInjected = false;
function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const s = document.createElement('style');
    s.textContent = `
@keyframes tutoCardIn{from{opacity:0;transform:translateX(-50%) translateY(16px) scale(0.97)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
@keyframes tutoCardOut{from{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}to{opacity:0;transform:translateX(-50%) translateY(16px) scale(0.96)}}

.tuto-card{
    position:fixed;left:50%;transform:translateX(-50%);
    width:calc(100% - 32px);max-width:420px;
    bottom:calc(20px + env(safe-area-inset-bottom,0px));
    z-index:10000;border-radius:24px;
    background:linear-gradient(175deg,rgba(6,18,36,0.97) 0%,rgba(2,10,22,0.98) 100%);
    border:1px solid rgba(52,211,153,0.22);
    box-shadow:0 8px 40px rgba(0,0,0,0.72),0 0 0 1px rgba(52,211,153,0.05),inset 0 1px 0 rgba(52,211,153,0.09);
    padding:22px 20px calc(18px + env(safe-area-inset-bottom,0px));
    animation:tutoCardIn 0.32s cubic-bezier(0.16,1,0.3,1) both;
    overflow:hidden;pointer-events:auto;
}
.tuto-card.is-busy{pointer-events:none;}
.tuto-card::before{content:'';position:absolute;top:0;left:12%;right:12%;height:2px;background:linear-gradient(90deg,transparent,rgba(52,211,153,0.65) 30%,rgba(5,150,105,0.85) 70%,transparent);border-radius:0 0 4px 4px;}
.tuto-card.is-exiting{animation:tutoCardOut 0.2s cubic-bezier(0.4,0,1,1) forwards;pointer-events:none;}
.tuto-card--navigate{bottom:calc(104px + env(safe-area-inset-bottom,0px));}

.tuto-card__close{position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:rgba(239,68,68,0.75);font-size:0.9rem;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;transition:background 0.12s,transform 0.1s;z-index:1;}
.tuto-card__close:active{background:rgba(239,68,68,0.22);transform:scale(0.88);}

@keyframes tutoIconIn{from{transform:scale(0.4);opacity:0}60%{transform:scale(1.1);opacity:1}to{transform:scale(1);opacity:1}}
@keyframes tutoRingPulse{from{opacity:0.5;transform:scale(1)}to{opacity:0;transform:scale(1.75)}}
.tuto-card__hero{display:flex;justify-content:center;margin-bottom:14px;}
.tuto-card__icon-wrap{width:68px;height:68px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(52,211,153,0.12) 0%,rgba(52,211,153,0.03) 60%,transparent);border:1.5px solid rgba(52,211,153,0.25);box-shadow:0 0 20px rgba(52,211,153,0.1);position:relative;animation:tutoIconIn 0.48s cubic-bezier(0.16,1.4,0.4,1) 0.12s both;}
.tuto-card__icon-wrap::before{content:'';position:absolute;inset:-8px;border-radius:50%;border:1px solid rgba(52,211,153,0.14);animation:tutoRingPulse 2s ease-out 0.3s infinite;}
.tuto-card__icon-glyph{font-size:2rem;line-height:1;filter:drop-shadow(0 0 8px rgba(52,211,153,0.6));}

.tuto-card__step-label{display:flex;align-items:center;gap:6px;font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(52,211,153,0.48);margin-bottom:6px;font-weight:700;}
.tuto-card__step-dot{width:5px;height:5px;border-radius:50%;background:#34d399;box-shadow:0 0 6px #34d399;animation:tutoStepDot 1.6s ease-in-out infinite;flex-shrink:0;}
@keyframes tutoStepDot{0%,100%{opacity:1}50%{opacity:0.45}}
.tuto-card__title{font-size:1.15rem;font-weight:800;color:#e2f8ee;margin-bottom:8px;line-height:1.2;text-shadow:0 0 20px rgba(52,211,153,0.15);padding-right:32px;}
.tuto-card__body{font-size:0.83rem;color:rgba(186,220,200,0.8);line-height:1.6;margin-bottom:16px;white-space:pre-line;}
.tuto-card__body strong{color:#34d399;font-weight:700;}
.tuto-card__body em{color:rgba(226,248,238,0.9);font-style:normal;font-weight:600;}

.tuto-afford{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:10px;font-size:0.8rem;font-weight:700;margin-bottom:14px;}
.tuto-afford--ok{background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.25);color:#4ade80;}
.tuto-afford--ko{background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);color:#f87171;}

.tuto-progress{display:flex;align-items:center;justify-content:center;gap:5px;margin-bottom:14px;}
.tuto-progress__dot{height:4px;border-radius:2px;background:rgba(52,211,153,0.16);transition:width 0.25s cubic-bezier(0.16,1,0.3,1),background 0.2s;width:5px;}
.tuto-progress__dot.is-done{background:rgba(52,211,153,0.4);width:5px;}
.tuto-progress__dot.is-active{background:#34d399;width:20px;box-shadow:0 0 6px rgba(52,211,153,0.5);}

@keyframes tutoBtnShimmer{from{left:-80%}to{left:120%}}
@keyframes tutoBtnGlow{0%,100%{box-shadow:0 4px 16px rgba(52,211,153,0.3)}50%{box-shadow:0 6px 24px rgba(52,211,153,0.5)}}
.tuto-btn-primary{width:100%;min-height:50px;border-radius:14px;background:linear-gradient(135deg,#059669 0%,#34d399 100%);color:#fff;font-size:0.94rem;font-weight:800;letter-spacing:0.02em;border:none;cursor:pointer;touch-action:manipulation;position:relative;overflow:hidden;box-shadow:0 4px 16px rgba(52,211,153,0.3);animation:tutoBtnGlow 2.4s ease-in-out 0.5s infinite;transition:opacity 0.1s,transform 0.1s;}
.tuto-btn-primary::after{content:'';position:absolute;top:0;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent);animation:tutoBtnShimmer 2.6s ease-in-out 1s infinite;}
.tuto-btn-primary:active{opacity:0.8;transform:scale(0.97);}

.tuto-tap-hint{display:inline-flex;align-items:center;gap:6px;font-size:0.76rem;font-weight:700;letter-spacing:0.04em;color:rgba(52,211,153,0.65);margin-bottom:12px;animation:tutoStepDot 1.6s ease-in-out infinite;}

.tuto-lang-btns{display:flex;gap:10px;margin-top:4px;}
.tuto-lang-btn{flex:1;min-height:52px;border-radius:14px;background:rgba(52,211,153,0.05);border:1.5px solid rgba(52,211,153,0.18);color:#e2f8ee;font-size:0.96rem;font-weight:700;cursor:pointer;touch-action:manipulation;transition:background 0.14s,border-color 0.14s,transform 0.1s;}
.tuto-lang-btn:active{background:rgba(52,211,153,0.14);transform:scale(0.97);}
.tuto-lang-btn.is-selected{background:rgba(52,211,153,0.12);border-color:#34d399;box-shadow:0 0 0 2px rgba(52,211,153,0.12),0 0 14px rgba(52,211,153,0.1);}

@keyframes tutoBeacon{0%{box-shadow:0 0 0 0 rgba(52,211,153,0.5),0 0 10px rgba(52,211,153,0.25);opacity:1}70%{box-shadow:0 0 0 16px rgba(52,211,153,0),0 0 18px rgba(52,211,153,0);opacity:0.7}100%{box-shadow:0 0 0 0 rgba(52,211,153,0),0 0 10px rgba(52,211,153,0.25);opacity:1}}
.tuto-beacon{position:fixed;border-radius:50%;pointer-events:none;z-index:10001;border:2px solid rgba(52,211,153,0.85);animation:tutoBeacon 1.7s ease-out infinite;transform:translate(-50%,-50%);}

.tuto-spotlight{position:fixed;z-index:10001;cursor:pointer;pointer-events:auto;border:2px solid rgba(52,211,153,0.9);box-shadow:0 0 0 9999px rgba(2,8,20,0.72),0 0 0 4px rgba(52,211,153,0.15),0 0 20px rgba(52,211,153,0.3);animation:tutoBeacon 1.5s ease-out infinite;}

.tuto-skip-toast{position:fixed;z-index:99999;pointer-events:none;bottom:calc(92px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);background:rgba(4,10,24,0.95);border:1px solid rgba(52,211,153,0.25);border-radius:12px;padding:10px 18px;font-size:0.8rem;font-weight:600;color:#e2f8ee;text-align:center;max-width:calc(100vw - 40px);box-shadow:0 4px 20px rgba(0,0,0,0.5);transition:opacity 0.4s;white-space:nowrap;}
`;
    document.head.appendChild(s);
}

/* ─── Transition sortie — UN SEUL callback, jamais deux fois ─────────── */
function _animateOut(card, callback) {
    let fired = false;
    const fire = () => {
        if (fired) return;
        fired = true;
        callback();
    };
    card.classList.add('is-exiting');
    card.addEventListener('animationend', fire, { once: true });
    setTimeout(fire, 260); // fallback : légèrement > 200ms (durée CSS)
}

/* ─── Rendu étape contenu ────────────────────────────────────────────── */
function _renderContentStep(stepIndex, { onNext, onSkip }) {
    _destroyActive(); // Garantit un écran propre avant toute création

    const data = getStepData(stepIndex);
    if (!data) return;

    const isNavigate = data.interaction === 'navigate';
    const isLast     = stepIndex >= TOTAL_STEPS;

    let progressHtml = '';
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const cls = i === stepIndex ? ' is-active' : i < stepIndex ? ' is-done' : '';
        progressHtml += `<div class="tuto-progress__dot${cls}"></div>`;
    }

    let affordHtml = '';
    if (data.showAffordability) {
        const bal = readBalance();
        const ok  = bal > 0;
        affordHtml = `<div class="tuto-afford ${ok ? 'tuto-afford--ok' : 'tuto-afford--ko'}">${ok ? '✓' : '✕'} ⬡ ${bal.toLocaleString()} Inkübits</div>`;
    }

    const stepLabel  = tr('tuto.step_of').replace('{n}', stepIndex).replace('{total}', TOTAL_STEPS);
    const heroHtml   = isNavigate ? '' : `<div class="tuto-card__hero"><div class="tuto-card__icon-wrap"><span class="tuto-card__icon-glyph">${data.icon}</span></div></div>`;
    const actionsHtml = isNavigate ? '' : `<button class="tuto-btn-primary">${isLast ? tr('tuto.start') : tr('tuto.next')}</button>`;
    const tapHintHtml = isNavigate && data.tapLabelKey ? `<div class="tuto-tap-hint">↓ ${tr(data.tapLabelKey)}</div>` : '';

    const card = document.createElement('div');
    card.className = `tuto-card${isNavigate ? ' tuto-card--navigate' : ''}`;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', tr(data.titleKey));
    card.innerHTML = `
        <button class="tuto-card__close" aria-label="${tr('tuto.skip')}">✕</button>
        ${heroHtml}
        <div class="tuto-card__step-label"><span class="tuto-card__step-dot"></span>${stepLabel}</div>
        <div class="tuto-card__title">${data.icon} ${tr(data.titleKey)}</div>
        ${affordHtml}
        <div class="tuto-card__body">${tr(data.bodyKey)}</div>
        ${tapHintHtml}
        <div class="tuto-progress">${progressHtml}</div>
        ${actionsHtml}
    `;

    const doSkip = () => {
        if (_busy) return;
        _busy = true;
        _destroyActive();
        onSkip?.();
    };

    const doNext = () => {
        if (_busy) return;
        _busy = true;
        card.classList.add('is-busy');
        _activeOverlay?.remove();
        _activeOverlay = null;
        if (isLast) {
            _destroyActive();
            onNext?.();
        } else {
            _animateOut(card, () => {
                if (_activeCard === card) { _activeCard = null; }
                card.remove();
                _busy = false;
                onNext?.();
            });
        }
    };

    card.querySelector('.tuto-card__close').addEventListener('click', doSkip, { once: true });
    card.querySelector('.tuto-btn-primary')?.addEventListener('click', doNext, { once: true });

    document.body.appendChild(card);
    _activeCard = card;

    requestAnimationFrame(() => {
        if (_activeCard !== card) return; // carte déjà détruite
        if (isNavigate && data.targetSelector) {
            _activeOverlay = _spawnSpotlight(data.targetSelector, doNext);
        } else if (data.targetSelector) {
            _activeOverlay = _spawnBeacon(data.targetSelector);
        }
    });
}

/* ─── Rendu étape langue ─────────────────────────────────────────────── */
function _renderLangStep({ onChose }) {
    _destroyActive();

    const currentLang = getLang();
    const card = document.createElement('div');
    card.className = 'tuto-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', tr('tuto.lang.title'));
    card.innerHTML = `
        <div class="tuto-card__hero"><div class="tuto-card__icon-wrap"><span class="tuto-card__icon-glyph">🌍</span></div></div>
        <div class="tuto-card__title">${tr('tuto.lang.title')}</div>
        <div class="tuto-card__body">${tr('tuto.lang.body')}</div>
        <div class="tuto-lang-btns">
            <button class="tuto-lang-btn${currentLang === 'fr' ? ' is-selected' : ''}" data-lang="fr">${tr('tuto.lang.fr')}</button>
            <button class="tuto-lang-btn${currentLang === 'en' ? ' is-selected' : ''}" data-lang="en">${tr('tuto.lang.en')}</button>
        </div>
    `;
    card.querySelectorAll('.tuto-lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (_busy) return;
            _busy = true;
            setLang(btn.dataset.lang);
            markLangChosen();
            _destroyActive();
            onChose?.();
        }, { once: true });
    });

    document.body.appendChild(card);
    _activeCard = card;
}

/* ─── Contrôleur principal ───────────────────────────────────────────── */
export function createTutorialController() {
    let _running    = false;
    let _onComplete = null;

    function _finish() {
        _running = false;
        _destroyActive();
        completeTutorial();
        _onComplete?.();
    }

    function _skip() {
        _running = false;
        _destroyActive();
        completeTutorial();
        _showSkipToast();
        _onComplete?.();
    }

    function _goToStep(stepIndex) {
        if (!_running) return;
        if (stepIndex > TOTAL_STEPS) { _finish(); return; }
        setTutorialStep(stepIndex);
        _renderContentStep(stepIndex, {
            onNext: () => { if (_running) _goToStep(stepIndex + 1); },
            onSkip: () => { _skip(); },
        });
    }

    function run(onComplete) {
        if (isTutorialDone()) { onComplete?.(); return; }
        if (_running) return;

        _running    = true;
        _onComplete = onComplete;
        _injectStyles();

        const state = getTutorialState();

        if (!state.langChosen) {
            setLang(detectDeviceLang());
            applyTranslations(document);
            _renderLangStep({
                onChose: () => {
                    applyTranslations(document);
                    _goToStep(Math.max(1, state.step > 0 ? state.step + 1 : 1));
                },
            });
        } else {
            _goToStep(Math.max(1, (state.step ?? 0) + 1));
        }
    }

    return { run };
}
