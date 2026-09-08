/*
 * mango sorbet candle
 * a tiny pixel-art scene rendered at low native resolution and scaled up
 * with nearest-neighbor upscaling for a genuinely blocky, low-fi look.
 */

(function () {
  "use strict";

  const RENDER_W = 180;
  const RENDER_H = 240;

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const stage = document.getElementById("stage");
  const intro = document.getElementById("intro");
  const hintEl = document.getElementById("hint");
  const messageEl = document.getElementById("message");
  const blowBtn = document.getElementById("blow-btn");

  // ---------------------------------------------------------------
  // scene geometry (low-res pixel coordinates)
  // ---------------------------------------------------------------
  const CUP_CX = 90;
  const CUP_RIM_Y = 139;
  const CUP_RIM_HALF = 38;
  const BOWL_BOTTOM_Y = 182;
  const BOWL_NECK_HALF = 8;

  const STEM_BOTTOM_Y = 212;
  const STEM_HALF_W = 3;

  const FOOT_Y = 214;
  const FOOT_HALF_W = 24;
  const FOOT_HALF_H = 4;
  const CUP_BASE_Y = FOOT_Y + FOOT_HALF_H;

  const SORBET_APEX_Y = 100;
  const SORBET_RIM_HALF = CUP_RIM_HALF + 2;

  const WAX_TOP_Y = 64;
  const WAX_BOTTOM_Y = 106;
  const WAX_HALF_W = 4;

  const WICK_TOP_Y = 53;
  const FLAME_X = CUP_CX;
  const FLAME_BASE_Y = WICK_TOP_Y;

  const LIGHT_CX = CUP_CX;
  const LIGHT_CY = 118;

  // ---------------------------------------------------------------
  // static layer — only the candle body never changes frame to frame,
  // so it's drawn once onto an offscreen canvas and blitted each tick.
  // the sorbet + glass are drawn fresh every frame since their shading
  // reacts live to the candle's flame intensity.
  // ---------------------------------------------------------------
  const staticLayer = document.createElement("canvas");
  staticLayer.width = RENDER_W;
  staticLayer.height = RENDER_H;
  const sctx = staticLayer.getContext("2d");

  function buildStaticLayer() {
    sctx.clearRect(0, 0, RENDER_W, RENDER_H);
    drawCandleBody(sctx);
  }

  function lerp3(c1, c2, t) {
    return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
  }

  const SORBET_DEEP = [104, 48, 32];
  const SORBET_SHADOW = [176, 82, 42];
  const SORBET_MID = [237, 144, 64];
  const SORBET_HILITE = [255, 214, 132];
  const SORBET_GLOW = [255, 236, 192];

  function sorbetColorAt(brightness) {
    if (brightness < 0.33) return lerp3(SORBET_DEEP, SORBET_SHADOW, brightness / 0.33);
    if (brightness < 0.68) return lerp3(SORBET_SHADOW, SORBET_MID, (brightness - 0.33) / 0.35);
    return lerp3(SORBET_MID, SORBET_HILITE, Math.min(1, (brightness - 0.68) / 0.32));
  }

  // sorbet: a single rounded, spherically-shaded scoop overflowing a
  // straight-walled lower body, lit primarily from upper-left with a
  // second warm contribution from the candle flame directly above it.
  // half-width of the glass bowl at row y (rim down to the narrow neck
  // where it meets the stem) — a concave taper reads as a rounded,
  // footed dessert bowl rather than a straight-sided cup.
  function bowlHalfWidth(y) {
    const ct = clamp((y - CUP_RIM_Y) / (BOWL_BOTTOM_Y - CUP_RIM_Y), 0, 1);
    return BOWL_NECK_HALF + (CUP_RIM_HALF - BOWL_NECK_HALF) * Math.pow(1 - ct, 0.6);
  }

  function drawSorbet(g, flameIntensity, flameLean) {
    const top = SORBET_APEX_Y;
    const bottom = BOWL_BOTTOM_Y;
    const totalRows = bottom - top;
    const glowCX = CUP_CX + flameLean * 4;
    const glowCY = SORBET_APEX_Y + 6;
    const glowRadius = SORBET_RIM_HALF * 1.4;

    for (let i = 0; i < totalRows; i++) {
      const y = top + i;
      const t = i / totalRows;
      let halfW;
      if (y < CUP_RIM_Y) {
        const dt = (y - SORBET_APEX_Y) / (CUP_RIM_Y - SORBET_APEX_Y);
        const edge = 1 - dt;
        halfW = Math.max(1, SORBET_RIM_HALF * Math.sqrt(Math.max(0, 1 - edge * edge)));
      } else {
        halfW = bowlHalfWidth(y);
      }
      const verticalFactor = 1 - t * 0.62;

      for (let x = -halfW; x < halfW; x++) {
        const px = Math.round(CUP_CX + x);
        const xNorm = x / halfW;
        const biasedX = clamp(xNorm + 0.22, -1, 1);
        const horizontalFactor = 1 - Math.pow(Math.abs(biasedX), 1.6) * 0.75;
        let brightness = clamp(verticalFactor * horizontalFactor, 0, 1);

        const dx = px - glowCX;
        const dy = y - glowCY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const glow = Math.max(0, 1 - dist / glowRadius) * flameIntensity * 0.5;
        brightness = clamp(brightness + glow, 0, 1);

        let [r, gg, b] = sorbetColorAt(brightness);
        if (glow > 0.15) {
          const gt = Math.min(1, (glow - 0.15) / 0.5);
          [r, gg, b] = lerp3([r, gg, b], SORBET_GLOW, gt * 0.4);
        }

        // fixed (non-shimmering) fleck texture — icy sparkle / pulp specks
        const fleckSeed = (px * 7 + y * 13) % 23;
        if (fleckSeed === 0) {
          r = Math.min(255, r + 30);
          gg = Math.min(255, gg + 26);
          b = Math.min(255, b + 14);
        } else if (fleckSeed === 11) {
          r = Math.max(0, r - 22);
          gg = Math.max(0, gg - 18);
          b = Math.max(0, b - 10);
        }

        g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
        g.fillRect(px, y, 1, 1);
      }
    }
  }

  // clear glass overlay: the footed bowl below the rim, a thin stem,
  // and a flared foot — the scoop above the rim is bare food, uncovered.
  function drawGlass(g) {
    const rows = BOWL_BOTTOM_Y - CUP_RIM_Y;
    for (let i = 0; i < rows; i++) {
      const y = CUP_RIM_Y + i;
      const ct = i / rows;
      const half = bowlHalfWidth(y);
      const left = Math.round(CUP_CX - half);
      const width = Math.round(half * 2);

      g.fillStyle = "rgba(214,228,232,0.05)";
      g.fillRect(left, y, width, 1);

      const streakOpacity = Math.max(0, 0.36 * (1 - Math.abs(ct - 0.38) * 1.1));
      g.fillStyle = `rgba(255,255,255,${streakOpacity})`;
      g.fillRect(Math.round(CUP_CX - half * 0.55), y, 2, 1);
      g.fillStyle = `rgba(255,255,255,${streakOpacity * 0.32})`;
      g.fillRect(Math.round(CUP_CX + half * 0.7), y, 1, 1);

      g.fillStyle = "rgba(15,10,6,0.45)";
      g.fillRect(left, y, 1, 1);
      g.fillRect(left + width - 1, y, 1, 1);
    }
    g.fillStyle = "rgba(255,255,255,0.32)";
    g.fillRect(CUP_CX - CUP_RIM_HALF, CUP_RIM_Y, CUP_RIM_HALF * 2, 1);

    // stem
    const stemRows = STEM_BOTTOM_Y - BOWL_BOTTOM_Y;
    for (let i = 0; i < stemRows; i++) {
      const y = BOWL_BOTTOM_Y + i;
      g.fillStyle = "rgba(220,232,236,0.12)";
      g.fillRect(Math.round(CUP_CX - STEM_HALF_W), y, Math.round(STEM_HALF_W * 2), 1);
      g.fillStyle = "rgba(255,255,255,0.4)";
      g.fillRect(Math.round(CUP_CX - STEM_HALF_W * 0.4), y, 1, 1);
      g.fillStyle = "rgba(15,10,6,0.4)";
      g.fillRect(Math.round(CUP_CX - STEM_HALF_W), y, 1, 1);
      g.fillRect(Math.round(CUP_CX + STEM_HALF_W), y, 1, 1);
    }

    // foot — a flattened ellipse the stem plants into
    g.beginPath();
    g.ellipse(CUP_CX, FOOT_Y, FOOT_HALF_W, FOOT_HALF_H, 0, 0, Math.PI * 2);
    g.fillStyle = "rgba(220,232,236,0.14)";
    g.fill();
    g.beginPath();
    g.ellipse(CUP_CX, FOOT_Y, FOOT_HALF_W, FOOT_HALF_H, 0, 0, Math.PI * 2);
    g.strokeStyle = "rgba(15,10,6,0.4)";
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.45)";
    g.beginPath();
    g.ellipse(CUP_CX, FOOT_Y - 0.6, FOOT_HALF_W * 0.82, FOOT_HALF_H * 0.55, 0, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
  }

  // a small metal spoon resting on the surface beside the glass
  function drawSpoon(g) {
    g.save();
    g.translate(CUP_CX + FOOT_HALF_W + 7, FOOT_Y - 4);
    g.rotate(-0.3);

    // contact shadow
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(6, 2.5, 15, 3, 0, 0, Math.PI * 2);
    g.fill();

    const handleLen = 22;
    g.fillStyle = "rgba(21,19,23,0.9)";
    g.fillRect(0, -1.2, handleLen, 2.4);
    g.beginPath();
    g.arc(handleLen, 0, 1.3, 0, Math.PI * 2);
    g.fill();

    g.beginPath();
    g.ellipse(-5, 0, 6.5, 3.8, 0, 0, Math.PI * 2);
    g.fillStyle = "rgba(24,22,26,0.92)";
    g.fill();

    g.fillStyle = "rgba(255,255,255,0.22)";
    g.beginPath();
    g.ellipse(-6.3, -1.1, 2.4, 1, -0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.13)";
    g.fillRect(5, -0.5, handleLen - 8, 1);

    g.restore();
  }

  function drawCandleBody(g) {
    g.fillStyle = "rgba(230,220,196,0.95)";
    g.fillRect(CUP_CX - WAX_HALF_W, WAX_TOP_Y, WAX_HALF_W * 2, WAX_BOTTOM_Y - WAX_TOP_Y);
    g.fillStyle = "rgba(178,164,128,0.6)";
    g.fillRect(CUP_CX + WAX_HALF_W - 1, WAX_TOP_Y, 1, WAX_BOTTOM_Y - WAX_TOP_Y);
    g.fillStyle = "rgba(255,240,214,0.5)";
    g.fillRect(CUP_CX - WAX_HALF_W, WAX_TOP_Y, 1, WAX_BOTTOM_Y - WAX_TOP_Y);
    g.fillStyle = "rgba(40,26,14,0.9)";
    g.fillRect(CUP_CX - 1, WICK_TOP_Y, 1, WAX_TOP_Y - WICK_TOP_Y + 2);
  }

  buildStaticLayer();

  // ---------------------------------------------------------------
  // flame + fire state
  // ---------------------------------------------------------------
  const flame = {
    alive: true,
    intensity: 1,
    lean: 0,
    targetLean: 0,
    flickerX: 0,
  };
  let emberGlow = 0;
  let blowTimer = 0;
  const EXTINGUISH_STRENGTH = 0.45;
  const EXTINGUISH_HOLD = 0.32;

  // ---------------------------------------------------------------
  // particles
  // ---------------------------------------------------------------
  const dust = [];
  for (let i = 0; i < 9; i++) {
    dust.push({
      x: LIGHT_CX + (Math.random() - 0.5) * 90,
      y: LIGHT_CY + (Math.random() - 0.5) * 90,
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.2,
      drift: 3 + Math.random() * 8,
    });
  }

  let smoke = [];
  let smokeTrickleUntil = 0;
  let lastTrickle = 0;

  function spawnSmokeBurst() {
    for (let i = 0; i < 10; i++) {
      smoke.push(makeSmokeParticle());
    }
    smokeTrickleUntil = performance.now() + 2600;
  }

  function makeSmokeParticle() {
    const maxLife = 1.4 + Math.random() * 1.6;
    return {
      x: FLAME_X + (Math.random() - 0.5) * 3,
      y: FLAME_BASE_Y - Math.random() * 3,
      vx: (Math.random() - 0.5) * 3,
      vy: -(6 + Math.random() * 7),
      life: maxLife,
      maxLife,
      size: 1 + Math.random() * 1.5,
    };
  }

  // ---------------------------------------------------------------
  // audio: microphone analysis
  // ---------------------------------------------------------------
  let actx = null;
  let analyser = null;
  let micData = null;
  let micActive = false;
  let micBaseline = 0.01;
  let micSmoothed = 0.01;

  let fallbackActive = false;
  let fallbackPressed = false;
  let fallbackStrength = 0;

  function getMicRMS() {
    analyser.getByteTimeDomainData(micData);
    let sumSquares = 0;
    for (let i = 0; i < micData.length; i++) {
      const v = (micData[i] - 128) / 128;
      sumSquares += v * v;
    }
    return Math.sqrt(sumSquares / micData.length);
  }

  function calibrate() {
    return new Promise((resolve) => {
      const samples = [];
      const start = performance.now();
      function sample() {
        samples.push(getMicRMS());
        if (performance.now() - start < 850) {
          setTimeout(sample, 25);
        } else {
          samples.sort((a, b) => a - b);
          const median = samples[Math.floor(samples.length / 2)] || 0.008;
          micBaseline = Math.max(median, 0.004);
          micSmoothed = micBaseline;
          resolve();
        }
      }
      sample();
    });
  }

  async function initMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const source = actx.createMediaStreamSource(stream);
      analyser = actx.createAnalyser();
      analyser.fftSize = 1024;
      micData = new Uint8Array(analyser.fftSize);
      source.connect(analyser);
      micActive = true;
      await calibrate();
      return true;
    } catch (e) {
      return false;
    }
  }

  function currentMicStrength() {
    const raw = getMicRMS();
    micSmoothed += (raw - micSmoothed) * 0.45;
    const floor = micBaseline + 0.008;
    const ceiling = Math.max(micBaseline * 5, 0.12);
    return clamp((micSmoothed - floor) / (ceiling - floor), 0, 1);
  }

  // ---------------------------------------------------------------
  // audio: tiny generated sound effects (no external files)
  // ---------------------------------------------------------------

  function playWhoosh() {
    if (!actx) return;
    const dur = 0.55;
    const bufferSize = Math.floor(actx.sampleRate * dur);
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = actx.createBufferSource();
    src.buffer = buffer;
    const filter = actx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2600, actx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(180, actx.currentTime + dur);
    const gain = actx.createGain();
    gain.gain.setValueAtTime(0.2, actx.currentTime);
    gain.gain.linearRampToValueAtTime(0, actx.currentTime + dur);
    src.connect(filter).connect(gain).connect(actx.destination);
    src.start();
  }

  function playIgnite() {
    if (!actx) return;
    const osc = actx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, actx.currentTime + 0.25);
    const gain = actx.createGain();
    gain.gain.setValueAtTime(0.12, actx.currentTime);
    gain.gain.linearRampToValueAtTime(0, actx.currentTime + 0.28);
    osc.connect(gain).connect(actx.destination);
    osc.start();
    osc.stop(actx.currentTime + 0.3);
  }

  // ---------------------------------------------------------------
  // state machine
  // ---------------------------------------------------------------
  let sceneState = "intro"; // intro | lit | extinguished
  let hintTimer = null;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  async function begin() {
    intro.classList.add("hidden");
    let ok = false;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") await actx.resume();
      ok = await initMic();
    } catch (e) {
      ok = false;
    }
    sceneState = "lit";

    if (ok) {
      hintEl.style.opacity = "1";
      hintTimer = setTimeout(() => {
        hintEl.style.opacity = "0";
      }, 6000);
    } else {
      fallbackActive = true;
      blowBtn.classList.remove("hidden");
    }
  }

  function extinguish() {
    if (sceneState !== "lit") return;
    sceneState = "extinguished";
    flame.alive = false;
    emberGlow = 1;
    spawnSmokeBurst();
    playWhoosh();
    if (hintTimer) clearTimeout(hintTimer);
    hintEl.style.opacity = "0";
    setTimeout(() => {
      messageEl.textContent = "you did it.";
      messageEl.style.opacity = "1";
      setTimeout(() => {
        messageEl.textContent = "you did it. — tap to relight";
      }, 2600);
    }, 1100);
  }

  function relight() {
    if (sceneState !== "extinguished") return;
    sceneState = "lit";
    flame.alive = true;
    flame.intensity = 0;
    flame.lean = 0;
    blowTimer = 0;
    emberGlow = 0;
    smoke = [];
    micSmoothed = micBaseline;
    fallbackStrength = 0;
    messageEl.style.opacity = "0";
    playIgnite();
    setTimeout(() => {
      messageEl.textContent = "";
    }, 1450);
  }

  intro.addEventListener("click", begin, { once: true });

  stage.addEventListener("click", (e) => {
    if (e.target === blowBtn) return;
    if (sceneState === "extinguished") relight();
  });

  function pressStart(e) {
    e.preventDefault();
    fallbackPressed = true;
  }
  function pressEnd() {
    fallbackPressed = false;
  }
  blowBtn.addEventListener("pointerdown", pressStart);
  blowBtn.addEventListener("pointerup", pressEnd);
  blowBtn.addEventListener("pointerleave", pressEnd);
  blowBtn.addEventListener("pointercancel", pressEnd);

  // ---------------------------------------------------------------
  // update
  // ---------------------------------------------------------------
  function update(dt, now) {
    // dust drifts quietly regardless of state
    for (const d of dust) {
      d.phase += dt * d.speed;
      d.y -= dt * 2;
      if (d.y < LIGHT_CY - 70) {
        d.y = LIGHT_CY + 60 + Math.random() * 20;
        d.x = LIGHT_CX + (Math.random() - 0.5) * 90;
      }
    }

    if (fallbackActive) {
      const rate = fallbackPressed ? 1 / 0.55 : -1 / 0.3;
      fallbackStrength = clamp(fallbackStrength + rate * dt, 0, 1);
    }

    let strength = 0;
    if (sceneState === "lit") {
      if (fallbackActive) strength = fallbackStrength;
      else if (micActive) strength = currentMicStrength();
    }

    if (sceneState === "lit") {
      flame.targetLean = clamp(strength * 1.4, 0, 1);
      flame.lean = lerp(flame.lean, flame.targetLean, 0.18);

      const idle = Math.sin(now * 0.009) * 0.6 + Math.sin(now * 0.017 + 1.3) * 0.4;
      const blowJitter = (Math.random() - 0.5) * strength * 9;
      flame.flickerX = idle * (0.5 + strength * 1.5) + blowJitter;

      const targetIntensity = 1 - strength * 0.82;
      flame.intensity = lerp(flame.intensity, targetIntensity, 0.16);

      if (strength > EXTINGUISH_STRENGTH) {
        blowTimer += dt;
      } else {
        blowTimer = Math.max(0, blowTimer - dt * 1.1);
      }
      if (blowTimer >= EXTINGUISH_HOLD) {
        extinguish();
      }
    } else if (sceneState === "extinguished") {
      flame.intensity = lerp(flame.intensity, 0, 0.2);
      emberGlow = Math.max(0, emberGlow - dt * 0.55);
    }

    // smoke
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.life -= dt;
      if (p.life <= 0) {
        smoke.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt + Math.sin(now * 0.004 + i) * 0.15;
      p.y += p.vy * dt;
      p.vy *= 0.985;
    }
    if (sceneState === "extinguished" && performance.now() < smokeTrickleUntil) {
      if (now - lastTrickle > 550) {
        lastTrickle = now;
        smoke.push(makeSmokeParticle());
      }
    }
  }

  // ---------------------------------------------------------------
  // render
  // ---------------------------------------------------------------
  function render(now) {
    ctx.fillStyle = "#050403";
    ctx.fillRect(0, 0, RENDER_W, RENDER_H);

    const effectiveLight = Math.max(flame.intensity, emberGlow * 0.3);
    const pulse = 1 + Math.sin(now * 0.003) * 0.03;

    // light pool
    if (effectiveLight > 0.01) {
      const r = (118 + flame.lean * 6) * effectiveLight * pulse + 6;
      const grad = ctx.createRadialGradient(LIGHT_CX, LIGHT_CY, 0, LIGHT_CX, LIGHT_CY, r);
      grad.addColorStop(0, `rgba(255,176,92,${0.55 * effectiveLight})`);
      grad.addColorStop(0.45, `rgba(230,130,60,${0.28 * effectiveLight})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, RENDER_W, RENDER_H);
    }

    // dust
    for (const d of dust) {
      const twinkle = (Math.sin(d.phase) + 1) / 2;
      const a = twinkle * 0.35 * effectiveLight;
      if (a <= 0.02) continue;
      ctx.fillStyle = `rgba(255,210,150,${a})`;
      ctx.fillRect(Math.round(d.x + Math.sin(d.phase * 0.6) * d.drift * 0.1), Math.round(d.y), 1, 1);
    }

    drawSorbet(ctx, effectiveLight, flame.lean);
    drawGlass(ctx);
    drawSpoon(ctx);
    ctx.drawImage(staticLayer, 0, 0);

    // flame
    if (flame.intensity > 0.02) {
      drawFlame(ctx, flame.intensity, flame.lean, flame.flickerX);
    } else if (emberGlow > 0.02) {
      ctx.fillStyle = `rgba(255,120,50,${emberGlow * 0.8})`;
      ctx.fillRect(FLAME_X - 1, FLAME_BASE_Y - 1, 2, 2);
    }

    // smoke
    for (const p of smoke) {
      const a = (p.life / p.maxLife) * 0.3;
      const size = p.size + (1 - p.life / p.maxLife) * 3;
      ctx.fillStyle = `rgba(200,196,190,${a})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, size, size, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ambient darkening when candle is out
    const lightLevel = Math.max(effectiveLight, 0.15);
    const darkAlpha = (1 - lightLevel) * 0.5;
    if (darkAlpha > 0.01) {
      ctx.fillStyle = `rgba(2,1,1,${darkAlpha})`;
      ctx.fillRect(0, 0, RENDER_W, RENDER_H);
    }

    drawGrain(ctx);
  }

  function drawFlame(g, intensity, lean, jitter) {
    const baseX = FLAME_X;
    const baseY = FLAME_BASE_Y;
    const h = 20 * intensity;
    const leanPx = lean * 11;
    const tipX = baseX + leanPx + jitter;
    const tipY = baseY - h * (1 - lean * 0.25);
    const widen = 1 + lean * 0.6;
    const widthBase = 6.5 * (0.55 + 0.45 * intensity) * widen;

    const glowR = 26 * intensity;
    const glow = g.createRadialGradient(baseX, baseY - h * 0.4, 0, baseX, baseY - h * 0.4, glowR);
    glow.addColorStop(0, `rgba(255,180,90,${0.3 * intensity})`);
    glow.addColorStop(1, "rgba(255,140,60,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(baseX, baseY - h * 0.4, glowR, 0, Math.PI * 2);
    g.fill();

    g.beginPath();
    g.moveTo(baseX - widthBase / 2, baseY);
    g.quadraticCurveTo(baseX - widthBase / 2 - 1 + leanPx * 0.3, baseY - h * 0.5, tipX, tipY);
    g.quadraticCurveTo(baseX + widthBase / 2 + 1 + leanPx * 0.3, baseY - h * 0.5, baseX + widthBase / 2, baseY);
    g.closePath();
    g.fillStyle = "rgba(226,116,40,0.92)";
    g.fill();

    const innerH = h * 0.62;
    const innerW = widthBase * 0.5;
    const innerTipX = baseX + leanPx * 1.15 + jitter * 1.15;
    const innerTipY = baseY - innerH - 2;
    g.beginPath();
    g.moveTo(baseX - innerW / 2, baseY - 1);
    g.quadraticCurveTo(baseX - innerW / 2 + leanPx * 0.3, baseY - innerH * 0.5, innerTipX, innerTipY);
    g.quadraticCurveTo(baseX + innerW / 2 + leanPx * 0.3, baseY - innerH * 0.5, baseX + innerW / 2, baseY - 1);
    g.closePath();
    g.fillStyle = "rgba(255,210,118,0.95)";
    g.fill();

    g.beginPath();
    g.ellipse(
      baseX + leanPx * 0.6,
      baseY - h * 0.22,
      Math.max(1, innerW * 0.2),
      Math.max(1.4, innerH * 0.26),
      0,
      0,
      Math.PI * 2
    );
    g.fillStyle = "rgba(255,245,214,0.9)";
    g.fill();
  }

  function drawGrain(g) {
    for (let i = 0; i < 46; i++) {
      const x = (Math.random() * RENDER_W) | 0;
      const y = (Math.random() * RENDER_H) | 0;
      const light = Math.random() > 0.5;
      g.fillStyle = light ? `rgba(255,255,255,${Math.random() * 0.05})` : `rgba(0,0,0,${Math.random() * 0.09})`;
      g.fillRect(x, y, 1, 1);
    }
  }

  // ---------------------------------------------------------------
  // responsive scaling of the low-res canvas (nearest-neighbor upscale)
  // ---------------------------------------------------------------
  function fitCanvas() {
    const scale = Math.min(window.innerWidth / RENDER_W, window.innerHeight / RENDER_H) * 0.94;
    canvas.style.width = Math.round(RENDER_W * scale) + "px";
    canvas.style.height = Math.round(RENDER_H * scale) + "px";
  }
  window.addEventListener("resize", fitCanvas);
  window.addEventListener("orientationchange", fitCanvas);
  fitCanvas();

  // ---------------------------------------------------------------
  // main loop
  // ---------------------------------------------------------------
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    update(dt, now);
    render(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
