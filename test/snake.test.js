import test from "node:test";
import assert from "node:assert/strict";
import { SnakeGame, DIRS, mulberry32 } from "../src/snake.js";

// A small helper: a horizontal 3-cell snake heading right, head at (head).
function lineSnake(head, len) {
  const cells = [];
  for (let i = 0; i < len; i++) cells.push({ x: head.x - i, y: head.y });
  return cells;
}

test("eating food grows the snake by one and raises the score", () => {
  const g = new SnakeGame({ cols: 10, rows: 10, snake: lineSnake({ x: 4, y: 5 }, 3), dir: DIRS.right });
  // Put food directly in front of the head.
  g.food = { x: 5, y: 5 };
  const before = g.snake.length;
  const r = g.step();

  assert.equal(r.ate, true, "step should report an eat");
  assert.equal(g.snake.length, before + 1, "length grows by exactly one");
  assert.equal(g.score, 10, "score increases by 10");
  assert.deepEqual(g.head, { x: 5, y: 5 }, "head landed on the food cell");
  // A new food cell was placed and it is not on the body.
  assert.ok(g.food, "fresh food exists");
  assert.ok(!g.occupies(g.food.x, g.food.y), "fresh food is off the body");
});

test("normal movement without eating keeps length constant and shifts the body", () => {
  const snake = lineSnake({ x: 4, y: 5 }, 3); // (4,5)(3,5)(2,5)
  const g = new SnakeGame({ cols: 10, rows: 10, snake, dir: DIRS.right });
  g.food = { x: 9, y: 9 }; // far away — won't be eaten
  const r = g.step();

  assert.equal(r.ate, false);
  assert.equal(r.moved, true);
  assert.equal(g.snake.length, 3, "length unchanged");
  assert.deepEqual(g.snake, [
    { x: 5, y: 5 }, // new head
    { x: 4, y: 5 }, // old head shifted down the body
    { x: 3, y: 5 },
  ], "body shifted one cell, tail dropped");
});

test("moving into itself ends the game (self-collision)", () => {
  // A snake coiled into a C-shape, heading right. Turning down drives the head
  // straight into a mid-body segment (not a reversal, not the vacating tail).
  //   head (2,1); body runs down the left then right, so (2,2) is occupied.
  const snake = [
    { x: 2, y: 1 }, // head, heading right
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 }, // mid-body: the cell the head will turn into
    { x: 3, y: 2 },
    { x: 3, y: 1 }, // tail (vacates elsewhere, far from the head's target)
  ];
  const g = new SnakeGame({ cols: 10, rows: 10, snake, dir: DIRS.right });
  g.food = { x: 9, y: 9 };
  // Turn down: head goes (2,1) -> (2,2), which is a mid-body segment.
  assert.equal(g.setDirection(DIRS.down), true, "turning down is a legal input");
  const r = g.step();

  assert.equal(r.died, true, "stepping into the body kills");
  assert.equal(g.alive, false, "game is no longer alive");
});

test("a non-eating step may legally enter the vacating tail cell", () => {
  // Square loop where the head chases the tail. The tail will move out of the
  // way this same step, so entering it must NOT be a collision.
  const snake = [
    { x: 2, y: 1 }, // head
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 }, // tail
  ];
  const g = new SnakeGame({ cols: 10, rows: 10, snake, dir: DIRS.right });
  g.food = { x: 9, y: 9 };
  // Head at (2,1) heading right would hit a wall-free cell (3,1) — instead turn
  // down so it targets (2,2), the current tail. Legal because tail vacates.
  g.setDirection(DIRS.down);
  const r = g.step();

  assert.equal(r.died, false, "entering the vacating tail is allowed");
  assert.equal(g.alive, true);
  assert.deepEqual(g.head, { x: 2, y: 2 });
});

test("WALL mode ends the game at the border", () => {
  const g = new SnakeGame({
    cols: 6, rows: 6, wrap: false,
    snake: lineSnake({ x: 5, y: 3 }, 3), dir: DIRS.right,
  });
  g.food = { x: 0, y: 0 };
  const r = g.step(); // head at right edge (x=5) moving right => off the board
  assert.equal(r.died, true, "hitting the wall kills in WALL mode");
  assert.equal(g.alive, false);
});

test("WRAP mode wraps the head to the opposite edge", () => {
  const g = new SnakeGame({
    cols: 6, rows: 6, wrap: true,
    snake: lineSnake({ x: 5, y: 3 }, 3), dir: DIRS.right,
  });
  g.food = { x: 0, y: 0 };
  const r = g.step(); // off the right edge => wraps to x=0
  assert.equal(r.died, false, "wrapping does not kill");
  assert.equal(g.alive, true);
  assert.deepEqual(g.head, { x: 0, y: 3 }, "head wrapped to the left edge, same row");

  // Wrap on the vertical axis too.
  const g2 = new SnakeGame({
    cols: 6, rows: 6, wrap: true,
    snake: [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }], dir: DIRS.up,
  });
  g2.food = { x: 5, y: 5 };
  g2.step();
  assert.deepEqual(g2.head, { x: 3, y: 5 }, "head wrapped to the bottom edge, same column");
});

test("a 180-degree reversal input is ignored (can't instantly reverse)", () => {
  const g = new SnakeGame({ cols: 10, rows: 10, snake: lineSnake({ x: 4, y: 5 }, 3), dir: DIRS.right });
  g.food = { x: 9, y: 9 };

  const accepted = g.setDirection(DIRS.left); // direct reversal of "right"
  assert.equal(accepted, false, "reversal input is rejected");
  assert.deepEqual(g.nextDir, DIRS.right, "queued direction stays as the current heading");

  g.step();
  assert.deepEqual(g.head, { x: 5, y: 5 }, "snake kept moving right, did not reverse");
});

test("reversal cannot sneak through two quick turns in one tick", () => {
  // Heading right. Turn up (legal), then immediately try to turn left. The left
  // would be a 180 of the *current* heading (right), so it must be rejected,
  // preventing an up->left fold that would still be fine — but a right->down->...
  // The guard compares against the live `dir`, so left is always rejected here.
  const g = new SnakeGame({ cols: 10, rows: 10, snake: lineSnake({ x: 4, y: 5 }, 3), dir: DIRS.right });
  assert.equal(g.setDirection(DIRS.up), true, "turning up is legal");
  assert.equal(g.setDirection(DIRS.left), false, "left still rejected vs live heading");
  g.step();
  // Committed the last accepted non-reversal direction (up).
  assert.deepEqual(g.head, { x: 4, y: 4 }, "snake turned up");
});

test("food never spawns on a body cell across many seeded placements", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const g = new SnakeGame({ cols: 12, rows: 12, seed, snake: lineSnake({ x: 6, y: 6 }, 5) });
    for (let k = 0; k < 50; k++) {
      assert.ok(g.food, `seed ${seed}: food exists`);
      assert.ok(
        !g.occupies(g.food.x, g.food.y),
        `seed ${seed}, placement ${k}: food at ${g.food.x},${g.food.y} is on the body`,
      );
      g.placeFood(); // re-roll and check again
    }
  }
});

test("food never spawns on the body on a near-full board (one free cell)", () => {
  // Build a 4x4 board snake-filled except a single empty cell, across seeds.
  const cols = 4, rows = 4;
  for (let seed = 1; seed <= 50; seed++) {
    const emptyX = seed % cols, emptyY = (seed * 3) % rows;
    const body = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (x === emptyX && y === emptyY) continue;
        body.push({ x, y });
      }
    }
    const g = new SnakeGame({ cols, rows, seed, snake: body });
    assert.ok(g.food, `seed ${seed}: food should be placed in the one free cell`);
    assert.deepEqual(
      g.food, { x: emptyX, y: emptyY },
      `seed ${seed}: food must land on the only empty cell`,
    );
    assert.ok(!g.occupies(g.food.x, g.food.y), `seed ${seed}: food not on body`);
  }
});

test("a completely full board yields no food (null)", () => {
  const cols = 3, rows = 3;
  const body = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) body.push({ x, y });
  const g = new SnakeGame({ cols, rows, snake: body });
  assert.equal(g.food, null, "no free cell => food is null");
});

test("the seeded PRNG is deterministic and within [0, 1)", () => {
  const a = mulberry32(123), b = mulberry32(123);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b(), "same seed yields the same stream");
    assert.ok(v >= 0 && v < 1, "value is in [0, 1)");
  }
});
