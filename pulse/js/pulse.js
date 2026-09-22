/**
 * Cyber Pulse: Rhythm Matrix — Arcade Engine
 * 4-Lane rhythm engine with real-time procedural synthesizer, combo multipliers, and feedback sparks.
 */

if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
    if (!radii) radii = 0;
    if (typeof radii === "number") radii = [radii, radii, radii, radii];
    const r = radii[0] || 0;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y + x, y, r);
    this.closePath();
    return this;
  };
}

class PulseGame {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.width = canvas ? canvas.width : 440;
    this.height = canvas ? canvas.height : 600;
    this.audio = audio || {
      init: () => {},
      startBGM: () => {},
      stopBGM: () => {},
      playHit: () => {},
      playMiss: () => {}
    };

    this.numLanes = 4;
    this.laneWidth = this.width / this.numLanes;
    this.targetY = this.height - 85;

    // States
    this.state = "START"; // START, PLAYING, PAUSED, GAMEOVER
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.health = 100;

    // Note speed & Spawner
    this.baseSpeed = 340; // px per second
    this.speed = this.baseSpeed;
    this.spawnTimer = 0;
    this.spawnInterval = 468; // ms per beat at 128 BPM
    this.beatCount = 0;

    // Entities
    this.notes = [];
    this.laneFlash = [0, 0, 0, 0];
    this.feedbackTexts = [];
    this.particles = [];

    // Lane colors & labels
    this.laneColors = [
      "#00f0ff", // Cyan
      "#ff0077", // Pink / Magenta
      "#ffd700", // Gold / Yellow
      "#00ff66"  // Green
    ];
    this.laneKeys = ["D", "F", "J", "K"];

    this.reset();
  }

  loadHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        return parseInt(localStorage.getItem("cyber_pulse_highscore") || "0", 10);
      }
    } catch (_) {}
    return 0;
  }

  saveHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("cyber_pulse_highscore", String(this.highScore));
      }
    } catch (_) {}
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.health = 100;
    this.speed = this.baseSpeed;
    this.notes = [];
    this.laneFlash = [0, 0, 0, 0];
    this.feedbackTexts = [];
    this.particles = [];
    this.spawnTimer = 0;
    this.beatCount = 0;
  }

  spawnBeatNotes() {
    this.beatCount++;
    // Procedural rhythm pattern
    const pattern = Math.random();
    if (pattern < 0.65) {
      // Single note
      const lane = Math.floor(Math.random() * 4);
      this.notes.push({ lane, y: -20, hit: false });
    } else if (pattern < 0.88) {
      // Dual note chord
      const l1 = Math.floor(Math.random() * 2);
      const l2 = 2 + Math.floor(Math.random() * 2);
      this.notes.push({ lane: l1, y: -20, hit: false });
      this.notes.push({ lane: l2, y: -20, hit: false });
    } else {
      // Alternating quick step
      const l = Math.floor(Math.random() * 4);
      this.notes.push({ lane: l, y: -20, hit: false });
      this.notes.push({ lane: (l + 2) % 4, y: -60, hit: false });
    }
  }

  hitLane(lane) {
    if (this.state !== "PLAYING") return;
    this.laneFlash[lane] = 1.0;

    // Find closest unhit note in this lane near target line
    let closestNote = null;
    let closestDist = Infinity;

    for (let i = 0; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.lane === lane && !n.hit) {
        const dist = Math.abs(n.y - this.targetY);
        if (dist < closestDist) {
          closestDist = dist;
          closestNote = n;
        }
      }
    }

    if (closestNote && closestDist <= 65) {
      closestNote.hit = true;
      let grade = "GOOD";
      let pts = 30;
      let hpBonus = 2;

      if (closestDist <= 18) {
        grade = "PERFECT";
        pts = 100;
        hpBonus = 5;
      } else if (closestDist <= 38) {
        grade = "GREAT";
        pts = 60;
        hpBonus = 3;
      }

      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // Update multiplier
      if (this.combo >= 50) this.multiplier = 4;
      else if (this.combo >= 25) this.multiplier = 3;
      else if (this.combo >= 10) this.multiplier = 2;
      else this.multiplier = 1;

      this.score += pts * this.multiplier;
      this.health = Math.min(100, this.health + hpBonus);

      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveHighScore();
      }

      this.audio.playHit(lane, grade);
      this.addFeedback(lane, grade);
      this.createNoteExplosion(lane, this.targetY, this.laneColors[lane]);
    } else {
      // Misclick / Empty press penalty
      this.audio.playMiss();
      this.combo = 0;
      this.multiplier = 1;
      this.health = Math.max(0, this.health - 5);
      this.addFeedback(lane, "MISS");
      if (this.health <= 0) {
        this.triggerGameOver("Mainframe Desync! Energy depleted.");
      }
    }
  }

  addFeedback(lane, text) {
    const x = lane * this.laneWidth + this.laneWidth / 2;
    this.feedbackTexts.push({
      x,
      y: this.targetY - 20,
      text,
      life: 1.0,
      color: text === "PERFECT" ? "#ffd700" : text === "GREAT" ? "#00f0ff" : text === "GOOD" ? "#00ff66" : "#ff0055"
    });
  }

  createNoteExplosion(lane, y, color) {
    const cx = lane * this.laneWidth + this.laneWidth / 2;
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x: cx,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 1,
        decay: 0.04 + Math.random() * 0.04,
        size: 3 + Math.random() * 3
      });
    }
  }

  update(deltaMs) {
    if (this.state !== "PLAYING") return;

    const deltaSec = deltaMs / 1000;

    // Decay lane flash
    for (let i = 0; i < 4; i++) {
      if (this.laneFlash[i] > 0) {
        this.laneFlash[i] = Math.max(0, this.laneFlash[i] - deltaSec * 5);
      }
    }

    // Dynamic tempo progression
    this.speed = this.baseSpeed + Math.min(200, Math.floor(this.score / 250) * 12);
    this.spawnInterval = Math.max(300, 468 - Math.floor(this.score / 500) * 10);

    // Note spawning
    this.spawnTimer += deltaMs;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnBeatNotes();
    }

    // Move notes
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      n.y += this.speed * deltaSec;

      // Note passed target line and missed
      if (!n.hit && n.y > this.targetY + 65) {
        n.hit = true;
        this.combo = 0;
        this.multiplier = 1;
        this.health = Math.max(0, this.health - 10);
        this.audio.playMiss();
        this.addFeedback(n.lane, "MISS");

        if (this.health <= 0) {
          this.triggerGameOver("Frequency Desync! Rhythm threshold breached.");
          return;
        }
      }

      // Despawn below screen
      if (n.y > this.height + 40) {
        this.notes.splice(i, 1);
      }
    }

    // Update feedback texts
    for (let i = this.feedbackTexts.length - 1; i >= 0; i--) {
      const fb = this.feedbackTexts[i];
      fb.y -= 40 * deltaSec;
      fb.life -= deltaSec * 2;
      if (fb.life <= 0) {
        this.feedbackTexts.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  triggerGameOver(msg) {
    this.state = "GAMEOVER";
    this.audio.stopBGM();
    if (typeof this.onGameOver === "function") {
      this.onGameOver(this.score, msg);
    }
  }

  start() {
    this.audio.init();
    this.audio.startBGM();
    this.reset();
    this.state = "PLAYING";
  }

  togglePause() {
    if (this.state === "PLAYING") {
      this.state = "PAUSED";
      this.audio.stopBGM();
      return true;
    } else if (this.state === "PAUSED") {
      this.state = "PLAYING";
      this.audio.startBGM();
      return false;
    }
    return false;
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const lw = this.laneWidth;

    // Background Matrix
    ctx.fillStyle = "#050811";
    ctx.fillRect(0, 0, w, h);

    // Lanes & Dividers
    for (let i = 0; i < this.numLanes; i++) {
      const lx = i * lw;

      // Lane flash upon tap
      if (this.laneFlash[i] > 0) {
        ctx.fillStyle = this.laneColors[i];
        ctx.globalAlpha = this.laneFlash[i] * 0.18;
        ctx.fillRect(lx, 0, lw, h);
        ctx.globalAlpha = 1.0;
      }

      // Lane divider
      ctx.strokeStyle = "rgba(0, 240, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, h);
      ctx.stroke();
    }
    // Right border divider
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w, h);
    ctx.stroke();

    // Target Hit Line
    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, this.targetY);
    ctx.lineTo(w, this.targetY);
    ctx.stroke();
    ctx.restore();

    // Target hit receptors per lane
    for (let i = 0; i < this.numLanes; i++) {
      const lx = i * lw;
      ctx.save();
      ctx.strokeStyle = this.laneColors[i];
      ctx.lineWidth = 2;
      ctx.shadowColor = this.laneColors[i];
      ctx.shadowBlur = 8;
      ctx.roundRect(lx + 8, this.targetY - 14, lw - 16, 28, 6);
      ctx.stroke();

      // Key letter
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(this.laneKeys[i], lx + lw / 2, this.targetY + 5);
      ctx.restore();
    }

    // Render Dropping Notes
    this.notes.forEach(note => {
      if (note.hit) return;
      const nx = note.lane * lw;
      const color = this.laneColors[note.lane];

      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.roundRect(nx + 10, note.y - 10, lw - 20, 20, 6);
      ctx.fill();

      // Core glow stripe
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(nx + 18, note.y - 2, lw - 36, 4);
      ctx.restore();
    });

    // Render Feedback Texts
    this.feedbackTexts.forEach(fb => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, fb.life);
      ctx.fillStyle = fb.color;
      ctx.shadowColor = fb.color;
      ctx.shadowBlur = 10;
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(fb.text, fb.x, fb.y);
      ctx.restore();
    });

    // Render Particles
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PulseGame };
}
