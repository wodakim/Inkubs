// src/features/potion-factory/potion-factory-controller.js
import { getStorageRuntimeContext } from '../storage/storage-runtime-context.js';
import { getPotionDropLimit, PotionPersistence } from './potion-persistence.js';
import { PotionEngine } from './potion-engine.js';
import { createStoragePanelController } from '../storage/storage-panel-controller.js';
import { buildCanonicalBlueprintFromRecord } from '../storage/storage-canonical-inspection-sandbox.js';

import { Slime } from '../../vendor/inku-slime-v3/engine/entities/Slime.js';
import { deepClone } from '../../vendor/inku-slime-v3/shared/object.js';
import {
    canvas as globalCanvas, ctx as globalCtx,
    viewportWidth as globalVW, viewportHeight as globalVH,
    worldWidth as globalWW, worldHeight as globalWH,
    currentSlime as globalSlime,
    particles,
    setCanvas, setViewport, setWorldBounds, setCurrentSlime,
} from '../../vendor/inku-slime-v3/runtime/runtimeState.js';

function createLightweightShelfRenderer() {
    let slimes = new Map();
    let rafId = 0;

    function mount(id, domWrapper, record) {
        if (!domWrapper) return;
        let blueprint = buildCanonicalBlueprintFromRecord(record);

        // Fallback : si le blueprint échoue (procCore incomplet côté serveur),
        // on reconstruit un blueprint minimal depuis storageDisplay pour afficher quand même le slime
        if (!blueprint && record) {
            const sd = record.storageDisplay || {};
            const pc = record.proceduralCore || record.canonicalSnapshot?.proceduralCore || {};
            if (pc.type || sd.typeLabel) {
                blueprint = {
                    schemaVersion: 1,
                    proceduralSeed: record.canonicalId || `shelf_${id}`,
                    type: pc.type || sd.typeLabel || 'blob',
                    baseRadius: pc.baseRadius || 38,
                    numNodes: pc.numNodes || 25,
                    genome: pc.genome || {
                        hue: sd.hue ?? 180,
                        saturation: 80,
                        lightness: 55,
                        colorPattern: sd.colorPattern || 'solid',
                        rarityTier: sd.rarityTier || 'common',
                        rarityScore: sd.rarityScore ?? 0,
                    },
                    stats: pc.stats || {},
                    bodyProfile: pc.bodyProfile || { numNodes: 25 },
                    livingState: record.livingState || null,
                    identity: {
                        schemaVersion: 1, lifecycle: 'canonical',
                        blueprintSchemaVersion: 1,
                        canonical: {
                            schemaVersion: 2, status: 'claimed',
                            canonicalId: record.canonicalId || null,
                        },
                    },
                };
            }
        }

        if (!blueprint) return;

        domWrapper.innerHTML = `<canvas aria-hidden="true" style="display: block; width: 100%; height: 100%; pointer-events: none; touch-action: none;"></canvas>`;
        const canvas = domWrapper.querySelector('canvas');
        const ctx = canvas.getContext('2d', { alpha: true });
        
        // Taille CSS stricte fixée dynamiquement pour ne jamais avoir de "boîtes noires" off-screen
        canvas.width = 90;
        canvas.height = 90;

        let slimeInstance = null;
        let localParticles = [];

        withOwnContext(canvas, ctx, null, localParticles, () => {
            slimeInstance = new Slime({
                blueprint: deepClone(blueprint),
                spawnX: canvas.width * 0.5,
                spawnY: canvas.height * 0.65,
                spawnImpulseY: -1,
                spawnImpulseX: 0,
                boxPadding: 4,
            });
            slimeInstance.worldBounds = { left: 4, top: 4, right: canvas.width - 4, bottom: canvas.height - 4 };

            // Avance rapide pour l'état de repos
            for(let i=0; i<15; i++) slimeInstance.update();
        });

        slimes.set(id, { canvas, ctx, slimeInstance, localParticles });
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function unmountAll() {
        slimes.clear();
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    }

    function tick() {
        if (slimes.size === 0) { rafId = 0; return; }
        
        for (const item of slimes.values()) {
            withOwnContext(item.canvas, item.ctx, item.slimeInstance, item.localParticles, () => {
                item.slimeInstance.update();
                for (let i = item.localParticles.length - 1; i >= 0; i--) {
                    item.localParticles[i].update();
                    if (item.localParticles[i].life <= 0) item.localParticles.splice(i, 1);
                }
                item.ctx.setTransform(1, 0, 0, 1, 0, 0);
                item.ctx.clearRect(0, 0, item.canvas.width, item.canvas.height);
                item.slimeInstance.draw();
                for (const p of item.localParticles) p.draw();
                item.ctx.setTransform(1, 0, 0, 1, 0, 0);
            });
        }
        rafId = requestAnimationFrame(tick);
    }

    function withOwnContext(canvas, localCtx, slime, localParticles, fn) {
        if (!canvas || !localCtx) { fn(); return; }

        const savedCanvas  = globalCanvas;
        const savedCtx     = globalCtx;
        const savedVW      = globalVW;
        const savedVH      = globalVH;
        const savedWW      = globalWW;
        const savedWH      = globalWH;
        const savedSlime   = globalSlime;

        setCanvas(canvas, localCtx);
        setViewport(canvas.width, canvas.height);
        setWorldBounds(canvas.width, canvas.height);
        setCurrentSlime(slime);

        const externalParticles = particles.splice(0);
        particles.push(...localParticles);

        try { fn(); } finally {
            localParticles.length = 0;
            localParticles.push(...particles);
            particles.splice(0);
            particles.push(...externalParticles);
            if (savedCanvas && savedCtx) setCanvas(savedCanvas, savedCtx);
            setViewport(savedVW, savedVH);
            setWorldBounds(savedWW, savedWH);
            setCurrentSlime(savedSlime);
        }
    }

    return { mount, unmountAll };
}

export function createPotionFactoryController({ store }) {
    let root = null;
    let container = null;
    let storagePanel = null;
    let unsubscribeStore = null;
    let unsubscribeRepo = null;
    let timerInterval = null;
    let currentTeamIds = [];
    let shelfRenderer = createLightweightShelfRenderer();

    // -------------------------------------------------------------------------
    // ÉTAT PAR DÉFAUT
    // -------------------------------------------------------------------------
    const DEFAULT_STATE = () => ({
        selectedSlimeId: null,
        flasks: [
            { id: 0, doses: [] },
            { id: 1, doses: [] },
            { id: 2, doses: [] },
            { id: 3, doses: [] }
        ],
        box: {
            potions: [],
            status: 'idle',
            timerEnd: null,
            rewardValue: 0
        }
    });

    // -------------------------------------------------------------------------
    // INITIALISATION DE L'ÉTAT (avec restauration depuis la persistance)
    // -------------------------------------------------------------------------
    function buildInitialState() {
        const saved = PotionPersistence.loadFactoryState();

        if (!saved) {
            return DEFAULT_STATE();
        }

        // Reconstruction d'un état valide depuis le snapshot sauvegardé
        return {
            selectedSlimeId: null, // Non persisté : toujours réinitialisé à null
            flasks: saved.flasks.map(f => ({
                id: f.id,
                doses: Array.isArray(f.doses) ? [...f.doses] : []
            })),
            box: {
                potions: Array.isArray(saved.box.potions)
                    ? saved.box.potions.map(p => ({ doses: Array.isArray(p.doses) ? [...p.doses] : [] }))
                    : [],
                status: saved.box.status || 'idle',
                timerEnd: saved.box.timerEnd || null,
                rewardValue: saved.box.rewardValue || 0
            }
        };
    }

    const state = buildInitialState();

    // -------------------------------------------------------------------------
    // LOGIQUE MÉTIER — Délégation à PotionEngine
    // -------------------------------------------------------------------------

    /**
     * Calcule la minuterie et la récompense de la boîte via PotionEngine.
     * Met à jour state.box en conséquence et lance la boucle de timer.
     */
    function calculateBoxTimerAndReward() {
        const avgRarity = PotionEngine.calculateAverageRarity(state.box.potions);
        const durationMs = PotionEngine.calculatePackagingDurationMs(avgRarity);

        state.box.timerEnd = Date.now() + durationMs;
        state.box.rewardValue = PotionEngine.calculateRewardValue(avgRarity, state.box.potions.length);
        state.box.status = 'packaging';

        PotionPersistence.saveFactoryState(state);
        startTimerLoop();
    }

    // -------------------------------------------------------------------------
    // MINUTERIE
    // -------------------------------------------------------------------------

    function startTimerLoop() {
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            if (state.box.status !== 'packaging') {
                clearInterval(timerInterval);
                return;
            }

            if (Date.now() >= state.box.timerEnd) {
                state.box.status = 'ready';
                clearInterval(timerInterval);
                PotionPersistence.saveFactoryState(state);
            }

            updateBoxUI();
        }, 1000);
    }

    function formatTime(ms) {
        if (ms <= 0) return '00:00';
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    // -------------------------------------------------------------------------
    // CONSTRUCTION DU DOM STATIQUE
    // -------------------------------------------------------------------------

    function buildStaticDOM() {
        container.innerHTML = `
            <div class="pf-shell">
                <header class="pf-header">
                    <h1 class="pf-title"><i class="ph-bold ph-flask"></i> Atelier</h1>
                    <button id="pf-btn-team" class="pf-btn-team">
                        <i class="ph-bold ph-users-three"></i> Équipe
                    </button>
                </header>

                <div class="pf-shelf-area">
                    <div id="pf-shelf-track" class="pf-shelf-track"></div>
                </div>

                <div class="pf-workspace">
                    <div class="pf-desk">
                        <div class="pf-box-zone">
                            <div id="pf-box" class="pf-box">
                                <div class="pf-box-grid">
                                    <div class="pf-box-slot" data-box-slot="0"></div>
                                    <div class="pf-box-slot" data-box-slot="1"></div>
                                    <div class="pf-box-slot" data-box-slot="2"></div>
                                    <div class="pf-box-slot" data-box-slot="3"></div>
                                </div>
                                <div id="pf-box-hud" class="pf-box-hud">
                                    <span id="pf-timer-txt" class="pf-timer-txt"></span>
                                    <span id="pf-ready-txt" class="pf-ready-txt"><i class="ph-bold ph-check-circle"></i> VENDRE</span>
                                </div>
                            </div>
                        </div>

                        <div class="pf-flasks-zone">
                            ${state.flasks.map(flask => `
                                <div class="pf-flask" data-flask-id="${flask.id}">
                                    <div class="pf-flask-body">
                                        <div class="pf-flask-liquid"></div>
                                    </div>
                                    <div class="pf-flask-neck"></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        bindEvents();
    }

    // -------------------------------------------------------------------------
    // LIAISON DES ÉVÉNEMENTS
    // -------------------------------------------------------------------------

    function bindEvents() {
        const teamBtn = container.querySelector('#pf-btn-team');
        if (teamBtn) {
            teamBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                getStoragePanel().toggle();
            });
        }

        container.addEventListener('click', (e) => {
            e.stopPropagation();

            const slimeCard = e.target.closest('.pf-slime-card');
            if (slimeCard) {
                const id = slimeCard.dataset.slimeId;
                state.selectedSlimeId = state.selectedSlimeId === id ? null : id;
                updateTeamUI();
                return;
            }

            const flaskEl = e.target.closest('.pf-flask');
            if (flaskEl) {
                const flaskId = parseInt(flaskEl.dataset.flaskId, 10);
                handleFlaskInteraction(flaskId);
                return;
            }

            const boxEl = e.target.closest('#pf-box');
            if (boxEl && state.box.status === 'ready') {
                handleBoxShipping();
                return;
            }
        });

        // Verrouillage des comportements natifs de drag sur l'application usine
        container.addEventListener('dragstart', e => e.preventDefault());
        container.addEventListener('contextmenu', e => e.preventDefault());
    }

    // -------------------------------------------------------------------------
    // GESTION DES INTERACTIONS
    // -------------------------------------------------------------------------

    /**
     * Gère le clic sur une fiole.
     *
     * Deux comportements :
     *   1. Fiole PLEINE (≥ 2 doses) + boîte non remplie → transvase la fiole dans la boîte.
     *   2. Fiole NON PLEINE + slime sélectionné + boîte idle → ajoute des doses depuis le slime,
     *      dans la limite donnée par getPotionDropLimit() et la capacité restante de la fiole.
     */
    function handleFlaskInteraction(flaskId) {
        const flask = state.flasks.find(f => f.id === flaskId);
        if (!flask) return;

        const FLASK_MAX_DOSES = 2;

        // --- CAS 1 : Transvasement de la fiole pleine vers la boîte ---
        if (flask.doses.length >= FLASK_MAX_DOSES) {
            if (state.box.status === 'idle' && state.box.potions.length < 4) {
                state.box.potions.push({ doses: [...flask.doses] });
                flask.doses = [];

                if (state.box.potions.length === 4) {
                    calculateBoxTimerAndReward(); // Sauvegarde incluse
                } else {
                    PotionPersistence.saveFactoryState(state);
                }

                updateBoxUI();
                updateFlasksUI();
            }
            return;
        }

        // --- CAS 2 : Ajout de gouttes depuis le slime sélectionné ---
        if (state.selectedSlimeId && state.box.status === 'idle') {
            const team = getTeamRecords();
            const activeSlime = team.find(s => s.canonicalId === state.selectedSlimeId);

            if (!activeSlime) return;

            const dropLimit = getPotionDropLimit(activeSlime);
            const availableCapacity = FLASK_MAX_DOSES - flask.doses.length;

            // Nombre de gouttes à ajouter = min(limite du slime, capacité restante de la fiole)
            const dosesToAdd = Math.min(dropLimit, availableCapacity);

            if (dosesToAdd <= 0) return;

            const hue = activeSlime.storageDisplay?.hue ?? 
                        activeSlime.proceduralCore?.genome?.hue ?? 
                        activeSlime.canonicalSnapshot?.proceduralCore?.genome?.hue ?? 
                        0;

            const rarity = activeSlime.storageDisplay?.rarityScore ?? 
                           activeSlime.proceduralCore?.genome?.stats?.rarityScore ?? 
                           activeSlime.canonicalSnapshot?.proceduralCore?.genome?.stats?.rarityScore ?? 
                           1;

            for (let i = 0; i < dosesToAdd; i++) {
                flask.doses.push({ hue, rarity });
            }

            PotionPersistence.saveFactoryState(state);
            updateFlasksUI();
        }
    }

    /**
     * Vend la boîte prête : récompense le joueur, réinitialise la boîte et sauvegarde.
     */
    function handleBoxShipping() {
        store.dispatch({
            type: 'ADD_CURRENCY',
            payload: { currency: 'hexagon', amount: state.box.rewardValue }
        });

        state.box.potions = [];
        state.box.status = 'idle';
        state.box.timerEnd = null;
        state.box.rewardValue = 0;

        PotionPersistence.saveFactoryState(state);

        updateBoxUI();
        updateFlasksUI();
    }

    // -------------------------------------------------------------------------
    // ACCÈS AUX DONNÉES DU REPOSITORY
    // -------------------------------------------------------------------------

    function getTeamRecords() {
        const repository = getStorageRuntimeContext().repository;
        const snapshot = repository.getSnapshot();
        const teamIds = snapshot.teamSlots || [];
        return teamIds.map(id => snapshot.recordsById[id]).filter(Boolean);
    }

    // -------------------------------------------------------------------------
    // MISE À JOUR DU DOM
    // -------------------------------------------------------------------------

    function updateTeamUI() {
        const track = container.querySelector('#pf-shelf-track');
        if (!track) return;

        const teamSlimes = getTeamRecords();

        // Désélection automatique si le slime sélectionné a quitté l'équipe
        if (state.selectedSlimeId && !teamSlimes.find(s => s.canonicalId === state.selectedSlimeId)) {
            state.selectedSlimeId = null;
        }

        if (teamSlimes.length === 0) {
            shelfRenderer.unmountAll();
            currentTeamIds = [];
            track.innerHTML = `<div class="pf-empty-state">Aucun slime dans l'équipe active.</div>`;
            return;
        }

        // Vérification si la composition de l'équipe a changé depuis la dernière fois
        const newIds = teamSlimes.map(s => s.canonicalId);
        const hasTeamChanged = currentTeamIds.length !== newIds.length || !currentTeamIds.every((id, i) => id === newIds[i]);

        if (hasTeamChanged) {
            // Nettoyage complet
            shelfRenderer.unmountAll();
            currentTeamIds = newIds;

            track.innerHTML = teamSlimes.map(slime => {
                const isSelected = slime.canonicalId === state.selectedSlimeId;
                return `
                    <div class="pf-slime-card ${isSelected ? 'is-selected' : ''}" data-slime-id="${slime.canonicalId}">
                        <div class="pf-slime-visual-wrapper" data-slime-canvas="${slime.canonicalId}">
                        </div>
                        <div class="pf-slime-nameplate">${slime.displayName || slime.speciesKey}</div>
                    </div>
                `;
            }).join('');

            // Montage au sein des conteneurs isolés
            teamSlimes.forEach(slime => {
                const wrapper = track.querySelector(`[data-slime-canvas="${slime.canonicalId}"]`);
                if (wrapper) {
                    shelfRenderer.mount(slime.canonicalId, wrapper, slime);
                }
            });
        } else {
            // L'équipe est restée indentique, mettons uniquement à jour la sélection DOM
            const cards = track.querySelectorAll('.pf-slime-card');
            cards.forEach(card => {
                const isSelected = card.dataset.slimeId === state.selectedSlimeId;
                card.classList.toggle('is-selected', isSelected);
            });
        }
    }

    function updateFlasksUI() {
        const flasks = container.querySelectorAll('.pf-flask');

        flasks.forEach(flaskEl => {
            const id = parseInt(flaskEl.dataset.flaskId, 10);
            const data = state.flasks.find(f => f.id === id);
            if (!data) return;

            const doses = data.doses.length;
            const liquid = flaskEl.querySelector('.pf-flask-liquid');

            flaskEl.classList.toggle('is-full', doses >= 2);

            if (liquid) {
                liquid.style.height = `${(doses / 2) * 100}%`;

                if (doses > 0) {
                    // Utilisation de PotionEngine.mixColorsHSL() à la place de la fonction locale
                    const hue = PotionEngine.mixColorsHSL(data.doses.map(d => d.hue));
                    liquid.style.backgroundColor = `hsl(${hue}, 85%, 55%)`;

                    if (doses >= 2) {
                        flaskEl.style.setProperty('--flask-color', `hsl(${hue}, 85%, 55%)`);
                    } else {
                        flaskEl.style.removeProperty('--flask-color');
                    }
                } else {
                    liquid.style.backgroundColor = 'transparent';
                    flaskEl.style.removeProperty('--flask-color');
                }
            }
        });
    }

    function updateBoxUI() {
        const box = container.querySelector('#pf-box');
        if (!box) return;

        box.setAttribute('data-status', state.box.status);

        // Mise à jour des slots de la boîte
        const slots = box.querySelectorAll('.pf-box-slot');
        slots.forEach((slot, i) => {
            const potion = state.box.potions[i];
            if (potion) {
                // Utilisation de PotionEngine.mixColorsHSL() à la place de la fonction locale
                const hue = PotionEngine.mixColorsHSL(potion.doses.map(d => d.hue));
                slot.innerHTML = `<div class="pf-packed-item" style="background-color: hsl(${hue}, 85%, 55%);"></div>`;
            } else {
                slot.innerHTML = '';
            }
        });

        // Mise à jour du HUD (timer / bouton vendre)
        const timerTxt = box.querySelector('#pf-timer-txt');
        if (timerTxt && state.box.status === 'packaging') {
            timerTxt.textContent = formatTime(Math.max(0, state.box.timerEnd - Date.now()));
        }
    }

    // -------------------------------------------------------------------------
    // PANNEAU DE STOCKAGE (lazy init)
    // -------------------------------------------------------------------------

    function getStoragePanel() {
        if (!storagePanel) {
            const repository = getStorageRuntimeContext().repository;
            storagePanel = createStoragePanelController({
                mountTarget: root,
                repository,
                store,
                floatingPanel: true,
                draggable: true,
                dragHandleClassName: 'storage-panel__header',
                zIndex: 9999,
                onVisibilityChange: (isVisible) => {
                    if (!isVisible) updateTeamUI();
                }
            });
            storagePanel.render();
        }
        return storagePanel;
    }

    // -------------------------------------------------------------------------
    // INTERFACE PUBLIQUE DU CONTRÔLEUR
    // -------------------------------------------------------------------------

    return {
        mount(mountPoint) {
            // Guard: if already mounted (container exists), just do a resume
            if (container) {
                container.style.display = '';
                updateTeamUI();
                return;
            }

            root = mountPoint;
            container = document.createElement('div');
            container.className = 'potion-factory-root-container';
            root.appendChild(container);

            buildStaticDOM();
            updateTeamUI();
            updateFlasksUI();
            updateBoxUI();

            // Reprend le timer si la boîte était en cours d'emballage à la reprise de session
            if (state.box.status === 'packaging') {
                startTimerLoop();
            }

            // Abonnements aux changements externes
            const repo = getStorageRuntimeContext().repository;
            if (repo && typeof repo.subscribe === 'function') {
                unsubscribeRepo = repo.subscribe(() => updateTeamUI());
            }
            if (store && typeof store.subscribe === 'function') {
                unsubscribeStore = store.subscribe(() => updateTeamUI());
            }
        },

        resume() {
            if (container) {
                container.style.display = '';
                // Rafraîchit l'équipe en cas de changement pendant la suspension
                updateTeamUI();
                // Redémarre le timer si nécessaire
                if (state.box.status === 'packaging' && !timerInterval) {
                    startTimerLoop();
                }
            }
        },

        suspend() {
            if (storagePanel && storagePanel.isOpen) storagePanel.close();
            if (container) container.style.display = 'none';
        },

        unmount() {
            if (timerInterval) clearInterval(timerInterval);
            if (unsubscribeRepo) unsubscribeRepo();
            if (unsubscribeStore) unsubscribeStore();
            
            shelfRenderer.unmountAll();

            if (storagePanel) {
                storagePanel.destroy();
                storagePanel = null;
            }
            if (container) {
                container.remove();
                container = null;
            }
            root = null;
        }
    };
}
