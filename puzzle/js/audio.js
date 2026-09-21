/**
 * Cyber Circuit: Mainframe Breach — Studio Web Audio Synthesizer
 */

class PuzzleAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    try {
      const saved = localStorage.getItem("cyber_circuit_sfx");
      if (saved !== null) this.enabled = saved === "true";
    } catch (e) {}

    // Unlock audio context on any user interaction
    const unlock = () => {
      this.init();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem("cyber_circuit_sfx", this.enabled);
    } catch (e) {}
    if (this.enabled) {
      this.init();
      this.playClick();
    }
    return this.enabled;
  }

  playStepChime(colorId = 1, stepCount = 0) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const baseFreqs = [523.25, 587.33, 659.25, 783.99, 880.00, 987.77, 1046.50, 1174.66];
    const base = baseFreqs[(colorId - 1) % baseFreqs.length];
    
    // Scale up frequency slightly with wire length for a satisfying ascending melody
    const semitones = Math.min(12, stepCount * 0.5);
    const freq = base * Math.pow(2, semitones / 12);

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playConnectChime(colorId = 1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const baseFreqs = [523.25, 587.33, 659.25, 783.99, 880.00, 987.77, 1046.50, 1174.66];
    const root = baseFreqs[(colorId - 1) % baseFreqs.length];
    const fifth = root * 1.5;
    const octave = root * 2.0;

    const now = this.ctx.currentTime;
    [root, fifth, octave].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startT = now + idx * 0.04;

      osc.type = idx === 2 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, startT);

      gain.gain.setValueAtTime(0.001, startT);
      gain.gain.linearRampToValueAtTime(0.14, startT + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startT);
      osc.stop(startT + 0.55);
    });
  }

  playWinFanfare() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const chord = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C Major arpeggio
    const now = this.ctx.currentTime;

    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.07;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.75);
    });
  }

  playUndo() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.04);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PuzzleAudio };
}
