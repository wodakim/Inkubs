// ═══════════════════════════════════════════════════════════════════════════
//  SLIME SOUND ENGINE v4.1 — RPG / Anime slime sounds (with ZzFX integration)
//
//  Reference: Dragon Quest slime, Rimuru (TenSura), classic JRPG gel monsters.
// ═══════════════════════════════════════════════════════════════════════════

let _ctx    = null;
let _master = null;
let _enabled = true;
let _bgm     = null;

let _saved = {};
try { _saved = JSON.parse(localStorage.getItem('inku.settings.v1') || '{}'); } catch(e) {}
const _defM = (_saved.master ?? 80) / 100;
let _sfxVol   = _defM * ((_saved.sfx ?? 90) / 100);
let _musicVol = _defM * ((_saved.music ?? 60) / 100);

function getCtx() {
    if (_ctx) return _ctx;
    try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
        _master = _ctx.createGain();
        _master.gain.value = _sfxVol;
        _master.connect(_ctx.destination);
    } catch(e) { _ctx = null; }
    return _ctx;
}

function resume() {
    const c = getCtx();
    if (c?.state === 'suspended') c.resume();
    return c;
}

export const SlimeSoundEngine = {
    setEnabled(v) { _enabled = !!v; },
    isEnabled()   { return _enabled; },

    // --- AJOUT : Contrôles de volume séparés ---
    setSfxVolume(v) {
        _sfxVol = Math.max(0, Math.min(1, v));
        if (_master) _master.gain.value = _sfxVol;
    },
    setMusicVolume(v) {
        _musicVol = Math.max(0, Math.min(1, v));
        if (_bgm) _bgm.volume = _musicVol;
    },
    playBGM(url) {
        if (!_enabled) return;
        
        // Si on utilise la balise HTML, url est vide
        if (url) {
            if (!_bgm) {
                _bgm = new Audio(url);
                _bgm.loop = true;
            } else if (!_bgm.src.endsWith(url.replace('./', ''))) {
                _bgm.src = url;
            }
        } else if (!_bgm) {
            _bgm = document.getElementById('bgMusic');
        }

        if (_bgm) {
            _bgm.volume = _musicVol; // Applique le volume de la musique
            const playPromise = _bgm.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    const onInteract = () => {
                        if (_bgm && _enabled) _bgm.play();
                        window.removeEventListener('click', onInteract);
                        window.removeEventListener('touchstart', onInteract);
                    };
                    window.addEventListener('click', onInteract);
                    window.addEventListener('touchstart', onInteract);
                });
            }
        }
    },

    stopBGM() {
        if (_bgm) _bgm.pause();
    },

    playGrab(slime) {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        playGrab(c, extractProfile(slime));
    },
    playPoke(slime) {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        playPoke(c, extractProfile(slime));
    },
    playJump(jumpStrength, slime) {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        playJump(c, jumpStrength || 8, extractProfile(slime));
    },
    playSpringRelease(tension, releaseSpeed, slime) {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        playSpringRelease(c, tension || 0, releaseSpeed || 0, extractProfile(slime));
    },
    playBump(slime) {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        playBump(c, extractProfile(slime));
    },
    playGroupChime(count) {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        playGroupChime(c, Math.max(2, Math.min(4, count || 2)));
    },
    playTowerWobble(intensity) {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        playTowerWobble(c, clampI(intensity || 0.5));
    },
    playTowerFall() {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        playTowerFall(c);
    },
    // NOUVEAU : On exporte la fonction playLand pour que la physique puisse l'appeler !
    playLand(impactVelocity, slime) {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        playLand(c, impactVelocity || 0, extractProfile(slime));
    },
    playNavClick() {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        
        // On utilise la syntaxe EXACTE avec les virgules vides pour 
        // laisser le moteur appliquer ses bonnes valeurs par défaut
        let navParams = [.7,-0.45,78,.06,.09,.19,1,1.5,-20,51.6,1e3,,,.2,1,,,,,,-757];
        
        zzfx(...navParams);
    },
    playTrampoline() {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        zzfx(1, .1, 400, .01, .1, .2, 0, 2, 10);
    },
    playTeleport() {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        zzfx(0.5, 0, 100, .1, .3, .5, 0, 1.5, 20);
    },
    playMagicWoosh() {
        if (!_enabled) return;
        const c = resume(); if (!c) return;
        // Un son de transition magique type woosh/portal
        zzfx(0.8, 0.1, 150, .4, .2, .6, 1, 2.5, 10);
    }
};

function clampI(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// ── Profile ────────────────────────────────────────────────────────────────────
function extractProfile(slime) {
    if (!slime) return defaultProfile();

    const rawRig  = slime.rigidity      ?? slime.genome?.rigidity      ?? 0.05;
    const rawDamp = slime.bounceDamping ?? slime.genome?.bounceDamping ?? 0.18;
    const radius  = slime.baseRadius    ?? 38;

    const rigN  = Math.min(1, Math.max(0, (rawRig  - 0.01) / 0.13));
    const dampN = Math.min(1, Math.max(0, (rawDamp - 0.08) / 0.20));
    const sizeN = Math.min(1, Math.max(0, (radius  - 28)   / 24));

    const mass      = slime.genome?.instabilityMass ?? null;
    const massShift = mass === 'gaseous' ? -1 : mass === 'heavy' ? 1 : 0;

    const shape = slime.genome?.bodyShape ?? slime.bodyShape ?? 'blob';
    const bounceMap = { blob:1.0, mochi:0.90, puff:0.82, pear:0.68, teardrop:0.65, wisp:0.50, dumpling:0.58 };
    const bounce    = bounceMap[shape] ?? 0.72;

    const hex = (slime.color ?? slime.genome?.color ?? '#88cc88').replace('#','');
    const r   = parseInt(hex.slice(0,2),16)||128;
    const g   = parseInt(hex.slice(2,4),16)||128;
    const b   = parseInt(hex.slice(4,6),16)||128;
    const colorPitch = (r * 0.5 + g * 0.3 + b * 0.2) / 255;  // 0..1

    const stats  = slime.stats ?? {};
    const vitalN = Math.min(1, (stats.vitality ?? 50) / 100);

    return { rigN, dampN, sizeN, massShift, bounce, colorPitch, vitalN };
}

function defaultProfile() {
    return { rigN:0.3, dampN:0.3, sizeN:0.5, massShift:0, bounce:0.8, colorPitch:0.5, vitalN:0.5 };
}

// ── Helpers & ZzFX Engine ────────────────────────────────────────────────────
function st(f, n) { return f * Math.pow(2, n/12); }
function jit(r)   { return 1 + (Math.random()*2 - 1) * r; }

function makeNoise(ctx, dur) {
    const n   = Math.ceil(ctx.sampleRate * Math.max(0.001, dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random()*2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; return src;
}

function wire(...nodes) {
    for (let i = 0; i < nodes.length-1; i++) nodes[i].connect(nodes[i+1]);
    nodes[nodes.length-1].connect(_master);
    return nodes[0];
}

// ZzFX micro-synth (branché sur _master !)
const zzfxR = 44100;
const zzfxG = (p=1,k=.05,b=220,e=0,r=0,t=.1,q=0,D=1,u=0,y=0,v=0,z=0,l=0,E=0,A=0,F=0,c=0,w=1,m=0,B=0,N=0)=>{let M=Math,R=44100,d=2*M.PI,G=u*=500*d/R/R,C=b*=(1-k+2*k*M.random(k=[]))*d/R,g=0,H=0,a=0,n=1,I=0,J=0,f=0,x,h;e=R*e+9;m*=R;r*=R;t*=R;c*=R;y*=500*d/R**3;A*=d/R;v*=d/R;z*=R;l=R*l|0;for(h=e+m+r+t+c|0;a<h;k[a++]=f)++J%(100*F|0)||(f=q?1<q?2<q?3<q?M.sin((g%d)**3):M.max(M.min(M.tan(g),1),-1):1-(2*g/d%2+2)%2:1-4*M.abs(M.round(g/d)-g/d):M.sin(g),f=(l?1-B+B*M.sin(d*a/l):1)*(0<f?1:-1)*M.abs(f)**D*p*(a<e?a/e:a<e+m?1-(a-e)/m*(1-w):a<e+m+r?w:a<h-c?(h-a-c)/t*w:0),f=c?f/2+(c>a?0:(a<h-c?1:(h-a)/c)*k[a-c|0]/2):f),x=(b+=u+=y)*M.cos(A*H++),g+=x-x*E*(1-1E9*(M.sin(a)+1)%2);if(N)for(N=1-(0<N?M.exp(-N/R):M.exp(N/R)),a=H=g=0;a<h;)x=k[a],g+=N*(x-g),H+=N*(g-H),k[a++]=0<N?H:x-H;return[k]};
const zzfx = (...args) => {
    const ctx = getCtx();
    if (!ctx || !_master) return;
    const buffer = zzfxG(...args);
    const source = ctx.createBufferSource();
    const audioBuffer = ctx.createBuffer(buffer.length, buffer[0].length, zzfxR);
    buffer.map((d, i) => audioBuffer.getChannelData(i).set(d));
    source.buffer = audioBuffer;
    source.connect(_master); 
    source.start();
    return source;
};

// ─────────────────────────────────────────────────────────────────────────────
//  GRAB  "bwlop" — fingers sinking into anime slime
// ─────────────────────────────────────────────────────────────────────────────
function playGrab(ctx, p) {
    const T = ctx.currentTime;
    const { rigN, dampN, sizeN, massShift, bounce, colorPitch, vitalN } = p;

    const mSemi   = massShift === 1 ? -3 : massShift === -1 ? 5 : 0;
    const baseF   = st(280 - sizeN*70, mSemi + (colorPitch-0.5)*5) * jit(0.06);
    const wobHz   = (4 + (1-rigN)*8) * jit(0.13); 
    const wobD    = (0.08 + (1-rigN)*0.18 + bounce*0.06) * jit(0.12);
    const decayT  = (0.18 + (1-dampN)*0.22 + bounce*0.05) * jit(0.09);

    const carrier = ctx.createOscillator(); carrier.type = 'sine';
    carrier.frequency.setValueAtTime(baseF * 1.18, T);
    carrier.frequency.setTargetAtTime(baseF * 0.58, T + 0.010, 0.055);

    const lfo  = ctx.createOscillator(); lfo.type = 'sine';
    lfo.frequency.setValueAtTime(wobHz, T);
    lfo.frequency.setTargetAtTime(wobHz * 0.25, T + 0.01, decayT * 0.4);
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(baseF * wobD, T);
    lfoG.gain.setTargetAtTime(1, T + 0.01, decayT * 0.35);
    lfo.connect(lfoG); lfoG.connect(carrier.frequency);

    const envA = ctx.createGain();
    envA.gain.setValueAtTime(0, T);
    envA.gain.linearRampToValueAtTime((0.22 + vitalN*0.07) * jit(0.08), T + 0.018);
    envA.gain.setTargetAtTime(0.001, T + 0.022, decayT * 0.32);

    const lpA = ctx.createBiquadFilter(); lpA.type = 'lowpass';
    lpA.frequency.setValueAtTime(1400 + bounce*300, T);
    lpA.frequency.setTargetAtTime(400, T + 0.01, decayT * 0.28);
    lpA.Q.value = 0.8 + (1-rigN)*0.5;

    wire(carrier, lpA, envA);
    carrier.start(T); carrier.stop(T + decayT + 0.08);
    lfo.start(T);     lfo.stop(T + decayT + 0.08);

    const noiseDur = decayT * 0.5;
    const noiseB   = makeNoise(ctx, noiseDur);
    const bpB = ctx.createBiquadFilter(); bpB.type = 'bandpass';
    bpB.frequency.setValueAtTime(st(380 + bounce*80, mSemi) * jit(0.11), T);
    bpB.frequency.setTargetAtTime(120, T + 0.008, noiseDur * 0.28);
    bpB.Q.value = 2.0 + bounce*1.2;

    const lpB = ctx.createBiquadFilter(); lpB.type = 'lowpass';
    lpB.frequency.value = 1100; lpB.Q.value = 0.6;

    const envB = ctx.createGain();
    envB.gain.setValueAtTime(bounce * 0.11 * jit(0.11), T + 0.006);
    envB.gain.setTargetAtTime(0.001, T + 0.004, noiseDur * 0.30);

    wire(noiseB, bpB, lpB, envB);
    noiseB.start(T); noiseB.stop(T + noiseDur + 0.01);

    const body = ctx.createOscillator(); body.type = 'sine';
    body.frequency.setValueAtTime(baseF * 0.62 * jit(0.05), T);
    body.frequency.setTargetAtTime(baseF * 0.38, T + 0.01, decayT * 0.35);

    const envBody = ctx.createGain();
    envBody.gain.setValueAtTime(0, T);
    envBody.gain.linearRampToValueAtTime((0.08 + sizeN*0.04) * jit(0.09), T + 0.022);
    envBody.gain.setTargetAtTime(0.001, T + 0.025, decayT * 0.28);

    const lpBody = ctx.createBiquadFilter(); lpBody.type = 'lowpass';
    lpBody.frequency.value = 800; lpBody.Q.value = 0.6;

    wire(body, lpBody, envBody);
    body.start(T); body.stop(T + decayT + 0.05);

    if (massShift === -1) {
        const fizzDur = decayT * 0.4;
        const fizz    = makeNoise(ctx, fizzDur);
        const bpFizz  = ctx.createBiquadFilter(); bpFizz.type = 'bandpass';
        bpFizz.frequency.value = 600 + colorPitch*200;
        bpFizz.Q.value = 6;
        const lpFizz = ctx.createBiquadFilter(); lpFizz.type = 'lowpass';
        lpFizz.frequency.value = 900;
        const envFizz = ctx.createGain();
        envFizz.gain.setValueAtTime(0.08 * jit(0.15), T);
        envFizz.gain.setTargetAtTime(0.001, T, fizzDur * 0.3);
        wire(fizz, bpFizz, lpFizz, envFizz);
        fizz.start(T); fizz.stop(T + fizzDur + 0.01);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POKE  "poc" — a fingertip tap on anime slime
// ─────────────────────────────────────────────────────────────────────────────
function playPoke(ctx, p) {
    const { sizeN, massShift } = p;

    // Votre son "Jump 181"
    let pokeParams = [.9,,331,,,.16,,.9,7,,-300];

    // Ajustement dynamique de la fréquence selon le slime
    const mSemi = massShift === 1 ? -60 : massShift === -1 ? 60 : 0;
    pokeParams[2] = Math.max(100, 331 - (sizeN * 120) + mSemi);

    zzfx(...pokeParams);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SPRING RELEASE  "boing" — the viscous rubber band snap
// ─────────────────────────────────────────────────────────────────────────────
function playSpringRelease(ctx, tension, releaseSpeed, p) {
    const T = ctx.currentTime;
    const { rigN, dampN, sizeN, massShift, bounce, colorPitch } = p;

    const tN   = Math.min(1, tension / 160);
    const velN = Math.min(1, releaseSpeed / 3.5);
    if (tN < 0.04) return;

    const mSemi  = massShift === 1 ? -3 : massShift === -1 ? 5 : 0;
    const baseF  = st(240 + tN*120 - sizeN*50, mSemi + (colorPitch-0.5)*5) * jit(0.06);

    const springHz = (5 + rigN*12 + tN*6) * jit(0.10);
    const decayT   = (0.22 + (1-dampN)*0.30 + tN*0.18) * jit(0.08);
    const wobDepth = (0.10 + (1-rigN)*0.22 + tN*0.12) * jit(0.12);

    const carrier = ctx.createOscillator(); carrier.type = 'sine';
    const releasePitch = baseF * (1.6 + tN*0.5 + velN*0.4);
    carrier.frequency.setValueAtTime(releasePitch, T);
    carrier.frequency.setTargetAtTime(baseF * 0.75, T, decayT * 0.18);
    carrier.frequency.setTargetAtTime(baseF * 0.38, T + decayT*0.4, decayT * 0.30);

    const lfo  = ctx.createOscillator(); lfo.type = 'sine';
    lfo.frequency.setValueAtTime(springHz, T);
    lfo.frequency.setTargetAtTime(springHz * 0.15, T, decayT * 0.40);
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(baseF * wobDepth * (1 + velN*0.3), T);
    lfoG.gain.setTargetAtTime(1, T, decayT * 0.35);
    lfo.connect(lfoG); lfoG.connect(carrier.frequency);

    const envA = ctx.createGain();
    envA.gain.setValueAtTime(0, T);
    envA.gain.linearRampToValueAtTime(0.26 + tN*0.08, T + 0.008);
    envA.gain.setTargetAtTime(0.001, T + 0.010, decayT * 0.28);

    const lpA = ctx.createBiquadFilter(); lpA.type = 'lowpass';
    lpA.frequency.setValueAtTime(1200 + tN*300, T);
    lpA.frequency.setTargetAtTime(280, T, decayT * 0.30);
    lpA.Q.value = 1.5 + (1-rigN)*1.0;

    wire(carrier, lpA, envA);
    carrier.start(T); carrier.stop(T + decayT + 0.12);
    lfo.start(T);     lfo.stop(T + decayT + 0.12);

    const noiseB  = makeNoise(ctx, 0.040 + tN*0.030);
    const bpB     = ctx.createBiquadFilter(); bpB.type = 'bandpass';
    bpB.frequency.setValueAtTime(st(550 + tN*150, mSemi) * jit(0.11), T);
    bpB.frequency.setTargetAtTime(180, T, 0.030);
    bpB.Q.value = 3.5 + bounce*2.0;
    const lpBN    = ctx.createBiquadFilter(); lpBN.type = 'lowpass'; lpBN.frequency.value = 900;
    const envB    = ctx.createGain();
    envB.gain.setValueAtTime(bounce * (0.10 + tN*0.09) * jit(0.11), T);
    envB.gain.setTargetAtTime(0.001, T + 0.004, 0.028);
    wire(noiseB, bpB, lpBN, envB);
    noiseB.start(T); noiseB.stop(T + 0.075);

    if (tN > 0.15) {
        const thudDelay = decayT * 0.32;
        const thud = ctx.createOscillator(); thud.type = 'sine';
        const tf   = st(160 - sizeN*40, mSemi) * jit(0.07);
        thud.frequency.setValueAtTime(tf * 1.4, T + thudDelay);
        thud.frequency.setTargetAtTime(tf * 0.5, T + thudDelay, 0.08);

        const thudE = ctx.createGain();
        thudE.gain.setValueAtTime(0, T + thudDelay);
        thudE.gain.linearRampToValueAtTime((0.12 + tN*0.09 + sizeN*0.04) * jit(0.09), T + thudDelay + 0.010);
        thudE.gain.setTargetAtTime(0.001, T + thudDelay + 0.012, 0.060);

        const lpThud = ctx.createBiquadFilter(); lpThud.type = 'lowpass';
        lpThud.frequency.value = 500; lpThud.Q.value = 0.9;

        wire(thud, lpThud, thudE);
        thud.start(T + thudDelay); thud.stop(T + thudDelay + 0.16);

        const noiseThud = makeNoise(ctx, 0.06);
        const bpTN = ctx.createBiquadFilter(); bpTN.type = 'bandpass';
        bpTN.frequency.value = st(280 + tN*60, mSemi) * jit(0.10);
        bpTN.Q.value = 3.0 + bounce*1.5;
        const lpTN = ctx.createBiquadFilter(); lpTN.type = 'lowpass'; lpTN.frequency.value = 600;
        const envTN = ctx.createGain();
        envTN.gain.setValueAtTime(bounce*(0.12 + tN*0.10)*jit(0.12), T + thudDelay);
        envTN.gain.setTargetAtTime(0.001, T + thudDelay + 0.003, 0.040);
        wire(noiseThud, bpTN, lpTN, envTN);
        noiseThud.start(T + thudDelay); noiseThud.stop(T + thudDelay + 0.07);
    }

    const elasticity = (1-rigN) * bounce * tN;
    if (elasticity > 0.20) {
        const tailOsc = ctx.createOscillator(); tailOsc.type = 'sine';
        const tF      = baseF * 0.60 * jit(0.06);
        tailOsc.frequency.setValueAtTime(tF, T + decayT * 0.15);
        tailOsc.frequency.setTargetAtTime(tF * 0.38, T + decayT * 0.15, decayT * 0.35);

        const tailEnv = ctx.createGain();
        tailEnv.gain.setValueAtTime(0, T + decayT * 0.12);
        tailEnv.gain.linearRampToValueAtTime(0.12 * elasticity * jit(0.12), T + decayT * 0.20);
        tailEnv.gain.setTargetAtTime(0.001, T + decayT * 0.22, decayT * 0.32);

        const lpTail = ctx.createBiquadFilter(); lpTail.type = 'lowpass';
        lpTail.frequency.value = 550; lpTail.Q.value = 1.0;

        wire(tailOsc, lpTail, tailEnv);
        tailOsc.start(T + decayT * 0.12); tailOsc.stop(T + decayT * 0.85);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  JUMP  "bwup" — slime compressing and springing off the ground
//  ZzFX UPDATE: Utilise le son customisé + garde l'éclaboussure gélatineuse
// ─────────────────────────────────────────────────────────────────────────────
function playJump(ctx, jumpStrength, p) {
    const T = ctx.currentTime;
    const { sizeN, massShift, bounce } = p;
    const mSemi = massShift === 1 ? -3 : massShift === -1 ? 5 : 0;

    let jumpParams = [.5,,303,.01,.02,.07,5,,13,,,,,,,,,.88,.04,,-1460];
    
    jumpParams[2] = 360 - (sizeN * 120); 
    
    zzfx(...jumpParams);

    const noiseJ  = makeNoise(ctx, 0.025);
    const bpJ     = ctx.createBiquadFilter(); bpJ.type = 'bandpass';
    bpJ.frequency.value = st(360 + bounce*80, mSemi) * jit(0.10);
    bpJ.Q.value = 3.5 + bounce*1.5;
    const lpJN    = ctx.createBiquadFilter(); lpJN.type = 'lowpass'; lpJN.frequency.value = 700;
    
    const envJ    = ctx.createGain();
    envJ.gain.setValueAtTime(bounce * 0.09 * jit(0.10), T);
    envJ.gain.setTargetAtTime(0.001, T + 0.003, 0.015);
    
    wire(noiseJ, bpJ, lpJN, envJ);
    noiseJ.start(T); noiseJ.stop(T + 0.028);
}

// ─────────────────────────────────────────────────────────────────────────────
//  BUMP  "BOINK" — cartoon butt-push / sumo slam knockback
// ─────────────────────────────────────────────────────────────────────────────
function playBump(ctx, p) {
    const T = ctx.currentTime;
    const { sizeN, colorPitch, massShift, bounce } = p;

    const mSemi = massShift === 1 ? -4 : massShift === -1 ? 6 : 0;
    const baseF = st(180 - sizeN * 50, mSemi + (colorPitch - 0.5) * 6) * jit(0.05);

    const osc1 = ctx.createOscillator(); osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseF * 1.6, T);
    osc1.frequency.setTargetAtTime(baseF * 0.35, T, 0.018);
    osc1.frequency.setTargetAtTime(baseF * 0.55, T + 0.06, 0.055);

    const env1 = ctx.createGain();
    env1.gain.setValueAtTime(0, T);
    env1.gain.linearRampToValueAtTime(0.32 + sizeN * 0.10, T + 0.004);
    env1.gain.setTargetAtTime(0.001, T + 0.008, 0.065);

    const lp1 = ctx.createBiquadFilter(); lp1.type = 'lowpass';
    lp1.frequency.value = 800; lp1.Q.value = 1.2;
    wire(osc1, lp1, env1);
    osc1.start(T); osc1.stop(T + 0.38);

    const osc2 = ctx.createOscillator(); osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseF * 0.45, T + 0.025);
    osc2.frequency.setTargetAtTime(baseF * (2.2 + bounce * 0.9), T + 0.030, 0.025);
    osc2.frequency.setTargetAtTime(baseF * 0.80, T + 0.12, 0.09);

    const env2 = ctx.createGain();
    env2.gain.setValueAtTime(0, T + 0.022);
    env2.gain.linearRampToValueAtTime(0.18 + bounce * 0.08, T + 0.032);
    env2.gain.setTargetAtTime(0.001, T + 0.045, 0.08);

    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass';
    lp2.frequency.value = 1100; lp2.Q.value = 1.8;
    wire(osc2, lp2, env2);
    osc2.start(T + 0.022); osc2.stop(T + 0.45);

    const noise = makeNoise(ctx, 0.045);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = st(480, mSemi); bp.Q.value = 2.8;
    const envN = ctx.createGain();
    envN.gain.setValueAtTime(0.12 * jit(0.12), T);
    envN.gain.setTargetAtTime(0.001, T + 0.005, 0.018);
    wire(noise, bp, envN);
    noise.start(T); noise.stop(T + 0.05);
}

// ─────────────────────────────────────────────────────────────────────────────
//  GROUP CHIME — soft 2-note chime when slimes gather
// ─────────────────────────────────────────────────────────────────────────────
function playGroupChime(ctx, count) {
    const T = ctx.currentTime;
    const baseF = 540 + count * 40;
    const notes = count >= 3 ? [1, 1.5, 2.0] : [1, 1.5];

    for (let i = 0; i < notes.length; i++) {
        const delay = i * 0.12;
        const osc = ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.value = st(baseF * notes[i], 0) * jit(0.02);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0, T + delay);
        env.gain.linearRampToValueAtTime(0.055 - i * 0.01, T + delay + 0.015);
        env.gain.setTargetAtTime(0.001, T + delay + 0.02, 0.28);

        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.value = 1400; lp.Q.value = 0.5;
        wire(osc, lp, env);
        osc.start(T + delay); osc.stop(T + delay + 1.4);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOWER WOBBLE — low tension creak as the slime tower gets unstable
// ─────────────────────────────────────────────────────────────────────────────
function playTowerWobble(ctx, intensity) {
    const T = ctx.currentTime;
    const baseF = 90 + intensity * 60;

    const carrier = ctx.createOscillator(); carrier.type = 'sine';
    carrier.frequency.setValueAtTime(baseF, T);
    carrier.frequency.setTargetAtTime(baseF * (1 + intensity * 0.25), T, 0.08);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, T);
    env.gain.linearRampToValueAtTime(0.04 + intensity * 0.06, T + 0.05);
    env.gain.setTargetAtTime(0.001, T + 0.12, 0.12);

    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 350; lp.Q.value = 3.0;
    wire(carrier, lp, env);
    carrier.start(T); carrier.stop(T + 0.55);

    if (intensity > 0.5) {
        const noise = makeNoise(ctx, 0.10);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = 1200 + intensity * 600; bp.Q.value = 6.0;
        const envN = ctx.createGain();
        envN.gain.setValueAtTime((intensity - 0.5) * 0.06, T + 0.04);
        envN.gain.setTargetAtTime(0.001, T + 0.06, 0.08);
        wire(noise, bp, envN);
        noise.start(T + 0.04); noise.stop(T + 0.16);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOWER FALL — cartoon descending fall + wet splat at ground
// ─────────────────────────────────────────────────────────────────────────────
function playTowerFall(ctx) {
    const T = ctx.currentTime;

    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(700, T);
    osc.frequency.setTargetAtTime(80, T, 0.22);

    const envW = ctx.createGain();
    envW.gain.setValueAtTime(0, T);
    envW.gain.linearRampToValueAtTime(0.12, T + 0.015);
    envW.gain.setTargetAtTime(0.001, T + 0.28, 0.055);

    const lpW = ctx.createBiquadFilter(); lpW.type = 'lowpass';
    lpW.frequency.value = 900; lpW.Q.value = 0.8;
    wire(osc, lpW, envW);
    osc.start(T); osc.stop(T + 0.55);

    const splatT = T + 0.30;
    const splatOsc = ctx.createOscillator(); splatOsc.type = 'sine';
    splatOsc.frequency.setValueAtTime(160, splatT);
    splatOsc.frequency.setTargetAtTime(45, splatT, 0.015);

    const envS = ctx.createGain();
    envS.gain.setValueAtTime(0, splatT);
    envS.gain.linearRampToValueAtTime(0.28, splatT + 0.006);
    envS.gain.setTargetAtTime(0.001, splatT + 0.012, 0.075);

    const lpS = ctx.createBiquadFilter(); lpS.type = 'lowpass';
    lpS.frequency.value = 600; lpS.Q.value = 1.5;
    wire(splatOsc, lpS, envS);
    splatOsc.start(splatT); splatOsc.stop(splatT + 0.50);

    const noise = makeNoise(ctx, 0.06);
    const bpN = ctx.createBiquadFilter(); bpN.type = 'bandpass';
    bpN.frequency.value = 380; bpN.Q.value = 2.2;
    const envN = ctx.createGain();
    envN.gain.setValueAtTime(0.15, splatT);
    envN.gain.setTargetAtTime(0.001, splatT + 0.008, 0.04);
    wire(noise, bpN, envN);
    noise.start(splatT); noise.stop(splatT + 0.07);
}

// ─────────────────────────────────────────────────────────────────────────────
//  LAND  "splat/thud" — slime hitting the ground
// ─────────────────────────────────────────────────────────────────────────────
function playLand(_ctx, impactVelocity, p) {
    const velN = Math.min(1, impactVelocity / 10); 
    if (velN < 0.1) return; 
    if (velN > 0.6) {
    zzfx(0.3, 0, 600, 0.01, 0.02, 0.05, 0, 1);
    }
    const { sizeN, massShift } = p;

    let landParams = [.9,,331,,,.16,,.9,7,,-300];

    // 🔊 Volume
    landParams[0] = 0.05 + velN * 0.3;

    // 🎵 Pitch (déjà bon chez toi)
    const mSemi = massShift === 1 ? -60 : massShift === -1 ? 60 : 0;
    landParams[2] = Math.max(100, 331 - (sizeN * 120) + mSemi);

    // ⏱️ Étirement du son
    const stretch = velN * velN; // courbe plus naturelle

    landParams[4] = 0.02 + stretch * 0.1; // sustain
    landParams[5] = 0.08 + stretch * 0.1;  // decay

    // 🫠 Effet "écrasement"
    landParams[10] = -200 - (velN * 300); // slide plus fort si impact fort

    // 🎲 légère variation pour éviter répétition
    landParams[2] *= 1 + (Math.random() - 0.5) * 0.05;

    zzfx(...landParams);
}
