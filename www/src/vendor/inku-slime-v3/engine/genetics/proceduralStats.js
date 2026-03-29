function clampStat(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export const PROCEDURAL_STATS_SCHEMA_VERSION = 2;

export function buildProceduralStats({ type, baseRadius, genome }) {
  const sizeFactor = baseRadius / 80;
  const mood  = genome.mood;
  const shape = genome.bodyShape;

  let vitality  = 60 + sizeFactor * 18;
  let agility   = 55 + (1 - sizeFactor) * 10;
  let stability = 52 + genome.rigidity * 140;
  let curiosity = 50;
  let empathy   = 50;
  let ferocity  = type === 'scary' ? 62 : (type === 'cute' ? 38 : 50);

  // Shape modifiers (legacy)
  if (shape === 'puff' || shape === 'round')     vitality  += 6;
  if (shape === 'wisp' || shape === 'comet')     agility   += 8;
  if (shape === 'dumpling' || shape === 'bell')  stability += 7;
  if (shape === 'blob' || shape === 'puddle')    empathy   += 5;
  // New shape modifiers
  if (shape === 'crystal')   { stability += 10; vitality  += 4; }
  if (shape === 'ribbon')    { agility   += 6;  empathy   += 4; }
  if (shape === 'lantern')   { curiosity += 8;  vitality  += 3; }
  if (shape === 'crescent')  { agility   += 5;  ferocity  += 4; }
  if (shape === 'star_body') { ferocity  += 6;  vitality  += 5; }
  if (shape === 'diamond')   { stability += 12; }
  if (shape === 'twin_lobe') { empathy   += 8;  curiosity += 5; }
  if (shape === 'fractal')   { curiosity += 14; stability += 4; agility += 4; }
  if (shape === 'aurora_form'){ curiosity += 10; empathy  += 8; agility += 6; }

  // Mood modifiers (legacy + new)
  if (mood === 'curious' || mood === 'study') curiosity += 14;
  if (mood === 'joyful')      empathy   += 8;
  if (mood === 'grumpy')      ferocity  += 10;
  if (mood === 'mischief')    agility   += 6;
  if (mood === 'sleepy')      vitality  -= 4;
  if (mood === 'dreamy')      curiosity += 6;
  if (mood === 'lovesick')    empathy   += 12;
  if (mood === 'proud')       stability += 8;
  if (mood === 'melancholy')  curiosity += 10;
  if (mood === 'frenzied')    { agility += 12; stability -= 8; ferocity += 8; }
  if (mood === 'enlightened') { curiosity += 18; empathy += 12; vitality += 6; }

  // Rarity bonus: legendary/epic slimes get a small stat lift
  const rarityTier = genome.rarityTier || 'common';
  const rarityBonus = { common:0, uncommon:2, rare:4, super_rare:7, legend:11, divin:16 }[rarityTier] || 0;
  vitality  += rarityBonus * 0.6;
  curiosity += rarityBonus * 0.8;
  empathy   += rarityBonus * 0.4;

  // Instable override: antisocial, violent, chaotic — gains stats slowly
  if (genome.isInstable) {
    stability = Math.max(1,   stability - 32);  // extremely unstable
    empathy   = Math.max(1,   empathy   - 38);  // almost no empathy
    ferocity  = Math.min(100, ferocity  + 35);  // very ferocious
    curiosity = Math.max(1,   curiosity - 12);  // not curious
    vitality  = Math.min(100, vitality  + 6);   // slightly tougher
  }

  return {
    schemaVersion: PROCEDURAL_STATS_SCHEMA_VERSION,
    vitality:  clampStat(Math.round(vitality),  1, 100),
    agility:   clampStat(Math.round(agility),   1, 100),
    stability: clampStat(Math.round(stability), 1, 100),
    curiosity: clampStat(Math.round(curiosity), 1, 100),
    empathy:   clampStat(Math.round(empathy),   1, 100),
    ferocity:  clampStat(Math.round(ferocity),  1, 100),
    rarityTier,
    rarityScore: genome.rarityScore || 0
  };
}
