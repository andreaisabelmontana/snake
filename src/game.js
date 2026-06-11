// Coil — Snake on a 24x24 grid.
// Movement is stepped on a fixed tick, but rendering interpolates between the
// previous and current cell so the snake glides instead of snapping. A queued
// direction prevents the classic "double-turn into yourself" death.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GRID = 24;
const SIZE = 600;
const CELL = SIZE / GRID;

function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
fit();
window.addEventListener("resize", fit);

const BEST_KEY = "coil.best";
let best = +(localStorage.getItem(BEST_KEY) || 0);

const game = {
  snake: [], dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
  food: { x: 0, y: 0 },
  grow: 0, score: 0,
  alive: false, paused: false, wrap: false,
  tick: 0, stepMs: 130, acc: 0, last: 0,
  prev: [], // previous positions for interpolation
};

const el = {
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  overlay: document.getElementById("overlay"),
  ovtitle: document.getElementById("ovtitle"),
  ovsub: document.getElementById("ovsub"),
};
el.best.textContent = best;

function reset() {
  game.snake = [{ x: 8, y: 12 }, { x: 7, y: 12 }, { x: 6, y: 12 }];
  game.prev = game.snake.map((s) => ({ ...s }));
  game.dir = { x: 1, y: 0 };
  game.nextDir = { x: 1, y: 0 };
  game.grow = 0;
  game.score = 0;
  game.stepMs = 130;
  game.acc = 0;
  placeFood();
  el.score.textContent = 0;
}

function placeFood() {
  let p;
  do { p = { x: (Math.random() * GRID) | 0, y: (Math.random() * GRID) | 0 }; }
  while (game.snake.some((s) => s.x === p.x && s.y === p.y));
  game.food = p;
}

function step() {
  const nd = game.nextDir;
  // ignore reversals
  if (!(nd.x === -game.dir.x && nd.y === -game.dir.y)) game.dir = nd;

  game.prev = game.snake.map((s) => ({ ...s }));
  const head = game.snake[0];
  let nx = head.x + game.dir.x;
  let ny = head.y + game.dir.y;

  if (game.wrap) {
    nx = (nx + GRID) % GRID;
    ny = (ny + GRID) % GRID;
  } else if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
    return die();
  }

  // self-collision (allow moving into the current tail cell, which will vacate)
  const willGrow = game.grow > 0;
  const body = willGrow ? game.snake : game.snake.slice(0, -1);
  if (body.some((s) => s.x === nx && s.y === ny)) return die();

  game.snake.unshift({ x: nx, y: ny });
  if (willGrow) game.grow--; else game.snake.pop();

  if (nx === game.food.x && ny === game.food.y) {
    game.score += 10;
    game.grow += 1;
    game.stepMs = Math.max(60, game.stepMs - 2.5); // speed up gradually
    el.score.textContent = game.score;
    beep(660, 0.05);
    placeFood();
  }
}

function die() {
  game.alive = false;
  beep(120, 0.25, "sawtooth");
  if (game.score > best) {
    best = game.score;
    localStorage.setItem(BEST_KEY, best);
    el.best.textContent = best;
  }
  el.ovtitle.textContent = "Game over";
  el.ovsub.textContent = `You scored ${game.score}. Press Start or R to try again.`;
  document.getElementById("modes").style.display = "none";
  el.overlay.classList.remove("hidden");
}

// ---- audio ----
let actx = null;
function beep(freq, dur = 0.05, type = "square") {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = 0.04;
    o.connect(g); g.connect(actx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.stop(actx.currentTime + dur);
  } catch (e) {}
}

// ---- render ----
function draw(alpha) {
  ctx.fillStyle = "#0b1410";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // subtle grid
  ctx.strokeStyle = "rgba(70,240,138,.05)";
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL); ctx.stroke();
  }

  // food (pulsing)
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
  const fx = game.food.x * CELL + CELL / 2, fy = game.food.y * CELL + CELL / 2;
  ctx.fillStyle = "#ff5d7a";
  ctx.shadowColor = "#ff5d7a"; ctx.shadowBlur = 12 + pulse * 8;
  ctx.beginPath(); ctx.arc(fx, fy, CELL * 0.34, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // snake (interpolated). Skip interpolation across wrap jumps.
  const n = game.snake.length;
  for (let i = 0; i < n; i++) {
    const cur = game.snake[i];
    const prev = game.prev[i] || cur;
    let ix, iy;
    if (Math.abs(cur.x - prev.x) > 1 || Math.abs(cur.y - prev.y) > 1) {
      ix = cur.x; iy = cur.y; // wrapped — don't lerp across the board
    } else {
      ix = prev.x + (cur.x - prev.x) * alpha;
      iy = prev.y + (cur.y - prev.y) * alpha;
    }
    const t = i / n;
    const g = Math.round(240 - t * 90);
    ctx.fillStyle = i === 0 ? "#a6ffce" : `rgb(${30 + t * 20}, ${g}, ${120 - t * 30})`;
    const pad = i === 0 ? 1.5 : 2.5;
    ctx.beginPath();
    ctx.roundRect(ix * CELL + pad, iy * CELL + pad, CELL - pad * 2, CELL - pad * 2, 5);
    ctx.fill();
  }
}

function frame(now) {
  if (!game.last) game.last = now;
  const dt = now - game.last;
  game.last = now;

  if (game.alive && !game.paused) {
    game.acc += dt;
    while (game.acc >= game.stepMs) {
      step();
      game.acc -= game.stepMs;
      if (!game.alive) break;
    }
  }
  const alpha = game.alive && !game.paused ? Math.min(1, game.acc / game.stepMs) : 1;
  draw(alpha);

  if (game.paused && game.alive) {
    ctx.fillStyle = "rgba(10,15,12,.5)";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#eafff2"; ctx.font = "700 34px ui-monospace, monospace";
    ctx.textAlign = "center"; ctx.fillText("PAUSED", SIZE / 2, SIZE / 2);
  }
  requestAnimationFrame(frame);
}

// ---- input ----
const DIRS = {
  arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 },
};
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (DIRS[k]) { e.preventDefault(); game.nextDir = DIRS[k]; }
  if (k === "p" && game.alive) game.paused = !game.paused;
  if (k === "r") start();
});

let touchStart = null;
canvas.addEventListener("touchstart", (e) => { touchStart = e.touches[0]; }, { passive: true });
canvas.addEventListener("touchmove", (e) => {
  if (!touchStart) return;
  const t = e.touches[0];
  const dx = t.clientX - touchStart.clientX, dy = t.clientY - touchStart.clientY;
  if (Math.abs(dx) + Math.abs(dy) < 24) return;
  game.nextDir = Math.abs(dx) > Math.abs(dy)
    ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
  touchStart = t;
  e.preventDefault();
}, { passive: false });

// ---- menu ----
document.getElementById("modes").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  document.querySelectorAll("#modes button").forEach((x) => x.classList.remove("sel"));
  b.classList.add("sel");
  game.wrap = b.dataset.wrap === "true";
});

function start() {
  reset();
  game.alive = true;
  game.paused = false;
  el.overlay.classList.add("hidden");
  beep(520, 0.08);
}
document.getElementById("start").addEventListener("click", start);

requestAnimationFrame(frame);

// Debug hook: lets the game be driven deterministically in tests/preview where
// requestAnimationFrame may be throttled. Harmless in normal play.
window.__coil = { game, step, draw, start };
