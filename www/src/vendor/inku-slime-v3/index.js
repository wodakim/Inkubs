import { SlimeEngine } from './engine/SlimeEngine.js';

const canvas = document.getElementById('slimeCanvas');
const engine = new SlimeEngine({ canvas });
engine.start();
window.__slimeEngine = engine;
