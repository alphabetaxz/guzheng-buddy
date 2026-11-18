import {
  KIDS_TOLERANCE_CENTS,
  calculateCents,
  findNearestString,
  getGuzhengString,
  isOctaveHarmonic,
  type GuzhengString,
} from './guzhengTuning';

export interface PitchFrame {
  frequency: number;
  clarity: number;
  rms: number;
  timestampMs?: number;
}

export interface PitchMatcherOptions {
  targetStringNum: number;
  minClarity?: number;
  minRms?: number;
  toleranceCents?: number;
  requiredConsecutiveFrames?: number;
  reattackRmsRatio?: number;
  allowOctaveHarmonicBridge?: boolean;
}

export type PitchMatchStatus =
  | 'ignored_noise'
  | 'ignored_low_clarity'
  | 'cooldown_locked'
  | 'wrong_string'
  | 'tracking'
  | 'confirmed';

export interface PitchMatchResult {
  status: PitchMatchStatus;
  targetStringNum: number;
  consecutiveFrames: number;
  requiredFrames: number;
  cents: number | null;
  detectedString: GuzhengString | null;
  usedHarmonicBridge: boolean;
  confirmed: boolean;
}

const DEFAULT_MIN_CLARITY = 0.82;
const DEFAULT_MIN_RMS = 0.015;
const DEFAULT_REQUIRED_FRAMES = 3;
const DEFAULT_REATTACK_RMS_RATIO = 1.6;

/**
 * Stateful pitch-matching state machine with:
 * - RMS noise gate & clarity threshold filtering
 * - Consecutive-frame debouncing (default 3 frames ≈ 90ms)
 * - Transient decaying 2nd-octave harmonic bridging
 * - Sustain-tail cooldown lock preventing duplicate triggers on repeated same-string steps
 */
export class PitchMatcher {
  private targetString: GuzhengString;
  private readonly minClarity: number;
  private readonly minRms: number;
  private readonly toleranceCents: number;
  private readonly requiredFrames: number;
  private readonly reattackRmsRatio: number;
  private readonly allowOctaveHarmonicBridge: boolean;

  private consecutiveFrames = 0;
  private harmonicBridgedInStreak = false;
  private lastTargetRms = 0;

  private lockedStringNum: number | null = null;
  private lastAcceptedRms = 0;

  constructor(options: PitchMatcherOptions) {
    const str = getGuzhengString(options.targetStringNum);
    if (!str) {
      throw new RangeError(`Invalid guzheng string number: ${options.targetStringNum}`);
    }
    this.targetString = str;
    this.minClarity = options.minClarity ?? DEFAULT_MIN_CLARITY;
    this.minRms = options.minRms ?? DEFAULT_MIN_RMS;
    this.toleranceCents = options.toleranceCents ?? KIDS_TOLERANCE_CENTS;
    this.requiredFrames = options.requiredConsecutiveFrames ?? DEFAULT_REQUIRED_FRAMES;
    this.reattackRmsRatio = options.reattackRmsRatio ?? DEFAULT_REATTACK_RMS_RATIO;
    this.allowOctaveHarmonicBridge = options.allowOctaveHarmonicBridge ?? true;
  }

  getTargetString(): GuzhengString {
    return this.targetString;
  }

  /**
   * Updates the target string.
   * When advancing to a different string, any sustain-tail lock clears immediately.
   * When advancing to the same string, the lock stays active until silence or re-pluck onset.
   */
  setTarget(stringNum: number, options?: { clearLock?: boolean }): void {
    const str = getGuzhengString(stringNum);
    if (!str) {
      throw new RangeError(`Invalid guzheng string number: ${stringNum}`);
    }
    this.targetString = str;
    this.resetStreak();
    if (options?.clearLock || this.lockedStringNum !== stringNum) {
      this.lockedStringNum = null;
      this.lastAcceptedRms = 0;
    }
  }

  reset(): void {
    this.resetStreak();
    this.lockedStringNum = null;
    this.lastAcceptedRms = 0;
  }

  private resetStreak(): void {
    this.consecutiveFrames = 0;
    this.harmonicBridgedInStreak = false;
    this.lastTargetRms = 0;
  }

  processFrame(frame: PitchFrame): PitchMatchResult {
    const rmsValid = Number.isFinite(frame.rms) && frame.rms >= this.minRms;
    if (!rmsValid) {
      this.resetStreak();
      this.lockedStringNum = null;
      this.lastAcceptedRms = 0;
      return {
        status: 'ignored_noise',
        targetStringNum: this.targetString.num,
        consecutiveFrames: 0,
        requiredFrames: this.requiredFrames,
        cents: null,
        detectedString: null,
        usedHarmonicBridge: false,
        confirmed: false,
      };
    }

    const freqValid = Number.isFinite(frame.frequency) && frame.frequency > 0;
    const clarityValid = Number.isFinite(frame.clarity) && frame.clarity >= this.minClarity;
    if (!freqValid || !clarityValid) {
      this.resetStreak();
      return {
        status: 'ignored_low_clarity',
        targetStringNum: this.targetString.num,
        consecutiveFrames: 0,
        requiredFrames: this.requiredFrames,
        cents: null,
        detectedString: null,
        usedHarmonicBridge: false,
        confirmed: false,
      };
    }

    const nearest = findNearestString(frame.frequency);
    const detectedString = nearest ? nearest.string : null;
    const targetCents = calculateCents(frame.frequency, this.targetString.frequency);
    const isDirectHit = Math.abs(targetCents) <= this.toleranceCents + 1e-9;

    // Handle sustain-tail cooldown when consecutive steps target the same string
    if (this.lockedStringNum === this.targetString.num) {
      const switchedToOtherString =
        nearest !== null &&
        nearest.withinKidsTolerance &&
        nearest.string.num !== this.targetString.num;
      const hasStrongReattack =
        this.lastAcceptedRms > 0 && frame.rms >= this.lastAcceptedRms * this.reattackRmsRatio;

      if (switchedToOtherString || hasStrongReattack) {
        this.lockedStringNum = null;
        this.lastAcceptedRms = 0;
      } else {
        this.lastAcceptedRms = Math.min(this.lastAcceptedRms, frame.rms);
        return {
          status: 'cooldown_locked',
          targetStringNum: this.targetString.num,
          consecutiveFrames: 0,
          requiredFrames: this.requiredFrames,
          cents: targetCents,
          detectedString,
          usedHarmonicBridge: false,
          confirmed: false,
        };
      }
    }

    if (isDirectHit) {
      this.consecutiveFrames += 1;
      this.lastTargetRms = frame.rms;
      this.lastAcceptedRms = frame.rms;
      return this.finalizeHit(targetCents, detectedString, false);
    }

    // Bridge a single transient decaying 2nd-octave harmonic after a fundamental frame
    const canBridgeHarmonic =
      this.allowOctaveHarmonicBridge &&
      this.consecutiveFrames > 0 &&
      !this.harmonicBridgedInStreak &&
      frame.rms < this.lastTargetRms &&
      isOctaveHarmonic(frame.frequency, this.targetString.frequency, this.toleranceCents);

    if (canBridgeHarmonic) {
      this.consecutiveFrames += 1;
      this.harmonicBridgedInStreak = true;
      this.lastTargetRms = frame.rms;
      return this.finalizeHit(targetCents, detectedString, true);
    }

    this.resetStreak();
    return {
      status: 'wrong_string',
      targetStringNum: this.targetString.num,
      consecutiveFrames: 0,
      requiredFrames: this.requiredFrames,
      cents: targetCents,
      detectedString,
      usedHarmonicBridge: false,
      confirmed: false,
    };
  }

  private finalizeHit(
    cents: number,
    detectedString: GuzhengString | null,
    usedHarmonicBridge: boolean,
  ): PitchMatchResult {
    const count = this.consecutiveFrames;
    if (count >= this.requiredFrames) {
      this.lockedStringNum = this.targetString.num;
      this.resetStreak();
      return {
        status: 'confirmed',
        targetStringNum: this.targetString.num,
        consecutiveFrames: count,
        requiredFrames: this.requiredFrames,
        cents,
        detectedString,
        usedHarmonicBridge,
        confirmed: true,
      };
    }

    return {
      status: 'tracking',
      targetStringNum: this.targetString.num,
      consecutiveFrames: count,
      requiredFrames: this.requiredFrames,
      cents,
      detectedString,
      usedHarmonicBridge,
      confirmed: false,
    };
  }
}
