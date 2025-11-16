/* ---------- CONFIG ---------- */
const cfg = {
  rows: 9,          // ÍMPAR -> 10 slots
  cols: 10,
  spacing: 40,
  g: 0.15,
  maxBalls: 100,
  vyMax: 5,
  radius: 6,
  wallKick: 2.8,    // velocidade mínima lateral ao rebater na parede (sempre pro centro)
  wallDamp: 0.9     // amortecimento da vy no choque com a parede
};

/* ---------- PAYOUTS (10 slots) ---------- */
// 10 slots (rows = 9; cols = 10)
let slots = [-90, 60, -50, 50, -60, 100, -40, 50, -90, 60];


/* ---------- ESTADO ---------- */
let pins = [];
let balls = [];
let allocations = [];
let totalScore = 0;
let state = "setup";
let dropTick = 0;

let settledBalls = [];
let settledCount = Array(cfg.cols).fill(0);

/* ---------- p5 SETUP ---------- */
function setup() {
  const holder = document.getElementById("p5-holder");
  createCanvas(cfg.cols * cfg.spacing, 600).parent(holder);

  textAlign(CENTER, CENTER);
  pinSetup();
  uiSetup();
}

/* ---------- p5 LOOP ---------- */
function draw() {
  background(20, 20, 25);

  if (state === "setup") highlightCols();

  pinDraw();
  slotDraw();
  settledDraw();

  if (state === "play") ballUpdate();
}

/* ---------- PINOS ---------- */
function pinSetup() {
  pins = [];
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const x = cfg.spacing / 2 + c * cfg.spacing + (r % 2) * cfg.spacing / 2;
      const y = 80 + r * cfg.spacing;
      pins.push(createVector(x, y));
    }
  }
}

function pinDraw() {
  fill("#0ff");
  noStroke();
  for (let p of pins) circle(p.x, p.y, 8);
}

/* ---------- SLOTS & PILHAS ---------- */
function slotDraw() {
  for (let i = 0; i < slots.length; i++) {
    const val = slots[i];
    const xc = (i + 0.5) * cfg.spacing;

    noStroke();
    fill(40);
    rect(i * cfg.spacing, height - 60, cfg.spacing, 60);

    if (val > 0) fill(0, 255, 0);
    else if (val < 0) fill(255, 0, 0);
    else fill(255);

    text(val, xc, height - 30);
  }
}

function settledDraw() {
  fill("#ff0");
  noStroke();
  const r = cfg.radius;
  for (let s of settledBalls) circle(s.x, s.y, r * 2);
}

/* ---------- UI ---------- */
function uiSetup() {
  const selects = document.querySelectorAll(".colSel");
  selects.forEach(sel => {
    sel.innerHTML = "";
    for (let i = 0; i < cfg.cols; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${i} (${slots[i]})`;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", validate);
  });

  document.querySelectorAll(".qtyInp")
    .forEach(inp => inp.addEventListener("input", validate));

  document.getElementById("startBtn")
    .addEventListener("click", () => { validate(); gameStart(); });

  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.addEventListener("click", resetGame);

  validate();
}

function validate() {
  const qty = [...document.querySelectorAll(".qtyInp")];
  const col = [...document.querySelectorAll(".colSel")];

  let total = 0, used = new Set(), alloc = [];
  for (let i = 0; i < 3; i++) {
    const q = +qty[i].value || 0;
    if (q > 0) {
      const c = +col[i].value;
      total += q;
      if (used.has(c)) continue; // evita duplicar a mesma coluna
      used.add(c);
      alloc.push({ col: c, qty: q });
    }
  }

  const ok = total > 0 && total <= cfg.maxBalls && used.size === alloc.length;
  document.getElementById("remaining").textContent =
    `Restantes: ${cfg.maxBalls - total}`;
  document.getElementById("startBtn").disabled = !ok;
  allocations = alloc;
}

function highlightCols() {
  noStroke();
  fill(255, 255, 0, 40);
  for (let a of allocations) rect(a.col * cfg.spacing, 0, cfg.spacing, height);
}

/* ---------- CONTROLE DE JOGO ---------- */
function gameStart() {
  if (allocations.length === 0) return;

  state = "play";
  totalScore = 0;
  document.getElementById("scoreValue").textContent = "0";

  document.getElementById("setup").style.display = "none";
  document.getElementById("score").style.display = "block";
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.style.display = "none";

  balls = [];
  settledBalls = [];
  settledCount = Array(cfg.cols).fill(0);
  dropTick = frameCount;

  spawnBall();
}

function gameEnd() {
  state = "done";
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.style.display = "block";
}

/* ---------- RESET ---------- */
function resetGame() {
  state = "setup";
  totalScore = 0;
  balls = [];
  allocations = [];
  settledBalls = [];
  settledCount = Array(cfg.cols).fill(0);
  dropTick = 0;

  document.getElementById("setup").style.display = "block";
  document.getElementById("score").style.display = "none";
  document.getElementById("scoreValue").textContent = "0";
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.style.display = "none";

  document.querySelectorAll(".qtyInp").forEach(inp => inp.value = 0);
  document.querySelectorAll(".colSel").forEach(sel => sel.selectedIndex = 0);
  document.getElementById("remaining").textContent =
    `Restantes: ${cfg.maxBalls}`;

  validate();
}

/* ---------- BOLINHAS EM MOVIMENTO ---------- */
function spawnBall() {
  if (allocations.length === 0) return;
  const e = allocations[0];
  balls.push({
    x: (e.col + 0.5) * cfg.spacing,
    y: 50,
    vx: random(-0.5, 0.5),
    vy: 0
  });
  e.qty--;
  if (e.qty <= 0) allocations.shift();
}

function ballUpdate() {
  // solta nova bolinha periodicamente
  if (frameCount - dropTick > 15) {
    spawnBall();
    dropTick = frameCount;
  }

  const r = cfg.radius;
  const centerX = width / 2;

  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];

    // gravidade limitada
    b.vy = Math.min(b.vy + cfg.g, cfg.vyMax);

    // integra posição
    b.x += b.vx;
    b.y += b.vy;

    // --- REBOTE DETERMINÍSTICO NA PAREDE (sempre pro centro) ---
    if (b.x <= r) {
      b.x = r; // clamp
      const speed = Math.max(cfg.wallKick, Math.abs(b.vx));
      b.vx = Math.sign(centerX - b.x) * speed; // sempre para o centro
      b.vy *= cfg.wallDamp; // amortecimento vertical
    } else if (b.x >= width - r) {
      b.x = width - r; // clamp
      const speed = Math.max(cfg.wallKick, Math.abs(b.vx));
      b.vx = Math.sign(centerX - b.x) * speed; // sempre para o centro
      b.vy *= cfg.wallDamp;
    }

    // pequeno atrito horizontal
    b.vx *= 0.995;

    // colisão pinos (espalhamento tipo Galton)
    for (let p of pins) {
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const d2 = dx * dx + dy * dy;
      const rad = r + 4;
      if (d2 < rad * rad) {
        const d = Math.sqrt(d2) || 1;
        const nx = dx / d, ny = dy / d;
        b.vx += nx * 2.2 + random(-0.4, 0.4);
        b.vy += ny * 0.3;
        break;
      }
    }

    // desenha
    fill("#ff0");
    noStroke();
    circle(b.x, b.y, r * 2);

    // chegou no slot?
    if (b.y > height - 60) {
      const idx = constrain(Math.floor(b.x / cfg.spacing), 0, cfg.cols - 1);
      const val = slots[idx] || 0;
      totalScore += val;
      document.getElementById("scoreValue").textContent = totalScore;

      const sx = (idx + 0.5) * cfg.spacing;
      const sy = height - 60 + r + settledCount[idx] * (r * 2 + 2);
      settledBalls.push({ x: sx, y: sy });
      settledCount[idx]++;

      balls.splice(i, 1);
    }
  }

  // fim de jogo
  if (state === "play" && allocations.length === 0 && balls.length === 0) {
    gameEnd();
  }
}
