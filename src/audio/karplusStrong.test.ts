import { describe, expect, it } from 'vitest';
import { PitchDetector } from 'pitchy';
import { computeRms, generateKarplusStrongSamples } from './karplusStrong';

describe('karplusStrong', () => {
  it('generates non-silent plucked string samples whose fundamental frequency matches pitchy MPM', () => {
    const sampleRate = 44100;
    const targets = [220.0, 293.66, 440.0, 880.0];

    for (const freq of targets) {
      const samples = generateKarplusStrongSamples(freq, sampleRate, 0.35);
      expect(samples.length).toBe(Math.round(sampleRate * 0.35));
      expect(computeRms(samples)).toBeGreaterThan(0.05);

      // Analyze steady portion (skip initial 2048 attack samples)
      const windowSize = 2048;
      const slice = samples.subarray(2048, 2048 + windowSize);
      const detector = PitchDetector.forFloat32Array(windowSize);
      const [detectedFreq, clarity] = detector.findPitch(slice, sampleRate);

      expect(clarity).toBeGreaterThan(0.85);
      const cents = 1200 * Math.log2(detectedFreq / freq);
      expect(Math.abs(cents)).toBeLessThan(20);
    }
  });

  it('decays amplitude over time and handles invalid frequency/empty buffer safely', () => {
    const samples = generateKarplusStrongSamples(440, 44100, 0.6);
    const earlyRms = computeRms(samples.subarray(0, 4096));
    const lateRms = computeRms(samples.subarray(samples.length - 4096));
    expect(lateRms).toBeLessThan(earlyRms);

    expect(computeRms(new Float32Array(0))).toBe(0);
    expect(() => generateKarplusStrongSamples(0, 44100)).toThrow(RangeError);
    expect(() => generateKarplusStrongSamples(440, 0)).toThrow(RangeError);
  });
});
