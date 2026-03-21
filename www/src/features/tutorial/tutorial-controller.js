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

/* ─── i18n helper local ─────────────────────────────────────────────── */
function tr(key) {
    const lang = getLang();
    const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.fr;
    return dict[key] ?? TRANSLATIONS.fr[key] ?? key;
}

/* ─── Données des étapes de contenu (indices 1..5) ──────────────────── */
function getStepData(index) {
    const steps = [
        null, // index 0 = langue (cas spécial)
        { icon: '⬡',  titleKey: 'tuto.money.title',   bodyKey: 'tuto.money.body'   },
        { icon: '🧪', titleKey: 'tuto.buy.title',     bodyKey: 'tuto.buy.body'     },
        { icon: '📦', titleKey: 'tuto.storage.title', bodyKey: 'tuto.storage.body' },
        { icon: '🌿', titleKey: 'tuto.prairie.title', bodyKey: 'tuto.prairie.body' },
        { icon: '⭐', titleKey: 'tuto.level.title',   bodyKey: 'tuto.level.body'   },
    ];
    return steps[index] ?? null;
}

/* ─── Styles injectés une seule fois ────────────────────────────────── */
let stylesInjected = false;
function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
/* ── Tutoriel overlay ──────────────────────────────────────── */
.tuto-overlay{
    position:fixed;inset:0;z-index:9999;
    display:flex;align-items:flex-end;justify-content:center;
    background:rgba(2,8,16,0.72);
    backdrop-filter:blur(3px);
    -webkit-backdrop-filter:blur(3px);
    animation:tutoFadeIn 0.22s ease;
    padding-bottom:env(safe-area-inset-bottom, 0px);
    touch-action:none;
}
@keyframes tutoFadeIn{from{opacity:0}to{opacity:1}}
@keyframes tutoSlideUp{from{transform:translateY(28px);opacity:0}to{transform:translateY(0);opacity:1}}

.tuto-card{
    width:100%;max-width:440px;
    background:linear-gradient(160deg,rgba(10,22,38,0.97) 0%,rgba(4,14,26,0.99) 100%);
    border:1px solid rgba(52,211,153,0.18);
    border-bottom:none;
    border-radius:24px 24px 0 0;
    padding:28px 24px 0;
    padding-bottom:calc(24px + env(safe-area-inset-bottom, 0px));
    box-shadow:0 -8px 48px rgba(0,0,0,0.55),0 0 0 1px rgba(52,211,153,0.07);
    animation:tutoSlideUp 0.28s cubic-bezier(0.16,1,0.3,1);
    position:relative;
}

.tuto-card__close{
    position:absolute;top:16px;right:16px;
    width:36px;height:36px;border-radius:50%;
    background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.28);
    color:rgba(239,68,68,0.9);font-size:1.1rem;line-height:1;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;touch-action:manipulation;
    transition:background 0.15s,transform 0.12s;
}
.tuto-card__close:active{background:rgba(239,68,68,0.28);transform:scale(0.9);}

.tuto-card__step-label{
    font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;
    color:rgba(52,211,153,0.55);margin-bottom:12px;font-weight:600;
}

.tuto-card__icon{
    font-size:2rem;line-height:1;margin-bottom:10px;
}

.tuto-card__title{
    font-size:1.18rem;font-weight:800;color:#e2f8ee;
    margin-bottom:10px;line-height:1.25;
}

.tuto-card__body{
    font-size:0.84rem;color:rgba(196,226,210,0.82);line-height:1.6;
    margin-bottom:22px;white-space:pre-line;
}
.tuto-card__body strong{color:#34d399;}

.tuto-card__dots{
    display:flex;gap:6px;justify-content:center;margin-bottom:16px;
}
.tuto-card__dot{
    width:6px;height:6px;border-radius:3px;
    background:rgba(52,211,153,0.2);
    transition:background 0.18s,width 0.18s;
}
.tuto-card__dot.is-active{background:#34d399;width:18px;}

.tuto-card__actions{
    display:flex;gap:10px;margin-bottom:24px;
}

.tuto-btn-primary{
    flex:1;min-height:50px;border-radius:14px;
    background:linear-gradient(135deg,#059669,#34d399);
    color:#fff;font-size:0.95rem;font-weight:700;
    border:none;cursor:pointer;touch-action:manipulation;
    transition:opacity 0.15s,transform 0.12s;box-shadow:0 2px 12px rgba(52,211,153,0.28);
}
.tuto-btn-primary:active{opacity:0.85;transform:scale(0.97);}

/* ── Étape langue ────────────────────────────────────────── */
.tuto-lang-btns{
    display:flex;gap:12px;margin-bottom:24px;
}
.tuto-lang-btn{
    flex:1;min-height:54px;border-radius:14px;
    background:rgba(52,211,153,0.07);border:1.5px solid rgba(52,211,153,0.22);
    color:#e2f8ee;font-size:1rem;font-weight:700;
    cursor:pointer;touch-action:manipulation;
    transition:background 0.15s,border-color 0.15s,transform 0.12s;
}
.tuto-lang-btn:active{background:rgba(52,211,153,0.18);border-color:rgba(52,211,153,0.5);transform:scale(0.97);}
.tuto-lang-btn.is-selected{
    background:rgba(52,211,153,0.18);border-color:#34d399;
    box-shadow:0 0 0 2px rgba(52,211,153,0.18);
}
`;
    document.head.appendChild(style);
}

/* ─── Rendu d'une étape de contenu (indices 1..5) ───────────────────── */
function renderContentStep(stepIndex, { onNext, onSkip }) {
    const data = getStepData(stepIndex);
    if (!data) return null;

    const overlay = document.createElement('div');
    overlay.className = 'tuto-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', tr(data.titleKey));

    const stepLabel = tr('tuto.step_of')
        .replace('{n}', stepIndex)
        .replace('{total}', TOTAL_STEPS);

    const isLast = stepIndex >= TOTAL_STEPS;

    // Build dots HTML
    let dotsHtml = '';
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        dotsHtml += `<div class="tuto-card__dot${i === stepIndex ? ' is-active' : ''}"></div>`;
    }

    overlay.innerHTML = `
<div class="tuto-card">
    <button class="tuto-card__close" aria-label="${tr('tuto.skip')}">✕</button>
    <div class="tuto-card__step-label">${stepLabel}</div>
    <div class="tuto-card__icon">${data.icon}</div>
    <h2 class="tuto-card__title">${tr(data.titleKey)}</h2>
    <div class="tuto-card__body">${tr(data.bodyKey)}</div>
    <div class="tuto-card__dots">${dotsHtml}</div>
    <div class="tuto-card__actions">
        <button class="tuto-btn-primary">${isLast ? tr('tuto.start') : tr('tuto.next')}</button>
    </div>
</div>`;

    const card = overlay.querySelector('.tuto-card');
    overlay.querySelector('.tuto-card__close').addEventListener('click', () => {
        overlay.remove();
        onSkip?.();
    });
    overlay.querySelector('.tuto-btn-primary').addEventListener('click', () => {
        card.style.animation = 'none';
        overlay.remove();
        onNext?.();
    });
    // Tap on overlay background = skip (same as X)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { overlay.remove(); onSkip?.(); }
    });

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
    <div class="tuto-card__icon">🌍</div>
    <h2 class="tuto-card__title">${tr('tuto.lang.title')}</h2>
    <div class="tuto-card__body">${tr('tuto.lang.body')}</div>
    <div class="tuto-lang-btns">
        <button class="tuto-lang-btn${currentLang === 'fr' ? ' is-selected' : ''}" data-lang="fr">${tr('tuto.lang.fr')}</button>
        <button class="tuto-lang-btn${currentLang === 'en' ? ' is-selected' : ''}" data-lang="en">${tr('tuto.lang.en')}</button>
    </div>
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
        onCompleteCallback?.();
    }

    /**
     * Lance l'étape de contenu stepIndex (1..TOTAL_STEPS).
     * Enchaîne automatiquement sur les suivantes.
     */
    function runContentStep(stepIndex) {
        if (!active) return;
        if (stepIndex > TOTAL_STEPS) { finish(); return; }

        setTutorialStep(stepIndex);

        const overlay = renderContentStep(stepIndex, {
            onNext: () => { if (active) runContentStep(stepIndex + 1); },
            onSkip: () => { skip(); },
        });
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
