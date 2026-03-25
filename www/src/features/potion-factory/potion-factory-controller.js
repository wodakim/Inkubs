// src/features/potion-factory/potion-factory-controller.js
import { getStorageRuntimeContext } from '../storage/storage-runtime-context.js';
import { createStoragePanelController } from '../storage/storage-panel-controller.js';
import { buildCanonicalPortraitSvg } from '../storage/storage-canonical-visual-renderer.js';

export function createPotionFactoryController({ store }) {
    let root = null;
    let container = null;
    let storagePanel = null;
    let unsubscribeStore = null;
    let unsubscribeRepo = null;
    let timerInterval = null;

    let state = {
        selectedSlimeId: null,
        flasks: Array(4).fill(null).map(() => ({ doses: [] })),
        box: {
            potions: [],
            state: 'idle', // 'idle', 'packaging', 'ready'
            timerEnd: null,
            rewardValue: 0
        }
    };

    function mixHues(hues) {
        if (hues.length === 0) return 0;
        if (hues.length === 1) return hues[0];
        let x = 0;
        let y = 0;
        for (let hue of hues) {
            let rad = hue * Math.PI / 180;
            x += Math.cos(rad);
            y += Math.sin(rad);
        }
        let avgHue = Math.atan2(y, x) * 180 / Math.PI;
        if (avgHue < 0) avgHue += 360;
        return avgHue;
    }

    function calculateBoxTimerAndReward() {
        let totalRarity = 0;
        let totalDoses = 0;

        state.box.potions.forEach(potion => {
            potion.doses.forEach(dose => {
                totalRarity += dose.rarity || 1;
                totalDoses++;
            });
        });

        const avgRarity = totalDoses > 0 ? (totalRarity / totalDoses) : 1;

        // Timer: 2 minutes to 10 minutes based on rarity (1 to 5)
        const minTime = 120; // 2 mins in seconds
        const maxTime = 600; // 10 mins in seconds
        const durationSec = minTime + ((Math.min(avgRarity, 5) - 1) / 4) * (maxTime - minTime);

        state.box.timerEnd = Date.now() + Math.floor(durationSec * 1000);
        state.box.rewardValue = Math.floor(avgRarity * 10 * state.box.potions.length);
        state.box.state = 'packaging';

        startTimerLoop();
    }

    function startTimerLoop() {
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            if (state.box.state === 'packaging') {
                const now = Date.now();
                if (now >= state.box.timerEnd) {
                    state.box.state = 'ready';
                    clearInterval(timerInterval);
                }
                updateWorkspaceUI();
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

    function render() {
        if (!container) return;

        const repository = getStorageRuntimeContext().repository;
        const teamIds = store.getState().storage?.teamSlots || [];
        const teamSlimes = teamIds
            .map(id => repository.findById(id))
            .filter(Boolean);

        const hasSlimes = teamSlimes.length > 0;

        if (state.selectedSlimeId && !teamSlimes.find(s => s.id === state.selectedSlimeId)) {
            state.selectedSlimeId = null;
        }

        container.innerHTML = `
            <div class="potion-factory">
                <div class="potion-factory__background">
                    <div class="potion-factory__light-beam"></div>
                    <div class="potion-factory__light-beam"></div>
                </div>
                
                <header class="potion-factory__header">
                    <div class="potion-factory__header-title">
                        <i class="ph-fill ph-flask"></i>
                        <h1>Atelier de Potions</h1>
                    </div>
                    <button class="potion-factory__edit-team-btn" title="Modifier l'équipe">
                        <i class="ph-bold ph-users-three"></i>
                        <span>Équipe</span>
                    </button>
                </header>

                <div class="potion-factory__team-display">
                    ${hasSlimes ? teamSlimes.map(slime => `
                        <div class="potion-factory__slime-podium" data-slime-id="${slime.id}">
                            <div class="potion-factory__slime-visual">
                                ${buildCanonicalPortraitSvg(slime, { size: 80, variant: 'slot', includePlate: true })}
                            </div>
                            <div class="potion-factory__slime-pedestal"></div>
                            <div class="potion-factory__slime-badge">
                                <span class="potion-factory__badge-name">${slime.displayName}</span>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="potion-factory__empty-state">
                            <i class="ph-fill ph-sparkle potion-factory__empty-icon"></i>
                            <p>Place des slimes dans ton équipe pour commencer à infuser !</p>
                        </div>
                    `}
                </div>

                <div class="potion-factory__workspace">
                    <div class="potion-factory__table">
                        <div class="potion-factory__box-area">
                            <div class="potion-factory__shipping-box" id="shipping-box">
                                <div class="potion-factory__box-flap flap-top"></div>
                                <div class="potion-factory__box-flap flap-bottom"></div>
                                <div class="potion-factory__box-flap flap-left"></div>
                                <div class="potion-factory__box-flap flap-right"></div>
                                
                                <div class="potion-factory__box-grid">
                                    <div class="potion-factory__box-slot" data-slot="0"></div>
                                    <div class="potion-factory__box-slot" data-slot="1"></div>
                                    <div class="potion-factory__box-slot" data-slot="2"></div>
                                    <div class="potion-factory__box-slot" data-slot="3"></div>
                                </div>

                                <div class="potion-factory__box-overlay">
                                    <div class="potion-factory__timer-display"></div>
                                    <div class="potion-factory__ready-text">
                                        <i class="ph-bold ph-check-circle"></i> PRÊT
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="potion-factory__flasks">
                            ${state.flasks.map((_, i) => `
                                <div class="potion-factory__slot potion-factory__slot--flask" data-flask-index="${i}">
                                    <div class="potion-factory__flask-bg"></div>
                                    <div class="potion-factory__flask-neck"></div>
                                    <div class="potion-factory__flask-body">
                                        <div class="potion-factory__flask-liquid"></div>
                                        <div class="potion-factory__flask-reflection"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        bindEvents(teamSlimes);
        updateWorkspaceUI();
    }

    function updateWorkspaceUI() {
        if (!container) return;

        const podiums = container.querySelectorAll('.potion-factory__slime-podium');
        podiums.forEach(podium => {
            const id = podium.dataset.slimeId;
            podium.classList.toggle('is-selected', id === state.selectedSlimeId);
        });

        const flasks = container.querySelectorAll('.potion-factory__slot--flask');
        flasks.forEach((flaskEl, i) => {
            const flaskState = state.flasks[i];
            const doseCount = flaskState.doses.length;
            const isFull = doseCount >= 2;

            flaskEl.classList.toggle('is-full', isFull);
            flaskEl.classList.toggle('flask--empty', doseCount === 0);
            flaskEl.classList.toggle('flask--half-full', doseCount === 1);
            flaskEl.classList.toggle('flask--full', doseCount === 2);

            const liquid = flaskEl.querySelector('.potion-factory__flask-liquid');
            if (liquid) {
                const fillLevel = (doseCount / 2) * 100;
                const mixedHue = doseCount > 0 ? mixHues(flaskState.doses.map(d => d.hue)) : 0;
                liquid.style.height = `${fillLevel}%`;
                if (doseCount > 0) {
                    liquid.style.setProperty('--liquid-hue', mixedHue);
                }
            }
        });

        const boxEl = container.querySelector('#shipping-box');
        if (boxEl) {
            boxEl.className = 'potion-factory__shipping-box'; // reset
            if (state.box.state === 'packaging') boxEl.classList.add('is-packaging');
            if (state.box.state === 'ready') boxEl.classList.add('is-ready');

            const timerDisplay = boxEl.querySelector('.potion-factory__timer-display');
            if (timerDisplay) {
                if (state.box.state === 'packaging') {
                    const remaining = Math.max(0, state.box.timerEnd - Date.now());
                    timerDisplay.textContent = formatTime(remaining);
                } else {
                    timerDisplay.textContent = '';
                }
            }

            const slots = boxEl.querySelectorAll('.potion-factory__box-slot');
            slots.forEach((slot, i) => {
                const potion = state.box.potions[i];
                if (potion) {
                    const mixedHue = mixHues(potion.doses.map(d => d.hue));
                    if (!slot.querySelector('.potion-factory__packed-potion')) {
                        slot.innerHTML = `<div class="potion-factory__packed-potion" style="--potion-hue: ${mixedHue};"></div>`;
                    } else {
                        slot.querySelector('.potion-factory__packed-potion').style.setProperty('--potion-hue', mixedHue);
                    }
                } else {
                    slot.innerHTML = '';
                }
            });
        }
    }

    function bindEvents(teamSlimes) {
        const editBtn = container.querySelector('.potion-factory__edit-team-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => ensureStoragePanel().toggle());
        }

        const podiums = container.querySelectorAll('.potion-factory__slime-podium');
        podiums.forEach(podium => {
            podium.addEventListener('click', () => {
                const id = podium.dataset.slimeId;
                state.selectedSlimeId = state.selectedSlimeId === id ? null : id;
                updateWorkspaceUI();
            });
        });

        const flasks = container.querySelectorAll('.potion-factory__slot--flask');
        flasks.forEach(flaskEl => {
            flaskEl.addEventListener('click', () => {
                const index = parseInt(flaskEl.dataset.flaskIndex, 10);
                const flask = state.flasks[index];

                if (flask.doses.length >= 2) {
                    // Full flask -> Move to box
                    if (state.box.state === 'idle' && state.box.potions.length < 4) {
                        state.box.potions.push({ doses: [...flask.doses] });
                        flask.doses = [];
                        
                        if (state.box.potions.length === 4) {
                            calculateBoxTimerAndReward();
                        }
                    }
                } else if (state.selectedSlimeId) {
                    // Empty or half full -> Add dose
                    const activeSlime = teamSlimes.find(s => s.id === state.selectedSlimeId);
                    if (activeSlime && state.box.state === 'idle') {
                        const hue = activeSlime.proceduralCore?.genome?.hue || 0;
                        const rarity = activeSlime.rarity || 1;
                        flask.doses.push({ hue, rarity });
                    }
                }
                updateWorkspaceUI();
            });
        });

        const boxEl = container.querySelector('#shipping-box');
        if (boxEl) {
            boxEl.addEventListener('click', () => {
                if (state.box.state === 'ready') {
                    store.dispatch({ 
                        type: 'ADD_CURRENCY', 
                        payload: { currency: 'hexagon', amount: state.box.rewardValue } 
                    });
                    
                    state.box.potions = [];
                    state.box.state = 'idle';
                    state.box.timerEnd = null;
                    state.box.rewardValue = 0;
                    updateWorkspaceUI();
                }
            });
        }
    }

    function ensureStoragePanel() {
        if (!storagePanel) {
            storagePanel = createStoragePanelController({
                mountTarget: container,
                repository: getStorageRuntimeContext().repository,
                store,
                floatingPanel: true,
                onVisibilityChange: (isVisible) => {
                    if (!isVisible) render(); 
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
            container.className = 'potion-factory-shell';
            root.appendChild(container);

            unsubscribeStore = store.subscribe((appState, prevState) => {
                if (appState.storage?.teamSlots !== prevState.storage?.teamSlots) {
                    render();
                }
            });

            const repository = getStorageRuntimeContext().repository;
            unsubscribeRepo = repository.subscribe(() => render());

            if (state.box.state === 'packaging') {
                startTimerLoop();
            }

            render();
        },
        suspend() {
            if (storagePanel) storagePanel.close();
            if (container) container.style.display = 'none';
        },
        unmount() {
            if (timerInterval) clearInterval(timerInterval);
            if (unsubscribeStore) unsubscribeStore();
            if (unsubscribeRepo) unsubscribeRepo();
            if (storagePanel) {
                storagePanel.destroy();
                storagePanel = null;
            }
            if (container) {
                container.remove();
                container = null;
            }
        }
    };
}
