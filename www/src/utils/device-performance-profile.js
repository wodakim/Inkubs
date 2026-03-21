/**
 * INKÜ — Device Performance Profile
 * ─────────────────────────────────────────────────────────────────────────────
 * Détecte automatiquement la puissance du device et retourne un palier de
 * qualité graphique parmi : 'low' | 'medium' | 'high'.
 *
 * Signaux utilisés (par ordre de fiabilité) :
 *   1. navigator.deviceMemory  — RAM disponible (Chrome/Android)
 *   2. navigator.hardwareConcurrency — nombre de CPU cores
 *   3. window.devicePixelRatio — résolution de l'écran
 *   4. Micro-benchmark canvas  — durée réelle d'un rendu complexe
 *
 * Le résultat est mis en cache dans localStorage pour éviter de refaire le
 * benchmark à chaque lancement.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CACHE_KEY   = 'inku.perf.profile.v1';
const CACHE_TTL   = 7 * 24 * 60 * 60 * 1000; // 7 jours

/** Paramètres de rendu pour chaque palier */
export const PERF_SETTINGS = {
    low: {
        dprCap:              1.0,
        particleMin:         0,
        particleMax:         8,
        particleDensityArea: 0, // désactive les particules extras
        renderSubsurface:    false,
        renderRarityAura:    false,
        renderBodyOverlay:   false,
        renderHighlights:    false,
        renderRimLight:      false,
    },
    medium: {
        dprCap:              1.25,
        particleMin:         8,
        particleMax:         18,
        particleDensityArea: 28000,
        renderSubsurface:    false,
        renderRarityAura:    true,
        renderBodyOverlay:   false,
        renderHighlights:    true,
        renderRimLight:      false,
    },
    high: {
        dprCap:              1.5,
        particleMin:         24,
        particleMax:         40,
        particleDensityArea: 18000,
        renderSubsurface:    true,
        renderRarityAura:    true,
        renderBodyOverlay:   true,
        renderHighlights:    true,
        renderRimLight:      true,
    },
};

// ── Module-level cache (valide pour la session courante) ──────────────────
let _cachedTier = null;

/**
 * Retourne le palier actif (synchrone, utilise le cache session/localStorage).
 * Retourne 'high' si la détection n'a pas encore été effectuée.
 * @returns {'low'|'medium'|'high'}
 */
export function getPerformanceTier() {
    if (_cachedTier) return _cachedTier;

    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const saved = JSON.parse(raw);
            if (
                saved &&
                Date.now() - (saved.ts || 0) < CACHE_TTL &&
                (saved.tier === 'low' || saved.tier === 'medium' || saved.tier === 'high')
            ) {
                _cachedTier = saved.tier;
                return _cachedTier;
            }
        }
    } catch (_) {}

    return 'high'; // fallback optimiste jusqu'à la détection complète
}

/**
 * Retourne les paramètres de rendu pour le palier actif.
 * @returns {typeof PERF_SETTINGS.high}
 */
export function getPerfSettings() {
    return PERF_SETTINGS[getPerformanceTier()];
}

// ── Scoring du device ─────────────────────────────────────────────────────

function getHardwareScore() {
    let score = 0;

    // RAM (0-3 pts) — navigator.deviceMemory: 0.25 / 0.5 / 1 / 2 / 4 / 8 GB
    const ram = navigator.deviceMemory;
    if (typeof ram === 'number') {
        if (ram >= 6)      score += 3;
        else if (ram >= 3) score += 2;
        else if (ram >= 2) score += 1;
        // < 2 GB → 0 pt
    } else {
        score += 2; // desktop sans API → présume mid-high
    }

    // CPU cores (0-3 pts)
    const cores = navigator.hardwareConcurrency;
    if (typeof cores === 'number') {
        if (cores >= 8)      score += 3;
        else if (cores >= 4) score += 2;
        else if (cores >= 2) score += 1;
        // 1 core → 0 pt
    } else {
        score += 2;
    }

    // DPR élevé + petit écran = mobile haut de gamme
    const dpr = window.devicePixelRatio || 1;
    const screenPx = (screen.width || 0) * (screen.height || 0);
    if (dpr >= 3 && screenPx > 1_000_000) score += 1;

    return score; // max 7
}

// ── Micro-benchmark canvas ────────────────────────────────────────────────

/**
 * Exécute ~30 frames de rendu canvas et retourne le temps moyen par frame (ms).
 */
function runCanvasBenchmark() {
    return new Promise((resolve) => {
        const c   = document.createElement('canvas');
        c.width   = 256;
        c.height  = 256;
        const ctx = c.getContext('2d');
        if (!ctx) { resolve(Infinity); return; }

        const FRAMES = 30;
        let   frame  = 0;
        const start  = performance.now();

        function tick() {
            // Simule le coût d'un draw de slime : plusieurs createRadialGradient + path
            ctx.clearRect(0, 0, 256, 256);
            for (let i = 0; i < 5; i++) {
                const g = ctx.createRadialGradient(128, 100, 0, 128, 128, 110);
                g.addColorStop(0,   'rgba(16,185,129,0.6)');
                g.addColorStop(0.5, 'rgba(59,130,246,0.3)');
                g.addColorStop(1,   'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(128, 128, 110, 0, Math.PI * 2);
                ctx.fill();
            }

            frame++;
            if (frame < FRAMES) {
                requestAnimationFrame(tick);
            } else {
                const avgMs = (performance.now() - start) / FRAMES;
                resolve(avgMs);
            }
        }

        requestAnimationFrame(tick);
    });
}

function benchmarkToScore(avgFrameMs) {
    // < 4 ms/frame → très fluide → +2
    // 4-10 ms      → correct    → +1
    // > 10 ms      → lent       → 0
    if (avgFrameMs < 4)  return 2;
    if (avgFrameMs < 10) return 1;
    return 0;
}

function scoreToTier(total) {
    // Score max théorique : hardwareScore (7) + benchmark (2) = 9
    if (total >= 6) return 'high';
    if (total >= 3) return 'medium';
    return 'low';
}

/**
 * Détecte le palier de performance de façon asynchrone (inclut le benchmark).
 * Met à jour le cache localStorage et applique le tier sur le <html>.
 * @returns {Promise<'low'|'medium'|'high'>}
 */
/**
 * Permet au joueur de forcer manuellement un palier de performance.
 * Met à jour le cache localStorage et applique immédiatement les changements.
 * @param {'low'|'medium'|'high'} tier
 */
export function setPerformanceTier(tier) {
    if (tier !== 'low' && tier !== 'medium' && tier !== 'high') return;
    _cachedTier = tier;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ tier, ts: Date.now(), manual: true }));
    } catch (_) {}
    applyTierToDOM(tier);
}

export async function detectAndApplyPerformanceProfile() {
    const hwScore    = getHardwareScore();
    const benchScore = await runCanvasBenchmark();
    const total      = hwScore + benchmarkToScore(benchScore);
    const tier       = scoreToTier(total);

    _cachedTier = tier;

    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ tier, ts: Date.now(), hwScore, benchMs: benchScore }));
    } catch (_) {}

    applyTierToDOM(tier);
    return tier;
}

/**
 * Applique l'attribut `data-perf-tier` sur <html> pour le CSS,
 * et met à jour le renderQuality du runtimeState si disponible.
 */
export function applyTierToDOM(tier) {
    document.documentElement.setAttribute('data-perf-tier', tier);
    _applyRenderQuality(tier);
}

function _applyRenderQuality(tier) {
    // Import dynamique pour éviter une dépendance circulaire au chargement initial
    import('../vendor/inku-slime-v3/runtime/runtimeState.js')
        .then(({ setRenderQuality }) => {
            const s = PERF_SETTINGS[tier];
            setRenderQuality({
                subsurface:  s.renderSubsurface,
                rarityAura:  s.renderRarityAura,
                bodyOverlay: s.renderBodyOverlay,
                highlights:  s.renderHighlights,
                rimLight:    s.renderRimLight,
            });
        })
        .catch(() => {});
}

/**
 * Applique le tier mis en cache (s'il existe) immédiatement sur le DOM,
 * puis lance la détection complète en arrière-plan.
 * À appeler au plus tôt dans le bootstrap.
 */
export function initPerformanceProfile() {
    const cached = getPerformanceTier();
    applyTierToDOM(cached);
    // Lancement asynchrone pour ne pas bloquer le rendu initial
    detectAndApplyPerformanceProfile().catch(() => {});
}
