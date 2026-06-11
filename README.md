# Coil

Snake, refined. A 24×24 grid, a tail that grows with every bite, and a pace that quietly climbs the longer you survive. Your high score persists between visits.

**▶ Play:** https://andreaisabelmontana.github.io/coil/

## Features

- **Smooth gliding** — movement is stepped on a fixed tick, but rendering interpolates between cells so the snake flows instead of snapping
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
