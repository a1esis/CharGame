/*
 * CHARACTER CLASH — game engine & UI
 * -----------------------------------
 * Depends on data.js being loaded first (CHARACTERS, ARENAS, STAGE_LABELS).
 * Organized in sections:
 *   1. Utilities (delay, rng, stage math, placeholder art, sound hooks)
 *   2. Battle engine (fighter state, damage calc, effects, AI, turn loop)
 *   3. Screen navigation
 *   4. Character-select UI
 *   5. Battle UI + animation glue
 *   6. Result screen + bootstrap
 */

(function () {
  "use strict";

  /* =======================================================
     1. UTILITIES
     ======================================================= */

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const rollPercent = (p) => Math.random() * 100 < p;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const AUDIO_ENABLED = false; // flip on once real files exist in assets/audio/
  const Sound = {
    // Hook points: play('attack' | 'hit' | 'critical' | 'heal' | 'victory' | 'click')
    // Wire up real files later by dropping assets/audio/<name>.mp3 and setting
    // AUDIO_ENABLED to true. Kept silent by default so v1 has no missing-file noise.
    play(name) {
      if (!AUDIO_ENABLED) return;
      try {
        const audio = new Audio(`assets/audio/${name}.mp3`);
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {
        /* no-op */
      }
    },
  };

  function svgPlaceholder(charData) {
    const bg1 = charData ? charData.color : "#555566";
    const bg2 = charData ? charData.colorDark : "#22222c";
    const emoji = charData ? charData.emoji : "❓";
    const initial = charData ? charData.name.charAt(0) : "?";
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/>` +
      `</linearGradient></defs>` +
      `<rect width="160" height="160" rx="26" fill="url(#g)"/>` +
      `<rect x="3" y="3" width="154" height="154" rx="23" fill="none" stroke="#00000033" stroke-width="4"/>` +
      `<text x="50%" y="60%" font-size="82" text-anchor="middle" dominant-baseline="middle">${emoji}</text>` +
      `<text x="14" y="30" font-size="20" fill="#ffffffbb" font-family="monospace" font-weight="bold">${initial}</text>` +
      `</svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  function setImageWithFallback(imgEl, charData) {
    imgEl.onerror = () => {
      imgEl.onerror = null;
      imgEl.src = svgPlaceholder(charData);
    };
    imgEl.src = `assets/characters/${charData.id}.png`;
    imgEl.alt = charData.name;
  }

  function tryLoadArenaBackground(arenaId, el) {
    const probe = new Image();
    probe.onload = () => {
      el.style.backgroundImage = `url("assets/backgrounds/${arenaId}.png")`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
    };
    probe.onerror = () => {
      el.style.backgroundImage = "";
    };
    probe.src = `assets/backgrounds/${arenaId}.png`;
  }

  function stageMultiplier(stage) {
    return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
  }

  /* =======================================================
     2. BATTLE ENGINE
     ======================================================= */

  function createFighter(charId) {
    const base = CHARACTERS.find((c) => c.id === charId);
    return {
      base,
      maxHP: base.stats.hp,
      currentHP: base.stats.hp,
      stages: { atk: 0, def: 0, spd: 0, spc: 0 },
      status: null, // { type: 'dot', turnsLeft, label }
      flinched: false,
    };
  }

  function effectiveStat(fighter, stat) {
    const base = fighter.base.stats[stat];
    const stage = fighter.stages[stat] || 0;
    return base * stageMultiplier(stage);
  }

  function changeStage(fighter, stat, delta) {
    const before = fighter.stages[stat];
    fighter.stages[stat] = clamp(before + delta, -6, 6);
    return fighter.stages[stat] - before;
  }

  function calcDamage(attacker, defender, move) {
    if (move.power <= 0) return { damage: 0, crit: false };
    const atkStat =
      move.category === "special" ? effectiveStat(attacker, "spc") : effectiveStat(attacker, "atk");
    const defStat = effectiveStat(defender, "def");
    const critBonus =
      move.effect && move.effect.type === "critBonus" ? move.effect.amount : 0;
    const isCrit = rollPercent(6.25 + critBonus);
    const randomFactor = 0.85 + Math.random() * 0.15;
    let raw = move.power * (atkStat / defStat) * 0.45 * randomFactor;
    if (isCrit) raw *= 1.5;
    return { damage: Math.max(1, Math.round(raw)), crit: isCrit };
  }

  // Applies a move's optional `effect` (and any chained `also`), pushing
  // structured entries onto `log` for the UI layer to animate/announce.
  function applyEffect(effect, ctx, log) {
    if (!effect) return;
    if (effect.chance !== undefined && !rollPercent(effect.chance)) return;

    switch (effect.type) {
      case "heal": {
        if (effect.onlyIfHit && !ctx.hit) break;
        const target = effect.target === "self" ? ctx.attacker : ctx.defender;
        const amount = Math.round(target.maxHP * effect.amount);
        const before = target.currentHP;
        target.currentHP = Math.min(target.maxHP, target.currentHP + amount);
        log.push({ type: "heal", target, amount: target.currentHP - before });
        break;
      }
      case "buffSelf": {
        const applied = changeStage(ctx.attacker, effect.stat, effect.stages);
        if (applied !== 0) {
          log.push({ type: "stage", target: ctx.attacker, stat: effect.stat, stages: applied });
        }
        break;
      }
      case "debuffTarget": {
        const applied = changeStage(ctx.defender, effect.stat, effect.stages);
        if (applied !== 0) {
          log.push({ type: "stage", target: ctx.defender, stat: effect.stat, stages: applied });
        }
        break;
      }
      case "dot": {
        ctx.defender.status = { type: "dot", turnsLeft: 3, label: effect.label || "Hurt" };
        log.push({ type: "dotApplied", target: ctx.defender, label: effect.label || "Hurt" });
        break;
      }
      case "flinch": {
        ctx.defender.flinched = true;
        log.push({ type: "flinch", target: ctx.defender });
        break;
      }
      case "critBonus":
      default:
        break;
    }

    if (effect.also) applyEffect(effect.also, ctx, log);
  }

  // --- AI decision making -------------------------------------------------
  function chooseAIMove(ai, opponent) {
    let best = null;
    let bestScore = -Infinity;

    ai.base.moves.forEach((move) => {
      const accFactor = move.accuracy / 100;
      let score = 0;

      if (move.power > 0) {
        const atkStat =
          move.category === "special" ? effectiveStat(ai, "spc") : effectiveStat(ai, "atk");
        const defStat = effectiveStat(opponent, "def");
        const estDamage = move.power * (atkStat / defStat) * 0.45 * 0.925;
        score = estDamage * accFactor;
        if (estDamage >= opponent.currentHP) score += 50; // lethal opportunity
      } else if (move.effect) {
        const hpRatio = ai.currentHP / ai.maxHP;
        const oppRatio = opponent.currentHP / opponent.maxHP;
        if (move.effect.type === "heal") {
          score = hpRatio < 0.5 ? 40 + (0.5 - hpRatio) * 100 : 5;
        } else if (move.effect.type === "buffSelf") {
          score = hpRatio < 0.25 ? 4 : 18;
        } else if (move.effect.type === "debuffTarget") {
          score = oppRatio < 0.25 ? 6 : 20;
        } else {
          score = 10;
        }
        score *= accFactor;
      }

      score += Math.random() * 8; // small noise so the AI isn't perfectly predictable

      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    });

    return best;
  }

  /* =======================================================
     3. APP STATE & SCREEN NAVIGATION
     ======================================================= */

  const state = {
    selectStep: 1,
    playerId: null,
    opponentId: null,
    candidateId: null,
    battle: null,
  };

  const $ = (id) => document.getElementById(id);

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
  }

  function transitionToScreen(id) {
    const t = $("screen-transition");
    t.classList.remove("wipe");
    void t.offsetWidth;
    t.classList.add("wipe");
    setTimeout(() => showScreen(id), 220);
  }

  function openModal(id) {
    $(id).classList.add("active");
  }
  function closeModal(id) {
    $(id).classList.remove("active");
  }

  /* =======================================================
     4. CHARACTER SELECT UI
     ======================================================= */

  function statMax() {
    return 145; // used to scale the stat preview bars
  }

  function renderRoster() {
    const grid = $("roster-grid");
    grid.innerHTML = "";
    CHARACTERS.forEach((c) => {
      const card = document.createElement("div");
      card.className = "roster-card";
      card.dataset.id = c.id;

      const isPlayerChoice = state.selectStep === 2 && c.id === state.playerId;
      if (isPlayerChoice) card.classList.add("disabled");
      if (state.candidateId === c.id) card.classList.add("selected");

      const img = document.createElement("img");
      setImageWithFallback(img, c);

      const name = document.createElement("span");
      name.className = "rc-name";
      name.textContent = c.name;

      const title = document.createElement("span");
      title.className = "rc-title";
      title.textContent = c.title;

      card.appendChild(img);
      card.appendChild(name);
      card.appendChild(title);

      if (isPlayerChoice) {
        const badge = document.createElement("span");
        badge.className = "rc-badge";
        badge.textContent = "YOU";
        card.appendChild(badge);
      }

      card.addEventListener("click", () => {
        if (isPlayerChoice) return;
        state.candidateId = c.id;
        renderRoster();
        renderPreview(c.id);
        $("btn-confirm").disabled = false;
      });

      grid.appendChild(card);
    });
  }

  function renderPreview(charId) {
    const c = CHARACTERS.find((ch) => ch.id === charId);
    if (!c) return;
    $("preview-panel").classList.remove("hidden");

    const portrait = $("preview-portrait");
    setImageWithFallback(portrait, c);

    $("preview-name").textContent = c.name;
    $("preview-title").textContent = c.title;
    $("preview-tagline").textContent = c.tagline;

    const statsWrap = $("preview-stats");
    statsWrap.innerHTML = "";
    const statOrder = [
      ["hp", "HP"],
      ["atk", "ATK"],
      ["def", "DEF"],
      ["spd", "SPD"],
      ["spc", "SPC"],
    ];
    statOrder.forEach(([key, label]) => {
      const val = c.stats[key];
      const row = document.createElement("div");
      row.className = "stat-bar-row";
      row.innerHTML =
        `<span class="sb-label">${label}</span>` +
        `<span class="stat-bar-track"><span class="stat-bar-fill" style="width:${clamp(
          (val / statMax()) * 100,
          4,
          100
        )}%"></span></span>` +
        `<span class="sb-val">${val}</span>`;
      statsWrap.appendChild(row);
    });

    const movesWrap = $("preview-moves");
    movesWrap.innerHTML = "";
    c.moves.forEach((m) => {
      const chip = document.createElement("div");
      chip.className = `move-chip cat-${m.category}`;
      chip.innerHTML = `<strong>${m.name}</strong><br>${
        m.power > 0 ? `PWR ${m.power} · ` : ""
      }ACC ${m.accuracy}%`;
      chip.title = m.description;
      movesWrap.appendChild(chip);
    });
  }

  function enterSelectStep(step) {
    state.selectStep = step;
    state.candidateId = null;
    $("preview-panel").classList.add("hidden");
    $("btn-confirm").disabled = true;
    $("btn-randomize").classList.toggle("hidden", step !== 2);
    $("btn-select-back").textContent = step === 1 ? "Back to Title" : "Back";

    if (step === 1) {
      $("select-title").textContent = "Choose Your Fighter";
      $("select-subtitle").textContent = "Tap a character to preview their stats and moves.";
    } else {
      $("select-title").textContent = "Choose Your Opponent";
      $("select-subtitle").textContent = "Who will " + CHARACTERS.find((c) => c.id === state.playerId).name + " face?";
    }
    renderRoster();
  }

  function handleSelectConfirm() {
    if (!state.candidateId) return;
    Sound.play("click");
    if (state.selectStep === 1) {
      state.playerId = state.candidateId;
      enterSelectStep(2);
    } else {
      state.opponentId = state.candidateId;
      startBattle(state.playerId, state.opponentId);
    }
  }

  function handleSelectBack() {
    Sound.play("click");
    if (state.selectStep === 2) {
      enterSelectStep(1);
    } else {
      transitionToScreen("screen-title");
    }
  }

  function handleRandomizeOpponent() {
    const pool = CHARACTERS.filter((c) => c.id !== state.playerId);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    state.candidateId = pick.id;
    renderRoster();
    renderPreview(pick.id);
    $("btn-confirm").disabled = false;
    Sound.play("click");
  }

  /* =======================================================
     5. BATTLE UI
     ======================================================= */

  function buildBattleState(playerId, opponentId) {
    const arena = ARENAS[Math.floor(Math.random() * ARENAS.length)];
    return {
      arena,
      player: createFighter(playerId),
      opponent: createFighter(opponentId),
      locked: true,
      over: false,
    };
  }

  function startBattle(playerId, opponentId) {
    state.battle = buildBattleState(playerId, opponentId);
    transitionToScreen("screen-battle");
    setTimeout(renderBattleInit, 240);
  }

  function renderBattleInit() {
    const b = state.battle;
    const arenaEl = $("battle-arena");
    arenaEl.className = "battle-arena arena-" + b.arena.id;
    arenaEl.style.backgroundImage = "";
    tryLoadArenaBackground(b.arena.id, arenaEl);

    setImageWithFallback($("player-sprite"), b.player.base);
    setImageWithFallback($("opp-sprite"), b.opponent.base);
    $("player-sprite").className = "sprite player-sprite";
    $("opp-sprite").className = "sprite opponent-sprite";

    $("player-name").textContent = b.player.base.name;
    $("opp-name").textContent = b.opponent.base.name;

    updateHPBar("player", b.player);
    updateHPBar("opp", b.opponent);
    renderStatusBadges("player", b.player);
    renderStatusBadges("opp", b.opponent);

    $("battle-log").innerHTML = "";
    logMessage(`The clash begins at ${b.arena.name}!`);
    logMessage(`${b.player.base.name} vs. ${b.opponent.base.name}. Go!`);

    b.locked = false;
    renderMovesGrid();
    showActionMenu();
    setTurnBanner("Choose your move!");
  }

  function setTurnBanner(text) {
    $("turn-banner").textContent = text;
  }

  function logMessage(html) {
    const log = $("battle-log");
    const p = document.createElement("p");
    p.innerHTML = html;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function updateHPBar(prefix, fighter) {
    const pct = clamp((fighter.currentHP / fighter.maxHP) * 100, 0, 100);
    const fill = $(`${prefix}-hp-fill`);
    fill.style.width = pct + "%";
    fill.classList.remove("mid", "low");
    if (pct <= 20) fill.classList.add("low");
    else if (pct <= 50) fill.classList.add("mid");
    $(`${prefix}-hp-text`).textContent = `${Math.max(0, Math.round(fighter.currentHP))}/${fighter.maxHP}`;
  }

  function renderStatusBadges(prefix, fighter) {
    const el = $(`${prefix}-status-badges`);
    el.innerHTML = "";
    Object.entries(fighter.stages).forEach(([stat, val]) => {
      if (!val) return;
      const span = document.createElement("span");
      span.className = "status-badge " + (val > 0 ? "buff" : "debuff");
      span.textContent = `${STAGE_LABELS[stat]}${val > 0 ? "▲" : "▼"}${
        Math.abs(val) > 1 ? "x" + Math.abs(val) : ""
      }`;
      el.appendChild(span);
    });
    if (fighter.status && fighter.status.type === "dot") {
      const span = document.createElement("span");
      span.className = "status-badge dot";
      span.textContent = fighter.status.label;
      el.appendChild(span);
    }
  }

  function renderMovesGrid() {
    const b = state.battle;
    const grid = $("moves-grid");
    grid.innerHTML = "";
    b.player.base.moves.forEach((move) => {
      const btn = document.createElement("button");
      btn.className = `move-btn cat-${move.category}`;
      btn.innerHTML =
        `<span class="move-name">${move.name}</span>` +
        `<span class="move-meta">${move.power > 0 ? `PWR ${move.power} · ` : "STATUS · "}ACC ${move.accuracy}%</span>`;
      btn.title = move.description;
      btn.addEventListener("click", () => handlePlayerMove(move));
      grid.appendChild(btn);
    });
  }

  function renderStatsMenu() {
    const b = state.battle;
    const wrap = $("stats-columns");
    wrap.innerHTML = "";
    [
      ["Your Fighter", b.player],
      ["Opponent", b.opponent],
    ].forEach(([label, fighter]) => {
      const col = document.createElement("div");
      col.className = "stats-col";
      const rows = ["atk", "def", "spd", "spc"]
        .map((stat) => {
          const eff = Math.round(effectiveStat(fighter, stat));
          const stage = fighter.stages[stat];
          const stageText = stage ? ` (${stage > 0 ? "+" : ""}${stage})` : "";
          return `<div class="sc-row"><span>${STAGE_LABELS[stat]}</span><span>${eff}${stageText}</span></div>`;
        })
        .join("");
      col.innerHTML = `<h4>${label} — ${fighter.base.name}</h4>${rows}`;
      wrap.appendChild(col);
    });
  }

  function showActionMenu() {
    $("action-menu").classList.remove("hidden");
    $("moves-menu").classList.add("hidden");
    $("stats-menu").classList.add("hidden");
    updateActionButtonsDisabled();
  }

  function updateActionButtonsDisabled() {
    const locked = state.battle.locked;
    $("btn-menu-fight").disabled = locked;
    $("btn-menu-forfeit").disabled = locked;
  }
  function showMovesMenu() {
    renderMovesGrid();
    updateMoveButtonsDisabled();
    $("action-menu").classList.add("hidden");
    $("moves-menu").classList.remove("hidden");
    $("stats-menu").classList.add("hidden");
  }
  function showStatsMenu() {
    renderStatsMenu();
    $("action-menu").classList.add("hidden");
    $("moves-menu").classList.add("hidden");
    $("stats-menu").classList.remove("hidden");
  }

  function updateMoveButtonsDisabled() {
    const disabled = state.battle.locked;
    document.querySelectorAll("#moves-grid .move-btn").forEach((btn) => (btn.disabled = disabled));
  }

  function handlePlayerMove(move) {
    const b = state.battle;
    if (b.locked || b.over) return;
    b.locked = true;
    updateMoveButtonsDisabled();
    Sound.play("click");
    showActionMenu();
    resolveRound(move);
  }

  function handleForfeit() {
    const b = state.battle;
    if (b.locked || b.over) return;
    b.locked = true;
    b.over = true;
    logMessage(`<strong>${b.player.base.name}</strong> forfeits the clash.`);
    setTurnBanner("Forfeited");
    setTimeout(() => endBattle(false), 700);
  }

  // --- Round resolution ----------------------------------------------------

  async function resolveRound(playerMove) {
    const b = state.battle;
    const aiMove = chooseAIMove(b.opponent, b.player);

    const playerSpeed = effectiveStat(b.player, "spd");
    const opponentSpeed = effectiveStat(b.opponent, "spd");
    let order;
    if (playerSpeed === opponentSpeed) {
      order = Math.random() < 0.5 ? ["player", "opponent"] : ["opponent", "player"];
    } else {
      order = playerSpeed > opponentSpeed ? ["player", "opponent"] : ["opponent", "player"];
    }

    for (const who of order) {
      const actor = who === "player" ? b.player : b.opponent;
      const target = who === "player" ? b.opponent : b.player;
      if (actor.currentHP <= 0 || target.currentHP <= 0) continue;

      const move = who === "player" ? playerMove : aiMove;
      setTurnBanner(who === "player" ? "Your turn!" : `${b.opponent.base.name}'s turn!`);
      await wait(350);

      await performAction(who, actor, target, move);

      if (target.currentHP <= 0) {
        await handleFaint(who === "player" ? "opponent" : "player");
        return;
      }
      if (actor.currentHP <= 0) {
        // shouldn't normally happen from own move, but guard anyway
        await handleFaint(who === "player" ? "player" : "opponent");
        return;
      }
    }

    await applyEndOfRoundStatus();
    if (b.over) return;

    b.locked = false;
    updateMoveButtonsDisabled();
    updateActionButtonsDisabled();
    setTurnBanner("Choose your move!");
  }

  async function performAction(who, actor, target, move) {
    const playerSide = who === "player";
    const actorSpriteId = playerSide ? "player-sprite" : "opp-sprite";
    const targetSpriteId = playerSide ? "opp-sprite" : "player-sprite";
    const targetPrefix = playerSide ? "opp" : "player";
    const actorPrefix = playerSide ? "player" : "opp";

    if (actor.flinched) {
      actor.flinched = false;
      logMessage(`<span class="log-miss">${actor.base.name} flinched and couldn't move!</span>`);
      await wait(600);
      return;
    }

    logMessage(`<strong>${actor.base.name}</strong> used <strong>${move.name}</strong>!`);

    const actorSprite = $(actorSpriteId);
    actorSprite.classList.add(playerSide ? "attack-lunge-right" : "attack-lunge-left");
    Sound.play("attack");
    await wait(400);
    actorSprite.classList.remove("attack-lunge-right", "attack-lunge-left");

    const hit = rollPercent(move.accuracy);
    if (!hit) {
      logMessage(`<span class="log-miss">It missed!</span>`);
      spawnDamageText(targetPrefix, "Miss!", "miss");
      await wait(500);
      return;
    }

    const log = [];
    let dealt = 0;

    if (move.power > 0) {
      const { damage, crit } = calcDamage(actor, target, move);
      dealt = damage;
      target.currentHP = clamp(target.currentHP - damage, 0, target.maxHP);
      updateHPBar(targetPrefix, target);

      const targetSprite = $(targetSpriteId);
      targetSprite.classList.remove("hit-flash");
      void targetSprite.offsetWidth;
      targetSprite.classList.add("hit-flash");
      spawnDamageText(targetPrefix, `-${damage}`, crit ? "crit" : "");
      if (crit) {
        logMessage(`<span class="log-crit">Critical hit!</span> It dealt ${damage} damage.`);
        shakeArena();
        Sound.play("critical");
      } else {
        logMessage(`It dealt ${damage} damage.`);
        Sound.play("hit");
      }
      if (damage / target.maxHP > 0.28) shakeArena();
      await wait(500);
    }

    applyEffect(move.effect, { attacker: actor, defender: target, hit }, log);

    for (const entry of log) {
      await announceEffect(entry, actorPrefix, targetPrefix);
    }
  }

  async function announceEffect(entry, actorPrefix, targetPrefix) {
    if (entry.type === "heal") {
      const prefix = entry.target === state.battle.player ? "player" : "opp";
      updateHPBar(prefix, entry.target);
      spawnDamageText(prefix, `+${entry.amount}`, "heal");
      logMessage(`<span class="log-effect">${entry.target.base.name} recovered ${entry.amount} HP.</span>`);
      Sound.play("heal");
      await wait(450);
    } else if (entry.type === "stage") {
      const prefix = entry.target === state.battle.player ? "player" : "opp";
      renderStatusBadges(prefix, entry.target);
      const dir = entry.stages > 0 ? "rose" : "fell";
      const label = STAGE_LABELS[entry.stat];
      spawnStatText(prefix, `${label} ${entry.stages > 0 ? "▲" : "▼"}`, entry.stages < 0);
      logMessage(`<span class="log-effect">${entry.target.base.name}'s ${label} ${dir}!</span>`);
      await wait(450);
    } else if (entry.type === "dotApplied") {
      const prefix = entry.target === state.battle.player ? "player" : "opp";
      renderStatusBadges(prefix, entry.target);
      logMessage(`<span class="log-effect">${entry.target.base.name} is affected by ${entry.label}!</span>`);
      await wait(400);
    } else if (entry.type === "flinch") {
      logMessage(`<span class="log-effect">${entry.target.base.name} flinched!</span>`);
      await wait(350);
    }
  }

  function spawnDamageText(prefix, text, kind) {
    // kind: '' (plain damage), 'crit', 'heal', or 'miss'
    const layer = $(`${prefix}-fx-layer`);
    const el = document.createElement("div");
    el.className = "dmg-number" + (kind ? " " + kind : "");
    el.textContent = text;
    el.style.left = 40 + Math.random() * 20 + "%";
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  function spawnStatText(prefix, text, isDebuff) {
    const layer = $(`${prefix}-fx-layer`);
    const el = document.createElement("div");
    el.className = "stat-fx" + (isDebuff ? " debuff" : "");
    el.textContent = text;
    el.style.left = 40 + Math.random() * 20 + "%";
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  function shakeArena() {
    const arena = $("battle-arena");
    arena.classList.remove("shake");
    void arena.offsetWidth;
    arena.classList.add("shake");
  }

  async function applyEndOfRoundStatus() {
    const b = state.battle;
    for (const [prefix, fighter] of [
      ["player", b.player],
      ["opp", b.opponent],
    ]) {
      if (fighter.status && fighter.status.type === "dot" && fighter.currentHP > 0) {
        const dmg = Math.round(fighter.maxHP * 0.08);
        fighter.currentHP = clamp(fighter.currentHP - dmg, 0, fighter.maxHP);
        updateHPBar(prefix, fighter);
        spawnDamageText(prefix, `-${dmg}`, "");
        logMessage(`<span class="log-effect">${fighter.base.name} is hurt by ${fighter.status.label}! (-${dmg})</span>`);
        fighter.status.turnsLeft -= 1;
        if (fighter.status.turnsLeft <= 0) fighter.status = null;
        renderStatusBadges(prefix, fighter);
        await wait(500);
        if (fighter.currentHP <= 0) {
          await handleFaint(prefix === "player" ? "player" : "opponent");
          return;
        }
      }
    }
  }

  async function handleFaint(side) {
    const b = state.battle;
    b.over = true;
    const faintedFighter = side === "player" ? b.player : b.opponent;
    const spriteId = side === "player" ? "player-sprite" : "opp-sprite";
    const winnerFighter = side === "player" ? b.opponent : b.player;
    const winnerSpriteId = side === "player" ? "opp-sprite" : "player-sprite";

    logMessage(`<strong>${faintedFighter.base.name}</strong> is knocked out!`);
    $(spriteId).classList.add("faint-anim");
    setTurnBanner(`${winnerFighter.base.name} wins!`);
    await wait(700);
    $(winnerSpriteId).classList.add("victory-anim");
    Sound.play("victory");
    await wait(700);
    endBattle(side !== "player");
  }

  function endBattle(playerWon) {
    const b = state.battle;
    const title = $("result-title");
    const subtitle = $("result-subtitle");
    title.classList.toggle("defeat", !playerWon);
    title.textContent = playerWon ? "VICTORY!" : "DEFEAT";
    subtitle.textContent = playerWon
      ? `${b.player.base.name} defeated ${b.opponent.base.name}!`
      : `${b.opponent.base.name} defeated ${b.player.base.name}...`;
    openModal("modal-result");
  }

  /* =======================================================
     6. RESULT / BOOTSTRAP
     ======================================================= */

  function handleRematch() {
    closeModal("modal-result");
    startBattle(state.playerId, state.opponentId);
  }

  function handleNewFighters() {
    closeModal("modal-result");
    state.playerId = null;
    state.opponentId = null;
    transitionToScreen("screen-select");
    setTimeout(() => enterSelectStep(1), 240);
  }

  function handleMainMenu() {
    closeModal("modal-result");
    state.playerId = null;
    state.opponentId = null;
    transitionToScreen("screen-title");
  }

  function wireEvents() {
    $("btn-start").addEventListener("click", () => {
      Sound.play("click");
      transitionToScreen("screen-select");
      setTimeout(() => enterSelectStep(1), 240);
    });
    $("btn-howto").addEventListener("click", () => {
      Sound.play("click");
      openModal("modal-howto");
    });
    $("btn-close-howto").addEventListener("click", () => closeModal("modal-howto"));
    $("modal-howto").addEventListener("click", (e) => {
      if (e.target.id === "modal-howto") closeModal("modal-howto");
    });

    $("btn-confirm").addEventListener("click", handleSelectConfirm);
    $("btn-select-back").addEventListener("click", handleSelectBack);
    $("btn-randomize").addEventListener("click", handleRandomizeOpponent);

    $("btn-menu-fight").addEventListener("click", () => {
      Sound.play("click");
      showMovesMenu();
    });
    $("btn-menu-stats").addEventListener("click", () => {
      Sound.play("click");
      showStatsMenu();
    });
    $("btn-menu-forfeit").addEventListener("click", handleForfeit);
    $("btn-moves-back").addEventListener("click", () => {
      Sound.play("click");
      showActionMenu();
    });
    $("btn-stats-back").addEventListener("click", () => {
      Sound.play("click");
      showActionMenu();
    });

    $("btn-rematch").addEventListener("click", handleRematch);
    $("btn-new-fighters").addEventListener("click", handleNewFighters);
    $("btn-main-menu").addEventListener("click", handleMainMenu);
  }

  function init() {
    wireEvents();
    showScreen("screen-title");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
