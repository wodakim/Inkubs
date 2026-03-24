export function createStorageComputerController({ panelController }) {
    if (!panelController) {
        throw new Error('A storage panel controller is required.');
    }

    let triggerButton = null;
    let cleanup = null;

    function connectToIncubatorView(view) {
        disconnect();
        triggerButton = view?.refs?.storageTrigger || null;
        if (!triggerButton) {
            return;
        }

        const onClick = () => panelController.toggle();
        triggerButton.addEventListener('click', onClick);
        cleanup = () => {
            triggerButton?.removeEventListener('click', onClick);
            triggerButton = null;
            cleanup = null;
        };
    }

    function disconnect() {
        cleanup?.();
    }

    return {
        connectToIncubatorView,
        disconnect,
    };
}
