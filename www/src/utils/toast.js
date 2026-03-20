/**
 * INKÜ — Minimal toast notification service
 * Phase 3: storage-full feedback. Extended in Phase 5 with full Pokémon-style system.
 */

let toastLayer = null;

function getLayer() {
    if (toastLayer && document.body.contains(toastLayer)) {
        return toastLayer;
    }
    toastLayer = document.createElement('div');
    toastLayer.className = 'inku-toast-layer';
    toastLayer.setAttribute('aria-live', 'polite');
    toastLayer.setAttribute('aria-atomic', 'false');
    document.body.appendChild(toastLayer);
    return toastLayer;
}

/**
 * @param {string} message
 * @param {{ type?: 'info'|'success'|'warning'|'error', duration?: number }} options
 */
export function showToast(message, { type = 'info', duration = 3500 } = {}) {
    const layer = getLayer();

    const toast = document.createElement('div');
    toast.className = `inku-toast inku-toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    layer.appendChild(toast);

    // Force reflow so the enter transition plays
    void toast.offsetWidth;
    toast.classList.add('inku-toast--visible');

    const leaveTimer = setTimeout(() => {
        toast.classList.remove('inku-toast--visible');
        toast.classList.add('inku-toast--leaving');
        const onEnd = () => toast.remove();
        toast.addEventListener('transitionend', onEnd, { once: true });
        // Safety fallback
        setTimeout(onEnd, 500);
    }, duration);

    // Allow manual dismiss on click
    toast.addEventListener('click', () => {
        clearTimeout(leaveTimer);
        toast.classList.remove('inku-toast--visible');
        toast.classList.add('inku-toast--leaving');
        setTimeout(() => toast.remove(), 300);
    }, { once: true });
}
