// src/utils/dev-console.js
// Console de développement — activée si localStorage 'inku.dev' === '1'
// Usage : dans la console navigateur, tapez `localStorage.setItem('inku.dev','1')` puis rechargez.

const IS_DEV = () => localStorage.getItem('inku.dev') === '1';

let root = null;
let isOpen = false;

function formatCurrency(n) {
    return Number(n).toLocaleString('fr-FR');
}

function buildUI(store) {
    const panel = document.createElement('div');
    panel.id = 'inku-dev-console';
    panel.setAttribute('aria-label', 'Console développeur');

    panel.innerHTML = `
        <style>
            #inku-dev-console {
                position: fixed;
                bottom: 64px;
                right: 8px;
                z-index: 999999;
                font-family: 'Courier New', monospace;
                font-size: 12px;
            }
            #inku-dev-toggle {
                position: fixed;
                bottom: 8px;
                right: 8px;
                z-index: 999999;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: rgba(20,10,40,0.92);
                border: 1.5px solid rgba(160,100,255,0.6);
                color: rgba(160,100,255,0.9);
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 12px rgba(100,50,200,0.4);
                transition: transform 0.15s;
                user-select: none;
            }
            #inku-dev-toggle:active { transform: scale(0.9); }
            #inku-dev-panel {
                display: none;
                flex-direction: column;
                gap: 4px;
                background: rgba(10,5,20,0.97);
                border: 1px solid rgba(140,80,255,0.5);
                border-radius: 10px;
                padding: 10px;
                min-width: 200px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.7);
                color: #d0b8ff;
            }
            #inku-dev-panel.is-open { display: flex; }
            .dev-title {
                font-weight: bold;
                color: #b48eff;
                margin-bottom: 2px;
                font-size: 11px;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                border-bottom: 1px solid rgba(140,80,255,0.2);
                padding-bottom: 4px;
            }
            .dev-balance {
                font-size: 11px;
                color: #9980cc;
                margin-bottom: 4px;
            }
            .dev-btn {
                background: rgba(80,40,160,0.35);
                border: 1px solid rgba(140,80,255,0.35);
                color: #c8aaff;
                border-radius: 6px;
                padding: 5px 8px;
                font-size: 11px;
                cursor: pointer;
                text-align: left;
                transition: background 0.1s;
                width: 100%;
            }
            .dev-btn:hover { background: rgba(100,60,200,0.5); }
            .dev-btn:active { transform: scale(0.97); }
            .dev-btn--danger { border-color: rgba(255,80,80,0.4); color: #ffaaaa; }
            .dev-btn--danger:hover { background: rgba(160,30,30,0.5); }
            .dev-separator {
                height: 1px;
                background: rgba(140,80,255,0.15);
                margin: 2px 0;
            }
            .dev-log {
                font-size: 10px;
                color: #7060a0;
                max-height: 120px;
                overflow-y: auto;
                white-space: pre-wrap;
                word-break: break-all;
                background: rgba(0,0,0,0.3);
                border-radius: 4px;
                padding: 4px 6px;
                margin-top: 2px;
            }
        </style>
        <button id="inku-dev-toggle" title="Console dev">⚙</button>
        <div id="inku-dev-panel">
            <div class="dev-title">🛠 DEV CONSOLE</div>
            <div class="dev-balance" id="dev-balance">💎 —</div>
            <button class="dev-btn" data-dev-action="add-500">+ 500 💎</button>
            <button class="dev-btn" data-dev-action="add-5000">+ 5 000 💎</button>
            <div class="dev-separator"></div>
            <button class="dev-btn" data-dev-action="box-ready">⏩ Box → prête</button>
            <button class="dev-btn" data-dev-action="show-state">📋 Afficher state</button>
            <div class="dev-separator"></div>
            <button class="dev-btn dev-btn--danger" data-dev-action="reset-factory">🗑 Reset factory</button>
            <button class="dev-btn dev-btn--danger" data-dev-action="reset-storage">🗑 Reset storage</button>
            <button class="dev-btn dev-btn--danger" data-dev-action="reset-all">💥 Reset tout</button>
            <div class="dev-log" id="dev-log" hidden></div>
        </div>
    `;

    document.body.appendChild(panel);

    const toggleBtn = document.getElementById('inku-dev-toggle');
    const devPanel  = document.getElementById('inku-dev-panel');
    const balanceEl = document.getElementById('dev-balance');
    const logEl     = document.getElementById('dev-log');

    function refresh() {
        const bal = store.getState()?.player?.currencies?.hexagon ?? 0;
        balanceEl.textContent = `💎 ${formatCurrency(bal)}`;
    }

    function log(msg) {
        logEl.hidden = false;
        logEl.textContent = msg;
    }

    toggleBtn.addEventListener('click', () => {
        isOpen = !isOpen;
        devPanel.classList.toggle('is-open', isOpen);
        if (isOpen) refresh();
    });

    panel.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-dev-action]');
        if (!btn) return;
        const action = btn.dataset.devAction;

        switch (action) {
            case 'add-500':
                store.dispatch({ type: 'ADD_CURRENCY', payload: { currency: 'hexagon', amount: 500 } });
                refresh();
                log('+500 💎 ajoutés');
                break;
            case 'add-5000':
                store.dispatch({ type: 'ADD_CURRENCY', payload: { currency: 'hexagon', amount: 5000 } });
                refresh();
                log('+5 000 💎 ajoutés');
                break;
            case 'box-ready': {
                try {
                    const raw = localStorage.getItem('inku.factory.v1');
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        // Support both old (box) and new (boxes[]) format
                        if (Array.isArray(parsed.boxes)) {
                            parsed.boxes.forEach(b => {
                                if (b.status === 'packaging') b.status = 'ready';
                            });
                        } else if (parsed.box) {
                            parsed.box.status = 'ready';
                        }
                        localStorage.setItem('inku.factory.v1', JSON.stringify(parsed));
                        log('Boîte(s) forcée(s) prête(s) — rechargez la section usine');
                    } else {
                        log('Aucune donnée factory en localStorage');
                    }
                } catch (err) {
                    log(`Erreur: ${err.message}`);
                }
                break;
            }
            case 'show-state':
                log(JSON.stringify(store.getState(), null, 2).slice(0, 800));
                break;
            case 'reset-factory':
                localStorage.removeItem('inku.factory.v1');
                log('Factory reset. Rechargez la section usine.');
                break;
            case 'reset-storage':
                localStorage.removeItem('inku.storage.v1');
                log('Storage reset. Rechargez la page.');
                break;
            case 'reset-all':
                localStorage.clear();
                log('Reset total — rechargement...');
                setTimeout(() => location.reload(), 600);
                break;
        }
    });

    // Actualise le solde affiché à chaque changement de store
    store.subscribe(() => {
        if (isOpen) refresh();
    });

    root = panel;
}

export function mountDevConsole(store) {
    if (!IS_DEV()) return;
    if (root) return; // Already mounted
    // Wait for body to be ready
    if (document.body) {
        buildUI(store);
    } else {
        window.addEventListener('DOMContentLoaded', () => buildUI(store), { once: true });
    }
}
