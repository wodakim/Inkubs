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
