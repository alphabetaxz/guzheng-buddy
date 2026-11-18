import { describe, expect, it, vi } from 'vitest';
import type { PitchFrame } from '../core/pitchMatcher';
import { PitchMatcher } from '../core/pitchMatcher';
import { generateKarplusStrongSamples } from './karplusStrong';
import { DualChannelPitchInput, PitchBufferAnalyzer } from './pitchInput';

describe('PitchBufferAnalyzer', () => {
  it('extracts PitchFrame (frequency, clarity, rms) from raw audio samples using Pitchy', () => {
    const sampleRate = 44100;
    const analyzer = new PitchBufferAnalyzer(2048);
    const ks = generateKarplusStrongSamples(293.66, sampleRate, 0.25); // String 11 (D4)
    const frame = analyzer.analyzeSamples(ks.subarray(2048, 4096), sampleRate, 123);

    expect(frame.timestampMs).toBe(123);
    expect(frame.rms).toBeGreaterThan(0.05);
    expect(frame.clarity).toBeGreaterThan(0.85);
    expect(Math.abs(1200 * Math.log2(frame.frequency / 293.66))).toBeLessThan(20);
  });

  it('returns zeroed frame on silent buffer', () => {
    const analyzer = new PitchBufferAnalyzer(2048);
    const silent = new Float32Array(2048);
    const frame = analyzer.analyzeSamples(silent, 44100);
    expect(frame.rms).toBe(0);
    expect(frame.frequency).toBe(0);
    expect(frame.clarity).toBe(0);
  });
});

describe('DualChannelPitchInput', () => {
  it('drives PitchMatcher end-to-end via simulated string plucks (dev/virtual channel)', () => {
    const input = new DualChannelPitchInput();
    const matcher = new PitchMatcher({ targetStringNum: 8 });
    const frames: PitchFrame[] = [];
    let confirmed = false;

    input.subscribe((frame) => {
      frames.push(frame);
      const res = matcher.processFrame(frame);
      if (res.confirmed) confirmed = true;
    });

    input.simulatePluck(8, { frameCount: 3 });
    expect(frames).toHaveLength(3);
    expect(confirmed).toBe(true);
  });

  it('streams real microphone frames through Pitchy and cleans up tracks on stop', async () => {
    const sampleRate = 44100;
    const ks = generateKarplusStrongSamples(440, sampleRate, 0.25);
    const trackStop = vi.fn();

    const mockStream = {
      getTracks: () => [{ stop: trackStop }],
    } as unknown as MediaStream;

    const mockAnalyser = {
      fftSize: 2048,
      getFloatTimeDomainData: vi.fn((buf: Float32Array) => {
        buf.set(ks.subarray(2048, 2048 + buf.length));
      }),
    };

    const mockCtx = {
      state: 'running',
      sampleRate,
      resume: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createAnalyser: vi.fn(() => mockAnalyser),
    };

    let pollTick: (() => void) | null = null;
    const input = new DualChannelPitchInput({
      getUserMedia: vi.fn(async () => mockStream),
      createAudioContext: () => mockCtx as unknown as AudioContext,
      setIntervalFn: (fn) => {
        pollTick = fn;
        return 42;
      },
      clearIntervalFn: vi.fn(),
    });

    const matcher = new PitchMatcher({ targetStringNum: 8 });
    let confirmed = false;
    input.subscribe((frame) => {
      if (matcher.processFrame(frame).confirmed) confirmed = true;
    });

    await input.startMicrophone();
    expect(input.getStatus()).toBe('listening');
    expect(pollTick).not.toBeNull();

    // Simulate 3 timer frames from microphone analyser
    pollTick!();
    pollTick!();
    pollTick!();
    expect(confirmed).toBe(true);

    await input.stopMicrophone();
    expect(input.getStatus()).toBe('idle');
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(mockCtx.close).toHaveBeenCalledTimes(1);
  });

  it('transitions to error status when microphone permission is denied or unavailable', async () => {
    const input = new DualChannelPitchInput({
      getUserMedia: vi.fn(async () => {
        throw new Error('Permission denied');
      }),
    });

    await expect(input.startMicrophone()).rejects.toThrow('Permission denied');
    expect(input.getStatus()).toBe('error');
  });
});
