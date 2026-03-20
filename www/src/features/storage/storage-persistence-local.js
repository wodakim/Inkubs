import { deepClone } from '../../vendor/inku-slime-v3/shared/object.js';

export function createStoragePersistenceLocal({ storageKey = 'inku.storage.v1', storageRef = null } = {}) {
    let memorySnapshot = null;

    function getStorage() {
        if (storageRef) {
            return storageRef;
        }

        if (typeof globalThis === 'undefined' || !globalThis.localStorage) {
            return null;
        }

        return globalThis.localStorage;
    }

    function load() {
        const storage = getStorage();
        if (!storage) {
            return deepClone(memorySnapshot);
        }

        try {
            const raw = storage.getItem(storageKey);
            if (!raw) {
                return null;
            }
            return JSON.parse(raw);
        } catch (error) {
            console.warn('[INKU][storage] Failed to read local persistence snapshot.', error);
            return deepClone(memorySnapshot);
        }
    }

    function save(snapshot) {
        const cloned = deepClone(snapshot);
        memorySnapshot = cloned;

        const storage = getStorage();
        if (!storage) {
            return cloned;
        }

        try {
            storage.setItem(storageKey, JSON.stringify(cloned));
        } catch (error) {
            console.warn('[INKU][storage] Failed to persist local snapshot.', error);
        }

        return cloned;
    }

    return {
        storageKey,
        load,
        save,
    };
}
