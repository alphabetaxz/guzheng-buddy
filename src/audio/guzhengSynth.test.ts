import { describe, expect, it, vi } from 'vitest';
import { GuzhengSynth, type AudioContextLike } from './guzhengSynth';

function createMockAudioContext() {
  const oscCalls: Array<{ type: string; freq: number }> = [];
  const bufferSourceStarts: number[] = [];
  let closed = false;

  const mockCtx: AudioContextLike = {
    state: 'suspended',
    currentTime: 1.0,
    sampleRate: 44100,
    destination: {} as AudioDestinationNode,
    resume: vi.fn(async () => {
      (mockCtx as { state: string }).state = 'running';
    }),
    close: vi.fn(async () => {
      closed = true;
    }),
    createOscillator: vi.fn(() => {
      const oscRecord = { type: 'sine', freq: 0 };
      oscCalls.push(oscRecord);
      return {
        get type() {
          return oscRecord.type as OscillatorType;
        },
        set type(v: OscillatorType) {
          oscRecord.type = v;
        },
        frequency: {
          setValueAtTime: vi.fn((v: number) => {
            oscRecord.freq = v;
          }),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      } as unknown as OscillatorNode;
    }),
    createGain: vi.fn(() => {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      } as unknown as GainNode;
    }),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
      const data = new Float32Array(length);
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: () => data,
      } as unknown as AudioBuffer;
    }),
    createBufferSource: vi.fn(() => {
      return {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn((when?: number) => {
          bufferSourceStarts.push(when ?? 0);
        }),
        stop: vi.fn(),
      } as unknown as AudioBufferSourceNode;
    }),
  };

  return { mockCtx, oscCalls, bufferSourceStarts, isClosed: () => closed };
}

describe('GuzhengSynth', () => {
  it('unlocks suspended AudioContext and synthesizes Karplus-Strong plucked string audio', async () => {
    const { mockCtx, bufferSourceStarts } = createMockAudioContext();
    const synth = new GuzhengSynth({ createAudioContext: () => mockCtx });

    await synth.unlock();
    expect(mockCtx.resume).toHaveBeenCalledTimes(1);

    synth.playString(8); // String 8 = A4 (440 Hz)
    expect(mockCtx.createBuffer).toHaveBeenCalledTimes(1);
    expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(1);
    expect(bufferSourceStarts).toHaveLength(1);
  });

  it('falls back gracefully to harmonic oscillator synthesis when disabled or invalid string ignored', () => {
    const { mockCtx, oscCalls } = createMockAudioContext();
    const synth = new GuzhengSynth({
      createAudioContext: () => mockCtx,
      useKarplusStrong: false,
    });

    synth.playTone(440);
    // 3 harmonics: 440, 880, 1320
    expect(oscCalls.map((c) => c.freq)).toEqual([440, 880, 1320]);

    // Invalid string number is a safe no-op
    synth.playString(99);
    expect(oscCalls).toHaveLength(3);
  });

  it('synthesizes woodblock, star chime, meow, win chord, and gentle retry tones with zero media assets', () => {
    const { mockCtx, oscCalls, bufferSourceStarts } = createMockAudioContext();
    const synth = new GuzhengSynth({ createAudioContext: () => mockCtx });

    synth.playWoodblock(true);
    synth.playWoodblock(false);
    expect(oscCalls.slice(0, 2).map((c) => c.freq)).toEqual([920, 680]);

    synth.playStarChime();
    synth.playEncourageMeow();
    synth.playGentleRetry();
    expect(oscCalls.length).toBeGreaterThan(4);

    synth.playWinChord();
    // Win chord triggers 4 arpeggiated notes (440, 587.33, 739.99, 880)
    expect(bufferSourceStarts.length).toBe(4);
  });

  it('disposes AudioContext cleanly', async () => {
    const { mockCtx, isClosed } = createMockAudioContext();
    const synth = new GuzhengSynth({ createAudioContext: () => mockCtx });
    synth.playTone(440);
    await synth.dispose();
    expect(isClosed()).toBe(true);
  });
});
