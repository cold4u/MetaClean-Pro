/**
 * Cyber Pulse: Rhythm Matrix — Web Audio Synthesizer & BGM Generator
 */

class PulseAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.bgmTimer = null;
    this.bpm = 128;
    this.step = 0;
    this.bassNotes = [130.81, 146.83, 164.81, 174.61]; // C3, D3, E3, F3
    this.laneFrequencies = [261.63, 329.63, 392.00, 493.88]; // C4, E4, G4, B4

    try {
      if (typeof localStorage !== "undefined") {
        this.enabled = localStorage.getItem("pulse_sfx") !== "false";
      }
    } catch (_) {}
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    } catch (_) {}
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stopBGM();
    } else {
      this.startBGM();
    }
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("pulse_sfx", String(this.enabled));
      }
    } catch (_) {}
    return this.enabled;
  }

  playHit(lane, grade) {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const freq = this.laneFrequencies[lane] || 440;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      if (grade === "PERFECT") {
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08);
      }

      const vol = grade === "PERFECT" ? 0.22 : grade === "GREAT" ? 0.17 : 0.12;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (_) {}
  }

  playMiss() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.linearRampToValueAtTime(45, now + 0.1);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch (_) {}
  }

  startBGM() {
    if (!this.enabled || !this.ctx || this.bgmTimer) return;
    const interval = (60 / this.bpm / 2) * 1000; // Eighth notes
    this.bgmTimer = setInterval(() => {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        // Kick on beat 1 and 3
        if (this.step % 2 === 0) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.09);
        }

        // Synth Bass Arp
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = "sawtooth";
        const bassFreq = this.bassNotes[this.step % this.bassNotes.length];
        bassOsc.frequency.setValueAtTime(bassFreq, now);
        bassGain.gain.setValueAtTime(0.04, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.1);

        this.step++;
      } catch (_) {}
    }, interval);
  }

  stopBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PulseAudio };
}
