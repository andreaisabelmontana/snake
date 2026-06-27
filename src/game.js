// game.js — the browser demo. All the game *rules* live in snake.js; this file
// only deals with canvas rendering, audio, input, and the fixed-tick loop.
// Movement is stepped on a fixed tick, but rendering interpolates between the
// previous and current cell so the snake glides instead of snapping.

import { SnakeGame, DIRS } from "./snake.js";

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

// Loop / presentation state that the core doesn't care about.
let game = null;          // current SnakeGame instance
let prev = [];            // previous body positions, for interpolation
let wrap = false;         // selected mode, applied on start
let alive = false;
let paused = false;
let stepMs = 130;
let acc = 0;
let last = 0;

const el = {
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  overlay: document.getElementById("overlay"),
  ovtitle: document.getElementById("ovtitle"),
  ovsub: document.getElementById("ovsub"),
};
el.best.textContent = best;

function reset() {
  game = new SnakeGame({ cols: GRID, rows: GRID, wrap, seed: (Date.now() & 0x7fffffff) || 1 });
  prev = game.snake.map((s) => ({ ...s }));
  stepMs = 130;
  acc = 0;
  el.score.textContent = 0;
}

function tick() {
  prev = game.snake.map((s) => ({ ...s }));
  const r = game.step();
  if (r.ate) {
    stepMs = Math.max(60, stepMs - 2.5); // speed up gradually
    el.score.textContent = game.score;
    beep(660, 0.05);
  }
  if (r.died) die();
}

function die() {
  alive = false;
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
  if (game.food) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
    const fx = game.food.x * CELL + CELL / 2, fy = game.food.y * CELL + CELL / 2;
    ctx.fillStyle = "#ff5d7a";
    ctx.shadowColor = "#ff5d7a"; ctx.shadowBlur = 12 + pulse * 8;
    ctx.beginPath(); ctx.arc(fx, fy, CELL * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // snake (interpolated). Skip interpolation across wrap jumps.
  const n = game.snake.length;
  for (let i = 0; i < n; i++) {
    const cur = game.snake[i];
    const pr = prev[i] || cur;
    let ix, iy;
    if (Math.abs(cur.x - pr.x) > 1 || Math.abs(cur.y - pr.y) > 1) {
      ix = cur.x; iy = cur.y; // wrapped — don't lerp across the board
    } else {
      ix = pr.x + (cur.x - pr.x) * alpha;
      iy = pr.y + (cur.y - pr.y) * alpha;
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
  if (!last) last = now;
  const dt = now - last;
  last = now;

  if (alive && !paused) {
    acc += dt;
    while (acc >= stepMs) {
      tick();
      acc -= stepMs;
      if (!alive) break;
    }
  }
  const alpha = alive && !paused ? Math.min(1, acc / stepMs) : 1;
  if (game) draw(alpha);

  if (paused && alive) {
    ctx.fillStyle = "rgba(10,15,12,.5)";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#eafff2"; ctx.font = "700 34px ui-monospace, monospace";
    ctx.textAlign = "center"; ctx.fillText("PAUSED", SIZE / 2, SIZE / 2);
  }
  requestAnimationFrame(frame);
}

// ---- input ----
const KEYS = {
  arrowup: DIRS.up, w: DIRS.up,
  arrowdown: DIRS.down, s: DIRS.down,
  arrowleft: DIRS.left, a: DIRS.left,
  arrowright: DIRS.right, d: DIRS.right,
};
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (KEYS[k] && game) { e.preventDefault(); game.setDirection(KEYS[k]); }
  if (k === "p" && alive) paused = !paused;
  if (k === "r") start();
});

let touchStart = null;
canvas.addEventListener("touchstart", (e) => { touchStart = e.touches[0]; }, { passive: true });
canvas.addEventListener("touchmove", (e) => {
  if (!touchStart || !game) return;
  const t = e.touches[0];
  const dx = t.clientX - touchStart.clientX, dy = t.clientY - touchStart.clientY;
  if (Math.abs(dx) + Math.abs(dy) < 24) return;
  game.setDirection(Math.abs(dx) > Math.abs(dy)
    ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
  touchStart = t;
  e.preventDefault();
}, { passive: false });

// ---- menu ----
document.getElementById("modes").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  document.querySelectorAll("#modes button").forEach((x) => x.classList.remove("sel"));
  b.classList.add("sel");
  wrap = b.dataset.wrap === "true";
});

function start() {
  reset();
  alive = true;
  paused = false;
  el.overlay.classList.add("hidden");
  document.getElementById("modes").style.display = "";
  beep(520, 0.08);
}
document.getElementById("start").addEventListener("click", start);

requestAnimationFrame(frame);
