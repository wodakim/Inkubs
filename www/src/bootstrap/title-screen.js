/**
 * INKÜ — Title Screen v4.0
 * Reproduction FIDÈLE du mockup original — même HTML, même CSS, même classes Tailwind.
 * Seule différence : la carte "login" est remplacée par bouton PLAY + modal Paramètres.
 * Injecté dans <html> pour contourner overflow:hidden du body.
 */

export function createTitleScreen({ onPlay } = {}) {

    /* ── Settings ── */
    const SK = 'inku.settings.v1';
    const DEF = { master: 80, music: 60, sfx: 90, quality: 'high', fps: false, motion: false, notif: false, vibr: true, lang: 'fr' };
    const loadS = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(SK) || '{}') }; } catch { return { ...DEF }; } };
    const saveS = s => { try { localStorage.setItem(SK, JSON.stringify(s)); } catch {} };
    let S = loadS();

    /* ── Root ── */
    const root = document.createElement('div');
    root.id = 'ts-root';
    root.style.cssText = 'position:fixed;inset:0;z-index:99999;font-family:Nunito,sans-serif;overflow:hidden;touch-action:none;';

    root.innerHTML = getTplHTML();

    /* ── Template ── */
    function getTplHTML() { return `
<style>
#ts-root{color:white;}
#ts-body{margin:0;overflow:hidden;font-family:'Nunito',sans-serif;background-color:#0f172a;touch-action:none;height:100dvh;position:relative;}
.lab-bg-container{position:fixed;inset:0;background-color:#04060c;background-image:radial-gradient(circle at 50% 30%,#0a1128 0%,#04060c 70%);z-index:0;overflow:hidden;box-shadow:inset 0 0 150px rgba(0,0,0,1);}
.ambient-fog{position:absolute;border-radius:50%;filter:blur(60px);opacity:0.2;animation:fog-drift 15s infinite alternate ease-in-out;pointer-events:none;}
.fog-1{top:-10%;right:-10%;width:60vw;height:60vw;background:#10b981;}
.fog-2{bottom:20%;left:-20%;width:70vw;height:70vw;background:#3b82f6;animation-delay:-5s;}
@keyframes fog-drift{0%{transform:translate(0,0) scale(1)}100%{transform:translate(-30px,20px) scale(1.1)}}
.wall-plates{position:absolute;inset:0;background-image:linear-gradient(rgba(0,0,0,0.8) 2px,transparent 2px),linear-gradient(90deg,rgba(0,0,0,0.8) 2px,transparent 2px),linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);background-size:100px 100px,100px 100px,20px 20px,20px 20px;background-position:-2px -2px,-2px -2px,-1px -1px,-1px -1px;opacity:0.5;z-index:1;}
.industrial-pipe{position:absolute;background:linear-gradient(90deg,#010204 0%,#1e293b 25%,#475569 40%,#1e293b 60%,#04060c 100%);box-shadow:15px 0 30px rgba(0,0,0,0.9),inset -2px 0 5px rgba(255,255,255,0.05);z-index:2;opacity:0.6;}
.pipe-vertical{width:35px;height:100%;left:-5px;top:0;border-right:1px solid #000;}
.pipe-horizontal{width:100%;height:28px;top:-2px;border-bottom:1px solid #000;box-shadow:0 15px 30px rgba(0,0,0,0.9),inset 0 -2px 5px rgba(255,255,255,0.05);}
.server-rack{position:absolute;left:-25px;top:15%;width:80px;height:180px;background:linear-gradient(to bottom,#0f172a,#020617);border:2px solid #000;border-right:1px solid rgba(255,255,255,0.1);border-radius:4px;box-shadow:inset 5px 0 15px rgba(0,0,0,1),15px 15px 30px rgba(0,0,0,0.9);padding:10px 6px;display:flex;flex-direction:column;gap:10px;z-index:1;transform:perspective(400px) rotateY(25deg);opacity:0.45;}
.server-slot{height:14px;background:#000;border:1px solid #1e293b;border-bottom-color:rgba(255,255,255,0.1);display:flex;align-items:center;padding:0 5px;gap:5px;}
.server-led{width:3px;height:3px;border-radius:50%;background:#10b981;box-shadow:0 0 4px #10b981;}
.server-led.red-alert{background:#ef4444;box-shadow:0 0 6px #ef4444;animation:alert-blink 1s infinite alternate;}
.server-led.blue-led{background:#3b82f6;box-shadow:0 0 6px #3b82f6;animation:alert-blink 2s infinite alternate-reverse;}
.server-led.off{background:#1e293b;box-shadow:none;}
@keyframes alert-blink{0%,20%{opacity:1}80%,100%{opacity:0.3}}
.dust-motes{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;}
.mote{position:absolute;background:#fff;border-radius:50%;opacity:0;box-shadow:0 0 4px #fff;animation:mote-float linear infinite;}
@keyframes mote-float{0%{transform:translateY(110vh) translateX(0) scale(1);opacity:0}10%{opacity:0.3}90%{opacity:0.3}100%{transform:translateY(-10vh) translateX(30px) scale(1.5);opacity:0}}
.warning-tape{position:absolute;width:120%;height:20px;bottom:3%;left:-10%;background:repeating-linear-gradient(45deg,#b45309 0px,#b45309 20px,#1c1917 20px,#1c1917 40px);transform:rotate(-3deg);box-shadow:0 5px 15px rgba(0,0,0,0.9);opacity:0.15;z-index:1;border-top:1px solid #000;border-bottom:1px solid #000;}
.incubator-container{height:100%;max-height:380px;aspect-ratio:2/3;z-index:5;display:flex;flex-direction:column;align-items:center;position:relative;}
.metal-surface{background:linear-gradient(90deg,#0f172a 0%,#334155 15%,#475569 25%,#1e293b 50%,#0f172a 85%,#020617 100%);width:100%;flex-shrink:0;position:relative;}
.incubator-cap-top{height:35px;border-radius:12px 12px 0 0;border-top:2px solid rgba(255,255,255,0.3);border-bottom:2px solid #020617;display:flex;flex-direction:column;justify-content:flex-end;z-index:10;}
.metal-ridge{height:4px;width:100%;background:rgba(0,0,0,0.4);border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:6px;}
.neon-rim{height:4px;width:100%;background:#10b981;box-shadow:0 0 15px #10b981,inset 0 0 5px #fff;}
.incubator-glass{width:100%;flex-grow:1;background:linear-gradient(180deg,rgba(16,185,129,0) 40%,rgba(16,185,129,0.2) 100%),linear-gradient(90deg,rgba(255,255,255,0.1) 0%,transparent 10%,transparent 90%,rgba(0,0,0,0.6) 100%);border-left:2px solid rgba(255,255,255,0.3);border-right:2px solid rgba(0,0,0,0.8);box-shadow:inset 15px 0 20px -10px rgba(255,255,255,0.15),inset -20px 0 30px -10px rgba(0,0,0,0.8),inset 0 -40px 50px -15px rgba(16,185,129,0.4);position:relative;overflow:hidden;backdrop-filter:blur(2px);z-index:5;cursor:pointer;}
.glass-grid{position:absolute;inset:0;background-image:radial-gradient(rgba(16,185,129,0.25) 1px,transparent 1px);background-size:10px 10px;opacity:0.3;z-index:1;pointer-events:none;}
.holo-scanline{position:absolute;left:0;right:0;height:2px;background:rgba(16,185,129,0.9);box-shadow:0 0 10px rgba(16,185,129,0.9),0 0 25px rgba(16,185,129,0.5);z-index:4;opacity:0.6;animation:scan 5s linear infinite;}
@keyframes scan{0%{top:-10%;opacity:0}5%{opacity:0.8}95%{opacity:0.8}100%{top:110%;opacity:0}}
.glass-reflection{position:absolute;top:0;left:12%;width:15%;height:100%;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.15) 30%,rgba(255,255,255,0.5) 50%,rgba(255,255,255,0.15) 70%,transparent 100%);z-index:6;pointer-events:none;mix-blend-mode:overlay;}
.incubator-cap-bottom{height:50px;border-radius:0 0 12px 12px;border-top:2px solid #020617;border-bottom:2px solid rgba(0,0,0,0.8);display:flex;flex-direction:column;justify-content:flex-start;z-index:10;}
.cap-vents{display:flex;justify-content:space-evenly;width:70%;margin:6px auto 4px auto;}
.vent-slot{width:5px;height:14px;background:#020617;border-radius:1px;box-shadow:inset 0 2px 5px rgba(0,0,0,1),0 1px 0 rgba(255,255,255,0.15);}
.holo-hud{position:absolute;top:10px;right:10px;display:flex;flex-direction:column;align-items:flex-end;z-index:6;pointer-events:none;}
.holo-text{font-family:'JetBrains Mono','Fira Code',monospace;font-size:7px;color:#34d399;text-shadow:0 0 4px #10b981;margin-bottom:2px;opacity:0.85;font-weight:900;letter-spacing:0.5px;}
.holo-bar{width:30px;height:3px;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.4);margin-bottom:5px;position:relative;}
.holo-bar-fill{position:absolute;top:0;left:0;height:100%;width:98%;background:#10b981;box-shadow:0 0 6px #10b981;}
.cable-bundle{position:absolute;left:50%;transform:translateX(-50%);width:60px;z-index:1;display:flex;align-items:stretch;justify-content:space-evenly;padding:0 3px;background:linear-gradient(90deg,#020617 0%,#1e293b 30%,#0f172a 50%,#1e293b 70%,#020617 100%);box-shadow:inset 0 0 15px #000,0 0 20px rgba(0,0,0,0.8);border-left:2px solid #334155;border-right:2px solid #334155;}
.cable-bundle.top{top:-100px;bottom:50%}.cable-bundle.bottom{top:50%;bottom:-100px;}
.inner-wire{height:100%;position:relative;}.inner-wire::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0.8) 0%,rgba(255,255,255,0.15) 50%,rgba(0,0,0,0.8) 100%);}
.wire-1{width:5px;background-color:#022c22;}.wire-2{width:10px;background-color:#0f172a;}.wire-3{width:3px;background-color:#450a0a;}.wire-4{width:7px;background-color:#1e293b;}
.cable-binding{position:absolute;left:-2px;right:-2px;height:12px;background:linear-gradient(90deg,#1e293b,#64748b,#1e293b);box-shadow:0 4px 6px rgba(0,0,0,0.6),inset 0 2px 2px rgba(255,255,255,0.3);border-top:1px solid #020617;border-bottom:1px solid #020617;border-radius:2px;z-index:2;}
.led{width:5px;height:5px;border-radius:50%;background-color:#10b981;box-shadow:0 0 8px #10b981;margin:0 3px;}
canvas{display:block;position:absolute;bottom:0;left:0;width:100%;height:100%;z-index:2;}
.title-glow{text-shadow:0 0 20px rgba(16,185,129,0.8),0 0 40px rgba(16,185,129,0.4);}
.safe-area-pb{padding-bottom:max(2.5rem,calc(env(safe-area-inset-bottom) + 1.2rem));}

/* PLAY CARD */
.login-card-aaa{background:linear-gradient(180deg,rgba(11,17,32,0.7) 0%,rgba(2,6,23,0.85) 100%);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(16,185,129,0.15);box-shadow:0 15px 35px -10px rgba(0,0,0,0.9),inset 0 1px 1px rgba(255,255,255,0.05),inset 0 0 20px rgba(16,185,129,0.05);border-radius:20px;height:auto;padding:1.5rem 1.25rem;width:100%;max-width:320px;margin:0 auto;}
.login-card-aaa::before{content:'';position:absolute;top:0;left:20%;right:20%;height:1px;background:linear-gradient(90deg,transparent,rgba(52,211,153,0.6),transparent);opacity:0.8;}
.btn-aaa{background:linear-gradient(90deg,#047857 0%,#10b981 50%,#047857 100%);background-size:200% auto;border:1px solid rgba(52,211,153,0.4);box-shadow:0 6px 15px -4px rgba(16,185,129,0.4),inset 0 1px 0 rgba(255,255,255,0.2),inset 0 -2px 0 rgba(0,0,0,0.2);text-shadow:0 1px 2px rgba(0,0,0,0.3);transition:all 0.2s cubic-bezier(0.4,0,0.2,1);animation:shine-bg 3s linear infinite;padding:0.75rem;border-radius:12px;cursor:pointer;color:white;font-weight:900;font-family:'Nunito',sans-serif;font-size:0.95rem;letter-spacing:0.08em;width:100%;display:flex;align-items:center;justify-content:center;gap:0.5rem;}
.btn-aaa:active{box-shadow:0 0 8px rgba(16,185,129,0.4),inset 0 2px 4px rgba(0,0,0,0.4);transform:translateY(2px);}
@keyframes shine-bg{to{background-position:200% center}}

/* Loading overlay */
#ts-loading-overlay{position:absolute;inset:0;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:20px;opacity:0;transition:opacity 0.3s;pointer-events:none;}
#ts-loading-overlay.show{opacity:1;pointer-events:auto;}

/* Screen transitions */
#ts-screen{opacity:0;transition:opacity 0.45s ease;}
#ts-screen.ts-in{opacity:1;}
#ts-screen.ts-out{opacity:0;transform:scale(0.97);transition:opacity 0.5s ease,transform 0.5s ease;pointer-events:none;}

@media(max-height:750px){.safe-area-pb{padding-bottom:max(1.5rem,calc(env(safe-area-inset-bottom) + 0.8rem))}.login-card-aaa{padding:1rem}.title-glow{font-size:2.7rem;line-height:1}.btn-aaa{padding-top:0.6rem;padding-bottom:0.6rem}}
@media(max-height:650px){.safe-area-pb{padding-bottom:max(1rem,env(safe-area-inset-bottom))}.login-card-aaa{padding:0.75rem 1rem;border-radius:16px;max-width:290px}.title-glow{font-size:2.2rem}.incubator-container{max-height:280px}}

/* ═══ MODAL PARAMÈTRES — STYLE POKÉMON ═══ */
#ts-settings-modal{position:fixed;inset:0;z-index:100000;background:#070c18;opacity:0;pointer-events:none;transition:opacity 0.28s ease,transform 0.28s ease;display:flex;flex-direction:column;font-family:'Nunito',sans-serif;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);transform:translateY(8px);}
#ts-settings-modal.open{opacity:1;pointer-events:auto;transform:translateY(0);}
/* Header */
.pks-header{display:flex;align-items:center;gap:0.875rem;padding:1rem 1.25rem;background:rgba(16,185,129,0.04);border-bottom:2px solid rgba(16,185,129,0.18);flex-shrink:0;}
.pks-back{width:2.5rem;height:2.5rem;border-radius:10px;background:rgba(16,185,129,0.1);border:1.5px solid rgba(16,185,129,0.25);color:#34d399;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.9rem;transition:all 0.15s;flex-shrink:0;appearance:none;}
.pks-back:active{transform:scale(0.9);background:rgba(16,185,129,0.2);}
.pks-header-text{flex:1;}
.pks-title{font-size:1.1rem;font-weight:900;color:white;letter-spacing:0.04em;}
.pks-version{font-size:0.58rem;font-family:'JetBrains Mono','Fira Code',monospace;color:rgba(52,211,153,0.4);letter-spacing:0.18em;text-transform:uppercase;margin-top:1px;}
/* Scrollable body */
.pks-body{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding-bottom:1.5rem;scrollbar-width:none;}
.pks-body::-webkit-scrollbar{display:none;}
/* Section */
.pks-section{padding:0 0.875rem;margin-top:1.25rem;}
.pks-section-label{display:flex;align-items:center;gap:0.5rem;font-size:0.62rem;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.38);font-family:'JetBrains Mono','Fira Code',monospace;margin-bottom:0.5rem;padding-left:0.1rem;}
.pks-section-bar{width:3px;height:12px;border-radius:2px;background:#10b981;box-shadow:0 0 8px rgba(16,185,129,0.5);flex-shrink:0;}
.pks-bar-blue{background:#3b82f6;box-shadow:0 0 8px rgba(59,130,246,0.5);}
.pks-bar-purple{background:#a855f7;box-shadow:0 0 8px rgba(168,85,247,0.5);}
.pks-bar-red{background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,0.5);}
/* Card grouping */
.pks-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;}
.pks-divider{height:1px;background:rgba(255,255,255,0.05);margin:0 1rem;}
/* Row base */
.pks-row{display:flex;align-items:center;gap:0.75rem;padding:0 0.875rem;min-height:58px;}
/* Slider row layout (label+value on top, slider full-width below) */
.pks-row--slider{flex-direction:row;align-items:center;padding-top:0.65rem;padding-bottom:0.75rem;min-height:auto;}
.pks-row--slider .pks-row-body{display:flex;flex-direction:column;gap:0.38rem;}
.pks-row-top{display:flex;align-items:center;justify-content:space-between;}
/* Icon */
.pks-row-icon{width:2.2rem;height:2.2rem;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:0.95rem;flex-shrink:0;}
.pks-icon-green{background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.22);color:#10b981;}
.pks-icon-blue{background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.22);color:#60a5fa;}
.pks-icon-purple{background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.22);color:#c084fc;}
.pks-icon-amber{background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.22);color:#fbbf24;}
.pks-icon-red{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#f87171;}
/* Row text */
.pks-row-body{flex:1;min-width:0;}
.pks-row-name{font-size:0.88rem;font-weight:700;color:rgba(255,255,255,0.9);line-height:1.2;}
.pks-row-sub{font-size:0.62rem;color:rgba(255,255,255,0.35);margin-top:1px;}
.pks-row-ctrl{display:flex;align-items:center;gap:0.4rem;flex-shrink:0;}
/* Toggle switch */
.pks-toggle{position:relative;display:inline-block;width:50px;height:28px;cursor:pointer;flex-shrink:0;}
.pks-toggle input{opacity:0;width:0;height:0;position:absolute;}
.pks-toggle-track{position:absolute;inset:0;border-radius:14px;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.1);transition:background 0.25s,border-color 0.25s;}
.pks-toggle input:checked~.pks-toggle-track{background:rgba(16,185,129,0.25);border-color:rgba(16,185,129,0.5);}
.pks-toggle-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.3);box-shadow:0 1px 4px rgba(0,0,0,0.5);transition:transform 0.22s cubic-bezier(0.22,1.18,0.28,1),background 0.22s;}
.pks-toggle input:checked~.pks-toggle-track .pks-toggle-knob{transform:translateX(22px);background:#34d399;box-shadow:0 0 10px rgba(52,211,153,0.5);}
/* Slider (full width inside row-body) */
.pks-slider{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:2px;background:rgba(255,255,255,0.1);outline:none;cursor:pointer;}
.pks-slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#34d399;box-shadow:0 0 10px rgba(52,211,153,0.6);cursor:pointer;}
.pks-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#34d399;border:none;box-shadow:0 0 10px rgba(52,211,153,0.6);}
.pks-slider-val{font-family:'JetBrains Mono','Fira Code',monospace;font-size:0.72rem;font-weight:700;color:#34d399;min-width:2rem;text-align:right;flex-shrink:0;}
/* Segmented control */
.pks-seg{display:flex;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:3px;gap:2px;}
.pks-seg-btn{appearance:none;padding:0.3rem 0.55rem;border-radius:7px;border:none;font-family:'Nunito',sans-serif;font-size:0.68rem;font-weight:800;color:rgba(255,255,255,0.35);cursor:pointer;background:transparent;transition:all 0.18s;}
.pks-seg-btn.on{background:rgba(16,185,129,0.2);color:#34d399;}
/* Info box */
.pks-info-box{display:flex;align-items:flex-start;gap:0.75rem;background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.12);border-radius:14px;padding:0.9rem 1rem;margin-bottom:0.5rem;font-size:0.72rem;color:rgba(255,255,255,0.4);line-height:1.65;}
/* Danger row */
.pks-danger-row{display:flex;align-items:center;gap:0.75rem;padding:0 1rem;min-height:62px;background:rgba(239,68,68,0.04);border:1px solid rgba(239,68,68,0.15);border-radius:16px;cursor:pointer;width:100%;text-align:left;transition:background 0.18s,border-color 0.18s;appearance:none;}
.pks-danger-row:active{background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.3);transform:scale(0.99);}
.pks-danger-name{font-size:0.88rem;font-weight:800;color:#f87171;}
.pks-danger-sub{font-size:0.62rem;color:rgba(239,68,68,0.45);margin-top:2px;}
/* Confirm reset overlay */
#ts-confirm-reset{position:absolute;inset:0;z-index:10;background:rgba(4,6,12,0.96);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1.5rem;opacity:0;pointer-events:none;transition:opacity 0.2s ease;}
#ts-confirm-reset.show{opacity:1;pointer-events:auto;}
.pks-confirm-icon{width:3.5rem;height:3.5rem;border-radius:50%;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.22);display:flex;align-items:center;justify-content:center;margin-bottom:1.25rem;color:#f87171;font-size:1.5rem;}
.pks-confirm-title{font-size:1.1rem;font-weight:900;color:white;text-align:center;margin-bottom:0.5rem;}
.pks-confirm-body{font-size:0.75rem;color:rgba(255,255,255,0.45);text-align:center;line-height:1.65;margin-bottom:2rem;max-width:270px;}
.pks-confirm-body strong{color:#f87171;font-weight:800;}
.pks-confirm-yes{width:100%;max-width:280px;padding:0.9rem;border-radius:14px;background:rgba(220,38,38,0.75);border:1.5px solid rgba(239,68,68,0.5);color:white;font-weight:900;font-family:'Nunito',sans-serif;font-size:0.85rem;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.5rem;cursor:pointer;transition:all 0.15s;appearance:none;}
.pks-confirm-yes:active{transform:scale(0.97);}
.pks-confirm-no{width:100%;max-width:280px;padding:0.8rem;border-radius:14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);font-weight:900;font-family:'Nunito',sans-serif;font-size:0.85rem;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;transition:all 0.15s;appearance:none;}
.pks-confirm-no:active{transform:scale(0.97);}
</style>

<div id="ts-body">
<div class="lab-bg-container">
    <div class="ambient-fog fog-1"></div><div class="ambient-fog fog-2"></div>
    <div class="wall-plates"></div>
    <div class="industrial-pipe pipe-vertical"></div>
    <div class="industrial-pipe pipe-horizontal"></div>
    <div class="server-rack">
        <div class="server-slot"><div class="server-led red-alert"></div><div class="server-led off"></div></div>
        <div class="server-slot"><div class="server-led off"></div><div class="server-led blue-led"></div></div>
        <div class="server-slot" style="margin-top:25px"><div class="server-led blue-led"></div><div class="server-led"></div><div class="server-led off"></div></div>
        <div class="server-slot"><div class="server-led off"></div><div class="server-led"></div><div class="server-led off"></div></div>
        <div class="server-slot"><div class="server-led red-alert"></div><div class="server-led off"></div></div>
    </div>
    <div class="dust-motes">
        <div class="mote" style="left:10%;width:2px;height:2px;animation-duration:25s;animation-delay:0s"></div>
        <div class="mote" style="left:85%;width:3px;height:3px;animation-duration:18s;animation-delay:-5s"></div>
        <div class="mote" style="left:60%;width:1.5px;height:1.5px;animation-duration:30s;animation-delay:-12s"></div>
        <div class="mote" style="left:25%;width:2.5px;height:2.5px;animation-duration:22s;animation-delay:-8s"></div>
        <div class="mote" style="left:70%;width:2px;height:2px;animation-duration:28s;animation-delay:-15s"></div>
    </div>
    <div class="warning-tape"></div>
</div>

<div id="ts-screen" class="relative z-20 flex flex-col h-full w-full max-w-md mx-auto">
    <!-- Topbar -->
    <div class="p-2 sm:p-4 flex justify-between items-center flex-shrink-0">
        <div></div>
        <button id="ts-open-settings" class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-gray-300 hover:text-white transition active:scale-95" style="background:rgba(15,23,42,0.75);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);">
            <i class="ph ph-gear" style="font-size:1rem;"></i>
        </button>
    </div>
    <!-- Title -->
    <div class="flex flex-col items-center flex-shrink-0 mt-0 sm:mt-1 relative z-20">
        <h1 class="text-4xl sm:text-5xl font-black text-white title-glow tracking-tight" style="font-family:'Nunito',sans-serif;">Inkü</h1>
        <p class="text-emerald-400 text-[9px] sm:text-xs tracking-widest mt-1 font-bold uppercase opacity-80">Incubateur Virtuel</p>
    </div>
    <!-- Mid -->
    <div class="flex-1 w-full flex items-center justify-center px-4 py-2 min-h-0 relative z-10">
        <div class="cable-bundle top">
            <div class="inner-wire wire-1"></div><div class="inner-wire wire-2"></div><div class="inner-wire wire-3"></div><div class="inner-wire wire-4"></div><div class="inner-wire wire-1"></div>
            <div class="cable-binding" style="bottom:15%"></div><div class="cable-binding" style="bottom:50%"></div><div class="cable-binding" style="bottom:85%"></div>
        </div>
        <div class="cable-bundle bottom">
            <div class="inner-wire wire-1"></div><div class="inner-wire wire-2"></div><div class="inner-wire wire-3"></div><div class="inner-wire wire-4"></div><div class="inner-wire wire-1"></div>
            <div class="cable-binding" style="top:15%"></div><div class="cable-binding" style="top:50%"></div><div class="cable-binding" style="top:85%"></div>
        </div>
        <div class="incubator-container">
            <div class="incubator-cap-top metal-surface">
                <div class="metal-ridge"></div><div class="metal-ridge" style="width:70%;margin:0 auto 6px auto"></div><div class="neon-rim"></div>
            </div>
            <div class="incubator-glass" id="ts-glass">
                <div class="glass-grid"></div><div class="holo-scanline"></div><div class="glass-reflection"></div>
                <div class="holo-hud">
                    <div class="holo-text">O2_LEVEL</div><div class="holo-bar"><div class="holo-bar-fill"></div></div>
                    <div class="holo-text">TMP: 24.5°C</div><div class="holo-text">SYS: ON</div>
                </div>
                <canvas id="ts-canvas"></canvas>
            </div>
            <div class="incubator-cap-bottom metal-surface">
                <div class="neon-rim" style="height:2px;opacity:0.6;box-shadow:0 0 10px #10b981"></div>
                <div class="cap-vents"><div class="vent-slot"></div><div class="vent-slot"></div><div class="vent-slot"></div><div class="vent-slot"></div><div class="vent-slot"></div><div class="vent-slot"></div></div>
                <div class="flex justify-center items-center gap-2 mt-0.5">
                    <div class="flex gap-1 items-center">
                        <div class="led"></div>
                        <div class="led" style="background-color:#34d399"></div>
                        <div class="led" style="background-color:#ef4444;box-shadow:0 0 6px #ef4444;width:3px;height:3px"></div>
                    </div>
                    <div class="text-[6px] text-emerald-400 font-mono tracking-widest bg-black/60 px-1 py-0.5 rounded border border-emerald-900/50 shadow-[inset_0_0_5px_rgba(0,0,0,1)]">UNIT-01</div>
                </div>
            </div>
        </div>
    </div>
    <!-- Bottom PLAY -->
    <div class="px-4 w-full flex-shrink-0 relative z-30 flex justify-center safe-area-pb">
        <div class="login-card-aaa relative overflow-hidden flex flex-col justify-center gap-3">
            <div class="absolute top-3 left-4 flex gap-1 opacity-50 pointer-events-none">
                <div class="w-1 h-1 bg-emerald-500 rounded-full"></div><div class="w-1 h-1 rounded-full" style="background:rgba(16,185,129,0.4)"></div>
            </div>
            <div class="absolute top-3 right-4 opacity-50 pointer-events-none">
                <div class="w-4 h-0.5 rounded-full" style="background:rgba(16,185,129,0.3)"></div>
            </div>
            <!-- Loading overlay -->
            <div id="ts-loading-overlay">
                <div class="relative w-12 h-12 mb-3">
                    <div class="absolute inset-0 rounded-full" style="border:3px solid rgba(16,185,129,0.2)"></div>
                    <div class="absolute inset-0 rounded-full animate-spin" style="border:3px solid transparent;border-top-color:#34d399;border-left-color:#34d399"></div>
                    <i class="ph ph-fingerprint absolute inset-0 flex items-center justify-center text-lg animate-pulse" style="color:rgba(16,185,129,0.5)"></i>
                </div>
                <p id="ts-loading-text" class="font-bold tracking-wide text-center px-4 text-xs" style="color:#34d399">Synchronisation ADN...</p>
            </div>
            <!-- Titre carte -->
            <div class="text-center mb-1">
                <h2 class="text-base font-black text-white tracking-wide">Prêt à jouer</h2>
                <p class="font-mono mt-0.5 uppercase tracking-widest" style="font-size:9px;color:rgba(52,211,153,0.7)">Mode hors-ligne actif</p>
            </div>
            <!-- PLAY -->
            <button id="ts-btn-play" class="btn-aaa"><i class="ph ph-play text-xs"></i>RÉVEILLER LE SLIME</button>
            <!-- Version -->
            <p class="text-center font-mono" style="font-size:8px;color:rgba(16,185,129,0.3);letter-spacing:0.15em">INKÜ · v0.1.0</p>
        </div>
    </div>
</div>
</div>

<!-- ═══ MODAL PARAMÈTRES — STYLE POKÉMON ═══ -->
<div id="ts-settings-modal">
    <div class="pks-header">
        <button class="pks-back" id="ts-close-settings"><i class="ph ph-arrow-left" style="font-size:0.9rem;"></i></button>
        <div class="pks-header-text">
            <div class="pks-title">Paramètres</div>
            <div class="pks-version">INKÜ · v0.1.0</div>
        </div>
    </div>

    <div class="pks-body">

        <!-- SON -->
        <div class="pks-section">
            <div class="pks-section-label"><div class="pks-section-bar"></div>Son</div>
            <div class="pks-card">
                <div class="pks-row pks-row--slider">
                    <div class="pks-row-icon pks-icon-green"><i class="ph ph-speaker-high"></i></div>
                    <div class="pks-row-body">
                        <div class="pks-row-top"><span class="pks-row-name">Volume général</span><span class="pks-slider-val" id="sm-master-v">80</span></div>
                        <input type="range" class="pks-slider" id="sm-master" min="0" max="100">
                    </div>
                </div>
                <div class="pks-divider"></div>
                <div class="pks-row pks-row--slider">
                    <div class="pks-row-icon pks-icon-blue"><i class="ph ph-music-note"></i></div>
                    <div class="pks-row-body">
                        <div class="pks-row-top"><span class="pks-row-name">Musique</span><span class="pks-slider-val" id="sm-music-v">60</span></div>
                        <input type="range" class="pks-slider" id="sm-music" min="0" max="100">
                    </div>
                </div>
                <div class="pks-divider"></div>
                <div class="pks-row pks-row--slider">
                    <div class="pks-row-icon pks-icon-purple"><i class="ph ph-bell"></i></div>
                    <div class="pks-row-body">
                        <div class="pks-row-top"><span class="pks-row-name">Effets sonores</span><span class="pks-slider-val" id="sm-sfx-v">90</span></div>
                        <input type="range" class="pks-slider" id="sm-sfx" min="0" max="100">
                    </div>
                </div>
            </div>
        </div>

        <!-- AFFICHAGE -->
        <div class="pks-section">
            <div class="pks-section-label"><div class="pks-section-bar pks-bar-blue"></div>Affichage</div>
            <div class="pks-card">
                <div class="pks-row">
                    <div class="pks-row-icon pks-icon-amber"><i class="ph ph-monitor"></i></div>
                    <div class="pks-row-body"><div class="pks-row-name">Qualité graphique</div><div class="pks-row-sub">Impact sur la batterie</div></div>
                    <div class="pks-row-ctrl"><div class="pks-seg" id="sm-quality"><button class="pks-seg-btn" data-v="low">Bas</button><button class="pks-seg-btn" data-v="medium">Moy</button><button class="pks-seg-btn" data-v="high">Haut</button></div></div>
                </div>
                <div class="pks-divider"></div>
                <div class="pks-row">
                    <div class="pks-row-icon pks-icon-green"><i class="ph ph-gauge"></i></div>
                    <div class="pks-row-body"><div class="pks-row-name">Compteur FPS</div><div class="pks-row-sub">Affiche les images par seconde</div></div>
                    <div class="pks-row-ctrl"><label class="pks-toggle"><input type="checkbox" id="sm-fps"><span class="pks-toggle-track"><span class="pks-toggle-knob"></span></span></label></div>
                </div>
                <div class="pks-divider"></div>
                <div class="pks-row">
                    <div class="pks-row-icon pks-icon-blue"><i class="ph ph-leaf"></i></div>
                    <div class="pks-row-body"><div class="pks-row-name">Réduire les animations</div><div class="pks-row-sub">Accessibilité &amp; économie batterie</div></div>
                    <div class="pks-row-ctrl"><label class="pks-toggle"><input type="checkbox" id="sm-motion"><span class="pks-toggle-track"><span class="pks-toggle-knob"></span></span></label></div>
                </div>
            </div>
        </div>

        <!-- GAMEPLAY -->
        <div class="pks-section">
            <div class="pks-section-label"><div class="pks-section-bar pks-bar-purple"></div>Gameplay</div>
            <div class="pks-card">
                <div class="pks-row">
                    <div class="pks-row-icon pks-icon-purple"><i class="ph ph-device-mobile"></i></div>
                    <div class="pks-row-body"><div class="pks-row-name">Vibrations</div><div class="pks-row-sub">Retour tactile lors des actions</div></div>
                    <div class="pks-row-ctrl"><label class="pks-toggle"><input type="checkbox" id="sm-vibr"><span class="pks-toggle-track"><span class="pks-toggle-knob"></span></span></label></div>
                </div>
                <div class="pks-divider"></div>
                <div class="pks-row">
                    <div class="pks-row-icon pks-icon-amber"><i class="ph ph-bell"></i></div>
                    <div class="pks-row-body"><div class="pks-row-name">Notifications</div><div class="pks-row-sub">Alertes de progression du slime</div></div>
                    <div class="pks-row-ctrl"><label class="pks-toggle"><input type="checkbox" id="sm-notif"><span class="pks-toggle-track"><span class="pks-toggle-knob"></span></span></label></div>
                </div>
                <div class="pks-divider"></div>
                <div class="pks-row">
                    <div class="pks-row-icon pks-icon-green"><i class="ph ph-globe"></i></div>
                    <div class="pks-row-body"><div class="pks-row-name">Langue</div><div class="pks-row-sub">Localisation de l'interface</div></div>
                    <div class="pks-row-ctrl"><div class="pks-seg" id="sm-lang"><button class="pks-seg-btn" data-v="fr">🇫🇷 FR</button><button class="pks-seg-btn" data-v="en">🇬🇧 EN</button></div></div>
                </div>
            </div>
        </div>

        <!-- DONNÉES -->
        <div class="pks-section">
            <div class="pks-section-label"><div class="pks-section-bar pks-bar-red"></div>Données</div>
            <div class="pks-info-box">
                <i class="ph ph-info" style="color:#34d399;font-size:1rem;flex-shrink:0;margin-top:1px;"></i>
                <div>Version <span style="color:#34d399;font-weight:800;">v0.1.0</span> · Mode <span style="color:#34d399;font-weight:800;">OFFLINE</span><br>Données stockées localement sur l'appareil.</div>
            </div>
            <button class="pks-danger-row" id="sm-reset">
                <div class="pks-row-icon pks-icon-red"><i class="ph ph-trash"></i></div>
                <div class="pks-row-body"><div class="pks-danger-name">Effacer toutes les données</div><div class="pks-danger-sub">Slimes, progression, collection — irréversible</div></div>
                <i class="ph ph-caret-right" style="color:rgba(239,68,68,0.4);font-size:0.8rem;flex-shrink:0;"></i>
            </button>
        </div>

    </div>

    <!-- Confirmation effacement (overlay sur toute la modale settings) -->
    <div id="ts-confirm-reset">
        <div class="pks-confirm-icon"><i class="ph ph-warning"></i></div>
        <div class="pks-confirm-title">Remise à zéro</div>
        <p class="pks-confirm-body">Toutes les données seront <strong>définitivement supprimées</strong> — slimes, progression, collection. Cette action est irréversible.</p>
        <button id="ts-confirm-yes" class="pks-confirm-yes">Tout effacer</button>
        <button id="ts-confirm-no" class="pks-confirm-no">Annuler</button>
    </div>
</div>
`; }

    /* ── Slime engine (copie exacte du mockup) ── */
    function _initSlime(glassEl, canvasEl) {
        const ctx = canvasEl.getContext('2d');
        let width, height, time = 0, targetX = 0, targetY = 0, mouseX = 0, mouseY = 0;
        let blinkTimer = 0, isBlinking = false, surprisedTimer = 0;
        let slime = { x:0,y:0,baseY:0,vy:0,gravity:0.6,jumpForce:-10,squishX:1,squishY:1,idleTimer:100 };
        const bubbles = [], taps = [];
        let locked = false, raf = null;

        function initLayout() {
            if (locked) return;
            width = glassEl.clientWidth; height = glassEl.clientHeight;
            if (!width || !height) { setTimeout(initLayout, 50); return; }
            const inc = glassEl.closest('.incubator-container');
            if (inc) { inc.style.width = inc.offsetWidth+'px'; inc.style.height = inc.offsetHeight+'px'; inc.style.flexShrink='0'; }
            canvasEl.width = width; canvasEl.height = height;
            slime.x = width/2; slime.baseY = height-15;
            if (!slime.y || slime.y > slime.baseY) slime.y = slime.baseY;
            targetX = width/2; targetY = height; mouseX = targetX; mouseY = targetY;
            bubbles.length = 0;
            for (let i=0;i<15;i++) bubbles.push({x:Math.random()*width,y:Math.random()*height,size:Math.random()*4+1,speed:Math.random()*2+0.5,wobbleSpeed:Math.random()*0.05+0.01,wobbleOffset:Math.random()*Math.PI*2});
            locked = true;
        }
        initLayout();

        const hit = e => {
            if(e.cancelable) e.preventDefault();
            let cx=e.touches?e.touches[0].clientX:e.clientX, cy=e.touches?e.touches[0].clientY:e.clientY;
            const r=canvasEl.getBoundingClientRect(); targetX=cx-r.left; targetY=cy-r.top;
            taps.push({x:targetX,y:targetY,radius:0,alpha:1}); surprisedTimer=40; isBlinking=false;
            if(slime.y>=slime.baseY-5){slime.vy=slime.jumpForce*0.7;slime.squishX=0.8;slime.squishY=1.3;}
        };
        glassEl.addEventListener('mousedown',hit);
        glassEl.addEventListener('touchstart',hit,{passive:false});
        glassEl.addEventListener('mousemove',e=>{const r=canvasEl.getBoundingClientRect();targetX=e.clientX-r.left;targetY=e.clientY-r.top;});

        function drawEye(x,y,radius,pupilRadius,offsetX,offsetY){
            ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle='white';ctx.fill();
            const pX=Math.max(-radius+pupilRadius,Math.min(offsetX,radius-pupilRadius));
            const pY=Math.max(-radius+pupilRadius,Math.min(offsetY,radius-pupilRadius));
            ctx.beginPath();
            if(surprisedTimer>0)ctx.arc(x+pX,y+pY,pupilRadius,0,Math.PI*2);
            else ctx.ellipse(x+pX,y+pY,pupilRadius,pupilRadius*1.1,0,0,Math.PI*2);
            ctx.fillStyle='#0f172a';ctx.fill();
            if(surprisedTimer===0){ctx.beginPath();ctx.arc(x+pX-2,y+pY-2,radius*0.25,0,Math.PI*2);ctx.fillStyle='white';ctx.fill();}
        }

        function draw(){
            if(!width||!height){raf=requestAnimationFrame(draw);return;}
            ctx.clearRect(0,0,width,height);time+=0.05;mouseX+=(targetX-mouseX)*0.1;mouseY+=(targetY-mouseY)*0.1;
            ctx.fillStyle='rgba(16,185,129,0.3)';
            bubbles.forEach(b=>{b.y-=b.speed;if(b.y<-10){b.y=height+10;b.x=Math.random()*width;}const w=Math.sin(time*b.wobbleSpeed+b.wobbleOffset)*2;ctx.beginPath();ctx.arc(b.x+w,b.y,b.size,0,Math.PI*2);ctx.fill();});
            for(let i=taps.length-1;i>=0;i--){const t=taps[i];t.radius+=2;t.alpha-=0.05;ctx.beginPath();ctx.arc(t.x,t.y,t.radius,0,Math.PI*2);ctx.strokeStyle=`rgba(255,255,255,${t.alpha*0.5})`;ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(t.x,t.y,t.radius*0.6,0,Math.PI*2);ctx.strokeStyle=`rgba(16,185,129,${t.alpha*0.3})`;ctx.lineWidth=4;ctx.stroke();if(t.alpha<=0)taps.splice(i,1);}
            slime.vy+=slime.gravity;slime.y+=slime.vy;
            if(slime.y>slime.baseY){slime.y=slime.baseY;if(slime.vy>2){slime.squishX=1+(slime.vy*0.04);slime.squishY=1-(slime.vy*0.04);}slime.vy=0;slime.idleTimer--;if(slime.idleTimer<=0){slime.vy=slime.jumpForce*(0.6+Math.random()*0.4);slime.squishX=0.8;slime.squishY=1.2;slime.idleTimer=150+Math.random()*200;}}
            slime.squishX+=(1-slime.squishX)*0.1;slime.squishY+=(1-slime.squishY)*0.1;
            const R=Math.max(20,width*0.25),bx=slime.squishX-Math.sin(time*0.5)*0.02,by=slime.squishY+Math.sin(time*0.5)*0.02;
            ctx.save();ctx.translate(slime.x,slime.y);ctx.translate(0,-R);ctx.scale(bx,by);
            ctx.beginPath();
            for(let i=0;i<=30;i++){const a=(i/30)*Math.PI*2,r=R+Math.sin(a*4+time*1.5)*1.5;let px=Math.cos(a)*r,py=Math.sin(a)*r;if(py>R*0.7)py=R*0.7+Math.sin(px*0.1+time)*1;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
            ctx.closePath();
            const g=ctx.createRadialGradient(0,-R*0.35,0,0,0,R);g.addColorStop(0,'#34d399');g.addColorStop(0.7,'#10b981');g.addColorStop(1,'#047857');ctx.fillStyle=g;ctx.fill();
            ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=3;ctx.stroke();
            ctx.beginPath();ctx.arc(-R*0.35,-R*0.45,R*0.15,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.6)';ctx.fill();
            if(surprisedTimer>0)surprisedTimer--;else{blinkTimer--;if(blinkTimer<0){isBlinking=true;blinkTimer=Math.random()*200+100;}if(isBlinking&&blinkTimer<blinkTimer-6)isBlinking=false;}
            const cY=slime.y-R,ang=Math.atan2(mouseY-cY,mouseX-slime.x),dist=Math.min(Math.hypot(mouseX-slime.x,mouseY-cY),30);
            const eoX=Math.cos(ang)*dist*0.25;let eoY=Math.sin(ang)*dist*0.25;if(eoY>5)eoY=5;
            const hoX=Math.cos(ang)*dist*0.1,hoY=Math.sin(ang)*dist*0.1,es=R*0.35,er=R*0.2;let pr=R*0.11;if(surprisedTimer>0)pr=2;
            ctx.translate(hoX,hoY);
            if(isBlinking){ctx.strokeStyle='#022c22';ctx.lineWidth=3;ctx.beginPath();ctx.arc(-es,0,er-2,0,Math.PI);ctx.stroke();ctx.beginPath();ctx.arc(es,0,er-2,0,Math.PI);ctx.stroke();}
            else{drawEye(-es,0,er,pr,eoX,eoY);drawEye(es,0,er,pr,eoX,eoY);}
            ctx.restore();raf=requestAnimationFrame(draw);
        }
        draw();
        return ()=>{if(raf)cancelAnimationFrame(raf);glassEl.removeEventListener('mousedown',hit);glassEl.removeEventListener('touchstart',hit);};
    }

    /* ── Settings modal ── */
    function _initSettings() {
        const modal=root.querySelector('#ts-settings-modal');
        const open=()=>modal.classList.add('open');
        const close=()=>modal.classList.remove('open');
        root.querySelector('#ts-open-settings').addEventListener('click',open);
        root.querySelector('#ts-close-settings').addEventListener('click',close);
        [['sm-master','master'],['sm-music','music'],['sm-sfx','sfx']].forEach(([id,k])=>{
            const el=root.querySelector('#'+id),v=root.querySelector('#'+id+'-v');
            if(!el)return; el.value=S[k]; if(v)v.textContent=S[k];
            el.addEventListener('input',()=>{S[k]=+el.value;if(v)v.textContent=el.value;saveS(S);});
        });
        [['sm-quality','quality'],['sm-lang','lang']].forEach(([id,k])=>{
            const seg=root.querySelector('#'+id);
            seg?.querySelectorAll('.pks-seg-btn').forEach(b=>{
                b.classList.toggle('on',b.dataset.v===S[k]);
                b.addEventListener('click',()=>{S[k]=b.dataset.v;saveS(S);seg.querySelectorAll('.pks-seg-btn').forEach(x=>x.classList.toggle('on',x===b));});
            });
        });
        [['sm-fps','fps'],['sm-motion','motion'],['sm-notif','notif'],['sm-vibr','vibr']].forEach(([id,k])=>{
            const el=root.querySelector('#'+id);
            if(!el)return; el.checked=S[k];
            el.addEventListener('change',()=>{S[k]=el.checked;saveS(S);});
        });
        const confirmOverlay=root.querySelector('#ts-confirm-reset');
        const showConfirm=()=>confirmOverlay.classList.add('show');
        const hideConfirm=()=>confirmOverlay.classList.remove('show');
        root.querySelector('#sm-reset')?.addEventListener('click',showConfirm);
        root.querySelector('#ts-confirm-no')?.addEventListener('click',hideConfirm);
        root.querySelector('#ts-confirm-yes')?.addEventListener('click',()=>{
            Object.keys(localStorage).filter(k=>k.startsWith('inku.')).forEach(k=>localStorage.removeItem(k));
            hideConfirm();close();
            document.body.style.transition='opacity 0.35s';document.body.style.opacity='0';
            setTimeout(()=>location.reload(),370);
        });
    }

    /* ── Play flow ── */
    const MSGS=['Synchronisation ADN...','Chargement du laboratoire...','Réveil du slime...'];
    let _done=false,_kill=null;

    function _play(){
        if(_done)return;_done=true;
        const ov=root.querySelector('#ts-loading-overlay'),txt=root.querySelector('#ts-loading-text'),btn=root.querySelector('#ts-btn-play');
        txt.textContent=MSGS[0];ov.classList.add('show');btn.style.display='none';
        let i=1;const iv=setInterval(()=>{if(txt&&i<MSGS.length)txt.textContent=MSGS[i++];},850);
        if(typeof onPlay==='function')onPlay();
        setTimeout(()=>{clearInterval(iv);root.querySelector('#ts-screen').classList.add('ts-out');setTimeout(()=>_destroy(),550);},800);
    }

    /* ── Public API ── */
    function mount(){
        document.documentElement.appendChild(root);
        setTimeout(()=>{root.querySelector('#ts-screen').classList.add('ts-in');},150);
        _kill=_initSlime(root.querySelector('#ts-glass'),root.querySelector('#ts-canvas'));
        _initSettings();
        const btn=root.querySelector('#ts-btn-play');
        btn.addEventListener('click',_play);
        btn.addEventListener('touchend',e=>{e.preventDefault();_play();});
    }

    function _destroy(){
        if(_kill)_kill();
        root.remove();
    }

    return {mount,destroy:_destroy};
}
