import { describe, expect, it } from 'vitest';
import {
  ANIMAL_BY_JIANPU,
  GUZHENG_21_STRINGS,
  KIDS_TOLERANCE_CENTS,
  TUNER_TOLERANCE_CENTS,
  calculateCents,
  evaluateTunerPitch,
  findNearestString,
  getGreenStrings,
  getGuzhengString,
  isOctaveHarmonic,
} from './guzhengTuning';

describe('guzhengTuning', () => {
  it('defines all 21 standard D-tuning strings with accurate frequencies and green markers', () => {
    expect(GUZHENG_21_STRINGS).toHaveLength(21);

    const greenNums = getGreenStrings().map((s) => s.num);
    expect(greenNums).toEqual([3, 8, 13, 18]);

    // Spot check boundary and core middle-register strings from mvp-plan.md
    expect(getGuzhengString(1)).toMatchObject({
      num: 1,
      jianpu: '1',
      noteName: 'D6',
      frequency: 1174.66,
      isGreen: false,
      animal: 'rabbit',
    });
    expect(getGuzhengString(3)).toMatchObject({
      num: 3,
      jianpu: '5',
      noteName: 'A5',
      frequency: 880.0,
      isGreen: true,
      animal: 'snake',
    });
    expect(getGuzhengString(8)).toMatchObject({
      num: 8,
      jianpu: '5',
      noteName: 'A4',
      frequency: 440.0,
      isGreen: true,
      animal: 'snake',
    });
    expect(getGuzhengString(11)).toMatchObject({
      num: 11,
      jianpu: '1',
      noteName: 'D4',
      frequency: 293.66,
      isGreen: false,
      animal: 'rabbit',
    });
    expect(getGuzhengString(13)).toMatchObject({
      num: 13,
      jianpu: '5',
      noteName: 'A3',
      frequency: 220.0,
      isGreen: true,
      animal: 'snake',
    });
    expect(getGuzhengString(18)).toMatchObject({
      num: 18,
      jianpu: '5',
      noteName: 'A2',
      frequency: 110.0,
      isGreen: true,
      animal: 'snake',
    });
    expect(getGuzhengString(21)).toMatchObject({
      num: 21,
      jianpu: '1',
      noteName: 'D2',
      frequency: 73.42,
      isGreen: false,
      animal: 'rabbit',
    });

    // Out-of-range string lookup returns undefined
    expect(getGuzhengString(0)).toBeUndefined();
    expect(getGuzhengString(22)).toBeUndefined();
  });

  it('maps pentatonic jianpu notes 1/2/3/5/6 to child-friendly animal anchors', () => {
    expect(ANIMAL_BY_JIANPU['1'].name).toBe('朵朵兔');
    expect(ANIMAL_BY_JIANPU['2'].name).toBe('小天鹅');
    expect(ANIMAL_BY_JIANPU['3'].name).toBe('小猫咪');
    expect(ANIMAL_BY_JIANPU['5'].name).toBe('绿小蛇');
    expect(ANIMAL_BY_JIANPU['6'].name).toBe('小考拉');
  });

  it('computes cents deviation accurately using 1200 * log2(f_detected / f_target)', () => {
    expect(calculateCents(440, 440)).toBe(0);
    expect(calculateCents(880, 440)).toBeCloseTo(1200, 6);
    expect(calculateCents(220, 440)).toBeCloseTo(-1200, 6);

    // +40 cents relative to 440 Hz => 440 * 2^(40/1200)
    const plus40 = 440 * Math.pow(2, 40 / 1200);
    expect(calculateCents(plus40, 440)).toBeCloseTo(40, 6);

    // -40 cents relative to 440 Hz => 440 * 2^(-40/1200)
    const minus40 = 440 * Math.pow(2, -40 / 1200);
    expect(calculateCents(minus40, 440)).toBeCloseTo(-40, 6);
  });

  it('matches all 21 strings to themselves with 0 cents and respects ±40 / ±8 cents boundaries', () => {
    expect(KIDS_TOLERANCE_CENTS).toBe(40);
    expect(TUNER_TOLERANCE_CENTS).toBe(8);

    for (const s of GUZHENG_21_STRINGS) {
      const match = findNearestString(s.frequency);
      expect(match).not.toBeNull();
      expect(match!.string.num).toBe(s.num);
      expect(match!.cents).toBeCloseTo(0, 4);
      expect(match!.withinKidsTolerance).toBe(true);
      expect(match!.withinTunerTolerance).toBe(true);
    }

    // Boundary check around string 8 (440 Hz)
    const atPlus39 = 440 * Math.pow(2, 39.9 / 1200);
    const atPlus40 = 440 * Math.pow(2, 40 / 1200);
    const atPlus41 = 440 * Math.pow(2, 41 / 1200);
    const atMinus40 = 440 * Math.pow(2, -40 / 1200);
    const atMinus41 = 440 * Math.pow(2, -41 / 1200);

    expect(findNearestString(atPlus39)!.withinKidsTolerance).toBe(true);
    expect(findNearestString(atPlus40)!.withinKidsTolerance).toBe(true);
    expect(findNearestString(atPlus41)!.withinKidsTolerance).toBe(false);
    expect(findNearestString(atMinus40)!.withinKidsTolerance).toBe(true);
    expect(findNearestString(atMinus41)!.withinKidsTolerance).toBe(false);
  });

  it('returns null or false for invalid frequencies and throws on invalid calculateCents inputs', () => {
    expect(findNearestString(0)).toBeNull();
    expect(findNearestString(-100)).toBeNull();
    expect(findNearestString(Number.NaN)).toBeNull();
    expect(findNearestString(Number.POSITIVE_INFINITY)).toBeNull();
    expect(evaluateTunerPitch(0)).toBeNull();

    expect(isOctaveHarmonic(0, 440)).toBe(false);
    expect(isOctaveHarmonic(440, -10)).toBe(false);
    expect(() => calculateCents(0, 440)).toThrow(RangeError);
    expect(() => calculateCents(440, 0)).toThrow(RangeError);
  });

  it('detects 2nd-octave harmonics within tolerance', () => {
    expect(isOctaveHarmonic(880, 440, 40)).toBe(true);
    expect(isOctaveHarmonic(880 * Math.pow(2, 25 / 1200), 440, 40)).toBe(true);
    expect(isOctaveHarmonic(659.25, 440, 40)).toBe(false);
  });

  it('evaluates parent tuner status using ±8 cents threshold', () => {
    const inTune = evaluateTunerPitch(440 * Math.pow(2, 7.5 / 1200));
    expect(inTune).not.toBeNull();
    expect(inTune!.string.num).toBe(8);
    expect(inTune!.status).toBe('in_tune');

    const sharp = evaluateTunerPitch(440 * Math.pow(2, 12 / 1200));
    expect(sharp!.status).toBe('sharp');

    const flat = evaluateTunerPitch(440 * Math.pow(2, -12 / 1200));
    expect(flat!.status).toBe('flat');
  });
});
