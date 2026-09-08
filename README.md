# mango sorbet candle

A tiny, atmospheric interactive page. A pixel-art cup of mango sorbet sits
in the dark with a lit birthday candle. Blow into your microphone and the
flame reacts — lean, flicker, shrink — and eventually goes out.

Pure static site — HTML/CSS/JS and the Canvas + Web Audio APIs. No build
step, no backend, no external assets. The whole scene is drawn procedurally
onto a small (180×240) offscreen canvas and scaled up with nearest-neighbor
interpolation for a genuinely low-res, pixelated look.

## Files

```
index.html   markup + the (nearly empty) UI chrome
style.css    dark theme, vignette, scanlines, layout
script.js    scene rendering, particles, mic analysis, audio, state machine
```

## Run it locally

```
npx serve .
```
or
```
python3 -m http.server
```

Then open the printed local address. Microphone access generally requires
a secure context (`https://` or `localhost`).

## Deploy to GitHub Pages

1. Push these files to the root of a GitHub repository (or a `/docs` folder).
2. Settings → Pages → Build and deployment → Source: **Deploy from a branch**.
3. Branch `main`, folder `/ (root)` → Save.

## How it works

- On the first tap, an `AudioContext` is created and `getUserMedia` is
  requested. If granted, ~0.85s of ambient microphone volume is sampled to
  set a noise-floor baseline.
- Each frame, the mic's RMS amplitude is compared against that baseline to
  produce a normalized 0–1 "blow strength," which drives the flame's lean,
  flicker, and size continuously (not just on/off).
- Sustained blow strength above a threshold accumulates a timer; once held
  long enough (~0.85s), the candle extinguishes — smoke particles spawn,
  the light dims, and a short generated "whoosh" plays.
- If the microphone is unavailable or denied, a "hold to blow" button drives
  the same strength value instead, so the experience still works.
- All sound (ember crackle, whoosh, ignite) is synthesized at runtime with
  the Web Audio API — no audio files.
- Tap the extinguished candle to relight it and try again.
