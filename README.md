# Character Clash

An original turn-based battle game for the browser, inspired by classic
handheld monster-battle RPGs but with its own characters, moves, art, and
UI. Pick a fighter from a roster of 8 original/parody characters, pick an
opponent, and battle it out with 4 unique moves each.

Pure static site — plain HTML/CSS/JS, no build step, no backend, no
database. Runs anywhere, including GitHub Pages.

## Files

```
index.html   Screens (title, character select, battle, results)
style.css    All visual styling and animation
data.js      Character stats, moves, and arena definitions — edit freely
script.js    Battle engine, AI, and UI wiring
assets/
  characters/   Character art (falls back to a generated placeholder)
  backgrounds/  Arena art (falls back to a CSS gradient)
  audio/        Sound effects (silent by default, easy to enable)
```

## Run it locally

Any static file server works:

```
npx serve .
```
or
```
python3 -m http.server
```

Then open the printed local address in your browser.

## Deploy to GitHub Pages

1. Push this folder's contents to the root of a GitHub repository (or to a
   `/docs` folder).
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Pick the branch (usually `main`) and folder (`/root` or `/docs`).
5. Save — GitHub gives you a URL like `https://username.github.io/repo/`.

## Customizing

- **Rebalance or add moves/characters:** edit `data.js`. Nothing else needs
  to change — the roster grid, move buttons, and AI all read from it.
- **Real artwork:** see `assets/characters/README.md` and
  `assets/backgrounds/README.md` for exact filenames.
- **Sound:** see `assets/audio/README.md`.

## How battles work

- Both fighters pick a move each round; whoever has higher effective Speed
  acts first.
- Damage scales with the move's power and category (physical uses Attack,
  special uses Special) against the target's Defense, with a small random
  variance and a 6.25% base critical-hit chance.
- Moves can also heal, raise/lower stats for a number of stages, apply a
  damage-over-time effect, or cause a one-turn flinch.
- The AI opponent scores each of its available moves (expected damage,
  lethal potential, healing need, buff/debuff value) and picks the best one,
  with a little randomness so it isn't perfectly predictable.
