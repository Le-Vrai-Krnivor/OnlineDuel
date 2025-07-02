// --- Variables globales ---
let controls = {
  p1: { left: 'a', right: 'd' },
  p2: { left: 'j', right: 'l' }
};
let gameRunning = false;
let score = { p1: 0, p2: 0 };
let gameInterval;
let players;
let trails;
let countdown = 0;
let countdownInterval = null;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const form = document.getElementById('controlsForm');
const startBtn = document.getElementById('startBtn');
const score1 = document.getElementById('score1');
const score2 = document.getElementById('score2');
const pauseBtn = document.getElementById('pauseBtn');
let paused = false;

const showHeadCheckbox = document.getElementById('showHead');
const canvasSizeInput = document.getElementById('canvasSize');
const canvasSizeValue = document.getElementById('canvasSizeValue');
const wrapModeCheckbox = document.getElementById('wrapMode');
const enablePowersCheckbox = document.getElementById('enablePowers');

let showHead = true;
let wrapMode = false;
let currentCanvasSize = 500;
let enablePowers = true;

let globalPower = null;
let globalPowerTimeout = null;

// --- Initialisation ---
function resetGame() {
  // Spawn aléatoire pour chaque joueur, pas trop près des bords
  const margin = 40;
  let p1, p2;
  do {
    p1 = {
      x: margin + Math.random() * (currentCanvasSize - 2 * margin),
      y: margin + Math.random() * (currentCanvasSize - 2 * margin),
      dir: Math.random() * 2 * Math.PI,
      color: '#ff512f',
      keys: controls.p1
    };
    p2 = {
      x: margin + Math.random() * (currentCanvasSize - 2 * margin),
      y: margin + Math.random() * (currentCanvasSize - 2 * margin),
      dir: Math.random() * 2 * Math.PI,
      color: '#36d1c4',
      keys: controls.p2
    };
    // On évite qu'ils spawnent trop proches
  } while (distance(p1.x, p1.y, p2.x, p2.y) < 80);
  players = [p1, p2];
  trails = [[], []];
  clearPowers();
  powerEffects = [null, null];
  sameColorActive = false;
  globalPower = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateScore() {
  score1.textContent = score.p1;
  score2.textContent = score.p2;
}

// --- Gestion de la sélection des touches (y compris flèches) ---
const keyInputs = [
  document.getElementById('p1left'),
  document.getElementById('p1right'),
  document.getElementById('p2left'),
  document.getElementById('p2right')
];

const keyNames = {
  'arrowleft': '←',
  'arrowright': '→',
  'arrowup': '↑',
  'arrowdown': '↓',
  ' ': 'Espace',
};

keyInputs.forEach(input => {
  input.setAttribute('readonly', true);
  input.addEventListener('focus', () => {
    input.value = '';
    const handler = (e) => {
      e.preventDefault();
      let key = e.key.toLowerCase();
      input.value = keyNames[key] || (key.length === 1 ? key : key);
      input.dataset.key = key;
      window.removeEventListener('keydown', handler);
      input.blur();
    };
    window.addEventListener('keydown', handler);
  });
});

// --- Formulaire de configuration ---
form.addEventListener('submit', (e) => {
  e.preventDefault();
  controls.p1.left = keyInputs[0].dataset.key || 'a';
  controls.p1.right = keyInputs[1].dataset.key || 'd';
  controls.p2.left = keyInputs[2].dataset.key || 'j';
  controls.p2.right = keyInputs[3].dataset.key || 'l';
  startGame();
});

// --- Gestion des touches ---
let pressed = {};
document.addEventListener('keydown', (e) => {
  pressed[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', (e) => {
  pressed[e.key.toLowerCase()] = false;
});

// --- Boucle de jeu ---
function startGame(skipCountdown) {
  resetGame();
  gameRunning = true;
  paused = false;
  pauseBtn.textContent = 'Pause';
  if (gameInterval) clearInterval(gameInterval);
  if (!skipCountdown) {
    startCountdownAndGame();
    return;
  }
  giveInitialPowers();
  gameInterval = setInterval(gameLoop, 1000/60);
}

function stopGame() {
  gameRunning = false;
  clearInterval(gameInterval);
}

// --- Superpouvoirs ---
const POWER_TYPES = ['speed', 'slow', 'random', 'samecolor'];
const POWER_COLORS = {
  speed: '#ffeb3b',
  slow: '#2196f3',
  random: '#9c27b0',
  samecolor: '#00e676',
};
const POWER_ICONS = {
  speed: '⚡',
  slow: '🐢',
  random: '?',
  samecolor: '🎨',
};
let powers = [];
let powerEffects = [null, null]; // {type, timeout}
let sameColorActive = false;
let sameColorTimeout = null;

function spawnPower() {
  if (!enablePowers || countdown > 0) return;
  if (powers.length >= 2) return; // max 2 en même temps
  const type = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
  const margin = 30;
  const x = margin + Math.random() * (currentCanvasSize - 2 * margin);
  const y = margin + Math.random() * (currentCanvasSize - 2 * margin);
  powers.push({ x, y, type });
}

function clearPowers() {
  powers = [];
}

function activatePower(idx, type) {
  if (type === 'random') {
    const realType = POWER_TYPES[Math.floor(Math.random() * (POWER_TYPES.length - 1))];
    activatePower(idx, realType);
    return;
  }
  if (type === 'samecolor') {
    sameColorActive = true;
    if (sameColorTimeout) clearTimeout(sameColorTimeout);
    sameColorTimeout = setTimeout(() => { sameColorActive = false; }, 3000);
    return;
  }
  // Speed ou slow
  if (powerEffects[idx]) clearTimeout(powerEffects[idx].timeout);
  powerEffects[idx] = {
    type,
    timeout: setTimeout(() => { powerEffects[idx] = null; }, 3000)
  };
}

// --- Ajout dans la boucle de jeu ---
let powerSpawnTimer = 0;
function gameLoop() {
  // Déplacement automatique et contrôle
  let baseSpeed = 2.2;
  const turn = Math.PI / 32;

  for (let i = 0; i < 2; i++) {
    let speed = baseSpeed;
    if (powerEffects[i]?.type === 'speed') speed *= 1.7;
    if (powerEffects[i]?.type === 'slow') speed *= 0.5;
    const p = players[i];
    const keys = p.keys;
    // Contrôle gauche/droite
    if (pressed[keys.left]) p.dir -= turn;
    if (pressed[keys.right]) p.dir += turn;
    // Avance
    let oldX = p.x;
    let oldY = p.y;
    p.x += Math.cos(p.dir) * speed;
    p.y += Math.sin(p.dir) * speed;
    // Traversée des murs
    let wrapped = false;
    if (wrapMode) {
      if (p.x < 0) { p.x += currentCanvasSize; wrapped = true; }
      if (p.x > currentCanvasSize) { p.x -= currentCanvasSize; wrapped = true; }
      if (p.y < 0) { p.y += currentCanvasSize; wrapped = true; }
      if (p.y > currentCanvasSize) { p.y -= currentCanvasSize; wrapped = true; }
    }
    // Ajoute la position à la trace
    if (wrapped) {
      trails[i].push({ break: true }); // Marque une coupure de trace
    }
    trails[i].push({ x: p.x, y: p.y });
  }

  // Apparition des superpouvoirs
  if (enablePowers && countdown === 0) {
    powerSpawnTimer++;
    if (powerSpawnTimer > 120) { // toutes les 2 secondes
      spawnPower();
      powerSpawnTimer = 0;
    }
  } else {
    powerSpawnTimer = 0;
  }

  // Collision avec un superpouvoir
  for (let i = 0; i < 2; i++) {
    for (let j = powers.length - 1; j >= 0; j--) {
      const pow = powers[j];
      if (distance(players[i].x, players[i].y, pow.x, pow.y) < 14) {
        activatePower(i, pow.type);
        powers.splice(j, 1);
      }
    }
  }

  drawScene();

  // Collision
  for (let i = 0; i < 2; i++) {
    const p = players[i];
    // Mur
    if (!wrapMode && (p.x < 0 || p.x > currentCanvasSize || p.y < 0 || p.y > currentCanvasSize)) {
      endRound(i);
      return;
    }
    // Trace (touche sa propre trace ou celle de l'autre)
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < trails[j].length - 10; k++) { // -10 pour éviter collision immédiate
        const pt = trails[j][k];
        if (pt.break) continue;
        if (distance(p.x, p.y, pt.x, pt.y) < 7) {
          endRound(i);
          return;
        }
      }
    }
  }
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function endRound(loserIdx) {
  stopGame();
  if (loserIdx === 0) score.p2++;
  else score.p1++;
  updateScore();
  clearGlobalPowerEffects();
  setTimeout(() => startCountdownAndGame(), 1200);
}

// --- Initialisation score ---
updateScore();

pauseBtn.addEventListener('click', () => {
  if (!gameRunning) return;
  paused = !paused;
  if (paused) {
    clearInterval(gameInterval);
    pauseBtn.textContent = 'Reprendre';
  } else {
    gameInterval = setInterval(gameLoop, 1000/60);
    pauseBtn.textContent = 'Pause';
  }
});

// Affichage dynamique de la taille
canvasSizeInput.addEventListener('input', () => {
  canvasSizeValue.textContent = canvasSizeInput.value;
  resizeCanvas(parseInt(canvasSizeInput.value));
});

function resizeCanvas(size) {
  // Adapter le canvas et les positions proportionnellement
  const oldW = canvas.width;
  const oldH = canvas.height;
  const ratio = size / currentCanvasSize;
  canvas.width = size;
  canvas.height = size;
  currentCanvasSize = size;
  if (players && trails) {
    // Adapter les positions des joueurs
    for (let p of players) {
      p.x *= ratio;
      p.y *= ratio;
    }
    // Adapter les traces
    for (let t of trails) {
      for (let pt of t) {
        if (pt.x !== undefined && pt.y !== undefined) {
          pt.x *= ratio;
          pt.y *= ratio;
        }
      }
    }
    drawScene();
  }
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Traces
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = sameColorActive ? '#fff' : players[i].color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    let started = false;
    for (const pt of trails[i]) {
      if (pt.break) {
        ctx.stroke();
        ctx.beginPath();
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(pt.x, pt.y);
        started = true;
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
    ctx.stroke();
  }
  // Points (tête du serpent)
  if (showHead) {
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = sameColorActive ? '#fff' : players[i].color;
      ctx.beginPath();
      ctx.arc(players[i].x, players[i].y, 7, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  // Affichage du compte à rebours
  if (countdown > 0) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#18191a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(countdown, canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }
}

function startCountdownAndGame() {
  countdown = 3;
  drawScene();
  if (gameInterval) clearInterval(gameInterval);
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    countdown--;
    drawScene();
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      countdown = 0;
      startGame(true);
    }
  }, 1000);
}

function giveInitialPowers() {
  if (!enablePowers) return;
  // On peut tomber sur 'samecolor' (global), sinon chacun un pouvoir individuel différent
  const possible = POWER_TYPES.filter(t => t !== 'random');
  const type = possible[Math.floor(Math.random() * possible.length)];
  if (type === 'samecolor') {
    sameColorActive = true;
    powerEffects = [null, null];
    globalPower = 'samecolor';
  } else {
    // Effets individuels différents
    const other = possible.filter(t => t !== 'samecolor' && t !== type);
    powerEffects[0] = { type, timeout: null };
    powerEffects[1] = { type: other[Math.floor(Math.random() * other.length)], timeout: null };
    sameColorActive = false;
    globalPower = null;
  }
}

function applyGlobalPower(type) {
  // Reset tous les effets
  powerEffects = [null, null];
  sameColorActive = false;
  if (type === 'speed') {
    for (let i = 0; i < 2; i++) {
      powerEffects[i] = { type: 'speed', timeout: null };
    }
  } else if (type === 'slow') {
    for (let i = 0; i < 2; i++) {
      powerEffects[i] = { type: 'slow', timeout: null };
    }
  } else if (type === 'samecolor') {
    sameColorActive = true;
  }
}

function clearGlobalPowerEffects() {
  powerEffects = [null, null];
  sameColorActive = false;
  globalPower = null;
}

showHeadCheckbox.addEventListener('change', () => {
  showHead = showHeadCheckbox.checked;
});
wrapModeCheckbox.addEventListener('change', () => {
  wrapMode = wrapModeCheckbox.checked;
});
enablePowersCheckbox.addEventListener('change', () => {
  enablePowers = enablePowersCheckbox.checked;
});

// Initialisation des réglages
canvasSizeValue.textContent = canvasSizeInput.value;
resizeCanvas(parseInt(canvasSizeInput.value));
showHead = showHeadCheckbox.checked;
wrapMode = wrapModeCheckbox.checked;
enablePowers = enablePowersCheckbox.checked; 

import { getAuth, getRedirectResult, GoogleAuthProvider } from "firebase/auth";

const auth = getAuth();
getRedirectResult(auth)
  .then((result) => {
    // This gives you a Google Access Token. You can use it to access Google APIs.
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;

    // The signed-in user info.
    const user = result.user;
    // IdP data available using getAdditionalUserInfo(result)
    // ...
  }).catch((error) => {
    // Handle Errors here.
    const errorCode = error.code;
    const errorMessage = error.message;
    // The email of the user's account used.
    const email = error.customData.email;
    // The AuthCredential type that was used.
    const credential = GoogleAuthProvider.credentialFromError(error);
    // ..
  });