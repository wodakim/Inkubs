// src/features/potion-factory/potion-factory-controller.js
import { getStorageRuntimeContext } from '../storage/storage-runtime-context.js';
import { getPotionDropLimit } from './potion-persistence.js';

export function createPotionFactoryController({ store }) {
    let root = null;
    let container = null;

    function render() {
        if (!container) return;

        // Fetch team slimes to display
        const repository = getStorageRuntimeContext().repository;
        const teamIds = store.getState().storage?.teamSlots || [];
        const teamSlimes = teamIds
            .map(id => repository.findById(id))
            .filter(Boolean);

        container.innerHTML = `
            <div class="potion-factory">
                <div class="potion-factory__background"></div>
                
                <div class="potion-factory__team-ui">
                    ${teamSlimes.map(slime => `
                        <div class="potion-factory__slime-card">
                            <div class="potion-factory__slime-avatar">
                                <i class="ph-fill ph-sketch-logo"></i>
                            </div>
                            <div class="potion-factory__slime-info">
                                <span class="potion-factory__slime-name">${slime.displayName}</span>
                                <span class="potion-factory__slime-drops">Limite : ${getPotionDropLimit(slime)} dps</span>
                            </div>
                        </div>
                    `).join('')}
                    ${teamSlimes.length === 0 ? '<p class="potion-factory__empty-msg">Aucun slime dans l\'équipe</p>' : ''}
                </div>

                <div class="potion-factory__workspace">
                    <div class="potion-factory__table">
                        <!-- 4 Cardboard box slots in the background -->
                        <div class="potion-factory__boxes">
                            <div class="potion-factory__slot potion-factory__slot--box" data-slot="0"></div>
                            <div class="potion-factory__slot potion-factory__slot--box" data-slot="1"></div>
                            <div class="potion-factory__slot potion-factory__slot--box" data-slot="2"></div>
                            <div class="potion-factory__slot potion-factory__slot--box" data-slot="3"></div>
                        </div>

                        <!-- 4 Flask slots in the foreground -->
                        <div class="potion-factory__flasks">
                            <div class="potion-factory__slot potion-factory__slot--flask" data-slot="0"></div>
                            <div class="potion-factory__slot potion-factory__slot--flask" data-slot="1"></div>
                            <div class="potion-factory__slot potion-factory__slot--flask" data-slot="2"></div>
                            <div class="potion-factory__slot potion-factory__slot--flask" data-slot="3"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    return {
        mount(mountPoint) {
            root = mountPoint;
            container = document.createElement('div');
            container.className = 'potion-factory-shell';
            root.appendChild(container);
            render();
        },
        suspend() {
            if (container) container.style.display = 'none';
        },
        unmount() {
            if (container) {
                container.remove();
                container = null;
            }
        }
    };
}
