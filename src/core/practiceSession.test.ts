import { describe, expect, it } from 'vitest';
import { BUILTIN_DEMO_COURSE_PACK } from './coursePack';
import { PracticeSession } from './practiceSession';

describe('PracticeSession', () => {
  it('progresses through demo -> follow -> next segment demo -> completed in watch_then_play mode', () => {
    const session = new PracticeSession(BUILTIN_DEMO_COURSE_PACK, { mode: 'watch_then_play' });

    let state = session.getState();
    expect(state.phase).toBe('demo');
    expect(state.segmentIndex).toBe(0);
    expect(state.stepIndex).toBe(0);
    expect(state.starsEarned).toBe(0);

    // Cannot advance steps while still in demo phase
    const ignored = session.submitStringHit(11);
    expect(ignored.stepCompleted).toBe(false);
    expect(session.getState().stepIndex).toBe(0);

    // Teacher finishes demo -> transitions to follow phase
    session.completeDemo();
    expect(session.getState().phase).toBe('follow');

    // Wrong string does not advance
    const wrong = session.submitStringHit(9);
    expect(wrong.stepCompleted).toBe(false);
    expect(session.getState().stepIndex).toBe(0);

    // Segment 1 has steps: 11, 11, 8, 8
    expect(session.submitStringHit(11)).toMatchObject({ stepCompleted: true, segmentCompleted: false });
    expect(session.getState().starsEarned).toBe(1);
    expect(session.getState().stepIndex).toBe(1);

    expect(session.submitStringHit(11).stepCompleted).toBe(true);
    expect(session.submitStringHit(8).stepCompleted).toBe(true);
    const seg1Done = session.submitStringHit(8);
    expect(seg1Done).toMatchObject({
      stepCompleted: true,
      segmentCompleted: true,
      courseCompleted: false,
    });

    // Automatically unlocks segment 2 in demo phase
    state = session.getState();
    expect(state.segmentIndex).toBe(1);
    expect(state.stepIndex).toBe(0);
    expect(state.phase).toBe('demo');
    expect(state.starsEarned).toBe(4);

    // Complete segment 2 (steps: 7, 7, 8)
    session.completeDemo();
    session.submitStringHit(7);
    session.submitStringHit(7);
    const seg2Done = session.submitStringHit(8);
    expect(seg2Done).toMatchObject({
      stepCompleted: true,
      segmentCompleted: true,
      courseCompleted: true,
    });

    state = session.getState();
    expect(state.phase).toBe('completed');
    expect(state.starsEarned).toBe(7);
    expect(state.completedStepsOverall).toBe(7);
  });

  it('supports microphone PitchFrame streaming via PitchMatcher integration', () => {
    const session = new PracticeSession(BUILTIN_DEMO_COURSE_PACK, { mode: 'play_along' });
    expect(session.getState().phase).toBe('follow');

    // Step 1 target: string 11 (293.66 Hz)
    session.processPitchFrame({ frequency: 293.66, clarity: 0.92, rms: 0.1 });
    session.processPitchFrame({ frequency: 293.66, clarity: 0.91, rms: 0.09 });
    const step1 = session.processPitchFrame({ frequency: 293.66, clarity: 0.9, rms: 0.08 });
    expect(step1.stepCompleted).toBe(true);
    expect(session.getState().stepIndex).toBe(1);

    // Step 2 target is also string 11: sustain tail must NOT auto-complete Step 2
    const tail = session.processPitchFrame({ frequency: 293.66, clarity: 0.9, rms: 0.06 });
    expect(tail.stepCompleted).toBe(false);
    expect(session.getState().stepIndex).toBe(1);

    // Silence then re-pluck completes Step 2
    session.processPitchFrame({ frequency: 0, clarity: 0, rms: 0.003 });
    session.processPitchFrame({ frequency: 293.66, clarity: 0.92, rms: 0.1 });
    session.processPitchFrame({ frequency: 293.66, clarity: 0.91, rms: 0.09 });
    const step2 = session.processPitchFrame({ frequency: 293.66, clarity: 0.9, rms: 0.08 });
    expect(step2.stepCompleted).toBe(true);
    expect(session.getState().stepIndex).toBe(2);
  });

  it('supports replaying demo, switching modes, and resetting session', () => {
    const session = new PracticeSession(BUILTIN_DEMO_COURSE_PACK, { mode: 'watch_then_play' });
    session.completeDemo();
    session.submitStringHit(11);
    expect(session.getState().stepIndex).toBe(1);

    // Replay demo returns to demo phase for the current segment
    session.replayDemo();
    expect(session.getState().phase).toBe('demo');
    expect(session.getState().segmentIndex).toBe(0);

    // Switching to play_along while in demo moves immediately to follow
    session.setMode('play_along');
    expect(session.getState().phase).toBe('follow');

    // Reset restores initial state
    session.reset();
    expect(session.getState()).toMatchObject({
      phase: 'follow',
      segmentIndex: 0,
      stepIndex: 0,
      starsEarned: 0,
    });
  });

  it('ignores pitch frames during demo and guards transitions after completion', () => {
    const session = new PracticeSession(BUILTIN_DEMO_COURSE_PACK, { mode: 'watch_then_play' });
    const duringDemo = session.processPitchFrame({ frequency: 293.66, clarity: 0.95, rms: 0.1 });
    expect(duringDemo.stepCompleted).toBe(false);

    // Finish all steps across both segments
    session.completeDemo();
    session.completeDemo(); // idempotent when already in follow
    [11, 11, 8, 8].forEach((n) => session.submitStringHit(n));
    session.completeDemo();
    [7, 7, 8].forEach((n) => session.submitStringHit(n));

    expect(session.getState().phase).toBe('completed');
    expect(session.getState().currentStep).toBeNull();
    session.replayDemo(); // no-op when completed
    expect(session.getState().phase).toBe('completed');
  });
});
