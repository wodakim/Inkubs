const SVG_NS = 'http://www.w3.org/2000/svg';

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC ENTRY
// ─────────────────────────────────────────────────────────────────────────────
export function buildCanonicalPortraitSvg(record, {
    size = 96,
    className = 'storage-canonical-portrait',
    variant = 'slot',
    includePlate = false,
    includeGlow = true,
} = {}) {
    if (!record || typeof record !== 'object') {
        return '<div class="storage-canonical-portrait storage-canonical-portrait--empty"></div>';
    }

    const genome       = record.proceduralCore?.genome || {};
    const bodyProfile  = record.proceduralCore?.bodyProfile || {};
    const baseRadius   = clampNumber(record.proceduralCore?.baseRadius, 40, 10, 120);
    const hue          = clampNumber(genome.hue,        180, 0, 360);
    const sat          = clampNumber(genome.saturation,  88, 0, 100);
    const lit          = clampNumber(genome.lightness,   62, 0, 100);
    const hue2         = clampNumber(genome.hue2,       (hue + 90) % 360, 0, 360);
    const sat2         = clampNumber(genome.sat2,        sat, 0, 100);
    const lit2         = clampNumber(genome.lit2,        lit, 0, 100);
    const darkLit      = Math.max(12, lit - 16);
    const highLit      = Math.min(96, lit + 18);
    const bodyShape    = token(genome.bodyShape  || record.storageDisplay?.bodyShape || 'round');
    const eyeStyle     = token(genome.eyeStyle   || 'dot');
    const mouthStyle   = token(genome.mouthStyle || 'smile');
    const accessory    = token(genome.accessory  || 'none');
    const colorPattern = token(genome.colorPattern || 'solid');
    const rarityTier   = token(genome.rarityTier || record.storageDisplay?.rarity || 'common');

    const variantClass = variant === 'hero'
        ? 'storage-canonical-portrait--hero'
        : 'storage-canonical-portrait--slot';
    const uid       = `cv_${Math.random().toString(36).slice(2, 10)}`;
    const viewBoxSize = 120;
    const centerX   = 60;
    const centerY   = variant === 'hero' ? 66 : 64;
    const scale     = variant === 'hero' ? 1.04 : 0.88;

    const points     = buildBodyPoints({ baseRadius, bodyProfile, centerX, centerY, bodyShape, scale });
    const pathData   = buildSmoothPath(points);
    const faceAnchor = deriveFaceAnchor(points, centerX, centerY, baseRadius, bodyShape, variant);

    const accessoryMarkup = renderAccessorySvg({ accessory, baseRadius, centerX, centerY, points, uid, variant });
    const eyeMarkup       = renderEyeMarkup({ eyeStyle, faceAnchor, uid });
    const mouthMarkup     = renderMouthMarkup({ mouthStyle, faceAnchor, uid });

    const plateMarkup = includePlate
        ? `<ellipse cx="60" cy="108" rx="28" ry="3.6" fill="rgba(94,234,212,0.28)" />`
        : '';
    const glowMarkup = includeGlow
        ? `<ellipse cx="60" cy="74" rx="34" ry="28" fill="hsla(${hue} 100% 70% / 0.14)" />`
        : '';

    // ── Rarity glow ring around the portrait ────────────────────────────────
    const rarityRingMarkup = buildRarityRing(uid, rarityTier, centerX, centerY, baseRadius, scale);

    // ── Body gradient defs based on colorPattern ─────────────────────────────
    const bodyGradientDef = buildBodyGradientDef({ uid, colorPattern, hue, sat, lit, darkLit, highLit, hue2, sat2, lit2 });
    const bodyOverlayMarkup = buildBodyOverlaySvg({ colorPattern, uid, centerX, centerY, baseRadius, scale, pathData });

    return `
        <svg class="${escapeHtml(className)} ${variantClass}" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
            <defs>
                ${bodyGradientDef}
                <radialGradient id="${uid}_shine" cx="28%" cy="20%" r="38%">
                    <stop offset="0%"   stop-color="hsla(${hue} ${Math.max(30, sat - 10)}% ${highLit}% / 0.9)" />
                    <stop offset="100%" stop-color="transparent" />
                </radialGradient>
                <filter id="${uid}_softGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="4.2" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <clipPath id="${uid}_bodyClip">
                    <path d="${pathData}" />
                </clipPath>
            </defs>
            ${glowMarkup}
            ${plateMarkup}
            ${rarityRingMarkup}
            <g filter="url(#${uid}_softGlow)">
                <path d="${pathData}" fill="url(#${uid}_body)" stroke="hsla(${hue} 100% 82% / 0.28)" stroke-width="1.2" />
            </g>
            <g clip-path="url(#${uid}_bodyClip)">
                ${bodyOverlayMarkup}
                <ellipse cx="${round(centerX - baseRadius * 0.24 * scale)}" cy="${round(centerY - baseRadius * 0.28 * scale)}" rx="${round(baseRadius * 0.42 * scale)}" ry="${round(baseRadius * 0.28 * scale)}" fill="url(#${uid}_shine)" opacity="0.92" />
                <ellipse cx="${round(centerX + baseRadius * 0.14 * scale)}" cy="${round(centerY + baseRadius * 0.44 * scale)}" rx="${round(baseRadius * 0.66 * scale)}" ry="${round(baseRadius * 0.38 * scale)}" fill="rgba(0,0,0,0.12)" opacity="0.34" />
            </g>
            ${accessoryMarkup}
            <g class="storage-canonical-portrait__face">
                ${eyeMarkup}
                ${mouthMarkup}
            </g>
        </svg>
    `.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
//  RARITY RING
// ─────────────────────────────────────────────────────────────────────────────
function buildRarityRing(uid, rarityTier, cx, cy, baseRadius, scale) {
    const configs = {
        legendary: { color: '#ff9800', glow: 'rgba(255,152,0,0.55)', dash: '4 2', width: 2.2, opacity: 0.92 },
        épique:    { color: '#9c27b0', glow: 'rgba(156,39,176,0.4)', dash: '3 3', width: 1.8, opacity: 0.85 },
        epic:      { color: '#9c27b0', glow: 'rgba(156,39,176,0.4)', dash: '3 3', width: 1.8, opacity: 0.85 },
        rare:      { color: '#2196f3', glow: 'rgba(33,150,243,0.35)', dash: 'none', width: 1.6, opacity: 0.75 },
        uncommon:  { color: '#4caf50', glow: null, dash: 'none', width: 1.2, opacity: 0.6 },
    };
    const tier = rarityTier.toLowerCase().replace('légendaire', 'legendary').replace('peu commun', 'uncommon');
    const cfg = configs[tier];
    if (!cfg) return '';

    const r = round(baseRadius * scale + 6);
    const dashAttr = cfg.dash !== 'none' ? `stroke-dasharray="${cfg.dash}"` : '';
    const glowCircle = cfg.glow
        ? `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="${cfg.glow}" stroke-width="${cfg.width + 3}" opacity="0.5" />`
        : '';
    return `
        ${glowCircle}
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${cfg.color}" stroke-width="${cfg.width}" ${dashAttr} opacity="${cfg.opacity}" />
    `;
}

// ─────────────────────────────────────────────────────────────────────────────
//  BODY GRADIENT DEFS
// ─────────────────────────────────────────────────────────────────────────────
function buildBodyGradientDef({ uid, colorPattern, hue, sat, lit, darkLit, highLit, hue2, sat2, lit2 }) {
    const id = `${uid}_body`;
    const c1 = `hsl(${hue} ${sat}% ${lit}%)`;
    const c2 = `hsl(${hue} ${Math.max(35, sat - 8)}% ${darkLit}%)`;
    const c3 = `hsl(${hue2} ${sat2}% ${lit2}%)`;
    const bright = `hsl(${hue} ${Math.min(100, sat + 10)}% ${Math.min(94, lit + 10)}%)`;

    if (colorPattern === 'solid' || colorPattern === 'radial_glow') {
        const midLit  = colorPattern === 'radial_glow' ? Math.min(94, lit + 12) : lit;
        return `<radialGradient id="${id}" cx="32%" cy="26%" r="78%">
            <stop offset="0%"   stop-color="hsl(${hue} ${sat}% ${midLit}%)" />
            <stop offset="52%"  stop-color="${c1}" />
            <stop offset="100%" stop-color="${c2}" />
        </radialGradient>`;
    }

    if (colorPattern === 'gradient_v') {
        return `<linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stop-color="${c1}" />
            <stop offset="100%" stop-color="${c2}" />
        </linearGradient>`;
    }
    if (colorPattern === 'gradient_h') {
        return `<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color="${c1}" />
            <stop offset="100%" stop-color="${c2}" />
        </linearGradient>`;
    }
    if (colorPattern === 'gradient_diag') {
        return `<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stop-color="${c1}" />
            <stop offset="100%" stop-color="${c2}" />
        </linearGradient>`;
    }

    if (colorPattern === 'duo_tone') {
        return `<linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stop-color="${c1}" />
            <stop offset="50%"  stop-color="${c3}" />
            <stop offset="100%" stop-color="hsl(${hue2} ${Math.max(35, sat2 - 8)}% ${Math.max(12, lit2 - 16)}%)" />
        </linearGradient>`;
    }

    if (colorPattern === 'stripe_v') {
        return `<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color="${c1}" />
            <stop offset="25%"  stop-color="${c3}" />
            <stop offset="50%"  stop-color="${c1}" />
            <stop offset="75%"  stop-color="${c3}" />
            <stop offset="100%" stop-color="${c1}" />
        </linearGradient>`;
    }

    if (colorPattern === 'galaxy_swirl') {
        return `<radialGradient id="${id}" cx="50%" cy="50%" r="72%">
            <stop offset="0%"   stop-color="hsl(${(hue + 200) % 360} 90% 85%)" />
            <stop offset="28%"  stop-color="${c3}" />
            <stop offset="62%"  stop-color="${c1}" />
            <stop offset="100%" stop-color="${c2}" />
        </radialGradient>`;
    }

    if (colorPattern === 'aurora') {
        return `<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stop-color="hsl(${(hue + 140) % 360} ${sat}% ${Math.min(90, lit + 10)}%)" />
            <stop offset="33%"  stop-color="${c1}" />
            <stop offset="66%"  stop-color="${c3}" />
            <stop offset="100%" stop-color="hsl(${(hue + 280) % 360} ${sat}% ${Math.min(90, lit + 5)}%)" />
        </linearGradient>`;
    }

    if (colorPattern === 'crystal_facets') {
        return `<radialGradient id="${id}" cx="28%" cy="22%" r="76%">
            <stop offset="0%"   stop-color="hsla(${hue} ${Math.min(100, sat + 10)}% ${Math.min(95, lit + 20)}% / 0.95)" />
            <stop offset="40%"  stop-color="${c1}" />
            <stop offset="80%"  stop-color="${c3}" />
            <stop offset="100%" stop-color="${c2}" />
        </radialGradient>`;
    }

    if (colorPattern === 'soft_spots') {
        return `<radialGradient id="${id}" cx="50%" cy="50%" r="68%">
            <stop offset="0%"   stop-color="${c3}" />
            <stop offset="60%"  stop-color="${c1}" />
            <stop offset="100%" stop-color="${c2}" />
        </radialGradient>`;
    }

    if (colorPattern === 'prismatic') {
        return `<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"    stop-color="hsl(0   85% ${lit}%)" />
            <stop offset="16.6%" stop-color="hsl(60  85% ${lit}%)" />
            <stop offset="33.3%" stop-color="hsl(120 85% ${lit}%)" />
            <stop offset="50%"   stop-color="hsl(180 85% ${lit}%)" />
            <stop offset="66.6%" stop-color="hsl(240 85% ${lit}%)" />
            <stop offset="83.3%" stop-color="hsl(300 85% ${lit}%)" />
            <stop offset="100%"  stop-color="hsl(360 85% ${lit}%)" />
        </linearGradient>`;
    }

    if (colorPattern === 'void_rift') {
        return `<radialGradient id="${id}" cx="50%" cy="50%" r="72%">
            <stop offset="0%"   stop-color="hsl(${hue} 30% 8%)" />
            <stop offset="30%"  stop-color="hsl(${hue} 70% 20%)" />
            <stop offset="70%"  stop-color="${c1}" />
            <stop offset="100%" stop-color="hsl(${(hue + 180) % 360} ${sat}% ${lit}%)" />
        </radialGradient>`;
    }

    // Fallback radial
    return `<radialGradient id="${id}" cx="32%" cy="26%" r="78%">
        <stop offset="0%"   stop-color="hsl(${hue} ${sat}% ${Math.min(94, lit + 10)}%)" />
        <stop offset="52%"  stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
    </radialGradient>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  BODY OVERLAY (drawn inside clip)
// ─────────────────────────────────────────────────────────────────────────────
function buildBodyOverlaySvg({ colorPattern, uid, centerX, centerY, baseRadius, scale, pathData }) {
    const r = baseRadius * scale;
    if (colorPattern === 'crystal_facets') {
        let lines = '';
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            lines += `<line x1="${round(centerX)}" y1="${round(centerY)}" x2="${round(centerX + Math.cos(a) * r * 0.9)}" y2="${round(centerY + Math.sin(a) * r * 0.9)}" stroke="rgba(255,255,255,0.18)" stroke-width="1" />`;
        }
        return lines;
    }
    if (colorPattern === 'soft_spots') {
        let circles = '';
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + 0.3;
            const rr = r * (0.3 + i * 0.08);
            circles += `<circle cx="${round(centerX + Math.cos(a) * rr)}" cy="${round(centerY + Math.sin(a) * rr)}" r="${round(r * 0.12)}" fill="rgba(255,255,255,0.12)" />`;
        }
        return circles;
    }
    if (colorPattern === 'galaxy_swirl') {
        let pts = '';
        for (let i = 0; i < 20; i++) {
            const t = i / 19;
            const a = t * Math.PI * 4;
            const rr = t * r * 0.8;
            pts += `${round(centerX + Math.cos(a) * rr)},${round(centerY + Math.sin(a) * rr)} `;
        }
        return `<polyline points="${pts}" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />`;
    }
    if (colorPattern === 'aurora') {
        let lines = '';
        for (let i = 0; i < 3; i++) {
            const oy = -r * 0.3 + i * r * 0.3;
            lines += `<path d="M ${round(centerX - r)} ${round(centerY + oy)} C ${round(centerX - r * 0.3)} ${round(centerY + oy - r * 0.2)} ${round(centerX + r * 0.3)} ${round(centerY + oy + r * 0.2)} ${round(centerX + r)} ${round(centerY + oy)}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.5" />`;
        }
        return lines;
    }
    if (colorPattern === 'stripe_v') {
        const sw = r * 0.28;
        let stripes = '';
        for (let i = -3; i <= 3; i++) {
            const alpha = Math.abs(i) % 2 === 0 ? '0.08' : '0.06';
            const fill  = Math.abs(i) % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
            stripes += `<rect x="${round(centerX + i * sw - sw / 2)}" y="${round(centerY - r * 1.5)}" width="${round(sw)}" height="${round(r * 3)}" fill="${fill}" />`;
        }
        return stripes;
    }
    if (colorPattern === 'void_rift') {
        return `<path d="M ${round(centerX - r * 0.4)} ${round(centerY - r * 0.1)} C ${round(centerX - r * 0.1)} ${round(centerY - r * 0.4)} ${round(centerX + r * 0.1)} ${round(centerY + r * 0.2)} ${round(centerX + r * 0.5)} ${round(centerY - r * 0.3)}" fill="none" stroke="rgba(180,100,255,0.22)" stroke-width="1.5" stroke-linecap="round" />`;
    }
    if (colorPattern === 'prismatic') {
        let lines = '';
        for (let i = -3; i <= 3; i++) {
            lines += `<line x1="${round(centerX + i * r * 0.25)}" y1="${round(centerY - r)}" x2="${round(centerX + i * r * 0.25)}" y2="${round(centerY + r)}" stroke="rgba(255,255,255,0.2)" stroke-width="0.8" />`;
        }
        return lines;
    }
    return '';
}

// ─────────────────────────────────────────────────────────────────────────────
//  BODY GEOMETRY
// ─────────────────────────────────────────────────────────────────────────────
function buildBodyPoints({ baseRadius, bodyProfile, centerX, centerY, bodyShape, scale }) {
    const points    = [];
    const radii     = Array.isArray(bodyProfile?.radii) && bodyProfile.radii.length ? bodyProfile.radii : null;
    const nodeCount = radii?.length || clampNumber(bodyProfile?.numNodes, 24, 10, 64);

    for (let index = 0; index < nodeCount; index += 1) {
        const angle  = (-Math.PI / 2) + ((Math.PI * 2 * index) / nodeCount);
        const radius = normalizeShapeRadius(radii?.[index] ?? baseRadius, angle, baseRadius, bodyShape) * scale;
        points.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
        });
    }
    return points;
}

function normalizeShapeRadius(rawRadius, angle, baseRadius, bodyShape) {
    const radius = clampNumber(rawRadius, baseRadius, 4, baseRadius * 2.4);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Legacy shapes
    if (bodyShape === 'pear')     return radius * (sin > 0 ? 1.12 + Math.abs(sin) * 0.14 : 0.92);
    if (bodyShape === 'teardrop') return radius * (sin < -0.3 ? 1.08 : (sin > 0.45 ? 0.92 : 1));
    if (bodyShape === 'puddle')   return radius * (sin > 0 ? 0.84 : 1.08) * (Math.abs(cos) > 0.7 ? 1.1 : 0.98);
    if (bodyShape === 'comet')    return radius * (cos > 0.18 ? 1.06 : 0.94) * (sin > 0.4 ? 0.92 : 1);
    if (bodyShape === 'dumpling' || bodyShape === 'mochi') return radius * (sin > 0 ? 0.92 : 1.04);
    if (bodyShape === 'wisp')     return radius * (sin < -0.2 ? 1.08 : 0.96) * (1 + Math.sin(angle * 2.5) * 0.05);
    if (bodyShape === 'jellybean') return radius * (1 + cos * 0.08) * (1 + sin * 0.04 * 0.5);
    if (bodyShape === 'bell')     return radius * (sin > 0 ? 1.1 : 0.96) * (1 + Math.cos(angle * 3) * 0.02);
    if (bodyShape === 'puff')     return radius * (1 + Math.sin(angle * 4) * 0.04);
    // New shapes
    if (bodyShape === 'crystal')  return radius * (1 + Math.cos(angle * 6) * 0.07);
    if (bodyShape === 'ribbon')   return radius * (1 + cos * 0.18) * (1 - Math.abs(sin * 0.08));
    if (bodyShape === 'lantern')  return radius * (1 - Math.cos(angle * 2) * 0.05) * (sin > 0 ? 1.04 : 0.98);
    if (bodyShape === 'crescent') return radius * (1 + cos * 0.12) * (1 + Math.sin(angle * 3) * 0.04);
    if (bodyShape === 'star_body') return radius * (1 + Math.cos(angle * 5) * 0.15);
    if (bodyShape === 'diamond')  return radius * (1 + Math.cos(angle * 4) * 0.13);
    if (bodyShape === 'twin_lobe') return radius * (1 + Math.abs(cos) * 0.12);
    if (bodyShape === 'fractal')  return radius * (1 + Math.sin(angle * 3) * 0.06 + Math.sin(angle * 6) * 0.03 + Math.sin(angle * 12) * 0.015);
    if (bodyShape === 'aurora_form') return radius * (1 + Math.sin(angle * 2 + 0.5) * 0.07 + Math.cos(angle * 3 - 0.3) * 0.04 + Math.sin(angle * 5 + 1.1) * 0.02);
    return radius;
}

function buildSmoothPath(points) {
    if (!Array.isArray(points) || points.length < 3) {
        return 'M60 28 C79 28 92 42 92 60 C92 80 78 94 60 94 C41 94 28 80 28 60 C28 42 41 28 60 28 Z';
    }
    const start = midPoint(points[0], points[points.length - 1]);
    let path = `M ${round(start.x)} ${round(start.y)}`;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next    = points[(index + 1) % points.length];
        const mid     = midPoint(current, next);
        path += ` Q ${round(current.x)} ${round(current.y)} ${round(mid.x)} ${round(mid.y)}`;
    }
    path += ' Z';
    return path;
}

function deriveFaceAnchor(points, centerX, centerY, baseRadius, bodyShape, variant) {
    const bounds = points.reduce((acc, point) => ({
        minX: Math.min(acc.minX, point.x),
        maxX: Math.max(acc.maxX, point.x),
        minY: Math.min(acc.minY, point.y),
        maxY: Math.max(acc.maxY, point.y),
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

    const width     = bounds.maxX - bounds.minX;
    const height    = bounds.maxY - bounds.minY;
    const sizeFactor = variant === 'hero' ? 1.08 : 0.94;
    const yBias     = bodyShape === 'puddle' ? 0.07 : bodyShape === 'teardrop' ? -0.02 : 0.02;

    return {
        eyeY:       centerY - height * (0.1 - yBias),
        eyeSpacing: Math.max(7, width * 0.18) * sizeFactor,
        eyeRadius:  Math.max(3.1, baseRadius * 0.078) * sizeFactor,
        mouthY:     centerY + height * (0.12 + yBias),
        mouthWidth: Math.max(12, width * 0.22) * sizeFactor,
        mouthHeight:Math.max(5, baseRadius * 0.1) * sizeFactor,
        centerX,
        centerY,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  EYE RENDERER
// ─────────────────────────────────────────────────────────────────────────────
function renderEyeMarkup({ eyeStyle, faceAnchor }) {
    const leftX  = faceAnchor.centerX - faceAnchor.eyeSpacing / 2;
    const rightX = faceAnchor.centerX + faceAnchor.eyeSpacing / 2;
    const y  = faceAnchor.eyeY;
    const r  = faceAnchor.eyeRadius;
    const fill    = 'rgba(5,10,26,0.94)';
    const sparkle = '<circle cx="-1.2" cy="-1.2" r="1.2" fill="rgba(255,255,255,0.9)" />';

    const drawRound = (x, radius = r, includeSparkle = false) => `
        <g transform="translate(${round(x)} ${round(y)})">
            <circle cx="0" cy="0" r="${round(radius)}" fill="${fill}" />
            ${includeSparkle ? sparkle : ''}
        </g>`;

    const drawLine = (x, tilt = 0, w = r * 2.3) => `
        <path d="M ${round(x - w / 2)} ${round(y + tilt)} Q ${round(x)} ${round(y - Math.abs(tilt) - 1.4)} ${round(x + w / 2)} ${round(y - tilt)}" stroke="${fill}" stroke-width="2.2" stroke-linecap="round" fill="none" />`;

    // Legacy styles
    if (eyeStyle === 'sleepy' || eyeStyle === 'happy_arc') {
        return `${drawLine(leftX, eyeStyle === 'happy_arc' ? 1.2 : -0.6)}${drawLine(rightX, eyeStyle === 'happy_arc' ? 1.2 : -0.6)}`;
    }
    if (eyeStyle === 'wide')      return `${drawRound(leftX, r + 1.2, true)}${drawRound(rightX, r + 1.2, true)}`;
    if (eyeStyle === 'big_round' || eyeStyle === 'sparkle') return `${drawRound(leftX, r + 0.9, true)}${drawRound(rightX, r + 0.9, true)}`;
    if (eyeStyle === 'half_lid')  return `${drawRound(leftX, r + 0.2, true)}${drawRound(rightX, r + 0.2, true)}
        <path d="M ${round(leftX - r)} ${round(y - 1.6)} Q ${round(leftX)} ${round(y - r - 1.6)} ${round(leftX + r)} ${round(y - 1.6)}" stroke="rgba(5,10,26,0.84)" stroke-width="1.6" fill="none" />
        <path d="M ${round(rightX - r)} ${round(y - 1.6)} Q ${round(rightX)} ${round(y - r - 1.6)} ${round(rightX + r)} ${round(y - 1.6)}" stroke="rgba(5,10,26,0.84)" stroke-width="1.6" fill="none" />`;
    if (eyeStyle === 'slit' || eyeStyle === 'angry_arc')
        return `${drawLine(leftX, eyeStyle === 'angry_arc' ? 1.4 : 0.2, r * 2.6)}${drawLine(rightX, eyeStyle === 'angry_arc' ? -1.4 : 0.2, r * 2.6)}`;
    if (eyeStyle === 'wink')   return `${drawRound(leftX, r + 0.4, true)}${drawLine(rightX, 0, r * 2.4)}`;
    if (eyeStyle === 'uneven') return `${drawRound(leftX, r + 0.9, true)}${drawRound(rightX, Math.max(2.2, r - 1.2), false)}`;
    if (eyeStyle === 'void')   return `${drawRound(leftX, r + 1.4, true)}${drawRound(rightX, r + 1.4, true)}`;
    if (eyeStyle === 'heart')  return `${drawHeartEye(leftX, y, r)}${drawHeartEye(rightX, y, r)}`;
    if (eyeStyle === 'droplet') return `${drawDropletEye(leftX, y, r)}${drawDropletEye(rightX, y, r)}`;
    if (eyeStyle === 'spiral') return `${drawSpiralEye(leftX, y, r, 1)}${drawSpiralEye(rightX, y, r, -1)}`;

    // New eye styles
    if (eyeStyle === 'star_eye') return `${drawStarEye(leftX, y, r)}${drawStarEye(rightX, y, r)}`;
    if (eyeStyle === 'twin_spark') return `
        ${drawRound(leftX, r + 1.5, false)}
        <circle cx="${round(leftX - r * 0.3)}" cy="${round(y - r * 0.3)}" r="${round(r * 0.35)}" fill="rgba(255,255,255,0.85)" />
        <circle cx="${round(leftX + r * 0.2)}" cy="${round(y + r * 0.2)}" r="${round(r * 0.18)}" fill="rgba(255,255,255,0.7)" />
        ${drawRound(rightX, r + 1.5, false)}
        <circle cx="${round(rightX - r * 0.3)}" cy="${round(y - r * 0.3)}" r="${round(r * 0.35)}" fill="rgba(255,255,255,0.85)" />
        <circle cx="${round(rightX + r * 0.2)}" cy="${round(y + r * 0.2)}" r="${round(r * 0.18)}" fill="rgba(255,255,255,0.7)" />`;
    if (eyeStyle === 'monocle') return `
        ${drawRound(leftX, r, true)}
        ${drawRound(rightX, r + 2, true)}
        <circle cx="${round(rightX)}" cy="${round(y)}" r="${round(r + 3.5)}" fill="none" stroke="rgba(180,180,180,0.75)" stroke-width="1.2" />`;
    if (eyeStyle === 'button') return `
        ${drawRound(leftX, r, false)}
        <circle cx="${round(leftX)}" cy="${round(y)}" r="${round(r * 0.35)}" fill="rgba(0,0,0,0.22)" />
        ${drawRound(rightX, r, false)}
        <circle cx="${round(rightX)}" cy="${round(y)}" r="${round(r * 0.35)}" fill="rgba(0,0,0,0.22)" />`;
    if (eyeStyle === 'tearful') return `
        ${drawRound(leftX, r, true)}
        ${drawRound(rightX, r, true)}
        <ellipse cx="${round(leftX)}" cy="${round(y + r * 1.5)}" rx="1.2" ry="2.8" fill="rgba(100,180,255,0.7)" />
        <ellipse cx="${round(rightX)}" cy="${round(y + r * 1.5)}" rx="1.2" ry="2.8" fill="rgba(100,180,255,0.7)" />`;
    if (eyeStyle === 'x_eye') return `
        <path d="M ${round(leftX - r)} ${round(y - r)} L ${round(leftX + r)} ${round(y + r)}" stroke="${fill}" stroke-width="2.4" stroke-linecap="round" />
        <path d="M ${round(leftX + r)} ${round(y - r)} L ${round(leftX - r)} ${round(y + r)}" stroke="${fill}" stroke-width="2.4" stroke-linecap="round" />
        <path d="M ${round(rightX - r)} ${round(y - r)} L ${round(rightX + r)} ${round(y + r)}" stroke="${fill}" stroke-width="2.4" stroke-linecap="round" />
        <path d="M ${round(rightX + r)} ${round(y - r)} L ${round(rightX - r)} ${round(y + r)}" stroke="${fill}" stroke-width="2.4" stroke-linecap="round" />`;
    if (eyeStyle === 'abyss') return `
        ${drawRound(leftX, r + 2.5, false)}
        <circle cx="${round(leftX)}" cy="${round(y)}" r="${round(r + 1)}" fill="none" stroke="rgba(60,0,0,0.4)" stroke-width="0.8" />
        ${drawRound(rightX, r + 2.5, false)}
        <circle cx="${round(rightX)}" cy="${round(y)}" r="${round(r + 1)}" fill="none" stroke="rgba(60,0,0,0.4)" stroke-width="0.8" />`;
    if (eyeStyle === 'flame_eye') return `
        <g transform="translate(${round(leftX)} ${round(y)})">
            <circle cx="0" cy="0" r="${round(r)}" fill="#ff4800" />
            <circle cx="0" cy="0" r="${round(r * 0.6)}" fill="#ffae00" />
            <circle cx="0" cy="0" r="${round(r * 0.28)}" fill="white" />
            <path d="M ${round(-r * 0.28)} ${round(-r)} Q 0 ${round(-r * 2.1)} ${round(r * 0.28)} ${round(-r)} Z" fill="#ff4800" />
        </g>
        <g transform="translate(${round(rightX)} ${round(y)})">
            <circle cx="0" cy="0" r="${round(r)}" fill="#ff4800" />
            <circle cx="0" cy="0" r="${round(r * 0.6)}" fill="#ffae00" />
            <circle cx="0" cy="0" r="${round(r * 0.28)}" fill="white" />
            <path d="M ${round(-r * 0.28)} ${round(-r)} Q 0 ${round(-r * 2.1)} ${round(r * 0.28)} ${round(-r)} Z" fill="#ff4800" />
        </g>`;
    if (eyeStyle === 'rainbow_iris') return `${drawRainbowIris(leftX, y, r)}${drawRainbowIris(rightX, y, r)}`;
    if (eyeStyle === 'crystal_eye') return `${drawCrystalEye(leftX, y, r)}${drawCrystalEye(rightX, y, r)}`;
    if (eyeStyle === 'galaxy_eye') return `${drawGalaxyEye(leftX, y, r)}${drawGalaxyEye(rightX, y, r)}`;

    if (eyeStyle === 'cat_slit') return `
        <ellipse cx="${round(leftX)}" cy="${round(y)}" rx="${round(r*1.5)}" ry="${round(r*1.5)}" fill="rgba(255,220,50,0.95)" />
        <ellipse cx="${round(rightX)}" cy="${round(y)}" rx="${round(r*1.5)}" ry="${round(r*1.5)}" fill="rgba(255,220,50,0.95)" />
        <ellipse cx="${round(leftX)}" cy="${round(y)}" rx="${round(Math.max(1, r*0.3))}" ry="${round(r*1.5)}" fill="${fill}" />
        <ellipse cx="${round(rightX)}" cy="${round(y)}" rx="${round(Math.max(1, r*0.3))}" ry="${round(r*1.5)}" fill="${fill}" />
        <circle cx="${round(leftX-r*0.3)}" cy="${round(y-r*0.4)}" r="1.2" fill="rgba(255,255,255,0.8)" />
        <circle cx="${round(rightX-r*0.3)}" cy="${round(y-r*0.4)}" r="1.2" fill="rgba(255,255,255,0.8)" />`;
    if (eyeStyle === 'blob_eye') return `
        <ellipse cx="${round(leftX)}" cy="${round(y)}" rx="${round(r*1.1)}" ry="${round(r*0.9)}" transform="rotate(15 ${round(leftX)} ${round(y)})" fill="${fill}" />
        <ellipse cx="${round(rightX)}" cy="${round(y)}" rx="${round(r*0.9)}" ry="${round(r*1.1)}" transform="rotate(-18 ${round(rightX)} ${round(y)})" fill="${fill}" />
        <circle cx="${round(leftX-r*0.25)}" cy="${round(y-r*0.3)}" r="${round(Math.max(1, r*0.25))}" fill="rgba(255,255,255,0.9)" />
        <circle cx="${round(rightX-r*0.25)}" cy="${round(y-r*0.3)}" r="${round(Math.max(1, r*0.25))}" fill="rgba(255,255,255,0.9)" />`;
    if (eyeStyle === 'dot_line') return `
        <rect x="${round(leftX-r*0.6)}" y="${round(y-r*1.2)}" width="${round(r*1.2)}" height="${round(Math.max(2, r*2.4))}" rx="${round(r)}" fill="${fill}" />
        <rect x="${round(rightX-r*0.6)}" y="${round(y-r*1.2)}" width="${round(r*1.2)}" height="${round(Math.max(2, r*2.4))}" rx="${round(r)}" fill="${fill}" />`;
    if (eyeStyle === 'shiny_round') return `
        ${drawRound(leftX, r + 2.5, true)}
        ${drawRound(rightX, r + 2.5, true)}
        <circle cx="${round(leftX+r*0.4)}" cy="${round(y+r*0.4)}" r="${round(r*0.18)}" fill="rgba(255,255,255,0.6)" />
        <circle cx="${round(rightX+r*0.4)}" cy="${round(y+r*0.4)}" r="${round(r*0.18)}" fill="rgba(255,255,255,0.6)" />`;

    // Default
    return `${drawRound(leftX, r, true)}${drawRound(rightX, r, true)}`;
}

function drawStarEye(x, y, r) {
    const pts = [];
    for (let i = 0; i < 5; i++) {
        const a  = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        const ia = a + Math.PI / 5;
        pts.push(`${round(x + Math.cos(a) * r)},${round(y + Math.sin(a) * r)}`);
        pts.push(`${round(x + Math.cos(ia) * r * 0.4)},${round(y + Math.sin(ia) * r * 0.4)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="rgba(5,10,26,0.94)" />`;
}

function drawRainbowIris(x, y, r) {
    const segments = [];
    for (let i = 0; i < 6; i++) {
        const a1 = i * (Math.PI / 3);
        const a2 = (i + 1) * (Math.PI / 3);
        const x1 = x + Math.cos(a1) * r; const y1 = y + Math.sin(a1) * r;
        const x2 = x + Math.cos(a2) * r; const y2 = y + Math.sin(a2) * r;
        segments.push(`<path d="M ${round(x)} ${round(y)} L ${round(x1)} ${round(y1)} A ${round(r)} ${round(r)} 0 0 1 ${round(x2)} ${round(y2)} Z" fill="hsl(${i * 60} 80% 55%)" />`);
    }
    return `<g>${segments.join('')}<circle cx="${round(x)}" cy="${round(y)}" r="${round(r * 0.35)}" fill="rgba(5,10,26,0.94)" /><circle cx="${round(x - r * 0.1)}" cy="${round(y - r * 0.1)}" r="${round(r * 0.12)}" fill="rgba(255,255,255,0.88)" /></g>`;
}

function drawCrystalEye(x, y, r) {
    return `<g>
        <circle cx="${round(x)}" cy="${round(y)}" r="${round(r + 1)}" fill="rgba(160,220,255,0.9)" />
        <circle cx="${round(x)}" cy="${round(y)}" r="${round(r * 0.6)}" fill="rgba(100,160,255,0.85)" />
        <circle cx="${round(x - r * 0.3)}" cy="${round(y - r * 0.3)}" r="${round(r * 0.25)}" fill="rgba(255,255,255,0.6)" />
        <line x1="${round(x)}" y1="${round(y - r - 1)}" x2="${round(x)}" y2="${round(y + r + 1)}" stroke="rgba(255,255,255,0.3)" stroke-width="0.7" />
        <line x1="${round(x - r - 1)}" y1="${round(y)}" x2="${round(x + r + 1)}" y2="${round(y)}" stroke="rgba(255,255,255,0.3)" stroke-width="0.7" />
    </g>`;
}

function drawGalaxyEye(x, y, r) {
    // Static approximation of galaxy eye (no animation in SVG portrait)
    return `<g>
        <circle cx="${round(x)}" cy="${round(y)}" r="${round(r + 2)}" fill="#0a0020" />
        <circle cx="${round(x)}" cy="${round(y)}" r="${round(r * 0.88)}" fill="none" stroke="rgba(150,100,255,0.5)" stroke-width="1" />
        <circle cx="${round(x)}" cy="${round(y)}" r="${round(r * 0.55)}" fill="none" stroke="rgba(100,200,255,0.4)" stroke-width="0.8" />
        <circle cx="${round(x)}" cy="${round(y)}" r="${round(r * 0.3)}" fill="rgba(200,150,255,0.9)" />
        <circle cx="${round(x - r * 0.1)}" cy="${round(y - r * 0.1)}" r="${round(r * 0.12)}" fill="rgba(255,255,255,0.88)" />
    </g>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  MOUTH RENDERER
// ─────────────────────────────────────────────────────────────────────────────
function renderMouthMarkup({ mouthStyle, faceAnchor }) {
    const x  = faceAnchor.centerX;
    const y  = faceAnchor.mouthY;
    const w  = faceAnchor.mouthWidth;
    const h  = faceAnchor.mouthHeight;
    const s  = 'rgba(5,10,26,0.92)';
    const sw = 'stroke-width="2.2" stroke-linecap="round" fill="none"';
    const innerFill = 'rgba(255,140,160,0.55)'; // Simple static cute-fill
    const swf = `stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="${innerFill}"`;

    if (mouthStyle === 'flat')         return `<path d="M ${round(x - w/2)} ${round(y)} L ${round(x + w/2)} ${round(y)}" stroke="${s}" ${sw} />`;
    if (mouthStyle === 'tiny_frown')   return `<path d="M ${round(x - w*0.36)} ${round(y+1.6)} Q ${round(x)} ${round(y-h*0.45)} ${round(x+w*0.36)} ${round(y+1.6)}" stroke="${s}" ${sw} />`;
    if (mouthStyle === 'tiny_o' || mouthStyle === 'pout') return `<ellipse cx="${round(x)}" cy="${round(y)}" rx="${round(Math.max(3, w*0.14))}" ry="${round(Math.max(3.6, h*0.7))}" stroke="${s}" stroke-width="1.8" fill="none" />`;
    if (mouthStyle === 'smirk')        return `<path d="M ${round(x-w*0.34)} ${round(y)} Q ${round(x+w*0.1)} ${round(y+h*0.4)} ${round(x+w*0.42)} ${round(y-1.2)}" stroke="${s}" ${sw} />`;
    if (mouthStyle === 'zigzag' || mouthStyle === 'fangs') return `<path d="M ${round(x-w*0.46)} ${round(y)} L ${round(x-w*0.2)} ${round(y-3)} L ${round(x)} ${round(y)} L ${round(x+w*0.2)} ${round(y-3)} L ${round(x+w*0.46)} ${round(y)}" stroke="${s}" ${sw} />`;
    if (mouthStyle === 'grin' || mouthStyle === 'open_smile') return `<path d="M ${round(x-w/2)} ${round(y-1.2)} Q ${round(x)} ${round(y+h)} ${round(x+w/2)} ${round(y-1.2)} Z" stroke="${s}" ${swf} />`;
    if (mouthStyle === 'cat')          return `<path d="M ${round(x-w*0.42)} ${round(y-0.6)} Q ${round(x-w*0.16)} ${round(y+h*0.8)} ${round(x)} ${round(y-0.2)} Q ${round(x+w*0.16)} ${round(y+h*0.8)} ${round(x+w*0.42)} ${round(y-0.6)}" stroke="${s}" ${sw} />`;
    // New mouth styles
    if (mouthStyle === 'toothy')       return `<rect x="${round(x-6)}" y="${round(y-2)}" width="12" height="7" rx="2" stroke="${s}" stroke-width="2.2" fill="none" /><path d="M ${round(x-2)} ${round(y-2)} L ${round(x-2)} ${round(y+5)} M ${round(x+2)} ${round(y-2)} L ${round(x+2)} ${round(y+5)}" stroke="${s}" stroke-width="2.2" />`;
    if (mouthStyle === 'bubble')       return `<circle cx="${round(x)}" cy="${round(y)}" r="${round(Math.max(3, w*0.18))}" stroke="${s}" stroke-width="1.8" fill="none" />`;
    if (mouthStyle === 'laugh_open')   return `<path d="M ${round(x-w*0.5)} ${round(y)} A ${round(w/2)} ${round(h)} 0 0 0 ${round(x+w*0.5)} ${round(y)} Z" stroke="${s}" ${swf} />`;
    if (mouthStyle === 'whistle')      return `<ellipse cx="${round(x)}" cy="${round(y)}" rx="${round(Math.max(2, w*0.1))}" ry="${round(Math.max(3.2, h*0.65))}" stroke="${s}" stroke-width="1.8" fill="none" />`;
    if (mouthStyle === 'hmm')          return `<path d="M ${round(x-w*0.4)} ${round(y)} Q ${round(x-w*0.1)} ${round(y-2)} ${round(x)} ${round(y)} Q ${round(x+w*0.1)} ${round(y+2)} ${round(x+w*0.4)} ${round(y)}" stroke="${s}" ${sw} />`;
    if (mouthStyle === 'drool')        return `<path d="M ${round(x-w*0.4)} ${round(y-1)} Q ${round(x)} ${round(y+h*0.6)} ${round(x+w*0.4)} ${round(y-1)} Z" stroke="${s}" ${swf} /><ellipse cx="${round(x+w*0.08)}" cy="${round(y+h+2)}" rx="1.2" ry="2.6" fill="rgba(100,200,255,0.6)" />`;
    if (mouthStyle === 'wide_gape')    return `<rect x="${round(x-8)}" y="${round(y-1)}" width="16" height="9" rx="3" stroke="${s}" stroke-width="2.2" fill="${innerFill}" />`;
    if (mouthStyle === 'wavy')         return `<path d="M ${round(x-6)} ${round(y)} Q ${round(x-3)} ${round(y-4)} ${round(x)} ${round(y)} Q ${round(x+3)} ${round(y+4)} ${round(x+6)} ${round(y)}" stroke="${s}" ${sw} />`;
    if (mouthStyle === 'cat_open')     return `<path d="M ${round(x-6)} ${round(y-1)} Q ${round(x-3)} ${round(y+4)} ${round(x)} ${round(y)} Q ${round(x+3)} ${round(y+4)} ${round(x+6)} ${round(y-1)} Z" stroke="${s}" ${swf} />`;
    if (mouthStyle === 'tiny_smile')   return `<path d="M ${round(x-3)} ${round(y)} Q ${round(x)} ${round(y+3)} ${round(x+3)} ${round(y)}" stroke="${s}" ${sw} />`;
    if (mouthStyle === 'squiggle')     return `<path d="M ${round(x-w*0.46)} ${round(y)} Q ${round(x-w*0.24)} ${round(y-3)} ${round(x-w*0.06)} ${round(y)} Q ${round(x+w*0.12)} ${round(y+3)} ${round(x+w*0.3)} ${round(y)} Q ${round(x+w*0.4)} ${round(y-1)} ${round(x+w*0.48)} ${round(y)}" stroke="${s}" ${sw} />`;
    if (mouthStyle === 'abyss_mouth')  return `<ellipse cx="${round(x)}" cy="${round(y)}" rx="${round(w*0.46)}" ry="${round(h*0.7)}" stroke="${s}" stroke-width="1.8" fill="rgba(5,10,26,0.45)" />`;
    if (mouthStyle === 'starfish_mouth') {
        const pts = [];
        for (let i = 0; i < 5; i++) {
            const a  = -Math.PI / 2 + i * (Math.PI * 2 / 5);
            const ia = a + Math.PI / 5;
            pts.push(`${round(x + Math.cos(a) * w * 0.36)},${round(y + Math.sin(a) * h * 0.6)}`);
            pts.push(`${round(x + Math.cos(ia) * w * 0.14)},${round(y + Math.sin(ia) * h * 0.24)}`);
        }
        return `<polygon points="${pts.join(' ')}" stroke="${s}" stroke-width="1.6" fill="rgba(5,10,26,0.25)" />`;
    }
    if (mouthStyle === 'candy_smile')  return `<path d="M ${round(x-7)} ${round(y)} Q ${round(x)} ${round(y+7)} ${round(x+7)} ${round(y)} Z" stroke="${s}" ${swf} />`;

    // Default smile
    return `<path d="M ${round(x-w/2)} ${round(y-1)} Q ${round(x)} ${round(y+h)} ${round(x+w/2)} ${round(y-1)} Z" stroke="${s}" ${swf} />`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ACCESSORY RENDERER
// ─────────────────────────────────────────────────────────────────────────────
function renderAccessorySvg({ accessory, baseRadius, centerX, centerY, points, variant }) {
    if (!accessory || accessory === 'none') return '';

    const topPoint = points.reduce((best, p) => (p.y < best.y ? p : best), points[0]);
    const anchorX  = topPoint.x;
    const anchorY  = topPoint.y - (variant === 'hero' ? 2 : 0);
    const s        = Math.max(0.8, Math.min(1.35, baseRadius / 48)) * (variant === 'hero' ? 1.1 : 0.92);

    const wrap = (inner, dx = 0, dy = 0, rot = 0) =>
        `<g transform="translate(${round(anchorX + dx)} ${round(anchorY + dy)}) rotate(${rot}) scale(${round(s, 3)})">${inner}</g>`;

    switch (accessory) {
        // ── Legacy ──────────────────────────────────────────────────────────
        case 'bow':
            return wrap(`<path d="M 0 2 L -16 -10 L -12 12 Z" fill="#ff4d6d" /><path d="M 0 2 L 16 -10 L 12 12 Z" fill="#ff4d6d" /><circle cx="0" cy="2" r="4.6" fill="#c9184a" />`, 0, 4);
        case 'leaf':
            return wrap(`<path d="M -1 2 Q 6 -12 16 -18" stroke="#208b3a" stroke-width="2.2" fill="none" stroke-linecap="round" /><ellipse cx="16" cy="-18" rx="13" ry="5" transform="rotate(-28 16 -18)" fill="#2dc653" />`, 0, 0, -8);
        case 'sprout':
            return wrap(`<path d="M 0 4 Q 0 -8 0 -20" stroke="#1f7a1f" stroke-width="2.2" fill="none" stroke-linecap="round" /><ellipse cx="-7" cy="-16" rx="8" ry="4" transform="rotate(-28 -7 -16)" fill="#52b788" /><ellipse cx="7" cy="-16" rx="8" ry="4" transform="rotate(28 7 -16)" fill="#52b788" />`);
        case 'crown':
            return wrap(`<path d="M -16 6 L -12 -9 L -4 0 L 0 -14 L 4 0 L 12 -9 L 16 6 Z" fill="#f4d35e" />`, 0, 2);
        case 'halo':
            return wrap(`<ellipse cx="0" cy="-16" rx="16" ry="6" fill="none" stroke="rgba(255,220,120,0.95)" stroke-width="3" />`, 0, -3);
        case 'broken_halo':
            return wrap(`<path d="M -14 -18 A 16 6 0 0 1 0 -22" fill="none" stroke="rgba(210,210,210,0.92)" stroke-width="3" stroke-linecap="round" /><path d="M 4 -22 A 16 6 0 0 1 16 -18" fill="none" stroke="rgba(210,210,210,0.92)" stroke-width="3" stroke-linecap="round" />`, 0, -1);
        case 'flower':
            return wrap(`<ellipse cx="0" cy="-8" rx="5" ry="10" fill="#ff8fab" /><ellipse cx="0" cy="8" rx="5" ry="10" fill="#ff8fab" /><ellipse cx="8" cy="0" rx="10" ry="5" fill="#ff8fab" /><ellipse cx="-8" cy="0" rx="10" ry="5" fill="#ff8fab" /><circle cx="0" cy="0" r="5" fill="#ffd166" />`, 10, 0);
        case 'star_pin':
            return wrap(`<path d="M 0 -12 L 3 -3 L 12 -3 L 5 2 L 8 11 L 0 5 L -8 11 L -5 2 L -12 -3 L -3 -3 Z" fill="#ffd166" />`, 10, 2);
        case 'horns':
            return wrap(`<path d="M -10 2 Q -18 -12 -22 -28 Q -7 -18 -2 -4 Z" fill="#e0e0e0" /><path d="M 10 2 Q 18 -12 22 -28 Q 7 -18 2 -4 Z" fill="#e0e0e0" />`, 0, 5);
        case 'mushroom':
            return wrap(`<path d="M -14 -6 A 14 12 0 0 1 14 -6 L 14 -4 L -14 -4 Z" fill="#f94144" /><circle cx="-4" cy="-8" r="2.2" fill="#fff" /><circle cx="5" cy="-10" r="1.8" fill="#fff" /><rect x="-3" y="-4" width="6" height="14" rx="2" fill="#f5e6cc" />`, 8, 2);
        case 'antenna':
            return wrap(`<path d="M 0 5 Q 4 -10 0 -24" stroke="#d90429" stroke-width="2.3" fill="none" stroke-linecap="round" /><circle cx="0" cy="-26" r="5" fill="#ff4d6d" />`);
        case 'clover':
            return wrap(`<circle cx="-4" cy="-8" r="5" fill="#52b788" /><circle cx="4" cy="-8" r="5" fill="#52b788" /><circle cx="-4" cy="0" r="5" fill="#52b788" /><circle cx="4" cy="0" r="5" fill="#52b788" /><path d="M 0 2 Q 3 10 8 14" stroke="#2d6a4f" stroke-width="2" fill="none" stroke-linecap="round" />`, 8, 1);
        case 'feather':
            return wrap(`<path d="M -2 10 Q 10 -2 4 -18 Q -6 -8 -2 10 Z" fill="#e9edc9" /><path d="M -1 8 L 4 -16" stroke="#a3b18a" stroke-width="1.6" fill="none" stroke-linecap="round" />`);
        case 'shell_pin':
            return wrap(`<path d="M -10 0 A 10 10 0 0 1 10 0" fill="#ffd6a5" /><path d="M -6 0 L -4 -8" stroke="#e5989b" stroke-width="1.5" fill="none" /><path d="M -2 0 L 0 -8" stroke="#e5989b" stroke-width="1.5" fill="none" /><path d="M 2 0 L 2 -8" stroke="#e5989b" stroke-width="1.5" fill="none" /><path d="M 6 0 L 4 -8" stroke="#e5989b" stroke-width="1.5" fill="none" />`);
        case 'bone_pin':
            return wrap(`<path d="M -9 9 L 9 -9" stroke="#f1f3f5" stroke-width="4" stroke-linecap="round" /><circle cx="-10" cy="10" r="3.5" fill="#f8f9fa" /><circle cx="10" cy="-10" r="3.5" fill="#f8f9fa" />`);

        // ── New cute ────────────────────────────────────────────────────────
        case 'ribbon_bow':
            return wrap(`<path d="M 0 0 C -20 -12 -22 10 -5 5 Z" fill="#ff85a1" /><path d="M 0 0 C 20 -12 22 10 5 5 Z" fill="#ff85a1" /><circle cx="0" cy="2" r="4" fill="#ff4d6d" />`);
        case 'mini_crown':
            return wrap(`<path d="M -10 4 L -8 -6 L -3 0 L 0 -10 L 3 0 L 8 -6 L 10 4 Z" fill="#ffd166" /><circle cx="0" cy="-8" r="2.5" fill="#e63946" />`);
        case 'candy_pin':
            return wrap(`<circle cx="0" cy="-8" r="9" fill="#ff4d6d" /><path d="M 0 1 L 0 14 L 3 16" stroke="#c9184a" stroke-width="2" fill="none" stroke-linecap="round" />`, 0, 0);
        case 'cloud_puff':
            return wrap(`<circle cx="-8" cy="-10" r="6" fill="rgba(255,255,255,0.9)" /><circle cx="0" cy="-14" r="7" fill="rgba(255,255,255,0.9)" /><circle cx="8" cy="-10" r="6" fill="rgba(255,255,255,0.9)" />`);
        case 'cherry_clip':
            return wrap(`<path d="M -4 0 Q -6 -14 -2 -20" stroke="#3a5a40" stroke-width="1.8" fill="none" stroke-linecap="round" /><path d="M 4 0 Q 6 -14 2 -20" stroke="#3a5a40" stroke-width="1.8" fill="none" stroke-linecap="round" /><circle cx="-2" cy="-20" r="5" fill="#e63946" /><circle cx="2" cy="-20" r="5" fill="#e63946" />`);
        case 'crystal_tiara':
            return wrap(`<path d="M -10 8 L -10 -8 L -5 0 L 0 -18 L 5 0 L 10 -8 L 10 8 Z" fill="rgba(160,200,255,0.85)" stroke="rgba(200,230,255,0.6)" stroke-width="0.8" />`);
        case 'rainbow_halo': {
            const rings = [0,1,2].map(i => `<ellipse cx="0" cy="-18" rx="${16 + i * 0.5}" ry="${6 + i * 0.2}" fill="none" stroke="hsl(${i * 80} 85% 60%)" stroke-width="1.8" opacity="0.85" />`).join('');
            return wrap(rings, 0, -2);
        }
        case 'petal_wreath': {
            const petals = [0,1,2,3,4,5,6,7].map(i => {
                const a = (i / 8) * Math.PI * 2;
                return `<ellipse cx="${round(Math.cos(a) * 11)}" cy="${round(Math.sin(a) * 11)}" rx="4.5" ry="7" transform="rotate(${round(a * 180 / Math.PI)} ${round(Math.cos(a) * 11)} ${round(Math.sin(a) * 11)})" fill="hsl(${i * 45} 75% 72%)" />`;
            }).join('');
            return wrap(petals, 0, -4);
        }

        // ── New normal ──────────────────────────────────────────────────────
        case 'twig':
            return wrap(`<path d="M -2 8 L 2 -18" stroke="#6b4226" stroke-width="3" stroke-linecap="round" /><path d="M 2 -8 L 10 -14" stroke="#8b6347" stroke-width="1.8" fill="none" stroke-linecap="round" /><path d="M 0 -4 L -8 -10" stroke="#8b6347" stroke-width="1.8" fill="none" stroke-linecap="round" />`);
        case 'bandana':
            return wrap(`<path d="M -14 2 L 14 2 L 8 14 L 0 8 L -8 14 Z" fill="#e63946" opacity="0.88" />`);
        case 'monocle_top':
            return wrap(`<circle cx="6" cy="-6" r="8" fill="none" stroke="#adb5bd" stroke-width="2.5" /><path d="M 14 -6 L 20 -2" stroke="#868e96" stroke-width="1.5" stroke-linecap="round" />`);
        case 'lantern_float':
            return wrap(`<ellipse cx="0" cy="-12" rx="8" ry="12" fill="rgba(255,220,100,0.85)" /><path d="M 0 -1 L 0 6" stroke="#888" stroke-width="1.5" stroke-linecap="round" />`);
        case 'beret':
            return wrap(`<ellipse cx="0" cy="-12" rx="14" ry="10" fill="#457b9d" /><ellipse cx="0" cy="-5" rx="16" ry="4" fill="#1d3557" /><circle cx="6" cy="-14" r="3" fill="#a8dadc" />`);
        case 'ancient_rune':
            return wrap(`<path d="M 0 -18 L 0 4" stroke="rgba(180,140,60,0.9)" stroke-width="2" stroke-linecap="round" /><path d="M -8 -12 L 8 -12" stroke="rgba(180,140,60,0.9)" stroke-width="2" stroke-linecap="round" /><path d="M -6 -6 L 6 -6" stroke="rgba(180,140,60,0.9)" stroke-width="2" stroke-linecap="round" />`);
        case 'gem_cluster':
            return wrap(`<path d="M -6 -14 L -10 -8 L -6 -4 L -2 -8 Z" fill="#a29bfe" /><path d="M 4 -18 L 0 -12 L 4 -8 L 8 -12 Z" fill="#74b9ff" /><path d="M 2 -8 L -2 -2 L 2 2 L 6 -2 Z" fill="#fd79a8" />`);
        case 'wind_streamer':
            return wrap(`<path d="M 0 0 C 8 -8 16 -4 14 -16" stroke="rgba(180,220,255,0.7)" stroke-width="2" fill="none" stroke-linecap="round" /><path d="M 0 -4 C 6 -12 14 -8 12 -20" stroke="rgba(200,180,255,0.6)" stroke-width="1.5" fill="none" stroke-linecap="round" />`);

        // ── New scary ───────────────────────────────────────────────────────
        case 'thorn_ring':
            return wrap(`<ellipse cx="0" cy="-10" rx="14" ry="8" fill="none" stroke="#2d3436" stroke-width="3" /><path d="M -14 -10 L -18 -18 L -10 -12 Z" fill="#636e72" /><path d="M 14 -10 L 18 -18 L 10 -12 Z" fill="#636e72" /><path d="M 0 -18 L 0 -26 L 4 -20 Z" fill="#636e72" />`);
        case 'skull_pin':
            return wrap(`<ellipse cx="0" cy="-12" rx="8" ry="9" fill="#f8f9fa" /><rect x="-5" y="-8" width="10" height="5" fill="#f8f9fa" /><circle cx="-3" cy="-13" r="2.5" fill="#343a40" /><circle cx="3" cy="-13" r="2.5" fill="#343a40" />`);
        case 'iron_mask':
            return wrap(`<rect x="-10" y="-18" width="20" height="14" rx="2" fill="#868e96" /><ellipse cx="-4" cy="-12" rx="3" ry="2" fill="#343a40" /><ellipse cx="4" cy="-12" rx="3" ry="2" fill="#343a40" />`);
        case 'eye_crown':
            return wrap(`<path d="M -14 2 L -10 -10 L -4 -2 L 0 -14 L 4 -2 L 10 -10 L 14 2 Z" fill="#495057" /><ellipse cx="0" cy="-10" rx="3" ry="2" fill="#a29bfe" /><circle cx="0" cy="-10" r="1.2" fill="#2d3436" />`);
        case 'cursed_chain':
            return wrap(`<path d="M 0 0 L 0 -22" stroke="#495057" stroke-width="2" stroke-dasharray="4 2" stroke-linecap="round" /><circle cx="0" cy="-22" r="4" fill="#6c757d" /><circle cx="0" cy="-22" r="2" fill="#a29bfe" />`);
        case 'demon_wings':
            return wrap(`<path d="M -2 -4 C -12 -8 -24 -4 -22 -18 C -14 -28 -6 -20 -2 -12 Z" fill="rgba(100,0,0,0.85)" /><path d="M 2 -4 C 12 -8 24 -4 22 -18 C 14 -28 6 -20 2 -12 Z" fill="rgba(100,0,0,0.85)" />`);
        case 'void_crown':
            return wrap(`<path d="M -16 2 L -12 -14 L -4 -2 L 0 -18 L 4 -2 L 12 -14 L 16 2 Z" fill="#1a1a2e" /><circle cx="0" cy="-2" r="1.5" fill="#7c3aed" /><circle cx="-4" cy="-2" r="1.5" fill="#7c3aed" /><circle cx="4" cy="-2" r="1.5" fill="#7c3aed" />`);
        case 'shadow_cloak':
            return wrap(`<path d="M -14 2 C -20 -6 -18 -18 -10 -20 C -4 -22 0 -14 0 -8 C 0 -14 4 -22 10 -20 C 18 -18 20 -6 14 2 Z" fill="rgba(20,10,40,0.75)" />`);
        case 'eldritch_eye':
            return wrap(`<ellipse cx="0" cy="-12" rx="14" ry="9" fill="#1a1a2e" /><ellipse cx="0" cy="-12" rx="9" ry="6" fill="#e63946" /><ellipse cx="0" cy="-12" rx="4" ry="8" fill="#1a1a2e" />`);

        // ── Shared legendary ────────────────────────────────────────────────
        case 'fairy_wings':
            return wrap(`<path d="M 0 -4 C -8 -8 -22 -4 -20 -20 C -18 -32 -4 -24 0 -12 Z" fill="rgba(200,240,255,0.55)" stroke="rgba(150,220,255,0.7)" stroke-width="0.8" /><path d="M 0 -4 C 8 -8 22 -4 20 -20 C 18 -32 4 -24 0 -12 Z" fill="rgba(200,240,255,0.55)" stroke="rgba(150,220,255,0.7)" stroke-width="0.8" />`);
        case 'spirit_orbs':
            return wrap(`<circle cx="-16" cy="-10" r="5" fill="rgba(180,200,255,0.75)" /><circle cx="14" cy="-8" r="5" fill="rgba(255,180,220,0.75)" /><circle cx="0" cy="-22" r="5" fill="rgba(200,255,200,0.75)" />`);
        case 'starfall_crown':
            return wrap(`<path d="M -14 4 L -10 -8 L -4 2 L 0 -16 L 4 2 L 10 -8 L 14 4 Z" fill="#ffd166" stroke="rgba(255,220,100,0.5)" stroke-width="0.8" /><circle cx="0" cy="-14" r="2" fill="white" /><circle cx="-8" cy="-4" r="2" fill="white" /><circle cx="8" cy="-4" r="2" fill="white" />`);
        case 'celestial_halo': {
            const cStars = [[-12,-20],[0,-27],[12,-20]].map(([sx, sy]) => {
                const spts = [];
                for (let i = 0; i < 5; i++) {
                    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
                    const ia = a + Math.PI / 5;
                    spts.push(`${round(sx + Math.cos(a) * 5)},${round(sy + Math.sin(a) * 5)}`);
                    spts.push(`${round(sx + Math.cos(ia) * 2)},${round(sy + Math.sin(ia) * 2)}`);
                }
                return `<polygon points="${spts.join(' ')}" fill="rgba(255,240,120,0.92)" />`;
            }).join('');
            return wrap(`<ellipse cx="0" cy="-20" rx="18" ry="7" fill="none" stroke="rgba(255,230,80,0.95)" stroke-width="3.5" />${cStars}`);
        }

        // ── Physics accessories — static SVG approximation for thumbnails ──
        case 'silk_ribbon': {
            // Wavy ribbon shape in slime's hue
            const hue = parseInt(accessory) || 320;
            return wrap(
                `<path d="M -4 -2 C -10 4 -8 12 -4 18 C 0 24 4 20 4 14 C 4 8 0 4 4 -2 Z"
                      fill="hsl(${hue},80%,65%)" opacity="0.9"/>
                 <path d="M -4 -2 C -10 4 -8 12 -4 18 C 0 24 4 20 4 14 C 4 8 0 4 4 -2 Z"
                      fill="none" stroke="hsl(${hue},65%,45%)" stroke-width="0.8" opacity="0.6"/>
                 <ellipse cx="0" cy="14" rx="3.5" ry="2.5" fill="hsl(${hue},75%,55%)"/>
                 <ellipse cx="-1" cy="13" rx="1.2" ry="0.9" fill="rgba(255,255,255,0.45)"/>`,
                2, 6
            );
        }
        case 'spectral_tail': {
            const hue2 = parseInt(accessory) || 200;
            return wrap(
                `<path d="M 0 0 C 3 6 -3 12 0 18 C 2 22 4 20 3 26 C 2 30 -2 30 -2 26"
                      fill="none" stroke="hsla(${hue2},80%,72%,0.85)" stroke-width="6"
                      stroke-linecap="round"/>
                 <path d="M 0 0 C 3 6 -3 12 0 18 C 2 22 4 20 3 26 C 2 30 -2 30 -2 26"
                      fill="none" stroke="hsla(${hue2},100%,90%,0.4)" stroke-width="2"
                      stroke-linecap="round"/>
                 <circle cx="-2" cy="26" r="3.5" fill="hsla(${hue2},90%,85%,0.8)"/>`,
                0, 4
            );
        }
        case 'spring_antenna': {
            const hue3 = parseInt(accessory) || 160;
            return wrap(
                `<path d="M 0 0 C 3 -3 -3 -6 0 -9 C 3 -12 -3 -15 0 -18 C 3 -21 -2 -24 0 -26"
                      fill="none" stroke="hsl(${hue3},55%,50%)" stroke-width="2"
                      stroke-linecap="round"/>
                 <radialGradient id="oa" cx="35%" cy="30%">
                   <stop offset="0%" stop-color="hsl(${hue3},90%,88%)"/>
                   <stop offset="100%" stop-color="hsl(${hue3},70%,38%)"/>
                 </radialGradient>
                 <circle cx="0" cy="-26" r="6" fill="url(#oa)"/>
                 <circle cx="-2" cy="-28" r="2.2" fill="rgba(255,255,255,0.55)"/>`,
                0, 2
            );
        }

        default:
            return wrap(`<circle cx="0" cy="0" r="5" fill="rgba(255,255,255,0.56)" />`, 10, 0);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function drawHeartEye(x, y, r) {
    const top    = y - r * 0.2;
    const bottom = y + r * 1.18;
    return `<path d="M ${round(x)} ${round(bottom)} C ${round(x - r * 1.4)} ${round(y + r * 0.2)}, ${round(x - r * 1.2)} ${round(top - r)}, ${round(x)} ${round(top)} C ${round(x + r * 1.2)} ${round(top - r)}, ${round(x + r * 1.4)} ${round(y + r * 0.2)}, ${round(x)} ${round(bottom)} Z" fill="rgba(5,10,26,0.94)" />`;
}

function drawDropletEye(x, y, r) {
    return `<path d="M ${round(x)} ${round(y - r - 1)} Q ${round(x - r)} ${round(y)} ${round(x)} ${round(y + r + 1)} Q ${round(x + r)} ${round(y)} ${round(x)} ${round(y - r - 1)} Z" fill="rgba(5,10,26,0.94)" />`;
}

function drawSpiralEye(x, y, r, direction) {
    const points = [];
    for (let index = 0; index < 18; index += 1) {
        const t     = index / 17;
        const angle = t * Math.PI * 3 * direction;
        const radius = t * (r + 2);
        points.push(`${round(x + Math.cos(angle) * radius)} ${round(y + Math.sin(angle) * radius)}`);
    }
    return `<polyline points="${points.join(' ')}" fill="none" stroke="rgba(5,10,26,0.94)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />`;
}

function midPoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function token(value) {
    return String(value || 'none').trim().toLowerCase().replaceAll(/[^a-z0-9_-]+/g, '-');
}

function clampNumber(value, fallback, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, numeric));
}

function round(value, precision = 2) {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
