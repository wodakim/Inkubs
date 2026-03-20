import { deepClone, stableStringify } from '../../shared/object.js';
import { hashString } from '../../shared/random.js';

export const LIVING_STATE_SCHEMA_VERSION = 1;
export const MEMORY_LEDGER_SCHEMA_VERSION = 1;
export const EVENT_JOURNAL_SCHEMA_VERSION = 1;
export const RELATIONSHIP_LEDGER_SCHEMA_VERSION = 1;
export const PROGRESSION_LEDGER_SCHEMA_VERSION = 1;

const SHORT_TERM_CAPACITY = 24;
const LONG_TERM_CAPACITY = 64;
const JOURNAL_CAPACITY = 64;

function nowIso() {
  return new Date().toISOString();
}

// Mood-to-temperament trait mappings for the 15 moods
const MOOD_TEMPERAMENT = {
  calm:        { vigilanceMod: -4,  assertivenessMod: -3, resilienceMod:  4 },
  joyful:      { vigilanceMod: -6,  assertivenessMod:  3, resilienceMod:  6 },
  sleepy:      { vigilanceMod: -10, assertivenessMod: -6, resilienceMod:  0 },
  mischief:    { vigilanceMod:  2,  assertivenessMod:  8, resilienceMod: -2 },
  grumpy:      { vigilanceMod:  6,  assertivenessMod:  6, resilienceMod:  2 },
  curious:     { vigilanceMod:  4,  assertivenessMod:  2, resilienceMod:  0 },
  shy:         { vigilanceMod:  8,  assertivenessMod: -8, resilienceMod: -4 },
  dreamy:      { vigilanceMod: -8,  assertivenessMod: -4, resilienceMod:  2 },
  smug:        { vigilanceMod: -2,  assertivenessMod: 10, resilienceMod:  4 },
  dizzy:       { vigilanceMod: -6,  assertivenessMod: -4, resilienceMod: -4 },
  lovesick:    { vigilanceMod: -8,  assertivenessMod: -2, resilienceMod:  6 },
  proud:       { vigilanceMod:  4,  assertivenessMod: 12, resilienceMod:  8 },
  melancholy:  { vigilanceMod: -4,  assertivenessMod: -8, resilienceMod: -6 },
  frenzied:    { vigilanceMod: 12,  assertivenessMod: 14, resilienceMod: -8 },
  enlightened: { vigilanceMod: -6,  assertivenessMod:  4, resilienceMod: 14 },
};

// Rarity-derived consciousness tier
function deriveConsciousnessTier(rarityTier) {
  const map = { common: 'proto', uncommon: 'nascent', rare: 'aware', epic: 'sentient', legendary: 'transcendent' };
  return map[rarityTier] || 'proto';
}

function deriveMindProfile({ type, genome, stats, proceduralSeed }) {
  const vigilanceBase    = type === 'scary' ? 68 : (type === 'cute' ? 44 : 54);
  const assertivenessBase = type === 'scary' ? 62 : (type === 'cute' ? 42 : 51);
  const resilienceBase   = Math.round((stats.vitality + stats.stability) * 0.5);

  const moodMods = MOOD_TEMPERAMENT[genome.mood] || { vigilanceMod: 0, assertivenessMod: 0, resilienceMod: 0 };

  // Rarity bonus on resilience and a small boost on all axes for legendary
  const rarityTier   = genome.rarityTier  || 'common';
  const rarityScore  = genome.rarityScore || 0;
  const rarityBonus  = { common: 0, uncommon: 2, rare: 5, epic: 9, legendary: 16 }[rarityTier] || 0;

  return {
    schemaVersion: 1,
    consciousnessTier: deriveConsciousnessTier(rarityTier),
    rarityTier,
    rarityScore: Math.round(rarityScore),
    temperamentSeed: `temper_${hashString(`${proceduralSeed}:${genome.mood}:${genome.bodyShape}:${rarityTier}`)}`,
    baselineMood: genome.mood,
    archetype: `${type}_${genome.bodyShape}_${genome.colorPattern || 'solid'}`,
    mentalAxes: {
      curiosity:     clampAxis(stats.curiosity + rarityBonus * 0.5),
      empathy:       clampAxis(stats.empathy   + rarityBonus * 0.4),
      vigilance:     clampAxis(vigilanceBase    + moodMods.vigilanceMod    + Math.round((stats.ferocity - stats.empathy)   * 0.18) + rarityBonus * 0.2),
      assertiveness: clampAxis(assertivenessBase + moodMods.assertivenessMod + Math.round((stats.ferocity - stats.curiosity) * 0.15) + rarityBonus * 0.2),
      resilience:    clampAxis(resilienceBase    + moodMods.resilienceMod    + rarityBonus * 0.8),
    },
    futureSystems: {
      memory: true,
      relationships: true,
      behavioralEvolution: true,
      narrativeContinuity: true
    }
  };
}

function clampAxis(value) {
  return Math.max(1, Math.min(100, value));
}

function buildContinuityFingerprint({ proceduralSeed, type, genome, stats }) {
  return `continuity_${hashString(stableStringify({
    proceduralSeed,
    type,
    mood: genome.mood,
    bodyShape: genome.bodyShape,
    eyeStyle: genome.eyeStyle,
    mouthStyle: genome.mouthStyle,
    stats
  }))}`;
}

function createEmptyMemoryLedger() {
  return {
    schemaVersion: MEMORY_LEDGER_SCHEMA_VERSION,
    capacity: {
      shortTerm: SHORT_TERM_CAPACITY,
      longTerm: LONG_TERM_CAPACITY
    },
    counters: {
      totalMemories: 0,
      significantMemories: 0
    },
    shortTerm: [],
    longTerm: []
  };
}

function createEmptyRelationshipLedger() {
  return {
    schemaVersion: RELATIONSHIP_LEDGER_SCHEMA_VERSION,
    affinities: {},
    socialFlags: {
      bonded: false,
      rivalries: 0,
      friendships: 0
    }
  };
}

function createEmptyProgressionLedger() {
  return {
    schemaVersion: PROGRESSION_LEDGER_SCHEMA_VERSION,
    spawnedAt: nowIso(),
    lastMeaningfulEventAt: null,
    framesSimulated: 0,
    interactionCounts: {
      spawns: 1,
      grabs: 0,
      releases: 0,
      jumps: 0,
      claims: 0,
      explosions: 0,
      actions: {
        attack: 0,
        hurt: 0,
        observe: 0,
        flee: 0,
        question: 0,
        study: 0
      }
    }
  };
}

function createEmptyEventJournal() {
  return {
    schemaVersion: EVENT_JOURNAL_SCHEMA_VERSION,
    retainedEntries: JOURNAL_CAPACITY,
    droppedEntries: 0,
    entries: []
  };
}

export function createLivingState({ proceduralSeed, type, genome, stats }) {
  return {
    schemaVersion: LIVING_STATE_SCHEMA_VERSION,
    provenance: {
      spawnedAt: nowIso(),
      origin: 'runtime_procedural_spawn',
      proceduralSeed,
      type
    },
    continuity: {
      lifecycleStage: 'wild_runtime',
      claimable: true,
      claimStatus: 'unclaimed',
      lastClaimExportedAt: null,
      continuityFingerprint: buildContinuityFingerprint({ proceduralSeed, type, genome, stats })
    },
    cognition: deriveMindProfile({ type, genome, stats, proceduralSeed }),
    memoryLedger: createEmptyMemoryLedger(),
    relationshipLedger: createEmptyRelationshipLedger(),
    progressionLedger: createEmptyProgressionLedger(),
    eventJournal: createEmptyEventJournal()
  };
}

function createJournalEntry(slime, eventType, payload) {
  return {
    id: `evt_${hashString(`${eventType}:${slime.identity?.runtimeId || 'unknown'}:${slime.age || 0}:${Math.random()}`)}`,
    type: eventType,
    at: nowIso(),
    frame: slime.age || 0,
    payload: deepClone(payload || {})
  };
}

function retainCapped(list, capacity) {
  if (list.length <= capacity) return 0;
  const removed = list.length - capacity;
  list.splice(0, removed);
  return removed;
}

function updateProgressionLedger(slime, eventType, payload) {
  const ledger = slime.livingState?.progressionLedger;
  if (!ledger) return;
  ledger.lastMeaningfulEventAt = nowIso();

  switch (eventType) {
    case 'jump':
      ledger.interactionCounts.jumps++;
      break;
    case 'grab_start':
      ledger.interactionCounts.grabs++;
      break;
    case 'grab_release':
      ledger.interactionCounts.releases++;
      break;
    case 'claim_bound':
      ledger.interactionCounts.claims++;
      break;
    case 'exploded':
      ledger.interactionCounts.explosions++;
      break;
    case 'action_triggered': {
      const action = payload?.action;
      if (action && Object.prototype.hasOwnProperty.call(ledger.interactionCounts.actions, action)) {
        ledger.interactionCounts.actions[action]++;
      }
      break;
    }
  }
}

function maybePersistMemory(slime, eventType, payload, options = {}) {
  const memoryLedger = slime.livingState?.memoryLedger;
  if (!memoryLedger) return;

  const importance = options.importance || 'routine';
  const shouldPersist = importance === 'significant' || options.persistLongTerm === true;
  const shouldEchoShortTerm = options.echoShortTerm !== false;

  const memory = {
    id: `mem_${hashString(`${eventType}:${slime.identity?.runtimeId || 'unknown'}:${memoryLedger.counters.totalMemories}`)}`,
    kind: options.kind || eventType,
    importance,
    at: nowIso(),
    payload: deepClone(payload || {})
  };

  if (shouldEchoShortTerm) {
    memoryLedger.shortTerm.push(memory);
    retainCapped(memoryLedger.shortTerm, memoryLedger.capacity.shortTerm);
  }

  if (shouldPersist) {
    memoryLedger.longTerm.push(memory);
    retainCapped(memoryLedger.longTerm, memoryLedger.capacity.longTerm);
    memoryLedger.counters.significantMemories++;
  }

  memoryLedger.counters.totalMemories++;
}

export function touchLivingStateFrame(slime) {
  const livingState = slime.livingState;
  if (!livingState?.progressionLedger) return;
  livingState.progressionLedger.framesSimulated = slime.age || 0;
}

export function recordSlimeEvent(slime, eventType, payload = {}, options = {}) {
  if (!slime?.livingState?.eventJournal) return null;

  const entry = createJournalEntry(slime, eventType, payload);
  const journal = slime.livingState.eventJournal;
  journal.entries.push(entry);
  journal.droppedEntries += retainCapped(journal.entries, journal.retainedEntries || JOURNAL_CAPACITY);

  updateProgressionLedger(slime, eventType, payload);
  maybePersistMemory(slime, eventType, payload, options);

  return entry;
}

export function appendMemoryEcho(slime, kind, payload = {}, options = {}) {
  maybePersistMemory(slime, kind, payload, {
    kind,
    importance: options.importance || 'routine',
    persistLongTerm: options.persistLongTerm === true,
    echoShortTerm: options.echoShortTerm !== false
  });
}

export function captureLivingStateSnapshot(slime) {
  return deepClone(slime?.livingState || null);
}

export function markClaimPayloadExported(slime) {
  if (!slime?.livingState?.continuity) return;
  slime.livingState.continuity.lastClaimExportedAt = nowIso();
}

export function bindLivingStateCanonicalClaim(slime, canonicalRecord) {
  if (!slime?.livingState?.continuity) return;
  slime.livingState.continuity.lifecycleStage = 'canonical_bound';
  slime.livingState.continuity.claimStatus = 'claimed';
  slime.livingState.continuity.canonicalId = canonicalRecord.canonicalId;
}
