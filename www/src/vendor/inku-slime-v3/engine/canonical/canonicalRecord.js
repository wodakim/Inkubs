import { deepClone, stableStringify } from '../../shared/object.js';
import { hashString } from '../../shared/random.js';
import { bindLivingStateCanonicalClaim, captureLivingStateSnapshot, markClaimPayloadExported, recordSlimeEvent } from '../lifecycle/livingState.js';

export const CANONICAL_SCHEMA_VERSION = 2;
export const PROCEDURAL_IDENTITY_SCHEMA_VERSION = 1;

function makeRuntimeId() {
  return `runtime_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeClaimSource(source) {
  return source || 'inventory_claim';
}

export function createProceduralIdentity({
  proceduralSeed,
  type,
  baseRadius,
  numNodes,
  genome,
  stats,
  genomeSchemaVersion,
  statsSchemaVersion,
  blueprintSchemaVersion,
  bodyProfile
}) {
  const canonicalCore = {
    proceduralSeed,
    type,
    baseRadius,
    numNodes,
    genome,
    stats,
    bodyProfile,
    blueprintSchemaVersion,
    genomeSchemaVersion,
    statsSchemaVersion
  };

  const proceduralFingerprint = `proc_${hashString(stableStringify(canonicalCore))}`;
  const rarityTier  = genome?.rarityTier  || stats?.rarityTier  || 'common';
  const rarityScore = genome?.rarityScore || stats?.rarityScore || 0;
  const templateFingerprint = `template_${hashString(stableStringify({
    type,
    bodyShape: genome.bodyShape,
    eyeStyle: genome.eyeStyle,
    mouthStyle: genome.mouthStyle,
    accessory: genome.accessory,
    detailTrait: genome.detailTrait,
    blueprintSchemaVersion,
    genomeSchemaVersion
  }))}`;

  return {
    runtimeId: makeRuntimeId(),
    schemaVersion: PROCEDURAL_IDENTITY_SCHEMA_VERSION,
    lifecycle: 'wild',
    proceduralSeed,
    proceduralFingerprint,
    templateFingerprint,
    rarityTier,
    rarityScore,
    blueprintSchemaVersion,
    genomeSchemaVersion,
    statsSchemaVersion,
    canonical: {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      status: 'unclaimed',
      canonicalId: null,
      claimedAt: null,
      ownerId: null,
      source: null
    }
  };
}

export function buildCanonicalClaimPayload(slime, {
  ownerId = null,
  source = 'inventory_claim',
  slotHint = null,
  inventoryContainerId = null,
  captureContext = null
} = {}) {
  markClaimPayloadExported(slime);

  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    requestType: 'claim_procedural_slime',
    requestedAt: new Date().toISOString(),
    runtimeId: slime.identity.runtimeId,
    lifecycle: slime.identity.lifecycle,
    ownerId,
    source: normalizeClaimSource(source),
    slotHint,
    inventoryContainerId,
    identity: deepClone(slime.identity),
    livingState: captureLivingStateSnapshot(slime),
    proceduralCore: {
      type: slime.type,
      baseRadius: slime.baseRadius,
      numNodes: slime.numNodes,
      genome: deepClone(slime.genome),
      stats: deepClone(slime.stats),
      bodyProfile: deepClone(slime.bodyProfile)
    },
    renderProfile: {
      color: slime.color,
      darkColor: slime.darkColor,
      highlightColor: slime.highlightColor,
      accessoryAttachment: deepClone(slime.accessoryAttachment)
    },
    canonicalSnapshot: buildCanonicalSnapshot(slime),
    captureContext: captureContext ? deepClone(captureContext) : null
  };
}

export function applyCanonicalClaim(slime, canonicalRecord) {
  if (!canonicalRecord || !canonicalRecord.canonicalId) {
    throw new Error('Canonical claim result must contain canonicalId.');
  }

  slime.identity.lifecycle = 'canonical';
  slime.identity.canonical = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    status: 'claimed',
    canonicalId: canonicalRecord.canonicalId,
    claimedAt: canonicalRecord.claimedAt || new Date().toISOString(),
    ownerId: canonicalRecord.ownerId || null,
    source: normalizeClaimSource(canonicalRecord.source)
  };

  bindLivingStateCanonicalClaim(slime, canonicalRecord);
  recordSlimeEvent(slime, 'claim_bound', { canonicalId: canonicalRecord.canonicalId }, { importance: 'significant', persistLongTerm: true });

  return deepClone(slime.identity.canonical);
}

export function buildCanonicalSnapshot(slime) {
  markClaimPayloadExported(slime);

  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    runtimeId: slime.identity.runtimeId,
    lifecycle: slime.identity.lifecycle,
    proceduralSeed: slime.identity.proceduralSeed,
    proceduralFingerprint: slime.identity.proceduralFingerprint,
    templateFingerprint: slime.identity.templateFingerprint,
    canonical: deepClone(slime.identity.canonical),
    livingState: captureLivingStateSnapshot(slime),
    proceduralCore: {
      type: slime.type,
      baseRadius: slime.baseRadius,
      numNodes: slime.numNodes,
      genome: deepClone(slime.genome),
      stats: deepClone(slime.stats),
      bodyProfile: deepClone(slime.bodyProfile)
    },
    renderProfile: {
      color: slime.color,
      darkColor: slime.darkColor,
      highlightColor: slime.highlightColor,
      accessoryAttachment: deepClone(slime.accessoryAttachment)
    },
    runtimePose: {
      locomotionState: slime.locomotionState,
      actionState: slime.actionState,
      facing: slime.facing
    }
  };
}
