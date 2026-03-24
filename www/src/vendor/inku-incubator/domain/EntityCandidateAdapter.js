export function adaptCandidate(rawCandidate, computePrice) {
  if (!rawCandidate || typeof rawCandidate !== 'object') {
    throw new Error('Candidate payload must be a non-null object.');
  }

  const canonicalId = rawCandidate.canonicalId || rawCandidate.id;
  if (!canonicalId) {
    throw new Error('Candidate payload requires canonicalId or id.');
  }

  const candidate = {
    canonicalId,
    speciesKey: rawCandidate.speciesKey || 'unknown-species',
    displayName: rawCandidate.displayName || rawCandidate.speciesKey || 'Unknown Candidate',
    complexityMetrics: {
      complexityIndex: normalizeMetric(rawCandidate.complexityMetrics?.complexityIndex),
      rarityIndex: normalizeMetric(rawCandidate.complexityMetrics?.rarityIndex)
    },
    visuals: rawCandidate.visuals || {},
    attributes: Array.isArray(rawCandidate.attributes) ? rawCandidate.attributes : [],
    canonicalPayload: rawCandidate.canonicalPayload || {},
    metadata: rawCandidate.metadata || {},
    price: 0
  };

  candidate.price = computePrice(candidate);
  return candidate;
}

function normalizeMetric(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, numeric);
}
