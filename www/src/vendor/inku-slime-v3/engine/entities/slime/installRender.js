import { ctx, worldWidth, worldHeight, renderQuality } from '../../../runtime/runtimeState.js';
import { clamp, lerp } from '../../../shared/math.js';

// ─────────────────────────────────────────────────────────────────────────────
//  INSTALL RENDER
// ─────────────────────────────────────────────────────────────────────────────
export function installRender(Slime) {

  // ── MAIN DRAW ─────────────────────────────────────────────────────────────
  Slime.prototype.draw = function() {
    const box   = this.getBoxBounds();
    const floor = box.bottom;
    const { x: visualX, y: visualY } = this.getVisualCenter();
    const pose = this.renderPose || {};

    // ── Rarity aura (drawn under body shadow) ───────────────────────────
    if (renderQuality.rarityAura) this._drawRarityAura(visualX, visualY);

    // Shadow
    {
      const distToFloor  = floor - visualY;
      const shadowAlpha  = Math.max(0, 0.5 - distToFloor * 0.001 + (pose.shadowAlphaBoost || 0));
      const shadowScale  = Math.max(0.3, 1 - distToFloor * 0.002);
      ctx.save();
      ctx.translate(visualX, floor + 5 + (pose.liftY || 0) * 0.12);
      ctx.scale((pose.shadowX || 1) * shadowScale, 0.2 * (pose.shadowY || 1));
      ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, this.baseRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    let maxDist = this.baseRadius;
    for (let pt of this.nodes) {
      const d = Math.hypot(pt.x - visualX, pt.y - visualY);
      if (d > maxDist) maxDist = d;
    }

    const safeVisualX   = Number.isFinite(visualX) ? visualX : worldWidth * 0.5;
    const safeVisualY   = Number.isFinite(visualY) ? visualY : worldHeight * 0.5;
    const safeBaseRadius= Number.isFinite(this.baseRadius) ? Math.max(8, this.baseRadius) : 50;
    const safeMaxDist   = Number.isFinite(maxDist) ? Math.max(safeBaseRadius * 0.6, maxDist) : safeBaseRadius;
    const currentRotation = this.getCurrentRotation();

    ctx.save();
    ctx.translate(safeVisualX, safeVisualY + (pose.liftY || 0));
    ctx.transform(1, 0, pose.skewX || 0, 1, 0, 0);
    ctx.rotate(pose.roll || 0);
    ctx.scale(pose.scaleX || 1, pose.scaleY || 1);
    ctx.translate(-safeVisualX, -safeVisualY);

    this.buildBodyPath();

    // ── Color pattern fill ──────────────────────────────────────────────────
    const pattern = this.colorPattern || 'solid';
    const fillStyle = this._buildFillStyle(
      pattern, safeVisualX, safeVisualY, safeBaseRadius, safeMaxDist
    );
    ctx.fillStyle = fillStyle;
    ctx.fill();

    // ── Body overlay details (crystal facets, fractal lines…) ────────────────
    if (renderQuality.bodyOverlay) this._drawBodyOverlay(pattern, safeVisualX, safeVisualY, safeBaseRadius);

    // ── Juicy body enhancements — clipped inside body ────────────────────────
    ctx.save();
    this.buildBodyPath();
    ctx.clip();

    // ── 1. Subsurface scatter: warm glow from bottom-center ─────────────────
    if (renderQuality.subsurface) {
      const ssGrad = ctx.createRadialGradient(
        safeVisualX, safeVisualY + safeBaseRadius * 0.55, 0,
        safeVisualX, safeVisualY + safeBaseRadius * 0.3, safeBaseRadius * 1.1
      );
      const hue = this.hue;
      ssGrad.addColorStop(0,   `hsla(${hue},100%,88%,0.22)`);
      ssGrad.addColorStop(0.5, `hsla(${hue},90%,75%,0.08)`);
      ssGrad.addColorStop(1,   `hsla(${hue},80%,50%,0)`);
      ctx.fillStyle = ssGrad;
      ctx.beginPath(); ctx.arc(safeVisualX, safeVisualY, safeMaxDist * 1.3, 0, Math.PI*2); ctx.fill();
    }

    // ── 2. Rim / edge light: subtle bright ring from top-right ──────────────
    if (renderQuality.rimLight) {
      const rimGrad = ctx.createRadialGradient(
        safeVisualX + safeBaseRadius * 0.6, safeVisualY - safeBaseRadius * 0.6, safeBaseRadius * 0.3,
        safeVisualX, safeVisualY, safeMaxDist * 1.15
      );
      rimGrad.addColorStop(0,   'rgba(255,255,255,0.0)');
      rimGrad.addColorStop(0.7, 'rgba(255,255,255,0.0)');
      rimGrad.addColorStop(0.88,'rgba(255,255,255,0.13)');
      rimGrad.addColorStop(1,   'rgba(255,255,255,0.0)');
      ctx.fillStyle = rimGrad;
      ctx.beginPath(); ctx.arc(safeVisualX, safeVisualY, safeMaxDist * 1.3, 0, Math.PI*2); ctx.fill();
    }

    // ── 3. Primary specular highlight (large, soft, top-left) ───────────────
    if (renderQuality.highlights) {
      const hlGrad = ctx.createRadialGradient(
        safeVisualX - safeBaseRadius * 0.28, safeVisualY - safeBaseRadius * 0.32, 0,
        safeVisualX - safeBaseRadius * 0.28, safeVisualY - safeBaseRadius * 0.32, safeBaseRadius * 0.55
      );
      hlGrad.addColorStop(0,   'rgba(255,255,255,0.72)');
      hlGrad.addColorStop(0.35,'rgba(255,255,255,0.28)');
      hlGrad.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = hlGrad;
      ctx.beginPath();
      ctx.ellipse(
        safeVisualX - safeBaseRadius * 0.28,
        safeVisualY - safeBaseRadius * 0.32,
        safeBaseRadius * 0.38,
        safeBaseRadius * 0.24,
        -Math.PI / 4, 0, Math.PI * 2
      );
      ctx.fill();

      // ── 4. Secondary tiny specular (sharp sparkle dot) ────────────────────
      const s2Grad = ctx.createRadialGradient(
        safeVisualX - safeBaseRadius * 0.18, safeVisualY - safeBaseRadius * 0.42, 0,
        safeVisualX - safeBaseRadius * 0.18, safeVisualY - safeBaseRadius * 0.42, safeBaseRadius * 0.14
      );
      s2Grad.addColorStop(0,   'rgba(255,255,255,0.95)');
      s2Grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
      s2Grad.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = s2Grad;
      ctx.beginPath();
      ctx.arc(safeVisualX - safeBaseRadius*0.18, safeVisualY - safeBaseRadius*0.42, safeBaseRadius*0.14, 0, Math.PI*2);
      ctx.fill();
    }

    // ── 5. Bottom darkening (ground contact depth) ────────────────────────
    {
      const botGrad = ctx.createRadialGradient(
        safeVisualX, safeVisualY + safeBaseRadius * 0.7, 0,
        safeVisualX, safeVisualY + safeBaseRadius * 0.4, safeBaseRadius * 1.0
      );
      botGrad.addColorStop(0,   'rgba(0,0,0,0.18)');
      botGrad.addColorStop(0.6, 'rgba(0,0,0,0.06)');
      botGrad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = botGrad;
      ctx.beginPath(); ctx.arc(safeVisualX, safeVisualY, safeMaxDist * 1.3, 0, Math.PI*2); ctx.fill();
    }

    this.drawFace(currentRotation, visualX, visualY);
    ctx.restore();

    // ── 6. Outer glow stroke (soft outline with body color) ───────────────
    {
      ctx.save();
      this.buildBodyPath();
      const hue = this.hue; const sat = this.saturation; const lit = this.lightness;
      ctx.strokeStyle = `hsla(${hue},${Math.min(100,sat+10)}%,${Math.min(95,lit+20)}%,0.55)`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Darker inner outline for crispness
      ctx.strokeStyle = `hsla(${hue},${Math.max(30,sat-10)}%,${Math.max(10,lit-30)}%,0.25)`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }

    this.drawAccessory(currentRotation, visualX, visualY);
    ctx.restore();
  };

  // ── COLOR FILL BUILDER ────────────────────────────────────────────────────
  Slime.prototype._buildFillStyle = function(pattern, cx, cy, br, maxDist) {
    const hue  = this.hue;
    const sat  = this.saturation;
    const lit  = this.lightness;
    const darkLit = Math.max(12, lit - 16);
    const darkSat = Math.max(35, sat - 8);

    const c1 = `hsl(${hue},${sat}%,${lit}%)`;
    const c2 = `hsl(${hue},${darkSat}%,${darkLit}%)`;
    const hue2 = this.genome?.hue2 ?? ((hue + 90) % 360);
    const sat2 = this.genome?.sat2 ?? sat;
    const lit2 = this.genome?.lit2 ?? lit;
    const c3 = `hsl(${hue2},${sat2}%,${lit2}%)`;
    const c3dark = `hsl(${hue2},${Math.max(35,sat2-8)}%,${Math.max(12,lit2-16)}%)`;

    if (pattern === 'solid') {
      const grad = ctx.createRadialGradient(
        cx - br * 0.2, cy - br * 0.3, br * 0.1,
        cx, cy, maxDist * 1.2
      );
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      return grad;
    }

    if (pattern === 'radial_glow') {
      const grad = ctx.createRadialGradient(cx - br*0.15, cy - br*0.2, br*0.05, cx, cy, maxDist*1.3);
      grad.addColorStop(0, `hsl(${hue},${Math.min(100,sat+10)}%,${Math.min(90,lit+12)}%)`);
      grad.addColorStop(0.5, c1);
      grad.addColorStop(1, c2);
      return grad;
    }

    if (pattern === 'gradient_v') {
      const grad = ctx.createLinearGradient(cx, cy - maxDist, cx, cy + maxDist);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2); return grad;
    }
    if (pattern === 'gradient_h') {
      const grad = ctx.createLinearGradient(cx - maxDist, cy, cx + maxDist, cy);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2); return grad;
    }
    if (pattern === 'gradient_diag') {
      const grad = ctx.createLinearGradient(cx - maxDist, cy - maxDist, cx + maxDist, cy + maxDist);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2); return grad;
    }

    if (pattern === 'duo_tone') {
      const grad = ctx.createLinearGradient(cx, cy - maxDist, cx, cy + maxDist);
      grad.addColorStop(0, c1); grad.addColorStop(0.5, c3); grad.addColorStop(1, c3dark); return grad;
    }

    if (pattern === 'stripe_v') {
      // Approximated with gradient (canvas doesn't do repeating patterns easily)
      const grad = ctx.createLinearGradient(cx - maxDist, cy, cx + maxDist, cy);
      grad.addColorStop(0, c1); grad.addColorStop(0.25, c3); grad.addColorStop(0.5, c1);
      grad.addColorStop(0.75, c3); grad.addColorStop(1, c1); return grad;
    }

    if (pattern === 'galaxy_swirl') {
      const grad = ctx.createRadialGradient(cx, cy, br * 0.05, cx, cy, maxDist * 1.3);
      grad.addColorStop(0, `hsl(${(hue+200)%360},90%,85%)`);
      grad.addColorStop(0.3, c3);
      grad.addColorStop(0.6, c1);
      grad.addColorStop(1, c2);
      return grad;
    }

    if (pattern === 'aurora') {
      const grad = ctx.createLinearGradient(cx - maxDist, cy - maxDist * 0.5, cx + maxDist, cy + maxDist * 0.5);
      grad.addColorStop(0, `hsl(${(hue+140)%360},${sat}%,${Math.min(90,lit+10)}%)`);
      grad.addColorStop(0.33, c1);
      grad.addColorStop(0.66, c3);
      grad.addColorStop(1, `hsl(${(hue+280)%360},${sat}%,${Math.min(90,lit+5)}%)`);
      return grad;
    }

    if (pattern === 'crystal_facets') {
      const grad = ctx.createRadialGradient(cx - br*0.3, cy - br*0.4, br*0.05, cx, cy, maxDist);
      grad.addColorStop(0, `hsla(${hue},${Math.min(100,sat+10)}%,${Math.min(95,lit+20)}%,0.9)`);
      grad.addColorStop(0.4, c1);
      grad.addColorStop(0.8, c3);
      grad.addColorStop(1, c2);
      return grad;
    }

    if (pattern === 'soft_spots') {
      const grad = ctx.createRadialGradient(cx, cy, br * 0.1, cx, cy, maxDist * 1.2);
      grad.addColorStop(0, c3); grad.addColorStop(0.6, c1); grad.addColorStop(1, c2);
      return grad;
    }

    if (pattern === 'prismatic') {
      const grad = ctx.createLinearGradient(cx - maxDist, cy, cx + maxDist, cy);
      const stops = [0, 60, 120, 180, 240, 300, 360];
      stops.forEach((h, i) => grad.addColorStop(i / (stops.length - 1), `hsl(${h},85%,${lit}%)`));
      return grad;
    }

    if (pattern === 'void_rift') {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDist * 1.2);
      grad.addColorStop(0, `hsl(${hue},30%,8%)`);
      grad.addColorStop(0.3, `hsl(${hue},70%,20%)`);
      grad.addColorStop(0.7, c1);
      grad.addColorStop(1, `hsl(${(hue+180)%360},${sat}%,${lit}%)`);
      return grad;
    }

    // Fallback to radial
    const grad = ctx.createRadialGradient(cx - br*0.2, cy - br*0.3, br*0.1, cx, cy, maxDist*1.2);
    grad.addColorStop(0, c1); grad.addColorStop(1, c2); return grad;
  };

  // ── BODY OVERLAY ──────────────────────────────────────────────────────────
  Slime.prototype._drawBodyOverlay = function(pattern, cx, cy, br) {
    if (pattern === 'crystal_facets') {
      ctx.save();
      this.buildBodyPath();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x2 = cx + Math.cos(a) * br * 0.9;
        const y2 = cy + Math.sin(a) * br * 0.9;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.restore();
    } else if (pattern === 'soft_spots') {
      ctx.save();
      this.buildBodyPath();
      ctx.clip();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const r = br * (0.3 + i * 0.08);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, br * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
      }
      ctx.restore();
    } else if (pattern === 'galaxy_swirl') {
      ctx.save();
      this.buildBodyPath();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const t = i / 19;
        const a = t * Math.PI * 4;
        const r = t * br * 0.8;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) { ctx.beginPath(); ctx.moveTo(x, y); } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    } else if (pattern === 'void_rift') {
      ctx.save();
      this.buildBodyPath();
      ctx.clip();
      ctx.strokeStyle = 'rgba(180,100,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - br * 0.4, cy - br * 0.1);
      ctx.bezierCurveTo(cx - br * 0.1, cy - br * 0.4, cx + br * 0.1, cy + br * 0.2, cx + br * 0.5, cy - br * 0.3);
      ctx.stroke();
      ctx.restore();
    } else if (pattern === 'stripe_v') {
      ctx.save();
      this.buildBodyPath();
      ctx.clip();
      const stripeW = br * 0.28;
      for (let i = -3; i <= 3; i++) {
        ctx.fillStyle = (Math.abs(i) % 2 === 0) ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(cx + i * stripeW - stripeW / 2, cy - br * 1.5, stripeW, br * 3);
      }
      ctx.restore();
    } else if (pattern === 'aurora') {
      ctx.save();
      this.buildBodyPath();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const oy = -br * 0.3 + i * br * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx - br, cy + oy);
        ctx.bezierCurveTo(cx - br * 0.3, cy + oy - br * 0.2, cx + br * 0.3, cy + oy + br * 0.2, cx + br, cy + oy);
        ctx.stroke();
      }
      ctx.restore();
    } else if (pattern === 'prismatic') {
      ctx.save();
      this.buildBodyPath();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * br * 0.25, cy - br);
        ctx.lineTo(cx + i * br * 0.25, cy + br);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  ACCESSORY DRAW
  // ─────────────────────────────────────────────────────────────────────────
  Slime.prototype.drawAccessory = function(rotation, visualX, visualY) {
    if (this.accessory === 'none' || !this.accessoryAttachment) return;

    const attachment = this.accessoryAttachment;
    const anchor = this.getSurfaceAnchorFromLocal(
      attachment.localX, attachment.localY, visualX, visualY, rotation
    );

    const anchorX = anchor.x + anchor.normalX * attachment.skinOffset;
    const anchorY = anchor.y + anchor.normalY * attachment.skinOffset;
    const accessoryRotation = anchor.rotation + attachment.rotationOffset;
    const accessoryScale = Math.max(0.8, this.baseRadius / 62) * (attachment.scaleBoost || 1) * this.accessorySizeBias;

    ctx.save();
    ctx.translate(anchorX, anchorY);
    ctx.rotate(accessoryRotation);
    ctx.scale(accessoryScale, accessoryScale);

    this._drawAccessoryShape(this.accessory);

    ctx.restore();
  };

  Slime.prototype._drawAccessoryShape = function(acc) {
    switch (acc) {
      // ── Legacy accessories (upgraded) ─────────────────────────────────────
      case 'bow': {
        const bowG = ctx.createRadialGradient(0,-2,0,0,-2,22);
        bowG.addColorStop(0,'#ff7fa3'); bowG.addColorStop(0.6,'#ff4d6d'); bowG.addColorStop(1,'#c9184a');
        ctx.fillStyle = bowG;
        ctx.beginPath(); ctx.moveTo(0,2); ctx.lineTo(-18,-10); ctx.lineTo(-14,13); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0,2); ctx.lineTo(18,-10); ctx.lineTo(14,13); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath(); ctx.arc(0,2,5,0,Math.PI*2); ctx.fill();
        // Shine
        ctx.fillStyle='rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.ellipse(-10,-4,4,2,-0.5,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(10,-4,4,2,0.5,0,Math.PI*2); ctx.fill();
        break;
      }
      case 'leaf':
        ctx.strokeStyle = '#208b3a'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-2,2); ctx.lineTo(16,-16); ctx.stroke();
        ctx.fillStyle = '#2dc653'; ctx.beginPath(); ctx.ellipse(14,-16,18,7,-Math.PI/4,0,Math.PI*2); ctx.fill();
        break;
      case 'sprout':
        ctx.strokeStyle = '#1f7a1f'; ctx.lineWidth = 2.3;
        ctx.beginPath(); ctx.moveTo(0,4); ctx.quadraticCurveTo(0,-8,0,-20); ctx.stroke();
        ctx.fillStyle = '#52b788';
        ctx.beginPath(); ctx.ellipse(-7,-16,8,4,-0.6,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(7,-16,8,4,0.6,0,Math.PI*2); ctx.fill();
        break;
      case 'horns': {
        [-1,1].forEach(side => {
          const hg = ctx.createLinearGradient(side*10,2,side*20,-28);
          hg.addColorStop(0,'#f0f0f0'); hg.addColorStop(0.4,'#ffffff'); hg.addColorStop(1,'#b0b0b0');
          ctx.fillStyle = hg;
          ctx.beginPath(); ctx.moveTo(side*10,2); ctx.quadraticCurveTo(side*18,-14,side*22,-30); ctx.quadraticCurveTo(side*8,-20,side*3,-4); ctx.closePath(); ctx.fill();
          ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1.2; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(side*12,0); ctx.quadraticCurveTo(side*17,-12,side*20,-26); ctx.stroke();
          ctx.lineCap='butt';
        });
        break;
      }
      case 'flower': {
        const petalColors = ['#ff8fab','#ff6b8a','#ffb3c6','#ff8fab','#ffa0b8'];
        for (let i=0;i<5;i++) {
          ctx.save(); ctx.rotate((Math.PI*2*i)/5);
          const pg = ctx.createRadialGradient(0,-10,0,0,-10,10);
          pg.addColorStop(0,petalColors[i]); pg.addColorStop(1,'#e05070');
          ctx.fillStyle = pg;
          ctx.beginPath(); ctx.ellipse(0,-10,5,10,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.3)';
          ctx.beginPath(); ctx.ellipse(-1.5,-10,2,5,0,0,Math.PI*2); ctx.fill();
          ctx.restore();
        }
        const cg = ctx.createRadialGradient(0,0,0,0,0,6);
        cg.addColorStop(0,'#ffe082'); cg.addColorStop(1,'#f9a825');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(0,0,5.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(-1.5,-1.5,2,0,Math.PI*2); ctx.fill();
        break;
      }
      case 'star_pin': {
        const stg = ctx.createRadialGradient(0,0,0,0,0,14);
        stg.addColorStop(0,'#fff9c4'); stg.addColorStop(0.4,'#ffd166'); stg.addColorStop(1,'#f9a825');
        ctx.fillStyle = stg;
        ctx.shadowColor='rgba(255,200,50,0.6)'; ctx.shadowBlur=8;
        ctx.beginPath();
        for (let i=0;i<5;i++) { const oa=-Math.PI/2+i*(Math.PI*2/5); const ia=oa+Math.PI/5; if(i===0) ctx.moveTo(Math.cos(oa)*12,Math.sin(oa)*12); else ctx.lineTo(Math.cos(oa)*12,Math.sin(oa)*12); ctx.lineTo(Math.cos(ia)*5,Math.sin(ia)*5); }
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(-3,-6,2.5,0,Math.PI*2); ctx.fill();
        break;
      }
      case 'mushroom': {
        const capG = ctx.createRadialGradient(-4,-12,0,0,-8,16);
        capG.addColorStop(0,'#ff6b6b'); capG.addColorStop(0.5,'#f94144'); capG.addColorStop(1,'#c1121f');
        ctx.fillStyle = capG;
        ctx.beginPath(); ctx.arc(0,-8,14,Math.PI,0); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.arc(0,-8,14,Math.PI,0); ctx.fill(); // subtle highlight
        // Spots with glow
        [[-5,-9,2.5],[4,-12,2]].forEach(([sx,sy,sr]) => {
          ctx.fillStyle='rgba(255,255,255,0.92)';
          ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.4)';
          ctx.beginPath(); ctx.arc(sx-0.5,sy-0.5,sr*0.5,0,Math.PI*2); ctx.fill();
        });
        // Stem gradient
        const stemG = ctx.createLinearGradient(-3,-8,3,8);
        stemG.addColorStop(0,'#fff8e1'); stemG.addColorStop(1,'#f5e6cc');
        ctx.fillStyle = stemG;
        ctx.beginPath(); ctx.roundRect(-3,-8,6,16,2); ctx.fill();
        break;
      }
      case 'crown': {
        const crownG = ctx.createLinearGradient(-16,6,16,-14);
        crownG.addColorStop(0,'#c8922a'); crownG.addColorStop(0.3,'#ffd166'); crownG.addColorStop(0.6,'#ffe082'); crownG.addColorStop(1,'#f9a825');
        ctx.fillStyle = crownG;
        ctx.shadowColor='rgba(200,150,0,0.5)'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.moveTo(-16,6); ctx.lineTo(-12,-10); ctx.lineTo(-4,0); ctx.lineTo(0,-14); ctx.lineTo(4,0); ctx.lineTo(12,-10); ctx.lineTo(16,6); ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // Gems on tips
        [[-12,-10],[0,-14],[12,-10]].forEach(([gx,gy],i) => {
          const gemColors = ['#e63946','#4ecdc4','#e63946'];
          ctx.fillStyle = gemColors[i];
          ctx.beginPath(); ctx.arc(gx,gy,2.5,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.6)';
          ctx.beginPath(); ctx.arc(gx-0.8,gy-0.8,1,0,Math.PI*2); ctx.fill();
        });
        // Crown highlight
        ctx.fillStyle='rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.moveTo(-14,4); ctx.lineTo(-10,-8); ctx.lineTo(-3,-0); ctx.lineTo(-14,4); ctx.closePath(); ctx.fill();
        break;
      }
      case 'halo': {
        ctx.shadowColor='rgba(255,220,80,0.9)'; ctx.shadowBlur=14;
        const haloG = ctx.createLinearGradient(-16,-18,16,-18);
        haloG.addColorStop(0,'rgba(255,210,60,0.8)');
        haloG.addColorStop(0.5,'rgba(255,245,150,1)');
        haloG.addColorStop(1,'rgba(255,210,60,0.8)');
        ctx.strokeStyle = haloG; ctx.lineWidth=4;
        ctx.beginPath(); ctx.ellipse(0,-18,16,6,0,0,Math.PI*2); ctx.stroke();
        ctx.shadowBlur=0;
        // Inner light ring
        ctx.strokeStyle='rgba(255,255,200,0.4)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.ellipse(0,-18,12,4,0,0,Math.PI*2); ctx.stroke();
        break;
      }
      case 'antenna': {
        // Stem with glow
        ctx.shadowColor='rgba(255,60,100,0.4)'; ctx.shadowBlur=6;
        ctx.strokeStyle='#d90429'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(0,5); ctx.quadraticCurveTo(5,-10,0,-24); ctx.stroke();
        ctx.shadowBlur=0;
        // Orb
        const orbG = ctx.createRadialGradient(-2,-28,0,0,-26,7);
        orbG.addColorStop(0,'#ff9ec4'); orbG.addColorStop(0.5,'#ff4d6d'); orbG.addColorStop(1,'#c9184a');
        ctx.fillStyle = orbG;
        ctx.shadowColor='rgba(255,80,100,0.7)'; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(0,-26,6,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(-2,-28,2,0,Math.PI*2); ctx.fill();
        break;
      }
      case 'broken_halo': {
        ctx.shadowColor='rgba(180,200,255,0.7)'; ctx.shadowBlur=12;
        const bhG = ctx.createLinearGradient(-16,-18,16,-18);
        bhG.addColorStop(0,'rgba(200,210,255,0.6)');
        bhG.addColorStop(0.5,'rgba(255,255,255,0.95)');
        bhG.addColorStop(1,'rgba(200,210,255,0.6)');
        ctx.strokeStyle = bhG; ctx.lineWidth=3.5;
        ctx.beginPath(); ctx.arc(0,-18,16,Math.PI*0.15,Math.PI*0.85); ctx.stroke();
        ctx.beginPath(); ctx.arc(0,-18,16,Math.PI*1.1,Math.PI*1.75); ctx.stroke();
        ctx.shadowBlur=0;
        // Energy sparks at break points
        ctx.strokeStyle='rgba(255,220,100,0.8)'; ctx.lineWidth=1.2;
        [[Math.PI*0.15,-18],[Math.PI*0.85,-18],[Math.PI*1.1,-18],[Math.PI*1.75,-18]].forEach(([a]) => {
          const bx=Math.cos(a)*16; const by=Math.sin(a)*16-18;
          ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+Math.cos(a)*4,by+Math.sin(a)*4); ctx.stroke();
        });
        break;
      }
      case 'clover':
        ctx.fillStyle='#52b788';
        [[-4,-8],[4,-8],[-4,0],[4,0]].forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill(); });
        ctx.strokeStyle='#2d6a4f'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(0,2); ctx.quadraticCurveTo(3,10,8,14); ctx.stroke();
        break;
      case 'feather':
        ctx.fillStyle='#e9edc9'; ctx.beginPath(); ctx.moveTo(-2,10); ctx.quadraticCurveTo(10,-2,4,-18); ctx.quadraticCurveTo(-6,-8,-2,10); ctx.fill();
        ctx.strokeStyle='#a3b18a'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(-1,8); ctx.lineTo(4,-16); ctx.stroke();
        break;
      case 'shell_pin':
        ctx.fillStyle='#ffd6a5'; ctx.beginPath(); ctx.arc(0,0,10,Math.PI,0); ctx.fill();
        ctx.strokeStyle='#e5989b'; ctx.lineWidth=1.5;
        [-6,-2,2,6].forEach(x => { ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(x,-8); ctx.stroke(); });
        break;
      case 'bone_pin':
        ctx.strokeStyle='#f1f3f5'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.moveTo(-9,9); ctx.lineTo(9,-9); ctx.stroke();
        [[-10,10],[-6,6],[10,-10],[6,-6]].forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fillStyle='#f8f9fa'; ctx.fill(); });
        break;

      // ── New Cute Accessories ─────────────────────────────────────────────
      case 'ribbon_bow': {
        const rbG = ctx.createRadialGradient(0,0,0,0,0,22);
        rbG.addColorStop(0,'#ffadc4'); rbG.addColorStop(0.6,'#ff85a1'); rbG.addColorStop(1,'#e0547a');
        ctx.fillStyle = rbG;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(-20,-12,-22,10,-5,5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(20,-12,22,10,5,5); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.ellipse(-10,-4,4,2,-0.4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(10,-4,4,2,0.4,0,Math.PI*2); ctx.fill();
        const kG = ctx.createRadialGradient(-1,-1,0,0,2,5);
        kG.addColorStop(0,'#ff85a1'); kG.addColorStop(1,'#c9184a');
        ctx.fillStyle = kG;
        ctx.beginPath(); ctx.arc(0,2,4.5,0,Math.PI*2); ctx.fill();
        break;
      }
      case 'mini_crown': {
        const mcG = ctx.createLinearGradient(-10,4,10,-10);
        mcG.addColorStop(0,'#c8922a'); mcG.addColorStop(0.5,'#ffe082'); mcG.addColorStop(1,'#ffd166');
        ctx.fillStyle = mcG;
        ctx.shadowColor='rgba(200,140,0,0.4)'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.moveTo(-10,4); ctx.lineTo(-8,-6); ctx.lineTo(-3,0); ctx.lineTo(0,-10); ctx.lineTo(3,0); ctx.lineTo(8,-6); ctx.lineTo(10,4); ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        const gemG = ctx.createRadialGradient(-1,-9,0,0,-8,4);
        gemG.addColorStop(0,'#ff8a9a'); gemG.addColorStop(1,'#e63946');
        ctx.fillStyle = gemG;
        ctx.beginPath(); ctx.arc(0,-8,3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-0.8,-9,1,0,Math.PI*2); ctx.fill();
        break;
      }
      case 'candy_pin': {
        const candyG = ctx.createRadialGradient(-3,-11,0,0,-8,11);
        candyG.addColorStop(0,'#ff9ec4'); candyG.addColorStop(0.5,'#ff4d6d'); candyG.addColorStop(1,'#c9184a');
        ctx.fillStyle = candyG;
        ctx.shadowColor='rgba(255,80,100,0.5)'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.arc(0,-8,9,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,0.35)';
        for (let i=0;i<3;i++) {
          const a=i*(Math.PI*2/3)-0.5;
          ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(Math.cos(a)*7,Math.sin(a)*7-8); ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1.5; ctx.stroke();
        }
        ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(-3,-11,2.5,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#c9184a'; ctx.lineWidth=2.5; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0,1); ctx.lineTo(0,14); ctx.lineTo(3,16); ctx.stroke();
        ctx.lineCap='butt';
        break;
      }
      case 'cloud_puff': {
        // Multi-layer cloud with depth
        // Shadow layer
        ctx.fillStyle='rgba(200,220,255,0.3)';
        [[-8,-8],[0,-12],[8,-8],[12,-4],[-12,-4]].forEach(([x,y]) => {
          ctx.beginPath(); ctx.arc(x,y+3,7,0,Math.PI*2); ctx.fill();
        });
        const cloudG = ctx.createLinearGradient(0,-16,0,-2);
        cloudG.addColorStop(0,'rgba(255,255,255,0.98)');
        cloudG.addColorStop(1,'rgba(235,240,255,0.9)');
        ctx.fillStyle = cloudG;
        [[-8,-10],[0,-14],[8,-10],[12,-6],[-12,-6]].forEach(([x,y],i) => {
          ctx.beginPath(); ctx.arc(x,y,6.5+i*0.3,0,Math.PI*2); ctx.fill();
        });
        // Sparkles
        ctx.fillStyle='rgba(200,220,255,0.8)';
        [[-4,-14],[6,-12]].forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x,y,1.2,0,Math.PI*2); ctx.fill(); });
        break;
      }
      case 'cherry_clip': {
        // Stems
        ctx.strokeStyle='#2d6a4f'; ctx.lineWidth=2.2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-4,0); ctx.quadraticCurveTo(-8,-14,-2,-20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4,0); ctx.quadraticCurveTo(8,-14,2,-20); ctx.stroke();
        ctx.lineCap='butt';
        // Cherries with gradient
        [-2,2].forEach((cx2) => {
          const cg = ctx.createRadialGradient(cx2-1.5,-21.5,0,cx2,-20,6);
          cg.addColorStop(0,'#ff6b6b'); cg.addColorStop(0.5,'#e63946'); cg.addColorStop(1,'#9b1d22');
          ctx.fillStyle = cg;
          ctx.beginPath(); ctx.arc(cx2,-20,5.5,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.5)';
          ctx.beginPath(); ctx.arc(cx2-1.5,-22,1.8,0,Math.PI*2); ctx.fill();
        });
        break;
      }

      // ── New Normal Accessories ───────────────────────────────────────────
      case 'twig':
        ctx.strokeStyle='#6b4226'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(-2,8); ctx.lineTo(2,-18); ctx.stroke();
        ctx.lineWidth=1.8; ctx.strokeStyle='#8b6347';
        ctx.beginPath(); ctx.moveTo(2,-8); ctx.lineTo(10,-14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(-8,-10); ctx.stroke();
        break;
      case 'bandana':
        ctx.fillStyle='#e63946';
        ctx.beginPath(); ctx.moveTo(-14,2); ctx.lineTo(14,2); ctx.lineTo(8,14); ctx.lineTo(0,8); ctx.lineTo(-8,14); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(-8,6); ctx.lineTo(8,6); ctx.stroke();
        break;
      case 'monocle_top':
        ctx.strokeStyle='#adb5bd'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(6,-6,8,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle='#868e96'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(14,-6); ctx.lineTo(20,-2); ctx.stroke();
        break;
      case 'lantern_float':
        ctx.fillStyle='rgba(255,220,100,0.85)';
        ctx.beginPath(); ctx.ellipse(0,-12,8,12,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(200,120,0,0.6)'; ctx.lineWidth=1.2;
        for (let i=-2;i<=2;i++) { ctx.beginPath(); ctx.moveTo(i*3,-2); ctx.lineTo(i*3,-22); ctx.stroke(); }
        ctx.fillStyle='rgba(255,150,0,0.4)';
        ctx.beginPath(); ctx.arc(0,-12,4,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#888'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(0,-1); ctx.lineTo(0,6); ctx.stroke();
        break;
      case 'beret':
        ctx.fillStyle='#457b9d';
        ctx.beginPath(); ctx.ellipse(0,-12,14,10,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#1d3557'; ctx.beginPath(); ctx.ellipse(0,-5,16,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#a8dadc'; ctx.beginPath(); ctx.arc(6,-14,3,0,Math.PI*2); ctx.fill();
        break;
      case 'ancient_rune':
        ctx.strokeStyle='rgba(180,140,60,0.9)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(0,4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-8,-12); ctx.lineTo(8,-12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6,-6); ctx.lineTo(6,-6); ctx.stroke();
        ctx.shadowColor='rgba(255,200,50,0.5)'; ctx.shadowBlur=6;
        ctx.strokeStyle='rgba(255,220,80,0.6)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(0,4); ctx.stroke();
        ctx.shadowBlur=0;
        break;
      case 'gem_cluster':
        [[-6,-14,'#a29bfe'],[4,-18,'#74b9ff'],[2,-8,'#fd79a8']].forEach(([x,y,c]) => {
          ctx.fillStyle=c;
          ctx.beginPath(); ctx.moveTo(x,y-5); ctx.lineTo(x-4,y+1); ctx.lineTo(x,y+4); ctx.lineTo(x+4,y+1); ctx.closePath(); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.35)';
          ctx.beginPath(); ctx.moveTo(x-1,y-4); ctx.lineTo(x-3,y); ctx.lineTo(x,y-5); ctx.closePath(); ctx.fill();
        });
        break;
      case 'wind_streamer':
        ctx.strokeStyle='rgba(180,220,255,0.7)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(8,-8,16,-4,14,-16); ctx.stroke();
        ctx.strokeStyle='rgba(200,180,255,0.6)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(0,-4); ctx.bezierCurveTo(6,-12,14,-8,12,-20); ctx.stroke();
        break;

      // ── New Scary Accessories ────────────────────────────────────────────
      case 'thorn_ring':
        ctx.strokeStyle='#2d3436'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.ellipse(0,-10,14,8,0,0,Math.PI*2); ctx.stroke();
        for (let i=0;i<8;i++) {
          const a=(i/8)*Math.PI*2; const rx=Math.cos(a)*14; const ry=Math.sin(a)*8-10;
          ctx.fillStyle='#636e72';
          ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx+Math.cos(a)*6,ry+Math.sin(a)*6); ctx.lineTo(rx+Math.cos(a+0.3)*3,ry+Math.sin(a+0.3)*3); ctx.closePath(); ctx.fill();
        }
        break;
      case 'skull_pin': {
        // Shadow
        ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.shadowBlur=6;
        const skullG = ctx.createRadialGradient(-2,-14,0,0,-12,12);
        skullG.addColorStop(0,'#ffffff'); skullG.addColorStop(0.7,'#e8e8e8'); skullG.addColorStop(1,'#c0c0c0');
        ctx.fillStyle = skullG;
        ctx.beginPath(); ctx.ellipse(0,-12,8,9,0,0,Math.PI*2); ctx.fill();
        ctx.fillRect(-5,-8,10,5);
        ctx.shadowBlur=0;
        // Eye sockets with depth
        ctx.fillStyle='#1a1a2e';
        ctx.beginPath(); ctx.ellipse(-3,-13,2.8,3.2,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(3,-13,2.8,3.2,0,0,Math.PI*2); ctx.fill();
        // Glowing eyes
        ctx.fillStyle='rgba(100,255,100,0.5)';
        ctx.beginPath(); ctx.arc(-3,-13,1.2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(3,-13,1.2,0,Math.PI*2); ctx.fill();
        // Teeth
        ctx.fillStyle='rgba(200,200,200,0.9)';
        ctx.strokeStyle='#343a40'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(-4,-6); ctx.lineTo(-1,-6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1,-6); ctx.lineTo(4,-6); ctx.stroke();
        // Highlight
        ctx.fillStyle='rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.ellipse(-2,-16,2.5,1.5,0.2,0,Math.PI*2); ctx.fill();
        break;
      }
      case 'iron_mask': {
        const maskG = ctx.createLinearGradient(-10,-18,10,-4);
        maskG.addColorStop(0,'#adb5bd'); maskG.addColorStop(0.4,'#ced4da'); maskG.addColorStop(1,'#6c757d');
        ctx.fillStyle = maskG;
        ctx.shadowColor='rgba(0,0,0,0.3)'; ctx.shadowBlur=5;
        ctx.beginPath(); ctx.roundRect(-10,-18,20,14,2); ctx.fill();
        ctx.shadowBlur=0;
        // Rivets
        ctx.fillStyle='#adb5bd';
        [[-8,-17],[8,-17],[-8,-6],[8,-6]].forEach(([rx,ry]) => {
          ctx.beginPath(); ctx.arc(rx,ry,1.5,0,Math.PI*2); ctx.fill();
        });
        // Eye slits with glow
        ctx.fillStyle='rgba(255,60,0,0.7)';
        ctx.shadowColor='rgba(255,80,0,0.8)'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.ellipse(-4,-12,3.5,1.8,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(4,-12,3.5,1.8,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // Ventilation slits
        ctx.strokeStyle='rgba(50,50,60,0.6)'; ctx.lineWidth=1;
        for (let i=-6;i<=6;i+=3) { ctx.beginPath(); ctx.moveTo(i,-8); ctx.lineTo(i,-6); ctx.stroke(); }
        // Metal highlight
        ctx.fillStyle='rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.rect(-9,-17,18,4); ctx.fill();
        break;
      }
      case 'eye_crown': {
        const ecG = ctx.createLinearGradient(-14,2,14,-14);
        ecG.addColorStop(0,'#2d3436'); ecG.addColorStop(0.5,'#495057'); ecG.addColorStop(1,'#2d3436');
        ctx.fillStyle = ecG;
        ctx.shadowColor='rgba(100,80,255,0.5)'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.moveTo(-14,2); ctx.lineTo(-10,-10); ctx.lineTo(-4,0); ctx.lineTo(0,-14); ctx.lineTo(4,0); ctx.lineTo(10,-10); ctx.lineTo(14,2); ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        [[0,-12],[-8,-6],[8,-6]].forEach(([x,y]) => {
          // Eye iris gradient
          const eyeG = ctx.createRadialGradient(x,y,0,x,y,3.5);
          eyeG.addColorStop(0,'#c8b2ff'); eyeG.addColorStop(0.6,'#a29bfe'); eyeG.addColorStop(1,'#6c5ce7');
          ctx.fillStyle = eyeG;
          ctx.beginPath(); ctx.ellipse(x,y,3.5,2.5,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#1a0a2e'; ctx.beginPath(); ctx.arc(x,y,1.2,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x-0.8,y-0.8,0.8,0,Math.PI*2); ctx.fill();
        });
        break;
      }
      case 'cursed_chain': {
        const t = Date.now()*0.002;
        for (let i=0;i<4;i++) {
          const y=-4-i*5;
          const pulse = 0.3+0.2*Math.sin(t+i);
          ctx.shadowColor=`rgba(150,50,255,${pulse})`; ctx.shadowBlur=6;
          ctx.strokeStyle=`rgba(100,80,130,0.9)`; ctx.lineWidth=2.2;
          ctx.beginPath(); ctx.ellipse(0,y,3.5,1.8,0,0,Math.PI*2); ctx.stroke();
        }
        ctx.shadowBlur=0;
        const orbG2 = ctx.createRadialGradient(-1,-23,0,0,-22,5);
        orbG2.addColorStop(0,'#d8b4ff'); orbG2.addColorStop(0.6,'#9b59b6'); orbG2.addColorStop(1,'#4a0080');
        ctx.fillStyle = orbG2;
        ctx.shadowColor='rgba(180,100,255,0.8)'; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(0,-22,5,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(-1.5,-23.5,1.5,0,Math.PI*2); ctx.fill();
        break;
      }
      case 'demon_wings': {
        [-1,1].forEach(side => {
          const dwG = ctx.createRadialGradient(side*8,-14,0,side*8,-10,22);
          dwG.addColorStop(0,'rgba(180,30,20,0.95)');
          dwG.addColorStop(0.6,'rgba(100,0,0,0.8)');
          dwG.addColorStop(1,'rgba(50,0,0,0.5)');
          ctx.fillStyle = dwG;
          ctx.beginPath();
          ctx.moveTo(side*2,-4);
          ctx.bezierCurveTo(side*12,-8,side*24,-4,side*22,-18);
          ctx.bezierCurveTo(side*14,-28,side*6,-20,side*2,-12);
          ctx.closePath(); ctx.fill();
          // Ribs
          ctx.strokeStyle='rgba(60,0,0,0.55)'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(side*2,-8); ctx.lineTo(side*16,-16); ctx.stroke();
          // Wing edge glow
          ctx.strokeStyle='rgba(255,80,30,0.2)'; ctx.lineWidth=2.5;
          ctx.beginPath();
          ctx.moveTo(side*2,-4);
          ctx.bezierCurveTo(side*12,-8,side*24,-4,side*22,-18);
          ctx.stroke();
        });
        break;
      }
      case 'void_crown': {
        const vcG = ctx.createLinearGradient(-16,2,16,-18);
        vcG.addColorStop(0,'#0d0d1a'); vcG.addColorStop(0.5,'#1a1a2e'); vcG.addColorStop(1,'#0d0d1a');
        ctx.fillStyle = vcG;
        ctx.shadowColor='rgba(80,0,200,0.6)'; ctx.shadowBlur=12;
        ctx.beginPath(); ctx.moveTo(-16,2); ctx.lineTo(-12,-14); ctx.lineTo(-4,-2); ctx.lineTo(0,-18); ctx.lineTo(4,-2); ctx.lineTo(12,-14); ctx.lineTo(16,2); ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // Pulsing gems
        const t2 = Date.now()*0.002;
        [-4,0,4].forEach((x,i) => {
          const pulse = 0.6+0.4*Math.sin(t2+i*1.1);
          const gG = ctx.createRadialGradient(x,-2,0,x,-2,3);
          gG.addColorStop(0,`rgba(200,150,255,${pulse})`);
          gG.addColorStop(1,`rgba(80,0,180,${pulse*0.5})`);
          ctx.fillStyle = gG;
          ctx.shadowColor=`rgba(140,60,255,${pulse*0.8})`; ctx.shadowBlur=8;
          ctx.beginPath(); ctx.arc(x,-2,2.5,0,Math.PI*2); ctx.fill();
        });
        ctx.shadowBlur=0;
        // Crown highlight
        ctx.fillStyle='rgba(120,80,255,0.15)';
        ctx.beginPath(); ctx.moveTo(-14,2); ctx.lineTo(-10,-12); ctx.lineTo(-4,0); ctx.closePath(); ctx.fill();
        break;
      }
      case 'shadow_cloak': {
        const scG = ctx.createRadialGradient(0,-12,0,0,-8,22);
        scG.addColorStop(0,'rgba(40,20,70,0.85)');
        scG.addColorStop(0.7,'rgba(20,10,40,0.7)');
        scG.addColorStop(1,'rgba(0,0,0,0.3)');
        ctx.fillStyle = scG;
        ctx.beginPath(); ctx.moveTo(-14,2); ctx.bezierCurveTo(-20,-6,-18,-18,-10,-20); ctx.bezierCurveTo(-4,-22,0,-14,0,-8); ctx.bezierCurveTo(0,-14,4,-22,10,-20); ctx.bezierCurveTo(18,-18,20,-6,14,2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(160,100,255,0.35)'; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.moveTo(-10,-10); ctx.lineTo(10,-10); ctx.stroke();
        // Sparkles along edge
        ctx.fillStyle='rgba(180,140,255,0.4)';
        [[-12,-8],[-6,-16],[6,-16],[12,-8]].forEach(([sx,sy]) => {
          ctx.beginPath(); ctx.arc(sx,sy,1.2,0,Math.PI*2); ctx.fill();
        });
        break;
      }
      case 'eldritch_eye': {
        // Outer eyelid
        const eeG = ctx.createRadialGradient(0,-12,0,0,-12,15);
        eeG.addColorStop(0,'#0a0a1a'); eeG.addColorStop(1,'#1a1a2e');
        ctx.fillStyle = eeG;
        ctx.shadowColor='rgba(200,30,40,0.7)'; ctx.shadowBlur=12;
        ctx.beginPath(); ctx.ellipse(0,-12,15,10,0,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // Iris — blood red gradient
        const iriG = ctx.createRadialGradient(0,-12,0,0,-12,10);
        iriG.addColorStop(0,'#ff4a4a'); iriG.addColorStop(0.5,'#e63946'); iriG.addColorStop(1,'#7a0010');
        ctx.fillStyle = iriG;
        ctx.beginPath(); ctx.ellipse(0,-12,10,7,0,0,Math.PI*2); ctx.fill();
        // Pupil
        ctx.fillStyle='#050008';
        ctx.beginPath(); ctx.ellipse(0,-12,4,9,0,0,Math.PI*2); ctx.fill();
        // Iris veins
        ctx.strokeStyle='rgba(255,80,60,0.4)'; ctx.lineWidth=0.8;
        for(let i=0;i<6;i++){
          const a=i/6*Math.PI*2;
          ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(Math.cos(a)*9,Math.sin(a)*6-12); ctx.stroke();
        }
        // Sparkle
        ctx.shadowColor='rgba(255,200,200,0.9)'; ctx.shadowBlur=6;
        ctx.fillStyle='rgba(255,220,220,0.9)'; ctx.beginPath(); ctx.arc(-2,-14,1.5,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // Lashes
        ctx.strokeStyle='rgba(0,0,0,0.8)'; ctx.lineWidth=1.5; ctx.lineCap='round';
        for(let i=0;i<6;i++){
          const a=-Math.PI+i/5*Math.PI;
          ctx.beginPath(); ctx.moveTo(Math.cos(a)*15,Math.sin(a)*10-12); ctx.lineTo(Math.cos(a)*20,Math.sin(a)*14-12); ctx.stroke();
        }
        ctx.lineCap='butt';
        break;
      }

      // ── Shared legendary accessories ─────────────────────────────────────
      case 'fairy_wings': {
        [-1,1].forEach(side => {
          // Upper wing
          const fwG = ctx.createRadialGradient(side*10,-18,0,side*8,-12,22);
          fwG.addColorStop(0,'rgba(220,250,255,0.75)');
          fwG.addColorStop(0.5,'rgba(180,230,255,0.5)');
          fwG.addColorStop(1,'rgba(150,200,255,0.2)');
          ctx.fillStyle = fwG;
          ctx.beginPath();
          ctx.moveTo(0,-4); ctx.bezierCurveTo(side*8,-8,side*22,-4,side*20,-20);
          ctx.bezierCurveTo(side*18,-32,side*4,-24,0,-12); ctx.closePath(); ctx.fill();
          // Vein lines
          ctx.strokeStyle=`rgba(${side>0?'120,200,255':'160,220,255'},0.55)`; ctx.lineWidth=0.8;
          ctx.beginPath(); ctx.moveTo(0,-4); ctx.bezierCurveTo(side*8,-8,side*22,-4,side*20,-20); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(side*14,-16); ctx.stroke();
          // Lower wing
          const fwG2 = ctx.createRadialGradient(side*6,-8,0,side*5,-6,14);
          fwG2.addColorStop(0,'rgba(200,240,255,0.65)');
          fwG2.addColorStop(1,'rgba(180,220,255,0.2)');
          ctx.fillStyle = fwG2;
          ctx.beginPath();
          ctx.moveTo(0,-4); ctx.bezierCurveTo(side*5,-6,side*12,0,side*10,-10);
          ctx.bezierCurveTo(side*8,-18,side*2,-14,0,-8); ctx.closePath(); ctx.fill();
          // Sparkle dots
          ctx.shadowColor='rgba(200,240,255,0.8)'; ctx.shadowBlur=5;
          ctx.fillStyle='rgba(255,255,255,0.8)';
          [[side*14,-18],[side*8,-22]].forEach(([wx,wy]) => {
            ctx.beginPath(); ctx.arc(wx,wy,1.2,0,Math.PI*2); ctx.fill();
          });
          ctx.shadowBlur=0;
        });
        break;
      }
      case 'spirit_orbs': {
        const orbData = [[-16,-10,'180,200,255'],[14,-8,'255,180,220'],[0,-22,'180,255,200']];
        orbData.forEach(([x,y,rgb]) => {
          const og = ctx.createRadialGradient(x-1,y-1,0,x,y,7);
          og.addColorStop(0,`rgba(255,255,255,0.9)`);
          og.addColorStop(0.4,`rgba(${rgb},0.85)`);
          og.addColorStop(1,`rgba(${rgb},0.2)`);
          ctx.shadowColor=`rgba(${rgb},0.7)`; ctx.shadowBlur=12;
          ctx.fillStyle = og;
          ctx.beginPath(); ctx.arc(x,y,5.5,0,Math.PI*2); ctx.fill();
        });
        ctx.shadowBlur=0;
        break;
      }
      case 'starfall_crown': {
        const sfG = ctx.createLinearGradient(-14,4,14,-16);
        sfG.addColorStop(0,'#c8922a'); sfG.addColorStop(0.4,'#ffe082'); sfG.addColorStop(0.7,'#fff9c4'); sfG.addColorStop(1,'#f9a825');
        ctx.fillStyle = sfG;
        ctx.shadowColor='rgba(255,200,50,0.7)'; ctx.shadowBlur=12;
        ctx.beginPath(); ctx.moveTo(-14,4); ctx.lineTo(-10,-8); ctx.lineTo(-4,2); ctx.lineTo(0,-16); ctx.lineTo(4,2); ctx.lineTo(10,-8); ctx.lineTo(14,4); ctx.closePath(); ctx.fill();
        ctx.shadowBlur=0;
        // Stars on tips
        [[0,-14],[-8,-4],[8,-4]].forEach(([x,y]) => {
          ctx.shadowColor='rgba(255,255,200,0.9)'; ctx.shadowBlur=8;
          ctx.fillStyle='#fffde7'; ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
        });
        // Highlight
        ctx.fillStyle='rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.moveTo(-12,4); ctx.lineTo(-8,-6); ctx.lineTo(-3,2); ctx.closePath(); ctx.fill();
        break;
      }
      case 'rainbow_halo': {
        for (let i=0;i<7;i++) {
          ctx.shadowColor=`hsl(${i*51},90%,65%)`;
          ctx.shadowBlur=5+i;
          ctx.strokeStyle=`hsl(${i*51},88%,62%)`;
          ctx.lineWidth = i===0 ? 3 : 2.5;
          ctx.globalAlpha = 0.85;
          ctx.beginPath(); ctx.ellipse(0,-18,16+i*0.4,6+i*0.15,0,0,Math.PI*2); ctx.stroke();
        }
        ctx.globalAlpha=1; ctx.shadowBlur=0;
        break;
      }
      case 'crystal_tiara': {
        [[-10,-8,5,12],[-5,-14,4,10],[0,-18,5,14],[5,-14,4,10],[10,-8,5,12]].forEach(([x,y,w,h],i) => {
          const ctG = ctx.createLinearGradient(x,y+h,x,y);
          ctG.addColorStop(0,'rgba(140,180,255,0.7)'); ctG.addColorStop(0.4,'rgba(220,235,255,0.95)'); ctG.addColorStop(1,'rgba(160,200,255,0.6)');
          ctx.fillStyle = ctG;
          ctx.shadowColor='rgba(160,200,255,0.6)'; ctx.shadowBlur=i===2?10:5;
          ctx.beginPath(); ctx.moveTo(x,y+h); ctx.lineTo(x-w/2,y+2); ctx.lineTo(x,y); ctx.lineTo(x+w/2,y+2); ctx.closePath(); ctx.fill();
          ctx.strokeStyle='rgba(200,230,255,0.7)'; ctx.lineWidth=0.8; ctx.stroke();
          // Internal facet
          ctx.fillStyle='rgba(255,255,255,0.4)';
          ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-w/4,y+h/3); ctx.lineTo(x,y+h/2); ctx.closePath(); ctx.fill();
        });
        ctx.shadowBlur=0;
        break;
      }
      case 'petal_wreath': {
        for (let i=0;i<8;i++) {
          const a=(i/8)*Math.PI*2;
          const px=Math.cos(a)*13; const py=Math.sin(a)*13-4;
          const pwG = ctx.createRadialGradient(px,py,0,px,py,9);
          pwG.addColorStop(0,`hsl(${i*45},90%,85%)`);
          pwG.addColorStop(0.6,`hsl(${i*45},78%,70%)`);
          pwG.addColorStop(1,`hsl(${i*45},60%,55%)`);
          ctx.fillStyle = pwG;
          ctx.beginPath(); ctx.ellipse(px,py,5.5,9,a,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.3)';
          ctx.beginPath(); ctx.ellipse(px-Math.cos(a)*1.5,py-Math.sin(a)*2,2,4,a,0,Math.PI*2); ctx.fill();
        }
        break;
      }
      case 'celestial_halo':
        ctx.shadowColor='rgba(255,240,120,0.9)'; ctx.shadowBlur=14;
        ctx.strokeStyle='rgba(255,230,80,0.95)'; ctx.lineWidth=3.5;
        ctx.beginPath(); ctx.ellipse(0,-20,18,7,0,0,Math.PI*2); ctx.stroke();
        ctx.shadowBlur=0;
        // Star accents
        [[-12,-20],[0,-27],[12,-20]].forEach(([x,y]) => {
          ctx.fillStyle='rgba(255,240,120,0.9)';
          ctx.beginPath();
          for (let i=0;i<5;i++) {
            const a=-Math.PI/2+i*(Math.PI*2/5);
            const ia=a+Math.PI/5;
            if(i===0) ctx.moveTo(x+Math.cos(a)*5,y+Math.sin(a)*5);
            else ctx.lineTo(x+Math.cos(a)*5,y+Math.sin(a)*5);
            ctx.lineTo(x+Math.cos(ia)*2,y+Math.sin(ia)*2);
          }
          ctx.closePath(); ctx.fill();
        });
        break;

      // ════════════════════════════════════════════════════════════════
      //  COSPLAY ACCESSORIES
      // ════════════════════════════════════════════════════════════════

      case 'cat_ears': {
        const earShadow = ctx.createLinearGradient(0,-22,0,0);
        earShadow.addColorStop(0,'#f9c2d0'); earShadow.addColorStop(1,'#e8a0b8');
        ctx.fillStyle = earShadow;
        ctx.beginPath(); ctx.moveTo(-15,1); ctx.lineTo(-22,-24); ctx.lineTo(-4,-10); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(15,1); ctx.lineTo(22,-24); ctx.lineTo(4,-10); ctx.closePath(); ctx.fill();
        // Inner ear gradient
        const innerG = ctx.createLinearGradient(0,-22,0,-2);
        innerG.addColorStop(0,'#ff9ec4'); innerG.addColorStop(1,'#ffcfe0');
        ctx.fillStyle = innerG;
        ctx.beginPath(); ctx.moveTo(-13,-1); ctx.lineTo(-19,-20); ctx.lineTo(-6,-10); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(13,-1); ctx.lineTo(19,-20); ctx.lineTo(6,-10); ctx.closePath(); ctx.fill();
        // Highlight shine on ear tip
        ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=1.5; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-20,-20); ctx.lineTo(-17,-14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20,-20); ctx.lineTo(17,-14); ctx.stroke();
        ctx.lineCap='butt';
        break;
      }

      case 'dog_ears': {
        [-1,1].forEach(side => {
          const sx = side;
          // Outer ear with gradient
          const eg = ctx.createRadialGradient(sx*18, 12, 0, sx*16, 10, 20);
          eg.addColorStop(0,'#d4b483'); eg.addColorStop(1,'#8c6239');
          ctx.fillStyle = eg;
          ctx.beginPath();
          ctx.moveTo(sx*12,0);
          ctx.bezierCurveTo(sx*22,-4,sx*26,16,sx*18,24);
          ctx.bezierCurveTo(sx*12,28,sx*8,20,sx*12,0);
          ctx.closePath(); ctx.fill();
          // Inner darker tone
          ctx.fillStyle='rgba(100,70,30,0.35)';
          ctx.beginPath();
          ctx.moveTo(sx*13,2);
          ctx.bezierCurveTo(sx*20,-1,sx*23,14,sx*16,22);
          ctx.bezierCurveTo(sx*11,20,sx*9,14,sx*13,2);
          ctx.closePath(); ctx.fill();
          // Fur highlight line
          ctx.strokeStyle='rgba(255,240,200,0.4)'; ctx.lineWidth=1.8; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(sx*14,4); ctx.bezierCurveTo(sx*19,2,sx*21,16,sx*16,22); ctx.stroke();
          ctx.lineCap='butt';
        });
        break;
      }

      case 'fox_ears':
        // Fox ears — tall & pointed with inner color
        ctx.fillStyle='#e07b39';
        ctx.beginPath(); ctx.moveTo(-13,0); ctx.lineTo(-22,-28); ctx.lineTo(-4,-12); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(13,0); ctx.lineTo(22,-28); ctx.lineTo(4,-12); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#fff';
        ctx.beginPath(); ctx.moveTo(-12,-1); ctx.lineTo(-19,-22); ctx.lineTo(-6,-12); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(12,-1); ctx.lineTo(19,-22); ctx.lineTo(6,-12); ctx.closePath(); ctx.fill();
        break;

      case 'ninja_headband': {
        // Cloth band with gradient
        const bandG = ctx.createLinearGradient(0,-8,0,6);
        bandG.addColorStop(0,'#5c5f7a'); bandG.addColorStop(1,'#3a3c52');
        ctx.fillStyle = bandG;
        ctx.fillRect(-26,-7,52,12);
        // Cloth tails
        ctx.beginPath(); ctx.moveTo(26,-7); ctx.lineTo(38,-10); ctx.bezierCurveTo(40,-4,38,6,26,5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-26,-7); ctx.lineTo(-38,-10); ctx.bezierCurveTo(-40,-4,-38,6,-26,5); ctx.closePath(); ctx.fill();
        // Metal plate — metallic gradient
        const metalG = ctx.createLinearGradient(-15,-6,15,6);
        metalG.addColorStop(0,'#d8dee9'); metalG.addColorStop(0.4,'#ffffff'); metalG.addColorStop(0.7,'#b0bec5'); metalG.addColorStop(1,'#78909c');
        ctx.fillStyle = metalG;
        ctx.beginPath(); ctx.roundRect(-15,-6,30,10,2); ctx.fill();
        // Plate border
        ctx.strokeStyle='#546e7a'; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.roundRect(-15,-6,30,10,2); ctx.stroke();
        // Engraved circle symbol (village logo)
        ctx.strokeStyle='rgba(40,50,60,0.55)'; ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.arc(0,-1,5,0,Math.PI*2); ctx.stroke();
        // Triangle inside
        ctx.fillStyle='rgba(40,50,60,0.5)';
        ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(-4,3); ctx.lineTo(4,3); ctx.closePath(); ctx.fill();
        // Cloth crease lines
        ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1;
        [-12,12].forEach(x => { ctx.beginPath(); ctx.moveTo(x,-7); ctx.lineTo(x+1,5); ctx.stroke(); });
        break;
      }

      case 'blindfold':
        // Roronoa Zoro / samurai style black blindfold across eyes
        ctx.fillStyle='rgba(15,15,15,0.92)';
        ctx.beginPath(); ctx.rect(-22,-7,44,12); ctx.fill();
        ctx.strokeStyle='rgba(80,60,20,0.6)'; ctx.lineWidth=1.5;
        ctx.strokeRect(-22,-7,44,12);
        // Subtle cloth texture lines
        ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
        for(let i=-18;i<18;i+=6){ ctx.beginPath(); ctx.moveTo(i,-7); ctx.lineTo(i+3,5); ctx.stroke(); }
        break;

      case 'katana': {
        // Scabbard (dark, slightly visible behind blade)
        ctx.strokeStyle='rgba(40,25,10,0.6)'; ctx.lineWidth=6; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-22,16); ctx.lineTo(14,-24); ctx.stroke();
        // Blade — metallic linear gradient
        ctx.save();
        ctx.translate(-4,-4); ctx.rotate(-0.9);
        const bladeG = ctx.createLinearGradient(-2,0,6,0);
        bladeG.addColorStop(0,'#eceff1'); bladeG.addColorStop(0.4,'#ffffff'); bladeG.addColorStop(0.7,'#b0bec5'); bladeG.addColorStop(1,'#607d8b');
        ctx.fillStyle = bladeG;
        ctx.fillRect(-2,-22,5,44);
        ctx.restore();
        // Edge hamon line (temper line)
        ctx.strokeStyle='rgba(180,220,255,0.5)'; ctx.lineWidth=1; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-18,13); ctx.lineTo(14,-24); ctx.stroke();
        ctx.lineCap='butt';
        // Tsuba (guard) — golden with shadow
        ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.shadowBlur=4;
        const tsubaG = ctx.createRadialGradient(-4,-4,0,-4,-4,7);
        tsubaG.addColorStop(0,'#ffe082'); tsubaG.addColorStop(0.6,'#ffd54f'); tsubaG.addColorStop(1,'#f9a825');
        ctx.fillStyle = tsubaG;
        ctx.beginPath(); ctx.ellipse(-4,-4,7,4,-0.9,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(120,80,0,0.5)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.ellipse(-4,-4,7,4,-0.9,0,Math.PI*2); ctx.stroke();
        ctx.shadowBlur=0;
        // Handle (tsuka) — dark wrapped
        ctx.strokeStyle='#4e342e'; ctx.lineWidth=5; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(-22,16); ctx.lineTo(-12,4); ctx.stroke();
        // Ito (handle wrap) diagonal lines
        ctx.strokeStyle='rgba(200,170,100,0.7)'; ctx.lineWidth=1.5;
        for(let i=0;i<4;i++){
          const t2=i/3; const px=lerp(-22,-12,t2); const py=lerp(16,4,t2);
          ctx.beginPath(); ctx.moveTo(px-3,py-1.5); ctx.lineTo(px+3,py+1.5); ctx.stroke();
        }
        ctx.lineCap='butt';
        break;
      }

      case 'pizza_slice': {
        // Dough base with gradient
        const doughG = ctx.createLinearGradient(0,-28,0,8);
        doughG.addColorStop(0,'#f4a261'); doughG.addColorStop(1,'#e07b39');
        ctx.fillStyle = doughG;
        ctx.beginPath(); ctx.moveTo(0,-30); ctx.lineTo(-20,6); ctx.lineTo(20,6); ctx.closePath(); ctx.fill();
        // Cheese layer
        const cheeseG = ctx.createLinearGradient(0,-24,0,4);
        cheeseG.addColorStop(0,'#ffe66d'); cheeseG.addColorStop(1,'#ffd166');
        ctx.fillStyle = cheeseG;
        ctx.beginPath(); ctx.moveTo(0,-24); ctx.lineTo(-15,4); ctx.lineTo(15,4); ctx.closePath(); ctx.fill();
        // Cheese drips on edges
        ctx.fillStyle='#ffe66d';
        [[-12,4],[-4,4],[4,4],[12,4]].forEach(([x,y],i) => {
          ctx.beginPath(); ctx.ellipse(x,y+3+i%2,2,3,0,0,Math.PI); ctx.fill();
        });
        // Tomato sauce hints
        ctx.fillStyle='rgba(192,30,30,0.3)';
        ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(-12,2); ctx.lineTo(12,2); ctx.closePath(); ctx.fill();
        // Pepperoni with gradient
        [[0,-14],[7,-2],[-7,-2]].forEach(([px,py]) => {
          const pepG = ctx.createRadialGradient(px,py,0,px,py,4.5);
          pepG.addColorStop(0,'#e53935'); pepG.addColorStop(1,'#b71c1c');
          ctx.fillStyle = pepG;
          ctx.beginPath(); ctx.arc(px,py,4,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.2)';
          ctx.beginPath(); ctx.arc(px-1,py-1,1.5,0,Math.PI*2); ctx.fill();
        });
        // Crust with gradient
        const crustG = ctx.createLinearGradient(-20,6,20,10);
        crustG.addColorStop(0,'#c8922a'); crustG.addColorStop(0.5,'#e9c46a'); crustG.addColorStop(1,'#c8922a');
        ctx.fillStyle = crustG;
        ctx.beginPath(); ctx.moveTo(-20,6); ctx.lineTo(-22,10); ctx.lineTo(22,10); ctx.lineTo(20,6); ctx.closePath(); ctx.fill();
        // Sesame dots on crust
        ctx.fillStyle='rgba(200,160,60,0.7)';
        [-14,-6,6,14].forEach(x => { ctx.beginPath(); ctx.arc(x,8,1.2,0,Math.PI*2); ctx.fill(); });
        break;
      }

      case 'witch_hat': {
        // Brim with gradient
        const brimG = ctx.createRadialGradient(0,0,0,0,0,24);
        brimG.addColorStop(0,'#3d3d3d'); brimG.addColorStop(1,'#1a1a1a');
        ctx.fillStyle = brimG;
        ctx.beginPath(); ctx.ellipse(0,0,24,8,0,0,Math.PI*2); ctx.fill();
        // Brim edge highlight
        ctx.strokeStyle='rgba(180,140,255,0.3)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.ellipse(0,-1,24,7,0,-Math.PI,0); ctx.stroke();
        // Cone
        const coneG = ctx.createLinearGradient(-14,0,14,-34);
        coneG.addColorStop(0,'#2d2d3d'); coneG.addColorStop(0.5,'#3a3a50'); coneG.addColorStop(1,'#1a1a2e');
        ctx.fillStyle = coneG;
        ctx.beginPath(); ctx.moveTo(0,-34); ctx.lineTo(-15,0); ctx.lineTo(15,0); ctx.closePath(); ctx.fill();
        // Magical stars on cone
        ctx.fillStyle='rgba(200,180,255,0.5)';
        [[4,-22],[- 8,-14],[6,-10]].forEach(([sx,sy]) => {
          ctx.beginPath(); ctx.arc(sx,sy,1.2,0,Math.PI*2); ctx.fill();
        });
        // Band
        const bandG2 = ctx.createLinearGradient(-13,-5,13,0);
        bandG2.addColorStop(0,'#7b1fa2'); bandG2.addColorStop(0.5,'#ab47bc'); bandG2.addColorStop(1,'#7b1fa2');
        ctx.fillStyle = bandG2;
        ctx.beginPath(); ctx.rect(-13,-5,26,6); ctx.fill();
        // Buckle
        const buckleG = ctx.createLinearGradient(-4,-5,4,1);
        buckleG.addColorStop(0,'#fff176'); buckleG.addColorStop(1,'#f9a825');
        ctx.fillStyle = buckleG;
        ctx.beginPath(); ctx.roundRect(-4,-5,8,6,1); ctx.fill();
        // Glowing tip
        ctx.shadowColor='rgba(180,140,255,0.9)'; ctx.shadowBlur=12;
        ctx.fillStyle='rgba(200,170,255,0.85)';
        ctx.beginPath(); ctx.arc(0,-34,3,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // Highlight stripe on cone
        ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(-4,0); ctx.lineTo(-1,-32); ctx.stroke();
        break;
      }

      case 'bunny_ears':
        // Long bunny ears
        ctx.fillStyle='#f8c8d4';
        ctx.beginPath(); ctx.ellipse(-10,-22,5,14,-.15,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(10,-22,5,14,.15,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#ffb3c6';
        ctx.beginPath(); ctx.ellipse(-10,-22,2.5,10,-.15,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(10,-22,2.5,10,.15,0,Math.PI*2); ctx.fill();
        break;

      case 'oni_horns': {
        [-1,1].forEach(side => {
          const hx = side * 10;
          const hornG = ctx.createLinearGradient(hx, 2, hx + side*6, -32);
          hornG.addColorStop(0,'#d32f2f'); hornG.addColorStop(0.5,'#e53935'); hornG.addColorStop(1,'#b71c1c');
          ctx.fillStyle = hornG;
          ctx.beginPath();
          ctx.moveTo(hx,2);
          ctx.bezierCurveTo(hx+side*6,-8,hx+side*10,-22,hx+side*4,-32);
          ctx.bezierCurveTo(hx+side*0,-34,hx-side*4,-28,hx-side*2,-16);
          ctx.bezierCurveTo(hx-side*4,-10,hx-side*6,0,hx-side*4,4);
          ctx.closePath(); ctx.fill();
          // White highlight stripe
          ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=2; ctx.lineCap='round';
          ctx.beginPath();
          ctx.moveTo(hx-side*1,-2);
          ctx.bezierCurveTo(hx+side*4,-12,hx+side*6,-22,hx+side*2,-30);
          ctx.stroke();
          // Tip glow
          ctx.shadowColor='rgba(255,80,80,0.7)'; ctx.shadowBlur=8;
          ctx.fillStyle='rgba(255,120,100,0.6)';
          ctx.beginPath(); ctx.arc(hx+side*4,-32,3,0,Math.PI*2); ctx.fill();
          ctx.shadowBlur=0;
          ctx.lineCap='butt';
        });
        break;
      }

      case 'dragon_wings': {
        [-1,1].forEach(side => {
          const sx = side;
          // Wing membrane gradient
          const wg = ctx.createRadialGradient(sx*10,-16,0,sx*10,-10,28);
          wg.addColorStop(0,'rgba(200,50,30,0.92)');
          wg.addColorStop(0.6,'rgba(140,20,10,0.75)');
          wg.addColorStop(1,'rgba(80,0,0,0.4)');
          ctx.fillStyle = wg;
          ctx.beginPath();
          ctx.moveTo(sx*2,-6);
          ctx.bezierCurveTo(sx*10,-10,sx*30,-6,sx*32,-24);
          ctx.bezierCurveTo(sx*28,-36,sx*16,-28,sx*10,-18);
          ctx.bezierCurveTo(sx*7,-14,sx*5,-8,sx*2,-4);
          ctx.closePath(); ctx.fill();
          // Wing edge outline
          ctx.strokeStyle='rgba(80,0,0,0.6)'; ctx.lineWidth=1.5;
          ctx.beginPath();
          ctx.moveTo(sx*2,-6);
          ctx.bezierCurveTo(sx*10,-10,sx*30,-6,sx*32,-24);
          ctx.bezierCurveTo(sx*28,-36,sx*16,-28,sx*10,-18);
          ctx.stroke();
          // Veins / ribs
          ctx.strokeStyle='rgba(60,0,0,0.5)'; ctx.lineWidth=1;
          [[sx*10,-10],[sx*18,-14],[sx*24,-18]].forEach(([vx,vy]) => {
            ctx.beginPath(); ctx.moveTo(sx*2,-6); ctx.lineTo(vx,vy); ctx.stroke();
          });
          // Highlight on membrane
          ctx.strokeStyle='rgba(255,120,80,0.2)'; ctx.lineWidth=3;
          ctx.beginPath(); ctx.moveTo(sx*4,-8); ctx.bezierCurveTo(sx*14,-10,sx*24,-14,sx*28,-22); ctx.stroke();
        });
        break;
      }

      case 'maid_headband': {
        // Band gradient
        const mbG = ctx.createLinearGradient(0,-8,0,6);
        mbG.addColorStop(0,'#ffffff'); mbG.addColorStop(1,'#e8e8f0');
        ctx.fillStyle = mbG;
        ctx.beginPath(); ctx.roundRect(-22,-7,44,11,3); ctx.fill();
        ctx.strokeStyle='rgba(180,180,220,0.5)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(-22,-7,44,11,3); ctx.stroke();
        // Lace frills — scallop pattern top
        ctx.fillStyle='rgba(255,255,255,0.95)';
        ctx.strokeStyle='rgba(200,200,230,0.8)'; ctx.lineWidth=1;
        for(let i=-20;i<=18;i+=5){
          ctx.beginPath(); ctx.arc(i+2,-7,3,Math.PI,0); ctx.fill(); ctx.stroke();
        }
        // Big bow — gradient
        const bowG = ctx.createRadialGradient(0,-12,0,0,-12,20);
        bowG.addColorStop(0,'#ffffff'); bowG.addColorStop(0.5,'#f0f0ff'); bowG.addColorStop(1,'#d8d8f0');
        ctx.fillStyle = bowG;
        ctx.beginPath(); ctx.moveTo(0,-7); ctx.bezierCurveTo(-18,-20,-20,-7,-6,-7); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0,-7); ctx.bezierCurveTo(18,-20,20,-7,6,-7); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(180,180,220,0.5)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(0,-7); ctx.bezierCurveTo(-18,-20,-20,-7,-6,-7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,-7); ctx.bezierCurveTo(18,-20,20,-7,6,-7); ctx.stroke();
        // Bow knot center
        const knotG = ctx.createRadialGradient(0,-8,0,0,-8,5);
        knotG.addColorStop(0,'#ffffff'); knotG.addColorStop(1,'#d8d8f0');
        ctx.fillStyle = knotG;
        ctx.beginPath(); ctx.arc(0,-8,4,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(160,160,200,0.4)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(0,-8,4,0,Math.PI*2); ctx.stroke();
        break;
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  FACE DRAW  (enhanced eyes + mouths)
  // ─────────────────────────────────────────────────────────────────────────
  Slime.prototype.drawFace = function(rotation, visualX, visualY) {
    const frame = this.getBodyFrame(visualX, visualY, rotation);
    const anim = this.faceAnimation || {};
    const faceAnchorY = Math.max(frame.minY * 0.18, -this.baseRadius * 0.08);
    const faceWidth   = Math.max(18, Math.min(Math.abs(frame.minX), Math.abs(frame.maxX)) * 1.35 * this.faceScale);
    const faceHeight  = Math.max(14, (frame.maxY - frame.minY) * 0.24 * this.faceScale);
    const eyeStyle    = anim.overrideEyeStyle  || this.eyeStyle;
    const mouthStyle  = anim.overrideMouthStyle || this.mouthStyle;

    ctx.save();
    ctx.translate(visualX, visualY);
    ctx.rotate(rotation);
    // Apply face offset (landing squash, jitter)
    const jx = anim.jitterX || 0;
    const jy = anim.jitterY || 0;
    ctx.translate(jx, faceAnchorY + (anim.faceOffsetY || 0) + this.mouthOffsetY * 0.15);

    this.faceLookX = anim.lookBiasX || 0;
    this.faceLookY = anim.lookBiasY || 0;
    ctx.translate(this.faceLookX * 0.4, this.faceLookY * 0.4);
    this.isBlinking = false;

    const isCute  = this.type === 'cute';
    const isScary = this.type === 'scary';
    const hue = this.hue;
    const eyeColor   = isScary ? '#1a0000' : '#101010';
    const irisHue   = isScary ? (hue + 180) % 360 : hue;
    const irisColor = isScary
      ? `hsl(${irisHue},80%,28%)`
      : `hsl(${irisHue},85%,${isCute ? 52 : 42}%)`;
    const irisLight = isScary
      ? `hsl(${irisHue},70%,40%)`
      : `hsl(${irisHue},90%,${isCute ? 70 : 60}%)`;

    const eyeDist    = Math.min(faceWidth * (0.72 + this.eyeSpacingBias * 0.22), this.baseRadius * 0.46);
    let eyeSize      = isCute ? 7.0 : (isScary ? 5.2 : 5.5);
    // Cap eyeSize more tightly so eyes don't overwhelm the face
    eyeSize = Math.min(eyeSize * (1 + this.eyeSizeBias * 0.4), Math.max(3.5, faceHeight * 0.30));
    eyeSize = Math.max(3.5, eyeSize);

    // Read live animation values from faceAnimation
    const eyeScaleX   = anim.eyeScaleX   || 1;
    const eyeScaleY   = anim.eyeScaleY   || 1;
    const mouthScaleX = anim.mouthScaleX || 1;
    const mouthScaleY = anim.mouthScaleY || 1;
    const browLift    = anim.browLift    || 0;
    const browTilt    = anim.browTilt    || 0;

    // ── Always-visible expressive brows — animated by browLift/browTilt ──────
    {
      const browBaseY = -eyeSize - 7 - browLift * 8;
      const browSpan  = eyeSize * 1.1;
      ctx.strokeStyle = isScary ? 'rgba(40,0,0,0.85)' : 'rgba(30,20,10,0.7)';
      ctx.lineWidth = isCute ? 2.4 : 2.0;
      ctx.lineCap = 'round';

      // browTilt: positive = angry inner-rise, negative = sad inner-drop
      const tiltL = browTilt * 5;  // left brow extra Y at inner end
      const tiltR = browTilt * 5;  // right brow (mirrored)

      if (browTilt > 0.15 || this.mood === 'grumpy' || this.mood === 'frenzied' || this.actionState === 'attack') {
        // Angry angled brows
        ctx.beginPath(); ctx.moveTo(-eyeDist/2-browSpan, browBaseY+tiltL+2); ctx.lineTo(-eyeDist/2+browSpan, browBaseY-tiltL-4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( eyeDist/2-browSpan, browBaseY-tiltR-4); ctx.lineTo( eyeDist/2+browSpan, browBaseY+tiltR+2); ctx.stroke();
      } else if (browTilt < -0.1 || this.mood === 'sad' || this.mood === 'melancholy') {
        ctx.beginPath(); ctx.moveTo(-eyeDist/2-browSpan, browBaseY+tiltL-3); ctx.lineTo(-eyeDist/2+browSpan, browBaseY-tiltL+2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( eyeDist/2-browSpan, browBaseY-tiltR+2); ctx.lineTo( eyeDist/2+browSpan, browBaseY+tiltR-3); ctx.stroke();
      } else if (isCute) {
        // Soft rounded kawaii brows — lifted when browLift > 0
        ctx.beginPath(); ctx.moveTo(-eyeDist/2-browSpan, browBaseY+1); ctx.quadraticCurveTo(-eyeDist/2, browBaseY-3, -eyeDist/2+browSpan, browBaseY+1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( eyeDist/2-browSpan, browBaseY+1); ctx.quadraticCurveTo( eyeDist/2, browBaseY-3,  eyeDist/2+browSpan, browBaseY+1); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(-eyeDist/2-browSpan, browBaseY); ctx.lineTo(-eyeDist/2+browSpan, browBaseY-1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( eyeDist/2-browSpan, browBaseY-1); ctx.lineTo( eyeDist/2+browSpan, browBaseY); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    // ── Cheeks / blush — rich radial gradient ───────────────────────────────
    const showBlush = isCute || this.detailTrait === 'blush' || this.mood === 'lovesick' || this.mood === 'shy' || (!isScary && (this.mood === 'joyful' || this.mood === 'dreamy'));
    if (showBlush) {
      const blushAlpha = (isCute ? 0.30 : 0.18)
        + (this.mood === 'lovesick' ? 0.14 : 0)
        + (this.mood === 'shy'      ? 0.12 : 0)
        + (this.mood === 'joyful'   ? 0.06 : 0)
        + (this.mood === 'dreamy'   ? 0.04 : 0);
      const blushW = 5 + this.cheekIntensity * 4;
      const blushH = 3 + this.cheekIntensity * 1.5;
      [-1,1].forEach(side => {
        const bx = side * (eyeDist/2 + 6);
        const by = eyeSize + 2;
        const blushGrad = ctx.createRadialGradient(bx,by,0, bx,by, blushW*1.6);
        blushGrad.addColorStop(0,   `rgba(255,130,170,${blushAlpha})`);
        blushGrad.addColorStop(0.5, `rgba(255,140,160,${blushAlpha*0.6})`);
        blushGrad.addColorStop(1,   'rgba(255,160,180,0)');
        ctx.fillStyle = blushGrad;
        ctx.beginPath(); ctx.ellipse(bx, by, blushW, blushH, 0, 0, Math.PI*2); ctx.fill();
        // Tiny shine dots inside blush
        ctx.fillStyle = `rgba(255,255,255,${blushAlpha*0.35})`;
        ctx.beginPath(); ctx.arc(bx - blushW*0.2, by - blushH*0.3, 1.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + blushW*0.15, by - blushH*0.1, 0.8, 0, Math.PI*2); ctx.fill();
      });
    }

    // ── Detail traits ────────────────────────────────────────────────────────
    this._drawDetailTrait(eyeDist, eyeSize, faceWidth, faceHeight);

    // ── Rich eye renderer ────────────────────────────────────────────────────
    ctx.fillStyle = eyeColor;
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = 2.4;

    // drawOpenRoundEye — kawaii for ALL types: sclera always, proportioned pupil, sparkle
    const drawOpenRoundEye = (x, y, r, withSparkle = false) => {
      const rSafe = Math.max(1, r);

      // ── Sclera (white) — always visible, not just for cute ──
      ctx.fillStyle = isScary ? 'rgba(220,200,200,0.88)' : 'rgba(255,255,255,0.94)';
      ctx.beginPath(); ctx.arc(x, y, rSafe + (isCute ? 1.8 : 1.2), 0, Math.PI*2); ctx.fill();

      // ── Iris gradient — vivid but not dark ──
      // For normal slimes: use a lighter, more saturated iris so it reads as cute
      const irisLightAdj = isScary ? irisLight : `hsl(${irisHue},90%,${isCute ? 72 : 65}%)`;
      const irisColorAdj = isScary ? irisColor : `hsl(${irisHue},80%,${isCute ? 52 : 48}%)`;
      const ig = ctx.createRadialGradient(x - rSafe*0.18, y - rSafe*0.22, 0, x, y, rSafe);
      ig.addColorStop(0,    irisLightAdj);
      ig.addColorStop(0.55, irisColorAdj);
      ig.addColorStop(1,    `hsl(${irisHue},60%,${isScary ? 20 : 32}%)`);
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.arc(x, y, rSafe, 0, Math.PI*2); ctx.fill();

      // ── Pupil — smaller ratio, more kawaii ──
      ctx.fillStyle = eyeColor;
      ctx.beginPath(); ctx.arc(x, y, rSafe * 0.32, 0, Math.PI*2); ctx.fill();

      // ── Primary sparkle ──
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      ctx.beginPath(); ctx.arc(x - rSafe*0.28, y - rSafe*0.28, Math.max(1.4, rSafe*0.30), 0, Math.PI*2); ctx.fill();

      // ── Secondary tiny sparkle ──
      if (withSparkle || isCute) {
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath(); ctx.arc(x + rSafe*0.2, y - rSafe*0.15, Math.max(0.7, rSafe*0.14), 0, Math.PI*2); ctx.fill();
      }

      ctx.fillStyle = eyeColor;
    };

    ctx.save();
    if (this.isBlinking) {
      ctx.strokeStyle = eyeColor; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-eyeDist/2-eyeSize,0); ctx.lineTo(-eyeDist/2+eyeSize,0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(eyeDist/2-eyeSize,0); ctx.lineTo(eyeDist/2+eyeSize,0); ctx.stroke();
    } else {
      this._drawEyeStyle(eyeStyle, eyeDist, eyeSize, eyeColor, drawOpenRoundEye, eyeScaleX, eyeScaleY);
    }
    ctx.restore();
    ctx.beginPath();

    // ── Lashes ────────────────────────────────────────────────────────────────
    if (this.detailTrait === 'lashes' || isCute) {
      ctx.strokeStyle = 'rgba(20,15,10,0.7)';
      ctx.lineWidth = isCute ? 1.8 : 1.4;
      ctx.lineCap = 'round';
      // Sclera offset: cute gets +1.8, normal gets +1.2 (matches drawOpenRoundEye)
      const scleraR = eyeSize + (isCute ? 1.8 : 1.2);
      [-1,1].forEach(side => {
        const ex = side * eyeDist / 2;
        const lashAngles = [-0.38, 0, 0.38];
        lashAngles.forEach((a, i) => {
          const baseA = -Math.PI/2 + a * side;
          const lashLen = isCute ? eyeSize*0.7 + i*0.5 : eyeSize*0.5;
          ctx.beginPath();
          ctx.moveTo(ex + Math.cos(baseA)*(scleraR + 0.5), Math.sin(baseA)*(scleraR + 0.5));
          ctx.lineTo(ex + Math.cos(baseA)*(scleraR + lashLen), Math.sin(baseA)*(scleraR + lashLen));
          ctx.stroke();
        });
      });
      ctx.lineCap = 'butt';
    }

    // ── Rich mouth rendering ───────────────────────────────────────────────
    ctx.save();
    ctx.scale(mouthScaleX, mouthScaleY);
    this._drawMouthStyle(mouthStyle, eyeColor);
    ctx.restore();
    ctx.beginPath();

    // ── Shine plus ────────────────────────────────────────────────────────────
    if (this.detailTrait === 'shine_plus') {
      ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=2;
      ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(-faceWidth*0.35,-faceHeight*0.8); ctx.lineTo(-faceWidth*0.25,-faceHeight*0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-faceWidth*0.3,-faceHeight*0.92); ctx.lineTo(-faceWidth*0.3,-faceHeight*0.68); ctx.stroke();
      ctx.lineCap='butt';
    }

    ctx.restore();
  };

  // ── RARITY AURA ──────────────────────────────────────────────────────────
  Slime.prototype._drawRarityAura = function(cx, cy) {
    const tier = this.rarityTier || 'common';
    if (tier === 'common') return;

    const br   = this.baseRadius;
    const t    = Date.now() * 0.001;
    const seed = this.animSeed || 0;

    const configs = {
      uncommon:  { color: 'rgba(120,220,100,', r: br * 1.16, pulse: 0.05, blur: 5,  particles: 3, pc: 'rgba(160,255,130,' },
      rare:      { color: 'rgba(80,160,255,',  r: br * 1.24, pulse: 0.09, blur: 9,  particles: 5, pc: 'rgba(130,200,255,' },
      epic:      { color: 'rgba(200,80,255,',  r: br * 1.32, pulse: 0.13, blur: 14, particles: 7, pc: 'rgba(220,140,255,' },
      legendary: { color: 'rgba(255,180,30,',  r: br * 1.42, pulse: 0.18, blur: 20, particles: 9, pc: 'rgba(255,230,80,'  },
    };

    const cfg = configs[tier];
    if (!cfg) return;

    ctx.save();

    // Halo extérieur : anneau lumineux bien visible autour du corps
    const pulse  = 0.5 + 0.5 * Math.sin(t * 1.8 + seed);
    const radius = cfg.r + pulse * br * 0.06;
    const innerR = br * 0.92; // commence juste à la surface du corps
    const alpha  = 0.38 + pulse * cfg.pulse * 2;

    // Glow (shadowBlur pour la lueur externe)
    ctx.shadowColor = cfg.color + '0.8)';
    ctx.shadowBlur  = cfg.blur * 1.5;

    // Anneau de couleur : opaque proche du corps, transparent vers l'extérieur
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, radius);
    grad.addColorStop(0,   cfg.color + alpha.toFixed(2) + ')');
    grad.addColorStop(0.5, cfg.color + (alpha * 0.5).toFixed(2) + ')');
    grad.addColorStop(1,   cfg.color + '0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Particules flottantes
    for (let i = 0; i < cfg.particles; i++) {
      const angle = (i / cfg.particles) * Math.PI * 2 + t * (0.38 + i * 0.06) + seed;
      const orbit = radius * (0.70 + 0.24 * Math.sin(t * 0.9 + i * 1.3 + seed));
      const px    = cx + Math.cos(angle) * orbit;
      const py    = cy + Math.sin(angle) * orbit - Math.abs(Math.sin(t * 1.1 + i)) * br * 0.16;
      const ps    = br * (0.042 + 0.026 * Math.sin(t * 1.6 + i * 0.9));
      const pa    = 0.42 + 0.32 * Math.sin(t * 1.4 + i * 0.7 + seed);
      ctx.fillStyle = cfg.pc + pa.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1.1, ps), 0, Math.PI * 2);
      ctx.fill();
    }

    // Legendary: anneau tournant
    if (tier === 'legendary') {
      ctx.strokeStyle = 'rgba(255,220,60,0.42)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 8; i++) {
        const a  = (i / 8) * Math.PI * 2 + t * 0.85;
        const sr = radius * 0.80;
        const sx = cx + Math.cos(a) * sr;
        const sy = cy + Math.sin(a) * sr;
        const ln = br * 0.10;
        ctx.beginPath();
        ctx.moveTo(sx - Math.cos(a) * ln, sy - Math.sin(a) * ln);
        ctx.lineTo(sx + Math.cos(a) * ln, sy + Math.sin(a) * ln);
        ctx.stroke();
      }
    }

    // Epic: double anneau pulsant
    if (tier === 'epic') {
      const r2 = radius * 1.10 + Math.sin(t * 2.6) * br * 0.022;
      ctx.strokeStyle = 'rgba(200,100,255,' + (0.09 + Math.sin(t * 2.6) * 0.06) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI * 2); ctx.stroke();
      const r3 = radius * 0.91 + Math.sin(t * 1.8 + 1) * br * 0.018;
      ctx.strokeStyle = 'rgba(170,70,255,' + (0.06 + Math.sin(t * 1.8) * 0.04) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, r3, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();
  };

  // ── EYE STYLE RENDERER ───────────────────────────────────────────────────
  Slime.prototype._drawEyeStyle = function(eyeStyle, eyeDist, eyeSize, eyeColor, drawOpenRound, sx, sy) {
    const R  = eyeSize;
    // sx/sy : le scale Y est plafonné à 0.65 minimum pour que les arcs restent lisibles
    // (évite que angry_arc/sleepy s'effondrent en tiret invisible)
    const scx = Math.max(0.5, sx || 1);
    const scy = Math.max(0.65, sy || 1);
    const safeStyle = eyeStyle && typeof eyeStyle === 'string' ? eyeStyle : 'dot';

    // drawEye : toujours circulaire — le scale ne s'applique PAS ici
    const drawEye = (x, y, r, withSparkle = false) => {
      ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2); ctx.fill();
      if (withSparkle) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - r*0.35, y - r*0.35, Math.max(1, r*0.3), 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = eyeColor;
      }
    };

    switch (safeStyle) {
      case 'dot':
        // Kawaii upgrade: use full iris+sparkle eyes instead of flat dots
        drawOpenRound(-eyeDist/2, 0, R,     true);
        drawOpenRound( eyeDist/2, 0, R,     true); break;
      case 'sparkle':
        drawOpenRound(-eyeDist/2, 0, R+1.2, true);
        drawOpenRound( eyeDist/2, 0, R+1.2, true); break;
      case 'big_round':
        drawOpenRound(-eyeDist/2, 0, R+2.2, true);
        drawOpenRound( eyeDist/2, 0, R+2.2, true); break;
      case 'sleepy': {
        // Draw eye ball first then droopy lid
        drawOpenRound(-eyeDist/2, 0, R*scy+0.5, false);
        drawOpenRound( eyeDist/2, 0, R*scy+0.5, false);
        ctx.fillStyle   = eyeColor;
        ctx.strokeStyle = eyeColor;
        const h = Math.max(0.5, R*scy * 0.55);
        ctx.lineWidth = 2.8;
        // Upper lid covers top half
        ctx.beginPath(); ctx.ellipse(-eyeDist/2, 0, R*scx+0.5, h, 0, Math.PI, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse( eyeDist/2, 0, R*scx+0.5, h, 0, Math.PI, Math.PI*2); ctx.stroke(); break;
      }
      case 'happy_arc': {
        const h = Math.max(0.5, R*scy * 0.9);
        ctx.lineWidth = 3.2;
        // Thick happy arc — kawaii ^^ eyes
        ctx.beginPath(); ctx.ellipse(-eyeDist/2, 0, R*scx+0.8, h, 0, 0, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.ellipse( eyeDist/2, 0, R*scx+0.8, h, 0, 0, Math.PI); ctx.stroke();
        // Small sparkle dots above arcs
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(-eyeDist/2 - R*0.3, -h*0.6, 1.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( eyeDist/2 - R*0.3, -h*0.6, 1.2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = eyeColor; break;
      }
      case 'wide':
        drawOpenRound(-eyeDist/2, 0, R*scx+2.5, true);
        drawOpenRound( eyeDist/2, 0, R*scx+2.5, true); break;
      case 'wink':
        drawOpenRound(-eyeDist/2, 0, R+0.5, true);
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(eyeDist/2 - R*scx, -R*scy*0.2);
        ctx.quadraticCurveTo(eyeDist/2, -R*scy*0.9, eyeDist/2 + R*scx, -R*scy*0.2);
        ctx.stroke(); break;
      case 'heart': {
        const dh = (x) => {
          ctx.beginPath(); ctx.moveTo(x, R*scy*0.8); ctx.bezierCurveTo(x-R*scx*1.2,-R*scy*0.4,x-R*scx*0.9,-R*scy*1.2,x,-R*scy*0.2); ctx.bezierCurveTo(x+R*scx*0.9,-R*scy*1.2,x+R*scx*1.2,-R*scy*0.4,x,R*scy*0.8); ctx.fill();
        }; dh(-eyeDist/2); dh(eyeDist/2);
        // sparkle on heart eyes
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(-eyeDist/2 - R*0.2, -R*scy*0.3, R*0.3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( eyeDist/2 - R*0.2, -R*scy*0.3, R*0.3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = eyeColor; break;
      }
      case 'droplet': {
        const dd = (x) => { ctx.beginPath(); ctx.moveTo(x,-R*scy-2); ctx.quadraticCurveTo(x-R*scx,-1,x,R*scy+2); ctx.quadraticCurveTo(x+R*scx,-1,x,-R*scy-2); ctx.fill(); };
        dd(-eyeDist/2); dd(eyeDist/2);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(-eyeDist/2 - R*0.15, -R*scy*0.5, R*0.28, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( eyeDist/2 - R*0.15, -R*scy*0.5, R*0.28, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = eyeColor; break;
      }
      case 'half_lid':
        // Full iris under half lid — kawaii lazy look
        drawOpenRound(-eyeDist/2, 0, R+0.8, true);
        drawOpenRound( eyeDist/2, 0, R+0.8, true);
        // Dark upper lid covers top ~40%
        ctx.fillStyle = 'rgba(20,15,10,0.78)';
        ctx.beginPath(); ctx.rect(-eyeDist/2 - R*scx - 2, -(R+1) - 4, (R*scx+2)*2 + 4, R*scy*0.75 + 4);
        ctx.fill();
        // Lid edge stroke
        ctx.strokeStyle = eyeColor; ctx.lineWidth = 2.0;
        ctx.beginPath(); ctx.ellipse(-eyeDist/2, -(R+1)*0.05, R*scx+0.5, Math.max(0.5,R*scy*0.5), 0, Math.PI, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse( eyeDist/2, -(R+1)*0.05, R*scx+0.5, Math.max(0.5,R*scy*0.5), 0, Math.PI, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = eyeColor; break;
      case 'uneven':
        drawOpenRound(-eyeDist/2, 0, R+1.8, true);
        drawOpenRound( eyeDist/2, 1, Math.max(2.5, R-1.2), false); break;
      case 'slit':
        ctx.beginPath(); ctx.ellipse(-eyeDist/2, 0, R*scx+3, Math.max(0.8, R*scy*0.38), Math.PI/8, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse( eyeDist/2, 0, R*scx+3, Math.max(0.8, R*scy*0.38),-Math.PI/8, 0, Math.PI*2); ctx.fill(); break;
      case 'angry_arc':
        // Angry arcs with glowing eyes underneath
        drawOpenRound(-eyeDist/2, 0, R*0.85, false);
        drawOpenRound( eyeDist/2, 0, R*0.85, false);
        ctx.strokeStyle = eyeColor; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(-eyeDist/2-R*scx, 0); ctx.lineTo(-eyeDist/2+R*scx, -R*scy*0.55); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( eyeDist/2-R*scx,-R*scy*0.55); ctx.lineTo( eyeDist/2+R*scx, 0); ctx.stroke(); break;
      case 'spiral': {
        const sp = (x, dir) => {
          ctx.beginPath();
          for (let i=0;i<18;i++) { const t2=i/17; const a=t2*Math.PI*3*dir; const r2=t2*(R*scx+2); if(i===0) ctx.moveTo(x+Math.cos(a)*r2,Math.sin(a)*r2*(scy/scx||1)); else ctx.lineTo(x+Math.cos(a)*r2,Math.sin(a)*r2*(scy/scx||1)); }
          ctx.stroke();
        }; ctx.lineWidth=1.8; sp(-eyeDist/2,1); sp(eyeDist/2,-1); ctx.lineWidth=2.4; break;
      }
      case 'void':
        ctx.beginPath(); ctx.ellipse(-eyeDist/2, 0, R*scx+2.2, Math.max(0.5,R*scy+2.2), 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse( eyeDist/2, 0, R*scx+2.2, Math.max(0.5,R*scy+2.2), 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.arc(-eyeDist/2-2,-2,1.6,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( eyeDist/2-2,-2,1.6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=eyeColor; break;

      // ── NEW EYE STYLES ───────────────────────────────────────────────────────
      case 'cat_slit': {
        // Vertical cat-like slit pupils
        ctx.beginPath(); ctx.ellipse(-eyeDist/2, 0, R*scx+2, Math.max(0.5,R*scy+2), 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse( eyeDist/2, 0, R*scx+2, Math.max(0.5,R*scy+2), 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,220,50,0.85)'; // golden iris
        ctx.beginPath(); ctx.ellipse(-eyeDist/2, 0, R*scx+0.5, Math.max(0.4,R*scy+0.5), 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse( eyeDist/2, 0, R*scx+0.5, Math.max(0.4,R*scy+0.5), 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=eyeColor; // thin vertical pupil
        ctx.beginPath(); ctx.ellipse(-eyeDist/2, 0, R*0.22, Math.max(0.5,R*scy+1.5), 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse( eyeDist/2, 0, R*0.22, Math.max(0.5,R*scy+1.5), 0, 0, Math.PI*2); ctx.fill();
        break;
      }
      case 'shiny_round': {
        // Big round eyes with multiple sparkle layers
        drawEye(-eyeDist/2, 0, R+2.5, true); drawEye(eyeDist/2, 0, R+2.5, true);
        ctx.fillStyle='rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(-eyeDist/2+R*0.4, R*0.4, R*0.18, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( eyeDist/2+R*0.4, R*0.4, R*0.18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle=eyeColor; break;
      }
      case 'cross': {
        // X but brighter — cross pupils
        const cx1=-eyeDist/2, cx2=eyeDist/2;
        ctx.lineWidth=3.5;
        ctx.beginPath(); ctx.moveTo(cx1-R*scx,-(R*scy)); ctx.lineTo(cx1+R*scx,(R*scy)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx1+R*scx,-(R*scy)); ctx.lineTo(cx1-R*scx,(R*scy)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx2-R*scx,-(R*scy)); ctx.lineTo(cx2+R*scx,(R*scy)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx2+R*scx,-(R*scy)); ctx.lineTo(cx2-R*scx,(R*scy)); ctx.stroke();
        ctx.lineWidth=2.4; break;
      }
      case 'dollar': {
        // $ shaped eyes — greedy slime
        ctx.font=`bold ${Math.round(R*2.2)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('$',-eyeDist/2,0); ctx.fillText('$',eyeDist/2,0); break;
      }
      case 'triangle_eye': {
        // Triangle pupils — unsettling look
        [-eyeDist/2, eyeDist/2].forEach(ex => {
          ctx.beginPath();
          ctx.moveTo(ex, -(R*scy+2));
          ctx.lineTo(ex-(R*scx+2), (R*scy+2));
          ctx.lineTo(ex+(R*scx+2), (R*scy+2));
          ctx.closePath(); ctx.fill();
        }); break;
      }
      case 'mascara': {
        // Big round eye with thick lash lines
        drawEye(-eyeDist/2, 0, R+1.5, true); drawEye(eyeDist/2, 0, R+1.5, true);
        ctx.strokeStyle=eyeColor; ctx.lineWidth=2;
        [-1,1].forEach(side => {
          const ex=side*eyeDist/2;
          for(let i=0;i<4;i++){
            const a=-Math.PI/2 - side*(i-1.5)*0.28;
            ctx.beginPath();
            ctx.moveTo(ex+Math.cos(a)*(R+1.5), Math.sin(a)*(R+1.5));
            ctx.lineTo(ex+Math.cos(a)*(R+5+i), Math.sin(a)*(R+5+i)-2);
            ctx.stroke();
          }
        });
        ctx.fillStyle=eyeColor; break;
      }
      case 'glowing': {
        // Eyes with glow aura
        ctx.shadowColor='rgba(100,200,255,0.9)'; ctx.shadowBlur=10;
        ctx.fillStyle='rgba(150,230,255,0.95)';
        ctx.beginPath(); ctx.ellipse(-eyeDist/2, 0, R*scx+1.5, Math.max(0.5,R*scy+1.5), 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse( eyeDist/2, 0, R*scx+1.5, Math.max(0.5,R*scy+1.5), 0, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur=0; ctx.fillStyle=eyeColor;
        ctx.beginPath(); ctx.arc(-eyeDist/2, 0, R*0.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( eyeDist/2, 0, R*0.5, 0, Math.PI*2); ctx.fill(); break;
      }
      case 'tired': {
        // Half-closed droopy eyes
        ctx.beginPath(); ctx.ellipse(-eyeDist/2, 1, R*scx+1, Math.max(0.5,R*scy*0.55), 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse( eyeDist/2, 1, R*scx+1, Math.max(0.5,R*scy*0.55), 0, 0, Math.PI*2); ctx.fill();
        // Heavy drooping upper lid
        ctx.strokeStyle=eyeColor; ctx.lineWidth=2.6;
        ctx.beginPath(); ctx.moveTo(-eyeDist/2-R*scx-1, -0.5); ctx.quadraticCurveTo(-eyeDist/2, -R*scy*0.4-1, -eyeDist/2+R*scx+1, -0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( eyeDist/2-R*scx-1, -0.5); ctx.quadraticCurveTo( eyeDist/2, -R*scy*0.4-1,  eyeDist/2+R*scx+1, -0.5); ctx.stroke();
        break;
      }
      case 'pupil_star': {
        // Round eyes with star-shaped pupil
        drawEye(-eyeDist/2, 0, R+1, false); drawEye(eyeDist/2, 0, R+1, false);
        ctx.fillStyle='rgba(255,255,255,0.9)';
        [-eyeDist/2, eyeDist/2].forEach(ex => {
          ctx.beginPath();
          for(let i=0;i<5;i++){
            const oa=-Math.PI/2+i*(Math.PI*2/5); const ia=oa+Math.PI/5;
            if(i===0) ctx.moveTo(ex+Math.cos(oa)*R*0.62, Math.sin(oa)*R*0.62);
            else ctx.lineTo(ex+Math.cos(oa)*R*0.62, Math.sin(oa)*R*0.62);
            ctx.lineTo(ex+Math.cos(ia)*R*0.28, Math.sin(ia)*R*0.28);
          }
          ctx.closePath(); ctx.fill();
        });
        ctx.fillStyle=eyeColor; break;
      }
      case 'number_3': {
        // UwU-like ">3" or "3" squished eye emoji look
        ctx.font=`bold ${Math.round(R*2.4)}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('3',-eyeDist/2,1); ctx.fillText('3',eyeDist/2,1); break;
      }
      case 'omega': {
        // Omega Ω shape — ancient/mystical
        ctx.font=`bold ${Math.round(R*2)}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('Ω',-eyeDist/2,0); ctx.fillText('Ω',eyeDist/2,0); break;
      }
      case 'square': {
        // Robotic square eyes
        const sz=R*scx+1.5; const sh=Math.max(1,R*scy+0.5);
        ctx.fillRect(-eyeDist/2-sz,-sh,sz*2,sh*2);
        ctx.fillRect( eyeDist/2-sz,-sh,sz*2,sh*2);
        ctx.fillStyle='rgba(255,255,255,0.3)';
        ctx.fillRect(-eyeDist/2-sz*0.5,-sh*0.6,sz*0.4,sh*0.5);
        ctx.fillRect( eyeDist/2-sz*0.5,-sh*0.6,sz*0.4,sh*0.5);
        ctx.fillStyle=eyeColor; break;
      }
      case 'loading': {
        // Loading circle eyes — internet slime
        ctx.strokeStyle=eyeColor; ctx.lineWidth=2.8;
        const t=Date.now()*0.003;
        [-eyeDist/2,eyeDist/2].forEach(ex => {
          ctx.beginPath(); ctx.arc(ex,0,R*scx+1,t,t+Math.PI*1.4); ctx.stroke();
        }); break;
      }
      case 'sus': {
        // Among Us style eye (one big oval, pupil at bottom)
        [-eyeDist/2, eyeDist/2].forEach(ex => {
          ctx.beginPath(); ctx.ellipse(ex,-1,R*scx+3,Math.max(0.5,R*scy+3),0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.ellipse(ex+1,2,R*scx+0.5,Math.max(0.3,R*scy*0.6),0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle=eyeColor;
        }); break;
      }
      default:
        drawEye(-eyeDist/2, 0, R); drawEye(eyeDist/2, 0, R); break;
    }
  };

  // ── DETAIL TRAIT RENDERER ─────────────────────────────────────────────────
  Slime.prototype._drawDetailTrait = function(eyeDist, eyeSize, faceWidth, faceHeight) {
    const dt = this.detailTrait;
    if (!dt || dt === 'none') return;

    if (dt === 'freckles') {
      ctx.fillStyle='rgba(60,20,20,0.35)';
      [-10,-6,6,10].forEach((x,i) => { ctx.beginPath(); ctx.arc(x,9+(i%2),1.2,0,Math.PI*2); ctx.fill(); });
    } else if (dt === 'speckles') {
      ctx.fillStyle='rgba(255,255,255,0.18)';
      [-12,-4,7,13].forEach((x,i) => { ctx.beginPath(); ctx.arc(x,-10+i,1.5,0,Math.PI*2); ctx.fill(); });
    } else if (dt === 'under_eyes') {
      ctx.strokeStyle='rgba(60,60,90,0.22)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(-eyeDist/2,eyeSize+3,eyeSize+2,0.2,Math.PI-0.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(eyeDist/2,eyeSize+3,eyeSize+2,0.2,Math.PI-0.2); ctx.stroke();
    } else if (dt === 'cheek_marks') {
      ctx.strokeStyle='rgba(255,255,255,0.24)'; ctx.lineWidth=1.6;
      [-1,1].forEach(side => {
        const bx=side*(eyeDist/2+8);
        for (let i=0;i<3;i++) { ctx.beginPath(); ctx.moveTo(bx,6+i*3); ctx.lineTo(bx+side*4,6+i*3); ctx.stroke(); }
      });
    } else if (dt === 'war_paint') {
      ctx.strokeStyle='rgba(180,40,40,0.7)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-eyeDist/2-4,-eyeSize+2); ctx.lineTo(-eyeDist/2+2,eyeSize+4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(eyeDist/2-2,-eyeSize+2); ctx.lineTo(eyeDist/2+4,eyeSize+4); ctx.stroke();
    } else if (dt === 'glitter') {
      const t = Date.now() * 0.003;
      for (let i=0;i<8;i++) {
        const a=i*(Math.PI*2/8)+t; const r=eyeSize*1.8;
        const gx=Math.cos(a)*r; const gy=Math.sin(a)*r;
        ctx.fillStyle=`hsla(${i*45},90%,70%,${0.5+Math.sin(t+i)*0.3})`;
        ctx.beginPath(); ctx.arc(gx,gy,1.2,0,Math.PI*2); ctx.fill();
      }
    } else if (dt === 'rune_mark') {
      ctx.fillStyle='rgba(180,140,80,0.5)';
      ctx.font=`${Math.round(eyeSize*2)}px serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('ᚱ', 0, -faceHeight*0.5);
    } else if (dt === 'circuit') {
      ctx.strokeStyle='rgba(80,200,120,0.4)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(-eyeDist/2-2,eyeSize+4); ctx.lineTo(-eyeDist/2-2,eyeSize+10); ctx.lineTo(eyeDist/2+2,eyeSize+10); ctx.lineTo(eyeDist/2+2,eyeSize+4); ctx.stroke();
      ctx.beginPath(); ctx.arc(0,eyeSize+10,2,0,Math.PI*2); ctx.fillStyle='rgba(80,200,120,0.5)'; ctx.fill();
    } else if (dt === 'constellation') {
      const stars=[[-eyeDist/2-8,-eyeSize-6],[eyeDist/2+8,-eyeSize-6],[0,-eyeSize-14],[-eyeDist/2+4,-eyeSize-10],[eyeDist/2-4,-eyeSize-10]];
      ctx.fillStyle='rgba(200,220,255,0.7)';
      stars.forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x,y,1.3,0,Math.PI*2); ctx.fill(); });
      ctx.strokeStyle='rgba(180,200,255,0.3)'; ctx.lineWidth=0.7;
      for (let i=0;i<stars.length-1;i++) { ctx.beginPath(); ctx.moveTo(stars[i][0],stars[i][1]); ctx.lineTo(stars[i+1][0],stars[i+1][1]); ctx.stroke(); }
    }
  };

  // ── MOUTH STYLE RENDERER ─────────────────────────────────────────────────
  Slime.prototype._drawMouthStyle = function(mouthStyle, eyeColor) {
    const mouthY = 9 + this.mouthOffsetY;
    const isScary = this.type === 'scary';
    const isCute  = this.type === 'cute';
    // Rich mouth stroke: use hue-derived tint instead of plain black
    const hue = this.hue;
    const strokeColor = isScary
      ? `hsl(${hue},60%,12%)`
      : `hsl(${hue},40%,18%)`;
    // Inner fill: always warm and visible — pink/peach tint for cute/normal, dark for scary
    const innerFill = isScary
      ? `hsla(${(hue+180)%360},60%,15%,0.65)`
      : `hsla(${(hue+20)%360},65%,82%,0.55)`;

    // Shadow under mouth for depth
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur  = 3;
    ctx.shadowOffsetY = 1.5;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = isCute ? 3.4 : (isScary ? 3.0 : 2.8);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    switch (mouthStyle) {
      case 'smile':       ctx.moveTo(-6,mouthY-1); ctx.quadraticCurveTo(0,mouthY+6,6,mouthY-1); break;
      case 'cat':         ctx.moveTo(-6,mouthY-1); ctx.quadraticCurveTo(-3,mouthY+5,0,mouthY-1); ctx.quadraticCurveTo(3,mouthY+5,6,mouthY-1); break;
      case 'tiny_o':      ctx.ellipse(0,mouthY,4,5,0,0,Math.PI*2); break;
      case 'grin':        ctx.moveTo(-8,mouthY); ctx.quadraticCurveTo(0,mouthY+9,8,mouthY); break;
      case 'smirk':       ctx.moveTo(-4,mouthY); ctx.quadraticCurveTo(2,mouthY+4,8,mouthY-2); break;
      case 'flat':        ctx.moveTo(-6,mouthY); ctx.lineTo(6,mouthY); break;
      case 'fangs':       ctx.moveTo(-7,mouthY-2); ctx.lineTo(-3,mouthY+3); ctx.lineTo(0,mouthY-2); ctx.lineTo(3,mouthY+3); ctx.lineTo(7,mouthY-2); break;
      case 'zigzag':      ctx.moveTo(-7,mouthY); ctx.lineTo(-3,mouthY-4); ctx.lineTo(0,mouthY); ctx.lineTo(3,mouthY-4); ctx.lineTo(7,mouthY); break;
      case 'open_smile':  ctx.moveTo(-7,mouthY-1); ctx.quadraticCurveTo(0,mouthY+9,7,mouthY-1); break;
      case 'pout':        ctx.moveTo(-5,mouthY+1); ctx.quadraticCurveTo(0,mouthY+5,5,mouthY+1); ctx.moveTo(-2,mouthY+1); ctx.quadraticCurveTo(0,mouthY-2,2,mouthY+1); break;
      case 'tiny_frown':  ctx.moveTo(-5,mouthY+3); ctx.quadraticCurveTo(0,mouthY-1,5,mouthY+3); break;
      case 'toothy':      ctx.rect(-7,mouthY-2,14,7); ctx.moveTo(-2,mouthY-2); ctx.lineTo(-2,mouthY+5); ctx.moveTo(2,mouthY-2); ctx.lineTo(2,mouthY+5); break;
      case 'squiggle':    ctx.moveTo(-7,mouthY); ctx.quadraticCurveTo(-4,mouthY-4,-1,mouthY); ctx.quadraticCurveTo(2,mouthY+4,5,mouthY); ctx.quadraticCurveTo(6,mouthY-1,7,mouthY); break;
      case 'bubble':      ctx.arc(0,mouthY,5,0,Math.PI*2); break;
      case 'kiss':        ctx.moveTo(-3,mouthY); ctx.arc(-3,mouthY,3,0,Math.PI); ctx.moveTo(3,mouthY); ctx.arc(3,mouthY,3,0,Math.PI); break;
      case 'candy_smile': ctx.moveTo(-7,mouthY); ctx.quadraticCurveTo(0,mouthY+7,7,mouthY); break;
      case 'laugh_open':  ctx.arc(0,mouthY,8,0,Math.PI); break;
      case 'starfish_mouth':
        for (let i=0;i<5;i++) {
          const a=-Math.PI/2+i*(Math.PI*2/5); const ia=a+Math.PI/5;
          if(i===0) ctx.moveTo(Math.cos(a)*5,mouthY+Math.sin(a)*5);
          else ctx.lineTo(Math.cos(a)*5,mouthY+Math.sin(a)*5);
          ctx.lineTo(Math.cos(ia)*2,mouthY+Math.sin(ia)*2);
        }
        ctx.closePath(); break;
      case 'whistle':     ctx.ellipse(0,mouthY,3,4.5,0,0,Math.PI*2); break;
      case 'chew':        ctx.moveTo(-5,mouthY); ctx.lineTo(5,mouthY); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-3,mouthY+2); ctx.bezierCurveTo(-1,mouthY+5,1,mouthY+5,3,mouthY+2); break;
      case 'hmm':         ctx.moveTo(-6,mouthY); ctx.quadraticCurveTo(-2,mouthY-3,0,mouthY); ctx.quadraticCurveTo(2,mouthY+3,6,mouthY); break;
      case 'drool':       ctx.moveTo(-7,mouthY-1); ctx.quadraticCurveTo(0,mouthY+7,7,mouthY-1); break;
      case 'wide_gape':   ctx.rect(-9,mouthY-1,18,9); break;
      case 'venom_drip':  ctx.moveTo(-7,mouthY-1); ctx.lineTo(-3,mouthY+3); ctx.lineTo(0,mouthY-1); ctx.lineTo(3,mouthY+3); ctx.lineTo(7,mouthY-1); break;
      case 'abyss_mouth': ctx.arc(0,mouthY,8,0,Math.PI*2); break;
      default:            ctx.moveTo(-5,mouthY); ctx.quadraticCurveTo(0,mouthY+5,5,mouthY); break;
    }
    ctx.stroke();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // Inner fill for open mouths — extended to more styles
    if (['open_smile','laugh_open','wide_gape','abyss_mouth','grin','smile','candy_smile','drool'].includes(mouthStyle)) {
      ctx.fillStyle = innerFill;
      ctx.beginPath();
      switch (mouthStyle) {
        case 'open_smile':  ctx.moveTo(-7,mouthY-1); ctx.quadraticCurveTo(0,mouthY+9,7,mouthY-1); ctx.closePath(); break;
        case 'laugh_open':  ctx.arc(0,mouthY,8,0,Math.PI); ctx.closePath(); break;
        case 'wide_gape':   ctx.rect(-9,mouthY-1,18,9); break;
        case 'abyss_mouth': ctx.arc(0,mouthY,8,0,Math.PI*2); break;
        case 'grin':        ctx.moveTo(-8,mouthY); ctx.quadraticCurveTo(0,mouthY+9,8,mouthY); ctx.closePath(); break;
        case 'smile':       ctx.moveTo(-6,mouthY-1); ctx.quadraticCurveTo(0,mouthY+6,6,mouthY-1); ctx.closePath(); break;
        case 'candy_smile': ctx.moveTo(-7,mouthY); ctx.quadraticCurveTo(0,mouthY+7,7,mouthY); ctx.closePath(); break;
        case 'drool':       ctx.moveTo(-7,mouthY-1); ctx.quadraticCurveTo(0,mouthY+7,7,mouthY-1); ctx.closePath(); break;
      }
      ctx.fill();
    }

    // Teeth for toothy / fangs
    if (mouthStyle === 'fangs' || mouthStyle === 'toothy') {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      if (mouthStyle === 'fangs') {
        ctx.beginPath(); ctx.moveTo(-7,mouthY-2); ctx.lineTo(-3,mouthY+2); ctx.lineTo(0,mouthY-2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0,mouthY-2); ctx.lineTo(3,mouthY+2); ctx.lineTo(7,mouthY-2); ctx.closePath(); ctx.fill();
      } else {
        [-4, 0, 4].forEach(tx => {
          ctx.beginPath(); ctx.rect(tx-1.8, mouthY-2, 3.6, 5); ctx.fill();
        });
      }
    }

    // Drool drop
    if (mouthStyle === 'drool' || mouthStyle === 'venom_drip') {
      const dColor = mouthStyle === 'venom_drip' ? 'rgba(80,220,80,0.7)' : innerFill;
      ctx.fillStyle = dColor;
      ctx.beginPath(); ctx.ellipse(mouthStyle==='venom_drip'?-3:2, mouthY+8, 2, 4, 0, 0, Math.PI*2); ctx.fill();
      if (mouthStyle === 'venom_drip') {
        ctx.beginPath(); ctx.ellipse(3, mouthY+6, 1.5, 3, 0, 0, Math.PI*2); ctx.fill();
      }
    }

    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  };
}
