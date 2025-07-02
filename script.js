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

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const form = document.getElementById('controlsForm');
const startBtn = document.getElementById('startBtn');
const score1 = document.getElementById('score1');
const score2 = document.getElementById('score2');

// --- Initialisation ---
function resetGame() {
  players = [
    { x: 100, y: 250, dir: 0, color: '#ff512f', keys: controls.p1 },
    { x: 400, y: 250, dir: Math.PI, color: '#36d1c4', keys: controls.p2 }
  ];
  trails = [[], []];
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
function startGame() {
  resetGame();
  gameRunning = true;
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, 1000/60);
}

function stopGame() {
  gameRunning = false;
  clearInterval(gameInterval);
}

function gameLoop() {
  // Déplacement automatique et contrôle
  const speed = 2.2;
  const turn = Math.PI / 32;

  for (let i = 0; i < 2; i++) {
    const p = players[i];
    const keys = p.keys;
    // Contrôle gauche/droite
    if (pressed[keys.left]) p.dir -= turn;
    if (pressed[keys.right]) p.dir += turn;
    // Avance
    p.x += Math.cos(p.dir) * speed;
    p.y += Math.sin(p.dir) * speed;
    // Ajoute la position à la trace
    trails[i].push({ x: p.x, y: p.y });
  }

  // Dessin
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Traces
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = players[i].color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    trails[i].forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
  }
  // Points
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = players[i].color;
    ctx.beginPath();
    ctx.arc(players[i].x, players[i].y, 7, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Collision
  for (let i = 0; i < 2; i++) {
    const p = players[i];
    // Mur
    if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
      endRound(i);
      return;
    }
    // Trace (touche sa propre trace ou celle de l'autre)
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < trails[j].length - 10; k++) { // -10 pour éviter collision immédiate
        const pt = trails[j][k];
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
  setTimeout(startGame, 1200);
}

// --- Initialisation score ---
updateScore(); 