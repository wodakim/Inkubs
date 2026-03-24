export function createListenerRegistry() {
    const disposers = [];

    return {
        listen(target, type, handler, options) {
            if (!target) {
                return () => {};
            }

            target.addEventListener(type, handler, options);
            const dispose = () => target.removeEventListener(type, handler, options);
            disposers.push(dispose);
            return dispose;
        },
        disposeAll() {
            while (disposers.length) {
                const dispose = disposers.pop();
                dispose?.();
            }
        },
    };
}
