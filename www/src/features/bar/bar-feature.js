/**
 * INKÜ — Bar Feature v1.0
 * Scène animée du bar avec Gloop le slime barman.
 * Gloop parle en langue slime, se racle la gorge, puis propose des quêtes.
 */

import { t, getLang } from '../../i18n/i18n.js';
import { createQuestEngine } from './quest-engine.js';
import { createQuestPanel  } from './quest-panel.js';

// ── Langue slime aléatoire ─────────────────────────────────────────────────
const SLIME_PHRASES = [
    'Grlb... blblbl! Bzzrt... shlrp!',
    'Mfmpf... glglgl! Zrrt brbr...',
    'Splrk! Glbblb... frglph! Brbb...',
    'Bzzt... grlgrl! Mphm splork...',
    'Glrp! Shlorp brbrbr... fzzzt!',
];

function randomSlimePhrase() {
    return SLIME_PHRASES[Math.floor(Math.random() * SLIME_PHRASES.length)];
}

// ── SVG Slime Gloop ────────────────────────────────────────────────────────
function buildSlimeSVG() {
    return `
    <svg class="bar-slime__svg" viewBox="0 0 110 145" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="gloop-body" cx="38%" cy="32%">
          <stop offset="0%"   stop-color="#6ee7b7" stop-opacity="0.95"/>
          <stop offset="55%"  stop-color="#10b981" stop-opacity="0.90"/>
          <stop offset="100%" stop-color="#047857" stop-opacity="0.88"/>
        </radialGradient>
        <radialGradient id="gloop-shine" cx="30%" cy="28%">
          <stop offset="0%"   stop-color="white" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="gloop-pupil-l" cx="38%" cy="35%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </radialGradient>
        <radialGradient id="gloop-pupil-r" cx="38%" cy="35%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </radialGradient>
        <filter id="gloop-shadow" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,0.4)"/>
        </filter>
        <filter id="gloop-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>

      <!-- Antenne -->
      <line x1="55" y1="14" x2="55" y2="5" stroke="#059669" stroke-width="2" stroke-linecap="round"/>
      <circle class="bar-slime__antenna" cx="55" cy="3" r="4.5" fill="#34d399" stroke="#047857" stroke-width="1"/>

      <!-- Ombre portée -->
      <ellipse cx="57" cy="130" rx="34" ry="6" fill="rgba(0,0,0,0.22)"/>

      <!-- Corps principal -->
      <path class="bar-slime__body" filter="url(#gloop-shadow)"
        d="M 55 14
           C 30 14, 14 34, 11 58
           C 7  80, 18 105, 36 116
           C 46 123, 64 123, 74 116
           C 92 105, 103 80, 99 58
           C 96 34, 80 14, 55 14 Z"
        fill="url(#gloop-body)"
        stroke="rgba(4,120,87,0.6)"
        stroke-width="1.5"
      />

      <!-- Reflet / shine -->
      <ellipse cx="38" cy="48" rx="16" ry="11"
        fill="url(#gloop-shine)"
        transform="rotate(-20 38 48)"
      />

      <!-- Yeux blancs -->
      <circle cx="40" cy="70" r="11" fill="white"/>
      <circle cx="70" cy="70" r="11" fill="white"/>

      <!-- Pupilles -->
      <circle class="bar-slime__pupil-l" cx="42" cy="72" r="6" fill="url(#gloop-pupil-l)"/>
      <circle class="bar-slime__pupil-r" cx="72" cy="72" r="6" fill="url(#gloop-pupil-r)"/>

      <!-- Reflets pupilles -->
      <circle cx="39" cy="70" r="2.2" fill="white" opacity="0.85"/>
      <circle cx="69" cy="70" r="2.2" fill="white" opacity="0.85"/>

      <!-- Bouche (idle smile → s'anime en talking) -->
      <path class="bar-slime__mouth"
        d="M 41 92 Q 55 105 69 92"
        stroke="#047857" stroke-width="2.5" fill="none"
        stroke-linecap="round"
      />

      <!-- Nœud papillon de barman -->
      <path d="M 40 117 L 55 124 L 70 117 L 55 110 Z"
        fill="#f59e0b" stroke="#b45309" stroke-width="1" stroke-linejoin="round"
      />
      <circle cx="55" cy="117" r="3.5" fill="#fde68a" stroke="#b45309" stroke-width="0.8"/>
    </svg>`;
}

// ── Scene HTML ─────────────────────────────────────────────────────────────
function buildSceneHTML() {
    return `
    <section class="bar-feature" data-bar-scene>

        <!-- ── Environnement du bar ── -->
        <div class="bar-bg" aria-hidden="true">

            <!-- Mur de briques -->
            <div class="bar-bg__wall"></div>

            <!-- Étagères avec bouteilles -->
            <div class="bar-bg__shelves">
                <div class="bar-shelf bar-shelf--top">
                    <span class="bar-bottle bar-bottle--tall bar-bottle--green"></span>
                    <span class="bar-bottle bar-bottle--round bar-bottle--amber"></span>
                    <span class="bar-bottle bar-bottle--tall bar-bottle--blue"></span>
                    <span class="bar-bottle bar-bottle--round bar-bottle--purple"></span>
                    <span class="bar-bottle bar-bottle--tall bar-bottle--amber"></span>
                    <span class="bar-bottle bar-bottle--round bar-bottle--green"></span>
                    <span class="bar-glass"></span>
                    <span class="bar-glass"></span>
                    <span class="bar-glass bar-glass--full"></span>
                </div>
                <div class="bar-shelf bar-shelf--mid">
                    <span class="bar-bottle bar-bottle--round bar-bottle--amber"></span>
                    <span class="bar-bottle bar-bottle--tall bar-bottle--purple"></span>
                    <span class="bar-glass bar-glass--full"></span>
                    <span class="bar-bottle bar-bottle--round bar-bottle--green"></span>
                    <span class="bar-bottle bar-bottle--tall bar-bottle--blue"></span>
                    <span class="bar-glass"></span>
                    <span class="bar-bottle bar-bottle--round bar-bottle--amber"></span>
                </div>
            </div>

            <!-- Enseigne néon -->
            <div class="bar-neon-sign" aria-hidden="true">
                <span class="bar-neon-text bar-neon-text--main">INKÜ</span>
                <span class="bar-neon-text bar-neon-text--sub">BAR</span>
            </div>

            <!-- Lumière chaude du plafond -->
            <div class="bar-bg__pendant-light"></div>
            <div class="bar-bg__light-cone"></div>

            <!-- Particules de fumée ambiante -->
            <div class="bar-bg__smoke">
                <span class="bar-smoke-particle"></span>
                <span class="bar-smoke-particle"></span>
                <span class="bar-smoke-particle"></span>
                <span class="bar-smoke-particle"></span>
                <span class="bar-smoke-particle"></span>
            </div>
        </div>

        <!-- ── Zone barman + comptoir ── -->
        <div class="bar-scene-mid">

            <!-- Barman Gloop -->
            <div class="bar-bartender" data-bar-bartender role="button"
                 tabindex="0" aria-label="${t('bar.slime_aria')}">

                <!-- Bulle de dialogue -->
                <div class="bar-bubble" data-bar-bubble hidden aria-live="polite">
                    <div class="bar-bubble__text" data-bar-bubble-text></div>
                </div>

                <!-- Slime SVG -->
                <div class="bar-slime" data-bar-slime>
                    ${buildSlimeSVG()}
                    <div class="bar-slime__click-hint" data-bar-click-hint>
                        <span class="bar-slime__click-ring"></span>
                        <span class="bar-slime__click-icon">👆</span>
                    </div>
                </div>
            </div>

            <!-- Comptoir -->
            <div class="bar-counter" aria-hidden="true">
                <div class="bar-counter__top">
                    <div class="bar-counter__top-shine"></div>
                    <div class="bar-counter__glass"></div>
                </div>
                <div class="bar-counter__body">
                    <div class="bar-counter__panel"></div>
                </div>
                <div class="bar-counter__tap">
                    <div class="bar-counter__tap-head"></div>
                    <div class="bar-counter__tap-pipe"></div>
                </div>
            </div>
        </div>

        <!-- ── Espace joueur (en dessous du comptoir) ── -->
        <div class="bar-floor" aria-hidden="true">
            <div class="bar-floor__mat"></div>
        </div>

    </section>`;
}

// ── Dialogue controller ────────────────────────────────────────────────────
function createDialogueController({ bartenderEl, bubbleEl, bubbleTextEl, slimeEl }) {
    let phase = 'idle';
    let timer = null;

    function clearTimer() {
        if (timer) { clearTimeout(timer); timer = null; }
    }

    function setPhase(p) {
        phase = p;
        bartenderEl.dataset.dialoguePhase = p;
    }

    function typewrite(el, text, msPerChar = 28, onDone) {
        el.textContent = '';
        let i = 0;
        const tick = () => {
            if (i < text.length) {
                el.textContent += text[i++];
                timer = setTimeout(tick, msPerChar);
            } else {
                onDone?.();
            }
        };
        timer = setTimeout(tick, 20);
    }

    function start(onDone) {
        if (phase !== 'idle') return;
        clearTimer();

        // Phase 1 — Langue slime
        setPhase('slime');
        bubbleEl.hidden = false;
        bubbleEl.classList.remove('is-human');
        bubbleEl.classList.add('is-slime');
        const phrase = randomSlimePhrase();
        typewrite(bubbleTextEl, phrase, 40, () => {

            // Phase 2 — Raclement de gorge
            timer = setTimeout(() => {
                setPhase('clear');
                bubbleEl.classList.remove('is-slime');
                bubbleTextEl.textContent = '...✦ahem✦...';

                timer = setTimeout(() => {

                    // Phase 3 — Langue humaine
                    setPhase('human');
                    bubbleEl.classList.add('is-human');
                    const speech = t('bar.gloop_speech');
                    typewrite(bubbleTextEl, speech, 24, () => {
                        setPhase('done');
                        onDone?.();
                    });

                }, 800);
            }, 600);
        });
    }

    function reset() {
        clearTimer();
        setPhase('idle');
        bubbleEl.hidden = true;
        bubbleEl.classList.remove('is-slime', 'is-human');
        bubbleTextEl.textContent = '';
    }

    function destroy() {
        clearTimer();
    }

    return { start, reset, destroy, getPhase: () => phase };
}

// ── Feature principale ─────────────────────────────────────────────────────
export function createBarFeature({ store }) {
    let host        = null;
    let root        = null;
    let questEngine = null;
    let questPanel  = null;
    let dialogue    = null;
    let canTalk     = true;

    function buildScene() {
        root = document.createElement('div');
        root.className = 'bar-feature-wrapper';
        root.innerHTML = buildSceneHTML();

        const bartenderEl  = root.querySelector('[data-bar-bartender]');
        const bubbleEl     = root.querySelector('[data-bar-bubble]');
        const bubbleTextEl = root.querySelector('[data-bar-bubble-text]');
        const slimeEl      = root.querySelector('[data-bar-slime]');
        const clickHint    = root.querySelector('[data-bar-click-hint]');

        dialogue = createDialogueController({ bartenderEl, bubbleEl, bubbleTextEl, slimeEl });

        // Clic / tap sur le barman
        const onTalk = () => {
            if (!canTalk || dialogue.getPhase() !== 'idle') {
                // Si déjà fait ou en cours → ouvre directement le panneau
                if (dialogue.getPhase() === 'done') {
                    questPanel?.open();
                }
                return;
            }
            canTalk = false;
            if (clickHint) clickHint.hidden = true;

            questEngine.markBarTalked();

            dialogue.start(() => {
                // Après le dialogue → ouvre le panneau
                questPanel?.open();
            });
        };

        bartenderEl.addEventListener('click',   onTalk);
        bartenderEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTalk(); } });

        // Réinitialisation quand panneau fermé : permet de reparler
        // (mais le dialogue ne rejoue pas, juste ouvre le panneau direct)
    }

    return {
        id: 'bar',

        mount({ mount }) {
            host = mount;
            buildScene();
            host.appendChild(root);

            questEngine = createQuestEngine({ store });
            questEngine.mount();

            questPanel = createQuestPanel({
                engine: questEngine,
                onClose: () => { /* rien de spécial */ },
            });
            questPanel.mount(root);
        },

        resume({ mount }) {
            host = mount;
        },

        suspend() {
            // Ferme la bulle de dialogue si on change de section
            dialogue?.reset();
            canTalk = true;
        },

        unmount() {
            dialogue?.destroy();
            questPanel?.destroy();
            questEngine?.destroy();
            root?.remove();
            root        = null;
            host        = null;
            questEngine = null;
            questPanel  = null;
            dialogue    = null;
        },
    };
}
