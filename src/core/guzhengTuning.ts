export type JianpuNote = '1' | '2' | '3' | '5' | '6';

export type OctaveRegister =
  | 'double_high'
  | 'high'
  | 'mid'
  | 'low'
  | 'double_low';

export type AnimalId = 'rabbit' | 'swan' | 'cat' | 'snake' | 'koala';

export type FingeringType = 'tuo' | 'mo' | 'gou';

export interface AnimalAnchor {
  id: AnimalId;
  name: string;
  emoji: string;
  jianpu: JianpuNote;
  solfege: string;
  colorClass: string;
}

export interface FingeringInfo {
  id: FingeringType;
  label: string;
  symbol: string;
  emoji: string;
  chant: string;
}

export interface GuzhengString {
  num: number;
  isGreen: boolean;
  jianpu: JianpuNote;
  octave: OctaveRegister;
  noteName: string;
  frequency: number;
  animal: AnimalId;
  animalEmoji: string;
  animalName: string;
}

export interface NearestStringMatch {
  string: GuzhengString;
  cents: number;
  absCents: number;
  withinKidsTolerance: boolean;
  withinTunerTolerance: boolean;
}

export type TunerStatus = 'flat' | 'in_tune' | 'sharp';

export interface TunerReading {
  string: GuzhengString;
  cents: number;
  absCents: number;
  status: TunerStatus;
}

export const KIDS_TOLERANCE_CENTS = 40;
export const TUNER_TOLERANCE_CENTS = 8;
const CENTS_EPSILON = 1e-9;

export const ANIMAL_BY_JIANPU: Record<JianpuNote, AnimalAnchor> = {
  '1': {
    id: 'rabbit',
    name: '朵朵兔',
    emoji: '🐰',
    jianpu: '1',
    solfege: 'Do',
    colorClass: 'red',
  },
  '2': {
    id: 'swan',
    name: '小天鹅',
    emoji: '🦢',
    jianpu: '2',
    solfege: 'Re',
    colorClass: 'orange',
  },
  '3': {
    id: 'cat',
    name: '小猫咪',
    emoji: '🐱',
    jianpu: '3',
    solfege: 'Mi',
    colorClass: 'yellow',
  },
  '5': {
    id: 'snake',
    name: '绿小蛇',
    emoji: '🐍',
    jianpu: '5',
    solfege: 'Sol',
    colorClass: 'emerald',
  },
  '6': {
    id: 'koala',
    name: '小考拉',
    emoji: '🐨',
    jianpu: '6',
    solfege: 'La',
    colorClass: 'purple',
  },
};

export const FINGERING_META: Record<FingeringType, FingeringInfo> = {
  tuo: {
    id: 'tuo',
    label: '托',
    symbol: 'L',
    emoji: '👍',
    chant: '大指托一托',
  },
  mo: {
    id: 'mo',
    label: '抹',
    symbol: '\\',
    emoji: '☝️',
    chant: '食指抹一抹',
  },
  gou: {
    id: 'gou',
    label: '勾',
    symbol: '∧',
    emoji: '👌',
    chant: '中指勾一勾',
  },
};

interface RawStringSpec {
  num: number;
  isGreen: boolean;
  jianpu: JianpuNote;
  octave: OctaveRegister;
  noteName: string;
  frequency: number;
}

const RAW_21_STRINGS: readonly RawStringSpec[] = [
  { num: 1, isGreen: false, jianpu: '1', octave: 'double_high', noteName: 'D6', frequency: 1174.66 },
  { num: 2, isGreen: false, jianpu: '6', octave: 'high', noteName: 'B5', frequency: 987.77 },
  { num: 3, isGreen: true, jianpu: '5', octave: 'high', noteName: 'A5', frequency: 880.0 },
  { num: 4, isGreen: false, jianpu: '3', octave: 'high', noteName: 'F#5', frequency: 739.99 },
  { num: 5, isGreen: false, jianpu: '2', octave: 'high', noteName: 'E5', frequency: 659.25 },
  { num: 6, isGreen: false, jianpu: '1', octave: 'high', noteName: 'D5', frequency: 587.33 },
  { num: 7, isGreen: false, jianpu: '6', octave: 'mid', noteName: 'B4', frequency: 493.88 },
  { num: 8, isGreen: true, jianpu: '5', octave: 'mid', noteName: 'A4', frequency: 440.0 },
  { num: 9, isGreen: false, jianpu: '3', octave: 'mid', noteName: 'F#4', frequency: 369.99 },
  { num: 10, isGreen: false, jianpu: '2', octave: 'mid', noteName: 'E4', frequency: 329.63 },
  { num: 11, isGreen: false, jianpu: '1', octave: 'mid', noteName: 'D4', frequency: 293.66 },
  { num: 12, isGreen: false, jianpu: '6', octave: 'low', noteName: 'B3', frequency: 246.94 },
  { num: 13, isGreen: true, jianpu: '5', octave: 'low', noteName: 'A3', frequency: 220.0 },
  { num: 14, isGreen: false, jianpu: '3', octave: 'low', noteName: 'F#3', frequency: 185.0 },
  { num: 15, isGreen: false, jianpu: '2', octave: 'low', noteName: 'E3', frequency: 164.81 },
  { num: 16, isGreen: false, jianpu: '1', octave: 'low', noteName: 'D3', frequency: 146.83 },
  { num: 17, isGreen: false, jianpu: '6', octave: 'double_low', noteName: 'B2', frequency: 123.47 },
  { num: 18, isGreen: true, jianpu: '5', octave: 'double_low', noteName: 'A2', frequency: 110.0 },
  { num: 19, isGreen: false, jianpu: '3', octave: 'double_low', noteName: 'F#2', frequency: 92.5 },
  { num: 20, isGreen: false, jianpu: '2', octave: 'double_low', noteName: 'E2', frequency: 82.41 },
  { num: 21, isGreen: false, jianpu: '1', octave: 'double_low', noteName: 'D2', frequency: 73.42 },
];

export const GUZHENG_21_STRINGS: readonly GuzhengString[] = RAW_21_STRINGS.map((spec) => {
  const anchor = ANIMAL_BY_JIANPU[spec.jianpu];
  return {
    ...spec,
    animal: anchor.id,
    animalEmoji: anchor.emoji,
    animalName: anchor.name,
  };
});

const STRING_BY_NUM = new Map<number, GuzhengString>(
  GUZHENG_21_STRINGS.map((s) => [s.num, s]),
);

export function getGuzhengString(num: number): GuzhengString | undefined {
  return STRING_BY_NUM.get(num);
}

export function getGreenStrings(): GuzhengString[] {
  return GUZHENG_21_STRINGS.filter((s) => s.isGreen);
}

/**
 * Calculates pitch deviation in cents: 1200 * log2(detectedFreq / targetFreq).
 */
export function calculateCents(detectedFreq: number, targetFreq: number): number {
  if (
    !Number.isFinite(detectedFreq) ||
    !Number.isFinite(targetFreq) ||
    detectedFreq <= 0 ||
    targetFreq <= 0
  ) {
    throw new RangeError('Frequencies must be positive finite numbers');
  }
  return 1200 * Math.log2(detectedFreq / targetFreq);
}

export function isOctaveHarmonic(
  detectedFreq: number,
  targetFreq: number,
  toleranceCents: number = KIDS_TOLERANCE_CENTS,
): boolean {
  if (
    !Number.isFinite(detectedFreq) ||
    !Number.isFinite(targetFreq) ||
    detectedFreq <= 0 ||
    targetFreq <= 0
  ) {
    return false;
  }
  const centsFromOctave = Math.abs(calculateCents(detectedFreq, targetFreq * 2));
  return centsFromOctave <= toleranceCents + CENTS_EPSILON;
}

export function findNearestString(detectedFreq: number): NearestStringMatch | null {
  if (!Number.isFinite(detectedFreq) || detectedFreq <= 0) {
    return null;
  }

  let bestString: GuzhengString | undefined;
  let bestCents = 0;
  let bestAbsCents = Number.POSITIVE_INFINITY;

  for (const s of GUZHENG_21_STRINGS) {
    const cents = calculateCents(detectedFreq, s.frequency);
    const absCents = Math.abs(cents);
    if (absCents < bestAbsCents) {
      bestAbsCents = absCents;
      bestCents = cents;
      bestString = s;
    }
  }

  if (!bestString) {
    return null;
  }

  return {
    string: bestString,
    cents: bestCents,
    absCents: bestAbsCents,
    withinKidsTolerance: bestAbsCents <= KIDS_TOLERANCE_CENTS + CENTS_EPSILON,
    withinTunerTolerance: bestAbsCents <= TUNER_TOLERANCE_CENTS + CENTS_EPSILON,
  };
}

export function evaluateTunerPitch(detectedFreq: number): TunerReading | null {
  const nearest = findNearestString(detectedFreq);
  if (!nearest) {
    return null;
  }

  let status: TunerStatus;
  if (nearest.withinTunerTolerance) {
    status = 'in_tune';
  } else if (nearest.cents < 0) {
    status = 'flat';
  } else {
    status = 'sharp';
  }

  return {
    string: nearest.string,
    cents: nearest.cents,
    absCents: nearest.absCents,
    status,
  };
}
