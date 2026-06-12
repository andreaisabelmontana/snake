# Snake

Snake on a 24×24 grid: tail grows with every apple eaten, speed increases the longer you survive, high score persists between visits.

**▶ Play:** https://andreaisabelmontana.github.io/snake/

> **Not an original idea.** This recreates the concept of an existing project — I didn't invent it. I rebuilt it from scratch, my own way, out of curiosity about how it actually works (and tried to make it a little better along the way).

## Features

- **Interpolated rendering** — movement is stepped on a fixed tick, but rendering interpolates between cells so the snake moves smoothly rather than snapping
- **Two modes** — *Walls* (edges kill) or *Wrap* (pass through edges)
- **Rising speed** — each apple shaves a little off the tick, down to a floor
- **Queued turns** — a buffered direction stops the classic double-tap self-kill
- Persistent best score (`localStorage`), procedural WebAudio blips, keyboard + swipe controls

## Tech

Vanilla JavaScript + Canvas 2D, fixed-timestep update with interpolated rendering. No build step, no dependencies.

```
index.html
styles.css
src/game.js   # grid logic, fixed-tick loop, interpolation, input
```

Controls: `↑ ↓ ← →` / `WASD` / swipe · `P` pause · `R` restart.

## License

MIT — see [LICENSE](LICENSE).
