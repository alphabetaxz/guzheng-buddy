import {
  FINGERING_META,
  getGuzhengString,
  type FingeringType,
  type GuzhengString,
} from './guzhengTuning';
import { PitchMatcher, type PitchFrame, type PitchMatchResult } from './pitchMatcher';

export type BoardZoom = 'focus' | 'full';

export interface GameStep {
  stringNum: number;
  finger: FingeringType;
  voiceHint: string;
}

export interface GameLevel {
  id: string;
  order: number;
  icon: string;
  accentColor: string;
  voiceIntro: string;
  defaultZoom: BoardZoom;
  steps: readonly GameStep[];
}

export interface GameSessionState {
  level: GameLevel;
  stepIndex: number;
  totalSteps: number;
  starsEarned: number;
  completed: boolean;
  currentStep: GameStep | null;
  currentString: GuzhengString | null;
}

export interface GameHitResult {
  matched: boolean;
  completed: boolean;
  starsEarned: number;
  matchResult?: PitchMatchResult;
}

export const BUILTIN_GAME_LEVELS: readonly GameLevel[] = [
  {
    id: 'level-1-green-snakes',
    order: 1,
    icon: '🐍',
    accentColor: 'emerald',
    voiceIntro: '第一关！我们来找古筝上的四条绿色小蛇弦吧！',
    defaultZoom: 'full',
    steps: [
      { stringNum: 8, finger: 'tuo', voiceHint: '先拨第八弦，中间的绿小蛇！' },
      { stringNum: 13, finger: 'tuo', voiceHint: '再找第十三弦，低音绿小蛇！' },
      { stringNum: 3, finger: 'tuo', voiceHint: '再拨第三弦，高音绿小蛇！' },
      { stringNum: 18, finger: 'tuo', voiceHint: '最后找第十八弦，最粗的绿小蛇！' },
    ],
  },
  {
    id: 'level-2-wake-snake',
    order: 2,
    icon: '👍',
    accentColor: 'amber',
    voiceIntro: '第二关！大指托一托，慢慢唤醒第八弦绿小蛇！',
    defaultZoom: 'focus',
    steps: [
      { stringNum: 8, finger: 'tuo', voiceHint: '大指托，第八弦，绿小蛇，第一下！' },
      { stringNum: 8, finger: 'tuo', voiceHint: '大指托，第八弦，第二下！' },
      { stringNum: 8, finger: 'tuo', voiceHint: '大指托，第八弦，第三下！' },
      { stringNum: 8, finger: 'tuo', voiceHint: '大指托，第八弦，最后一下！' },
    ],
  },
  {
    id: 'level-3-cat-koala',
    order: 3,
    icon: '🐱',
    accentColor: 'rose',
    voiceIntro: '第三关！小猫咪和小考拉一起来练习勾托抹托！',
    defaultZoom: 'focus',
    steps: [
      { stringNum: 9, finger: 'mo', voiceHint: '食指抹，第九弦，小猫咪！' },
      { stringNum: 8, finger: 'tuo', voiceHint: '大指托，第八弦，绿小蛇！' },
      { stringNum: 7, finger: 'gou', voiceHint: '中指勾，第七弦，小考拉！' },
      { stringNum: 8, finger: 'tuo', voiceHint: '大指托，第八弦，绿小蛇！' },
      { stringNum: 13, finger: 'gou', voiceHint: '中指勾，第十三弦，低音绿小蛇！' },
      { stringNum: 8, finger: 'tuo', voiceHint: '大指托，第八弦，绿小蛇！' },
    ],
  },
  {
    id: 'level-4-pentatonic-zoo',
    order: 4,
    icon: '🐰',
    accentColor: 'purple',
    voiceIntro: '第四关！五音动物园大寻宝，从朵朵兔到小考拉！',
    defaultZoom: 'focus',
    steps: [
      { stringNum: 11, finger: 'tuo', voiceHint: '第十一弦，朵朵兔，Do！' },
      { stringNum: 10, finger: 'tuo', voiceHint: '第十弦，小天鹅，Re！' },
      { stringNum: 9, finger: 'mo', voiceHint: '第九弦，小猫咪，Mi！' },
      { stringNum: 8, finger: 'tuo', voiceHint: '第八弦，绿小蛇，Sol！' },
      { stringNum: 7, finger: 'gou', voiceHint: '第七弦，小考拉，La！' },
    ],
  },
];

export function getGameLevelById(id: string): GameLevel | undefined {
  return BUILTIN_GAME_LEVELS.find((lvl) => lvl.id === id);
}

export function formatStepVoicePrompt(step: GameStep): string {
  const str = getGuzhengString(step.stringNum);
  const fingerMeta = FINGERING_META[step.finger];
  if (!str) {
    return step.voiceHint;
  }
  return step.voiceHint || `${fingerMeta.chant}，第${str.num}弦，${str.animalName}`;
}

/**
 * State machine driving a single 4~6 step children's string-finding game level.
 */
export class GameSession {
  private readonly level: GameLevel;
  private readonly matcher: PitchMatcher;
  private stepIndex = 0;
  private starsEarned = 0;
  private completed = false;

  constructor(level: GameLevel) {
    if (level.steps.length === 0) {
      throw new Error(`GameLevel ${level.id} must have at least one step`);
    }
    this.level = level;
    const first = level.steps[0]!;
    this.matcher = new PitchMatcher({ targetStringNum: first.stringNum });
  }

  getState(): GameSessionState {
    const currentStep = this.completed ? null : (this.level.steps[this.stepIndex] ?? null);
    const currentString = currentStep ? (getGuzhengString(currentStep.stringNum) ?? null) : null;
    return {
      level: this.level,
      stepIndex: this.stepIndex,
      totalSteps: this.level.steps.length,
      starsEarned: this.starsEarned,
      completed: this.completed,
      currentStep,
      currentString,
    };
  }

  reset(): void {
    this.stepIndex = 0;
    this.starsEarned = 0;
    this.completed = false;
    const first = this.level.steps[0]!;
    this.matcher.setTarget(first.stringNum, { clearLock: true });
  }

  submitStringHit(stringNum: number): GameHitResult {
    if (this.completed) {
      return { matched: false, completed: true, starsEarned: this.starsEarned };
    }
    const currentStep = this.level.steps[this.stepIndex];
    if (!currentStep || currentStep.stringNum !== stringNum) {
      return { matched: false, completed: false, starsEarned: this.starsEarned };
    }
    return this.advance();
  }

  processPitchFrame(frame: PitchFrame): GameHitResult {
    if (this.completed) {
      return { matched: false, completed: true, starsEarned: this.starsEarned };
    }
    const matchResult = this.matcher.processFrame(frame);
    if (!matchResult.confirmed) {
      return {
        matched: false,
        completed: false,
        starsEarned: this.starsEarned,
        matchResult,
      };
    }
    const res = this.advance();
    return { ...res, matchResult };
  }

  private advance(): GameHitResult {
    this.starsEarned += 1;
    const nextIdx = this.stepIndex + 1;
    if (nextIdx >= this.level.steps.length) {
      this.completed = true;
      this.matcher.reset();
      return {
        matched: true,
        completed: true,
        starsEarned: this.starsEarned,
      };
    }

    this.stepIndex = nextIdx;
    const nextStep = this.level.steps[nextIdx]!;
    this.matcher.setTarget(nextStep.stringNum);
    return {
      matched: true,
      completed: false,
      starsEarned: this.starsEarned,
    };
  }
}
