import { createStoragePersistenceLocal } from './storage-persistence-local.js';
import { createStoragePersistenceRepository } from './storage-persistence-repository.js';
import { createStorageTeamService } from './storage-team-service.js';
import { createStorageAcquisitionPipeline } from './storage-acquisition-pipeline.js';

let sharedContext = null;

export function getStorageRuntimeContext() {
    if (sharedContext) {
        return sharedContext;
    }

    const driver = createStoragePersistenceLocal({ storageKey: 'inku.storage.v1' });
    const repository = createStoragePersistenceRepository({
        driver,
        initialMeta: {
            devUnlockAllPages: true,
        },
    });
    const teamService = createStorageTeamService({ slotCount: 4 });
    const acquisitionPipeline = createStorageAcquisitionPipeline({
        repository,
        teamService,
    });

    sharedContext = {
        driver,
        repository,
        teamService,
        acquisitionPipeline,
    };

    return sharedContext;
}

export function resetStorageRuntimeContext() {
    sharedContext = null;
}
