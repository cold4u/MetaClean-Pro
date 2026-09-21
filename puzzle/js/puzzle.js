/**
 * Cyber Circuit: Mainframe Breach — Core Game Engine
 */

class CyberCircuit {
  constructor() {
    this.audio = new PuzzleAudio();
    this.currentLevelIndex = 0;
    this.level = null;
    this.size = 5;
    this.grid = [];
    this.paths = new Map(); // colorId -> [[r, c], ...]
    this.completedColors = new Set();
    this.activeColor = null;
    this.activePath = null;
    this.isPointerDown = false;
    this.moveCount = 0;
    this.history = []; // stack of snapshot path maps

    // Persistent storage
    this.unlockedLevel = parseInt(this.storageGet('cc_unlocked_level', '1'), 10);
    this.levelStars = JSON.parse(this.storageGet('cc_level_stars', '{}'));

    this.initDOM();
    this.bindEvents();
    this.loadLevel(this.unlockedLevel);
  }

  storageGet(key, defaultVal) {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        return val !== null ? val : defaultVal;
      }
    } catch (e) {}
    return defaultVal;
  }

  storageSet(key, val) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
      }
    } catch (e) {}
  }

  haptic(ms = 15) {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch (e) {}
  }

  initDOM() {
    this.dom = {
      board: document.getElementById('circuitBoard'),
      levelTitle: document.getElementById('levelTitle'),
      levelTier: document.getElementById('levelTier'),
      moveCounter: document.getElementById('moveCounter'),
      fillPercent: document.getElementById('fillPercent'),
      fillBar: document.getElementById('fillBar'),
      levelStarsHeader: document.getElementById('levelStarsHeader'),
      btnLevelSelect: document.getElementById('btnLevelSelect'),
      btnUndo: document.getElementById('btnUndo'),
      btnReset: document.getElementById('btnReset'),
      btnHint: document.getElementById('btnHint'),
      btnSound: document.getElementById('btnSound'),
      // Modals
      winModal: document.getElementById('winModal'),
      winTitle: document.getElementById('winTitle'),
      winStarsDisplay: document.getElementById('winStarsDisplay'),
      winStats: document.getElementById('winStats'),
      btnNextLevel: document.getElementById('btnNextLevel'),
      btnReplayLevel: document.getElementById('btnReplayLevel'),
      // Level selector modal
      levelModal: document.getElementById('levelModal'),
      levelGrid: document.getElementById('levelGrid'),
      btnCloseLevels: document.getElementById('btnCloseLevels')
    };

    if (this.dom.btnSound) {
      this.dom.btnSound.textContent = this.audio.enabled ? '🔊 SFX: ON' : '🔇 SFX: OFF';
    }
  }

  bindEvents() {
    if (this.dom.btnSound) {
      this.dom.btnSound.addEventListener('click', () => {
        const on = this.audio.toggle();
        this.dom.btnSound.textContent = on ? '🔊 SFX: ON' : '🔇 SFX: OFF';
      });
    }

    if (this.dom.btnUndo) {
      this.dom.btnUndo.addEventListener('click', () => this.undo());
    }

    if (this.dom.btnReset) {
      this.dom.btnReset.addEventListener('click', () => this.resetLevel());
    }

    if (this.dom.btnHint) {
      this.dom.btnHint.addEventListener('click', () => this.giveHint());
    }

    if (this.dom.btnLevelSelect) {
      this.dom.btnLevelSelect.addEventListener('click', () => this.openLevelSelect());
    }

    if (this.dom.btnCloseLevels) {
      this.dom.btnCloseLevels.addEventListener('click', () => this.closeLevelSelect());
    }

    if (this.dom.btnNextLevel) {
      this.dom.btnNextLevel.addEventListener('click', () => {
        this.dom.winModal.classList.add('hidden');
        this.loadLevel(this.level.id + 1);
      });
    }

    if (this.dom.btnReplayLevel) {
      this.dom.btnReplayLevel.addEventListener('click', () => {
        this.dom.winModal.classList.add('hidden');
        this.resetLevel();
      });
    }

    // Global pointer up to cancel drag
    window.addEventListener('pointerup', () => this.onPointerUp());
    window.addEventListener('pointercancel', () => this.onPointerUp());

    // ESC to close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.dom.levelModal.classList.add('hidden');
        this.dom.winModal.classList.add('hidden');
      }
    });
  }

  loadLevel(levelNumber) {
    let lvl = CURATED_LEVELS.find(l => l.id === levelNumber);
    if (!lvl) {
      // Procedural level beyond curated set
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

    // Header updates
    if (this.dom.levelTitle) {
      this.dom.levelTitle.textContent = `LEVEL ${lvl.id}: ${lvl.name.toUpperCase()}`;
    }
    if (this.dom.levelTier) {
      this.dom.levelTier.textContent = `${lvl.tier} • ${lvl.size}×${lvl.size} Grid`;
    }
    if (this.dom.winModal) this.dom.winModal.classList.add('hidden');
    if (this.dom.levelModal) this.dom.levelModal.classList.add('hidden');

    this.buildGrid();
    this.render();
    this.updateStats();
  }

  buildGrid() {
    this.grid = Array.from({ length: this.size }, () =>
      Array.from({ length: this.size }, () => ({
        type: 'empty',
        color: null,
        isEndpoint: false
      }))
    );

    // Place firewall blockers
    (this.level.blockers || []).forEach(([r, c]) => {
      if (r < this.size && c < this.size) {
        this.grid[r][c] = { type: 'blocker', color: null, isEndpoint: false };
      }
    });

    // Place terminal endpoints
    this.level.pairs.forEach(pair => {
      const { color, p1, p2 } = pair;
      if (p1[0] < this.size && p1[1] < this.size) {
        this.grid[p1[0]][p1[1]] = { type: 'endpoint', color, isEndpoint: true, partner: p2 };
      }
      if (p2[0] < this.size && p2[1] < this.size) {
        this.grid[p2[0]][p2[1]] = { type: 'endpoint', color, isEndpoint: true, partner: p1 };
      }
    });
  }

  render() {
    const board = this.dom.board;
    if (!board) return;
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
    board.style.gridTemplateRows = `repeat(${this.size}, 1fr)`;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        const cellData = this.grid[r][c];

        if (cellData.type === 'blocker') {
          cell.classList.add('blocker');
          cell.innerHTML = '<span class="blocker-icon">✕</span>';
        } else if (cellData.type === 'endpoint') {
          cell.classList.add('endpoint', `c-${cellData.color}`);
          const def = COLOR_DEFS[cellData.color];
          if (def) {
            cell.style.setProperty('--c-hex', def.hex);
            cell.style.setProperty('--c-glow', def.glow);
          }
          const isDone = this.completedColors.has(cellData.color);
          if (isDone) cell.classList.add('connected');
          cell.innerHTML = `<div class="node-core">${isDone ? '●' : '○'}</div>`;
        }

        // Pointer event listeners for smooth mouse & touch dragging
        cell.addEventListener('pointerdown', (e) => this.onCellPointerDown(r, c, e));
        cell.addEventListener('pointerenter', (e) => this.onCellPointerEnter(r, c, e));

        board.appendChild(cell);
      }
    }

    this.renderWires();
  }

  renderWires() {
    // Clear existing wire visual classes
    const allCells = this.dom.board.querySelectorAll('.cell:not(.endpoint):not(.blocker)');
    allCells.forEach(cell => {
      cell.className = 'cell';
      cell.removeAttribute('style');
      cell.innerHTML = '';
    });

    // Draw lines for each color path
    this.paths.forEach((path, color) => {
      const def = COLOR_DEFS[color];
      const isDone = this.completedColors.has(color);

      for (let i = 0; i < path.length; i++) {
        const [r, c] = path[i];
        const cell = this.getCellElem(r, c);
        if (!cell) continue;

        if (cell.classList.contains('endpoint')) {
          if (isDone) cell.classList.add('connected');
          continue;
        }

        cell.classList.add('wired', `c-${color}`);
        if (def) {
          cell.style.setProperty('--c-hex', def.hex);
          cell.style.setProperty('--c-glow', def.glow);
        }
        if (isDone) cell.classList.add('pulse');

        // Determine orientation segments (N, S, E, W)
        const prev = path[i - 1];
        const next = path[i + 1];
        const segs = [];

        if (prev) {
          if (prev[0] < r) segs.push('n');
          if (prev[0] > r) segs.push('s');
          if (prev[1] < c) segs.push('w');
          if (prev[1] > c) segs.push('e');
        }
        if (next) {
          if (next[0] < r) segs.push('n');
          if (next[0] > r) segs.push('s');
          if (next[1] < c) segs.push('w');
          if (next[1] > c) segs.push('e');
        }

        segs.forEach(dir => cell.classList.add(`dir-${dir}`));
        cell.innerHTML = `<div class="wire-center"></div>`;
      }
    });
  }

  getCellElem(r, c) {
    return this.dom.board.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
  }

  saveSnapshot() {
    const snap = new Map();
    this.paths.forEach((path, color) => snap.set(color, [...path]));
    this.history.push(snap);
    if (this.history.length > 20) this.history.shift();
  }

  onCellPointerDown(r, c, e) {
    e.preventDefault();
    this.audio.init();
    const cellData = this.grid[r][c];

    let targetColor = null;

    if (cellData.type === 'endpoint') {
      targetColor = cellData.color;
    } else {
      // Check if clicking on an existing wire to re-route or continue it
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

    // If tapping an endpoint or existing path, start fresh or truncate to here
    const pair = this.level.pairs.find(p => p.color === targetColor);
    const isP1 = pair.p1[0] === r && pair.p1[1] === c;
    const isP2 = pair.p2[0] === r && pair.p2[1] === c;

    if (isP1 || isP2) {
      this.paths.set(targetColor, [[r, c]]);
      this.completedColors.delete(targetColor);
    } else {
      // Truncate path up to this clicked point
      const existing = this.paths.get(targetColor) || [];
      const idx = existing.findIndex(([pr, pc]) => pr === r && pc === c);
      if (idx !== -1) {
        this.paths.set(targetColor, existing.slice(0, idx + 1));
        this.completedColors.delete(targetColor);
      }
    }

    this.audio.playNodeChime(targetColor);
    this.haptic(10);
    this.renderWires();
    this.updateStats();
  }

  onCellPointerEnter(r, c, e) {
    if (!this.isPointerDown || !this.activeColor) return;
    e.preventDefault();

    const path = this.paths.get(this.activeColor);
    if (!path || !path.length) return;

    const [lastR, lastC] = path[path.length - 1];

    // Must be orthogonal neighbor (Up, Down, Left, Right)
    const dR = Math.abs(r - lastR);
    const dC = Math.abs(c - lastC);
    if ((dR === 1 && dC === 0) || (dR === 0 && dC === 1)) {
      // 1. Backtracking check (moving back to previous step)
      if (path.length >= 2) {
        const [prevR, prevC] = path[path.length - 2];
        if (prevR === r && prevC === c) {
          path.pop();
          this.audio.playNodeChime(this.activeColor);
          this.renderWires();
          this.updateStats();
          return;
        }
      }

      // 2. Cannot walk into blockers
      if (this.grid[r][c].type === 'blocker') return;

      // 3. Endpoint check
      if (this.grid[r][c].type === 'endpoint') {
        const endColor = this.grid[r][c].color;
        if (endColor === this.activeColor) {
          // Connected pair!
          path.push([r, c]);
          this.completedColors.add(this.activeColor);
          this.audio.playConnectChime(this.activeColor);
          this.haptic(30);
          this.isPointerDown = false;
          this.activeColor = null;
          this.render();
          this.updateStats();
          this.checkVictory();
          return;
        } else {
          // Cannot walk onto other color endpoint
          return;
        }
      }

      // 4. Overwrite check: If cell has another color wire, break that wire
      this.paths.forEach((otherPath, otherColor) => {
        if (otherColor !== this.activeColor) {
          const cutIdx = otherPath.findIndex(([pr, pc]) => pr === r && pc === c);
          if (cutIdx !== -1) {
            // Cut other wire back before this point
            this.paths.set(otherColor, otherPath.slice(0, cutIdx));
            this.completedColors.delete(otherColor);
          }
        }
      });

      // 5. Append to active path
      path.push([r, c]);
      this.audio.playNodeChime(this.activeColor);
      this.renderWires();
      this.updateStats();
    }
  }

  onPointerUp() {
    this.isPointerDown = false;
    this.activeColor = null;
  }

  undo() {
    if (!this.history.length) return;
    const snap = this.history.pop();
    this.paths = snap;
    this.completedColors.clear();

    // Recalculate completed pairs
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
    this.render();
    this.updateStats();
  }

  resetLevel() {
    this.saveSnapshot();
    this.paths.clear();
    this.completedColors.clear();
    this.moveCount = 0;
    this.audio.playUndo();
    this.render();
    this.updateStats();
  }

  giveHint() {
    this.audio.init();
    // Find first unconnected pair and give its direct or solution path
    const pair = this.level.pairs.find(p => !this.completedColors.has(p.color));
    if (!pair) return;

    this.saveSnapshot();
    // Use A* or Manhattan line if solutionPath not saved
    const path = pair.solutionPath || this.findManhattanPath(pair.p1, pair.p2);
    if (path) {
      this.paths.set(pair.color, path);
      this.completedColors.add(pair.color);
      this.audio.playConnectChime(pair.color);
      this.haptic(40);
      this.render();
      this.updateStats();
      this.checkVictory();
    }
  }

  findManhattanPath(p1, p2) {
    const path = [];
    let [r, c] = p1;
    path.push([r, c]);
    while (r !== p2[0]) {
      r += p2[0] > r ? 1 : -1;
      path.push([r, c]);
    }
    while (c !== p2[1]) {
      c += p2[1] > c ? 1 : -1;
      path.push([r, c]);
    }
    return path;
  }

  updateStats() {
    if (this.dom.moveCounter) {
      this.dom.moveCounter.textContent = this.moveCount;
    }

    // Calculate covered cells
    let covered = 0;
    const totalBlockers = (this.level.blockers || []).length;
    const totalUsable = this.size * this.size - totalBlockers;

    const counted = new Set();
    this.paths.forEach(path => {
      path.forEach(([r, c]) => counted.add(`${r},${c}`));
    });

    covered = counted.size;
    const pct = Math.min(100, Math.round((covered / totalUsable) * 100));

    if (this.dom.fillPercent) {
      this.dom.fillPercent.textContent = `${pct}%`;
    }
    if (this.dom.fillBar) {
      this.dom.fillBar.style.width = `${pct}%`;
    }

    // Stars display in header
    const savedStars = this.levelStars[this.level.id] || 0;
    if (this.dom.levelStarsHeader) {
      this.dom.levelStarsHeader.textContent = '★'.repeat(savedStars) + '☆'.repeat(3 - savedStars);
    }
  }

  checkVictory() {
    if (this.completedColors.size === this.level.pairs.length) {
      // All pairs connected!
      let covered = 0;
      const totalBlockers = (this.level.blockers || []).length;
      const totalUsable = this.size * this.size - totalBlockers;
      const counted = new Set();
      this.paths.forEach(path => path.forEach(([r, c]) => counted.add(`${r},${c}`)));
      covered = counted.size;
      const pct = Math.round((covered / totalUsable) * 100);

      // Star calculation
      let stars = 1;
      if (this.moveCount <= this.level.optimalMoves + 2) stars = 2;
      if (pct === 100 && this.moveCount <= this.level.optimalMoves) stars = 3;

      const prevStars = this.levelStars[this.level.id] || 0;
      if (stars > prevStars) {
        this.levelStars[this.level.id] = stars;
        this.storageSet('cc_level_stars', this.levelStars);
      }

      // Unlock next level
      const nextLvl = this.level.id + 1;
      if (nextLvl > this.unlockedLevel) {
        this.unlockedLevel = nextLvl;
        this.storageSet('cc_unlocked_level', this.unlockedLevel);
      }

      this.audio.playWinFanfare();
      this.haptic(100);
      this.showWinModal(stars, pct);
    }
  }

  showWinModal(stars, pct) {
    if (!this.dom.winModal) return;

    if (this.dom.winTitle) {
      this.dom.winTitle.textContent = stars === 3 ? '100% MAINFRAME BREACHED!' : 'CIRCUIT SYNCHRONIZED!';
    }
    if (this.dom.winStarsDisplay) {
      this.dom.winStarsDisplay.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    }
    if (this.dom.winStats) {
      this.dom.winStats.innerHTML = `
        <div class="stat-card"><span>Moves</span><b>${this.moveCount}</b></div>
        <div class="stat-card"><span>Grid Fill</span><b>${pct}%</b></div>
        <div class="stat-card"><span>Rating</span><b>${stars}/3 Stars</b></div>
      `;
    }

    this.dom.winModal.classList.remove('hidden');
  }

  openLevelSelect() {
    this.audio.playClick();
    const grid = this.dom.levelGrid;
    if (!grid) return;
    grid.innerHTML = '';

    CURATED_LEVELS.forEach(lvl => {
      const card = document.createElement('button');
      card.className = 'level-card';
      const isLocked = lvl.id > this.unlockedLevel;
      const stars = this.levelStars[lvl.id] || 0;

      if (isLocked) {
        card.classList.add('locked');
        card.disabled = true;
        card.innerHTML = `<span class="lvl-num">${lvl.id}</span><span class="lvl-lock">🔒</span>`;
      } else {
        if (lvl.id === this.level.id) card.classList.add('current');
        card.innerHTML = `
          <span class="lvl-num">${lvl.id}</span>
          <span class="lvl-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>
          <span class="lvl-size">${lvl.size}×${lvl.size}</span>
        `;
        card.addEventListener('click', () => {
          this.audio.playClick();
          this.loadLevel(lvl.id);
        });
      }

      grid.appendChild(card);
    });

    this.dom.levelModal.classList.remove('hidden');
  }

  closeLevelSelect() {
    this.audio.playClick();
    this.dom.levelModal.classList.add('hidden');
  }
}

// Instantiate on window load
window.addEventListener('DOMContentLoaded', () => {
  window.cyberCircuitInstance = new CyberCircuit();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CyberCircuit };
}
