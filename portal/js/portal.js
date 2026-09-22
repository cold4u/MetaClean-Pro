/**
 * Quantum Portal: Aperture Shift — Arcade Engine
 * Physics puzzle platformer with momentum-preserving dual portals, cubes, and laser gates.
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

class PortalGame {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.width = canvas ? canvas.width : 600;
    this.height = canvas ? canvas.height : 450;
    this.audio = audio || {
      init: () => {},
      playPortalShoot: () => {},
      playTeleport: () => {},
      playButton: () => {},
      playDoor: () => {}
    };

    this.state = "START"; // START, PLAYING, LEVEL_CLEAR, GAMEOVER
    this.currentLevelIdx = 0;

    // Player
    this.player = {
      x: 60,
      y: 350,
      w: 22,
      h: 32,
      vx: 0,
      vy: 0,
      grounded: false,
      holdingCube: null
    };

    // Portals
    this.bluePortal = null;   // { x, y, nx, ny, len: 40 }
    this.orangePortal = null; // { x, y, nx, ny, len: 40 }

    // Level elements
    this.walls = [];
    this.cubes = [];
    this.buttons = [];
    this.doors = [];
    this.hazards = [];
    this.particles = [];

    // Controls
    this.keys = { left: false, right: false, jump: false };
    this.aim = { x: 300, y: 200 };

    this.loadLevel(0);
  }

  loadLevel(idx) {
    this.currentLevelIdx = idx;
    this.bluePortal = null;
    this.orangePortal = null;
    this.particles = [];

    if (idx === 0) {
      // Chamber 1: Basic momentum launch
      this.player.x = 60;
      this.player.y = 380;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.holdingCube = null;

      this.walls = [
        { x: 0, y: 0, w: 600, h: 20, portalable: true }, // ceiling
        { x: 0, y: 420, w: 600, h: 30, portalable: true }, // floor
        { x: 0, y: 0, w: 20, h: 450, portalable: true }, // left
        { x: 580, y: 0, w: 20, h: 450, portalable: true }, // right
        { x: 420, y: 220, w: 160, h: 20, portalable: false },
        { x: 260, y: 200, w: 20, h: 220, portalable: true }
      ];

      this.doors = [
        { x: 530, y: 155, w: 30, h: 65, open: true }
      ];

      this.buttons = [];
      this.cubes = [];
      this.hazards = [];
    } else if (idx === 1) {
      // Chamber 2: Weighted Companion Cube & Pressure Button
      this.player.x = 50;
      this.player.y = 380;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.holdingCube = null;

      this.walls = [
        { x: 0, y: 0, w: 600, h: 20, portalable: true },
        { x: 0, y: 420, w: 600, h: 30, portalable: true },
        { x: 0, y: 0, w: 20, h: 450, portalable: true },
        { x: 580, y: 0, w: 20, h: 450, portalable: true },
        { x: 300, y: 120, w: 20, h: 300, portalable: true }
      ];

      this.cubes = [
        { x: 120, y: 390, w: 24, h: 24, vx: 0, vy: 0, grounded: true }
      ];

      this.buttons = [
        { x: 200, y: 414, w: 36, h: 6, pressed: false }
      ];

      this.doors = [
        { x: 520, y: 355, w: 30, h: 65, open: false }
      ];

      this.hazards = [];
    } else {
      // Chamber 3: Acid Pit and High Flings
      this.player.x = 50;
      this.player.y = 300;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.holdingCube = null;

      this.walls = [
        { x: 0, y: 0, w: 600, h: 20, portalable: true },
        { x: 0, y: 360, w: 140, h: 90, portalable: true },
        { x: 460, y: 360, w: 140, h: 90, portalable: true },
        { x: 0, y: 0, w: 20, h: 450, portalable: true },
        { x: 580, y: 0, w: 20, h: 450, portalable: true },
        { x: 250, y: 140, w: 100, h: 20, portalable: true }
      ];

      this.hazards = [
        { x: 140, y: 430, w: 320, h: 20 }
      ];

      this.cubes = [];
      this.buttons = [];
      this.doors = [
        { x: 510, y: 295, w: 30, h: 65, open: true }
      ];
    }
  }

  raySegmentIntersect(ox, oy, dx, dy, x1, y1, x2, y2) {
    const sx = x2 - x1;
    const sy = y2 - y1;
    const det = dx * sy - dy * sx;
    if (Math.abs(det) < 0.0001) return null;

    const qx = x1 - ox;
    const qy = y1 - oy;

    const t = (qx * sy - qy * sx) / det;
    const u = (qx * dy - qy * dx) / det;

    if (t > 0 && u >= 0 && u <= 1) {
      return { x: ox + dx * t, y: oy + dy * t, t };
    }
    return null;
  }

  shootPortal(isOrange, targetX, targetY) {
    const originX = this.player.x + this.player.w / 2;
    const originY = this.player.y + this.player.h / 2;
    const dx = targetX - originX;
    const dy = targetY - originY;
    const dist = Math.hypot(dx, dy);
    if (dist < 5) return false;

    let closestHit = null;
    let minT = Infinity;

    this.walls.forEach(w => {
      const edges = [
        { x1: w.x, y1: w.y, x2: w.x + w.w, y2: w.y, nx: 0, ny: -1 }, // top (normal points up)
        { x1: w.x, y1: w.y + w.h, x2: w.x + w.w, y2: w.y + w.h, nx: 0, ny: 1 }, // bottom (normal points down)
        { x1: w.x, y1: w.y, x2: w.x, y2: w.y + w.h, nx: -1, ny: 0 }, // left (normal points left)
        { x1: w.x + w.w, y1: w.y, x2: w.x + w.w, y2: w.y + w.h, nx: 1, ny: 0 } // right (normal points right)
      ];

      edges.forEach(edge => {
        const hit = this.raySegmentIntersect(originX, originY, dx, dy, edge.x1, edge.y1, edge.x2, edge.y2);
        if (hit && hit.t < minT) {
          minT = hit.t;
          closestHit = {
            x: hit.x,
            y: hit.y,
            nx: edge.nx,
            ny: edge.ny,
            portalable: w.portalable
          };
        }
      });
    });

    if (closestHit && closestHit.portalable) {
      const portalObj = {
        x: closestHit.x,
        y: closestHit.y,
        nx: closestHit.nx,
        ny: closestHit.ny,
        len: 44
      };

      if (isOrange) {
        this.orangePortal = portalObj;
      } else {
        this.bluePortal = portalObj;
      }

      this.audio.playPortalShoot(isOrange);
      this.createPortalParticles(closestHit.x, closestHit.y, isOrange ? "#ff8800" : "#00f0ff");
      return true;
    }
    return false;
  }

  createPortalParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 1,
        decay: 0.04,
        size: 3
      });
    }
  }

  interactCube() {
    const p = this.player;
    if (p.holdingCube) {
      p.holdingCube.vx = p.vx + (this.keys.right ? 3 : this.keys.left ? -3 : 0);
      p.holdingCube.vy = -2;
      p.holdingCube = null;
    } else {
      for (let i = 0; i < this.cubes.length; i++) {
        const c = this.cubes[i];
        if (Math.hypot(p.x - c.x, p.y - c.y) < 45) {
          p.holdingCube = c;
          break;
        }
      }
    }
  }

  teleportEntity(entity) {
    if (!this.bluePortal || !this.orangePortal) return false;

    const testPortals = [
      { enter: this.bluePortal, exit: this.orangePortal },
      { enter: this.orangePortal, exit: this.bluePortal }
    ];

    const cx = entity.x + (entity.w || 20) / 2;
    const cy = entity.y + (entity.h || 20) / 2;

    for (let i = 0; i < 2; i++) {
      const { enter, exit } = testPortals[i];
      if (Math.hypot(cx - enter.x, cy - enter.y) < 26) {
        const entrySpeed = Math.hypot(entity.vx, entity.vy);
        const exitSpeed = Math.max(entrySpeed, 7.5);

        entity.x = exit.x + exit.nx * 20 - (entity.w || 20) / 2;
        entity.y = exit.y + exit.ny * 20 - (entity.h || 20) / 2;

        entity.vx = exit.nx * exitSpeed;
        entity.vy = exit.ny * exitSpeed;

        this.audio.playTeleport();
        this.createPortalParticles(exit.x, exit.y, "#ffffff");
        return true;
      }
    }
    return false;
  }

  update(deltaMs) {
    if (this.state !== "PLAYING") return;

    const deltaSec = deltaMs / 1000;
    const p = this.player;

    const speed = 190;
    if (this.keys.left && !this.keys.right) {
      p.vx = -speed * deltaSec * 60;
    } else if (this.keys.right && !this.keys.left) {
      p.vx = speed * deltaSec * 60;
    } else {
      p.vx *= 0.8;
      if (Math.abs(p.vx) < 0.1) p.vx = 0;
    }

    if (this.keys.jump && p.grounded) {
      p.vy = -10.5;
      p.grounded = false;
    }

    p.vy += 0.42;
    this.teleportEntity(p);

    p.x += p.vx * deltaSec * 45;
    p.y += p.vy;

    p.grounded = false;
    this.walls.forEach(w => {
      if (
        p.x + p.w > w.x &&
        p.x < w.x + w.w &&
        p.y + p.h > w.y &&
        p.y < w.y + w.h
      ) {
        if (p.vy > 0 && p.y + p.h - p.vy <= w.y + 10) {
          p.y = w.y - p.h;
          p.vy = 0;
          p.grounded = true;
        } else if (p.vy < 0 && p.y - p.vy >= w.y + w.h - 10) {
          p.y = w.y + w.h;
          p.vy = 0;
        } else if (p.vx > 0) {
          p.x = w.x - p.w;
          p.vx = 0;
        } else if (p.vx < 0) {
          p.x = w.x + w.w;
          p.vx = 0;
        }
      }
    });

    this.cubes.forEach(c => {
      if (p.holdingCube === c) {
        c.x = p.x + (this.keys.left ? -20 : 20);
        c.y = p.y;
        c.vx = p.vx;
        c.vy = p.vy;
      } else {
        c.vy += 0.42;
        this.teleportEntity(c);
        c.x += c.vx;
        c.y += c.vy;

        this.walls.forEach(w => {
          if (c.x + c.w > w.x && c.x < w.x + w.w && c.y + c.h > w.y && c.y < w.y + w.h) {
            if (c.vy > 0) {
              c.y = w.y - c.h;
              c.vy = 0;
            }
          }
        });
      }
    });

    this.buttons.forEach(btn => {
      let isPressed = false;
      if (p.x + p.w > btn.x && p.x < btn.x + btn.w && Math.abs((p.y + p.h) - btn.y) < 8) {
        isPressed = true;
      }
      this.cubes.forEach(c => {
        if (c.x + c.w > btn.x && c.x < btn.x + btn.w && Math.abs((c.y + c.h) - btn.y) < 8) {
          isPressed = true;
        }
      });

      if (isPressed !== btn.pressed) {
        btn.pressed = isPressed;
        if (btn.pressed) {
          this.audio.playButton();
          this.doors.forEach(d => { d.open = true; this.audio.playDoor(); });
        }
      }
    });

    this.doors.forEach(d => {
      if (d.open && p.x + p.w > d.x && p.x < d.x + d.w && p.y + p.h > d.y && p.y < d.y + d.h) {
        this.state = "LEVEL_CLEAR";
        if (typeof this.onLevelClear === "function") {
          this.onLevelClear(this.currentLevelIdx);
        }
      }
    });

    this.hazards.forEach(haz => {
      if (p.x + p.w > haz.x && p.x < haz.x + haz.w && p.y + p.h > haz.y) {
        this.loadLevel(this.currentLevelIdx);
      }
    });

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.x += part.vx;
      part.y += part.vy;
      part.life -= part.decay;
      if (part.life <= 0) this.particles.splice(i, 1);
    }
  }

  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, w, h);

    this.walls.forEach(wl => {
      ctx.save();
      ctx.fillStyle = wl.portalable ? "#cbd5e1" : "#1e293b";
      ctx.fillRect(wl.x, wl.y, wl.w, wl.h);

      if (wl.portalable) {
        ctx.strokeStyle = "rgba(0, 240, 255, 0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(wl.x, wl.y, wl.w, wl.h);
      }
      ctx.restore();
    });

    this.hazards.forEach(hz => {
      ctx.save();
      ctx.fillStyle = "rgba(0, 255, 100, 0.7)";
      ctx.shadowColor = "#00ff66";
      ctx.shadowBlur = 10;
      ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
      ctx.restore();
    });

    this.buttons.forEach(btn => {
      ctx.save();
      ctx.fillStyle = btn.pressed ? "#00ff66" : "#ff0055";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.fillRect(btn.x, btn.y + (btn.pressed ? 3 : 0), btn.w, btn.h - (btn.pressed ? 3 : 0));
      ctx.restore();
    });

    this.doors.forEach(d => {
      ctx.save();
      ctx.fillStyle = d.open ? "rgba(0, 240, 255, 0.2)" : "#334155";
      ctx.strokeStyle = d.open ? "#00f0ff" : "#64748b";
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x, d.y, d.w, d.h);
      if (d.open) {
        ctx.fillStyle = "#00f0ff";
        ctx.font = "bold 12px monospace";
        ctx.fillText("EXIT", d.x + 2, d.y + d.h / 2);
      }
      ctx.restore();
    });

    const renderPortal = (p, color) => {
      if (!p) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 5;

      const isVertical = Math.abs(p.nx) > 0;
      ctx.beginPath();
      if (isVertical) {
        ctx.moveTo(p.x, p.y - p.len / 2);
        ctx.lineTo(p.x, p.y + p.len / 2);
      } else {
        ctx.moveTo(p.x - p.len / 2, p.y);
        ctx.lineTo(p.x + p.len / 2, p.y);
      }
      ctx.stroke();
      ctx.restore();
    };

    renderPortal(this.bluePortal, "#00f0ff");
    renderPortal(this.orangePortal, "#ff8800");

    this.cubes.forEach(c => {
      ctx.save();
      ctx.fillStyle = "#94a3b8";
      ctx.strokeStyle = "#ff0077";
      ctx.lineWidth = 2;
      ctx.roundRect(c.x, c.y, c.w, c.h, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ff0077";
      ctx.font = "12px sans-serif";
      ctx.fillText("♥", c.x + 6, c.y + 16);
      ctx.restore();
    });

    const pl = this.player;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 10;
    ctx.roundRect(pl.x, pl.y, pl.w, pl.h, 6);
    ctx.fill();

    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(pl.x + (this.keys.left ? -6 : pl.w), pl.y + 12, 8, 5);
    ctx.restore();

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
  module.exports = { PortalGame };
}
