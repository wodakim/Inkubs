import { deepClone, stableStringify } from '../../vendor/inku-slime-v3/shared/object.js';
import { hashString } from '../../vendor/inku-slime-v3/shared/random.js';

export const CANONICAL_STORAGE_SCHEMA_VERSION = 1;

export function createCanonicalStorageRecord({
    candidate,
    claimPayload,
    boundSnapshot = null,
    ownerId = null,
    source = 'incubator_storage_acquisition',
    acquiredAt = new Date().toISOString(),
}) {
    const runtimeId = claimPayload?.runtimeId || boundSnapshot?.runtimeId || candidate?.id || null;
    if (!runtimeId) {
        throw new Error('A canonical storage record requires a runtimeId.');
    }

    const proceduralFingerprint = claimPayload?.identity?.proceduralFingerprint
        || boundSnapshot?.proceduralFingerprint
        || candidate?.metadata?.previewBlueprint?.identity?.proceduralFingerprint
        || candidate?.metadata?.proceduralSeed
        || runtimeId;

    const canonicalId = boundSnapshot?.canonical?.canonicalId
        || claimPayload?.identity?.canonical?.canonicalId
        || `canon_${hashString(stableStringify({ runtimeId, proceduralFingerprint, acquiredAt, source }))}`;

    const canonicalSnapshot = deepClone(boundSnapshot || claimPayload?.canonicalSnapshot || null);
    const identity = deepClone(claimPayload?.identity || canonicalSnapshot?.canonical || null);
    const livingState = deepClone(boundSnapshot?.livingState || claimPayload?.livingState || null);
    const proceduralCore = deepClone(boundSnapshot?.proceduralCore || claimPayload?.proceduralCore || null);
    const renderProfile = deepClone(boundSnapshot?.renderProfile || claimPayload?.renderProfile || null);
    const captureContext = deepClone(claimPayload?.captureContext || null);

    return {
        schemaVersion: CANONICAL_STORAGE_SCHEMA_VERSION,
        canonicalId,
        runtimeId,
        acquiredAt,
        source,
        ownerId,
        speciesKey: candidate?.speciesKey || proceduralCore?.type || 'unknown-species',
        displayName: candidate?.displayName || `Specimen ${String(runtimeId).slice(-6).toUpperCase()}`,
        complexityMetrics: deepClone(candidate?.complexityMetrics || null),
        attributes: Array.isArray(candidate?.attributes) ? deepClone(candidate.attributes) : [],
        identity,
        livingState,
        proceduralCore,
        renderProfile,
        canonicalSnapshot,
        claimPayload: deepClone(claimPayload || null),
        captureContext,
        storageDisplay: {
            label: candidate?.displayName || `Specimen ${String(runtimeId).slice(-6).toUpperCase()}`,
            level: deriveDisplayLevel(proceduralCore?.stats),
            rarity: deriveDisplayRarity(candidate?.complexityMetrics || proceduralCore?.genome),
            typeLabel: proceduralCore?.type || candidate?.speciesKey || 'unknown',
            mood: proceduralCore?.genome?.mood || null,
            bodyShape: proceduralCore?.genome?.bodyShape || null,
            accessory: proceduralCore?.genome?.accessory || null,
            hue: proceduralCore?.genome?.hue ?? null,
            colorPattern: proceduralCore?.genome?.colorPattern || 'solid',
            rarityTier: proceduralCore?.genome?.rarityTier || 'common',
            rarityScore: proceduralCore?.genome?.rarityScore ?? 0,
            statusLabel: 'ACQUIRED',
        },
    };
}

function deriveDisplayLevel(stats = {}) {
    if (!stats || typeof stats !== 'object') {
        return 1;
    }

    const sample = [stats.vitality, stats.agility, stats.stability, stats.curiosity, stats.empathy, stats.ferocity]
        .filter((value) => Number.isFinite(value));

    if (sample.length === 0) {
        return 1;
    }

    const mean = sample.reduce((sum, value) => sum + value, 0) / sample.length;
    return Math.max(1, Math.min(99, Math.round(mean / 10)));
}

function deriveDisplayRarity(metrics = {}) {
    // Prefer the rarityTier string from genome when present
    const tier = String(metrics?.rarityTier || '').trim().toLowerCase();
    if (tier === 'legendary') return 'Légendaire';
    if (tier === 'epic')      return 'Épique';
    if (tier === 'rare')      return 'Rare';
    if (tier === 'uncommon')  return 'Peu commun';
    if (tier === 'common')    return 'Commun';

    // Fallback: derive from numeric rarityIndex (1-5)
    const rarityIndex = Number(metrics?.rarityIndex);
    if (!Number.isFinite(rarityIndex)) return 'Commun';
    if (rarityIndex >= 5) return 'Légendaire';
    if (rarityIndex >= 4) return 'Épique';
    if (rarityIndex >= 3) return 'Rare';
    if (rarityIndex >= 2) return 'Peu commun';
    return 'Commun';
}
