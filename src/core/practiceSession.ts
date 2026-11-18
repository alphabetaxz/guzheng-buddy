import type { CourseSegment, CourseStep, LessonCoursePack } from './coursePack';
import { PitchMatcher, type PitchFrame, type PitchMatchResult, type PitchMatcherOptions } from './pitchMatcher';

export type PracticeMode = 'watch_then_play' | 'play_along';
export type PracticePhase = 'demo' | 'follow' | 'completed';

export interface PracticeSessionOptions {
  mode?: PracticeMode;
  matcherOptions?: Omit<PitchMatcherOptions, 'targetStringNum'>;
}

export interface PracticeSessionState {
  mode: PracticeMode;
  phase: PracticePhase;
  segmentIndex: number;
  stepIndex: number;
  totalSegments: number;
  totalStepsInSegment: number;
  totalStepsOverall: number;
  completedStepsOverall: number;
  starsEarned: number;
  currentSegment: CourseSegment | null;
  currentStep: CourseStep | null;
}

export interface PracticeAdvanceResult {
  stepCompleted: boolean;
  segmentCompleted: boolean;
  courseCompleted: boolean;
  phaseChanged: boolean;
  matchResult?: PitchMatchResult;
}

/**
 * State machine orchestrating segmented teacher-video follow-along practice.
 * Supports "watch_then_play" (demo -> follow per segment) and "play_along" modes.
 */
export class PracticeSession {
  private readonly course: LessonCoursePack;
  private readonly matcher: PitchMatcher;
  private mode: PracticeMode;
  private phase: PracticePhase;
  private segmentIndex = 0;
  private stepIndex = 0;
  private starsEarned = 0;
  private completedStepsOverall = 0;
  private readonly totalStepsOverall: number;

  constructor(course: LessonCoursePack, options?: PracticeSessionOptions) {
    this.course = course;
    this.mode = options?.mode ?? 'watch_then_play';
    this.phase = this.mode === 'watch_then_play' ? 'demo' : 'follow';
    this.totalStepsOverall = course.segments.reduce((acc, seg) => acc + seg.steps.length, 0);

    const firstStep = this.getCurrentStep();
    if (!firstStep) {
      throw new Error('Course pack must contain at least one step');
    }
    this.matcher = new PitchMatcher({
      ...options?.matcherOptions,
      targetStringNum: firstStep.stringNum,
    });
  }

  private getCurrentSegment(): CourseSegment | null {
    return this.course.segments[this.segmentIndex] ?? null;
  }

  private getCurrentStep(): CourseStep | null {
    const seg = this.getCurrentSegment();
    if (!seg) return null;
    return seg.steps[this.stepIndex] ?? null;
  }

  getState(): PracticeSessionState {
    const seg = this.getCurrentSegment();
    const step = this.getCurrentStep();
    return {
      mode: this.mode,
      phase: this.phase,
      segmentIndex: this.segmentIndex,
      stepIndex: this.stepIndex,
      totalSegments: this.course.segments.length,
      totalStepsInSegment: seg ? seg.steps.length : 0,
      totalStepsOverall: this.totalStepsOverall,
      completedStepsOverall: this.completedStepsOverall,
      starsEarned: this.starsEarned,
      currentSegment: seg,
      currentStep: this.phase === 'completed' ? null : step,
    };
  }

  completeDemo(): void {
    if (this.phase !== 'demo') return;
    this.phase = 'follow';
    const step = this.getCurrentStep();
    if (step) {
      this.matcher.setTarget(step.stringNum, { clearLock: true });
    }
  }

  replayDemo(): void {
    if (this.phase === 'completed') return;
    this.phase = 'demo';
    this.matcher.reset();
  }

  setMode(mode: PracticeMode): void {
    this.mode = mode;
    if (this.phase === 'demo' && mode === 'play_along') {
      this.completeDemo();
    }
  }

  reset(): void {
    this.segmentIndex = 0;
    this.stepIndex = 0;
    this.starsEarned = 0;
    this.completedStepsOverall = 0;
    this.phase = this.mode === 'watch_then_play' ? 'demo' : 'follow';
    const firstStep = this.getCurrentStep();
    if (firstStep) {
      this.matcher.setTarget(firstStep.stringNum, { clearLock: true });
    }
  }

  submitStringHit(stringNum: number): PracticeAdvanceResult {
    if (this.phase !== 'follow') {
      return {
        stepCompleted: false,
        segmentCompleted: false,
        courseCompleted: false,
        phaseChanged: false,
      };
    }

    const currentStep = this.getCurrentStep();
    if (!currentStep || stringNum !== currentStep.stringNum) {
      return {
        stepCompleted: false,
        segmentCompleted: false,
        courseCompleted: false,
        phaseChanged: false,
      };
    }

    return this.advanceStep();
  }

  processPitchFrame(frame: PitchFrame): PracticeAdvanceResult {
    if (this.phase !== 'follow') {
      return {
        stepCompleted: false,
        segmentCompleted: false,
        courseCompleted: false,
        phaseChanged: false,
      };
    }

    const matchResult = this.matcher.processFrame(frame);
    if (!matchResult.confirmed) {
      return {
        stepCompleted: false,
        segmentCompleted: false,
        courseCompleted: false,
        phaseChanged: false,
        matchResult,
      };
    }

    const advance = this.advanceStep();
    return {
      ...advance,
      matchResult,
    };
  }

  private advanceStep(): PracticeAdvanceResult {
    const seg = this.getCurrentSegment();
    if (!seg) {
      return {
        stepCompleted: false,
        segmentCompleted: false,
        courseCompleted: false,
        phaseChanged: false,
      };
    }

    this.starsEarned += 1;
    this.completedStepsOverall += 1;

    const nextStepIdx = this.stepIndex + 1;
    if (nextStepIdx < seg.steps.length) {
      this.stepIndex = nextStepIdx;
      const nextStep = this.getCurrentStep();
      if (nextStep) {
        this.matcher.setTarget(nextStep.stringNum);
      }
      return {
        stepCompleted: true,
        segmentCompleted: false,
        courseCompleted: false,
        phaseChanged: false,
      };
    }

    // Current segment completed
    const nextSegIdx = this.segmentIndex + 1;
    if (nextSegIdx < this.course.segments.length) {
      this.segmentIndex = nextSegIdx;
      this.stepIndex = 0;
      const prevPhase = this.phase;
      this.phase = this.mode === 'watch_then_play' ? 'demo' : 'follow';
      const nextStep = this.getCurrentStep();
      if (nextStep) {
        this.matcher.setTarget(nextStep.stringNum, { clearLock: true });
      }
      return {
        stepCompleted: true,
        segmentCompleted: true,
        courseCompleted: false,
        phaseChanged: this.phase !== prevPhase,
      };
    }

    // Entire course completed
    this.phase = 'completed';
    this.matcher.reset();
    return {
      stepCompleted: true,
      segmentCompleted: true,
      courseCompleted: true,
      phaseChanged: true,
    };
  }
}
