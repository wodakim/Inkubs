import { pickRandom } from '../../shared/math.js';
import { createRandomSeed, createSeededRng } from '../../shared/random.js';
import { SLIME_TYPES } from '../config/catalog.js';
import { createProceduralIdentity } from '../canonical/canonicalRecord.js';
import { computeBodyRadiusForGenome, createGenome, GENOME_SCHEMA_VERSION } from './genomeFactory.js';
import { buildProceduralStats, PROCEDURAL_STATS_SCHEMA_VERSION } from './proceduralStats.js';
import { createLivingState } from '../lifecycle/livingState.js';

export const PROCEDURAL_BLUEPRINT_SCHEMA_VERSION = 1;

export function buildProceduralBlueprint({
  proceduralSeed = createRandomSeed(),
  type = null,
  baseRadius = null,
  numNodes = 25
} = {}) {
  const rng = createSeededRng(proceduralSeed);
  // Type selection with weighted probabilities.
  // instable is an ultra-rare genome: ~1/400 chance (weight 1 vs 133 each for the rest).
  // Weights: cute=133, normal=133, scary=133, instable=1  → total=400
  function pickWeightedType(rng) {
    const roll = rng() * 400;
    if (roll < 133) return 'cute';
    if (roll < 266) return 'normal';
    if (roll < 399) return 'scary';
    return 'instable';
  }
  const resolvedType = type || pickWeightedType(rng);
  const resolvedBaseRadius = Number.isFinite(baseRadius) ? baseRadius : (50 + rng() * 30);
  const genome = createGenome(resolvedType, { rng });
  const stats = buildProceduralStats({ type: resolvedType, baseRadius: resolvedBaseRadius, genome });
  const bodyProfile = buildBodyProfile({ genome, baseRadius: resolvedBaseRadius, numNodes });
  const livingState = createLivingState({ proceduralSeed, type: resolvedType, genome, stats });
  const identity = createProceduralIdentity({
    proceduralSeed,
    type: resolvedType,
    baseRadius: resolvedBaseRadius,
    numNodes,
    genome,
    stats,
    bodyProfile,
    blueprintSchemaVersion: PROCEDURAL_BLUEPRINT_SCHEMA_VERSION,
    genomeSchemaVersion: GENOME_SCHEMA_VERSION,
    statsSchemaVersion: PROCEDURAL_STATS_SCHEMA_VERSION
  });

  return {
    schemaVersion: PROCEDURAL_BLUEPRINT_SCHEMA_VERSION,
    proceduralSeed,
    type: resolvedType,
    baseRadius: resolvedBaseRadius,
    numNodes,
    genome,
    stats,
    bodyProfile,
    livingState,
    identity
  };
}

function buildBodyProfile({ genome, baseRadius, numNodes }) {
  const radii = [];
  let minRadius = Infinity;
  let maxRadius = -Infinity;

  for (let i = 0; i < numNodes; i++) {
    const angle = (i / numNodes) * Math.PI * 2;
    const radius = computeBodyRadiusForGenome(genome, baseRadius, angle);
    radii.push(radius);
    minRadius = Math.min(minRadius, radius);
    maxRadius = Math.max(maxRadius, radius);
  }

  return {
    numNodes,
    minRadius,
    maxRadius,
    radii
  };
}
