/**
 * Cyber Circuit: Mainframe Breach — Professional Studio Engine
 */

class CyberCircuit {
  constructor() {
    this.audio = new PuzzleAudio();
    this.currentLevelIndex = 1;
    this.level = null;
    this.size = 4;
    this.grid = []; // [r][c] -> { type: "empty"|"blocker"|"endpoint", color, partner }
    this.paths = new Map(); // colorId -> [[r, c], ...]
    this.completedColors = new Set();
    this.activeColor = null;
    this.activePath = null;
    this.isPointerDown = false;
    this.moveCount = 0;
    this.history = []; // stack of Map snapshots
    this.electronPhase = 0;
    this.fxParticles = [];

    // Safe Storage Initialization
    const rawLvl = parseInt(this.storageGet("cc_unlocked_level", "1"), 10);
    this.unlockedLevel = (!isNaN(rawLvl) && rawLvl >= 1) ? rawLvl : 1;
    try {
      const rawStars = this.storageGet("cc_level_stars", "{}");
      this.levelStars = typeof rawStars === "string" ? JSON.parse(rawStars) : (rawStars || {});
    } catch (_) {
      this.levelStars = {};
    }

    this.initDOM();
    this.initCanvas();
    this.bindEvents();
    this.loadLevel(this.unlockedLevel);
    this.startAnimLoop();
  }

  storageGet(key, def) {
    try {
      if (typeof localStorage !== "undefined") {
        const val = localStorage.getItem(key);
        return val !== null ? val : def;
      }
    } catch (e) {}
    return def;
  }

  storageSet(key, val) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val));
      }
    } catch (e) {}
  }

  haptic(ms = 15) {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch (e) {}
  }

  initDOM() {
    this.dom = {
      boardWrapper: document.getElementById("boardWrapper"),
      board: document.getElementById("circuitBoard"),
      canvas: document.getElementById("circuitCanvas"),
      fxCanvas: document.getElementById("fxCanvas"),
      levelNumber: document.getElementById("levelNumber"),
      levelName: document.getElementById("levelName"),
      levelTier: document.getElementById("levelTier"),
      moveCounter: document.getElementById("moveCounter"),
      parCounter: document.getElementById("parCounter"),
      fillPercent: document.getElementById("fillPercent"),
      fillBar: document.getElementById("fillBar"),
      levelStarsHeader: document.getElementById("levelStarsHeader"),
      btnPrevLevel: document.getElementById("btnPrevLevel"),
      btnNextLevelNav: document.getElementById("btnNextLevelNav"),
      btnLevelSelect: document.getElementById("btnLevelSelect"),
      btnUndo: document.getElementById("btnUndo"),
      btnReset: document.getElementById("btnReset"),
      btnHint: document.getElementById("btnHint"),
      btnSound: document.getElementById("btnSound"),
      // Win Modal
      winModal: document.getElementById("winModal"),
      winTitle: document.getElementById("winTitle"),
      winStarsDisplay: document.getElementById("winStarsDisplay"),
      winStats: document.getElementById("winStats"),
      btnNextLevel: document.getElementById("btnNextLevel"),
      btnReplayLevel: document.getElementById("btnReplayLevel"),
      // Level Selector Modal
      levelModal: document.getElementById("levelModal"),
      levelGrid: document.getElementById("levelGrid"),
      totalStarsCount: document.getElementById("totalStarsCount"),
      btnEndlessMode: document.getElementById("btnEndlessMode"),
      btnCloseLevels: document.getElementById("btnCloseLevels"),
      tierTabs: document.querySelectorAll(".tier-tab")
    };

    if (this.dom.btnSound) {
      this.dom.btnSound.textContent = this.audio.enabled ? "🔊 SFX: ON" : "🔇 SFX: OFF";
    }
  }

  initCanvas() {
    this.canvas = this.dom.canvas;
    this.ctx = this.canvas.getContext("2d");
    this.fxCanvas = this.dom.fxCanvas;
    this.fxCtx = this.fxCanvas.getContext("2d");
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    if (typeof ResizeObserver !== "undefined" && this.dom.boardWrapper) {
      try {
        new ResizeObserver(() => this.resizeCanvas()).observe(this.dom.boardWrapper);
      } catch (_) {}
    }
  }

  resizeCanvas() {
    if (!this.canvas || !this.dom.boardWrapper) return;
    const rect = this.dom.boardWrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const pad = 16; // 8px on each side
    const w = Math.max(10, rect.width - pad);
    const h = Math.max(10, rect.height - pad);

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (this.ctx.setTransform) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      this.ctx.scale(dpr, dpr);
    }

    this.fxCanvas.width = w * dpr;
    this.fxCanvas.height = h * dpr;
    this.fxCanvas.style.width = `${w}px`;
    this.fxCanvas.style.height = `${h}px`;
    if (this.fxCtx.setTransform) {
      this.fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      this.fxCtx.scale(dpr, dpr);
    }

    this.drawWires();
  }

  bindEvents() {
    const bw = this.dom.boardWrapper;

    // Pointer Events on the Board Wrapper
    bw.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { bw.setPointerCapture(e.pointerId); } catch (_) {}
      const cell = this.getCellFromPoint(e.clientX, e.clientY);
      if (cell) this.handleCellPointerDown(cell[0], cell[1]);
    });

    bw.addEventListener("pointermove", (e) => {
      if (!this.isPointerDown || !this.activeColor) return;
      e.preventDefault();
      const cell = this.getCellFromPoint(e.clientX, e.clientY);
      if (cell) this.handleCellPointerMove(cell[0], cell[1]);
    });

    const endDrag = (e) => {
      if (this.isPointerDown) {
        this.isPointerDown = false;
        this.activeColor = null;
        this.activePath = null;
        this.drawWires();
        try { if (e && e.pointerId) bw.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    bw.addEventListener("pointerup", endDrag);
    bw.addEventListener("pointercancel", endDrag);
    window.addEventListener("pointerup", endDrag);

    // Prev / Next HUD buttons
    if (this.dom.btnPrevLevel) {
      this.dom.btnPrevLevel.addEventListener("click", () => {
        if (this.level.id > 1) this.loadLevel(this.level.id - 1);
      });
    }

    if (this.dom.btnNextLevelNav) {
      this.dom.btnNextLevelNav.addEventListener("click", () => {
        const nextId = this.level.id + 1;
        if (nextId <= this.unlockedLevel || this.level.isProcedural) {
          this.loadLevel(nextId);
        }
      });
    }

    // Controls
    if (this.dom.btnUndo) this.dom.btnUndo.addEventListener("click", () => this.undo());
    if (this.dom.btnReset) this.dom.btnReset.addEventListener("click", () => this.resetLevel());
    if (this.dom.btnHint) this.dom.btnHint.addEventListener("click", () => this.giveHint());
    if (this.dom.btnSound) {
      this.dom.btnSound.addEventListener("click", () => {
        const on = this.audio.toggle();
        this.dom.btnSound.textContent = on ? "🔊 SFX: ON" : "🔇 SFX: OFF";
      });
    }

    if (this.dom.btnLevelSelect) this.dom.btnLevelSelect.addEventListener("click", () => this.openLevelSelect());
    if (this.dom.btnCloseLevels) this.dom.btnCloseLevels.addEventListener("click", () => this.closeLevelSelect());

    if (this.dom.btnNextLevel) {
      this.dom.btnNextLevel.addEventListener("click", () => {
        this.dom.winModal.classList.add("hidden");
        this.loadLevel(this.level.id + 1);
      });
    }

    if (this.dom.btnReplayLevel) {
      this.dom.btnReplayLevel.addEventListener("click", () => {
        this.dom.winModal.classList.add("hidden");
        this.resetLevel();
      });
    }

    if (this.dom.btnEndlessMode) {
      this.dom.btnEndlessMode.addEventListener("click", () => {
        this.closeLevelSelect();
        this.loadLevel(31);
      });
    }

    // Tier Tabs in Level Selector
    if (this.dom.tierTabs) {
      this.dom.tierTabs.forEach(tab => {
        tab.addEventListener("click", () => {
          this.dom.tierTabs.forEach(t => t.classList.remove("active"));
          tab.classList.add("active");
          this.renderLevelGrid(tab.dataset.tier);
        });
      });
    }

    // Keyboard Shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.key === "z" || e.key === "Z") this.undo();
      if (e.key === "r" || e.key === "R") this.resetLevel();
      if (e.key === "h" || e.key === "H") this.giveHint();
      if (e.key === "ArrowLeft" && this.level && this.level.id > 1) this.loadLevel(this.level.id - 1);
      if (e.key === "ArrowRight" && this.level && this.level.id < this.unlockedLevel) this.loadLevel(this.level.id + 1);
      if (e.key === "Escape") {
        this.dom.levelModal.classList.add("hidden");
        this.dom.winModal.classList.add("hidden");
      }
      if (e.key === "Enter" || e.key === " ") {
        if (this.dom.winModal && !this.dom.winModal.classList.contains("hidden")) {
          this.dom.winModal.classList.add("hidden");
          this.loadLevel(this.level.id + 1);
        }
      }
    });
  }

  getCellFromPoint(clientX, clientY) {
    const rect = this.dom.board.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }
    const c = Math.floor((clientX - rect.left) / (rect.width / this.size));
    const r = Math.floor((clientY - rect.top) / (rect.height / this.size));
    if (r >= 0 && r < this.size && c >= 0 && c < this.size) {
      return [r, c];
    }
    return null;
  }

  loadLevel(levelNumber) {
    let lvl = CURATED_LEVELS.find(l => l.id === levelNumber);
    if (!lvl) {
      lvl = ProceduralLevelGenerator.generate(levelNumber);
    }

    this.level = lvl;
    this.size = lvl.size;
    this.paths.clear();
    this.completedColors.clear();
    this.activeColor = null;
    this.activePath = null;
    this.moveCount = 0;
    this.history = [];

    // Update Header HUD
    if (this.dom.levelNumber) this.dom.levelNumber.textContent = lvl.id;
    if (this.dom.levelName) this.dom.levelName.textContent = lvl.name.toUpperCase();
    if (this.dom.levelTier) this.dom.levelTier.textContent = `${lvl.tier} • ${lvl.size}×${lvl.size} Grid`;
    if (this.dom.parCounter) this.dom.parCounter.textContent = lvl.optimalMoves || lvl.pairs.length;

    if (this.dom.btnPrevLevel) {
      this.dom.btnPrevLevel.disabled = lvl.id <= 1;
    }
    if (this.dom.btnNextLevelNav) {
      this.dom.btnNextLevelNav.disabled = lvl.id >= this.unlockedLevel && !lvl.isProcedural;
    }

    if (this.dom.winModal) this.dom.winModal.classList.add("hidden");
    if (this.dom.levelModal) this.dom.levelModal.classList.add("hidden");

    this.buildGrid();
    this.renderBoard();
    this.resizeCanvas();
    this.updateStats();
  }

  buildGrid() {
    this.grid = Array.from({ length: this.size }, () =>
      Array.from({ length: this.size }, () => ({
        type: "empty",
        color: null,
        isEndpoint: false
      }))
    );

    (this.level.blockers || []).forEach(([r, c]) => {
      if (r < this.size && c < this.size) {
        this.grid[r][c] = { type: "blocker", color: null, isEndpoint: false };
      }
    });

    this.level.pairs.forEach(pair => {
      const { color, p1, p2 } = pair;
      if (p1[0] < this.size && p1[1] < this.size) {
        this.grid[p1[0]][p1[1]] = { type: "endpoint", color, isEndpoint: true, partner: p2 };
      }
      if (p2[0] < this.size && p2[1] < this.size) {
        this.grid[p2[0]][p2[1]] = { type: "endpoint", color, isEndpoint: true, partner: p1 };
      }
    });
  }

  renderBoard() {
    const board = this.dom.board;
    if (!board) return;
    board.innerHTML = "";
    board.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
    board.style.gridTemplateRows = `repeat(${this.size}, 1fr)`;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = r;
        cell.dataset.col = c;

        const data = this.grid[r][c];
        if (data.type === "blocker") {
          cell.classList.add("blocker");
          cell.innerHTML = '<span class="blocker-icon">✕</span>';
        } else if (data.type === "endpoint") {
          cell.classList.add("endpoint", `c-${data.color}`);
          const def = COLOR_DEFS[data.color] || { hex: "#fff", glow: "#fff" };
          cell.style.setProperty("--c-hex", def.hex);
          cell.style.setProperty("--c-glow", def.glow);
          const isDone = this.completedColors.has(data.color);
          if (isDone) cell.classList.add("connected");
          cell.innerHTML = `<div class="node-core">${isDone ? "●" : "○"}</div>`;
        }

        board.appendChild(cell);
      }
    }
  }

  saveSnapshot() {
    const snap = new Map();
    this.paths.forEach((path, color) => snap.set(color, [...path]));
    this.history.push(snap);
    if (this.history.length > 25) this.history.shift();
  }

  handleCellPointerDown(r, c) {
    this.audio.init();
    const cellData = this.grid[r][c];
    if (cellData.type === "blocker") return;

    let targetColor = null;

    if (cellData.type === "endpoint") {
      targetColor = cellData.color;
    } else {
      // Check if tapping an existing path
      this.paths.forEach((path, col) => {
        if (path.some(([pr, pc]) => pr === r && pc === c)) {
          targetColor = col;
        }
      });
    }

    if (targetColor === null) return;

    this.saveSnapshot();
    this.isPointerDown = true;
    this.activeColor = targetColor;
    this.moveCount++;

    const pair = this.level.pairs.find(p => p.color === targetColor);
    const isP1 = pair.p1[0] === r && pair.p1[1] === c;
    const isP2 = pair.p2[0] === r && pair.p2[1] === c;

    if (isP1 || isP2) {
      // Start fresh wire from this terminal
      this.paths.set(targetColor, [[r, c]]);
      this.completedColors.delete(targetColor);
    } else {
      // Truncate path up to this point
      const existing = this.paths.get(targetColor) || [];
      const idx = existing.findIndex(([pr, pc]) => pr === r && pc === c);
      if (idx !== -1) {
        this.paths.set(targetColor, existing.slice(0, idx + 1));
        this.completedColors.delete(targetColor);
      }
    }

    this.activePath = this.paths.get(targetColor);
    this.audio.playStepChime(targetColor, this.activePath.length);
    this.haptic(10);
    this.updateEndpointVisuals();
    this.drawWires();
    this.updateStats();
  }

  handleCellPointerMove(r, c) {
    if (!this.isPointerDown || !this.activeColor) return;
    const path = this.paths.get(this.activeColor);
    if (!path || !path.length) return;

    const [lastR, lastC] = path[path.length - 1];
    if (lastR === r && lastC === c) return;

    // Fast dragging step-by-step interpolation
    const dr = r - lastR;
    const dc = c - lastC;
    const dist = Math.abs(dr) + Math.abs(dc);

    if (dist === 1) {
      this.stepToCell(r, c);
    } else if (dist > 1 && dist <= 3) {
      // Interpolate orthogonally
      let currR = lastR;
      let currC = lastC;
      while (currR !== r || currC !== c) {
        if (currR !== r) currR += (r > currR ? 1 : -1);
        else if (currC !== c) currC += (c > currC ? 1 : -1);
        if (!this.stepToCell(currR, currC)) break;
      }
    }
  }

  stepToCell(r, c) {
    if (!this.activeColor) return false;
    const path = this.paths.get(this.activeColor);
    if (!path || !path.length) return false;

    const [lastR, lastC] = path[path.length - 1];
    if (lastR === r && lastC === c) return true;

    // 1. Backtracking check
    if (path.length >= 2) {
      const [prevR, prevC] = path[path.length - 2];
      if (prevR === r && prevC === c) {
        path.pop();
        this.audio.playStepChime(this.activeColor, path.length);
        this.drawWires();
        this.updateStats();
        return true;
      }
    }

    // 2. Cannot enter blocker
    if (this.grid[r][c].type === "blocker") return false;

    // 3. Endpoint check
    if (this.grid[r][c].type === "endpoint") {
      const endColor = this.grid[r][c].color;
      if (endColor === this.activeColor) {
        // Connected!
        path.push([r, c]);
        this.completedColors.add(this.activeColor);
        this.audio.playConnectChime(this.activeColor);
        this.haptic(35);
        this.isPointerDown = false;
        this.activeColor = null;
        this.activePath = null;
        this.updateEndpointVisuals();
        this.drawWires();
        this.updateStats();
        this.checkVictory();
        return false;
      } else {
        return false; // other terminal
      }
    }

    // 4. Overwrite check: If another color path has this cell, cut it back
    this.paths.forEach((otherPath, otherColor) => {
      if (otherColor !== this.activeColor) {
        const cutIdx = otherPath.findIndex(([pr, pc]) => pr === r && pc === c);
        if (cutIdx !== -1) {
          this.paths.set(otherColor, otherPath.slice(0, cutIdx));
          this.completedColors.delete(otherColor);
        }
      }
    });

    // 5. Append cell to active path
    path.push([r, c]);
    this.audio.playStepChime(this.activeColor, path.length);
    this.drawWires();
    this.updateStats();
    return true;
  }

  updateEndpointVisuals() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const data = this.grid[r][c];
        if (data.type === "endpoint") {
          const cell = this.dom.board.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
          if (cell) {
            const isDone = this.completedColors.has(data.color);
            cell.classList.toggle("connected", isDone);
            const core = cell.querySelector(".node-core");
            if (core) core.textContent = isDone ? "●" : "○";
          }
        }
      }
    }
  }

  drawWires() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    const cellW = w / this.size;
    const cellH = h / this.size;

    this.paths.forEach((path, color) => {
      if (!path || path.length < 1) return;
      const def = COLOR_DEFS[color] || { hex: "#00f0ff", glow: "rgba(0,240,255,0.7)" };
      const isDone = this.completedColors.has(color);

      // 1. Draw outer neon aura
      ctx.save();
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(8, cellW * 0.32);
      ctx.strokeStyle = def.glow;
      ctx.shadowColor = def.hex;
      ctx.shadowBlur = isDone ? 18 : 10;

      for (let i = 0; i < path.length; i++) {
        const [r, c] = path[i];
        const x = (c + 0.5) * cellW;
        const y = (r + 0.5) * cellH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // 2. Draw crisp core line
      ctx.save();
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(4, cellW * 0.16);
      ctx.strokeStyle = "#ffffff";
      for (let i = 0; i < path.length; i++) {
        const [r, c] = path[i];
        const x = (c + 0.5) * cellW;
        const y = (r + 0.5) * cellH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // 3. Flowing electron pulse packets on completed lines
      if (isDone && path.length >= 2) {
        ctx.save();
        const totalSegs = path.length - 1;
        const speed = 0.003;
        const t = (this.electronPhase * speed) % 1;
        const currSegFloat = t * totalSegs;
        const segIdx = Math.floor(currSegFloat);
        const segT = currSegFloat - segIdx;

        if (segIdx < totalSegs) {
          const [r1, c1] = path[segIdx];
          const [r2, c2] = path[segIdx + 1];
          const px = ((c1 + 0.5) + (c2 - c1) * segT) * cellW;
          const py = ((r1 + 0.5) + (r2 - r1) * segT) * cellH;

          ctx.beginPath();
          ctx.arc(px, py, Math.max(4, cellW * 0.14), 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = def.hex;
          ctx.shadowBlur = 15;
          ctx.fill();
        }
        ctx.restore();
      }
    });
  }

  startAnimLoop() {
    const loop = (ts) => {
      this.electronPhase = ts;
      if (this.completedColors.size > 0) {
        this.drawWires();
      }
      this.updateFX();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  spawnCelebrationFX() {
    const w = this.fxCanvas.width / (window.devicePixelRatio || 1);
    const h = this.fxCanvas.height / (window.devicePixelRatio || 1);
    const colors = ["#00f0ff", "#ff0077", "#ffcc00", "#00ff66", "#b55fe6", "#ffffff"];
    this.fxParticles = [];

    for (let i = 0; i < 65; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      this.fxParticles.push({
        x: w / 2,
        y: h / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
        decay: Math.random() * 0.02 + 0.015
      });
    }
  }

  updateFX() {
    if (!this.fxCtx || !this.fxParticles.length) return;
    const ctx = this.fxCtx;
    const w = this.fxCanvas.width / (window.devicePixelRatio || 1);
    const h = this.fxCanvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    for (let i = this.fxParticles.length - 1; i >= 0; i--) {
      const p = this.fxParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.fxParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    }
  }

  undo() {
    if (!this.history.length) return;
    const snap = this.history.pop();
    this.paths = snap;
    this.completedColors.clear();

    this.level.pairs.forEach(pair => {
      const p = this.paths.get(pair.color);
      if (p && p.length >= 2) {
        const [sR, sC] = p[0];
        const [eR, eC] = p[p.length - 1];
        const isMatch =
          (sR === pair.p1[0] && sC === pair.p1[1] && eR === pair.p2[0] && eC === pair.p2[1]) ||
          (sR === pair.p2[0] && sC === pair.p2[1] && eR === pair.p1[0] && eC === pair.p1[1]);
        if (isMatch) this.completedColors.add(pair.color);
      }
    });

    this.audio.playUndo();
    this.haptic(15);
    this.updateEndpointVisuals();
    this.drawWires();
    this.updateStats();
  }

  resetLevel() {
    this.saveSnapshot();
    this.paths.clear();
    this.completedColors.clear();
    this.moveCount = 0;
    this.audio.playUndo();
    this.updateEndpointVisuals();
    this.drawWires();
    this.updateStats();
  }

  giveHint() {
    this.audio.init();
    // Find first unconnected pair
    const pair = this.level.pairs.find(p => !this.completedColors.has(p.color));
    if (!pair) return;

    this.saveSnapshot();
    // Use mathematically guaranteed solutionPath from level data
    const sol = pair.solutionPath;
    if (sol && sol.length >= 2) {
      // Overwrite any conflicting wires
      sol.forEach(([r, c]) => {
        this.paths.forEach((otherPath, otherColor) => {
          if (otherColor !== pair.color) {
            const cutIdx = otherPath.findIndex(([pr, pc]) => pr === r && pc === c);
            if (cutIdx !== -1) {
              this.paths.set(otherColor, otherPath.slice(0, cutIdx));
              this.completedColors.delete(otherColor);
            }
          }
        });
      });

      this.paths.set(pair.color, [...sol]);
      this.completedColors.add(pair.color);
      this.audio.playConnectChime(pair.color);
      this.haptic(35);
      this.updateEndpointVisuals();
      this.drawWires();
      this.updateStats();
      this.checkVictory();
    }
  }

  updateStats() {
    if (this.dom.moveCounter) this.dom.moveCounter.textContent = this.moveCount;

    const totalBlockers = (this.level.blockers || []).length;
    const totalUsable = this.size * this.size - totalBlockers;
    const counted = new Set();
    this.paths.forEach(path => {
      path.forEach(([r, c]) => counted.add(`${r},${c}`));
    });

    const covered = counted.size;
    const pct = Math.min(100, Math.round((covered / totalUsable) * 100));

    if (this.dom.fillPercent) this.dom.fillPercent.textContent = `${pct}%`;
    if (this.dom.fillBar) this.dom.fillBar.style.width = `${pct}%`;

    const savedStars = this.levelStars[this.level.id] || 0;
    if (this.dom.levelStarsHeader) {
      this.dom.levelStarsHeader.textContent = "★".repeat(savedStars) + "☆".repeat(3 - savedStars);
    }
  }

  checkVictory() {
    if (this.completedColors.size === this.level.pairs.length) {
      const par = this.level.optimalMoves || this.level.pairs.length;
      let stars = 1;
      if (this.moveCount <= par + 2) stars = 2;
      if (this.moveCount <= par) stars = 3;

      const prevStars = this.levelStars[this.level.id] || 0;
      if (stars > prevStars) {
        this.levelStars[this.level.id] = stars;
        this.storageSet("cc_level_stars", this.levelStars);
      }

      const nextLvl = this.level.id + 1;
      if (nextLvl > this.unlockedLevel) {
        this.unlockedLevel = nextLvl;
        this.storageSet("cc_unlocked_level", this.unlockedLevel);
      }

      this.audio.playWinFanfare();
      this.haptic(100);
      this.spawnCelebrationFX();
      setTimeout(() => this.showWinModal(stars), 350);
    }
  }

  showWinModal(stars) {
    if (!this.dom.winModal) return;
    const par = this.level.optimalMoves || this.level.pairs.length;

    if (this.dom.winTitle) {
      this.dom.winTitle.textContent = stars === 3 ? "PERFECT 3-STAR BREACH!" : "CIRCUIT SYNCHRONIZED!";
    }
    if (this.dom.winStarsDisplay) {
      this.dom.winStarsDisplay.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    }
    if (this.dom.winStats) {
      this.dom.winStats.innerHTML = `
        <div class="stat-card"><span>Moves</span><b>${this.moveCount} / ${par}</b></div>
        <div class="stat-card"><span>Status</span><b>100% SYNC</b></div>
        <div class="stat-card"><span>Rating</span><b>${stars}/3 Stars</b></div>
      `;
    }

    this.dom.winModal.classList.remove("hidden");
  }

  openLevelSelect() {
    this.audio.playClick();
    this.renderLevelGrid("all");
    this.dom.levelModal.classList.remove("hidden");
  }

  closeLevelSelect() {
    this.audio.playClick();
    this.dom.levelModal.classList.add("hidden");
  }

  renderLevelGrid(tierFilter = "all") {
    const grid = this.dom.levelGrid;
    if (!grid) return;
    grid.innerHTML = "";

    // Count total stars
    let totalStars = 0;
    Object.values(this.levelStars).forEach(s => totalStars += s);
    if (this.dom.totalStarsCount) this.dom.totalStarsCount.textContent = totalStars;

    CURATED_LEVELS.forEach(lvl => {
      // Tier filtering
      if (tierFilter === "1" && lvl.size !== 4) return;
      if (tierFilter === "2" && lvl.size !== 5) return;
      if (tierFilter === "3" && lvl.size !== 6) return;
      if (tierFilter === "4" && lvl.size < 7) return;

      const card = document.createElement("button");
      card.className = "level-card";
      const isLocked = lvl.id > this.unlockedLevel;
      const stars = this.levelStars[lvl.id] || 0;

      if (isLocked) {
        card.classList.add("locked");
        card.disabled = true;
        card.innerHTML = `<span class="lvl-num">${lvl.id}</span><span class="lvl-lock">🔒</span>`;
      } else {
        if (lvl.id === this.level.id) card.classList.add("current");
        card.innerHTML = `
          <span class="lvl-num">${lvl.id}</span>
          <span class="lvl-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span>
          <span class="lvl-size">${lvl.size}×${lvl.size}</span>
        `;
        card.addEventListener("click", () => {
          this.audio.playClick();
          this.closeLevelSelect();
          this.loadLevel(lvl.id);
        });
      }

      grid.appendChild(card);
    });
  }
}

function launchCyberCircuit() {
  if (!window.cyberCircuitInstance) {
    try {
      window.cyberCircuitInstance = new CyberCircuit();
      console.log("Cyber Circuit initialized successfully!");
    } catch (err) {
      console.error("Failed to initialize Cyber Circuit:", err);
    }
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", launchCyberCircuit);
  } else {
    // DOM already loaded (e.g. inside iframe or fast parse)
    launchCyberCircuit();
  }
  window.addEventListener("load", launchCyberCircuit);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CyberCircuit };
}
