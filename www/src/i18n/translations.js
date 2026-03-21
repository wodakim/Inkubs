/**
 * INKÜ — Translations v1.0
 * Clés i18n pour FR (défaut) et EN.
 */

export const TRANSLATIONS = {
    fr: {
        // Rotation
        'rotate.text': 'Tourne ton téléphone<br>pour jouer',

        // Nav
        'nav.prairie': 'Prairie',
        'nav.musee':   'Musée',
        'nav.labo':    'Labo',
        'nav.bar':     'Bar',
        'nav.shop':    'Shop',

        // HUD
        'hud.role': 'Docteur',

        // Profil — carte principale
        'profile.my_profile':       'Mon Profil',
        'profile.performance':      'Performances',
        'profile.incubator_alerts': 'Alertes Incubateur',
        'profile.notify_from':      'Notifier dès :',
        'profile.tier.uncommon':    'Peu commun',
        'profile.tier.rare':        'Rare',
        'profile.tier.epic':        'Épique',
        'profile.tier.legendary':   'Légendaire',
        'profile.reset_data':       '⚠ Réinitialiser les données',
        'profile.language':         'Langue',

        // Panneau paramètres (in-game)
        'settings.back':           'Retour',
        'settings.avatar':         'Avatar',
        'settings.display_name':   "Nom d'affichage",
        'settings.name_ph':        'Ton pseudo...',
        'settings.save':           'Sauvegarder',
        'settings.visual_quality': 'Qualité visuelle',
        'settings.economy':        'Économie',
        'settings.max_fluidity':   'Fluidité maximale',
        'settings.balanced':       'Équilibré',
        'settings.recommended':    'Recommandé',
        'settings.quality':        'Qualité',
        'settings.high_end':       'Haut de gamme',
        'settings.auto_detect':    'Détection automatique',

        // Modal reset (in-game)
        'reset.title':   'Remise à zéro',
        'reset.body':    'Toutes tes données seront <span class="text-red-400 font-bold">définitivement supprimées</span> — slimes, progression, collection. Cette action est irréversible.',
        'reset.confirm': 'Tout effacer',
        'reset.cancel':  'Annuler',

        // Modal redémarrage traduction
        'lang.restart_title': 'Redémarrage requis',
        'lang.restart_body':  'Le jeu va redémarrer pour appliquer la traduction.',

        // Title-screen (paramètres)
        'ts.subtitle':         'Incubateur Virtuel',
        'ts.ready':            'Prêt à jouer',
        'ts.offline':          'Mode hors-ligne actif',
        'ts.wake':             'RÉVEILLER LE SLIME',
        'ts.settings':         'Paramètres',
        'ts.sound':            'Son',
        'ts.master':           'Volume général',
        'ts.music':            'Musique',
        'ts.sfx':              'Effets sonores',
        'ts.display':          'Affichage',
        'ts.graphics_quality': 'Qualité graphique',
        'ts.battery':          'Impact sur la batterie',
        'ts.q_low':            'Bas',
        'ts.q_mid':            'Moy',
        'ts.q_high':           'Haut',
        'ts.fps_counter':      'Compteur FPS',
        'ts.fps_sub':          'Affiche les images par seconde',
        'ts.reduce_anim':      'Réduire les animations',
        'ts.reduce_anim_sub':  'Accessibilité & économie batterie',
        'ts.gameplay':         'Gameplay',
        'ts.vibrations':       'Vibrations',
        'ts.vibrations_sub':   'Retour tactile lors des actions',
        'ts.notifications':    'Notifications',
        'ts.notif_sub':        'Alertes de progression du slime',
        'ts.language':         'Langue',
        'ts.language_sub':     "Localisation de l'interface",
        'ts.data':             'Données',
        'ts.data_info':        'Version <span style="color:#34d399;font-weight:800;">v0.1.0</span> · Mode <span style="color:#34d399;font-weight:800;">OFFLINE</span><br>Données stockées localement sur l\'appareil.',
        'ts.erase_data':       'Effacer toutes les données',
        'ts.erase_sub':        'Slimes, progression, collection — irréversible',
        'ts.reset_title':      'Remise à zéro',
        'ts.reset_body':       'Toutes les données seront <strong>définitivement supprimées</strong> — slimes, progression, collection. Cette action est irréversible.',
        'ts.erase_all':        'Tout effacer',
        'ts.cancel':           'Annuler',
        'ts.lang_restart':     'Redémarrage…',
        'ts.loading_1':        'Synchronisation ADN...',
        'ts.loading_2':        'Chargement du laboratoire...',
        'ts.loading_3':        'Réveil du slime...',

        // Panneau archive / storage
        'storage.collection':       'Collection',
        'storage.archive_title':    'Archive',
        'storage.team_tab':         'Équipe',
        'storage.archive_tab':      'Archive',
        'storage.team_active':      'Équipe active',
        'storage.box':              'Boîte',
        'storage.rarity':           'Rareté',
        'storage.level':            'Niv.',
        'storage.type':             'Type',
        'storage.sell_zone_aria':   'Panier de revente',
        'storage.sell_label':       'Revendre',
        'storage.sell_modal_title': 'Revente',
        'storage.irreversible':     'Cette action est irréversible.',
        'storage.cancel':           'Annuler',
        'storage.sell_confirm':     'Revendre',
        'storage.profile_eyebrow':  'Profil',
        'storage.specimen':         'Specimen',
        'storage.close_aria':       "Fermer l'archive",
        'storage.prev_aria':        'Boîte précédente',
        'storage.next_aria':        'Boîte suivante',
        'storage.nav_aria':         'Navigation et tri',
        'storage.resize_aria':      'Redimensionner le storage',
        'storage.close_detail_aria':'Fermer le dossier',

        // Notifications rareté
        'notif.title': 'Incubateur',
        'notif.body':  'Slime {label} disponible !',
        'notif.close': 'Fermer',

        // Labels rareté
        'rarity.common':    'Commun',
        'rarity.uncommon':  'Peu commun',
        'rarity.rare':      'Rare',
        'rarity.epic':      'Épique',
        'rarity.legendary': 'Légendaire',

        // Storage — textes en dur restants
        'storage.sections_aria':        "Sections de l'archive",
        'storage.confirm_sell_aria':    'Confirmer la revente',
        'storage.slime_file_aria':      'Dossier du slime',
        'storage.specimen_name_ph':     'Nom du spécimen…',
        'storage.save_name_aria':       'Sauvegarder le nom',
        'storage.page':                 'Page',
        'storage.slot_level':           'niveau',

        // Storage — sandbox aperçu
        'sandbox.unavailable':          'Aperçu indisponible',
        'sandbox.canvas_aria':          'Aperçu interactif du slime',

        // Prairie
        'prairie.canvas_aria':          'Prairie des slimes',
        'prairie.minimap_aria':         'Minimap prairie',
        'prairie.open_storage_aria':    'Ouvrir le storage',
        'prairie.close_storage_aria':   'Fermer le storage',
        'prairie.resize_storage_aria':  'Redimensionner le storage',
        'prairie.observe_aria':         'Observer les Inkübus',
        'prairie.remove_slime_aria':    'Retirer le slime de la prairie',
        'prairie.deploy_slime_aria':    'Déployer le slime dans la prairie',
        'prairie.no_interaction':       'Aucune interaction pour le moment...',

        // Profile modal (textes en dur)
        'profile.my_profile_title':     'Mon Profil',
        'profile.performance_title':    'Performances',

        // Incubator template
        'incubator.open_archive_aria':  "Ouvrir l'archive d'entités",

        // Incubator — labels d'état
        'incubator.status.idle':            'EN ATTENTE...',
        'incubator.status.staging':         'SIGNAL DÉTECTÉ',
        'incubator.status.intake':          'ANALYSE EN COURS',
        'incubator.status.suspended':       'ENTITÉ STABILISÉE',
        'incubator.status.purchasePending': 'TRANSFERT...',
        'incubator.status.purchased':       'ADOPTÉ !',
        'incubator.status.purging':         'LIBÉRATION...',
        'incubator.status.purged':          'CHAMBRE VIDE',
        'incubator.status.error':           'ANOMALIE CRITIQUE',

        // Incubator — toasts
        'incubator.toast.insufficient_funds': 'Solde insuffisant — il te faut {price} ⬡',
        'incubator.toast.storage_full':       'Toutes les boîtes sont pleines !',

        // Incubator — nom d'entité par défaut
        'incubator.entity_fallback':        'ENTITÉ',
        'incubator.no_entity':              'AUCUNE ENTITÉ',
        'incubator.price_label':            'PRIX',
        'incubator.archive_label':          'ARCHIVE',
        'incubator.entities_label':         'ENTITÉS',

        // Incubator — noms de pattern (badge, casse mixte)
        'pattern.solid':          'Uni',
        'pattern.radial_glow':    'Lueur',
        'pattern.gradient_v':     'Dégradé ↕',
        'pattern.gradient_h':     'Dégradé ↔',
        'pattern.gradient_diag':  'Dégradé ↗',
        'pattern.duo_tone':       'Duo',
        'pattern.soft_spots':     'Taches',
        'pattern.stripe_v':       'Rayures',
        'pattern.galaxy_swirl':   'Galaxie',
        'pattern.aurora':         'Aurore',
        'pattern.crystal_facets': 'Cristal',
        'pattern.prismatic':      'Prismatique',
        'pattern.void_rift':      'Rift',

        // ── Tutoriel ─────────────────────────────────────────────────────
        'tuto.skip':                    'Passer le tutoriel',
        'tuto.next':                    'Suivant →',
        'tuto.start':                   'Commencer !',
        'tuto.restart':                 'Rejouer le tutoriel',
        'tuto.restart_sub':             'Revoir toutes les étapes depuis le début',
        'tuto.step_of':                 'Étape {n} sur {total}',

        // Étape 0 — Langue
        'tuto.lang.title':              'Choisissez votre langue',
        'tuto.lang.body':               'Sélectionnez la langue de l\'interface. Tu pourras changer ça plus tard dans les paramètres.',
        'tuto.lang.fr':                 '🇫🇷 Français',
        'tuto.lang.en':                 '🇬🇧 English',

        // Étape 1 — Monnaie
        'tuto.money.title':             'Les Inkübits ⬡',
        'tuto.money.body':              'Les <strong>Inkübits</strong> sont la monnaie bleue du jeu — tu peux en voir le total en haut à droite.\n\nTon objectif : faire grandir ton équipe d\'Inkübs (slimes) pour en générer un maximum à la minute. Plus tu as d\'Inkübs actifs dans la prairie, plus tu gagnes !',

        // Étape 2 — Acheter un slime
        'tuto.buy.title':               'Acheter un Inkübs 🧪',
        'tuto.buy.body':                'Dans le <strong>Labo</strong>, un incubateur génère en permanence de nouveaux Inkübs.\n\nLe prix en Inkübits ⬡ est affiché juste au-dessus du bouton d\'achat.\n• Bouton <span style="color:#4ade80;font-weight:700;">vert</span> = tu peux te le permettre !\n• Bouton <span style="color:#f87171;font-weight:700;">rouge</span> = il manque des Inkübits.\n\nChaque Inkübs acheté est rangé dans la boîte de stockage.',

        // Étape 3 — Boîte de stockage
        'tuto.storage.title':           'La Boîte de Stockage 📦',
        'tuto.storage.body':            'Tous tes Inkübs achetés apparaissent dans la <strong>boîte de stockage</strong> (icône grille en haut à droite de la prairie ou du labo).\n\nAppuie sur un Inkübs pour afficher sa fiche détaillée — stats, génome, aperçu interactif.\nAppuie en dehors de la fiche pour la refermer.',

        // Étape 4 — Prairie
        'tuto.prairie.title':           'La Prairie 🌿',
        'tuto.prairie.body':            'Déploie tes Inkübs dans la <strong>Prairie</strong> pour qu\'ils génèrent des Inkübits à la minute.\n\nIls interagissent entre eux en temps réel : certains s\'entendent très bien et se font gagner des points de stats, d\'autres se déplaisent mutuellement et font perdre des points.\n\nUtilise la <strong>loupe 🔍</strong> en haut à droite pour activer le mode Observation : appuie ensuite sur un Inkübs pour voir son niveau d\'XP et ses interactions en cours.',

        // Étape 5 — Niveau & Loupe avancée
        'tuto.level.title':             'Niveaux & Affinités ⭐',
        'tuto.level.body':              'Quand <strong>3 stats atteignent leur maximum</strong>, l\'Inkübs gagne un niveau — il devient plus puissant et génère davantage d\'Inkübits.\n\nDans la loupe, le <strong>second volet</strong> affiche les stats détaillées par domaine ainsi que les affinités : le pourcentage relationnel avec chaque Inkübs présent est listé du plus fort au plus faible (top 5).\n\nTu peux effacer l\'historique d\'affinité avec les slimes actuellement dans la prairie via le bouton dédié.',
    },

    en: {
        // Rotation
        'rotate.text': 'Rotate your phone<br>to play',

        // Nav
        'nav.prairie': 'Prairie',
        'nav.musee':   'Museum',
        'nav.labo':    'Lab',
        'nav.bar':     'Bar',
        'nav.shop':    'Shop',

        // HUD
        'hud.role': 'Doctor',

        // Profil — carte principale
        'profile.my_profile':       'My Profile',
        'profile.performance':      'Performance',
        'profile.incubator_alerts': 'Incubator Alerts',
        'profile.notify_from':      'Notify from:',
        'profile.tier.uncommon':    'Uncommon',
        'profile.tier.rare':        'Rare',
        'profile.tier.epic':        'Epic',
        'profile.tier.legendary':   'Legendary',
        'profile.reset_data':       '⚠ Reset data',
        'profile.language':         'Language',

        // Panneau paramètres (in-game)
        'settings.back':           'Back',
        'settings.avatar':         'Avatar',
        'settings.display_name':   'Display name',
        'settings.name_ph':        'Your username...',
        'settings.save':           'Save',
        'settings.visual_quality': 'Visual quality',
        'settings.economy':        'Economy',
        'settings.max_fluidity':   'Maximum fluidity',
        'settings.balanced':       'Balanced',
        'settings.recommended':    'Recommended',
        'settings.quality':        'Quality',
        'settings.high_end':       'High-end',
        'settings.auto_detect':    'Auto-detect',

        // Modal reset (in-game)
        'reset.title':   'Reset',
        'reset.body':    'All your data will be <span class="text-red-400 font-bold">permanently deleted</span> — slimes, progress, collection. This action is irreversible.',
        'reset.confirm': 'Erase all',
        'reset.cancel':  'Cancel',

        // Modal redémarrage traduction
        'lang.restart_title': 'Restart required',
        'lang.restart_body':  'The game will restart to apply the translation.',

        // Title-screen (paramètres)
        'ts.subtitle':         'Virtual Incubator',
        'ts.ready':            'Ready to play',
        'ts.offline':          'Offline mode active',
        'ts.wake':             'WAKE THE SLIME',
        'ts.settings':         'Settings',
        'ts.sound':            'Sound',
        'ts.master':           'Master volume',
        'ts.music':            'Music',
        'ts.sfx':              'Sound effects',
        'ts.display':          'Display',
        'ts.graphics_quality': 'Graphics quality',
        'ts.battery':          'Battery impact',
        'ts.q_low':            'Low',
        'ts.q_mid':            'Med',
        'ts.q_high':           'High',
        'ts.fps_counter':      'FPS Counter',
        'ts.fps_sub':          'Display frames per second',
        'ts.reduce_anim':      'Reduce animations',
        'ts.reduce_anim_sub':  'Accessibility & battery saving',
        'ts.gameplay':         'Gameplay',
        'ts.vibrations':       'Vibrations',
        'ts.vibrations_sub':   'Haptic feedback on actions',
        'ts.notifications':    'Notifications',
        'ts.notif_sub':        'Slime progression alerts',
        'ts.language':         'Language',
        'ts.language_sub':     'Interface localization',
        'ts.data':             'Data',
        'ts.data_info':        'Version <span style="color:#34d399;font-weight:800;">v0.1.0</span> · <span style="color:#34d399;font-weight:800;">OFFLINE</span> Mode<br>Data stored locally on device.',
        'ts.erase_data':       'Erase all data',
        'ts.erase_sub':        'Slimes, progress, collection — irreversible',
        'ts.reset_title':      'Reset',
        'ts.reset_body':       'All data will be <strong>permanently deleted</strong> — slimes, progress, collection. This action is irreversible.',
        'ts.erase_all':        'Erase all',
        'ts.cancel':           'Cancel',
        'ts.lang_restart':     'Restarting…',
        'ts.loading_1':        'DNA Synchronization...',
        'ts.loading_2':        'Loading the lab...',
        'ts.loading_3':        'Waking the slime...',

        // Panneau archive / storage
        'storage.collection':       'Collection',
        'storage.archive_title':    'Archive',
        'storage.team_tab':         'Team',
        'storage.archive_tab':      'Archive',
        'storage.team_active':      'Active team',
        'storage.box':              'Box',
        'storage.rarity':           'Rarity',
        'storage.level':            'Lvl.',
        'storage.type':             'Type',
        'storage.sell_zone_aria':   'Sell basket',
        'storage.sell_label':       'Sell',
        'storage.sell_modal_title': 'Sale',
        'storage.irreversible':     'This action is irreversible.',
        'storage.cancel':           'Cancel',
        'storage.sell_confirm':     'Sell',
        'storage.profile_eyebrow':  'Profile',
        'storage.specimen':         'Specimen',
        'storage.close_aria':       'Close archive',
        'storage.prev_aria':        'Previous box',
        'storage.next_aria':        'Next box',
        'storage.nav_aria':         'Navigation and sort',
        'storage.resize_aria':      'Resize storage',
        'storage.close_detail_aria':'Close file',

        // Notifications rareté
        'notif.title': 'Incubator',
        'notif.body':  '{label} Slime available!',
        'notif.close': 'Close',

        // Labels rareté
        'rarity.common':    'Common',
        'rarity.uncommon':  'Uncommon',
        'rarity.rare':      'Rare',
        'rarity.epic':      'Epic',
        'rarity.legendary': 'Legendary',

        // Storage — remaining hardcoded strings
        'storage.sections_aria':        'Archive sections',
        'storage.confirm_sell_aria':    'Confirm sale',
        'storage.slime_file_aria':      'Slime file',
        'storage.specimen_name_ph':     'Specimen name…',
        'storage.save_name_aria':       'Save name',
        'storage.page':                 'Page',
        'storage.slot_level':           'level',

        // Storage — sandbox preview
        'sandbox.unavailable':          'Preview unavailable',
        'sandbox.canvas_aria':          'Interactive slime preview',

        // Prairie
        'prairie.canvas_aria':          'Slime prairie',
        'prairie.minimap_aria':         'Prairie minimap',
        'prairie.open_storage_aria':    'Open storage',
        'prairie.close_storage_aria':   'Close storage',
        'prairie.resize_storage_aria':  'Resize storage',
        'prairie.observe_aria':         'Observe the Inkübus',
        'prairie.remove_slime_aria':    'Remove slime from prairie',
        'prairie.deploy_slime_aria':    'Deploy slime to prairie',
        'prairie.no_interaction':       'No interaction yet...',

        // Profile modal (hardcoded)
        'profile.my_profile_title':     'My Profile',
        'profile.performance_title':    'Performance',

        // Incubator template
        'incubator.open_archive_aria':  'Open entity archive',

        // Incubator — status labels
        'incubator.status.idle':            'WAITING...',
        'incubator.status.staging':         'SIGNAL DETECTED',
        'incubator.status.intake':          'ANALYSIS IN PROGRESS',
        'incubator.status.suspended':       'ENTITY STABILISED',
        'incubator.status.purchasePending': 'TRANSFER...',
        'incubator.status.purchased':       'ADOPTED!',
        'incubator.status.purging':         'RELEASING...',
        'incubator.status.purged':          'CHAMBER EMPTY',
        'incubator.status.error':           'CRITICAL ANOMALY',

        // Incubator — toasts
        'incubator.toast.insufficient_funds': 'Insufficient funds — you need {price} ⬡',
        'incubator.toast.storage_full':       'All boxes are full!',

        // Incubator — entity fallback name
        'incubator.entity_fallback':    'ENTITY',
        'incubator.no_entity':          'NO ENTITY',
        'incubator.price_label':        'PRICE',
        'incubator.archive_label':      'ARCHIVE',
        'incubator.entities_label':     'ENTITIES',

        // Incubator — pattern names (badge, mixed case)
        'pattern.solid':          'Solid',
        'pattern.radial_glow':    'Glow',
        'pattern.gradient_v':     'Gradient ↕',
        'pattern.gradient_h':     'Gradient ↔',
        'pattern.gradient_diag':  'Gradient ↗',
        'pattern.duo_tone':       'Duo',
        'pattern.soft_spots':     'Spots',
        'pattern.stripe_v':       'Stripes',
        'pattern.galaxy_swirl':   'Galaxy',
        'pattern.aurora':         'Aurora',
        'pattern.crystal_facets': 'Crystal',
        'pattern.prismatic':      'Prismatic',
        'pattern.void_rift':      'Rift',

        // ── Tutorial ──────────────────────────────────────────────────────
        'tuto.skip':                    'Skip tutorial',
        'tuto.next':                    'Next →',
        'tuto.start':                   'Let\'s go!',
        'tuto.restart':                 'Replay tutorial',
        'tuto.restart_sub':             'Go through all steps again from the beginning',
        'tuto.step_of':                 'Step {n} of {total}',

        // Step 0 — Language
        'tuto.lang.title':              'Choose your language',
        'tuto.lang.body':               'Select the interface language. You can change this later in settings.',
        'tuto.lang.fr':                 '🇫🇷 Français',
        'tuto.lang.en':                 '🇬🇧 English',

        // Step 1 — Currency
        'tuto.money.title':             'Inkübits ⬡',
        'tuto.money.body':              '<strong>Inkübits</strong> are the game\'s blue currency — your total is shown in the top-right corner.\n\nYour goal: grow your team of Inkübs (slimes) to generate as many as possible per minute. The more active Inkübs you have in the prairie, the more you earn!',

        // Step 2 — Buy a slime
        'tuto.buy.title':               'Buy an Inkübs 🧪',
        'tuto.buy.body':                'In the <strong>Lab</strong>, an incubator continuously generates new Inkübs.\n\nThe price in Inkübits ⬡ is displayed just above the buy button.\n• <span style="color:#4ade80;font-weight:700;">Green</span> button = you can afford it!\n• <span style="color:#f87171;font-weight:700;">Red</span> button = not enough Inkübits.\n\nEach purchased Inkübs is stored in your storage box.',

        // Step 3 — Storage box
        'tuto.storage.title':           'The Storage Box 📦',
        'tuto.storage.body':            'All your purchased Inkübs appear in the <strong>storage box</strong> (grid icon in the top-right of the prairie or lab).\n\nTap an Inkübs to open its detail sheet — stats, genome, interactive preview.\nTap outside the sheet to close it.',

        // Step 4 — Prairie
        'tuto.prairie.title':           'The Prairie 🌿',
        'tuto.prairie.body':            'Deploy your Inkübs into the <strong>Prairie</strong> so they generate Inkübits per minute.\n\nThey interact with each other in real time: some get along well and boost each other\'s stats, others clash and reduce them.\n\nUse the <strong>magnifier 🔍</strong> in the top-right to enter Observation mode: then tap an Inkübs to see its XP level and current interactions.',

        // Step 5 — Level & Advanced loupe
        'tuto.level.title':             'Levels & Affinities ⭐',
        'tuto.level.body':              'When <strong>3 stats reach their maximum</strong>, the Inkübs gains a level — it becomes more powerful and generates more Inkübits.\n\nIn the magnifier, the <strong>second panel</strong> shows detailed stats by domain and affinities: the relationship percentage with each Inkübs present is listed from highest to lowest (top 5).\n\nYou can clear the affinity history with the Inkübs currently in the prairie using the dedicated button.',
    },
};
