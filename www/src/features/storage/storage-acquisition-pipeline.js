import { createCanonicalStorageRecord } from './canonical-slime-record.js';

export function createStorageAcquisitionPipeline({ repository, teamService }) {
    if (!repository) {
        throw new Error('A storage persistence repository is required for the acquisition pipeline.');
    }
    if (!teamService) {
        throw new Error('A storage team service is required for the acquisition pipeline.');
    }

    let inFlight = false;

    async function acquireCurrentCandidate({ candidate, preview }) {
        if (inFlight) {
            throw new Error('A storage acquisition is already in progress.');
        }
        if (!preview || typeof preview.exportCanonicalClaimPayload !== 'function') {
            throw new Error('The incubator preview does not expose canonical acquisition data.');
        }

        preview.ensureRuntimeAvailable?.();

        inFlight = true;
        try {
            const claimPayload = preview.exportCanonicalClaimPayload({
                source: 'incubator_storage_acquisition',
                captureContext: {
                    surface: 'labo_incubator',
                    acquisitionMode: 'manual_player_acquire',
                    candidateDisplayName: candidate?.displayName || null,
                },
            });

            if (!claimPayload?.runtimeId) {
                throw new Error('The current incubator slime runtime is unavailable for canonical acquisition. The preview runtime must exist before purchase.');
            }

            const existing = repository.getSnapshot().acquisitionLedger[claimPayload.runtimeId];
            if (existing) {
                return {
                    canonicalId: existing,
                    record: repository.getSnapshot().recordsById[existing] || null,
                    placement: resolvePlacement(repository.getSnapshot(), existing),
                    didCreate: false,
                };
            }

            const provisionalRecord = createCanonicalStorageRecord({
                candidate,
                claimPayload,
                source: 'incubator_storage_acquisition',
            });

            preview.bindCanonicalClaim?.({
                canonicalId: provisionalRecord.canonicalId,
                claimedAt: provisionalRecord.acquiredAt,
                ownerId: provisionalRecord.ownerId,
                source: provisionalRecord.source,
            });

            const boundSnapshot = preview.exportCanonicalSnapshot?.() || provisionalRecord.canonicalSnapshot;
            const record = createCanonicalStorageRecord({
                candidate,
                claimPayload,
                boundSnapshot,
                source: 'incubator_storage_acquisition',
                acquiredAt: provisionalRecord.acquiredAt,
            });

            let placement = null;
            repository.transact((draft) => {
                draft.recordsById[record.canonicalId] = record;
                draft.acquisitionLedger[record.runtimeId] = record.canonicalId;

                const teamAssignment = teamService.assign(draft.teamSlots, record.canonicalId);
                if (teamAssignment.slotIndex >= 0) {
                    draft.teamSlots = teamAssignment.teamSlots;
                    placement = {
                        kind: 'team',
                        slotIndex: teamAssignment.slotIndex,
                    };
                    return draft;
                }

                const archivePlacement = findFirstEmptyArchiveSlot(draft);
                if (!archivePlacement) {
                    throw new Error('No storage slot is available for this canonical acquisition.');
                }

                const pageKey = String(archivePlacement.page);
                draft.pages[pageKey] ||= Array.from({ length: draft.meta.archiveSlotsPerPage }, () => null);
                draft.pages[pageKey][archivePlacement.slotIndex] = record.canonicalId;
                placement = {
                    kind: 'archive',
                    page: archivePlacement.page,
                    slotIndex: archivePlacement.slotIndex,
                };
                return draft;
            }, { type: 'storage:acquire', canonicalId: record.canonicalId });

            return {
                canonicalId: record.canonicalId,
                record,
                placement,
                didCreate: true,
            };
        } finally {
            inFlight = false;
        }
    }

    return {
        acquireCurrentCandidate,
    };
}

function findFirstEmptyArchiveSlot(snapshot) {
    const maxPage = snapshot.meta.devUnlockAllPages ? snapshot.meta.maxPages : snapshot.meta.unlockedPages;

    for (let page = 1; page <= maxPage; page += 1) {
        const pageKey = String(page);
        snapshot.pages[pageKey] ||= Array.from({ length: snapshot.meta.archiveSlotsPerPage }, () => null);
        const slotIndex = snapshot.pages[pageKey].findIndex((value) => !value);
        if (slotIndex >= 0) {
            return { page, slotIndex };
        }
    }

    return null;
}

function resolvePlacement(snapshot, canonicalId) {
    const teamIndex = snapshot.teamSlots.findIndex((value) => value === canonicalId);
    if (teamIndex >= 0) {
        return { kind: 'team', slotIndex: teamIndex };
    }

    for (const [pageKey, slots] of Object.entries(snapshot.pages)) {
        const slotIndex = slots.findIndex((value) => value === canonicalId);
        if (slotIndex >= 0) {
            return { kind: 'archive', page: Number(pageKey), slotIndex };
        }
    }

    return null;
}
