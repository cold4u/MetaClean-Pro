/**
 * Car Engine: Player Vehicle, AI Traffic, and Vehicle Physics
 */

// CanvasRenderingContext2D roundRect Polyfill for legacy browsers & webviews
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    if (!radii) radii = 0;
    if (typeof radii === "number") radii = [radii, radii, radii, radii];
    if (Array.isArray(radii)) {
      if (radii.length === 1) radii = [radii[0], radii[0], radii[0], radii[0]];
      else if (radii.length === 2) radii = [radii[0], radii[1], radii[0], radii[1]];
      else if (radii.length === 3) radii = [radii[0], radii[1], radii[2], radii[1]];
    } else {
      radii = [0, 0, 0, 0];
    }
    const [tl, tr, br, bl] = radii;
    this.beginPath();
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}

const VEHICLE_ARCHETYPES = {
  apex: {
    name: 'Apex GT',
    baseMaxSpeed: 20,
    nitroMaxSpeed: 32,
    baseAcceleration: 0.32,
    nitroAcceleration: 0.70,
    turnSpeed: 7.5,
    maxHealth: 100,
    primaryColor: '#00d4ff',
    secondaryColor: '#0077b6',
    accentColor: '#00f0ff',
    glowColor: '#00f0ff',
    flameColor: '#00f0ff'
  },
  interceptor: {
    name: 'V8 Brawler',
    baseMaxSpeed: 18.5,
    nitroMaxSpeed: 28,
    baseAcceleration: 0.28,
    nitroAcceleration: 0.62,
    turnSpeed: 6.8,
    maxHealth: 150,
    primaryColor: '#ffb703',
    secondaryColor: '#b7791f',
    accentColor: '#fb8500',
    glowColor: '#fb8500',
    flameColor: '#ff7700'
  },
  phantom: {
    name: 'Neon Phantom',
    baseMaxSpeed: 23,
    nitroMaxSpeed: 36,
    baseAcceleration: 0.36,
    nitroAcceleration: 0.80,
    turnSpeed: 8.2,
    maxHealth: 80,
    primaryColor: '#ff007f',
    secondaryColor: '#a80055',
    accentColor: '#ff55b0',
    glowColor: '#ff007f',
    flameColor: '#ff00d4'
  }
};

class PlayerCar {
  constructor(x, y, road) {
    this.road = road;
    this.width = 38;
    this.height = 70;
    this.x = x - this.width / 2;
    this.y = y;

    // Vehicle Archetype
    this.archetype = 'apex';

    // Movement & Physics (Enhanced Responsiveness & Higher Speeds)
    this.speed = 0;
    this.baseMaxSpeed = 20;
    this.nitroMaxSpeed = 32;
    this.maxSpeed = this.baseMaxSpeed;
    this.baseAcceleration = 0.32;
    this.nitroAcceleration = 0.70;
    this.acceleration = this.baseAcceleration;
    this.friction = 0.06;
    this.brakeRate = 0.50;
    this.turnSpeed = 7.5; // High responsiveness

    // Dynamic Lateral Velocity & Steering Inertia
    this.vx = 0;
    this.steerAcc = 1.6; // Instant, snappy steering response
    this.steerDecel = 0.72; // Crisp re-centering
    this.wheelAngle = 0; // Front wheels turning angle
    this.bounceY = 0;

    // Dynamics & Tilt
    this.angle = 0;
    this.targetAngle = 0;

    // Stats & Systems
    this.health = 100;
    this.maxHealth = 100;
    this.nitro = 100; // 0 - 100%
    this.nitroRate = 0.40;
    this.nitroRecharge = 0.08;
    this.isNitroActive = false;

    // Unlimited Rocket Arsenal
    this.unlimitedRockets = true;
    this.rockets = Infinity;
    this.maxRockets = Infinity;
    this.rocketCooldown = 0;

    // Visual effects
    this.skidMarks = [];
    this.exhaustFlicker = 0;
    this.isDrifting = false;

    // Transmission & Gearbox Simulation
    this.currentGear = 'N'; // 'N', '1', '2', '3', '4', '5', '6'
    this.rpm = 0.15; // 0.0 to 1.0
    this.shiftCooldown = 0;
    this.isShifting = false;
    this.onGearShift = null; // Callback: (oldGear, newGear)

    this.setArchetype('apex');
  }

  setArchetype(typeKey) {
    const arch = VEHICLE_ARCHETYPES[typeKey];
    if (!arch) return;
    const wasFullHealth = (this.health >= this.maxHealth);
    this.archetype = typeKey;
    this.baseMaxSpeed = arch.baseMaxSpeed;
    this.nitroMaxSpeed = arch.nitroMaxSpeed;
    this.maxSpeed = this.isNitroActive ? this.nitroMaxSpeed : this.baseMaxSpeed;
    this.baseAcceleration = arch.baseAcceleration;
    this.nitroAcceleration = arch.nitroAcceleration;
    this.acceleration = this.isNitroActive ? this.nitroAcceleration : this.baseAcceleration;
    this.turnSpeed = arch.turnSpeed;
    this.maxHealth = arch.maxHealth;
    if (wasFullHealth || this.health <= 0) {
      this.health = this.maxHealth;
    } else {
      this.health = Math.min(this.health, this.maxHealth);
    }
  }

  update(inputs, dt = 16.667) {
    const dtNorm = Math.min(2.0, Math.max(0.4, dt / 16.667));

    // Decrement rocket weapon cooldown
    if (this.rocketCooldown > 0) {
      this.rocketCooldown -= dtNorm;
      if (this.rocketCooldown < 0) this.rocketCooldown = 0;
    }

    // 1. Snappy Acceleration & Braking (Frame-rate smoothed)
    if (inputs.up) {
      this.speed += this.acceleration * dtNorm;
      if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
    } else if (inputs.down) {
      this.speed -= this.brakeRate * dtNorm;
      if (this.speed < 0) this.speed = 0;
    } else {
      // Rolling friction
      if (this.speed > 0) {
        this.speed -= this.friction * dtNorm;
        if (this.speed < 0) this.speed = 0;
      }
    }

    // 2. High-Impact Nitro Boost
    if (inputs.nitro && this.nitro > 5 && this.speed > 3) {
      this.isNitroActive = true;
      this.maxSpeed = this.nitroMaxSpeed;
      this.acceleration = this.nitroAcceleration;
      this.nitro -= this.nitroRate * dtNorm;
      if (this.nitro <= 0) {
        this.nitro = 0;
        this.isNitroActive = false;
      }
    } else {
      this.isNitroActive = false;
      this.maxSpeed = this.baseMaxSpeed;
      this.acceleration = this.baseAcceleration;
      if (this.nitro < 100) {
        this.nitro += this.nitroRecharge * dtNorm;
        if (this.nitro > 100) this.nitro = 100;
      }
    }

    // Handbrake / Drift
    if (inputs.space) {
      this.speed -= this.brakeRate * 1.6 * dtNorm;
      if (this.speed < 0) this.speed = 0;
      if (this.speed > 4) {
        this.addSkidMark();
        this.isDrifting = true;
      }
    } else {
      this.isDrifting = false;
    }

    // 3. Ultra-Responsive Steering (Lateral Momentum & Snappy Counter-Steering)
    const canSteer = this.speed > 0.1 || inputs.up;
    if (canSteer) {
      if (inputs.left) {
        if (this.vx > 0) this.vx *= 0.5;
        this.vx -= this.steerAcc * dtNorm;
        if (this.vx < -this.turnSpeed) this.vx = -this.turnSpeed;
      } else if (inputs.right) {
        if (this.vx < 0) this.vx *= 0.5;
        this.vx += this.steerAcc * dtNorm;
        if (this.vx > this.turnSpeed) this.vx = this.turnSpeed;
      } else {
        this.vx *= Math.pow(this.steerDecel, dtNorm);
        if (Math.abs(this.vx) < 0.05) this.vx = 0;
      }
    } else {
      this.vx *= 0.5;
    }

    // Apply lateral movement scaled with forward velocity & delta time
    const speedSteerRatio = Math.min(1.25, Math.max(0.45, this.speed / 4.5));
    this.x += this.vx * speedSteerRatio * dtNorm;

    // Body roll tilt & animated wheel turning (smooth lerp)
    this.targetAngle = (this.vx / this.turnSpeed) * 0.14;
    this.angle += (this.targetAngle - this.angle) * (0.28 * dtNorm);
    this.wheelAngle = (this.vx / this.turnSpeed) * 0.52;

    // Suspension bounce animation based on speed
    this.bounceY = Math.sin(Date.now() * 0.028) * Math.min(2.5, this.speed * 0.12);

    // 4. Live Gear Shifting & RPM Calculations
    let targetGear = 'N';
    let targetRpm = 0.15;

    if (this.speed < 0.1) {
      targetGear = 'N';
      targetRpm = inputs.up ? 0.48 : 0.15;
    } else if (this.speed <= 4.8) {
      targetGear = '1';
      targetRpm = 0.22 + (this.speed / 4.8) * 0.76;
    } else if (this.speed <= 9.8) {
      targetGear = '2';
      targetRpm = 0.25 + ((this.speed - 4.8) / 5.0) * 0.72;
    } else if (this.speed <= 15.8) {
      targetGear = '3';
      targetRpm = 0.30 + ((this.speed - 9.8) / 6.0) * 0.68;
    } else if (this.speed <= 21.8) {
      targetGear = '4';
      targetRpm = 0.35 + ((this.speed - 15.8) / 6.0) * 0.63;
    } else if (this.speed <= 27.2) {
      targetGear = '5';
      targetRpm = 0.40 + ((this.speed - 21.8) / 5.4) * 0.58;
    } else {
      targetGear = '6';
      targetRpm = 0.45 + Math.min(0.53, ((this.speed - 27.2) / 6.0) * 0.53);
    }

    // Detect live gear transition
    if (targetGear !== this.currentGear && this.speed > 0.5) {
      const oldGear = this.currentGear;
      this.currentGear = targetGear;
      this.shiftCooldown = 6; // brief clutch dip for shift effect
      this.isShifting = true;
      if (this.onGearShift) {
        this.onGearShift(oldGear, targetGear);
      }
    } else {
      this.currentGear = targetGear;
    }

    // Clutch dip rev drop during gear shift
    if (this.shiftCooldown > 0) {
      this.shiftCooldown -= dtNorm;
      targetRpm = Math.max(0.24, targetRpm * 0.65);
      if (this.shiftCooldown <= 0) {
        this.isShifting = false;
      }
    }

    // Smooth RPM response
    this.rpm += (targetRpm - this.rpm) * (0.24 * dtNorm);

    // Dynamic tire skid marks during hard turns at high speed
    if (Math.abs(this.vx) > 4.5 && this.speed > 8) {
      this.addSkidMark();
      this.isDrifting = true;
    }

    // 5. Road Boundaries & Off-Road Slowdown
    const minX = this.road.left - 15;
    const maxX = this.road.right - this.width + 15;

    if (this.x < minX) {
      this.x = minX;
      this.vx = 0;
      this.speed *= 0.90; // curb penalty
    } else if (this.x > maxX) {
      this.x = maxX;
      this.vx = 0;
      this.speed *= 0.90;
    }

    // Road shoulder drag
    if (this.x < this.road.left || this.x + this.width > this.road.right) {
      this.speed = Math.max(0, this.speed - 0.18);
      if (this.speed > 3) this.addSkidMark();
    }

    // Update skid marks lifecycle
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      const sm = this.skidMarks[i];
      sm.y += this.speed;
      sm.alpha -= 0.018;
      if (sm.alpha <= 0 || sm.y > this.road.canvasHeight + 100) {
        this.skidMarks.splice(i, 1);
      }
    }

    this.exhaustFlicker = (this.exhaustFlicker + 1) % 4;
  }

  addSkidMark() {
    this.skidMarks.push({
      x1: this.x + 6,
      x2: this.x + this.width - 6,
      y: this.y + this.height - 8,
      alpha: 0.6
    });
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health < 0) this.health = 0;
    // Speed punch-down upon impact
    this.speed *= 0.35;
    return this.health <= 0;
  }

  repair(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  refillNitro(amount) {
    this.nitro = Math.min(100, this.nitro + amount);
  }

  fireRocket() {
    if (this.rocketCooldown > 0) return null;
    if (!this.unlimitedRockets) {
      if (this.rockets <= 0) return null;
      this.rockets--;
    }
    this.rocketCooldown = 7; // Rapid-fire rate (~115ms) for intense arcade action
    const noseX = this.x + this.width / 2;
    const noseY = this.y - 10;
    return new Rocket(noseX, noseY, this.speed);
  }

  addRockets(amount = 3) {
    this.rockets = Math.min(this.maxRockets, this.rockets + amount);
  }

  getBounds() {
    // Return tight bounding rectangle for fair collision detection
    return {
      x: this.x + 3,
      y: this.y + 4,
      width: this.width - 6,
      height: this.height - 8
    };
  }

  draw(ctx, inputs = {}) {
    // 1. Draw Skid Marks on asphalt
    for (const sm of this.skidMarks) {
      ctx.fillStyle = `rgba(10, 10, 15, ${sm.alpha})`;
      ctx.fillRect(sm.x1 - 2, sm.y, 4, 10);
      ctx.fillRect(sm.x2 - 2, sm.y, 4, 10);
    }

    ctx.save();
    // Center transformation for rotation tilt
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate(this.angle);

    // 2. Headlight Beams (Illuminating road ahead)
    if (this.speed > 0.1) {
      const beamGrad = ctx.createLinearGradient(0, -this.height / 2, 0, -this.height / 2 - 140);
      beamGrad.addColorStop(0, 'rgba(230, 245, 255, 0.45)');
      beamGrad.addColorStop(0.4, 'rgba(0, 240, 255, 0.2)');
      beamGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');

      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(-this.width / 2 + 5, -this.height / 2);
      ctx.lineTo(-this.width / 2 - 25, -this.height / 2 - 140);
      ctx.lineTo(this.width / 2 + 25, -this.height / 2 - 140);
      ctx.lineTo(this.width / 2 - 5, -this.height / 2);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Exhaust Flames & Nitro Rocket Thruster Trail
    const arch = (typeof VEHICLE_ARCHETYPES !== 'undefined' && VEHICLE_ARCHETYPES[this.archetype]) ? VEHICLE_ARCHETYPES[this.archetype] : VEHICLE_ARCHETYPES.apex;

    if (this.speed > 1) {
      const flameLen = this.isNitroActive ? 36 + (this.exhaustFlicker * 5) : 12 + (this.exhaustFlicker * 3);
      const flameColor = this.isNitroActive ? arch.flameColor : '#ff7700';
      const innerColor = this.isNitroActive ? '#ffffff' : '#ffee55';

      ctx.fillStyle = flameColor;
      ctx.shadowColor = flameColor;
      ctx.shadowBlur = this.isNitroActive ? 22 : 8;

      // Outer Flame Left
      ctx.beginPath();
      ctx.moveTo(-11, this.height / 2);
      ctx.lineTo(-6, this.height / 2 + flameLen);
      ctx.lineTo(-1, this.height / 2);
      ctx.fill();

      // Outer Flame Right
      ctx.beginPath();
      ctx.moveTo(1, this.height / 2);
      ctx.lineTo(6, this.height / 2 + flameLen);
      ctx.lineTo(11, this.height / 2);
      ctx.fill();

      // Inner Core Flame
      ctx.fillStyle = innerColor;
      ctx.beginPath();
      ctx.moveTo(-9, this.height / 2);
      ctx.lineTo(-6, this.height / 2 + flameLen * 0.6);
      ctx.lineTo(-3, this.height / 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(3, this.height / 2);
      ctx.lineTo(6, this.height / 2 + flameLen * 0.6);
      ctx.lineTo(9, this.height / 2);
      ctx.fill();

      ctx.shadowBlur = 0;
    }

    // 4. Car Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(-this.width / 2 + 2, -this.height / 2 + 4, this.width, this.height, 8);
    ctx.fill();

    // 5. Car Wheels (4 tires with steering animation on front wheels)
    const wheelW = 5;
    const wheelH = 15;

    // Front-Left Wheel (Animated rotation with steering)
    ctx.save();
    ctx.translate(-this.width / 2 + 1, -this.height / 2 + 17);
    ctx.rotate(this.wheelAngle);
    ctx.fillStyle = '#111827';
    ctx.fillRect(-wheelW / 2, -wheelH / 2, wheelW, wheelH);
    ctx.fillStyle = '#64748b'; // Rim detail
    ctx.fillRect(-1, -3, 2, 6);
    ctx.restore();

    // Front-Right Wheel (Animated rotation with steering)
    ctx.save();
    ctx.translate(this.width / 2 - 1, -this.height / 2 + 17);
    ctx.rotate(this.wheelAngle);
    ctx.fillStyle = '#111827';
    ctx.fillRect(-wheelW / 2, -wheelH / 2, wheelW, wheelH);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-1, -3, 2, 6);
    ctx.restore();

    // Rear-Left Wheel (Fixed)
    ctx.fillStyle = '#111827';
    ctx.fillRect(-this.width / 2 - 2, this.height / 2 - 22, wheelW, wheelH);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-this.width / 2, this.height / 2 - 19, 2, 6);

    // Rear-Right Wheel (Fixed)
    ctx.fillStyle = '#111827';
    ctx.fillRect(this.width / 2 - wheelW + 2, this.height / 2 - 22, wheelW, wheelH);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(this.width / 2 - 2, this.height / 2 - 19, 2, 6);

    // 6. Main Chassis / Body (with suspension bounce and archetype livery)
    ctx.save();
    ctx.translate(0, this.bounceY);

    const bodyGrad = ctx.createLinearGradient(0, -this.height / 2, 0, this.height / 2);
    bodyGrad.addColorStop(0, arch.primaryColor);
    bodyGrad.addColorStop(0.5, arch.secondaryColor);
    bodyGrad.addColorStop(1, '#090d16');

    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = arch.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, [14, 14, 8, 8]);
    ctx.fill();
    ctx.stroke();

    // 7. Hood Vent / Aerodynamic Stripes
    ctx.fillStyle = '#061a29';
    ctx.beginPath();
    ctx.moveTo(-6, -this.height / 2 + 8);
    ctx.lineTo(6, -this.height / 2 + 8);
    ctx.lineTo(8, -this.height / 2 + 22);
    ctx.lineTo(-8, -this.height / 2 + 22);
    ctx.closePath();
    ctx.fill();

    // 8. Cockpit Windshield (Tinted glass with reflection)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(-this.width / 2 + 5, -this.height / 2 + 25, this.width - 10, 24, [6, 6, 2, 2]);
    ctx.fill();

    // Glass reflection line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-this.width / 2 + 9, -this.height / 2 + 28);
    ctx.lineTo(-this.width / 2 + 16, -this.height / 2 + 45);
    ctx.stroke();

    // Roof & Rear Glass
    ctx.fillStyle = '#0a101d';
    ctx.beginPath();
    ctx.roundRect(-this.width / 2 + 6, -this.height / 2 + 35, this.width - 12, 16, 3);
    ctx.fill();

    // 9. Rear Spoiler
    ctx.fillStyle = arch.accentColor;
    ctx.fillRect(-this.width / 2 + 2, this.height / 2 - 6, this.width - 4, 4);

    // 10. Headlights (LED White)
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.fillRect(-this.width / 2 + 4, -this.height / 2 + 1, 6, 3);
    ctx.fillRect(this.width / 2 - 10, -this.height / 2 + 1, 6, 3);

    // 11. Taillights (Glowing Red)
    const isBraking = inputs && inputs.down;
    ctx.fillStyle = isBraking ? '#ff1e27' : '#c9182b';
    ctx.shadowColor = '#ff1e27';
    ctx.shadowBlur = isBraking ? 10 : 4;
    ctx.fillRect(-this.width / 2 + 3, this.height / 2 - 3, 8, 3);
    ctx.fillRect(this.width / 2 - 11, this.height / 2 - 3, 8, 3);

    // Restore chassis bounce translation
    ctx.restore();

    // Restore car center translation and angle rotation
    ctx.restore();
  }

  reset(x, y) {
    this.x = x - this.width / 2;
    this.y = y;
    this.speed = 0;
    this.vx = 0;
    this.wheelAngle = 0;
    this.bounceY = 0;
    this.angle = 0;
    this.targetAngle = 0;
    this.health = this.maxHealth;
    this.nitro = 100;
    this.isNitroActive = false;
    this.unlimitedRockets = true;
    this.rockets = Infinity;
    this.rocketCooldown = 0;
    this.skidMarks = [];
    this.isDrifting = false;
  }
}

/**
 * TrafficCar: Individual AI vehicle on the road
 */
class TrafficCar {
  constructor(x, y, type = 'sedan', speed = 5) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.speed = speed;

    // Vehicle specs based on model type
    switch (type) {
      case 'sports':
        this.width = 36;
        this.height = 68;
        this.color = '#ff0055';
        this.accent = '#ff5c8d';
        break;
      case 'truck':
        this.width = 44;
        this.height = 92;
        this.color = '#e07a5f';
        this.accent = '#3d405b';
        break;
      case 'taxi':
        this.width = 38;
        this.height = 72;
        this.color = '#ffb703';
        this.accent = '#fb8500';
        break;
      case 'tanker':
        this.width = 46;
        this.height = 104;
        this.color = '#d90429';
        this.accent = '#edf2f4';
        this.isTanker = true;
        break;
      case 'police':
        this.width = 38;
        this.height = 72;
        this.color = '#0b0f19';
        this.accent = '#00f0ff';
        this.isPolice = true;
        break;
      case 'sedan':
      default:
        this.width = 38;
        this.height = 72;
        this.color = '#3a86ff';
        this.accent = '#0055d4';
        break;
    }

    // Align center
    this.x -= this.width / 2;
  }

  update(playerSpeed) {
    // Movement relative to player's scroll speed
    this.y += (playerSpeed - this.speed);
  }

  getBounds() {
    return {
      x: this.x + 3,
      y: this.y + 4,
      width: this.width - 6,
      height: this.height - 8
    };
  }

  draw(ctx) {
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(this.x + 2, this.y + 3, this.width, this.height, 6);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#111';
    const wheelW = 4;
    const wheelH = 12;
    ctx.fillRect(this.x - 2, this.y + 10, wheelW, wheelH);
    ctx.fillRect(this.x + this.width - 2, this.y + 10, wheelW, wheelH);
    ctx.fillRect(this.x - 2, this.y + this.height - 20, wheelW, wheelH);
    ctx.fillRect(this.x + this.width - 2, this.y + this.height - 20, wheelW, wheelH);

    // Car Body
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, [8, 8, 6, 6]);
    ctx.fill();
    ctx.stroke();

    // Windshield & Roof & Special Model Elements
    ctx.fillStyle = '#1e293b';
    const windshieldY = this.type === 'truck' ? this.y + 14 : (this.type === 'tanker' ? this.y + 12 : this.y + 22);
    const windshieldH = (this.type === 'truck' || this.type === 'tanker') ? 14 : 20;
    ctx.fillRect(this.x + 4, windshieldY, this.width - 8, windshieldH);

    // Truck Cargo Bed or Sedan Trunk or Tanker Tank or Police Lightbar
    if (this.type === 'truck') {
      ctx.fillStyle = this.accent;
      ctx.fillRect(this.x + 3, this.y + 34, this.width - 6, this.height - 38);
      // Cargo lines
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      for (let ly = this.y + 45; ly < this.y + this.height - 8; ly += 14) {
        ctx.beginPath();
        ctx.moveTo(this.x + 4, ly);
        ctx.lineTo(this.x + this.width - 4, ly);
        ctx.stroke();
      }
    } else if (this.type === 'tanker') {
      // Chrome/Silver fuel tank cylinder with hazardous markings
      const tankGrad = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
      tankGrad.addColorStop(0, '#475569');
      tankGrad.addColorStop(0.3, '#f1f5f9');
      tankGrad.addColorStop(0.7, '#e2e8f0');
      tankGrad.addColorStop(1, '#334155');
      ctx.fillStyle = tankGrad;
      ctx.beginPath();
      ctx.roundRect(this.x + 3, this.y + 28, this.width - 6, this.height - 32, 10);
      ctx.fill();

      // Flammable hazard diagonal stripes
      ctx.fillStyle = '#f59e0b';
      for (let sy = this.y + 38; sy < this.y + this.height - 10; sy += 18) {
        ctx.fillRect(this.x + 6, sy, this.width - 12, 5);
      }
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 7px monospace';
      ctx.fillText('HAZMAT', this.x + 8, this.y + 54);
    } else if (this.type === 'police') {
      // Cruiser white roof and doors
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(this.x + 5, this.y + 24, this.width - 10, 24);
      // Emergency flashing lightbar (Red & Blue alternating)
      const flash = Math.floor(Date.now() / 120) % 2 === 0;
      const leftLight = flash ? '#ff0033' : '#0066ff';
      const rightLight = flash ? '#0066ff' : '#ff0033';
      ctx.fillStyle = leftLight;
      ctx.shadowColor = leftLight;
      ctx.shadowBlur = 8;
      ctx.fillRect(this.x + this.width / 2 - 10, this.y + 28, 8, 5);
      ctx.fillStyle = rightLight;
      ctx.shadowColor = rightLight;
      ctx.shadowBlur = 8;
      ctx.fillRect(this.x + this.width / 2 + 2, this.y + 28, 8, 5);
      ctx.shadowBlur = 0;
    } else if (this.type === 'taxi') {
      // Taxi checker / roof sign
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.x + this.width / 2 - 8, this.y + 34, 16, 6);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 5px sans-serif';
      ctx.fillText('TAXI', this.x + this.width / 2 - 6, this.y + 39);
    }

    // Headlights
    ctx.fillStyle = '#fffffa';
    ctx.fillRect(this.x + 3, this.y + 1, 5, 2);
    ctx.fillRect(this.x + this.width - 8, this.y + 1, 5, 2);

    // Taillights
    ctx.fillStyle = '#d90429';
    ctx.fillRect(this.x + 3, this.y + this.height - 3, 6, 2);
    ctx.fillRect(this.x + this.width - 9, this.y + this.height - 3, 6, 2);

    ctx.restore();
  }
}

/**
 * TrafficManager: Manages population, spawning, and collisions of AI vehicles
 */
class TrafficManager {
  constructor(road) {
    this.road = road;
    this.traffic = [];
    this.distanceSinceSpawn = 0;
    this.minSpawnDistance = 240; // distance between spawns
    this.types = ['sports', 'sedan', 'sedan', 'truck', 'taxi', 'tanker', 'police'];
  }

  update(playerSpeed, playerDistance) {
    // Increase traffic density and difficulty slightly as distance increases
    const currentSpawnInterval = Math.max(160, this.minSpawnDistance - Math.min(80, playerDistance / 200));

    this.distanceSinceSpawn += playerSpeed;
    if (this.distanceSinceSpawn >= currentSpawnInterval) {
      this.distanceSinceSpawn = 0;
      this.spawnTraffic();
    }

    // Update traffic positions
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const car = this.traffic[i];
      car.update(playerSpeed);

      // Despawn vehicles far off screen (ahead or behind)
      if (car.y > this.road.canvasHeight + 150 || car.y < -300) {
        this.traffic.splice(i, 1);
      }
    }
  }

  spawnTraffic() {
    if (this.traffic.length >= 7) return;

    // Pick a lane
    const lane = Math.floor(Math.random() * this.road.laneCount);
    const x = this.road.getLaneCenter(lane);
    const y = -120; // Spawn off the top of screen

    // Ensure no other car is currently occupying the spawn zone
    const isOccupied = this.traffic.some(c => Math.abs(c.x - x) < 40 && Math.abs(c.y - y) < 140);
    if (isOccupied) return;

    // Randomize vehicle type & speed
    const type = this.types[Math.floor(Math.random() * this.types.length)];
    let speed = 4 + Math.random() * 3.5;
    if (type === 'sports') speed = 7 + Math.random() * 2.5;
    if (type === 'truck') speed = 3 + Math.random() * 2;
    if (type === 'tanker') speed = 2.8 + Math.random() * 1.5;
    if (type === 'police') speed = 6.8 + Math.random() * 2.8;

    this.traffic.push(new TrafficCar(x, y, type, speed));
  }

  checkCollision(player) {
    const pBox = player.getBounds();

    for (let i = 0; i < this.traffic.length; i++) {
      const t = this.traffic[i];
      const tBox = t.getBounds();

      // Standard AABB overlap test
      if (
        pBox.x < tBox.x + tBox.width &&
        pBox.x + pBox.width > tBox.x &&
        pBox.y < tBox.y + tBox.height &&
        pBox.y + pBox.height > tBox.y
      ) {
        // Calculate collision severity based on relative speed
        const speedDiff = Math.abs(player.speed - t.speed);
        const damage = Math.round(18 + speedDiff * 3.2);

        // Knockback AI car slightly
        t.y -= 25;

        return { hit: true, damage, trafficCar: t };
      }
    }
    return { hit: false };
  }

  checkRocketHits(rockets) {
    const hits = [];
    for (let r = rockets.length - 1; r >= 0; r--) {
      const rocket = rockets[r];
      const rBox = rocket.getBounds();

      for (let t = this.traffic.length - 1; t >= 0; t--) {
        const car = this.traffic[t];
        const cBox = car.getBounds();

        // Standard AABB overlap collision check
        if (
          rBox.x < cBox.x + cBox.width &&
          rBox.x + rBox.width > cBox.x &&
          rBox.y < cBox.y + cBox.height &&
          rBox.y + rBox.height > cBox.y
        ) {
          const isTanker = car.type === 'tanker';
          const blastX = car.x + car.width / 2;
          const blastY = car.y + car.height / 2;

          hits.push({
            x: blastX,
            y: blastY,
            type: car.type,
            isTanker: isTanker
          });

          // Remove destroyed traffic car and consumed rocket
          this.traffic.splice(t, 1);
          rockets.splice(r, 1);

          // Fuel tanker chain-reaction explosion destroys nearby traffic vehicles!
          if (isTanker) {
            for (let j = this.traffic.length - 1; j >= 0; j--) {
              const other = this.traffic[j];
              const dist = Math.hypot((other.x + other.width / 2) - blastX, (other.y + other.height / 2) - blastY);
              if (dist < 130) {
                hits.push({
                  x: other.x + other.width / 2,
                  y: other.y + other.height / 2,
                  type: other.type,
                  chainReaction: true
                });
                this.traffic.splice(j, 1);
              }
            }
          }
          break;
        }
      }
    }
    return hits;
  }

  draw(ctx) {
    for (const car of this.traffic) {
      car.draw(ctx);
    }
  }

  reset() {
    this.traffic = [];
    this.distanceSinceSpawn = 0;
  }
}

/**
 * Rocket: Player-fired high-velocity missile to destroy traffic obstacles
 */
class Rocket {
  constructor(x, y, playerSpeed = 10) {
    this.x = x;
    this.y = y;
    this.width = 10;
    this.height = 24;
    this.speed = Math.max(26, playerSpeed + 16);
  }

  update(dtNorm = 1.0) {
    this.y -= this.speed * dtNorm;
  }

  getBounds() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      width: this.width,
      height: this.height
    };
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. Thruster Exhaust Flame
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 12;

    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(-3, this.height / 2);
    ctx.lineTo(0, this.height / 2 + 14 + Math.random() * 5);
    ctx.lineTo(3, this.height / 2);
    ctx.fill();

    ctx.fillStyle = '#ffff66';
    ctx.beginPath();
    ctx.moveTo(-1.5, this.height / 2);
    ctx.lineTo(0, this.height / 2 + 8 + Math.random() * 3);
    ctx.lineTo(1.5, this.height / 2);
    ctx.fill();

    // 2. Rocket Fuselage (Aerodynamic Body)
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(-this.width / 2, -this.height / 2 + 6, this.width, this.height - 6, 2);
    ctx.fill();

    // 3. Warhead Nose Cone (Crimson / Neon Red)
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.moveTo(-this.width / 2, -this.height / 2 + 6);
    ctx.lineTo(0, -this.height / 2 - 4);
    ctx.lineTo(this.width / 2, -this.height / 2 + 6);
    ctx.closePath();
    ctx.fill();

    // 4. Stabilizer Tail Fins (Cyan)
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(-this.width / 2, this.height / 2 - 7);
    ctx.lineTo(-this.width / 2 - 4, this.height / 2 + 2);
    ctx.lineTo(-this.width / 2, this.height / 2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(this.width / 2, this.height / 2 - 7);
    ctx.lineTo(this.width / 2 + 4, this.height / 2 + 2);
    ctx.lineTo(this.width / 2, this.height / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PlayerCar, TrafficCar, TrafficManager, Rocket, VEHICLE_ARCHETYPES };
}
