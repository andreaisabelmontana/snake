// snake.js — the pure game core. No canvas, no DOM, no audio, no timers.
//
// The game lives on a `cols × rows` grid of integer cells. State advances one
// cell per `step()`. Everything here is deterministic: feed it the same inputs
// (including the same PRNG seed for food) and it produces the same game.
//
// Coordinate convention: x grows right, y grows down. A direction is a unit
// vector {x, y} with exactly one non-zero component.

/**
 * Mulberry32 — a tiny, fast, deterministic 32-bit PRNG. Given a seed it yields
 * a repeatable stream of floats in [0, 1). Used so food placement is testable.
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DIRS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

function isOpposite(a, b) {
  return a.x === -b.x && a.y === -b.y;
}

/**
 * A Snake game instance. Construct it, then drive it with `setDirection()` and
 * `step()`. Read `snake`, `food`, `score`, `alive` for state.
 */
export class SnakeGame {
  /**
   * @param {object} [opts]
   * @param {number} [opts.cols=24]      grid width in cells
   * @param {number} [opts.rows=24]      grid height in cells
   * @param {boolean} [opts.wrap=false]  true = WRAP mode, false = WALL mode
   * @param {number} [opts.seed=1]       PRNG seed for food placement
   * @param {Array<{x:number,y:number}>} [opts.snake]  initial body, head first
   * @param {{x:number,y:number}} [opts.dir]           initial direction
   */
  constructor(opts = {}) {
    this.cols = opts.cols ?? 24;
    this.rows = opts.rows ?? 24;
    this.wrap = opts.wrap ?? false;
    this.rng = mulberry32(opts.seed ?? 1);

    if (opts.snake) {
      this.snake = opts.snake.map((c) => ({ x: c.x, y: c.y }));
    } else {
      const cy = Math.floor(this.rows / 2);
      const cx = Math.floor(this.cols / 3);
      this.snake = [
        { x: cx, y: cy },
        { x: cx - 1, y: cy },
        { x: cx - 2, y: cy },
      ];
    }

    this.dir = opts.dir ? { ...opts.dir } : { ...DIRS.right };
    this.nextDir = { ...this.dir };
    this.score = 0;
    this.alive = true;
    this.food = this.placeFood();
  }

  get head() {
    return this.snake[0];
  }

  /** True if cell (x, y) is occupied by any snake segment. */
  occupies(x, y) {
    return this.snake.some((s) => s.x === x && s.y === y);
  }

  /**
   * Place food on a random free cell, never on the snake's body. Returns the
   * chosen cell. If the board is completely full, returns null (a win state).
   */
  placeFood() {
    const free = this.cols * this.rows - this.snake.length;
    if (free <= 0) {
      this.food = null;
      return null;
    }
    // Rejection sampling is fine while the board is mostly empty. Near a full
    // board it would loop a lot, so once it's tight we enumerate free cells.
    if (free > (this.cols * this.rows) / 4) {
      let p;
      do {
        p = {
          x: Math.floor(this.rng() * this.cols),
          y: Math.floor(this.rng() * this.rows),
        };
      } while (this.occupies(p.x, p.y));
      this.food = p;
      return p;
    }
    const cells = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!this.occupies(x, y)) cells.push({ x, y });
      }
    }
    const pick = cells[Math.floor(this.rng() * cells.length)];
    this.food = pick;
    return pick;
  }

  /**
   * Queue a direction for the next step. A 180° reversal of the *current*
   * heading is ignored (you can't instantly fold back on yourself). Returns
   * true if the input was accepted, false if rejected.
   */
  setDirection(dir) {
    if (!dir) return false;
    // Reject a 180° reversal of the live heading. We compare against `dir`, not
    // `nextDir`, so two quick turns within one tick can't fold back on the body.
    if (isOpposite(dir, this.dir)) return false;
    this.nextDir = { x: dir.x, y: dir.y };
    return true;
  }

  /**
   * Advance the game by one cell. Applies the queued direction, moves the head,
   * resolves walls/wrap, eats food (grow + score), and checks self-collision.
   * Sets `alive = false` on death.
   * @returns {{moved:boolean, ate:boolean, died:boolean}}
   */
  step() {
    if (!this.alive) return { moved: false, ate: false, died: false };

    // Commit the queued turn, but never let it become a reversal.
    if (!isOpposite(this.nextDir, this.dir)) {
      this.dir = { x: this.nextDir.x, y: this.nextDir.y };
    }

    let nx = this.head.x + this.dir.x;
    let ny = this.head.y + this.dir.y;

    if (this.wrap) {
      nx = (nx + this.cols) % this.cols;
      ny = (ny + this.rows) % this.rows;
    } else if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) {
      this.alive = false;
      return { moved: false, ate: false, died: true };
    }

    const ate = this.food != null && nx === this.food.x && ny === this.food.y;

    // When not eating, the tail cell vacates this step, so moving onto it is
    // legal. When eating (no tail drop), every body cell is a fatal collision.
    const body = ate ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) {
      this.alive = false;
      return { moved: false, ate: false, died: true };
    }

    this.snake.unshift({ x: nx, y: ny });

    if (ate) {
      // Eating grows the snake immediately: keep the new head, don't drop the
      // tail this step. Score climbs and fresh food is placed.
      this.score += 10;
      this.placeFood();
    } else {
      this.snake.pop();
    }

    return { moved: true, ate, died: false };
  }
}
