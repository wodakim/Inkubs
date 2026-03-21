import { t } from '../../../i18n/i18n.js';

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
    get statusLabels() {
      return {
        idle:            t('incubator.status.idle'),
        staging:         t('incubator.status.staging'),
        intake:          t('incubator.status.intake'),
        suspended:       t('incubator.status.suspended'),
        purchasePending: t('incubator.status.purchasePending'),
        purchased:       t('incubator.status.purchased'),
        purging:         t('incubator.status.purging'),
        purged:          t('incubator.status.purged'),
        error:           t('incubator.status.error'),
      };
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
