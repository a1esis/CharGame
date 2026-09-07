# Sound effects

The game ships silent by default (no bundled audio, so GitHub Pages has
nothing extra to fetch). Hooks are already wired up in `script.js` — search
for the `Sound` object.

To add sound:

1. Drop MP3 files here using these names:
   ```
   attack.mp3
   hit.mp3
   critical.mp3
   heal.mp3
   victory.mp3
   click.mp3
   ```
2. In `script.js`, flip `const AUDIO_ENABLED = false;` to `true`.

No other code changes are needed — `Sound.play('attack')` etc. are already
called at the right moments (move used, hit landed, crit, heal, victory,
button clicks).
