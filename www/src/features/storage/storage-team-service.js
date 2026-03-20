import { STORAGE_TEAM_SLOT_COUNT } from './storage-pagination-service.js';

export function createStorageTeamService({ slotCount = STORAGE_TEAM_SLOT_COUNT } = {}) {
    const safeSlotCount = Math.max(1, Math.floor(slotCount));

    function createEmptyTeamSlots() {
        return Array.from({ length: safeSlotCount }, () => null);
    }

    function normalizeTeamSlots(teamSlots = []) {
        const normalized = createEmptyTeamSlots();
        for (let index = 0; index < safeSlotCount; index += 1) {
            normalized[index] = typeof teamSlots[index] === 'string' && teamSlots[index].trim() ? teamSlots[index] : null;
        }
        return normalized;
    }

    function findFirstEmptySlot(teamSlots = []) {
        const normalized = normalizeTeamSlots(teamSlots);
        return normalized.findIndex((value) => !value);
    }

    function isAssigned(teamSlots = [], canonicalId) {
        if (!canonicalId) {
            return false;
        }
        return normalizeTeamSlots(teamSlots).includes(canonicalId);
    }

    function assign(teamSlots = [], canonicalId, preferredIndex = null) {
        if (!canonicalId) {
            throw new Error('canonicalId is required to assign a storage team slot.');
        }

        const normalized = normalizeTeamSlots(teamSlots);
        const currentIndex = normalized.findIndex((value) => value === canonicalId);
        if (currentIndex >= 0) {
            return {
                teamSlots: normalized,
                slotIndex: currentIndex,
                didChange: false,
            };
        }

        const preferred = Number.isInteger(preferredIndex) ? preferredIndex : null;
        const targetIndex = preferred !== null && preferred >= 0 && preferred < safeSlotCount && !normalized[preferred]
            ? preferred
            : findFirstEmptySlot(normalized);

        if (targetIndex < 0) {
            return {
                teamSlots: normalized,
                slotIndex: -1,
                didChange: false,
            };
        }

        normalized[targetIndex] = canonicalId;
        return {
            teamSlots: normalized,
            slotIndex: targetIndex,
            didChange: true,
        };
    }

    function remove(teamSlots = [], canonicalId) {
        const normalized = normalizeTeamSlots(teamSlots);
        const index = normalized.findIndex((value) => value === canonicalId);
        if (index < 0) {
            return {
                teamSlots: normalized,
                slotIndex: -1,
                didChange: false,
            };
        }

        normalized[index] = null;
        return {
            teamSlots: normalized,
            slotIndex: index,
            didChange: true,
        };
    }

    return {
        slotCount: safeSlotCount,
        createEmptyTeamSlots,
        normalizeTeamSlots,
        findFirstEmptySlot,
        isAssigned,
        assign,
        remove,
    };
}
