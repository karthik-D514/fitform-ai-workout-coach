/**
 * FitForm AI - Voice Coach & Audio Synthesis Engine
 * Provides real-time spoken coaching cues via Web Speech API (100% offline browser native)
 * and low-latency audio feedback via Web Audio API synthesizer.
 */

export class VoiceCoach {
  constructor() {
    this.synth = window.speechSynthesis;
    this.audioCtx = null;
    this.enabled = true;
    this.speechCooldown = 2800; // ms between voice tips
    this.lastSpokenTime = 0;
    this.lastSpokenText = '';
    this.preferredVoice = null;

    this.initAudioContext();
    this.initVoices();
  }

  initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }

  ensureAudioContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  initVoices() {
    if (!this.synth) return;
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;

      // Prefer natural English voices (Google US English, Microsoft Jenny/Natural, etc.)
      const naturalEnglish = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Jenny'))
      );
      this.preferredVoice = naturalEnglish || voices.find((v) => v.lang.startsWith('en')) || voices[0];
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Speak a coaching cue with smart cooldown and priority handling.
   * @param {string} text - Coaching cue to speak
   * @param {boolean} immediate - If true, cancels non-urgent speech (e.g. for injury hazard or rep count)
   */
  speak(text, immediate = false) {
    if (!this.enabled || !this.synth || !text) return;

    const now = Date.now();
    // Prevent repeating identical feedback within 4 seconds
    if (text === this.lastSpokenText && now - this.lastSpokenTime < 4500) {
      return;
    }

    // Cooldown check unless immediate priority
    if (!immediate && now - this.lastSpokenTime < this.speechCooldown) {
      return;
    }

    if (immediate) {
      this.synth.cancel(); // Stop any pending speech
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.preferredVoice) {
      utterance.voice = this.preferredVoice;
    }
    utterance.rate = 1.05; // Slightly brisk, athletic coach pace
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      this.lastSpokenTime = Date.now();
      this.lastSpokenText = text;
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
    };

    this.synth.speak(utterance);
    this.lastSpokenTime = now;
    this.lastSpokenText = text;
  }

  /**
   * Play clean synthesized beep for rep count completion (Positive high chime).
   */
  playRepChime() {
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Arpeggio chime: 587Hz (D5) -> 880Hz (A5)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  /**
   * Subtle alert tone for form deviation.
   */
  playFormAlert() {
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.setValueAtTime(240, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  /**
   * Countdown beep for rest timers (3, 2, 1, GO).
   */
  playCountdownBeep(isFinal = false) {
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const freq = isFinal ? 880 : 440;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isFinal ? 0.3 : 0.15));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + (isFinal ? 0.3 : 0.15));
  }

  toggle(enabled) {
    this.enabled = enabled;
    if (!enabled && this.synth) {
      this.synth.cancel();
    }
  }
}
