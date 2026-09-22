/**
 * Quantum Jump: Cyber Tower — Arcade Engine
 * Vertical infinite platformer with spring boosters, moving platforms, jetpacks, and sentinel drones.
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

class JumpGame {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.width = canvas ? canvas.width : 480;
    this.height = canvas ? canvas.height : 640;
    this.audio = audio || {
      init: () => {},
      playJump: () => {},
      playSpring: () => {},
      playJetpack: () => {},
      playShatter: () => {},
      playFall: () => {}
    };

    // States
    this.state = "START"; // START, PLAYING, PAUSED, GAMEOVER
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.altitude = 0;

    // Player physics
    this.gravity = 0.42;
    this.jumpVelocity = -11.5;
    this.springVelocity = -18.5;
    this.player = {
      x: 220,
      y: 500,
      w: 32,
      h: 36,
      vx: 0,
      vy: 0,
      facing: "right",
      jetpackTimer: 0
    };

    // Controls
    this.keys = { left: false, right: false };

    // Entities
    this.platforms = [];
    this.hazards = [];
    this.particles = [];

    // Reset
    this.reset();
  }

  loadHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        return parseInt(localStorage.getItem("cyber_jump_highscore") || "0", 10);
      }
    } catch (_) {}
    return 0;
  }

  saveHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("cyber_jump_highscore", String(this.highScore));
      }
    } catch (_) {}
  }

  reset() {
    this.score = 0;
    this.altitude = 0;
    this.player = {
      x: this.width / 2 - 16,
      y: this.height - 120,
      w: 32,
      h: 36,
      vx: 0,
      vy: this.jumpVelocity,
      facing: "right",
      jetpackTimer: 0
    };

    this.platforms = [];
    this.hazards = [];
    this.particles = [];

    // Base landing platform directly under player
    this.platforms.push({
      x: this.width / 2 - 45,
      y: this.height - 60,
      w: 90,
      h: 14,
      type: "standard",
      broken: false
    });

    // Generate initial platforms up to the top
    let curY = this.height - 130;
    while (curY > 0) {
      this.spawnPlatform(curY);
      curY -= 65 + Math.random() * 30;
    }
  }

  spawnPlatform(y) {
    const pWidth = 72;
    const x = 20 + Math.random() * (this.width - pWidth - 40);
    const rand = Math.random();
    let type = "standard";
    let hasSpring = false;
    let hasJetpack = false;

    if (rand < 0.22) {
      type = "moving";
    } else if (rand < 0.38) {
      type = "crumble";
    } else if (rand < 0.48) {
      type = "standard";
      hasSpring = true;
    } else if (rand < 0.52) {
      type = "standard";
      hasJetpack = true;
    }

    this.platforms.push({
      x,
      y,
      w: pWidth,
      h: 14,
      type,
      vx: type === "moving" ? (Math.random() < 0.5 ? 2 : -2) : 0,
      broken: false,
      hasSpring,
      hasJetpack
    });

    // Chance to spawn floating drone hazard above 2000 score
    if (this.score > 2000 && Math.random() < 0.15 && this.hazards.length < 3) {
      this.hazards.push({
        x: Math.random() * (this.width - 30),
        y: y - 50,
        w: 28,
        h: 28,
        vx: Math.random() < 0.5 ? 1.5 : -1.5
      });
    }
  }

  createExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 1,
        decay: 0.03 + Math.random() * 0.04,
        size: 3 + Math.random() * 3
      });
    }
  }

  update(deltaMs) {
    if (this.state !== "PLAYING") return;

    const p = this.player;

    // Horizontal controls
    const moveSpeed = 6.2;
    if (this.keys.left && !this.keys.right) {
      p.vx = -moveSpeed;
      p.facing = "left";
    } else if (this.keys.right && !this.keys.left) {
      p.vx = moveSpeed;
      p.facing = "right";
    } else {
      p.vx *= 0.82;
      if (Math.abs(p.vx) < 0.1) p.vx = 0;
    }

    p.x += p.vx;

    // Screen border wrap
    if (p.x < -p.w / 2) {
      p.x = this.width - p.w / 2;
    } else if (p.x > this.width - p.w / 2) {
      p.x = -p.w / 2;
    }

    // Jetpack handling
    if (p.jetpackTimer > 0) {
      p.jetpackTimer -= deltaMs;
      p.vy = -12.5;
      // Thrust flame particles
      if (Math.random() < 0.6) {
        this.createExplosion(p.x + p.w / 2, p.y + p.h, "#ff0077", 2);
      }
    } else {
      // Normal Gravity
      p.vy += this.gravity;
    }

    p.y += p.vy;

    // Platform collisions (only when falling downward: vy > 0)
    if (p.vy > 0 && p.jetpackTimer <= 0) {
      const pFootY = p.y + p.h;
      const prevFootY = pFootY - p.vy;

      for (let i = 0; i < this.platforms.length; i++) {
        const plat = this.platforms[i];
        if (plat.broken) continue;

        // Bounding box test on landing surface
        if (
          p.x + p.w - 6 >= plat.x &&
          p.x + 6 <= plat.x + plat.w &&
          prevFootY <= plat.y + 6 &&
          pFootY >= plat.y
        ) {
          // Landed on platform
          p.y = plat.y - p.h;

          if (plat.type === "crumble") {
            plat.broken = true;
            this.audio.playShatter();
            this.createExplosion(plat.x + plat.w / 2, plat.y + plat.h / 2, "#ffaa00", 16);
            p.vy = this.jumpVelocity * 0.9;
          } else if (plat.hasSpring) {
            this.audio.playSpring();
            this.createExplosion(plat.x + plat.w / 2, plat.y, "#ffd700", 10);
            p.vy = this.springVelocity;
          } else if (plat.hasJetpack) {
            plat.hasJetpack = false;
            p.jetpackTimer = 4000;
            this.audio.playJetpack();
            p.vy = -12.5;
          } else {
            this.audio.playJump();
            p.vy = this.jumpVelocity;
          }
          break;
        }
      }
    }

    // Update moving platforms
    this.platforms.forEach(plat => {
      if (plat.type === "moving") {
        plat.x += plat.vx;
        if (plat.x < 10) {
          plat.x = 10;
          plat.vx = Math.abs(plat.vx);
        } else if (plat.x + plat.w > this.width - 10) {
          plat.x = this.width - 10 - plat.w;
          plat.vx = -Math.abs(plat.vx);
        }
      }
    });

    // Update hazards
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.x += h.vx;
      if (h.x < 10 || h.x + h.w > this.width - 10) {
        h.vx = -h.vx;
      }

      // Check collision with player
      if (
        p.x + p.w - 6 > h.x &&
        p.x + 6 < h.x + h.w &&
        p.y + p.h - 6 > h.y &&
        p.y + 6 < h.y + h.h
      ) {
        if (p.jetpackTimer > 0) {
          // Jetpack crushes drone
          this.createExplosion(h.x + h.w / 2, h.y + h.h / 2, "#00f0ff", 15);
          this.hazards.splice(i, 1);
          this.score += 250;
        } else {
          this.triggerGameOver("Electrocuted by security sentinel drone!");
          return;
        }
      }
    }

    // Camera scrolling when player rises above 45% screen height
    const camThreshold = this.height * 0.45;
    if (p.y < camThreshold) {
      const diff = camThreshold - p.y;
      p.y = camThreshold;
      this.altitude += diff;
      this.score = Math.floor(this.altitude / 4);

      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveHighScore();
      }

      // Move platforms down
      for (let i = this.platforms.length - 1; i >= 0; i--) {
        this.platforms[i].y += diff;
        if (this.platforms[i].y > this.height) {
          this.platforms.splice(i, 1);
        }
      }

      // Move hazards down
      for (let i = this.hazards.length - 1; i >= 0; i--) {
        this.hazards[i].y += diff;
        if (this.hazards[i].y > this.height) {
          this.hazards.splice(i, 1);
        }
      }

      // Spawn new platforms above top
      const highestPlat = this.platforms.reduce((min, pl) => Math.min(min, pl.y), this.height);
      if (highestPlat > 60) {
        this.spawnPlatform(highestPlat - (65 + Math.random() * 30));
      }
    }

    // Check Fall Game Over
    if (p.y > this.height + 40) {
      this.triggerGameOver("Fell into the cyber abyss!");
      return;
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.x += part.vx;
      part.y += part.vy;
      part.life -= part.decay;
      if (part.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  triggerGameOver(msg) {
    this.state = "GAMEOVER";
    this.audio.playFall();
    this.createExplosion(this.player.x + 16, this.player.y + 18, "#ff0055", 25);
    if (typeof this.onGameOver === "function") {
      this.onGameOver(this.score, msg);
    }
  }

  start() {
    this.audio.init();
    this.reset();
    this.state = "PLAYING";
  }

  togglePause() {
    if (this.state === "PLAYING") {
      this.state = "PAUSED";
      return true;
    } else if (this.state === "PAUSED") {
      this.state = "PLAYING";
      return false;
    }
    return false;
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Background Gradient with grid
    ctx.fillStyle = "#060a14";
    ctx.fillRect(0, 0, w, h);

    // Dynamic cyber vertical beams
    ctx.strokeStyle = "rgba(0, 240, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Render Platforms
    this.platforms.forEach(plat => {
      if (plat.broken) return;

      ctx.save();
      if (plat.type === "standard") {
        ctx.fillStyle = "#00f0ff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 8;
      } else if (plat.type === "moving") {
        ctx.fillStyle = "#00ff88";
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 8;
      } else if (plat.type === "crumble") {
        ctx.fillStyle = "#ffaa00";
        ctx.shadowColor = "#ffaa00";
        ctx.shadowBlur = 8;
      }

      ctx.roundRect(plat.x, plat.y, plat.w, plat.h, 6);
      ctx.fill();

      // Platform Core bar
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(plat.x + 8, plat.y + 4, plat.w - 16, 2);

      // Spring coil on top
      if (plat.hasSpring) {
        ctx.fillStyle = "#ffd700";
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 10;
        ctx.fillRect(plat.x + plat.w / 2 - 8, plat.y - 8, 16, 8);
      }

      // Jetpack on top
      if (plat.hasJetpack) {
        ctx.fillStyle = "#ff0077";
        ctx.shadowColor = "#ff0077";
        ctx.shadowBlur = 10;
        ctx.fillRect(plat.x + plat.w / 2 - 6, plat.y - 12, 12, 12);
        ctx.fillStyle = "#ffffff";
        ctx.font = "9px sans-serif";
        ctx.fillText("🚀", plat.x + plat.w / 2 - 5, plat.y - 2);
      }
      ctx.restore();
    });

    // Render Hazards
    this.hazards.forEach(haz => {
      ctx.save();
      ctx.fillStyle = "#ff0055";
      ctx.shadowColor = "#ff0055";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(haz.x + haz.w / 2, haz.y + haz.h / 2, haz.w / 2, 0, Math.PI * 2);
      ctx.fill();

      // Core eye
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(haz.x + haz.w / 2, haz.y + haz.h / 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Render Player
    const p = this.player;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    if (p.facing === "left") ctx.scale(-1, 1);

    // Jetpack flames
    if (p.jetpackTimer > 0) {
      ctx.fillStyle = "#ff0077";
      ctx.shadowColor = "#ff0077";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(-8, p.h / 2);
      ctx.lineTo(8, p.h / 2);
      ctx.lineTo(0, p.h / 2 + 14 + Math.random() * 8);
      ctx.closePath();
      ctx.fill();
    }

    // Cyber Robot Body
    ctx.fillStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 10;
    ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 8);
    ctx.fill();

    // Visor
    ctx.fillStyle = "#070b14";
    ctx.fillRect(-p.w / 2 + 6, -p.h / 2 + 6, p.w - 12, 10);
    ctx.fillStyle = "#00ffcc";
    ctx.fillRect(-p.w / 2 + 12, -p.h / 2 + 8, 8, 5);

    ctx.restore();

    // Render Particles
    this.particles.forEach(part => {
      ctx.save();
      ctx.globalAlpha = part.life;
      ctx.fillStyle = part.color;
      ctx.shadowColor = part.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { JumpGame };
}
