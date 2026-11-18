import { describe, expect, it } from 'vitest';
import { PitchMatcher } from './pitchMatcher';

describe('PitchMatcher', () => {
  it('requires 3 consecutive valid frames within ±40 cents before confirming', () => {
    const matcher = new PitchMatcher({ targetStringNum: 8 });

    // Frame 1: 440 Hz (tracking)
    const r1 = matcher.processFrame({ frequency: 440, clarity: 0.9, rms: 0.08 });
    expect(r1.status).toBe('tracking');
    expect(r1.confirmed).toBe(false);
    expect(r1.consecutiveFrames).toBe(1);

    // Frame 2: +35 cents (still within ±40 cents)
    const r2 = matcher.processFrame({
      frequency: 440 * Math.pow(2, 35 / 1200),
      clarity: 0.88,
      rms: 0.07,
    });
    expect(r2.status).toBe('tracking');
    expect(r2.confirmed).toBe(false);
    expect(r2.consecutiveFrames).toBe(2);

    // Frame 3: -35 cents (still within ±40 cents) -> confirmed!
    const r3 = matcher.processFrame({
      frequency: 440 * Math.pow(2, -35 / 1200),
      clarity: 0.85,
      rms: 0.06,
    });
    expect(r3.status).toBe('confirmed');
    expect(r3.confirmed).toBe(true);
    expect(r3.consecutiveFrames).toBe(3);
  });

  it('rejects ambient noise (RMS below gate) and low-clarity speech frames', () => {
    const matcher = new PitchMatcher({ targetStringNum: 8, minRms: 0.02, minClarity: 0.82 });

    // Start tracking with 2 valid frames
    matcher.processFrame({ frequency: 440, clarity: 0.91, rms: 0.08 });
    matcher.processFrame({ frequency: 440, clarity: 0.9, rms: 0.07 });

    // Low RMS noise resets streak
    const noiseRes = matcher.processFrame({ frequency: 440, clarity: 0.95, rms: 0.005 });
    expect(noiseRes.status).toBe('ignored_noise');
    expect(noiseRes.confirmed).toBe(false);
    expect(noiseRes.consecutiveFrames).toBe(0);

    // Build up 2 frames again
    matcher.processFrame({ frequency: 440, clarity: 0.9, rms: 0.08 });
    matcher.processFrame({ frequency: 440, clarity: 0.9, rms: 0.07 });

    // Low clarity (e.g., parent talking near mic) resets streak
    const speechRes = matcher.processFrame({ frequency: 440, clarity: 0.65, rms: 0.09 });
    expect(speechRes.status).toBe('ignored_low_clarity');
    expect(speechRes.confirmed).toBe(false);
    expect(speechRes.consecutiveFrames).toBe(0);
  });

  it('rejects pitches outside ±40 cents and wrong strings', () => {
    const matcher = new PitchMatcher({ targetStringNum: 8 });

    // +45 cents is outside ±40 cents tolerance
    const outOfTol = matcher.processFrame({
      frequency: 440 * Math.pow(2, 45 / 1200),
      clarity: 0.92,
      rms: 0.08,
    });
    expect(outOfTol.status).toBe('wrong_string');
    expect(outOfTol.confirmed).toBe(false);
    expect(outOfTol.consecutiveFrames).toBe(0);

    // Adjacent string 9 (369.99 Hz) is wrong string
    const wrongStr = matcher.processFrame({ frequency: 369.99, clarity: 0.95, rms: 0.08 });
    expect(wrongStr.status).toBe('wrong_string');
    expect(wrongStr.detectedString?.num).toBe(9);
  });

  it('bridges a transient decaying 2nd-octave harmonic without falsely accepting sustained wrong-octave plucks', () => {
    const matcher = new PitchMatcher({ targetStringNum: 8 }); // A4 = 440 Hz

    // Case 1: Child actually plucks string 3 (A5 = 880 Hz) continuously -> MUST NOT match string 8!
    expect(matcher.processFrame({ frequency: 880, clarity: 0.93, rms: 0.1 }).confirmed).toBe(false);
    expect(matcher.processFrame({ frequency: 880, clarity: 0.93, rms: 0.09 }).confirmed).toBe(false);
    expect(matcher.processFrame({ frequency: 880, clarity: 0.93, rms: 0.08 }).confirmed).toBe(false);

    // Case 2: Fundamental (440 Hz), transient decaying 2nd harmonic (880 Hz), then fundamental (440 Hz)
    const f1 = matcher.processFrame({ frequency: 440, clarity: 0.92, rms: 0.1 });
    expect(f1.consecutiveFrames).toBe(1);

    const f2 = matcher.processFrame({ frequency: 880, clarity: 0.9, rms: 0.06 });
    expect(f2.status).toBe('tracking');
    expect(f2.usedHarmonicBridge).toBe(true);
    expect(f2.consecutiveFrames).toBe(2);

    const f3 = matcher.processFrame({ frequency: 440, clarity: 0.92, rms: 0.05 });
    expect(f3.status).toBe('confirmed');
    expect(f3.confirmed).toBe(true);
  });

  it('does not bridge a 2nd-octave harmonic if energy increases or repeats consecutively', () => {
    const matcher = new PitchMatcher({ targetStringNum: 8 });

    matcher.processFrame({ frequency: 440, clarity: 0.92, rms: 0.06 });
    // Louder 880 Hz suggests a new pluck on string 3, not a decaying harmonic!
    const louderOctave = matcher.processFrame({ frequency: 880, clarity: 0.92, rms: 0.12 });
    expect(louderOctave.status).toBe('wrong_string');
    expect(louderOctave.consecutiveFrames).toBe(0);
  });

  it('prevents double-triggering on the sustain tail when advancing to the same string, until release or re-pluck onset', () => {
    const matcher = new PitchMatcher({ targetStringNum: 11 }); // D4 = 293.66 Hz

    // First pluck confirms string 11
    matcher.processFrame({ frequency: 293.66, clarity: 0.92, rms: 0.1 });
    matcher.processFrame({ frequency: 293.66, clarity: 0.92, rms: 0.09 });
    const firstConfirm = matcher.processFrame({ frequency: 293.66, clarity: 0.92, rms: 0.08 });
    expect(firstConfirm.confirmed).toBe(true);

    // Next step is ALSO string 11 (e.g., Tuo 11 then Mo 11)
    matcher.setTarget(11);

    // Decaying sustain tail from the first pluck must be locked out
    const tail1 = matcher.processFrame({ frequency: 293.66, clarity: 0.92, rms: 0.07 });
    const tail2 = matcher.processFrame({ frequency: 293.66, clarity: 0.92, rms: 0.06 });
    const tail3 = matcher.processFrame({ frequency: 293.66, clarity: 0.92, rms: 0.05 });
    expect(tail1.status).toBe('cooldown_locked');
    expect(tail3.confirmed).toBe(false);

    // A fresh strong re-pluck (RMS jumps >= 1.6x above decayed tail) unlocks and counts as frame 1!
    const reattack1 = matcher.processFrame({ frequency: 293.66, clarity: 0.92, rms: 0.12 });
    expect(reattack1.status).toBe('tracking');
    expect(reattack1.consecutiveFrames).toBe(1);

    matcher.processFrame({ frequency: 293.66, clarity: 0.92, rms: 0.11 });
    const secondConfirm = matcher.processFrame({ frequency: 293.66, clarity: 0.92, rms: 0.1 });
    expect(secondConfirm.confirmed).toBe(true);
  });

  it('unlocks cooldown when advancing to a different target string or after silence', () => {
    const matcher = new PitchMatcher({ targetStringNum: 11 });

    matcher.processFrame({ frequency: 293.66, clarity: 0.9, rms: 0.1 });
    matcher.processFrame({ frequency: 293.66, clarity: 0.9, rms: 0.09 });
    expect(matcher.processFrame({ frequency: 293.66, clarity: 0.9, rms: 0.08 }).confirmed).toBe(true);

    // Switching to string 8 clears lock immediately
    matcher.setTarget(8);
    expect(matcher.processFrame({ frequency: 440, clarity: 0.9, rms: 0.08 }).consecutiveFrames).toBe(1);

    // Confirm string 8, keep target 8, then silence unlocks it
    matcher.processFrame({ frequency: 440, clarity: 0.9, rms: 0.07 });
    expect(matcher.processFrame({ frequency: 440, clarity: 0.9, rms: 0.06 }).confirmed).toBe(true);

    matcher.setTarget(8);
    expect(matcher.processFrame({ frequency: 440, clarity: 0.9, rms: 0.05 }).status).toBe('cooldown_locked');
    // Silence frame unlocks
    expect(matcher.processFrame({ frequency: 0, clarity: 0, rms: 0.002 }).status).toBe('ignored_noise');
    expect(matcher.processFrame({ frequency: 440, clarity: 0.9, rms: 0.05 }).consecutiveFrames).toBe(1);
  });

  it('validates target string numbers and supports reset / getTargetString', () => {
    expect(() => new PitchMatcher({ targetStringNum: 0 })).toThrow(RangeError);
    const matcher = new PitchMatcher({ targetStringNum: 8 });
    expect(matcher.getTargetString().num).toBe(8);
    expect(() => matcher.setTarget(22)).toThrow(RangeError);

    matcher.processFrame({ frequency: 440, clarity: 0.9, rms: 0.08 });
    matcher.reset();
    expect(matcher.processFrame({ frequency: 440, clarity: 0.9, rms: 0.08 }).consecutiveFrames).toBe(1);
  });
});
