import { describe, expect, it } from 'vitest';
import { BUILTIN_GAME_LEVELS, GameSession, getGameLevelById } from './gameLevels';

describe('BUILTIN_GAME_LEVELS', () => {
  it('defines all 4 built-in enlightenment levels from mvp-plan.md', () => {
    expect(BUILTIN_GAME_LEVELS).toHaveLength(4);

    // Level 1: Find all 4 green strings (8, 13, 3, 18) in full 21-string view
    const lvl1 = getGameLevelById('level-1-green-snakes');
    expect(lvl1).toBeDefined();
    expect(lvl1!.defaultZoom).toBe('full');
    expect(lvl1!.steps.map((s) => s.stringNum)).toEqual([8, 13, 3, 18]);

    // Level 2: Tuo x4 on string 8 in focus view
    const lvl2 = getGameLevelById('level-2-wake-snake');
    expect(lvl2).toBeDefined();
    expect(lvl2!.defaultZoom).toBe('focus');
    expect(lvl2!.steps.map((s) => s.stringNum)).toEqual([8, 8, 8, 8]);
    expect(lvl2!.steps.every((s) => s.finger === 'tuo')).toBe(true);

    // Level 3: Alternating middle register + string 13 with tuo/mo/gou
    const lvl3 = getGameLevelById('level-3-cat-koala');
    expect(lvl3).toBeDefined();
    expect(lvl3!.steps.map((s) => s.stringNum)).toEqual([9, 8, 7, 8, 13, 8]);

    // Level 4: Pentatonic Zoo ascending 11 -> 10 -> 9 -> 8 -> 7
    const lvl4 = getGameLevelById('level-4-pentatonic-zoo');
    expect(lvl4).toBeDefined();
    expect(lvl4!.steps.map((s) => s.stringNum)).toEqual([11, 10, 9, 8, 7]);
  });
});

describe('GameSession', () => {
  it('progresses through virtual string hits and awards stars on completion', () => {
    const level = getGameLevelById('level-1-green-snakes')!;
    const session = new GameSession(level);

    expect(session.getState()).toMatchObject({
      stepIndex: 0,
      totalSteps: 4,
      starsEarned: 0,
      completed: false,
    });
    expect(session.getState().currentStep?.stringNum).toBe(8);

    // Wrong string does not advance
    expect(session.submitStringHit(9)).toMatchObject({
      matched: false,
      completed: false,
    });
    expect(session.getState().stepIndex).toBe(0);

    // Correct sequence: 8, 13, 3, 18
    expect(session.submitStringHit(8)).toMatchObject({ matched: true, completed: false });
    expect(session.submitStringHit(13)).toMatchObject({ matched: true, completed: false });
    expect(session.submitStringHit(3)).toMatchObject({ matched: true, completed: false });
    const finalRes = session.submitStringHit(18);
    expect(finalRes).toMatchObject({ matched: true, completed: true });

    expect(session.getState()).toMatchObject({
      starsEarned: 4,
      completed: true,
      currentStep: null,
    });
  });

  it('tracks live microphone frames with PitchMatcher and enforces same-string cooldown on level 2', () => {
    const level = getGameLevelById('level-2-wake-snake')!;
    const session = new GameSession(level);

    // First pluck on string 8 (440 Hz)
    session.processPitchFrame({ frequency: 440, clarity: 0.92, rms: 0.1 });
    session.processPitchFrame({ frequency: 440, clarity: 0.91, rms: 0.09 });
    const hit1 = session.processPitchFrame({ frequency: 440, clarity: 0.9, rms: 0.08 });
    expect(hit1.matched).toBe(true);
    expect(session.getState().stepIndex).toBe(1);

    // Decaying tail must NOT auto-trigger pluck 2
    const tail = session.processPitchFrame({ frequency: 440, clarity: 0.9, rms: 0.06 });
    expect(tail.matched).toBe(false);
    expect(session.getState().stepIndex).toBe(1);

    // Silence then fresh pluck triggers step 2
    session.processPitchFrame({ frequency: 0, clarity: 0, rms: 0.002 });
    session.processPitchFrame({ frequency: 440, clarity: 0.92, rms: 0.1 });
    session.processPitchFrame({ frequency: 440, clarity: 0.91, rms: 0.09 });
    const hit2 = session.processPitchFrame({ frequency: 440, clarity: 0.9, rms: 0.08 });
    expect(hit2.matched).toBe(true);
    expect(session.getState().stepIndex).toBe(2);

    // Reset restores step 0
    session.reset();
    expect(session.getState()).toMatchObject({
      stepIndex: 0,
      starsEarned: 0,
      completed: false,
    });
  });
});
