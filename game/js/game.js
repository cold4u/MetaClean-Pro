/**
 * Main Game Loop, Synthesizer Audio Engine, Input Management, and UI
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

/**
 * Safe Storage helper to prevent DOMException / SecurityError in sandboxed iframes
 */
const SafeStorage = {
  getItem: (key, defaultVal = null) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        return val !== null ? val : defaultVal;
      }
    } catch (e) {}
    return defaultVal;
  },
  setItem: (key, val) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, String(val));
      }
    } catch (e) {}
  }
};

class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.isMuted = SafeStorage.getItem('turbo_drive_muted', 'false') === 'true';
    this.isMusicMuted = SafeStorage.getItem('turbo_drive_music_muted', 'false') === 'true';
    this.engineOsc = null;
    this.engineSub = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.musicTimer = null;
    this.musicMasterGain = null;
    this.currentStep = 0;
    this.nextNoteTime = 0;
  }

  init() {
    if (this.audioCtx) {
      try {
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
      } catch (e) {}
      if (!this.musicMasterGain) {
        this.setupMusicBus();
      }
      return;
    }
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
        this.setupMusicBus();
      }
    } catch (e) {
      console.warn('Web Audio API not available or blocked in this environment', e);
    }
  }

  setupMusicBus() {
    if (!this.audioCtx || this.musicMasterGain) return;
    try {
      this.musicMasterGain = this.audioCtx.createGain();
      this.musicMasterGain.gain.setValueAtTime(this.isMusicMuted ? 0.0001 : 0.13, this.audioCtx.currentTime);
      this.musicMasterGain.connect(this.audioCtx.destination);
    } catch (e) {}
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    SafeStorage.setItem('turbo_drive_muted', this.isMuted);
    if (this.isMuted) {
      this.stopEngine();
    }
    return !this.isMuted;
  }

  startEngine() {
    if (this.isMuted || !this.audioCtx || this.engineOsc) return;

    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const now = this.audioCtx.currentTime;

      // 1. Fundamental Engine Oscillator (Sawtooth - raspy exhaust tone)
      this.engineOsc = this.audioCtx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(52, now);

      // 2. Sub-Harmonic Oscillator (Triangle - deep cylinder thump)
      this.engineSub = this.audioCtx.createOscillator();
      this.engineSub.type = 'triangle';
      this.engineSub.frequency.setValueAtTime(26, now);

      // 3. Dynamic Low-Pass Resonance Filter
      this.engineFilter = this.audioCtx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(320, now);
      this.engineFilter.Q.setValueAtTime(2.2, now);

      // 4. Master Engine Gain
      this.engineGain = this.audioCtx.createGain();
      this.engineGain.gain.setValueAtTime(0.065, now);

      // Routing
      this.engineOsc.connect(this.engineFilter);
      this.engineSub.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.audioCtx.destination);

      this.engineOsc.start();
      this.engineSub.start();
    } catch (e) {
      // Audio autoplay policy catch
    }
  }

  updateEngineWithGear(gear, rpm, isAccelerating, isBraking, isNitro) {
    if (this.isMuted || !this.audioCtx || !this.engineOsc) return;
    try {
      const now = this.audioCtx.currentTime;

      // Pitch profiles tuned per gear
      let baseFreq = 48;
      let freqRange = 75;

      switch (gear) {
        case '1': baseFreq = 48; freqRange = 85; break;
        case '2': baseFreq = 62; freqRange = 95; break;
        case '3': baseFreq = 78; freqRange = 105; break;
        case '4': baseFreq = 96; freqRange = 115; break;
        case '5': baseFreq = 116; freqRange = 125; break;
        case '6': baseFreq = 138; freqRange = 145; break;
        case 'N':
        default:
          baseFreq = 46; freqRange = 40; break;
      }

      let targetFreq = baseFreq + (rpm * freqRange);
      if (isNitro) targetFreq += 45;

      // Update primary oscillator & sub-harmonic
      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.04);
      if (this.engineSub) {
        this.engineSub.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.04);
      }

      // Dynamic Filter & Throttle Acoustics
      let targetFilter = 320;
      let targetGain = 0.06;

      if (isNitro) {
        targetFilter = 1800 + rpm * 1600;
        targetGain = 0.095;
      } else if (isAccelerating) {
        targetFilter = 500 + rpm * 1700;
        targetGain = 0.08;
      } else if (isBraking) {
        targetFilter = 280 + rpm * 300;
        targetGain = 0.045;
      } else {
        // Coasting
        targetFilter = 340 + rpm * 400;
        targetGain = 0.055;
      }

      this.engineFilter.frequency.setTargetAtTime(targetFilter, now, 0.05);
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
    } catch (e) {}
  }

  playShiftPop() {
    if (this.isMuted || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;

      // 1. Low Thud / Backfire Pop
      const thudOsc = this.audioCtx.createOscillator();
      const thudGain = this.audioCtx.createGain();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(95, now);
      thudOsc.frequency.exponentialRampToValueAtTime(32, now + 0.07);

      thudGain.gain.setValueAtTime(0.28, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      thudOsc.connect(thudGain);
      thudGain.connect(this.audioCtx.destination);
      thudOsc.start(now);
      thudOsc.stop(now + 0.08);

      // 2. High exhaust crackle / puff
      const crackleBuffer = this.audioCtx.createBuffer(1, Math.floor(this.audioCtx.sampleRate * 0.04), this.audioCtx.sampleRate);
      const crackleData = crackleBuffer.getChannelData(0);
      for (let i = 0; i < crackleData.length; i++) {
        crackleData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (crackleData.length * 0.3));
      }
      const crackle = this.audioCtx.createBufferSource();
      crackle.buffer = crackleBuffer;
      const crackleFilter = this.audioCtx.createBiquadFilter();
      crackleFilter.type = 'bandpass';
      crackleFilter.frequency.setValueAtTime(900, now);
      const crackleGain = this.audioCtx.createGain();
      crackleGain.gain.setValueAtTime(0.18, now);
      crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      crackle.connect(crackleFilter);
      crackleFilter.connect(crackleGain);
      crackleGain.connect(this.audioCtx.destination);
      crackle.start(now);
    } catch (e) {}
  }

  stopEngine() {
    if (!this.engineOsc && !this.engineSub) return;
    try {
      this.engineGain.gain.linearRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);
      setTimeout(() => {
        if (this.engineOsc) {
          try { this.engineOsc.stop(); } catch (e) {}
          this.engineOsc.disconnect();
          this.engineOsc = null;
        }
        if (this.engineSub) {
          try { this.engineSub.stop(); } catch (e) {}
          this.engineSub.disconnect();
          this.engineSub = null;
        }
      }, 120);
    } catch (e) {
      this.engineOsc = null;
      this.engineSub = null;
    }
  }

  playCrash() {
    if (this.isMuted || !this.audioCtx) return;
    try {
      const duration = 0.45;
      const bufferSize = this.audioCtx.sampleRate * duration;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, this.audioCtx.currentTime);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);
      noise.start();
    } catch (e) {}
  }

  playCoin() {
    if (this.isMuted || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  playNitro() {
    if (this.isMuted || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.22);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  playRepair() {
    if (this.isMuted || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.07);
      osc.frequency.setValueAtTime(659.25, now + 0.14);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  playRocketLaunch(x = 225) {
    if (this.isMuted || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const panner = this.createPanner(x);
      const destination = panner || this.audioCtx.destination;

      // 1. Tonal rocket launch whoosh
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(860, now + 0.18);

      oscGain.gain.setValueAtTime(0.20, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(oscGain);
      oscGain.connect(destination);
      osc.start(now);
      osc.stop(now + 0.22);

      // 2. Thruster whoosh noise
      const bufSize = Math.floor(this.audioCtx.sampleRate * 0.22);
      const buf = this.audioCtx.createBuffer(1, bufSize, this.audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.35));
      }
      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buf;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(550, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + 0.2);

      const noiseGain = this.audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.22, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(destination);
      noise.start(now);
    } catch (e) {}
  }

  playExplosion(x = 225, isBig = false) {
    if (this.isMuted || !this.audioCtx) return;
    this.duckMusic();
    try {
      const now = this.audioCtx.currentTime;
      const panner = this.createPanner(x);
      const destination = panner || this.audioCtx.destination;

      // 1. Sub-bass boom
      const boomOsc = this.audioCtx.createOscillator();
      const boomGain = this.audioCtx.createGain();
      boomOsc.type = 'sine';
      boomOsc.frequency.setValueAtTime(isBig ? 240 : 160, now);
      boomOsc.frequency.exponentialRampToValueAtTime(isBig ? 18 : 28, now + (isBig ? 0.48 : 0.35));

      boomGain.gain.setValueAtTime(isBig ? 0.75 : 0.55, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + (isBig ? 0.52 : 0.38));

      boomOsc.connect(boomGain);
      boomGain.connect(destination);
      boomOsc.start(now);
      boomOsc.stop(now + (isBig ? 0.52 : 0.38));

      // 2. Fireball noise crackle and rumble
      const duration = isBig ? 0.65 : 0.48;
      const bufSize = Math.floor(this.audioCtx.sampleRate * duration);
      const buffer = this.audioCtx.createBuffer(1, bufSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
      }
      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isBig ? 900 : 680, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + duration);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(isBig ? 0.60 : 0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      noise.start(now);
    } catch (e) {}
  }

  playNearMiss() {
    if (this.isMuted || !this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(1080, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch (e) {}
  }

  createPanner(x = 225) {
    if (!this.audioCtx || !this.audioCtx.createStereoPanner) return null;
    try {
      const panner = this.audioCtx.createStereoPanner();
      const pan = Math.max(-0.85, Math.min(0.85, (x - 225) / 225));
      panner.pan.setValueAtTime(pan, this.audioCtx.currentTime);
      panner.connect(this.audioCtx.destination);
      return panner;
    } catch (e) {
      return null;
    }
  }

  duckMusic() {
    if (!this.musicMasterGain || !this.audioCtx || this.isMusicMuted) return;
    try {
      const now = this.audioCtx.currentTime;
      this.musicMasterGain.gain.cancelScheduledValues(now);
      this.musicMasterGain.gain.setValueAtTime(0.03, now);
      this.musicMasterGain.gain.exponentialRampToValueAtTime(0.13, now + 0.35);
    } catch (e) {}
  }

  startMusic() {
    if (!this.audioCtx) return;
    if (this.musicTimer) return;
    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      this.setupMusicBus();
      this.nextNoteTime = this.audioCtx.currentTime + 0.05;
      this.currentStep = 0;
      this.musicTimer = setInterval(() => this.scheduleMusic(), 40);
    } catch (e) {}
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  toggleMusic() {
    this.isMusicMuted = !this.isMusicMuted;
    SafeStorage.setItem('turbo_drive_music_muted', this.isMusicMuted);
    if (this.musicMasterGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.musicMasterGain.gain.setValueAtTime(this.isMusicMuted ? 0.0001 : 0.13, now);
    }
    return !this.isMusicMuted;
  }

  scheduleMusic() {
    if (this.isMusicMuted || !this.audioCtx || this.audioCtx.state === 'suspended' || !this.musicMasterGain) return;
    const lookahead = 0.18;
    while (this.nextNoteTime < this.audioCtx.currentTime + lookahead) {
      this.playStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += 0.125; // 120 BPM 16th note = 125ms
      this.currentStep = (this.currentStep + 1) % 32;
    }
  }

  playStep(step, time) {
    if (!this.audioCtx || !this.musicMasterGain) return;
    try {
      // 1. Kick on quarter beats (0, 4, 8, 12, 16, 20, 24, 28)
      if (step % 4 === 0) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(145, time);
        osc.frequency.exponentialRampToValueAtTime(34, time + 0.09);
        gain.gain.setValueAtTime(0.40, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
        osc.connect(gain);
        gain.connect(this.musicMasterGain);
        osc.start(time);
        osc.stop(time + 0.11);
      }

      // 2. Snare on beats 2 & 4 (steps 4, 12, 20, 28)
      if (step % 8 === 4) {
        const bufSize = Math.floor(this.audioCtx.sampleRate * 0.07);
        const buf = this.audioCtx.createBuffer(1, bufSize, this.audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.28));
        }
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buf;
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, time);
        const snGain = this.audioCtx.createGain();
        snGain.gain.setValueAtTime(0.24, time);
        snGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
        noise.connect(filter);
        filter.connect(snGain);
        snGain.connect(this.musicMasterGain);
        noise.start(time);
      }

      // 3. Rolling Analog 16th Synth Bass (A-minor progression)
      // Measures: Steps 0-7: A1 (55Hz), Steps 8-15: F1 (43.65Hz), Steps 16-23: D1 (36.7Hz), Steps 24-31: E1 (41.2Hz)
      let rootFreq = 55;
      if (step >= 8 && step < 16) rootFreq = 43.65;
      else if (step >= 16 && step < 24) rootFreq = 36.7;
      else if (step >= 24) rootFreq = 41.2;

      const noteFreq = (step % 2 === 1) ? rootFreq * 2 : rootFreq;
      const bassOsc = this.audioCtx.createOscillator();
      const bassFilter = this.audioCtx.createBiquadFilter();
      const bassGain = this.audioCtx.createGain();

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(noteFreq, time);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(380, time);
      bassFilter.frequency.exponentialRampToValueAtTime(120, time + 0.11);
      bassFilter.Q.setValueAtTime(3.0, time);

      bassGain.gain.setValueAtTime(0.18, time);
      bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.115);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.musicMasterGain);
      bassOsc.start(time);
      bassOsc.stop(time + 0.115);

      // 4. Synthwave Lead Melody on syncopated 16th steps
      const arpSteps = [0, 3, 6, 8, 11, 14, 16, 19, 22, 24, 27, 30];
      if (arpSteps.includes(step)) {
        const leadNotes = [220, 261.63, 293.66, 329.63, 392.00, 440, 523.25];
        const leadFreq = leadNotes[(step * 3) % leadNotes.length];
        const leadOsc = this.audioCtx.createOscillator();
        const leadGain = this.audioCtx.createGain();
        leadOsc.type = 'triangle';
        leadOsc.frequency.setValueAtTime(leadFreq, time);
        leadGain.gain.setValueAtTime(0.08, time);
        leadGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
        leadOsc.connect(leadGain);
        leadGain.connect(this.musicMasterGain);
        leadOsc.start(time);
        leadOsc.stop(time + 0.14);
      }
    } catch (e) {}
  }
}

/**
 * PopupFX: Animated floating arcade combat popups (Direct hit, near-miss, combos)
 */
class PopupFX {
  constructor() {
    this.popups = [];
  }

  add(text, x, y, color = '#00f0ff', scale = 1.0) {
    this.popups.push({
      text,
      x,
      y,
      vy: -1.7,
      alpha: 1.0,
      decay: 0.016,
      scale: 0.4,
      targetScale: scale,
      color
    });
  }

  update() {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y += p.vy;
      p.scale += (p.targetScale - p.scale) * 0.22;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.popups.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.popups) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale, p.scale);
      ctx.font = '900 13px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.strokeText(p.text, 0, 0);

      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }

  clear() {
    this.popups = [];
  }
}

/**
 * ParticleFX: Impact sparks, tire smoke, and nitro trails
 */
class ParticleFX {
  constructor() {
    this.particles = [];
  }

  addSparks(x, y, count = 16, color = '#ff0055') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.04,
        size: 2 + Math.random() * 3,
        growth: 0,
        color
      });
    }
  }

  addSmoke(x, y, count = 2) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() * 10 - 5),
        y: y + (Math.random() * 6 - 3),
        vx: (Math.random() - 0.5) * 1.8,
        vy: 1.2 + Math.random() * 2,
        life: 0.7,
        decay: 0.032,
        size: 5 + Math.random() * 5,
        growth: 0.4,
        color: 'rgba(215, 225, 240, 0.45)'
      });
    }
  }

  addNitroSparks(x, y, count = 2) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() * 14 - 7),
        y: y + Math.random() * 10,
        vx: (Math.random() - 0.5) * 2,
        vy: 4 + Math.random() * 4,
        life: 0.45,
        decay: 0.05,
        size: 1.5 + Math.random() * 2.5,
        growth: 0,
        color: Math.random() > 0.35 ? '#00f0ff' : '#ffffff'
      });
    }
  }

  addRocketTrail(x, y) {
    this.particles.push({
      x: x + (Math.random() * 4 - 2),
      y: y + 8,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 2 + Math.random() * 2.5,
      life: 0.45,
      decay: 0.05,
      size: 3 + Math.random() * 3,
      growth: 0.15,
      color: Math.random() > 0.4 ? '#ff6600' : '#ffff00'
    });
  }

  addExplosion(x, y) {
    // 1. Expanding fireball core
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 6.5;
      const colors = ['#ffffff', '#ffff00', '#ff8800', '#ff0055', '#ff3300'];
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.024 + Math.random() * 0.03,
        size: 4 + Math.random() * 6,
        growth: -0.04,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    // 2. Flying metal debris & shrapnel
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 8;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.9,
        decay: 0.032,
        size: 2 + Math.random() * 3,
        growth: 0,
        color: Math.random() > 0.5 ? '#ffd700' : '#64748b'
      });
    }

    // 3. Billowing smoke clouds
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 2.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.018,
        size: 8 + Math.random() * 8,
        growth: 0.45,
        color: 'rgba(30, 35, 45, 0.65)'
      });
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.growth) p.size += p.growth;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.color.startsWith('#')) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }
}

/**
 * SpeedLines: Dynamic high-velocity motion streaks
 */
class SpeedLines {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.lines = [];
    for (let i = 0; i < 22; i++) {
      this.lines.push({
        x: Math.random() * width,
        y: Math.random() * height,
        length: 25 + Math.random() * 70,
        speed: 12 + Math.random() * 16,
        alpha: 0.15 + Math.random() * 0.35
      });
    }
  }

  update(playerSpeed, isNitro) {
    const factor = isNitro ? 1.85 : 1.1;
    for (const l of this.lines) {
      l.y += (playerSpeed * 1.4 + l.speed) * factor;
      if (l.y > this.height) {
        l.y = -l.length - 30;
        l.x = Math.random() * this.width;
        l.length = (25 + Math.random() * 80) * (isNitro ? 1.6 : 1.0);
      }
    }
  }

  draw(ctx, playerSpeed, isNitro) {
    if (playerSpeed < 8 && !isNitro) return;
    const baseAlpha = Math.min(0.65, (playerSpeed / 32) * 0.7);

    ctx.save();
    ctx.strokeStyle = isNitro ? 'rgba(0, 240, 255, 0.7)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = isNitro ? 2.5 : 1.5;
    if (isNitro) {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
    }

    for (const l of this.lines) {
      ctx.globalAlpha = baseAlpha * l.alpha;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x, l.y + l.length);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * Game Controller & Main Engine Loop
 */
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // Internal Resolution
    this.width = 450;
    this.height = 700;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Subsystems
    this.road = new Road(this.width, this.height, 4);
    this.player = new PlayerCar(this.road.getLaneCenter(1), this.height - 140, this.road);
    this.trafficManager = new TrafficManager(this.road);
    this.sound = new SoundEngine();
    this.particles = new ParticleFX();
    this.popups = new PopupFX();
    this.speedLines = new SpeedLines(this.width, this.height);
    this.rockets = [];

    // Live Gear Shifting Hook
    this.player.onGearShift = (oldGear, newGear) => this.handleGearShift(oldGear, newGear);

    // Input States
    this.inputs = {
      up: false,
      down: false,
      left: false,
      right: false,
      nitro: false,
      space: false,
      rocket: false
    };

    // Game Lifecycle States: 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'
    this.state = 'START';

    // Game Metrics & Juice
    this.score = 0;
    this.distance = 0; // in meters
    this.coins = 0;
    this.topSpeedKmh = 0;
    this.bestScore = parseInt(SafeStorage.getItem('turbo_drive_highscore', '0'), 10);
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
    this.hitStop = 0; // micro-pause in milliseconds
    this.screenShake = 0;
    this.crtEnabled = SafeStorage.getItem('turbo_drive_crt', 'false') === 'true';
    this.autoGas = false;

    // Cache UI Elements
    this.initDOM();
    this.bindEvents();

    // Animation Loop
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  handleGearShift(oldGear, newGear) {
    this.sound.playShiftPop();
    if (this.dom.gearDisplay) {
      this.dom.gearDisplay.classList.add('shift-pulse');
      setTimeout(() => {
        if (this.dom.gearDisplay) this.dom.gearDisplay.classList.remove('shift-pulse');
      }, 160);
    }
    // Upshift exhaust crackle spark
    if (newGear > oldGear && this.player.speed > 3) {
      this.particles.addSparks(this.player.x + this.player.width / 2, this.player.y + this.player.height, 8, '#ffd700');
    }
  }

  initDOM() {
    this.dom = {
      bestScore: document.getElementById('bestScoreDisplay'),
      score: document.getElementById('scoreDisplay'),
      distance: document.getElementById('distanceDisplay'),
      coins: document.getElementById('coinCountDisplay'),
      rocketCountDisplay: document.getElementById('rocketCountDisplay'),
      comboBadge: document.getElementById('comboBadge'),
      comboMultiplier: document.getElementById('comboMultiplier'),
      crtOverlay: document.getElementById('crtOverlay'),
      healthFill: document.getElementById('healthFill'),
      healthText: document.getElementById('healthTextDisplay'),
      speedKmh: document.getElementById('speedKmh'),
      speedGauge: document.getElementById('speedGauge'),
      gearDisplay: document.getElementById('gearDisplay'),
      tachometerFill: document.getElementById('tachometerFill'),
      led1: document.getElementById('led1'),
      led2: document.getElementById('led2'),
      led3: document.getElementById('led3'),
      led4: document.getElementById('led4'),
      led5: document.getElementById('led5'),
      nitroPercent: document.getElementById('nitroPercent'),
      nitroGauge: document.getElementById('nitroGauge'),
      startModal: document.getElementById('startModal'),
      cardApex: document.getElementById('cardApex'),
      cardInterceptor: document.getElementById('cardInterceptor'),
      cardPhantom: document.getElementById('cardPhantom'),
      pauseModal: document.getElementById('pauseModal'),
      gameOverModal: document.getElementById('gameOverModal'),
      finalScore: document.getElementById('finalScore'),
      finalDistance: document.getElementById('finalDistance'),
      finalCoins: document.getElementById('finalCoins'),
      finalTopSpeed: document.getElementById('finalTopSpeed'),
      startBtn: document.getElementById('startBtn'),
      resumeBtn: document.getElementById('resumeBtn'),
      restartBtn: document.getElementById('restartBtn'),
      btnSoundToggle: document.getElementById('btnSoundToggle'),
      btnMusicToggle: document.getElementById('btnMusicToggle'),
      btnCrtToggle: document.getElementById('btnCrtToggle'),
      btnPauseToggle: document.getElementById('btnPauseToggle'),
      btnLeft: document.getElementById('btnLeft'),
      btnRight: document.getElementById('btnRight'),
      btnGas: document.getElementById('btnGas'),
      btnBrake: document.getElementById('btnBrake'),
      btnNitro: document.getElementById('btnNitro'),
      btnRocket: document.getElementById('btnRocket'),
      btnAutoGas: document.getElementById('btnAutoGas'),
      autoGasLabel: document.getElementById('autoGasLabel')
    };

    // Initialize displays
    if (this.dom.bestScore) this.dom.bestScore.textContent = this.bestScore.toLocaleString();
    if (this.crtEnabled && this.dom.crtOverlay) {
      this.dom.crtOverlay.classList.remove('hidden');
    }
    this.updateSoundButtonLabel();
    this.updateMusicButtonLabel();
    this.updateCrtButtonLabel();
  }

  bindEvents() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      this.sound.init();

      // If at START screen, any driving/action key starts the engine immediately!
      if (this.state === 'START') {
        if (['Space', 'Enter', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyN', 'KeyF'].includes(e.code)) {
          this.startGame();
        }
      }

      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.inputs.up = true;
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.inputs.down = true;
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.inputs.left = true;
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.inputs.right = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyN':
          this.inputs.nitro = true;
          e.preventDefault();
          break;
        case 'KeyF':
          if (this.state === 'PLAYING') {
            this.inputs.rocket = true;
            this.fireRocket();
          }
          e.preventDefault();
          break;
        case 'Space':
          if (this.state === 'GAMEOVER') {
            this.restartGame();
          } else if (this.state === 'PLAYING') {
            this.inputs.rocket = true;
            this.inputs.space = true;
            this.fireRocket();
          }
          e.preventDefault();
          break;
        case 'Enter':
          if (this.state === 'GAMEOVER') {
            this.restartGame();
          }
          e.preventDefault();
          break;
        case 'KeyP':
        case 'Escape':
          this.togglePause();
          e.preventDefault();
          break;
        case 'KeyM':
          this.toggleSound();
          e.preventDefault();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.inputs.up = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.inputs.down = false;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.inputs.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.inputs.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyN':
          this.inputs.nitro = false;
          break;
        case 'KeyF':
          this.inputs.rocket = false;
          break;
        case 'Space':
          this.inputs.space = false;
          this.inputs.rocket = false;
          break;
      }
    });

    // Mobile Haptic Feedback Helper
    const haptic = (ms = 15) => {
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(ms);
        }
      } catch (e) {}
    };

    // Touch & Button Click Handlers with Haptic Response
    const bindTouch = (elem, pressAction, releaseAction) => {
      if (!elem) return;
      const start = (e) => {
        e.preventDefault();
        this.sound.init();
        if (this.state === 'START') {
          this.startGame();
        }
        haptic(15);
        pressAction();
      };
      const stop = (e) => {
        e.preventDefault();
        if (releaseAction) releaseAction();
      };
      elem.addEventListener('pointerdown', start);
      elem.addEventListener('pointerup', stop);
      elem.addEventListener('pointercancel', stop);
      elem.addEventListener('pointerleave', stop);
    };

    bindTouch(this.dom.btnLeft, () => { this.inputs.left = true; }, () => { this.inputs.left = false; });
    bindTouch(this.dom.btnRight, () => { this.inputs.right = true; }, () => { this.inputs.right = false; });
    bindTouch(this.dom.btnGas, () => { this.inputs.up = true; }, () => { this.inputs.up = false; });
    bindTouch(this.dom.btnBrake, () => { this.inputs.down = true; }, () => { this.inputs.down = false; });
    bindTouch(this.dom.btnNitro, () => { this.inputs.nitro = true; }, () => { this.inputs.nitro = false; });
    bindTouch(this.dom.btnRocket, () => {
      this.inputs.rocket = true;
      this.fireRocket();
    }, () => {
      this.inputs.rocket = false;
    });

    if (this.dom.btnAutoGas) {
      this.dom.btnAutoGas.addEventListener('click', (e) => {
        e.preventDefault();
        this.sound.init();
        this.toggleAutoGas();
      });
    }

    // Garage Machine Selection Wiring
    const selectMachine = (key, card) => {
      this.player.setArchetype(key);
      [this.dom.cardApex, this.dom.cardInterceptor, this.dom.cardPhantom].forEach(c => c && c.classList.remove('active'));
      if (card) card.classList.add('active');
      this.sound.init();
      this.sound.playShiftPop();
      this.updateHUD();
    };

    if (this.dom.cardApex) {
      this.dom.cardApex.addEventListener('click', (e) => {
        e.stopPropagation();
        selectMachine('apex', this.dom.cardApex);
      });
    }
    if (this.dom.cardInterceptor) {
      this.dom.cardInterceptor.addEventListener('click', (e) => {
        e.stopPropagation();
        selectMachine('interceptor', this.dom.cardInterceptor);
      });
    }
    if (this.dom.cardPhantom) {
      this.dom.cardPhantom.addEventListener('click', (e) => {
        e.stopPropagation();
        selectMachine('phantom', this.dom.cardPhantom);
      });
    }

    // Buttons and Modals: Click on button or anywhere on start screen starts the game!
    if (this.dom.startBtn) {
      this.dom.startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startGame();
      });
    }
    if (this.dom.startModal) {
      this.dom.startModal.addEventListener('click', () => {
        this.startGame();
      });
    }
    if (this.dom.resumeBtn) this.dom.resumeBtn.addEventListener('click', () => this.togglePause());
    if (this.dom.restartBtn) this.dom.restartBtn.addEventListener('click', () => this.restartGame());
    if (this.dom.btnSoundToggle) this.dom.btnSoundToggle.addEventListener('click', () => this.toggleSound());
    if (this.dom.btnMusicToggle) this.dom.btnMusicToggle.addEventListener('click', () => this.toggleMusic());
    if (this.dom.btnCrtToggle) this.dom.btnCrtToggle.addEventListener('click', () => this.toggleCrt());
    if (this.dom.btnPauseToggle) this.dom.btnPauseToggle.addEventListener('click', () => this.togglePause());

    // Interactive Drag, Swipe & Tap Zone Steering on Canvas for Mobile
    let isDragging = false;
    let dragStartY = 0;
    let lastTapTime = 0;

    this.canvas.addEventListener('pointerdown', (e) => {
      this.sound.init();
      if (this.state === 'START') {
        this.startGame();
        return;
      }
      if (this.state !== 'PLAYING') return;

      const now = performance.now();
      // Double-tap on canvas to fire rocket immediately!
      if (now - lastTapTime < 280) {
        this.fireRocket();
        haptic(25);
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;

      isDragging = true;
      dragStartY = e.clientY;

      // Screen zone tap steering
      const rect = this.canvas.getBoundingClientRect();
      const clickRelX = (e.clientX - rect.left) / rect.width;
      if (clickRelX < 0.44) {
        this.inputs.left = true;
        this.inputs.right = false;
        haptic(10);
      } else if (clickRelX > 0.56) {
        this.inputs.right = true;
        this.inputs.left = false;
        haptic(10);
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging || this.state !== 'PLAYING') return;

      // Swipe up gesture for Nitro
      if (dragStartY - e.clientY > 45 && !this.player.isNitroActive) {
        this.inputs.nitro = true;
        haptic(20);
      }

      const rect = this.canvas.getBoundingClientRect();
      const currentX = (e.clientX - rect.left) * (this.width / rect.width);
      if (currentX < this.player.x + this.player.width / 2 - 12) {
        this.inputs.left = true;
        this.inputs.right = false;
      } else if (currentX > this.player.x + this.player.width / 2 + 12) {
        this.inputs.right = true;
        this.inputs.left = false;
      } else {
        this.inputs.left = false;
        this.inputs.right = false;
      }
    });

    const stopDrag = () => {
      if (isDragging) {
        isDragging = false;
        this.inputs.left = false;
        this.inputs.right = false;
        this.inputs.nitro = false;
      }
    };

    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
  }

  toggleAutoGas() {
    this.autoGas = !this.autoGas;
    if (this.dom.btnAutoGas) {
      this.dom.btnAutoGas.classList.toggle('active', this.autoGas);
    }
    if (this.dom.autoGasLabel) {
      this.dom.autoGasLabel.textContent = this.autoGas ? 'AUTO: ON' : 'AUTO GAS';
    }
    this.sound.playShiftPop();
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    } catch (e) {}
  }

  fireRocket() {
    if (this.state !== 'PLAYING') return;
    const rocket = this.player.fireRocket();
    if (rocket) {
      this.rockets.push(rocket);
      this.sound.playRocketLaunch(rocket.x);
      this.updateHUD();
    }
  }

  toggleSound() {
    const isNowActive = this.sound.toggleMute();
    this.updateSoundButtonLabel();
    if (isNowActive && this.state === 'PLAYING') {
      this.sound.startEngine();
    }
  }

  updateSoundButtonLabel() {
    if (this.dom.btnSoundToggle) {
      this.dom.btnSoundToggle.textContent = this.sound.isMuted ? '🔇 SFX: OFF' : '🔊 SFX: ON';
    }
  }

  toggleMusic() {
    const isNowActive = this.sound.toggleMusic();
    this.updateMusicButtonLabel();
  }

  updateMusicButtonLabel() {
    if (this.dom.btnMusicToggle) {
      this.dom.btnMusicToggle.textContent = this.sound.isMusicMuted ? '🎵 Synth: OFF' : '🎵 Synth: ON';
    }
  }

  toggleCrt() {
    this.crtEnabled = !this.crtEnabled;
    SafeStorage.setItem('turbo_drive_crt', this.crtEnabled);
    if (this.dom.crtOverlay) {
      if (this.crtEnabled) {
        this.dom.crtOverlay.classList.remove('hidden');
      } else {
        this.dom.crtOverlay.classList.add('hidden');
      }
    }
    this.updateCrtButtonLabel();
  }

  updateCrtButtonLabel() {
    if (this.dom.btnCrtToggle) {
      this.dom.btnCrtToggle.textContent = this.crtEnabled ? '📺 CRT: ON' : '📺 CRT: OFF';
    }
  }

  triggerNearMiss(x, y) {
    this.comboMultiplier = Math.min(5.0, Number((this.comboMultiplier + 0.5).toFixed(1)));
    this.comboTimer = 220; // ~3.5 seconds decay
    const pts = Math.round(150 * this.comboMultiplier);
    this.score += pts;
    this.popups.add(`CLOSE CALL! +${pts}`, x, y, '#ff007f', 1.15);
    this.particles.addSparks(x, y, 8, '#ff007f');
    this.sound.playNearMiss();
    this.updateComboHUD();
  }

  updateComboHUD() {
    if (!this.dom.comboBadge || !this.dom.comboMultiplier) return;
    if (this.comboMultiplier > 1.0) {
      this.dom.comboBadge.classList.remove('hidden');
      this.dom.comboMultiplier.textContent = `${this.comboMultiplier.toFixed(1)}x`;
      this.dom.comboBadge.classList.add('combo-pulse');
      setTimeout(() => {
        if (this.dom.comboBadge) this.dom.comboBadge.classList.remove('combo-pulse');
      }, 150);
    } else {
      this.dom.comboBadge.classList.add('hidden');
    }
  }

  startGame() {
    try {
      this.sound.init();
      this.sound.startEngine();
      this.sound.startMusic();
    } catch (e) {
      console.warn('Audio start bypassed:', e);
    }
    this.state = 'PLAYING';
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
    this.updateComboHUD();

    if (this.dom.startModal) {
      this.dom.startModal.classList.add('hidden');
      this.dom.startModal.style.display = 'none';
    }
    if (this.dom.pauseModal) {
      this.dom.pauseModal.classList.add('hidden');
      this.dom.pauseModal.style.display = 'none';
    }
    if (this.dom.gameOverModal) {
      this.dom.gameOverModal.classList.add('hidden');
      this.dom.gameOverModal.style.display = 'none';
    }
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.sound.stopEngine();
      this.sound.stopMusic();
      if (this.dom.pauseModal) {
        this.dom.pauseModal.classList.remove('hidden');
        this.dom.pauseModal.style.display = 'flex';
      }
      if (this.dom.btnPauseToggle) this.dom.btnPauseToggle.textContent = '▶ Resume';
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.sound.startEngine();
      this.sound.startMusic();
      if (this.dom.pauseModal) {
        this.dom.pauseModal.classList.add('hidden');
        this.dom.pauseModal.style.display = 'none';
      }
      if (this.dom.btnPauseToggle) this.dom.btnPauseToggle.textContent = '⏸ Pause';
    }
  }

  restartGame() {
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.topSpeedKmh = 0;
    this.screenShake = 0;
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
    this.hitStop = 0;
    this.rockets = [];

    this.road.reset();
    this.player.reset(this.road.getLaneCenter(1), this.height - 140);
    this.trafficManager.reset();
    this.particles.clear();
    this.popups.clear();

    this.updateComboHUD();
    this.updateHUD();
    this.startGame();
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.hitStop = 0;
    this.sound.stopEngine();
    this.sound.stopMusic();
    this.sound.playCrash();

    // Check high score
    if (this.score > this.bestScore) {
      this.bestScore = Math.floor(this.score);
      SafeStorage.setItem('turbo_drive_highscore', this.bestScore);
      if (this.dom.bestScore) this.dom.bestScore.textContent = this.bestScore.toLocaleString();
    }

    if (this.dom.finalScore) this.dom.finalScore.textContent = Math.floor(this.score).toLocaleString();
    if (this.dom.finalDistance) this.dom.finalDistance.textContent = `${Math.floor(this.distance)} m`;
    if (this.dom.finalCoins) this.dom.finalCoins.textContent = this.coins;
    if (this.dom.finalTopSpeed) this.dom.finalTopSpeed.textContent = `${Math.floor(this.topSpeedKmh)} km/h`;

    if (this.dom.gameOverModal) {
      this.dom.gameOverModal.classList.remove('hidden');
      this.dom.gameOverModal.style.display = 'flex';
    }
  }

  loop(currentTime) {
    const deltaTime = Math.min(33, currentTime - this.lastTime); // Cap to avoid huge step jumps
    this.lastTime = currentTime;

    if (this.state === 'PLAYING') {
      this.update(deltaTime);
    }

    this.draw();
    requestAnimationFrame(this.loop.bind(this));
  }

  update(dt) {
    const dtNorm = Math.min(2.0, Math.max(0.4, dt / 16.667));

    // Micro-Pause Hit-Stop (Juicy arcade freeze-frame on impacts)
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.particles.update();
      this.popups.update();
      return;
    }

    // 1. Update Player with delta time (apply Auto-Gas cruise if enabled)
    const effectiveInputs = {
      ...this.inputs,
      up: this.inputs.up || (this.autoGas && !this.inputs.down)
    };
    this.player.update(effectiveInputs, dt);

    // Calculate km/h for dashboard (speed unit converted)
    const kmh = Math.round(this.player.speed * 12);
    if (kmh > this.topSpeedKmh) this.topSpeedKmh = kmh;

    // Update sound engine with live gear & RPM acoustics
    this.sound.updateEngineWithGear(
      this.player.currentGear,
      this.player.rpm,
      effectiveInputs.up,
      this.inputs.down,
      this.player.isNitroActive
    );

    // 2. Update Environment & Road with Player Speed and dt
    this.road.update(this.player.speed, dt);

    // 3. Update Traffic
    this.trafficManager.update(this.player.speed, this.distance);

    // Near-Miss "Close Call" detection
    if (this.player.speed > 5) {
      const pBox = this.player.getBounds();
      for (const car of this.trafficManager.traffic) {
        if (!car.nearMissChecked) {
          const cBox = car.getBounds();
          const dy = Math.abs((pBox.y + pBox.height / 2) - (cBox.y + cBox.height / 2));
          if (dy < 36) {
            const dx = Math.abs((pBox.x + pBox.width / 2) - (cBox.x + cBox.width / 2));
            const combinedHalf = (pBox.width + cBox.width) / 2;
            const gap = dx - combinedHalf;
            if (gap >= 1 && gap <= 24) {
              car.nearMissChecked = true;
              this.triggerNearMiss(car.x + car.width / 2, car.y + car.height / 2);
            }
          }
        }
      }
    }

    // 4. Update Rockets & Rocket-Traffic Collisions
    if (this.inputs.rocket) {
      this.fireRocket();
    }

    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.update(dtNorm);
      this.particles.addRocketTrail(r.x, r.y);
      if (r.y < -60) {
        this.rockets.splice(i, 1);
      }
    }

    // Check if any rockets hit traffic cars
    const rocketHits = this.trafficManager.checkRocketHits(this.rockets);
    for (const hit of rocketHits) {
      this.hitStop = 35; // 35ms micro-pause freeze frame for visceral impact
      const isBig = hit.isTanker || hit.chainReaction;
      this.sound.playExplosion(hit.x, isBig);
      this.particles.addExplosion(hit.x, hit.y);
      this.screenShake = Math.max(this.screenShake, isBig ? 26 : 18);

      this.comboMultiplier = Math.min(5.0, Number((this.comboMultiplier + 0.5).toFixed(1)));
      this.comboTimer = 220; // reset decay timer (~3.5s)

      const basePts = isBig ? 1000 : 500;
      const pts = Math.round(basePts * this.comboMultiplier);
      this.score += pts;

      const label = hit.isTanker ? `CHAIN REACTION! +${pts}` : (hit.chainReaction ? `SECONDARY! +${pts}` : `DIRECT HIT! +${pts}`);
      const col = hit.isTanker ? '#ff7700' : (hit.chainReaction ? '#ffcc00' : '#00f0ff');
      this.popups.add(label, hit.x, hit.y, col, 1.25);
      this.updateComboHUD();
    }

    // 5. Update Speed Lines, Particle effects, & Floating Combat Popups
    this.speedLines.update(this.player.speed, this.player.isNitroActive);
    this.particles.update();
    this.popups.update();

    // Combo streak decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dtNorm;
      if (this.comboTimer <= 0) {
        this.comboMultiplier = 1.0;
        this.updateComboHUD();
      }
    }

    // Tire smoke emission when drifting or steering sharply
    if (this.player.isDrifting && this.player.speed > 3) {
      this.particles.addSmoke(this.player.x + 6, this.player.y + this.player.height - 4);
      this.particles.addSmoke(this.player.x + this.player.width - 6, this.player.y + this.player.height - 4);
    }

    // Nitro spark trails during boost
    if (this.player.isNitroActive && this.player.speed > 4) {
      this.particles.addNitroSparks(this.player.x + this.player.width / 2, this.player.y + this.player.height + 4);
    }

    // 6. Distance and Score increment
    if (this.player.speed > 0) {
      const distanceStep = (this.player.speed * dt) / 100;
      this.distance += distanceStep;
      // Score = distance + speed multiplier
      this.score += distanceStep * (1 + this.player.speed / 7) * this.comboMultiplier;
    }

    // 7. Check Collectible Pickups
    const pickups = this.road.checkCollectibles(this.player);
    for (const type of pickups) {
      if (type === 'coin') {
        this.coins += 1;
        const pts = Math.round(250 * this.comboMultiplier);
        this.score += pts;
        this.sound.playCoin();
        this.particles.addSparks(this.player.x + this.player.width / 2, this.player.y, 12, '#ffd700');
        this.popups.add(`+${pts} 🪙`, this.player.x + this.player.width / 2, this.player.y - 10, '#ffd700', 1.0);
      } else if (type === 'nitro') {
        this.player.refillNitro(40);
        this.sound.playNitro();
        this.particles.addSparks(this.player.x + this.player.width / 2, this.player.y, 16, '#00f0ff');
        this.popups.add('NITRO CHARGED! ⚡', this.player.x + this.player.width / 2, this.player.y - 10, '#00f0ff', 1.05);
      } else if (type === 'rocket') {
        this.player.addRockets(3);
        this.sound.playCoin();
        this.particles.addSparks(this.player.x + this.player.width / 2, this.player.y, 18, '#ff0055');
        this.popups.add('+3 ROCKETS! 🚀', this.player.x + this.player.width / 2, this.player.y - 10, '#ff0055', 1.05);
      } else if (type === 'repair') {
        this.player.repair(35);
        this.sound.playRepair();
        this.particles.addSparks(this.player.x + this.player.width / 2, this.player.y, 16, '#00ff88');
        this.popups.add('REPAIRED! 🛠️', this.player.x + this.player.width / 2, this.player.y - 10, '#00ff88', 1.05);
      }
    }

    // 8. Check Traffic Collisions
    const collision = this.trafficManager.checkCollision(this.player);
    if (collision.hit) {
      this.hitStop = 40;
      this.comboMultiplier = 1.0;
      this.comboTimer = 0;
      this.updateComboHUD();

      this.screenShake = 18;
      this.sound.playCrash();
      this.particles.addSparks(this.player.x + this.player.width / 2, this.player.y + 10, 26, '#ff0055');

      const isDead = this.player.takeDamage(collision.damage);
      if (isDead) {
        this.gameOver();
        return;
      }
    }

    // Screen Shake damping
    if (this.screenShake > 0) {
      this.screenShake -= 0.8;
      if (this.screenShake < 0) this.screenShake = 0;
    }

    // 9. Update HUD DOM
    this.updateHUD(kmh);
  }

  updateHUD(kmh = 0) {
    if (this.dom.score) this.dom.score.textContent = Math.floor(this.score).toLocaleString();
    if (this.dom.distance) this.dom.distance.textContent = `${Math.floor(this.distance)} m`;
    if (this.dom.coins) this.dom.coins.textContent = this.coins;

    // Health
    const healthPercent = Math.max(0, Math.min(100, Math.round(this.player.health)));
    if (this.dom.healthFill) this.dom.healthFill.style.width = `${healthPercent}%`;
    if (this.dom.healthText) this.dom.healthText.textContent = `${healthPercent}%`;
    if (this.dom.healthFill) {
      if (healthPercent <= 30) this.dom.healthFill.classList.add('low');
      else this.dom.healthFill.classList.remove('low');
    }

    // Speedometer
    if (this.dom.speedKmh) this.dom.speedKmh.textContent = `${kmh} KM/H`;
    if (this.dom.speedGauge) {
      const speedRatio = Math.min(100, (this.player.speed / this.player.nitroMaxSpeed) * 100);
      this.dom.speedGauge.style.width = `${speedRatio}%`;
    }

    // Live Gear Badge & Tachometer Bar
    if (this.dom.gearDisplay) {
      this.dom.gearDisplay.textContent = this.player.currentGear;
    }
    if (this.dom.tachometerFill) {
      const rpmPercent = Math.min(100, Math.max(12, Math.round(this.player.rpm * 100)));
      this.dom.tachometerFill.style.width = `${rpmPercent}%`;
    }

    // Sequential Shift LEDs
    const rpm = this.player.rpm;
    const leds = [this.dom.led1, this.dom.led2, this.dom.led3, this.dom.led4, this.dom.led5];
    const thresholds = [0.35, 0.50, 0.65, 0.80, 0.92];
    leds.forEach((led, idx) => {
      if (led) {
        if (rpm >= thresholds[idx]) {
          led.classList.add('lit');
        } else {
          led.classList.remove('lit');
        }
      }
    });

    // Nitro
    const nitroVal = Math.round(this.player.nitro);
    if (this.dom.nitroPercent) this.dom.nitroPercent.textContent = `${nitroVal}%`;
    if (this.dom.nitroGauge) this.dom.nitroGauge.style.width = `${nitroVal}%`;

    // Rockets Arsenal
    if (this.dom.rocketCountDisplay) {
      this.dom.rocketCountDisplay.textContent = (this.player.unlimitedRockets || this.player.rockets === Infinity) ? '∞' : this.player.rockets;
    }
  }

  draw() {
    this.ctx.save();

    // Screen Shake offset
    if (this.screenShake > 0) {
      const sx = (Math.random() * 2 - 1) * this.screenShake;
      const sy = (Math.random() * 2 - 1) * this.screenShake;
      this.ctx.translate(sx, sy);
    }

    // 1. Draw Road & Scenery & Collectibles
    this.road.draw(this.ctx);

    // 2. Draw Motion Speed Lines
    this.speedLines.draw(this.ctx, this.player.speed, this.player.isNitroActive);

    // 3. Draw Traffic AI Cars
    this.trafficManager.draw(this.ctx);

    // 4. Draw Active Player Rockets
    for (const rocket of this.rockets) {
      rocket.draw(this.ctx);
    }

    // 5. Draw Player Car with Steering Angle and Inputs
    this.player.draw(this.ctx, this.inputs);

    // 6. Draw Particles, Tire Smoke, & Explosions
    this.particles.draw(this.ctx);

    // 7. Draw Floating Combat Text Popups
    this.popups.draw(this.ctx);

    this.ctx.restore();
  }
}

// Bulletproof Bootstrap: Handles initial loading, late script injection, and iframes
function launchGame() {
  try {
    if (!window.gameInstance) {
      window.gameInstance = new Game();
      console.log('Turbo Drive game initialized successfully!');
    }
  } catch (err) {
    console.error('Error launching Turbo Drive:', err);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', launchGame);
  } else {
    // DOM is already ready (iframe, late script execution, or fast render)
    launchGame();
  }
  window.addEventListener('load', launchGame);
}

// Export for Node tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Game, SoundEngine, ParticleFX, SpeedLines, PopupFX, SafeStorage };
}
