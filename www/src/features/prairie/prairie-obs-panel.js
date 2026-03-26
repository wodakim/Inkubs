import { t } from '../../i18n/i18n.js';
import { clamp } from './prairie-constants.js';
import { getViewportSize } from './prairie-session.js';
import { findRecordById } from './prairie-slime-runtime.js';

const BEHAVIOR_LABELS = {
    approach:     t('behavior.approach'),
    observe:      t('behavior.observe'),
    follow:       t('behavior.follow'),
    orbit:        t('behavior.orbit'),
    bond:         t('behavior.bond'),
    romance:      t('behavior.romance'),
    investigate:  t('behavior.investigate'),
    challenge:    t('behavior.challenge'),
    intimidate:   t('behavior.intimidate'),
    flee:         t('behavior.flee'),
    recoil:       t('behavior.recoil'),
    calm:         t('behavior.calm'),
    wander:       t('behavior.wander'),
    idle_look:    t('behavior.idle_look'),
    explore_jump: t('behavior.explore_jump'),
    sniff_object: t('behavior.sniff_object'),
    play_ball:    t('behavior.play_ball'),
    sit_stump:    t('behavior.sit_stump'),
    flee_short:   t('behavior.flee_short'),
    fight_clash:  t('behavior.fight_clash'),
    fight_won:    t('behavior.fight_won'),
    fight_lost:   t('behavior.fight_lost'),
    seek_food:    t('behavior.seek_food'),
    eat_berry:    t('behavior.eat_berry'),
    hunt_bird:    t('behavior.hunt_bird'),
    communicate:  t('behavior.communicate'),
    falcon_dive:  t('behavior.falcon_dive'),
    sit_bench:    t('behavior.sit_bench'),
    eject_bench:  t('behavior.eject_bench'),
};

const STAT_LABELS = {
    curiosity: `🔍 ${t('stat.curiosity')}`,
    empathy:   `💚 ${t('stat.empathy')}`,
    ferocity:  `🔥 ${t('stat.ferocity')}`,
    stability: `🧘 ${t('stat.stability')}`,
    vitality:  `💪 ${t('stat.vitality')}`,
    agility:   `⚡ ${t('stat.agility')}`,
};

export function openObsPanel(ctx) {
    if (!ctx.obsPanel) return;
    ctx.obsPanel.hidden = false;
    ctx.obsOpen = true;
    requestAnimationFrame(() => ctx.obsPanel.classList.add('is-open'));
    applyObsLayout(ctx);
    updateObsContent(ctx);
    clearInterval(ctx.obsUpdateInterval);
    ctx.obsUpdateInterval = setInterval(() => updateObsContent(ctx), 500);
}

export function closeObsPanel(ctx) {
    if (!ctx.obsPanel) return;
    ctx.obsPanel.classList.remove('is-open');
    ctx.obsOpen = false;
    ctx.obsLoupeMode = false;
    ctx.loupeBtn?.classList.remove('is-active');
    clearInterval(ctx.obsUpdateInterval);
    setTimeout(() => { if (!ctx.obsOpen && ctx.obsPanel) ctx.obsPanel.hidden = true; }, 200);
}

export function selectSlimeForObs(ctx, canonicalId) {
    ctx.obsSelectedSlimeId = canonicalId;
    ctx.obsLoupeMode = false;
    ctx.loupeBtn?.classList.remove('is-active');
    const record = findRecordById(ctx, canonicalId);
    const name = record?.identity?.name || record?.canonicalSnapshot?.identity?.name || 'Inkübus';
    if (ctx.obsTitle) ctx.obsTitle.textContent = name;
    if (ctx.obsHint) ctx.obsHint.hidden = true;
    if (ctx.obsBody) ctx.obsBody.style.display = '';
    if (!ctx.obsOpen) openObsPanel(ctx);
    updateObsContent(ctx);
}

export function applyObsLayout(ctx) {
    if (!ctx.obsPanel || !ctx.obsPos) return;
    const vp = getViewportSize();
    ctx.obsPos.width  = clamp(ctx.obsPos.width,  200, vp.width  - 10);
    ctx.obsPos.height = clamp(ctx.obsPos.height, 140, vp.height - 50);
    ctx.obsPos.top    = clamp(ctx.obsPos.top,      0, vp.height - ctx.obsPos.height - 10);
    ctx.obsPos.left   = clamp(ctx.obsPos.left,     0, vp.width  - ctx.obsPos.width  - 4);
    ctx.obsPanel.style.setProperty('--obs-top',   `${ctx.obsPos.top}px`);
    ctx.obsPanel.style.setProperty('--obs-left',  `${ctx.obsPos.left}px`);
    ctx.obsPanel.style.setProperty('--obs-bot',   'auto');
    ctx.obsPanel.style.setProperty('--obs-right', 'auto');
    ctx.obsPanel.style.setProperty('--obs-w',     `${ctx.obsPos.width}px`);
    ctx.obsPanel.style.setProperty('--obs-h',     `${ctx.obsPos.height}px`);
    ctx.obsPanel.style.setProperty('--obs-maxh',  'none');
}

export function initObsPos(ctx) {
    if (ctx.obsPos || !ctx.obsPanel) return;
    const r = ctx.obsPanel.getBoundingClientRect();
    ctx.obsPos = { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function updateObsContent(ctx) {
    if (!ctx.obsOpen || !ctx.obsSelectedSlimeId) return;
    const entry = ctx.runtimeById.get(ctx.obsSelectedSlimeId);
    if (!entry) return;
    const brain = entry.slime._prairieBrain;
    if (!brain) return;

    if (ctx.obsActiveTab === 'log') {
        renderLogPage(ctx, brain, entry);
    } else if (ctx.obsActiveTab === 'journal') {
        renderJournalPage(ctx, brain, entry);
    } else {
        renderStatsPage(ctx, brain, entry);
    }
}

function renderLogPage(ctx, brain, entry) {
    if (!ctx.obsPageLog) return;
    const log = brain.interactionLog;
    
    // Section 1 : Journal d'Activité
    let html = '<div class="prairie-obs__section prairie-obs__section--activity">';
    if (!log.length) {
        html += `<p class="prairie-obs__empty-msg">${t('prairie.no_interaction')}</p>`;
    } else {
        const items = log.slice(-20).reverse();
        for (const ev of items) {
            const label = BEHAVIOR_LABELS[ev.type] || ev.type;
            const ago = formatTimeAgo(ev.time);
            const detail = ev.detail ? `<span class="prairie-obs__detail">${ev.detail}</span>` : '';
            let targetStr = '';
            if (ev.targetId) {
                const tRecord = findRecordById(ctx, ev.targetId);
                const tName = tRecord?.identity?.name || tRecord?.canonicalSnapshot?.identity?.name || '';
                if (tName) targetStr = `<span class="prairie-obs__target">→ ${tName}</span>`;
            }
            html += `<div class="prairie-obs__log-item"><span class="prairie-obs__log-label">${label}</span>${targetStr}${detail}<span class="prairie-obs__log-time">${ago}</span></div>`;
        }
    }
    html += '</div>';

    // Section 2 : Relations
    html += '<div class="prairie-obs__section prairie-obs__section--relations">';
    html += `    <div class="prairie-obs__section-title">${t('prairie.obs.relations_title') || 'Relations'}</div>`;
    html += '    <div id="obs-social-affinities-container" class="prairie-obs__social-container">';
    
    // Extraction des relations
    const record = findRecordById(ctx, ctx.obsSelectedSlimeId);
    let socialAffinities = {};
    if (entry?.slime?.identity?.canonical?.socialAffinities) {
        socialAffinities = entry.slime.identity.canonical.socialAffinities;
    } else if (record?.identity?.canonical?.socialAffinities) {
        socialAffinities = record.identity.canonical.socialAffinities;
    } else if (record?.canonicalSnapshot?.canonical?.socialAffinities) {
        socialAffinities = record.canonicalSnapshot.canonical.socialAffinities;
    }

    const affinityKeys = Object.keys(socialAffinities);
    if (affinityKeys.length === 0) {
        html += '<p class="prairie-obs__empty-msg" style="padding-left:12px;opacity:0.6;">Aucune relation marquante</p>';
    } else {
        html += '<ul class="prairie-obs__social-list" style="list-style:none; padding:12px; margin:0; line-height:1.4em;">';
        for (const targetId of affinityKeys) {
            const score = socialAffinities[targetId];
            let relLabel = "Neutre";
            let color = "rgba(180, 200, 195, 0.7)";
            
            if (score <= -0.6) { relLabel = "Rival"; color = "#ff6b6b"; }
            else if (score >= 0.6) { relLabel = "Ami"; color = "#7ceb8b"; }
            else if (score < -0.2) { relLabel = "Hostile"; color = "#ffa86b"; }
            else if (score > 0.2) { relLabel = "Amical"; color = "#a5eb7c"; }
            
            // Tentative de récupération du nom de la cible
            const targetRecord = findRecordById(ctx, targetId);
            const targetName = targetRecord?.displayName 
                            || targetRecord?.identity?.name 
                            || targetRecord?.canonicalSnapshot?.identity?.name 
                            || `ID #${String(targetId).slice(-4)}`;
                            
            html += `<li class="prairie-obs__social-item" style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.9em;">
                <span>${targetName}</span>
                <strong style="color:${color}">${relLabel}</strong>
            </li>`;
        }
        html += '</ul>';
    }
    html += '    </div>';
    html += '</div>';

    ctx.obsPageLog.innerHTML = html;
}

function renderStatsPage(ctx, brain, entry) {
    if (!ctx.obsPageStats) return;
    const stats = entry.slime.stats;
    const changes = brain.statChangeLog;
    const now = Date.now();

    let html = '';
    const fresh = changes.filter(c => now - c.time < 5000);
    if (fresh.length) {
        html += '<div class="prairie-obs__toasts">';
        for (const c of fresh.slice(-5).reverse()) {
            const diff = c.newVal - c.oldVal;
            const age  = now - c.time;
            const opacity = age < 2000 ? 1 : Math.max(0, 1 - (age - 2000) / 3000);
            const sign = diff > 0 ? '+' : '';
            const cls  = diff > 0 ? 'prairie-obs__toast--up' : 'prairie-obs__toast--down';
            const statLabel = (STAT_LABELS[c.stat] || c.stat).replace(/^\S+\s/, '');
            html += `<div class="prairie-obs__toast ${cls}" style="opacity:${opacity.toFixed(2)}">${sign}${diff.toFixed(1)} ${statLabel}</div>`;
        }
        html += '</div>';
    }

    html += '<div class="prairie-obs__stats-grid">';
    for (const [key, label] of Object.entries(STAT_LABELS)) {
        const val = stats?.[key];
        if (val === undefined) continue;
        const pct = clamp(val, 0, 100);
        html += `<div class="prairie-obs__stat-row">
            <div class="prairie-obs__stat-head"><span class="prairie-obs__stat-label">${label}</span><span class="prairie-obs__stat-val">${Math.round(pct)}</span></div>
            <div class="prairie-obs__stat-bar"><div class="prairie-obs__stat-fill" style="width:${pct}%"></div></div>
        </div>`;
    }
    html += '</div>';

    const hunger = Math.round(brain.hunger ?? 0);
    const hungerColor = hunger > 70 ? '#e05050' : hunger > 40 ? '#d08030' : '#50b070';
    const hungerLabel = hunger > 80 ? t('hunger.starving') : hunger > 55 ? t('hunger.hungry') : hunger > 30 ? t('hunger.peckish') : t('hunger.satisfied');
    html += `<div class="prairie-obs__stat-row" style="margin-top:0.3rem">
        <div class="prairie-obs__stat-head"><span class="prairie-obs__stat-label">${t('prairie.obs.hunger_label')}</span><span class="prairie-obs__stat-val">${hunger}</span></div>
        <div class="prairie-obs__stat-bar"><div class="prairie-obs__stat-fill" style="width:${hunger}%;background:${hungerColor}"></div></div>
    </div>
    <div style="font-size:0.48rem;color:rgba(180,200,195,0.5);margin-bottom:0.3rem;padding-left:2px">${hungerLabel}</div>`;

    const bLabel = BEHAVIOR_LABELS[brain.behavior] || brain.behavior;
    html += `<div class="prairie-obs__current">${t('prairie.obs.behavior_label')} : <strong>${bLabel}</strong></div>`;

    const prog = entry.slime.livingState?.progressionLedger;
    const temperament = prog?.temperament;
    if (temperament && temperament !== 'neutral') {
        const TEMP_ICONS = { combatant: '⚔️', fearful: '😨', resilient: '🛡️', pacifist: '☮️' };
        const wins   = prog?.combatWins   || 0;
        const losses = prog?.combatLosses || 0;
        const combatStr = (wins > 0 || losses > 0) ? ` · ${wins}V/${losses}D` : '';
        const tempLabel = t(`temperament.${temperament}`) || temperament;
        html += `<div class="prairie-obs__current" style="opacity:0.82;font-size:0.88em">${TEMP_ICONS[temperament] || '•'} ${t('prairie.obs.temperament_label')} : <strong>${tempLabel}</strong>${combatStr}</div>`;
    }

    const relLedger = entry.slime.livingState?.relationshipLedger;
    if (relLedger && Object.keys(relLedger.affinities || {}).length > 0) {
        const REL_TYPE_ICONS = { lover: '💕', friend: '💚', friendly: '🙂', neutral: '😐', hostile: '😠', rival: '⚔️', combat_partner: '🥊' };
        html += `<div class="prairie-obs__bias-title">${t('prairie.obs.relations_title')}</div>`;
        for (const [tid, rel] of Object.entries(relLedger.affinities)) {
            let name = rel.displayName;
            if (!name) {
                const rec = findRecordById(ctx, tid);
                name = rec?.identity?.name || rec?.canonicalSnapshot?.identity?.name || '';
            }
            if (!name) continue;
            const icon     = REL_TYPE_ICONS[rel.type] || '😐';
            const typeFr   = t(`relation.${rel.type}`) || rel.type || t('relation.neutral');
            const biasColor = rel.bias > 0 ? 'rgba(80,220,120,0.8)' : rel.bias < 0 ? 'rgba(220,80,80,0.8)' : 'rgba(180,180,180,0.7)';
            html += `<div class="prairie-obs__bias-row"><span>${icon} ${name}</span><span style="color:${biasColor}">${typeFr}</span></div>`;
            const lastEv = rel.significantEvents?.[rel.significantEvents.length - 1];
            if (lastEv) {
                html += `<div class="prairie-obs__stat-change" style="font-style:italic;opacity:0.7;padding-left:8px"><span>${lastEv.note}</span></div>`;
            }
        }
    }

    ctx.obsPageStats.innerHTML = html;
}

function generateLog(ctx, brain, slime) {
    const lines = [];
    const genome = slime?.genome || {};
    const diet = genome.dietType || 'omnivore';
    const laziness = genome.laziness ?? 0.5;
    const hunger = brain.hunger ?? 0;
    const em = brain.emotionalState || { happiness: 0.5, fear: 0 };
    const objMem = slime?.livingState?.objectMemoryLedger || {};
    const relLedger = slime?.livingState?.relationshipLedger;

    if (hunger > 80) { lines.push(t('journal.hunger.starving')); } 
    else if (hunger > 55) { lines.push(t('journal.hunger.hungry')); } 
    else if (hunger > 30) { lines.push(t('journal.hunger.peckish')); } 
    else { lines.push(t('journal.hunger.satisfied')); }

    const nearbyObjects = ctx.prairieObjects.filter(o => (o.type === 'berry_bush' || o.type === 'bird') && o.interactive !== false);
    for (const obj of nearbyObjects) {
        let memKey = null;
        if (obj.type === 'berry_bush') memKey = `berry_${obj.berryType || 'red'}`;
        else if (obj.type === 'bird')  memKey = 'bird_meat';
        if (!memKey) continue;
        const mem = objMem[memKey];
        if (!mem) continue;
        const pp = mem.pleasurePain;
        if (pp <= -0.3 && hunger > 40) {
            if (obj.type === 'berry_bush') lines.push(t('journal.memory.bad_berries').replace('{type}', obj.berryType || ''));
            else lines.push(t('journal.memory.bad_bird'));
        } else if (pp >= 0.3 && hunger > 30) {
            if (obj.type === 'berry_bush') lines.push(t('journal.memory.good_berries'));
            else lines.push(t('journal.memory.good_bird'));
        }
    }

    lines.push(t(`journal.diet.${diet}`) || t('journal.diet.omnivore'));

    if (laziness > 0.75) lines.push(t('journal.laziness.high'));
    else if (laziness < 0.25) lines.push(t('journal.laziness.low'));

    const bLabel = BEHAVIOR_LABELS[brain.behavior] || brain.behavior;
    lines.push(t('journal.behavior.current').replace('{behavior}', bLabel));

    if (em.fear > 0.5) lines.push(t('journal.emotion.fear'));
    else if (em.happiness > 0.75) lines.push(t('journal.emotion.happy'));
    else if (em.happiness < 0.3) lines.push(t('journal.emotion.lonely'));

    if (relLedger) {
        const friends = Object.values(relLedger.affinities || {}).filter(r => r.type === 'friend' || r.type === 'lover');
        const rivals  = Object.values(relLedger.affinities || {}).filter(r => r.type === 'rival' || r.type === 'hostile');
        if (friends.length > 0) lines.push(t('journal.relation.friend').replace('{name}', friends[0].displayName));
        if (rivals.length > 0) lines.push(t('journal.relation.rival').replace('{name}', rivals[0].displayName));
    }

    return lines.slice(0, 6);
}

function renderJournalPage(ctx, brain, entry) {
    if (!ctx.obsPageJournal) return;
    const slime = entry?.slime;
    if (!slime) {
        ctx.obsPageJournal.innerHTML = `<p class="prairie-obs__empty-msg">${t('prairie.obs.no_slime')}</p>`;
        return;
    }
    const thoughts = generateLog(ctx, brain, slime);
    let html = '<div class="prairie-obs__journal">';
    for (const line of thoughts) {
        html += `<p class="prairie-obs__journal-line">💭 ${line}</p>`;
    }
    const hunger = Math.round(brain.hunger ?? 0);
    const hungerColor = hunger > 70 ? '#e05050' : hunger > 40 ? '#e09030' : '#50b070';
    html += `<div class="prairie-obs__journal-hunger">
        <span>${t('prairie.obs.journal_hunger')}</span>
        <div class="prairie-obs__stat-bar" style="flex:1;margin-left:6px">
            <div class="prairie-obs__stat-fill" style="width:${hunger}%;background:${hungerColor}"></div>
        </div>
        <span style="margin-left:4px;font-size:0.85em">${hunger}/100</span>
    </div>`;
    const dietEmoji = { herbivore: '🌿', carnivore: '🥩', omnivore: '🍽️' };
    const diet = slime.genome?.dietType || 'omnivore';
    html += `<div class="prairie-obs__journal-badge">${dietEmoji[diet] || '🍽️'} ${t(`diet.${diet}`) || diet}</div>`;
    html += '</div>';
    ctx.obsPageJournal.innerHTML = html;
}

function formatTimeAgo(timestamp) {
    const sec = Math.round((Date.now() - timestamp) / 1000);
    if (sec < 5) return t('time.just_now');
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    return `${min}m`;
}

export function bindObsInteractions(ctx) {
    if (!ctx.loupeBtn || !ctx.obsPanel) return;

    ctx.loupeBtn.addEventListener('click', () => {
        if (ctx.obsOpen && !ctx.obsLoupeMode) {
            closeObsPanel(ctx);
            return;
        }
        if (ctx.obsLoupeMode) {
            ctx.obsLoupeMode = false;
            ctx.loupeBtn.classList.remove('is-active');
            return;
        }
        ctx.obsLoupeMode = true;
        ctx.loupeBtn.classList.add('is-active');
        if (!ctx.obsOpen) {
            openObsPanel(ctx);
            if (ctx.obsHint) ctx.obsHint.hidden = false;
            if (ctx.obsBody) ctx.obsBody.style.display = 'none';
        }
    });

    ctx.obsClose?.addEventListener('click', () => closeObsPanel(ctx));

    ctx.obsDragHandle?.addEventListener('pointerdown', (e) => {
        if (e.target.closest('[data-prairie-obs-close]') || e.target.closest('[data-prairie-obs-tab]')) return;
        initObsPos(ctx);
        ctx.obsDrag = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, pt: ctx.obsPos.top, pl: ctx.obsPos.left };
        ctx.obsDragHandle.setPointerCapture(e.pointerId);
        e.preventDefault();
    }, { passive: false });
    
    ctx.obsDragHandle?.addEventListener('pointermove', (e) => {
        if (!ctx.obsDrag || ctx.obsDrag.pid !== e.pointerId) return;
        ctx.obsPos.top  = ctx.obsDrag.pt + (e.clientY - ctx.obsDrag.sy);
        ctx.obsPos.left = ctx.obsDrag.pl + (e.clientX - ctx.obsDrag.sx);
        applyObsLayout(ctx);
    }, { passive: true });
    
    const releaseObsDrag = (e) => {
        if (!ctx.obsDrag || ctx.obsDrag.pid !== e.pointerId) return;
        ctx.obsDragHandle.releasePointerCapture(e.pointerId);
        ctx.obsDrag = null;
    };
    
    ctx.obsDragHandle?.addEventListener('pointerup', releaseObsDrag, { passive: true });
    ctx.obsDragHandle?.addEventListener('pointercancel', releaseObsDrag, { passive: true });

    for (const corner of (ctx.obsPanel?.querySelectorAll('[data-corner]') || [])) {
        corner.addEventListener('pointerdown', (e) => {
            initObsPos(ctx);
            ctx.obsResize = {
                pid: e.pointerId, sx: e.clientX, sy: e.clientY,
                pw: ctx.obsPos.width, ph: ctx.obsPos.height, pt: ctx.obsPos.top, pl: ctx.obsPos.left,
                corner: corner.dataset.corner,
            };
            corner.setPointerCapture(e.pointerId);
            e.preventDefault(); e.stopPropagation();
        }, { passive: false });
        
        corner.addEventListener('pointermove', (e) => {
            if (!ctx.obsResize || ctx.obsResize.pid !== e.pointerId) return;
            const dx = e.clientX - ctx.obsResize.sx;
            const dy = e.clientY - ctx.obsResize.sy;
            const c  = ctx.obsResize.corner;
            if (c === 'br' || c === 'tr') ctx.obsPos.width  = ctx.obsResize.pw + dx;
            if (c === 'bl' || c === 'tl') { ctx.obsPos.width = ctx.obsResize.pw - dx; ctx.obsPos.left = ctx.obsResize.pl + dx; }
            if (c === 'br' || c === 'bl') ctx.obsPos.height = ctx.obsResize.ph + dy;
            if (c === 'tr' || c === 'tl') { ctx.obsPos.height = ctx.obsResize.ph - dy; ctx.obsPos.top = ctx.obsResize.pt + dy; }
            applyObsLayout(ctx);
        }, { passive: true });
        
        const releaseCorner = (e) => {
            if (!ctx.obsResize || ctx.obsResize.pid !== e.pointerId) return;
            corner.releasePointerCapture(e.pointerId);
            ctx.obsResize = null;
        };
        
        corner.addEventListener('pointerup', releaseCorner, { passive: true });
        corner.addEventListener('pointercancel', releaseCorner, { passive: true });
    }

    for (const tab of ctx.obsTabs) {
        tab.addEventListener('click', () => {
            ctx.obsActiveTab = tab.dataset.prairieObsTab;
            for (const t of ctx.obsTabs) t.classList.toggle('is-active', t === tab);
            ctx.obsPageLog?.classList.toggle('is-active', ctx.obsActiveTab === 'log');
            ctx.obsPageStats?.classList.toggle('is-active', ctx.obsActiveTab === 'stats');
            ctx.obsPageJournal?.classList.toggle('is-active', ctx.obsActiveTab === 'journal');
            updateObsContent(ctx);
        });
    }
}