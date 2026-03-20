export const DEFAULT_INCUBATOR_CONFIG = Object.freeze({
  theme: {
    accentHue: 190,
    ambientGlowOpacity: 0.22,
    liquidLevel: 0.7
  },
  timings: {
    intakeMs: 800,
    suspensionMs: 0,
    purgeMs: 900,
    purchaseMs: 550
  },
  pricing: {
    basePrice: 120,
    complexityWeight: 75,
    // rarityWeight now applied to rarityValue (0-100 curve), not rarityIndex (0-5)
    // A legendary (score~95) -> rarityValue~89 -> adds ~445 C above base at this weight
    rarityWeight: 5,
    attributeWeight: 12,
    roundTo: 5
  },
  capabilities: {
    autoPurgeWhenExpired: false,
    allowPurchase: true,
    allowPurge: true
  },
  ui: {
    title: 'INKU INCUBATOR',
    diagnosticLabel: 'CANONICAL PREVIEW',
    buyButtonLabel: 'Acquire',
    purgeButtonLabel: 'Purge',
    statusLabels: {
      idle: 'EN ATTENTE...',
      staging: 'SIGNAL DÉTECTÉ',
      intake: 'ANALYSE EN COURS',
      suspended: 'ENTITÉ STABILISÉE',
      purchasePending: 'TRANSFERT...',
      purchased: 'ADOPTÉ !',
      purging: 'LIBÉRATION...',
      purged: 'CHAMBRE VIDE',
      error: 'ANOMALIE CRITIQUE'
    }
  },
  hooks: {
    computePrice: null,
    resolvePurchase: null,
    resolvePurge: null,
    renderCandidate: null,
    clearCandidate: null,
    onStateChange: null,
    onError: null
  }
});
