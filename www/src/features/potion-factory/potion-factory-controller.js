// src/features/potion-factory/potion-factory-controller.js
import { getStorageRuntimeContext } from '../storage/storage-runtime-context.js';
import { getPotionDropLimit } from './potion-persistence.js';
import { createStoragePanelController } from '../storage/storage-panel-controller.js';
import { buildCanonicalPortraitSvg } from '../storage/storage-canonical-visual-renderer.js';

export function createPotionFactoryController({ store }) {
    let root = null;
    let container = null;
    let storagePanel = null;
    let unsubscribeStore = null;
    let unsubscribeRepo = null;
    let timerInterval = null;

    const state = {
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
    };

    function mixHues(hues) {
        if (!hues || hues.length === 0) return 0;
        if (hues.length === 1) return hues[0];
        let x = 0; let y = 0;
        for (let hue of hues) {
            const rad = hue * (Math.PI / 180);
            x += Math.cos(rad);
            y += Math.sin(rad);
        }
        let avgHue = Math.atan2(y, x) * (180 / Math.PI);
        return avgHue < 0 ? Math.round(avgHue + 360) : Math.round(avgHue);
    }

    function calculateBoxTimerAndReward() {
        let totalRarity = 0;
        let totalDoses = 0;

        state.box.potions.forEach(potion => {
            potion.doses.forEach(dose => {
                totalRarity += (dose.rarity || 1);
                totalDoses++;
            });
        });

        const avgRarity = totalDoses > 0 ? (totalRarity / totalDoses) : 1;

        const minTimeSec = 120;
        const maxTimeSec = 600;
        const durationSec = minTimeSec + ((Math.min(avgRarity, 5) - 1) / 4) * (maxTimeSec - minTimeSec);

        state.box.timerEnd = Date.now() + Math.floor(durationSec * 1000);
        state.box.rewardValue = Math.floor(avgRarity * 25 * state.box.potions.length);
        state.box.status = 'packaging';

        startTimerLoop();
    }

    function startTimerLoop() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (state.box.status === 'packaging') {
                if (Date.now() >= state.box.timerEnd) {
                    state.box.status = 'ready';
                    clearInterval(timerInterval);
                }
                updateBoxUI();
            } else {
                clearInterval(timerInterval);
            }
        }, 1000);
    }

    function formatTime(ms) {
        if (ms <= 0) return '00:00';
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

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

    function handleFlaskInteraction(flaskId) {
        const flask = state.flasks.find(f => f.id === flaskId);
        if (!flask) return;

        if (flask.doses.length >= 2) {
            if (state.box.status === 'idle' && state.box.potions.length < 4) {
                state.box.potions.push({ doses: [...flask.doses] });
                flask.doses = [];
                if (state.box.potions.length === 4) {
                    calculateBoxTimerAndReward();
                }
                updateBoxUI();
            }
        }
        else if (state.selectedSlimeId && state.box.status === 'idle') {
            const team = getTeamRecords();
            const activeSlime = team.find(s => s.id === state.selectedSlimeId);
            if (activeSlime) {
                const hue = activeSlime.proceduralCore?.genome?.hue || 0;
                const rarity = activeSlime.storageDisplay?.rarityScore || activeSlime.rarity || 1;
                flask.doses.push({ hue, rarity });
            }
        }
        updateFlasksUI();
    }

    function handleBoxShipping() {
        store.dispatch({
            type: 'ADD_CURRENCY',
            payload: { currency: 'hexagon', amount: state.box.rewardValue }
        });

        state.box.potions = [];
        state.box.status = 'idle';
        state.box.timerEnd = null;
        state.box.rewardValue = 0;

        updateBoxUI();
        updateFlasksUI();
    }

    function getTeamRecords() {
        const repository = getStorageRuntimeContext().repository;
        const snapshot = repository.getSnapshot();
        const teamIds = snapshot.teamSlots || [];
        return teamIds.map(id => snapshot.recordsById[id]).filter(Boolean);
    }

    function updateTeamUI() {
        const track = container.querySelector('#pf-shelf-track');
        if (!track) return;

        const teamSlimes = getTeamRecords();

        if (state.selectedSlimeId && !teamSlimes.find(s => s.id === state.selectedSlimeId)) {
            state.selectedSlimeId = null;
        }

        if (teamSlimes.length === 0) {
            track.innerHTML = `<div class="pf-empty-state">Aucun slime dans l'équipe active.</div>`;
            return;
        }

        track.innerHTML = teamSlimes.map(slime => {
            const isSelected = slime.id === state.selectedSlimeId;
            return `
                <div class="pf-slime-card ${isSelected ? 'is-selected' : ''}" data-slime-id="${slime.id}">
                    <div class="pf-slime-visual-wrapper">
                        ${buildCanonicalPortraitSvg(slime, { size: 80, variant: 'slot', includePlate: true })}
                    </div>
                    <div class="pf-slime-nameplate">${slime.displayName || slime.speciesKey}</div>
                </div>
            `;
        }).join('');
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
                    const hue = mixHues(data.doses.map(d => d.hue));
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

        const slots = box.querySelectorAll('.pf-box-slot');
        slots.forEach((slot, i) => {
            const potion = state.box.potions[i];
            if (potion) {
                const hue = mixHues(potion.doses.map(d => d.hue));
                slot.innerHTML = `<div class="pf-packed-item" style="background-color: hsl(${hue}, 85%, 55%);"></div>`;
            } else {
                slot.innerHTML = '';
            }
        });

        const timerTxt = box.querySelector('#pf-timer-txt');
        if (timerTxt && state.box.status === 'packaging') {
            timerTxt.textContent = formatTime(Math.max(0, state.box.timerEnd - Date.now()));
        }
    }

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

    return {
        mount(mountPoint) {
            root = mountPoint;
            container = document.createElement('div');
            container.className = 'potion-factory-root-container';
            root.appendChild(container);

            buildStaticDOM();
            updateTeamUI();
            updateFlasksUI();
            updateBoxUI();

            if (state.box.status === 'packaging') startTimerLoop();

            const repo = getStorageRuntimeContext().repository;
            if (repo && typeof repo.subscribe === 'function') {
                unsubscribeRepo = repo.subscribe(() => updateTeamUI());
            }
            if (store && typeof store.subscribe === 'function') {
                unsubscribeStore = store.subscribe(() => updateTeamUI());
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