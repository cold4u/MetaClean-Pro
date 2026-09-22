/**
 * Neon Rogue: Cyber Dungeon — Arcade Engine
 * Top-down action roguelite with procedural room layouts, dash i-frames, 3 weapons, and mini-map.
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

class RogueGame {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.width = canvas ? canvas.width : 560;
    this.height = canvas ? canvas.height : 560;
    this.audio = audio || {
      init: () => {},
      playSlash: () => {},
      playShotgun: () => {},
      playDash: () => {},
      playHit: () => {},
      playBossRoar: () => {}
    };

    this.state = "START"; // START, PLAYING, PAUSED, SHOP, GAMEOVER, VICTORY
    this.score = 0;
    this.highScore = this.loadHighScore();

    // Player
    this.player = {
      x: this.width / 2,
      y: this.height / 2,
      radius: 14,
      hp: 100,
      maxHp: 100,
      speed: 200,
      nanites: 0,
      dashTimer: 0,
      dashCooldown: 0,
      weaponIdx: 0 // 0: Katana, 1: Shotgun, 2: Railgun
    };

    this.weapons = [
      { name: "Neon Katana", type: "melee", dmg: 45, cooldown: 300, timer: 0 },
      { name: "Plasma Shotgun", type: "spread", dmg: 14, cooldown: 550, timer: 0 },
      { name: "Charged Railgun", type: "beam", dmg: 85, cooldown: 950, timer: 0 }
    ];

    // Dungeon 3x3 Grid
    this.gridSize = 3;
    this.currentRoom = { gx: 0, gy: 0 };
    this.dungeon = [];
    this.generateDungeon();

    // Inputs & Aiming
    this.keys = { w: false, a: false, s: false, d: false };
    this.aimAngle = 0;

    // Entities in current room
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.slashes = [];
    this.particles = [];

    this.loadCurrentRoom();
  }

  loadHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        return parseInt(localStorage.getItem("neon_rogue_highscore") || "0", 10);
      }
    } catch (_) {}
    return 0;
  }

  saveHighScore() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("neon_rogue_highscore", String(this.highScore));
      }
    } catch (_) {}
  }

  generateDungeon() {
    this.dungeon = [];
    for (let y = 0; y < this.gridSize; y++) {
      const row = [];
      for (let x = 0; x < this.gridSize; x++) {
        let type = "combat";
        if (x === 0 && y === 0) type = "start";
        else if (x === 2 && y === 2) type = "boss";
        else if (x === 1 && y === 1) type = "shop";

        row.push({
          gx: x,
          gy: y,
          type,
          cleared: (type === "start" || type === "shop"),
          visited: (x === 0 && y === 0)
        });
      }
      this.dungeon.push(row);
    }
  }

  loadCurrentRoom() {
    const room = this.dungeon[this.currentRoom.gy][this.currentRoom.gx];
    room.visited = true;

    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.slashes = [];
    this.particles = [];

    if (!room.cleared) {
      if (room.type === "boss") {
        this.audio.playBossRoar();
        this.enemies.push({
          x: this.width / 2,
          y: this.height / 3,
          radius: 36,
          hp: 450,
          maxHp: 450,
          speed: 40,
          isBoss: true,
          color: "#ff0055",
          fireTimer: 0
        });
      } else if (room.type === "combat") {
        // Spawn 4-6 enemies
        const count = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          this.enemies.push({
            x: 80 + Math.random() * (this.width - 160),
            y: 80 + Math.random() * (this.height - 160),
            radius: 12,
            hp: 35,
            maxHp: 35,
            speed: 70 + Math.random() * 40,
            isBoss: false,
            color: Math.random() < 0.5 ? "#00f0ff" : "#ffd700",
            fireTimer: Math.random() * 1000
          });
        }
      }
    }
  }

  start() {
    this.audio.init();
    this.player.hp = 100;
    this.player.x = this.width / 2;
    this.player.y = this.height / 2;
    this.player.nanites = 0;
    this.currentRoom = { gx: 0, gy: 0 };
    this.generateDungeon();
    this.loadCurrentRoom();
    this.state = "PLAYING";
  }

  dash() {
    if (this.state !== "PLAYING" || this.player.dashCooldown > 0) return false;
    this.player.dashTimer = 260; // 260ms of i-frames
    this.player.dashCooldown = 900;
    this.audio.playDash();

    // Dash burst velocity
    let dx = (this.keys.d ? 1 : 0) - (this.keys.a ? 1 : 0);
    let dy = (this.keys.s ? 1 : 0) - (this.keys.w ? 1 : 0);
    if (dx === 0 && dy === 0) {
      dx = Math.cos(this.aimAngle);
      dy = Math.sin(this.aimAngle);
    }
    const mag = Math.hypot(dx, dy) || 1;
    this.player.vx = (dx / mag) * 550;
    this.player.vy = (dy / mag) * 550;
    return true;
  }

  attack() {
    if (this.state !== "PLAYING") return;
    const w = this.weapons[this.player.weaponIdx];
    if (w.timer > 0) return;
    w.timer = w.cooldown;

    const px = this.player.x;
    const py = this.player.y;
    const angle = this.aimAngle;

    if (w.type === "melee") {
      this.audio.playSlash();
      this.slashes.push({
        x: px + Math.cos(angle) * 22,
        y: py + Math.sin(angle) * 22,
        angle,
        radius: 40,
        dmg: w.dmg,
        life: 0.15
      });
      // Slash damage
      this.enemies.forEach(e => {
        if (Math.hypot((px + Math.cos(angle) * 25) - e.x, (py + Math.sin(angle) * 25) - e.y) < 45 + e.radius) {
          e.hp -= w.dmg;
          this.createExplosion(e.x, e.y, "#00f0ff", 6);
        }
      });
    } else if (w.type === "spread") {
      this.audio.playShotgun();
      for (let i = -2; i <= 2; i++) {
        const a = angle + i * 0.12;
        this.playerBullets.push({
          x: px,
          y: py,
          vx: Math.cos(a) * 440,
          vy: Math.sin(a) * 440,
          dmg: w.dmg,
          life: 0.8,
          radius: 4
        });
      }
    } else if (w.type === "beam") {
      this.audio.playShotgun();
      // Pierce all enemies in direct line
      this.enemies.forEach(e => {
        // Line-to-point distance check
        const lineDist = Math.abs(Math.sin(angle) * (e.x - px) - Math.cos(angle) * (e.y - py));
        const forward = Math.cos(angle) * (e.x - px) + Math.sin(angle) * (e.y - py);
        if (forward > 0 && lineDist < e.radius + 8) {
          e.hp -= w.dmg;
          this.createExplosion(e.x, e.y, "#ff0077", 10);
        }
      });
      this.slashes.push({
        x: px + Math.cos(angle) * 150,
        y: py + Math.sin(angle) * 150,
        angle,
        radius: 120,
        isBeam: true,
        life: 0.18
      });
    }
  }

  createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 1 + Math.random() * 3.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        life: 1,
        decay: 0.04,
        size: 3
      });
    }
  }

  update(deltaMs) {
    if (this.state !== "PLAYING") return;

    const deltaSec = deltaMs / 1000;
    const p = this.player;

    // Cooldowns
    this.weapons.forEach(w => {
      if (w.timer > 0) w.timer = Math.max(0, w.timer - deltaMs);
    });

    if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - deltaMs);
    if (p.dashTimer > 0) {
      p.dashTimer = Math.max(0, p.dashTimer - deltaMs);
      p.x += p.vx * deltaSec;
      p.y += p.vy * deltaSec;
    } else {
      // Normal walk
      let mx = (this.keys.d ? 1 : 0) - (this.keys.a ? 1 : 0);
      let my = (this.keys.s ? 1 : 0) - (this.keys.w ? 1 : 0);
      const mag = Math.hypot(mx, my);
      if (mag > 0.1) {
        p.x += (mx / mag) * p.speed * deltaSec;
        p.y += (my / mag) * p.speed * deltaSec;
      }
    }

    // Room boundaries
    const margin = 36;
    const isRoomCleared = (this.enemies.length === 0);

    // Door Transitions
    if (isRoomCleared) {
      // Check doors: Top, Bottom, Left, Right
      // Top Door (gx, gy - 1)
      if (p.y < margin && Math.abs(p.x - this.width / 2) < 40 && this.currentRoom.gy > 0) {
        this.currentRoom.gy--;
        p.y = this.height - margin - 15;
        this.loadCurrentRoom();
        return;
      }
      // Bottom Door (gx, gy + 1)
      if (p.y > this.height - margin && Math.abs(p.x - this.width / 2) < 40 && this.currentRoom.gy < this.gridSize - 1) {
        this.currentRoom.gy++;
        p.y = margin + 15;
        this.loadCurrentRoom();
        return;
      }
      // Left Door (gx - 1, gy)
      if (p.x < margin && Math.abs(p.y - this.height / 2) < 40 && this.currentRoom.gx > 0) {
        this.currentRoom.gx--;
        p.x = this.width - margin - 15;
        this.loadCurrentRoom();
        return;
      }
      // Right Door (gx + 1, gy)
      if (p.x > this.width - margin && Math.abs(p.y - this.height / 2) < 40 && this.currentRoom.gx < this.gridSize - 1) {
        this.currentRoom.gx++;
        p.x = margin + 15;
        this.loadCurrentRoom();
        return;
      }
    }

    p.x = Math.max(margin, Math.min(this.width - margin, p.x));
    p.y = Math.max(margin, Math.min(this.height - margin, p.y));

    // Update Player Bullets
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      b.x += b.vx * deltaSec;
      b.y += b.vy * deltaSec;
      b.life -= deltaSec;
      if (b.life <= 0 || b.x < margin || b.x > this.width - margin || b.y < margin || b.y > this.height - margin) {
        this.playerBullets.splice(i, 1);
        continue;
      }

      // Check hit on enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
          e.hp -= b.dmg;
          this.createExplosion(b.x, b.y, "#00f0ff", 4);
          this.playerBullets.splice(i, 1);
          break;
        }
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        this.createExplosion(e.x, e.y, e.color, e.isBoss ? 40 : 12);
        p.nanites += e.isBoss ? 150 : 15;
        this.score += e.isBoss ? 1000 : 50;
        this.enemies.splice(i, 1);

        if (e.isBoss) {
          this.state = "VICTORY";
          if (typeof this.onVictory === "function") this.onVictory(this.score);
          return;
        }
        continue;
      }

      // Move toward player
      const angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.x += Math.cos(angle) * e.speed * deltaSec;
      e.y += Math.sin(angle) * e.speed * deltaSec;

      // Enemy fire
      e.fireTimer = (e.fireTimer || 0) + deltaMs;
      const fireThreshold = e.isBoss ? 800 : 1800;
      if (e.fireTimer >= fireThreshold) {
        e.fireTimer = 0;
        if (e.isBoss) {
          // 8-way ring fire
          for (let k = 0; k < 8; k++) {
            const fa = (k * Math.PI) / 4;
            this.enemyBullets.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(fa) * 160,
              vy: Math.sin(fa) * 160,
              radius: 5
            });
          }
        } else {
          this.enemyBullets.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(angle) * 190,
            vy: Math.sin(angle) * 190,
            radius: 4
          });
        }
      }

      // Collision with player
      if (p.dashTimer <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
        p.hp -= 20 * deltaSec;
        if (p.hp <= 0) {
          this.triggerGameOver("Terminated in the cyber dungeon!");
          return;
        }
      }
    }

    // Update Enemy Bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * deltaSec;
      b.y += b.vy * deltaSec;
      if (b.x < margin || b.x > this.width - margin || b.y < margin || b.y > this.height - margin) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (p.dashTimer <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < b.radius + p.radius) {
        p.hp -= 15;
        this.audio.playHit();
        this.createExplosion(p.x, p.y, "#ff0055", 8);
        this.enemyBullets.splice(i, 1);

        if (p.hp <= 0) {
          this.triggerGameOver("Sniper laser perforated your chassis!");
          return;
        }
      }
    }

    // If room cleared, mark it
    if (this.enemies.length === 0) {
      this.dungeon[this.currentRoom.gy][this.currentRoom.gx].cleared = true;
    }

    // Slashes decay
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= deltaSec;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.x += part.vx;
      part.y += part.vy;
      part.life -= part.decay;
      if (part.life <= 0) this.particles.splice(i, 1);
    }
  }

  triggerGameOver(msg) {
    this.state = "GAMEOVER";
    this.createExplosion(this.player.x, this.player.y, "#ff0055", 25);
    if (typeof this.onGameOver === "function") {
      this.onGameOver(this.score, msg);
    }
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const margin = 36;
    const p = this.player;

    // Room Floor
    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, w, h);

    // Floor tiles
    ctx.strokeStyle = "rgba(0, 240, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = margin; x < w - margin; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, h - margin);
      ctx.stroke();
    }
    for (let y = margin; y < h - margin; y += 40) {
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(w - margin, y);
      ctx.stroke();
    }

    // Walls
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, w, margin);
    ctx.fillRect(0, h - margin, w, margin);
    ctx.fillRect(0, 0, margin, h);
    ctx.fillRect(w - margin, 0, margin, h);

    // Doors
    const isCleared = (this.enemies.length === 0);
    const doorColor = isCleared ? "#00ff66" : "#ff0055";

    // Top Door
    if (this.currentRoom.gy > 0) {
      ctx.fillStyle = doorColor;
      ctx.fillRect(w / 2 - 25, 6, 50, margin - 12);
    }
    // Bottom Door
    if (this.currentRoom.gy < this.gridSize - 1) {
      ctx.fillStyle = doorColor;
      ctx.fillRect(w / 2 - 25, h - margin + 6, 50, margin - 12);
    }
    // Left Door
    if (this.currentRoom.gx > 0) {
      ctx.fillStyle = doorColor;
      ctx.fillRect(6, h / 2 - 25, margin - 12, 50);
    }
    // Right Door
    if (this.currentRoom.gx < this.gridSize - 1) {
      ctx.fillStyle = doorColor;
      ctx.fillRect(w - margin + 6, h / 2 - 25, margin - 12, 50);
    }

    // Slashes / Beams
    this.slashes.forEach(s => {
      ctx.save();
      ctx.strokeStyle = s.isBeam ? "#ff0077" : "#00f0ff";
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 15;
      ctx.lineWidth = s.isBeam ? 8 : 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, s.angle - 0.7, s.angle + 0.7);
      ctx.stroke();
      ctx.restore();
    });

    // Bullets
    this.playerBullets.forEach(b => {
      ctx.save();
      ctx.fillStyle = "#00f0ff";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    this.enemyBullets.forEach(b => {
      ctx.save();
      ctx.fillStyle = "#ff0055";
      ctx.shadowColor = "#ff0055";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Enemies
    this.enemies.forEach(e => {
      ctx.save();
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = e.isBoss ? 20 : 10;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Health bar above enemy
      ctx.fillStyle = "#334155";
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, e.radius * 2, 4);
      ctx.fillStyle = "#00ff66";
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 8, (e.hp / e.maxHp) * (e.radius * 2), 4);
      ctx.restore();
    });

    // Player
    ctx.save();
    ctx.fillStyle = p.dashTimer > 0 ? "rgba(0, 240, 255, 0.4)" : "#ffffff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    // Weapon pointer
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(this.aimAngle) * 20, p.y + Math.sin(this.aimAngle) * 20);
    ctx.stroke();
    ctx.restore();

    // Render Mini-Map in top-right
    const mw = 18;
    const ox = w - margin - 3 * mw - 6;
    const oy = margin + 6;
    for (let gy = 0; gy < this.gridSize; gy++) {
      for (let gx = 0; gx < this.gridSize; gx++) {
        const r = this.dungeon[gy][gx];
        ctx.save();
        ctx.fillStyle = (this.currentRoom.gx === gx && this.currentRoom.gy === gy)
          ? "#00f0ff"
          : r.visited
            ? (r.type === "boss" ? "#ff0055" : r.type === "shop" ? "#ffd700" : "#475569")
            : "rgba(30, 41, 59, 0.6)";
        ctx.fillRect(ox + gx * mw, oy + gy * mw, mw - 2, mw - 2);
        ctx.restore();
      }
    }

    // Particles
    this.particles.forEach(part => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, part.life);
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
  module.exports = { RogueGame };
}
