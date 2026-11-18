import { describe, expect, it } from 'vitest';
import { TunerSmoother } from './tunerSmoother';

describe('TunerSmoother', () => {
  it('auto-detects string, smooths cents, and marks ±8 cents as in_tune', () => {
    const tuner = new TunerSmoother();

    // Feed 3 frames around 440 Hz (String 8) with slight jitter (+2, +4, +3 cents)
    tuner.processFrame({ frequency: 440 * Math.pow(2, 2 / 1200), clarity: 0.92, rms: 0.08 });
    tuner.processFrame({ frequency: 440 * Math.pow(2, 4 / 1200), clarity: 0.91, rms: 0.07 });
    const reading = tuner.processFrame({
      frequency: 440 * Math.pow(2, 3 / 1200),
      clarity: 0.93,
      rms: 0.07,
    });

    expect(reading).not.toBeNull();
    expect(reading!.string.num).toBe(8);
    expect(reading!.status).toBe('in_tune');
    expect(Math.abs(reading!.cents)).toBeLessThanOrEqual(8);
    expect(reading!.needlePercent).toBeGreaterThan(50);
    expect(reading!.needlePercent).toBeLessThan(60);
  });

  it('supports locked target string mode and flat/sharp needle clamping', () => {
    const tuner = new TunerSmoother();
    tuner.setLockedString(11); // D4 = 293.66 Hz

    // -25 cents => flat
    const flatReading = tuner.processFrame({
      frequency: 293.66 * Math.pow(2, -25 / 1200),
      clarity: 0.9,
      rms: 0.08,
    });
    expect(flatReading).not.toBeNull();
    expect(flatReading!.string.num).toBe(11);
    expect(flatReading!.status).toBe('flat');
    expect(flatReading!.needlePercent).toBeCloseTo(25, 1);

    // Unlock and test +60 cents sharp clamped to 100%
    tuner.setLockedString(null);
    tuner.reset();
    const sharpReading = tuner.processFrame({
      frequency: 440 * Math.pow(2, 60 / 1200),
      clarity: 0.9,
      rms: 0.08,
    });
    expect(sharpReading!.status).toBe('sharp');
    expect(sharpReading!.needlePercent).toBe(100);
  });

  it('ignores noise and low-clarity frames', () => {
    const tuner = new TunerSmoother({ minRms: 0.02, minClarity: 0.82 });
    expect(tuner.processFrame({ frequency: 440, clarity: 0.95, rms: 0.005 })).toBeNull();
    expect(tuner.processFrame({ frequency: 440, clarity: 0.5, rms: 0.09 })).toBeNull();
  });
});
