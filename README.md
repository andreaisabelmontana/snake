# Snake

Snake on a 24×24 grid: tail grows with every apple, speed rises the longer you survive, best score persists between visits. The game *rules* live in a small framework-free ES module (`src/snake.js`) with no canvas, DOM, or timers — so they can be tested directly. The browser demo (`src/game.js`) is just rendering, audio, and input on top of that core.

**▶ Play:** https://andreaisabelmontana.github.io/snake/

> **Not an original idea.** This recreates the concept of an existing game — I didn't invent it. I rebuilt it from scratch, my own way, out of curiosity about how it actually works (and tried to make it a little better along the way).

## Game-state model

The core is a `SnakeGame` over a `cols × rows` grid of integer cells (x grows right, y grows down). State advances exactly one cell per `step()`, and everything is deterministic — same inputs and seed, same game.

- **Snake** — an array of `{x, y}` cells, head first. Each `step()`:
  1. commits the queued direction (unless it's a 180° reversal of the live heading),
  2. moves the head one cell in that direction,
  3. resolves the border (wall or wrap),
  4. eats food if the head lands on it (grow + score), otherwise drops the tail,
  5. checks self-collision.
- **Direction** — a unit vector. `setDirection()` rejects a direct reversal of the *current* heading, so a quick double-tap can't fold the snake back into its own neck.
- **Eating** — landing on the food cell scores +10, keeps the new head without dropping the tail (immediate growth), and places fresh food. The tail cell is a legal target on a non-eating step because it vacates that same tick.

### Wall vs wrap modes

- **Walls** (`wrap: false`) — stepping off any edge ends the game.
- **Wrap** (`wrap: true`) — the head leaves one edge and reappears on the opposite edge, same row/column.

### Food placement

Food is placed by a seeded PRNG (`mulberry32`) so placements are reproducible and testable. It is **never** put on a snake cell: while the board is mostly empty it uses rejection sampling; once cells are scarce it enumerates the free cells and picks one. A completely full board yields `food = null` (the win state).

## Core API

```js
import { SnakeGame, DIRS } from "./src/snake.js";

const g = new SnakeGame({ cols: 24, rows: 24, wrap: false, seed: 1 });
g.setDirection(DIRS.up); // up | down | left | right
const { moved, ate, died } = g.step();
// read g.snake, g.food, g.score, g.alive
```

## Run

**Demo** — it's a static page, no build step:

```
# any static server, e.g.
python -m http.server
# then open http://localhost:8000
```

Controls: `↑ ↓ ← →` / `WASD` / swipe · `P` pause · `R` restart.

**Tests** — Node's built-in runner, no dependencies (Node 24+):

```
node --test
```

```
✔ eating food grows the snake by one and raises the score
✔ normal movement without eating keeps length constant and shifts the body
✔ moving into itself ends the game (self-collision)
✔ a non-eating step may legally enter the vacating tail cell
✔ WALL mode ends the game at the border
✔ WRAP mode wraps the head to the opposite edge
✔ a 180-degree reversal input is ignored (can't instantly reverse)
✔ reversal cannot sneak through two quick turns in one tick
✔ food never spawns on a body cell across many seeded placements
✔ food never spawns on the body on a near-full board (one free cell)
✔ a completely full board yields no food (null)
✔ the seeded PRNG is deterministic and within [0, 1)
ℹ tests 12
ℹ pass 12
ℹ fail 0
```

## Layout

```
index.html
styles.css
src/snake.js        # the pure game core — no canvas/DOM, fully tested
src/game.js         # browser demo: fixed-tick loop, interpolation, render, input, audio
test/snake.test.js  # node:test suite
package.json        # type:module, "test": "node --test"
```

The demo renders on a fixed tick but interpolates between cells, so the snake glides instead of snapping.

## License

MIT — see [LICENSE](LICENSE).
