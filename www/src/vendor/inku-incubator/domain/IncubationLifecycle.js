export const INCUBATION_PHASES = Object.freeze({
  IDLE: 'idle',
  STAGING: 'staging',
  INTAKE: 'intake',
  SUSPENDED: 'suspended',
  PURCHASE_PENDING: 'purchasePending',
  PURCHASED: 'purchased',
  PURGING: 'purging',
  PURGED: 'purged',
  ERROR: 'error'
});

export function getPhaseDescription(phase) {
  return INCUBATION_PHASES[phase?.toUpperCase?.()] || phase;
}
