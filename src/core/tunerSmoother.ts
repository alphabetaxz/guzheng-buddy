import {
  TUNER_TOLERANCE_CENTS,
  calculateCents,
  findNearestString,
  getGuzhengString,
  type GuzhengString,
  type TunerStatus,
} from './guzhengTuning';
import type { PitchFrame } from './pitchMatcher';

export interface TunerSmootherOptions {
  minClarity?: number;
  minRms?: number;
  windowSize?: number;
}

export interface SmoothedTunerReading {
  string: GuzhengString;
  cents: number;
  absCents: number;
  status: TunerStatus;
  /** Gauge needle position from 0 (-50 cents) to 100 (+50 cents), center = 50. */
  needlePercent: number;
}

/**
 * Smooths real-time pitch detection frames for the 21-string Parent Tuner.
 * Supports automatic string recognition or locking onto a specific string.
 */
export class TunerSmoother {
  private readonly minClarity: number;
  private readonly minRms: number;
  private readonly windowSize: number;

  private lockedStringNum: number | null = null;
  private activeStringNum: number | null = null;
  private recentCents: number[] = [];

  constructor(options?: TunerSmootherOptions) {
    this.minClarity = options?.minClarity ?? 0.82;
    this.minRms = options?.minRms ?? 0.015;
    this.windowSize = options?.windowSize ?? 5;
  }

  setLockedString(stringNum: number | null): void {
    if (stringNum !== null && !getGuzhengString(stringNum)) {
      throw new RangeError(`Invalid guzheng string number: ${stringNum}`);
    }
    this.lockedStringNum = stringNum;
    this.reset();
  }

  getLockedString(): number | null {
    return this.lockedStringNum;
  }

  reset(): void {
    this.activeStringNum = null;
    this.recentCents = [];
  }

  processFrame(frame: PitchFrame): SmoothedTunerReading | null {
    if (
      !Number.isFinite(frame.rms) ||
      frame.rms < this.minRms ||
      !Number.isFinite(frame.clarity) ||
      frame.clarity < this.minClarity ||
      !Number.isFinite(frame.frequency) ||
      frame.frequency <= 0
    ) {
      return null;
    }

    let targetString: GuzhengString | undefined;
    let rawCents: number;

    if (this.lockedStringNum !== null) {
      targetString = getGuzhengString(this.lockedStringNum);
      if (!targetString) return null;
      rawCents = calculateCents(frame.frequency, targetString.frequency);
    } else {
      const nearest = findNearestString(frame.frequency);
      if (!nearest) return null;
      targetString = nearest.string;
      rawCents = nearest.cents;
    }

    if (this.activeStringNum !== targetString.num) {
      this.activeStringNum = targetString.num;
      this.recentCents = [];
    }

    this.recentCents.push(rawCents);
    if (this.recentCents.length > this.windowSize) {
      this.recentCents.shift();
    }

    const sorted = [...this.recentCents].sort((a, b) => a - b);
    const smoothedCents = sorted[Math.floor(sorted.length / 2)] ?? rawCents;
    const absCents = Math.abs(smoothedCents);

    let status: TunerStatus;
    if (absCents <= TUNER_TOLERANCE_CENTS + 1e-9) {
      status = 'in_tune';
    } else if (smoothedCents < 0) {
      status = 'flat';
    } else {
      status = 'sharp';
    }

    const clamped = Math.max(-50, Math.min(50, smoothedCents));
    const needlePercent = 50 + clamped;

    return {
      string: targetString,
      cents: smoothedCents,
      absCents,
      status,
      needlePercent,
    };
  }
}
