import { IncubatorController } from './core/IncubatorController.js';
import { INCUBATOR_EVENTS } from './core/IncubatorEvents.js';
import { DEFAULT_INCUBATOR_CONFIG } from './config/defaultConfig.js';

export function createIncubator(options) {
  return new IncubatorController(options);
}

export {
  IncubatorController,
  INCUBATOR_EVENTS,
  DEFAULT_INCUBATOR_CONFIG
};
