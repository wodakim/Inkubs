// www/src/systemMap.js

export const SYSTEM_MAP = {
  slime: {
    engine: [
      "vendor/inku-slime-v3/engine/SlimeEngine.js",
      "vendor/inku-slime-v3/engine/entities/Slime.js"
    ],
    physics: [
      "vendor/inku-slime-v3/engine/entities/slime/installPhysics.js"
    ],
    render: [
      "vendor/inku-slime-v3/engine/entities/slime/installRender.js"
    ],
    genetics: [
      "vendor/inku-slime-v3/engine/genetics/genomeFactory.js"
    ]
  },

  prairie: {
    logic: [
      "features/prairie/prairie-feature.js",
      "features/prairie/slime-interaction-engine.js"
    ],
    sound: [
      "features/prairie/slime-sound-engine.js"
    ]
  },

  storage: {
    state: [
      "features/storage/storage-runtime-context.js",
      "features/storage/canonical-slime-record.js"
    ],
    persistence: [
      "features/storage/storage-persistence-supabase-adapter.js"
    ],
    ui: [
      "features/storage/storage-grid-renderer.js"
    ]
  },

  potion_factory: {
    logic: [
      "features/potion-factory/potion-factory-feature.js",
      "features/potion-factory/potion-factory-controller.js",
      "features/potion-factory/potion-engine.js"
    ],
    persistence: [
      "features/potion-factory/potion-persistence.js"
    ]
  }
};