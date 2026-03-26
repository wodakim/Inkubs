// src/features/potion-factory/potion-factory-controller.js
import { getStorageRuntimeContext } from '../storage/storage-runtime-context.js';
import {
    getPotionDropLimit, PotionPersistence,
    BOX_MAX, POTION_MAX, FLASK_COUNT, BOX_COST, POTION_COST, FLASK_MAX_DOSES,
} from './potion-persistence.js';
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

// ── Shelf renderer (lightweight slime previews) ───────────────────────────────
function createLightweightShelfRenderer() {
    let slimes = new Map();
    let rafId = 0;

    function mount(id, domWrapper, record) {
        if (!domWrapper) return;
        let blueprint = buildCanonicalBlueprintFromRecord(record);
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
                        hue: sd.hue ?? 180, saturation: 80, lightness: 55,
                        colorPattern: sd.colorPattern || 'solid',
                        rarityTier: sd.rarityTier || 'common',
                        rarityScore: sd.rarityScore ?? 0,
                    },
                    stats: pc.stats || {},
                    bodyProfile: pc.bodyProfile || { numNodes: 25 },
                    livingState: record.livingState || null,
                    identity: {
                        schemaVersion: 1, lifecycle: 'canonical', blueprintSchemaVersion: 1,
                        canonical: { schemaVersion: 2, status: 'claimed', canonicalId: record.canonicalId || null },
                    },
                };
            }
        }
        if (!blueprint) return;

        domWrapper.innerHTML = `<canvas aria-hidden="true" style="display:block;width:100%;height:100%;pointer-events:none;touch-action:none;"></canvas>`;
        const canvas = domWrapper.querySelector('canvas');
        const ctx = canvas.getContext('2d', { alpha: true });
        canvas.width = 64; canvas.height = 64;
        let slimeInstance = null, localParticles = [];
        withOwnCtx(canvas, ctx, null, localParticles, () => {
            slimeInstance = new Slime({ blueprint: deepClone(blueprint), spawnX: 32, spawnY: 42, spawnImpulseY: -1, boxPadding: 4 });
            slimeInstance.worldBounds = { left: 4, top: 4, right: 60, bottom: 60 };
            for (let i = 0; i < 15; i++) slimeInstance.update();
        });
        slimes.set(id, { canvas, ctx, slimeInstance, localParticles });
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function unmountAll() { slimes.clear(); if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

    function tick() {
        if (!slimes.size) { rafId = 0; return; }
        for (const item of slimes.values()) {
            withOwnCtx(item.canvas, item.ctx, item.slimeInstance, item.localParticles, () => {
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

    function withOwnCtx(canvas, localCtx, slime, localParticles, fn) {
        if (!canvas || !localCtx) { fn(); return; }
        const sC = globalCanvas, sX = globalCtx, sVW = globalVW, sVH = globalVH,
              sWW = globalWW, sWH = globalWH, sS = globalSlime;
        setCanvas(canvas, localCtx); setViewport(canvas.width, canvas.height);
        setWorldBounds(canvas.width, canvas.height); setCurrentSlime(slime);
        const ext = particles.splice(0); particles.push(...localParticles);
        try { fn(); } finally {
            localParticles.length = 0; localParticles.push(...particles);
            particles.splice(0); particles.push(...ext);
            if (sC && sX) setCanvas(sC, sX);
            setViewport(sVW, sVH); setWorldBounds(sWW, sWH); setCurrentSlime(sS);
        }
    }

    return { mount, unmountAll };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ms) {
    if (ms <= 0) return '00:00';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;
}

function makeEmptyBox(id) {
    return { id, potions: [], status: 'idle', timerEnd: null, rewardValue: 0 };
}

// ── Controller principal ──────────────────────────────────────────────────────
export function createPotionFactoryController({ store }) {
    let root = null, container = null, storagePanel = null;
    let unsubStore = null, unsubRepo = null;
    let timerIntervals = new Map();
    let currentTeamIds = [];
    let selectedBoxId = null;
    const shelfRenderer = createLightweightShelfRenderer();

    // ── État initial ──────────────────────────────────────────────────────────
    function buildInitialState() {
        const saved = PotionPersistence.loadFactoryState();
        if (!saved) {
            return {
                selectedSlimeId: null,
                flasks: Array.from({ length: FLASK_COUNT }, (_, i) => ({ id: i, doses: [] })),
                boxes: [],
            };
        }
        return {
            selectedSlimeId: null,
            flasks: saved.flasks.map(f => ({ id: f.id, doses: Array.isArray(f.doses) ? [...f.doses] : [] })),
            boxes: (saved.boxes || []).map(b => ({
                id: b.id,
                potions: Array.isArray(b.potions)
                    ? b.potions.slice(0, POTION_MAX).map(p => ({ doses: Array.isArray(p.doses) ? [...p.doses] : [] }))
                    : [],
                status: b.status || 'idle',
                timerEnd: b.timerEnd || null,
                rewardValue: b.rewardValue || 0,
            })),
        };
    }

    const state = buildInitialState();

    // ── Timers par boîte ──────────────────────────────────────────────────────
    function startTimer(boxId) {
        if (timerIntervals.has(boxId)) clearInterval(timerIntervals.get(boxId));
        const iv = setInterval(() => {
            const box = state.boxes.find(b => b.id === boxId);
            if (!box || box.status !== 'packaging') { clearInterval(iv); timerIntervals.delete(boxId); return; }
            if (Date.now() >= box.timerEnd) {
                box.status = 'ready';
                clearInterval(iv); timerIntervals.delete(boxId);
                PotionPersistence.saveFactoryState(state);
            }
            updateBoxesUI();
        }, 1000);
        timerIntervals.set(boxId, iv);
    }

    // ── DOM ───────────────────────────────────────────────────────────────────
    function buildStaticDOM() {
        // Génère les 6 fioles
        const flasksHTML = Array.from({ length: FLASK_COUNT }, (_, i) => `
            <div class="pf-flask" data-flask-id="${i}" title="Fiole ${i+1}">
                <div class="pf-flask-body">
                    <div class="pf-flask-liquid"></div>
                    <div class="pf-flask-shine"></div>
                </div>
                <div class="pf-flask-stand"></div>
                <span class="pf-flask-label">${i+1}</span>
            </div>
        `).join('');

        container.innerHTML = `
        <div class="pf-shell">

            <header class="pf-header">
                <h1 class="pf-title">⚗ Atelier Potions</h1>
                <button id="pf-btn-team" class="pf-btn-team" type="button">🧬 Équipe</button>
            </header>

            <div class="pf-intro-banner">
                💰 Remplissez des boîtes de <strong>4 potions</strong> pour gagner des <strong>💎</strong>
            </div>

            <!-- Étagère des slimes (défilante) -->
            <div class="pf-shelf-area" id="pf-shelf-area">
                <div id="pf-shelf-track" class="pf-shelf-track"></div>
            </div>

            <!-- Table de travail -->
            <div class="pf-workspace">
                <div class="pf-desk">

                    <!-- Zone boîtes vue de dessus -->
                    <div class="pf-boxes-area" id="pf-boxes-area"></div>

                    <!-- Séparateur de table -->
                    <div class="pf-desk-divider"></div>

                    <!-- Rack de 6 fioles de préparation -->
                    <div class="pf-flasks-rack">
                        <div class="pf-flasks-label">Fioles de préparation</div>
                        <div class="pf-flasks-zone" id="pf-flasks-zone">
                            ${flasksHTML}
                        </div>
                    </div>

                </div>
            </div>

            <!-- Barre d'achat -->
            <div class="pf-shop-bar">
                <button class="pf-shop-btn" id="pf-buy-box" type="button">
                    📦 Boîte<span class="pf-shop-cost">50 💎</span>
                </button>
                <button class="pf-shop-btn pf-shop-btn--secondary" id="pf-buy-potion" type="button">
                    🧪 Emplacement potion<span class="pf-shop-cost">10 💎</span>
                </button>
            </div>

        </div>`;

        bindEvents();
    }

    function bindEvents() {
        container.querySelector('#pf-btn-team')?.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation(); getStoragePanel().toggle();
        });
        container.querySelector('#pf-buy-box')?.addEventListener('click', () => handleBuyBox());
        container.querySelector('#pf-buy-potion')?.addEventListener('click', () => handleBuyPotion());

        container.addEventListener('click', e => {
            e.stopPropagation();

            // Sélection slime
            const card = e.target.closest('.pf-slime-card');
            if (card) {
                const id = card.dataset.slimeId;
                state.selectedSlimeId = state.selectedSlimeId === id ? null : id;
                updateTeamUI(); return;
            }

            // Sélection / vente boîte
            const boxEl = e.target.closest('.pf-box[data-box-id]');
            if (boxEl) {
                const boxId = parseInt(boxEl.dataset.boxId, 10);
                const box = state.boxes.find(b => b.id === boxId);
                if (!box) return;
                if (box.status === 'ready') { handleBoxShipping(boxId); return; }
                if (box.status === 'idle') { selectedBoxId = selectedBoxId === boxId ? null : boxId; updateBoxesUI(); }
                return;
            }

            // Fioles
            const flaskEl = e.target.closest('.pf-flask');
            if (flaskEl) {
                const flaskId = parseInt(flaskEl.dataset.flaskId, 10);
                handleFlaskInteraction(flaskId); return;
            }
        });

        container.addEventListener('dragstart', e => e.preventDefault());
        container.addEventListener('contextmenu', e => e.preventDefault());
    }

    // ── Achats ────────────────────────────────────────────────────────────────
    function balance() { return Number(store?.getState?.()?.player?.currencies?.hexagon) || 0; }
    function deduct(n) { store.dispatch({ type: 'ADD_CURRENCY', payload: { currency: 'hexagon', amount: -n } }); }
    function toast(msg) { import('../../utils/toast.js').then(m => m.showToast?.(msg, { type: 'warning' })); }

    function handleBuyBox() {
        if (state.boxes.length >= BOX_MAX) { toast(`Table pleine (max ${BOX_MAX} boîtes).`); return; }
        if (balance() < BOX_COST) { toast(`Fonds insuffisants — ${BOX_COST} 💎 requis.`); return; }
        const newId = state.boxes.length > 0 ? Math.max(...state.boxes.map(b => b.id)) + 1 : 0;
        state.boxes.push(makeEmptyBox(newId));
        selectedBoxId = newId;
        deduct(BOX_COST);
        PotionPersistence.saveFactoryState(state);
        updateBoxesUI(); updateShopBar();
    }

    function handleBuyPotion() {
        let box = selectedBoxId != null
            ? state.boxes.find(b => b.id === selectedBoxId && b.status === 'idle')
            : state.boxes.find(b => b.status === 'idle');
        if (!box) { toast('Achetez d\'abord une boîte (ou attendez qu\'elle soit libre).'); return; }
        if (box.potions.length >= POTION_MAX) { toast(`Boîte pleine — max ${POTION_MAX} potions.`); return; }
        if (balance() < POTION_COST) { toast(`Fonds insuffisants — ${POTION_COST} 💎 requis.`); return; }
        box.potions.push({ doses: [] });
        selectedBoxId = box.id;
        deduct(POTION_COST);
        PotionPersistence.saveFactoryState(state);
        updateBoxesUI();
    }

    // ── Fioles ────────────────────────────────────────────────────────────────
    function handleFlaskInteraction(flaskId) {
        const flask = state.flasks.find(f => f.id === flaskId);
        if (!flask) return;

        // CAS 1 : fiole pleine → verse dans une potion vide de la boîte sélectionnée
        if (flask.doses.length >= FLASK_MAX_DOSES) {
            let box = selectedBoxId != null
                ? state.boxes.find(b => b.id === selectedBoxId && b.status === 'idle')
                : state.boxes.find(b => b.status === 'idle');
            if (!box) { toast('Aucune boîte disponible.'); return; }

            const target = box.potions.find(p => p.doses.length < FLASK_MAX_DOSES);
            if (!target) { toast('Toutes les potions de cette boîte sont déjà remplies.'); return; }

            target.doses.push(...flask.doses);
            flask.doses = [];

            // Si toutes les potions sont remplies → démarre l'emballage
            const allFull = box.potions.length === POTION_MAX
                && box.potions.every(p => p.doses.length >= FLASK_MAX_DOSES);
            if (allFull) {
                const avgRarity = PotionEngine.calculateAverageRarity(box.potions);
                box.timerEnd = Date.now() + PotionEngine.calculatePackagingDurationMs(avgRarity);
                box.rewardValue = PotionEngine.calculateRewardValue(avgRarity, box.potions.length);
                box.status = 'packaging';
                startTimer(box.id);
                // Déclenche l'animation d'emballage sur le DOM
                animatePackagingStart(box.id);
            }

            PotionPersistence.saveFactoryState(state);
            updateBoxesUI(); updateFlasksUI();
            return;
        }

        // CAS 2 : ajout de gouttes depuis le slime sélectionné
        const hasIdleBox = state.boxes.some(b => b.status === 'idle');
        if (state.selectedSlimeId && hasIdleBox) {
            const team = getTeamRecords();
            const slime = team.find(s => s.canonicalId === state.selectedSlimeId);
            if (!slime) return;

            const limit = getPotionDropLimit(slime);
            const cap = FLASK_MAX_DOSES - flask.doses.length;
            const add = Math.min(limit, cap);
            if (add <= 0) return;

            const hue = slime.storageDisplay?.hue
                ?? slime.proceduralCore?.genome?.hue
                ?? slime.canonicalSnapshot?.proceduralCore?.genome?.hue ?? 0;
            // Normalise le rarityScore à 0-5
            const rawRarity = slime.storageDisplay?.rarityScore
                ?? slime.proceduralCore?.genome?.stats?.rarityScore
                ?? slime.canonicalSnapshot?.proceduralCore?.genome?.stats?.rarityScore ?? 0;
            const rarity = Math.min(5, Math.max(0, rawRarity));

            for (let i = 0; i < add; i++) flask.doses.push({ hue, rarity });
            PotionPersistence.saveFactoryState(state);
            updateFlasksUI();
        }
    }

    function handleBoxShipping(boxId) {
        const box = state.boxes.find(b => b.id === boxId);
        if (!box || box.status !== 'ready') return;
        store.dispatch({ type: 'ADD_CURRENCY', payload: { currency: 'hexagon', amount: box.rewardValue } });
        state.boxes = state.boxes.filter(b => b.id !== boxId);
        if (selectedBoxId === boxId) selectedBoxId = null;
        PotionPersistence.saveFactoryState(state);
        updateBoxesUI(); updateShopBar();
    }

    // ── Animation emballage ───────────────────────────────────────────────────
    function animatePackagingStart(boxId) {
        const boxEl = container.querySelector(`.pf-box[data-box-id="${boxId}"]`);
        if (!boxEl) return;
        boxEl.classList.add('pf-box--pack-start');
        setTimeout(() => boxEl.classList.remove('pf-box--pack-start'), 800);
    }

    // ── Données ───────────────────────────────────────────────────────────────
    function getTeamRecords() {
        const repo = getStorageRuntimeContext().repository;
        const snap = repo.getSnapshot();
        return (snap.teamSlots || []).map(id => snap.recordsById[id]).filter(Boolean);
    }

    // ── Rendu ─────────────────────────────────────────────────────────────────
    function updateShopBar() {
        const buyBox = container.querySelector('#pf-buy-box');
        const buyPotion = container.querySelector('#pf-buy-potion');
        if (buyBox) buyBox.disabled = state.boxes.length >= BOX_MAX;
        if (buyPotion) {
            const targetBox = selectedBoxId != null
                ? state.boxes.find(b => b.id === selectedBoxId && b.status === 'idle')
                : state.boxes.find(b => b.status === 'idle');
            buyPotion.disabled = !targetBox || targetBox.potions.length >= POTION_MAX;
        }
    }

    function updateTeamUI() {
        const track = container.querySelector('#pf-shelf-track');
        if (!track) return;
        const team = getTeamRecords();
        if (state.selectedSlimeId && !team.find(s => s.canonicalId === state.selectedSlimeId)) state.selectedSlimeId = null;

        if (!team.length) {
            shelfRenderer.unmountAll(); currentTeamIds = [];
            track.innerHTML = `<div class="pf-empty-state">Aucun slime dans l'équipe</div>`; return;
        }

        const newIds = team.map(s => s.canonicalId);
        const changed = newIds.length !== currentTeamIds.length || !newIds.every((id, i) => id === currentTeamIds[i]);

        if (changed) {
            shelfRenderer.unmountAll(); currentTeamIds = newIds;
            track.innerHTML = team.map(s => `
                <div class="pf-slime-card ${s.canonicalId === state.selectedSlimeId ? 'is-selected' : ''}"
                     data-slime-id="${s.canonicalId}">
                    <div class="pf-slime-visual-wrapper" data-slime-canvas="${s.canonicalId}"></div>
                    <div class="pf-slime-nameplate">${s.displayName || s.speciesKey || '?'}</div>
                </div>`).join('');
            team.forEach(s => {
                const w = track.querySelector(`[data-slime-canvas="${s.canonicalId}"]`);
                if (w) shelfRenderer.mount(s.canonicalId, w, s);
            });
        } else {
            track.querySelectorAll('.pf-slime-card').forEach(c =>
                c.classList.toggle('is-selected', c.dataset.slimeId === state.selectedSlimeId));
        }
    }

    function updateFlasksUI() {
        state.flasks.forEach(data => {
            const el = container.querySelector(`.pf-flask[data-flask-id="${data.id}"]`);
            if (!el) return;
            const liquid = el.querySelector('.pf-flask-liquid');
            const doses = data.doses.length;
            el.classList.toggle('is-full', doses >= FLASK_MAX_DOSES);
            el.classList.toggle('is-half', doses > 0 && doses < FLASK_MAX_DOSES);
            if (liquid) {
                liquid.style.height = `${(doses / FLASK_MAX_DOSES) * 100}%`;
                if (doses > 0) {
                    const hue = PotionEngine.mixColorsHSL(data.doses.map(d => d.hue));
                    liquid.style.background = `linear-gradient(180deg, hsl(${hue},85%,65%) 0%, hsl(${hue},85%,45%) 100%)`;
                    if (doses >= FLASK_MAX_DOSES) el.style.setProperty('--flask-hue', hue);
                    else el.style.removeProperty('--flask-hue');
                } else {
                    liquid.style.height = '0%';
                    liquid.style.background = 'transparent';
                    el.style.removeProperty('--flask-hue');
                }
            }
        });
    }

    function updateBoxesUI() {
        const area = container.querySelector('#pf-boxes-area');
        if (!area) return;

        if (!state.boxes.length) {
            area.innerHTML = `
                <div class="pf-no-boxes">
                    <span>📦</span>
                    <p>Achetez une boîte pour commencer à conditionner des potions</p>
                </div>`;
            updateShopBar(); return;
        }

        area.innerHTML = state.boxes.map(box => {
            const isSel = box.id === selectedBoxId;

            // 4 slots : 2×2
            const slots = Array.from({ length: POTION_MAX }, (_, i) => {
                const p = box.potions[i];
                if (!p) return `<div class="pf-potion-slot pf-potion-slot--empty-slot"></div>`;
                if (p.doses.length < FLASK_MAX_DOSES) {
                    // Partiellement remplie
                    const fill = p.doses.length / FLASK_MAX_DOSES;
                    const hue = p.doses.length > 0 ? PotionEngine.mixColorsHSL(p.doses.map(d => d.hue)) : null;
                    return `<div class="pf-potion-slot pf-potion-slot--partial"
                        style="${hue != null ? `--p-hue:${hue};--p-fill:${fill}` : ''}">
                        <div class="pf-potion-fill" style="${hue != null ? `background:hsl(${hue},80%,55%);height:${fill*100}%` : 'height:0'}"></div>
                    </div>`;
                }
                const hue = PotionEngine.mixColorsHSL(p.doses.map(d => d.hue));
                return `<div class="pf-potion-slot pf-potion-slot--full" style="--p-hue:${hue}">
                    <div class="pf-potion-body" style="background:radial-gradient(circle at 38% 32%, hsl(${hue},85%,72%), hsl(${hue},75%,42%))">
                        <div class="pf-potion-shine"></div>
                    </div>
                </div>`;
            }).join('');

            let overlay = '';
            if (box.status === 'packaging') {
                const rem = Math.max(0, box.timerEnd - Date.now());
                overlay = `<div class="pf-box-overlay pf-box-overlay--packaging">
                    <span class="pf-box-timer">${formatTime(rem)}</span>
                    <span class="pf-box-reward">+${box.rewardValue} 💎</span>
                </div>`;
            } else if (box.status === 'ready') {
                overlay = `<div class="pf-box-overlay pf-box-overlay--ready">
                    <span class="pf-sell-label">VENDRE</span>
                    <span class="pf-box-reward">+${box.rewardValue} 💎</span>
                </div>`;
            }

            return `
            <div class="pf-box ${isSel ? 'pf-box--selected' : ''} ${box.status === 'ready' ? 'pf-box--ready' : ''} ${box.status === 'packaging' ? 'pf-box--packaging' : ''}"
                 data-box-id="${box.id}" data-status="${box.status}">
                <div class="pf-box-inner">
                    <div class="pf-box-grid">${slots}</div>
                </div>
                ${overlay}
                ${isSel && box.status === 'idle' ? '<div class="pf-box-selected-badge">active</div>' : ''}
            </div>`;
        }).join('');

        updateShopBar();
    }

    // ── Storage panel ─────────────────────────────────────────────────────────
    function getStoragePanel() {
        if (!storagePanel) {
            const repo = getStorageRuntimeContext().repository;
            storagePanel = createStoragePanelController({
                mountTarget: root, repository: repo, store,
                floatingPanel: true, draggable: true,
                dragHandleClassName: 'storage-panel__header',
                zIndex: 9999,
                onVisibilityChange: v => { if (!v) updateTeamUI(); },
            });
            storagePanel.render();
        }
        return storagePanel;
    }

    // ── Interface publique ────────────────────────────────────────────────────
    return {
        mount(mountPoint) {
            if (container) { container.style.display = ''; updateTeamUI(); return; }
            root = mountPoint;
            container = document.createElement('div');
            container.className = 'potion-factory-root-container';
            root.appendChild(container);
            buildStaticDOM();
            updateTeamUI(); updateFlasksUI(); updateBoxesUI();
            state.boxes.forEach(b => { if (b.status === 'packaging') startTimer(b.id); });
            const repo = getStorageRuntimeContext().repository;
            if (repo?.subscribe) unsubRepo = repo.subscribe(() => updateTeamUI());
            if (store?.subscribe) unsubStore = store.subscribe(() => { updateTeamUI(); updateShopBar(); });
        },
        resume() {
            if (!container) return;
            container.style.display = '';
            updateTeamUI(); updateBoxesUI();
            state.boxes.forEach(b => { if (b.status === 'packaging' && !timerIntervals.has(b.id)) startTimer(b.id); });
        },
        suspend() {
            if (storagePanel?.isOpen) storagePanel.close();
            if (container) container.style.display = 'none';
        },
        unmount() {
            timerIntervals.forEach(iv => clearInterval(iv)); timerIntervals.clear();
            unsubRepo?.(); unsubStore?.();
            shelfRenderer.unmountAll();
            storagePanel?.destroy(); storagePanel = null;
            container?.remove(); container = null; root = null;
        },
    };
}
