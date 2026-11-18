import { getGuzhengString } from '../core/guzhengTuning';
import { generateKarplusStrongSamples } from './karplusStrong';

export interface AudioContextLike {
  readonly state: AudioContextState;
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: AudioDestinationNode;
  resume(): Promise<void>;
  close(): Promise<void>;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
}

export interface GuzhengSynthOptions {
  createAudioContext?: () => AudioContextLike;
  useKarplusStrong?: boolean;
}

function defaultCreateAudioContext(): AudioContextLike {
  const globalObj = globalThis as unknown as {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
  };
  const Ctor = globalObj.AudioContext ?? globalObj.webkitAudioContext;
  if (!Ctor) {
    throw new Error('Web Audio API is not supported in this environment');
  }
  return new Ctor();
}

/**
 * Zero-asset Web Audio synthesizer for:
 * - Authentic 21-string guzheng tones (Karplus-Strong with harmonic-envelope fallback)
 * - Metronome woodblocks for rhythm training
 * - Child-friendly reward chimes, meow encouragement, win chords, and gentle retry cues
 */
export class GuzhengSynth {
  private ctx: AudioContextLike | null = null;
  private muted = false;
  private readonly createAudioContext: () => AudioContextLike;
  private readonly useKarplusStrong: boolean;

  constructor(options?: GuzhengSynthOptions) {
    this.createAudioContext = options?.createAudioContext ?? defaultCreateAudioContext;
    this.useKarplusStrong = options?.useKarplusStrong ?? true;
  }

  private getContext(): AudioContextLike {
    if (!this.ctx) {
      this.ctx = this.createAudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  async unlock(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  playString(stringNum: number, durationScale: number = 1.0, delaySec: number = 0): void {
    const str = getGuzhengString(stringNum);
    if (!str) return;
    this.playTone(str.frequency, durationScale, delaySec);
  }

  playTone(frequency: number, durationScale: number = 1.0, delaySec: number = 0): void {
    if (this.muted || !Number.isFinite(frequency) || frequency <= 0) return;

    const ctx = this.getContext();
    const startTime = ctx.currentTime + Math.max(0, delaySec);
    const durationSec = Math.max(0.25, 1.45 * durationScale);

    if (this.useKarplusStrong) {
      const damping = frequency < 220 ? 0.9975 : frequency > 600 ? 0.9935 : 0.996;
      const samples = generateKarplusStrongSamples(frequency, ctx.sampleRate, durationSec, damping);
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.getChannelData(0).set(samples);

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.55, startTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(startTime);
      source.stop(startTime + durationSec + 0.02);
      return;
    }

    this.playHarmonicOscillators(ctx, frequency, durationScale, startTime);
  }

  private playHarmonicOscillators(
    ctx: AudioContextLike,
    frequency: number,
    durationScale: number,
    startTime: number,
  ): void {
    const harmonics = [
      { ratio: 1, gain: 0.36, dur: 1.45 * durationScale },
      { ratio: 2, gain: 0.16, dur: 0.85 * durationScale },
      { ratio: 3, gain: 0.07, dur: 0.45 * durationScale },
    ];

    for (const h of harmonics) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = h.ratio === 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(frequency * h.ratio, startTime);
      osc.frequency.exponentialRampToValueAtTime(frequency * h.ratio * 1.007, startTime + 0.015);
      osc.frequency.exponentialRampToValueAtTime(frequency * h.ratio, startTime + 0.08);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(h.gain, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + h.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + h.dur + 0.04);
    }
  }

  playWoodblock(isStrongBeat: boolean): void {
    if (this.muted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isStrongBeat ? 920 : 680, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playStarChime(): void {
    if (this.muted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const notes = [880, 1174.66];
    notes.forEach((freq, i) => {
      const t = now + i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  playEncourageMeow(): void {
    if (this.muted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.22);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  playWinChord(): void {
    const chord = [440, 587.33, 739.99, 880];
    chord.forEach((freq, idx) => {
      this.playTone(freq, 0.85, idx * 0.075);
    });
  }

  playGentleRetry(): void {
    if (this.muted) return;
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(246.94, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.16);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  async dispose(): Promise<void> {
    if (this.ctx) {
      const target = this.ctx;
      this.ctx = null;
      await target.close();
    }
  }
}
