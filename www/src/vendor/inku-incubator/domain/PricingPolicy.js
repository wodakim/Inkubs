function normalizeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function computeCanonicalPrice(candidate, pricingConfig) {
  const metrics = candidate.complexityMetrics || {};
  const complexity = normalizeNumber(metrics.complexityIndex, 0);
  // Prefer rarityScore (0-100) over rarityIndex (1-5) for finer pricing
  const rarityScore = normalizeNumber(metrics.rarityScore, -1);
  const rarityIndex = normalizeNumber(metrics.rarityIndex, 0);
  const attributeCount = Array.isArray(candidate.attributes) ? candidate.attributes.length : 0;

  // Map rarityScore to a multiplier: common~0, legendary up to ~3.5x
  let rarityValue;
  if (rarityScore >= 0) {
    // Non-linear curve: emphasise high rarity strongly
    rarityValue = Math.pow(rarityScore / 100, 1.55) * 100;
  } else {
    // Fallback: keep legacy rarityIndex scale
    rarityValue = rarityIndex;
  }

  const rawPrice =
    pricingConfig.basePrice +
    complexity * pricingConfig.complexityWeight +
    rarityValue  * pricingConfig.rarityWeight +
    attributeCount * pricingConfig.attributeWeight;

  const rounded = roundToStep(rawPrice, pricingConfig.roundTo);
  return Math.max(pricingConfig.roundTo, rounded);
}

export function roundToStep(value, step = 1) {
  if (!Number.isFinite(step) || step <= 1) {
    return Math.round(value);
  }

  return Math.round(value / step) * step;
}
