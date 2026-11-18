import { PitchDetector } from 'pitchy';
import { getGuzhengString } from '../core/guzhengTuning';
import type { PitchFrame } from '../core/pitchMatcher';
import { computeRms } from './karplusStrong';

export type PitchFrameListener = (frame: PitchFrame) => void;
export type MicInputStatus = 'idle' | 'starting' | 'listening' | 'error';

export interface MicAnalyserLike {
  fftSize: number;
  getFloatTimeDomainData(array: Float32Array<ArrayBuffer>): void;
}

export interface MicAudioContextLike {
  readonly state: AudioContextState;
  readonly sampleRate: number;
  resume(): Promise<void>;
  close(): Promise<void>;
  createMediaStreamSource(stream: MediaStream): {
    connect(node: unknown): void;
    disconnect(): void;
  };
  createAnalyser(): MicAnalyserLike;
}

export interface DualChannelPitchInputOptions {
  bufferSize?: number;
  pollIntervalMs?: number;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createAudioContext?: () => MicAudioContextLike;
  setIntervalFn?: (fn: () => void, ms: number) => unknown;
  clearIntervalFn?: (id: unknown) => void;
  nowFn?: () => number;
}

/**
 * Extracts PitchFrame (frequency, clarity, rms) from time-domain PCM samples via Pitchy MPM.
 */
export class PitchBufferAnalyzer {
  private readonly detector: PitchDetector<Float32Array>;
  readonly bufferSize: number;

  constructor(bufferSize: number = 2048) {
    this.bufferSize = bufferSize;
    this.detector = PitchDetector.forFloat32Array(bufferSize);
  }

  analyzeSamples(samples: Float32Array, sampleRate: number, timestampMs?: number): PitchFrame {
    const rms = computeRms(samples);
    if (rms === 0) {
      return { frequency: 0, clarity: 0, rms: 0, timestampMs };
    }
    const [frequency, clarity] = this.detector.findPitch(samples, sampleRate);
    return { frequency, clarity, rms, timestampMs };
  }
}

function defaultGetUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const nav = globalThis.navigator as Navigator | undefined;
  if (!nav?.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error('Microphone getUserMedia is not available'));
  }
  return nav.mediaDevices.getUserMedia(constraints);
}

function defaultCreateMicAudioContext(): MicAudioContextLike {
  const globalObj = globalThis as unknown as {
    AudioContext?: new () => MicAudioContextLike;
    webkitAudioContext?: new () => MicAudioContextLike;
  };
  const Ctor = globalObj.AudioContext ?? globalObj.webkitAudioContext;
  if (!Ctor) {
    throw new Error('Web Audio API is not supported in this environment');
  }
  return new Ctor();
}

/**
 * Dual-channel pitch input stream supporting:
 * 1) Real-time microphone capture analyzed with Pitchy MPM
 * 2) Simulated string plucks for virtual keyboard / dev testing without a physical guzheng
 */
export class DualChannelPitchInput {
  private readonly analyzer: PitchBufferAnalyzer;
  private readonly pollIntervalMs: number;
  private readonly getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  private readonly createAudioContext: () => MicAudioContextLike;
  private readonly setIntervalFn: (fn: () => void, ms: number) => unknown;
  private readonly clearIntervalFn: (id: unknown) => void;
  private readonly nowFn: () => number;

  private readonly listeners = new Set<PitchFrameListener>();
  private status: MicInputStatus = 'idle';
  private lastError: string | null = null;

  private stream: MediaStream | null = null;
  private audioCtx: MicAudioContextLike | null = null;
  private sourceNode: { connect(node: unknown): void; disconnect(): void } | null = null;
  private pollTimer: unknown = null;

  constructor(options?: DualChannelPitchInputOptions) {
    const bufferSize = options?.bufferSize ?? 2048;
    this.analyzer = new PitchBufferAnalyzer(bufferSize);
    this.pollIntervalMs = options?.pollIntervalMs ?? 30;
    this.getUserMedia = options?.getUserMedia ?? defaultGetUserMedia;
    this.createAudioContext = options?.createAudioContext ?? defaultCreateMicAudioContext;
    this.setIntervalFn =
      options?.setIntervalFn ?? ((fn, ms) => globalThis.setInterval(fn, ms));
    this.clearIntervalFn =
      options?.clearIntervalFn ?? ((id) => globalThis.clearInterval(id as number));
    this.nowFn = options?.nowFn ?? Date.now;
  }

  getStatus(): MicInputStatus {
    return this.status;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  subscribe(listener: PitchFrameListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emitFrame(frame: PitchFrame): void {
    for (const listener of this.listeners) {
      listener(frame);
    }
  }

  /**
   * Simulates plucking a guzheng string (or custom frequency) by emitting consecutive PitchFrames.
   */
  simulatePluck(
    stringNumOrFreq: number,
    options?: {
      isFrequency?: boolean;
      frameCount?: number;
      clarity?: number;
      rms?: number;
      centsOffset?: number;
    },
  ): void {
    let baseFreq: number;
    if (options?.isFrequency) {
      baseFreq = stringNumOrFreq;
    } else {
      const str = getGuzhengString(stringNumOrFreq);
      if (!str) {
        throw new RangeError(`Invalid guzheng string number: ${stringNumOrFreq}`);
      }
      baseFreq = str.frequency;
    }

    const centsOffset = options?.centsOffset ?? 0;
    const frequency = baseFreq * Math.pow(2, centsOffset / 1200);
    const frameCount = options?.frameCount ?? 3;
    const clarity = options?.clarity ?? 0.94;
    const startRms = options?.rms ?? 0.12;
    const baseTime = this.nowFn();

    for (let i = 0; i < frameCount; i += 1) {
      this.emitFrame({
        frequency,
        clarity,
        rms: Math.max(0.02, startRms * Math.pow(0.9, i)),
        timestampMs: baseTime + i * this.pollIntervalMs,
      });
    }
  }

  async startMicrophone(): Promise<void> {
    if (this.status === 'listening' || this.status === 'starting') {
      return;
    }

    this.status = 'starting';
    this.lastError = null;

    try {
      // Disable speech-oriented DSP filters so musical sustain & pitch are preserved
      const stream = await this.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const ctx = this.createAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = this.analyzer.bufferSize;
      source.connect(analyser);

      const pcmBuffer = new Float32Array(this.analyzer.bufferSize);
      this.stream = stream;
      this.audioCtx = ctx;
      this.sourceNode = source;
      this.status = 'listening';

      this.pollTimer = this.setIntervalFn(() => {
        analyser.getFloatTimeDomainData(pcmBuffer);
        const frame = this.analyzer.analyzeSamples(pcmBuffer, ctx.sampleRate, this.nowFn());
        this.emitFrame(frame);
      }, this.pollIntervalMs);
    } catch (err) {
      this.status = 'error';
      this.lastError = err instanceof Error ? err.message : 'Failed to start microphone';
      await this.cleanupMedia();
      throw err;
    }
  }

  async stopMicrophone(): Promise<void> {
    await this.cleanupMedia();
    this.status = 'idle';
  }

  private async cleanupMedia(): Promise<void> {
    if (this.pollTimer !== null) {
      this.clearIntervalFn(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.audioCtx) {
      const ctx = this.audioCtx;
      this.audioCtx = null;
      await ctx.close();
    }
  }
}
