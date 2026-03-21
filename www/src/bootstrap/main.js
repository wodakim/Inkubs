/**
 * INKÜ — Bootstrap Entry Point
 * ─────────────────────────────────────────────────────────────────────────
 * Séquence de démarrage :
 *   1. Le title screen est monté immédiatement (visible à l'utilisateur).
 *   2. Quand le joueur appuie sur PLAY, `onPlay` est appelé → le jeu
 *      s'initialise en parallèle pendant l'animation de sortie du title screen.
 *   3. Le title screen se détruit lui-même une fois la transition terminée.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { createTitleScreen } from './title-screen.js';
import { createGameMenuApp }  from './create-game-menu-app.js';
import { initPerformanceProfile } from '../utils/device-performance-profile.js';

/* ── 0. Détecter les performances du device dès que possible ────────── */
// Lance la détection (benchmark inclus) pendant le title screen, en tâche
// de fond. Le tier est mis en cache dans localStorage pour les prochaines
// sessions. Le CSS data-perf-tier est appliqué dès que le résultat est prêt.
initPerformanceProfile();

/* ── 1. Créer l'app du jeu (sans l'initialiser encore) ──────────────── */
const app = createGameMenuApp(document);

/* ── 2. Monter le title screen et lui passer le callback de démarrage ── */
const titleScreen = createTitleScreen({
    onPlay() {
        // Initialise le jeu dès que le joueur appuie sur PLAY.
        // Le title screen gère sa propre sortie en parallèle.
        _bootGame();
    },
});

titleScreen.mount();

/* ── 3. Démarrage du jeu ─────────────────────────────────────────────── */
function _bootGame() {
    // S'assurer que le DOM est prêt avant d'initialiser
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _initialize, { once: true });
    } else {
        _initialize();
    }
}

function _initialize() {
    app.initialize();

    // Verrouillage orientation portrait (API native)
    // Fonctionne sur PWA installée et la majorité des navigateurs mobiles.
    if (typeof screen !== 'undefined' && screen.orientation?.lock) {
        screen.orientation.lock('portrait').catch(() => {
            // Non supporté sur certains navigateurs (ex. iOS Safari standalone) — fallback CSS actif
        });
    }

    // Synchronisation layout sur les événements environnementaux
    function requestLayoutSync() {
        app.requestLayoutSync();
    }

    window.addEventListener('resize', requestLayoutSync, { passive: true });
    window.visualViewport?.addEventListener('resize', requestLayoutSync, { passive: true });
    window.addEventListener('orientationchange', requestLayoutSync, { passive: true });

    // Exposer l'API publique du jeu
    window.INKU_MENU = Object.freeze({
        store:                   app.store,
        navigationController:    app.navigationController,
        profileModalController:  app.profileModalController,
        contentMountController:  app.contentMountController,
        requestLayoutSync:       app.requestLayoutSync,
        activate:                app.activate,
        deactivate:              app.deactivate,
        destroy:                 app.destroy,
        get isActive() { return app.isActive; },
    });
}

/* ── 4. Blocage du zoom gestuel natif ────────────────────────────────── */
document.addEventListener('gesturestart', (e) => e.preventDefault());
