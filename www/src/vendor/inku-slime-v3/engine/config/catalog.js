export const SLIME_TYPES = ['cute', 'normal', 'scary', 'instable'];
import { t } from '../../../../i18n/i18n.js';

// ─── BODY SHAPES ─────────────────────────────────────────────────────────────
export const BODY_SHAPES = [
  'round','pear','dumpling','blob','teardrop','mochi',
  'puff','wisp','jellybean','bell','comet','puddle',
  'crystal','ribbon','lantern','crescent',
  'star_body','diamond','twin_lobe',
  'fractal','aurora_form',
  'unstable_form'  // Instable slimes only — never picked by random generation
];

export const BODY_SHAPE_WEIGHTS = {
  round:12,pear:11,dumpling:11,blob:10,teardrop:10,mochi:10,
  puff:8,wisp:7,jellybean:7,bell:7,comet:6,puddle:6,
  crystal:4,ribbon:3,lantern:3,crescent:3,
  star_body:1.5,diamond:1.2,twin_lobe:1.0,
  fractal:0.35,aurora_form:0.25
};

// ─── EYE POOLS (weighted) ────────────────────────────────────────────────────
export const EYE_POOLS = {
  cute: [
    {id:'dot',w:12},{id:'sparkle',w:10},{id:'big_round',w:10},
    {id:'sleepy',w:9},{id:'happy_arc',w:9},{id:'heart',w:8},
    {id:'droplet',w:6},{id:'star_eye',w:5},{id:'twin_spark',w:5},
    {id:'rainbow_iris',w:3},{id:'crystal_eye',w:2.5},
    {id:'galaxy_eye',w:1},
    // New eyes
    {id:'shiny_round',w:8},{id:'mascara',w:6},{id:'pupil_star',w:5},
    {id:'number_3',w:4},{id:'cat_slit',w:3},{id:'glowing',w:3},
    {id:'loading',w:1}
  ],
  normal:[
    {id:'dot',w:12},{id:'big_round',w:10},{id:'sleepy',w:9},
    {id:'wide',w:9},{id:'wink',w:8},{id:'half_lid',w:7},
    {id:'uneven',w:6},{id:'monocle',w:5},{id:'button',w:5},
    {id:'tearful',w:3},{id:'crystal_eye',w:2},
    {id:'galaxy_eye',w:0.8},
    // New eyes
    {id:'cat_slit',w:6},{id:'tired',w:6},{id:'cross',w:4},
    {id:'square',w:3},{id:'sus',w:3},{id:'dollar',w:2},
    {id:'omega',w:1.5},{id:'loading',w:1}
  ],
  scary:[
    {id:'slit',w:12},{id:'angry_arc',w:10},{id:'void',w:9},
    {id:'wide',w:9},{id:'spiral',w:7},{id:'half_lid',w:6},
    {id:'X_eye',w:5},{id:'abyss',w:4},{id:'flame_eye',w:3},
    {id:'bleeding_eye',w:2},{id:'galaxy_eye',w:0.8},
    // New eyes
    {id:'triangle_eye',w:7},{id:'cat_slit',w:6},{id:'cross',w:5},
    {id:'glowing',w:4},{id:'omega',w:3},{id:'square',w:2},
    {id:'loading',w:1}
  ],
  instable:[
    // Dark, threatening, unsettling — the most disturbing eyes
    {id:'void',w:12},{id:'abyss',w:11},{id:'spiral',w:9},
    {id:'flame_eye',w:8},{id:'X_eye',w:7},{id:'bleeding_eye',w:6},
    {id:'slit',w:5},{id:'angry_arc',w:4},{id:'glowing',w:3},
    {id:'triangle_eye',w:4},{id:'omega',w:3},{id:'cat_slit',w:2}
  ]
};

// ─── MOUTH POOLS (weighted) ───────────────────────────────────────────────────
export const MOUTH_POOLS = {
  cute:[
    {id:'smile',w:12},{id:'cat',w:10},{id:'tiny_o',w:10},
    {id:'grin',w:9},{id:'open_smile',w:9},{id:'pout',w:8},
    {id:'bubble',w:5},{id:'kiss',w:5},{id:'candy_smile',w:4},
    {id:'laugh_open',w:3},{id:'starfish_mouth',w:1.5}
  ],
  normal:[
    {id:'smile',w:12},{id:'smirk',w:10},{id:'flat',w:10},
    {id:'tiny_o',w:9},{id:'open_smile',w:9},{id:'tiny_frown',w:8},
    {id:'whistle',w:5},{id:'chew',w:5},{id:'hmm',w:4},
    {id:'laugh_open',w:3},{id:'starfish_mouth',w:1.2}
  ],
  scary:[
    {id:'fangs',w:12},{id:'zigzag',w:10},{id:'smirk',w:9},
    {id:'flat',w:9},{id:'toothy',w:8},{id:'squiggle',w:7},
    {id:'drool',w:5},{id:'wide_gape',w:4},{id:'venom_drip',w:3},
    {id:'abyss_mouth',w:1.5},{id:'starfish_mouth',w:1}
  ],
  instable:[
    // Repulsive, threatening — no cute options
    {id:'fangs',w:12},{id:'venom_drip',w:11},{id:'wide_gape',w:10},
    {id:'abyss_mouth',w:8},{id:'zigzag',w:7},{id:'drool',w:7},
    {id:'toothy',w:5},{id:'squiggle',w:4}
  ]
};

// ─── MOODS (weighted) ────────────────────────────────────────────────────────
export const MOODS = [
  {id:'calm',w:12},{id:'joyful',w:11},{id:'sleepy',w:10},
  {id:'mischief',w:9},{id:'grumpy',w:9},{id:'curious',w:9},
  {id:'shy',w:8},{id:'dreamy',w:8},{id:'smug',w:7},
  {id:'dizzy',w:7},{id:'lovesick',w:5},{id:'proud',w:5},
  {id:'melancholy',w:4},{id:'frenzied',w:3},{id:'enlightened',w:1}
];

// ─── DETAIL TRAITS (weighted) ─────────────────────────────────────────────────
export const DETAIL_TRAITS = [
  {id:'none',w:14},
  {id:'freckles',w:9},{id:'blush',w:9},{id:'brow',w:8},
  {id:'speckles',w:8},{id:'shine_plus',w:8},{id:'lashes',w:7},
  {id:'under_eyes',w:7},{id:'cheek_marks',w:6},
  {id:'war_paint',w:4},{id:'glitter',w:4},{id:'rune_mark',w:3},
  {id:'circuit',w:2},{id:'constellation',w:1.5}
];

// ─── ACCESSORY POOLS (weighted) ───────────────────────────────────────────────
export const ACCESSORY_POOLS = {
  cute:[
    {id:'none',w:14},{id:'bow',w:10},{id:'flower',w:10},
    {id:'sprout',w:9},{id:'star_pin',w:9},{id:'halo',w:8},{id:'clover',w:8},
    {id:'ribbon_bow',w:6},{id:'mini_crown',w:5},
    {id:'candy_pin',w:5},{id:'cloud_puff',w:5},{id:'cherry_clip',w:4},
    {id:'crystal_tiara',w:3},{id:'rainbow_halo',w:2.5},{id:'petal_wreath',w:2},
    {id:'fairy_wings',w:1.2},{id:'starfall_crown',w:0.8},
    {id:'celestial_halo',w:0.3},
    // Cosplay
    {id:'cat_ears',w:9},{id:'bunny_ears',w:8},{id:'dog_ears',w:7},
    {id:'fox_ears',w:6},{id:'maid_headband',w:5},{id:'witch_hat',w:4},
    {id:'pizza_slice',w:3},{id:'oni_horns',w:2}
  ],
  normal:[
    {id:'none',w:14},{id:'leaf',w:10},{id:'sprout',w:9},
    {id:'mushroom',w:9},{id:'antenna',w:8},{id:'feather',w:8},{id:'shell_pin',w:7},
    {id:'twig',w:6},{id:'bandana',w:5},{id:'monocle_top',w:5},
    {id:'lantern_float',w:4},{id:'beret',w:4},
    {id:'ancient_rune',w:3},{id:'gem_cluster',w:2.5},{id:'wind_streamer',w:2},
    {id:'spirit_orbs',w:1},{id:'starfall_crown',w:0.7},
    {id:'celestial_halo',w:0.3},
    // Cosplay
    {id:'cat_ears',w:7},{id:'dog_ears',w:7},{id:'fox_ears',w:6},
    {id:'ninja_headband',w:6},{id:'blindfold',w:5},{id:'katana',w:5},
    {id:'pizza_slice',w:4},{id:'witch_hat',w:4},{id:'dragon_wings',w:3},
    {id:'bunny_ears',w:3},{id:'maid_headband',w:2}
  ],
  scary:[
    {id:'none',w:14},{id:'horns',w:10},{id:'crown',w:9},
    {id:'spikes',w:9},{id:'antenna',w:8},{id:'bone_pin',w:8},{id:'broken_halo',w:7},
    {id:'thorn_ring',w:6},{id:'skull_pin',w:5},{id:'iron_mask',w:5},
    {id:'eye_crown',w:4},{id:'cursed_chain',w:4},
    {id:'demon_wings',w:3},{id:'void_crown',w:2.5},{id:'shadow_cloak',w:1.5},
    {id:'eldritch_eye',w:1},{id:'starfall_crown',w:0.7},
    {id:'celestial_halo',w:0.3},
    // Cosplay
    {id:'oni_horns',w:9},{id:'katana',w:8},{id:'blindfold',w:7},
    {id:'ninja_headband',w:6},{id:'dragon_wings',w:6},{id:'witch_hat',w:5},
    {id:'fox_ears',w:4},{id:'cat_ears',w:3},{id:'pizza_slice',w:2}
  ],
  instable:[
    // Mostly bare — these slimes don't adorn themselves
    {id:'none',w:24},
    {id:'horns',w:10},{id:'spikes',w:9},{id:'bone_pin',w:7},{id:'broken_halo',w:6},
    {id:'thorn_ring',w:5},{id:'skull_pin',w:4},{id:'iron_mask',w:4},
    {id:'void_crown',w:3},{id:'cursed_chain',w:3},{id:'eldritch_eye',w:2},
    {id:'shadow_cloak',w:2},{id:'demon_wings',w:1.5}
  ]
};

// ─── COLOR PATTERNS (weighted) ────────────────────────────────────────────────
export const COLOR_PATTERNS = [
  {id:'solid',w:18},
  {id:'radial_glow',w:10},
  {id:'gradient_v',w:7},{id:'gradient_h',w:7},{id:'gradient_diag',w:6},
  {id:'duo_tone',w:4},{id:'soft_spots',w:3.5},{id:'stripe_v',w:3},
  {id:'galaxy_swirl',w:1.5},{id:'aurora',w:1.2},{id:'crystal_facets',w:1},
  {id:'prismatic',w:0.4},{id:'void_rift',w:0.3}
];

// ─── RARITY TIERS ────────────────────────────────────────────────────────────
export const RARITY_TIERS = {
  common:   { get label() { return t('rarity.common');    }, color:'#a0a0a0', scoreMin:0,  scoreMax:29  },
  uncommon: { get label() { return t('rarity.uncommon');  }, color:'#4caf50', scoreMin:30, scoreMax:54  },
  rare:     { get label() { return t('rarity.rare');      }, color:'#2196f3', scoreMin:55, scoreMax:74  },
  epic:     { get label() { return t('rarity.epic');      }, color:'#9c27b0', scoreMin:75, scoreMax:89  },
  legendary:{ get label() { return t('rarity.legendary'); }, color:'#ff9800', scoreMin:90, scoreMax:100 },
  instable: { get label() { return t('rarity.instable');  }, color:'#ff3333', scoreMin:0,  scoreMax:100 },
};

// ─── ACTIONS ──────────────────────────────────────────────────────────────────
export const ACTIONS = ['attack','hurt','observe','flee','question','study'];
