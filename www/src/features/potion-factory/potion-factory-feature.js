// src/features/potion-factory/potion-factory-feature.js
import { createPotionFactoryController } from './potion-factory-controller.js';

export function createPotionFactoryFeature({ store }) {
    let controller = null;

    return {
        id: 'potion-factory',
        mount(context) {
            if (!controller) {
                controller = createPotionFactoryController({ store });
            }
            controller.mount(context.mount);
        },
        resume(context) {
            if (!controller) {
                controller = createPotionFactoryController({ store });
                controller.mount(context.mount);
            } else {
                controller.resume();
            }
        },
        suspend() {
            if (controller) {
                controller.suspend();
            }
        },
        syncLayout() {
            // Placeholder for UI adjustments on resize
        },
        unmount() {
            if (controller) {
                controller.unmount();
                controller = null;
            }
        }
    };
}
